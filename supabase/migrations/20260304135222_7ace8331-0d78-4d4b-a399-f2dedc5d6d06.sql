
-- 1. Create secure RPC for bankers to express interest in a case
CREATE OR REPLACE FUNCTION public.express_interest_in_case(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_approved_banker boolean;
  v_case_exists boolean;
  v_already_matched boolean;
BEGIN
  -- Verify caller is an approved banker
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id AND role = 'bank' AND is_approved = true
  ) INTO v_is_approved_banker;

  IF NOT v_is_approved_banker THEN
    RAISE EXCEPTION 'Unauthorized: only approved bankers can express interest';
  END IF;

  -- Verify case exists and is open+approved
  SELECT EXISTS (
    SELECT 1 FROM cases
    WHERE id = p_case_id AND status = 'open' AND is_approved = true
  ) INTO v_case_exists;

  IF NOT v_case_exists THEN
    RAISE EXCEPTION 'Case not found or not available';
  END IF;

  -- Check if already matched
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE case_id = p_case_id AND banker_id = v_user_id
  ) INTO v_already_matched;

  IF v_already_matched THEN
    RAISE EXCEPTION 'Already expressed interest in this case';
  END IF;

  -- Insert the match
  INSERT INTO matches (case_id, appetite_id, score, status, advisor_status, banker_status, banker_id)
  VALUES (p_case_id, NULL, 0, 'interested', 'pending', 'interested', v_user_id);
END;
$$;

-- 2. Drop the permissive INSERT policy
DROP POLICY IF EXISTS "Approved bankers can create matches" ON public.matches;

-- 3. Restore RESTRICTIVE deny policy to block all direct inserts
CREATE POLICY "Deny direct match inserts"
  ON public.matches AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
