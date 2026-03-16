-- 1. Add advisor_id to matches so we know which advisor initiated an appetite match WITHOUT a case
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES public.profiles(user_id);

-- 2. Update the RPC to insert the advisor_id for appetite-initiated matches
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
      AND advisor_id = v_user_id
  ) INTO v_already_matched;

  IF v_already_matched THEN
    -- Return the existing match id instead of erroring
    SELECT id INTO v_new_match_id
    FROM matches
    WHERE appetite_id = p_appetite_id
      AND case_id IS NULL
      AND banker_id = v_banker_id
      AND advisor_status = 'interested'
      AND advisor_id = v_user_id
    LIMIT 1;
    RETURN v_new_match_id;
  END IF;

  -- Insert the match with advisor_id
  INSERT INTO matches (case_id, appetite_id, banker_id, advisor_id, score, status, advisor_status, banker_status)
  VALUES (NULL, p_appetite_id, v_banker_id, v_user_id, 0, 'pending', 'interested', 'pending')
  RETURNING id INTO v_new_match_id;

  RETURN v_new_match_id;
END;
$$;

-- 3. Fix matches SELECT policy to include advisor_id
DROP POLICY IF EXISTS "Match participants see matches" ON matches;
CREATE POLICY "Match participants see matches" ON matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
    OR matches.banker_id = auth.uid()
    OR matches.advisor_id = auth.uid()
  );

-- 4. Fix matches UPDATE policy to include advisor_id
DROP POLICY IF EXISTS "Match participants update matches" ON matches;
CREATE POLICY "Match participants update matches" ON matches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
    OR matches.banker_id = auth.uid()
    OR matches.advisor_id = auth.uid()
  );

-- 5. Fix messages SELECT policy (Use LEFT JOIN instead of INNER JOIN for cases)
DROP POLICY IF EXISTS "Match participants see messages" ON messages;
CREATE POLICY "Match participants see messages" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m
    LEFT JOIN cases c ON c.id = m.case_id
    LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.id = messages.match_id
      AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid() OR m.banker_id = auth.uid() OR m.advisor_id = auth.uid())
  ));

-- 6. Fix messages INSERT policy
DROP POLICY IF EXISTS "Users insert own messages" ON messages;
CREATE POLICY "Users insert own messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      LEFT JOIN cases c ON c.id = m.case_id
      LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE m.id = messages.match_id
        AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid() OR m.banker_id = auth.uid() OR m.advisor_id = auth.uid())
    )
  );

-- 7. Fix messages UPDATE policy
DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;
CREATE POLICY "Users can mark messages as read" ON messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      LEFT JOIN cases c ON c.id = m.case_id
      LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE m.id = messages.match_id
        AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid() OR m.banker_id = auth.uid() OR m.advisor_id = auth.uid())
    )
  );

-- 8. Fix profiles SELECT policy so bankers can see the advisor that initiated the appetite match
DROP POLICY IF EXISTS "Match participants see counterpart profiles" ON profiles;
CREATE POLICY "Match participants see counterpart profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM matches m
      LEFT JOIN cases c ON c.id = m.case_id
      LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE (
        (COALESCE(c.advisor_id, m.advisor_id) = auth.uid() AND (ba.banker_id = profiles.user_id OR m.banker_id = profiles.user_id))
        OR (COALESCE(c.advisor_id, m.advisor_id) = profiles.user_id AND (ba.banker_id = auth.uid() OR m.banker_id = auth.uid()))
      )
    )
    OR is_admin(auth.uid())
  );
