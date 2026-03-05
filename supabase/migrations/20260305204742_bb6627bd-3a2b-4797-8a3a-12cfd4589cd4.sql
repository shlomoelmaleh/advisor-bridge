
-- 1. Fix auto_match_on_appetite_approval search_path
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
      PERFORM internal_run_matching_for_case(v_case.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Fix matches SELECT policy to include banker_id for direct interest
DROP POLICY IF EXISTS "Match participants see matches" ON matches;
CREATE POLICY "Match participants see matches" ON matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
    OR matches.banker_id = auth.uid()
  );

-- 3. Fix matches UPDATE policy to include banker_id
DROP POLICY IF EXISTS "Match participants update matches" ON matches;
CREATE POLICY "Match participants update matches" ON matches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
    OR matches.banker_id = auth.uid()
  );

-- 4. Fix messages SELECT policy with LEFT JOIN for appetite
DROP POLICY IF EXISTS "Match participants see messages" ON messages;
CREATE POLICY "Match participants see messages" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m
    JOIN cases c ON c.id = m.case_id
    LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.id = messages.match_id
      AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid() OR m.banker_id = auth.uid())
  ));

-- 5. Fix messages INSERT policy with LEFT JOIN
DROP POLICY IF EXISTS "Users insert own messages" ON messages;
CREATE POLICY "Users insert own messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN cases c ON c.id = m.case_id
      LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE m.id = messages.match_id
        AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid() OR m.banker_id = auth.uid())
    )
  );

-- 6. Fix messages read-at UPDATE policy with LEFT JOIN
DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;
CREATE POLICY "Users can mark messages as read" ON messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN cases c ON c.id = m.case_id
      LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE m.id = messages.match_id
        AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid() OR m.banker_id = auth.uid())
    )
  );

-- 7. Tighten profiles SELECT: replace overly broad policy with scoped one
DROP POLICY IF EXISTS "Authenticated users see basic profile info" ON profiles;
CREATE POLICY "Match participants see counterpart profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM matches m
      JOIN cases c ON c.id = m.case_id
      LEFT JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE (
        (c.advisor_id = auth.uid() AND (ba.banker_id = profiles.user_id OR m.banker_id = profiles.user_id))
        OR (c.advisor_id = profiles.user_id AND (ba.banker_id = auth.uid() OR m.banker_id = auth.uid()))
      )
    )
    OR is_admin(auth.uid())
  );
