-- 1. Ensure RLS is enabled on all tables (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_appetites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2. Add last_matched_at for rate limiting on matching RPC
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS last_matched_at timestamptz;

-- 3. Add advisor_status and banker_status columns for match race condition fix
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS advisor_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS banker_status text DEFAULT 'pending';

-- 4. Create trigger to compute overall match status from individual statuses
CREATE OR REPLACE FUNCTION public.compute_match_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS set_match_status ON public.matches;
CREATE TRIGGER set_match_status
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_match_status();

-- 5. Update run_matching_for_case with rate limiting and role check
CREATE OR REPLACE FUNCTION public.run_matching_for_case(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appetite branch_appetites%ROWTYPE;
  v_score INT;
  v_case cases%ROWTYPE;
  v_user_role text;
BEGIN
  -- Role check: only advisors can run matching
  SELECT role INTO v_user_role FROM profiles WHERE user_id = auth.uid();
  IF v_user_role IS NULL OR v_user_role != 'advisor' THEN
    RAISE EXCEPTION 'Unauthorized: only advisors can run matching';
  END IF;

  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  
  IF v_case.advisor_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: you can only run matching on your own cases';
  END IF;

  -- Rate limiting: 5-minute cooldown
  IF v_case.last_matched_at IS NOT NULL 
     AND v_case.last_matched_at > NOW() - INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'Please wait before running matching again';
  END IF;

  UPDATE cases SET last_matched_at = NOW() WHERE id = p_case_id;

  FOR v_appetite IN
    SELECT * FROM branch_appetites
    WHERE is_active = true
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  LOOP
    v_score := compute_match_score(p_case_id, v_appetite.id);

    IF v_score >= 40 THEN
      INSERT INTO matches (case_id, appetite_id, score, status, advisor_status, banker_status)
      VALUES (p_case_id, v_appetite.id, v_score, 'pending', 'pending', 'pending')
      ON CONFLICT (case_id, appetite_id) DO UPDATE SET score = v_score;
    END IF;
  END LOOP;
END;
$$;

-- 6. Validation trigger so advisors can only update advisor_status and bankers only banker_status
CREATE OR REPLACE FUNCTION public.validate_match_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_advisor boolean;
  v_is_banker boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cases WHERE id = NEW.case_id AND advisor_id = auth.uid()
  ) INTO v_is_advisor;

  SELECT EXISTS (
    SELECT 1 FROM branch_appetites WHERE id = NEW.appetite_id AND banker_id = auth.uid()
  ) INTO v_is_banker;

  IF v_is_advisor AND NOT v_is_banker THEN
    IF NEW.banker_status IS DISTINCT FROM OLD.banker_status THEN
      RAISE EXCEPTION 'Advisors cannot modify banker status';
    END IF;
  END IF;

  IF v_is_banker AND NOT v_is_advisor THEN
    IF NEW.advisor_status IS DISTINCT FROM OLD.advisor_status THEN
      RAISE EXCEPTION 'Bankers cannot modify advisor status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_match_update ON public.matches;
CREATE TRIGGER validate_match_update
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_match_update();