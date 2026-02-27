
-- Fix 1: Add authorization to run_matching_for_case
CREATE OR REPLACE FUNCTION public.run_matching_for_case(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appetite branch_appetites%ROWTYPE;
  v_score INT;
  v_advisor_id uuid;
BEGIN
  -- Authorization: only the case owner can run matching
  SELECT advisor_id INTO v_advisor_id FROM cases WHERE id = p_case_id;
  
  IF v_advisor_id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  
  IF v_advisor_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: you can only run matching on your own cases';
  END IF;

  FOR v_appetite IN
    SELECT * FROM branch_appetites
    WHERE is_active = true
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  LOOP
    v_score := compute_match_score(p_case_id, v_appetite.id);

    IF v_score >= 40 THEN
      INSERT INTO matches (case_id, appetite_id, score, status)
      VALUES (p_case_id, v_appetite.id, v_score, 'pending')
      ON CONFLICT (case_id, appetite_id) DO UPDATE SET score = v_score;
    END IF;
  END LOOP;
END;
$$;

-- Fix 2: Add authorization to compute_match_score
CREATE OR REPLACE FUNCTION public.compute_match_score(p_case_id uuid, p_appetite_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case cases%ROWTYPE;
  v_appetite branch_appetites%ROWTYPE;
  v_score INT := 0;
  v_has_access boolean;
BEGIN
  -- Authorization: caller must own the case or the appetite
  SELECT EXISTS (
    SELECT 1 FROM cases WHERE id = p_case_id AND advisor_id = auth.uid()
    UNION ALL
    SELECT 1 FROM branch_appetites WHERE id = p_appetite_id AND banker_id = auth.uid()
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Unauthorized: you must own either the case or appetite';
  END IF;

  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  SELECT * INTO v_appetite FROM branch_appetites WHERE id = p_appetite_id;

  IF v_case.loan_amount_min >= v_appetite.min_loan_amount THEN v_score := v_score + 25; END IF;
  IF v_case.ltv <= v_appetite.max_ltv THEN v_score := v_score + 25; END IF;
  IF v_case.borrower_type = ANY(v_appetite.preferred_borrower_types) THEN v_score := v_score + 20; END IF;
  IF v_case.region = ANY(v_appetite.preferred_regions) THEN v_score := v_score + 15; END IF;
  IF v_appetite.sla_days <= 5 THEN v_score := v_score + 15; END IF;

  IF v_appetite.appetite_level = 'high' THEN
    v_score := LEAST(ROUND(v_score * 1.3), 100);
  ELSIF v_appetite.appetite_level = 'low' THEN
    v_score := ROUND(v_score * 0.7);
  END IF;

  RETURN v_score;
END;
$$;

-- Fix 3: Replace permissive INSERT policy on matches with deny-all (RPC-only creation)
DROP POLICY IF EXISTS "System inserts matches" ON matches;

CREATE POLICY "Deny direct match inserts"
ON matches FOR INSERT TO authenticated
WITH CHECK (false);
