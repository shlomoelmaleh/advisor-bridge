
-- Unify 'bank' and 'banker' roles in RLS policies

-- 1. Update cases SELECT policy
DROP POLICY IF EXISTS "Bankers see approved open cases" ON public.cases;
CREATE POLICY "Bankers see approved open cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    status = 'open' AND is_approved = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('bank', 'banker')
        AND profiles.is_approved = true
    )
  );

-- 2. Update branch_appetites SELECT policy for advisors (this one was already OK but let's be safe if it ever checks banker role)
-- Actually, it checks the advisor role. It's fine.

-- 3. Update profiles SELECT policy (counterpart profiles)
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
    OR (
       EXISTS (
         SELECT 1 FROM profiles p 
         WHERE p.user_id = auth.uid() AND p.role = 'admin'
       )
    )
  );

-- 4. Check some other policies that might use 'bank'
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
  -- This one already uses ba.banker_id = auth.uid(), which is role-independent. Good.
