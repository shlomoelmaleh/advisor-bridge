
-- Fix 1: Add RLS policy for messages (it already has a policy "Match participants send messages" per the schema)
-- But scan says no policies exist, so let's add proper granular ones

-- Drop existing ALL policy if it exists and replace with granular ones
DROP POLICY IF EXISTS "Match participants send messages" ON messages;

-- SELECT: only match participants can read messages
CREATE POLICY "Match participants see messages"
ON messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matches m
    INNER JOIN cases c ON c.id = m.case_id
    INNER JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.id = messages.match_id
    AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid())
  )
);

-- INSERT: users can only insert messages as themselves, and only in their matches
CREATE POLICY "Users insert own messages"
ON messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM matches m
    INNER JOIN cases c ON c.id = m.case_id
    INNER JOIN branch_appetites ba ON ba.id = m.appetite_id
    WHERE m.id = messages.match_id
    AND (c.advisor_id = auth.uid() OR ba.banker_id = auth.uid())
  )
);

-- UPDATE: users can only update their own messages
CREATE POLICY "Users update own messages"
ON messages FOR UPDATE TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- DELETE: users can only delete their own messages
CREATE POLICY "Users delete own messages"
ON messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

-- Fix 2: Harden handle_new_user to always default to 'advisor'
-- Prevents role injection via signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'advisor'  -- Always default to advisor; bank role must be assigned by admin
  );
  RETURN NEW;
END;
$function$;
