
-- Fix mutable search_path on functions that are missing it

CREATE OR REPLACE FUNCTION public.compute_match_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.advisor_status = 'interested' AND NEW.banker_status = 'interested' THEN
    NEW.status := 'closed';
  ELSIF NEW.advisor_status = 'rejected' OR NEW.banker_status = 'rejected' THEN
    NEW.status := 'rejected';
  ELSIF NEW.advisor_status = 'interested' OR NEW.banker_status = 'interested' THEN
    NEW.status := 'interested';
  ELSE
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_match_on_case_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    PERFORM internal_run_matching_for_case(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_match_on_appetite_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case RECORD;
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    FOR v_case IN 
      SELECT id FROM cases 
      WHERE status = 'open' AND is_approved = true
    LOOP
      PERFORM run_matching_for_case(v_case.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION public.internal_run_matching_for_case(p_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appetite branch_appetites%ROWTYPE;
  v_score INT;
  v_case cases%ROWTYPE;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN RETURN; END IF;
  UPDATE cases SET last_matched_at = NOW() WHERE id = p_case_id;
  FOR v_appetite IN
    SELECT * FROM branch_appetites
    WHERE is_active = true
    AND is_approved = true
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  LOOP
    v_score := internal_compute_match_score(p_case_id, v_appetite.id);
    IF v_score >= 40 THEN
      INSERT INTO matches (case_id, appetite_id, score, status, advisor_status, banker_status)
      VALUES (p_case_id, v_appetite.id, v_score, 'pending', 'pending', 'pending')
      ON CONFLICT (case_id, appetite_id) DO UPDATE SET score = v_score;
    END IF;
  END LOOP;
END;
$function$;
