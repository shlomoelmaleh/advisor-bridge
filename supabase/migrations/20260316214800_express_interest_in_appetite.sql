-- Create RPC for advisors to express interest in a bank appetite signal
-- Returns the new match ID so the UI can navigate to /chat/:matchId

-- First, make case_id nullable (it can be null for appetite-initiated matches)
ALTER TABLE public.matches ALTER COLUMN case_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.express_interest_in_appetite(p_appetite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_approved_advisor boolean;
  v_appetite_exists boolean;
  v_already_matched boolean;
  v_banker_id uuid;
  v_new_match_id uuid;
BEGIN
  -- Verify caller is an approved advisor
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_user_id AND role = 'advisor' AND is_approved = true
  ) INTO v_is_approved_advisor;

  IF NOT v_is_approved_advisor THEN
    RAISE EXCEPTION 'Unauthorized: only approved advisors can contact bankers';
  END IF;

  -- Verify appetite exists and is active + approved
  SELECT EXISTS (
    SELECT 1 FROM branch_appetites
    WHERE id = p_appetite_id AND is_active = true AND is_approved = true
  ) INTO v_appetite_exists;

  IF NOT v_appetite_exists THEN
    RAISE EXCEPTION 'Appetite signal not found or not available';
  END IF;

  -- Get the banker_id from the appetite
  SELECT banker_id INTO v_banker_id
  FROM branch_appetites
  WHERE id = p_appetite_id;

  -- Check if advisor already contacted this appetite
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE appetite_id = p_appetite_id
      AND case_id IS NULL
      AND banker_id = v_banker_id
      AND advisor_status = 'interested'
  ) INTO v_already_matched;

  IF v_already_matched THEN
    -- Return the existing match id instead of erroring
    SELECT id INTO v_new_match_id
    FROM matches
    WHERE appetite_id = p_appetite_id
      AND case_id IS NULL
      AND banker_id = v_banker_id
      AND advisor_status = 'interested'
    LIMIT 1;
    RETURN v_new_match_id;
  END IF;

  -- Insert the match
  INSERT INTO matches (case_id, appetite_id, banker_id, score, status, advisor_status, banker_status)
  VALUES (NULL, p_appetite_id, v_banker_id, 0, 'pending', 'interested', 'pending')
  RETURNING id INTO v_new_match_id;

  RETURN v_new_match_id;
END;
$$;
