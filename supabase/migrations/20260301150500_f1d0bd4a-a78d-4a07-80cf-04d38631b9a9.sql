
-- ============================================================
-- FIX: All RLS policies are RESTRICTIVE (Permissive: No).
-- PostgreSQL requires at least one PERMISSIVE policy per
-- command for rows to be accessible. We drop all existing
-- restrictive policies and recreate them as PERMISSIVE.
-- ============================================================

-- ======================== PROFILES ========================
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users see own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin full access"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    ((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'admin'
    OR auth.uid() = user_id
  );

-- =================== BRANCH_APPETITES ====================
DROP POLICY IF EXISTS "Admin manages all appetites" ON public.branch_appetites;
DROP POLICY IF EXISTS "Advisors see approved active appetites" ON public.branch_appetites;
DROP POLICY IF EXISTS "Bankers manage own appetites" ON public.branch_appetites;

CREATE POLICY "Bankers manage own appetites"
  ON public.branch_appetites FOR ALL
  TO authenticated
  USING (auth.uid() = banker_id);

CREATE POLICY "Advisors see approved active appetites"
  ON public.branch_appetites FOR SELECT
  TO authenticated
  USING (
    is_active = true AND is_approved = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'advisor'
        AND profiles.is_approved = true
    )
  );

CREATE POLICY "Admin manages all appetites"
  ON public.branch_appetites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ========================= CASES =========================
DROP POLICY IF EXISTS "Admin manages all cases" ON public.cases;
DROP POLICY IF EXISTS "Advisors manage own cases" ON public.cases;
DROP POLICY IF EXISTS "Bankers see approved open cases" ON public.cases;

CREATE POLICY "Advisors manage own cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (auth.uid() = advisor_id);

CREATE POLICY "Bankers see approved open cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    status = 'open' AND is_approved = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'bank'
        AND profiles.is_approved = true
    )
  );

CREATE POLICY "Admin manages all cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ======================== MATCHES ========================
DROP POLICY IF EXISTS "Admin manages all matches" ON public.matches;
DROP POLICY IF EXISTS "Deny direct match inserts" ON public.matches;
DROP POLICY IF EXISTS "Match participants see matches" ON public.matches;
DROP POLICY IF EXISTS "Match participants update matches" ON public.matches;

CREATE POLICY "Match participants see matches"
  ON public.matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
  );

CREATE POLICY "Match participants update matches"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = matches.case_id AND cases.advisor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM branch_appetites WHERE branch_appetites.id = matches.appetite_id AND branch_appetites.banker_id = auth.uid())
  );

-- Keep deny direct inserts as RESTRICTIVE (intentional deny)
CREATE POLICY "Deny direct match inserts"
  ON public.matches AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Admin manages all matches"
  ON public.matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ======================== MESSAGES ========================
DROP POLICY IF EXISTS "Match participants see messages" ON public.messages;
DROP POLICY IF EXISTS "Users delete own messages" ON public.messages;
DROP POLICY IF EXISTS "Users insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users update own messages" ON public.messages;

CREATE POLICY "Match participants see messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN cases c ON c.id = m.case_id
      JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE m.id = messages.match_id
        AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid())
    )
  );

CREATE POLICY "Users insert own messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN cases c ON c.id = m.case_id
      JOIN branch_appetites ba ON ba.id = m.appetite_id
      WHERE m.id = messages.match_id
        AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid())
    )
  );

CREATE POLICY "Users update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users delete own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
