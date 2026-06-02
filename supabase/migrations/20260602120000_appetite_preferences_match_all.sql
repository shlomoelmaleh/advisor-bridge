-- Fix: empty / null preference lists should mean "no preference" (match anything),
-- not "match nothing". Previously `borrower_type = ANY('{}')` and
-- `region = ANY('{}')` were always false, so every appetite silently lost the
-- 20 (borrower type) + 15 (region) points — capping realistic scores far below
-- what the UI implies. This redefines BOTH scoring functions so an empty or null
-- preferred_* array awards the points (filter disabled), while a populated array
-- still scores only on a real match. Also repairs all legacy rows that were
-- created with empty preference arrays.

-- Internal (SECURITY DEFINER, no auth check) — auto-match on case approval path.
CREATE OR REPLACE FUNCTION public.internal_compute_match_score(p_case_id uuid, p_appetite_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case cases%ROWTYPE;
  v_appetite branch_appetites%ROWTYPE;
  v_score INT := 0;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  SELECT * INTO v_appetite FROM branch_appetites WHERE id = p_appetite_id;

  IF v_case.loan_amount_min >= v_appetite.min_loan_amount THEN v_score := v_score + 25; END IF;
  IF v_case.ltv <= v_appetite.max_ltv THEN v_score := v_score + 25; END IF;

  -- Empty/null preferred_borrower_types = no preference → award points.
  IF COALESCE(cardinality(v_appetite.preferred_borrower_types), 0) = 0
     OR v_case.borrower_type = ANY(v_appetite.preferred_borrower_types) THEN
    v_score := v_score + 20;
  END IF;

  -- Empty/null preferred_regions = no preference → award points.
  IF COALESCE(cardinality(v_appetite.preferred_regions), 0) = 0
     OR v_case.region = ANY(v_appetite.preferred_regions) THEN
    v_score := v_score + 15;
  END IF;

  IF v_appetite.sla_days <= 5 THEN v_score := v_score + 15; END IF;

  IF v_appetite.appetite_level = 'high' THEN
    v_score := LEAST(ROUND(v_score * 1.3), 100);
  ELSIF v_appetite.appetite_level = 'low' THEN
    v_score := ROUND(v_score * 0.7);
  END IF;

  RETURN v_score;
END;
$function$;

-- Public (auth-checked) — manual "run matching" + auto-match on appetite approval.
CREATE OR REPLACE FUNCTION public.compute_match_score(p_case_id uuid, p_appetite_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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

  IF COALESCE(cardinality(v_appetite.preferred_borrower_types), 0) = 0
     OR v_case.borrower_type = ANY(v_appetite.preferred_borrower_types) THEN
    v_score := v_score + 20;
  END IF;

  IF COALESCE(cardinality(v_appetite.preferred_regions), 0) = 0
     OR v_case.region = ANY(v_appetite.preferred_regions) THEN
    v_score := v_score + 15;
  END IF;

  IF v_appetite.sla_days <= 5 THEN v_score := v_score + 15; END IF;

  IF v_appetite.appetite_level = 'high' THEN
    v_score := LEAST(ROUND(v_score * 1.3), 100);
  ELSIF v_appetite.appetite_level = 'low' THEN
    v_score := ROUND(v_score * 0.7);
  END IF;

  RETURN v_score;
END;
$function$;

-- Normalize legacy NULL preference arrays to empty arrays so the "no preference"
-- semantics above are explicit and consistent for existing rows.
UPDATE public.branch_appetites
  SET preferred_borrower_types = COALESCE(preferred_borrower_types, '{}'),
      preferred_regions = COALESCE(preferred_regions, '{}')
WHERE preferred_borrower_types IS NULL
   OR preferred_regions IS NULL;
