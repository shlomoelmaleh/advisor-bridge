
-- Fix: ALL policies are RESTRICTIVE which means zero access.
-- We need PERMISSIVE policies for basic access.

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users see own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;

-- Create PERMISSIVE policies
CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin full access" ON profiles
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Also fix branch_appetites
DROP POLICY IF EXISTS "Bankers manage own appetites" ON branch_appetites;
DROP POLICY IF EXISTS "Advisors see approved active appetites" ON branch_appetites;
DROP POLICY IF EXISTS "Admin manages all appetites" ON branch_appetites;

CREATE POLICY "Bankers manage own appetites" ON branch_appetites
  FOR ALL TO authenticated
  USING (auth.uid() = banker_id);

CREATE POLICY "Advisors see approved active appetites" ON branch_appetites
  FOR SELECT TO authenticated
  USING (is_active = true AND is_approved = true AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'advisor' AND profiles.is_approved = true
  ));

CREATE POLICY "Admin manages all appetites" ON branch_appetites
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Also fix cases
DROP POLICY IF EXISTS "Advisors manage own cases" ON cases;
DROP POLICY IF EXISTS "Bankers see approved open cases" ON cases;
DROP POLICY IF EXISTS "Admin manages all cases" ON cases;

CREATE POLICY "Advisors manage own cases" ON cases
  FOR ALL TO authenticated
  USING (auth.uid() = advisor_id);

CREATE POLICY "Bankers see approved open cases" ON cases
  FOR SELECT TO authenticated
  USING (status = 'open' AND is_approved = true AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'bank' AND profiles.is_approved = true
  ));

CREATE POLICY "Admin manages all cases" ON cases
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Fix matches (keep deny insert as restrictive)
DROP POLICY IF EXISTS "Match participants see matches" ON matches;
DROP POLICY IF EXISTS "Match participants update matches" ON matches;
DROP POLICY IF EXISTS "Admin manages all matches" ON matches;

CREATE POLICY "Match participants see matches" ON matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
  );

CREATE POLICY "Match participants update matches" ON matches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
  );

CREATE POLICY "Admin manages all matches" ON matches
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Fix messages
DROP POLICY IF EXISTS "Match participants see messages" ON messages;
DROP POLICY IF EXISTS "Users insert own messages" ON messages;
DROP POLICY IF EXISTS "Users update own messages" ON messages;
DROP POLICY IF EXISTS "Users delete own messages" ON messages;

CREATE POLICY "Match participants see messages" ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m
    JOIN cases c ON c.id = m.case_id
    JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.id = messages.match_id AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid())
  ));

CREATE POLICY "Users insert own messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM matches m
    JOIN cases c ON c.id = m.case_id
    JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.id = messages.match_id AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid())
  ));

CREATE POLICY "Users update own messages" ON messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);

CREATE POLICY "Users delete own messages" ON messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
