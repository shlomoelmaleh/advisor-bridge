-- 1. Harden messages UPDATE: the "Users can mark messages as read" policy
--    (20260317001000) lets any non-sender match participant update the whole row,
--    including content. Restrict non-admin updates to read_at only.
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.match_id IS DISTINCT FROM OLD.match_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only read_at can be updated on messages';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_update ON public.messages;
CREATE TRIGGER guard_message_update
  BEFORE UPDATE ON public.messages FOR EACH ROW
  EXECUTE FUNCTION public.guard_message_update();

-- 2. Restore is_admin() in the counterpart-profiles policy.
--    20260318000500 replaced the is_admin() call (used in 20260317001000) with a
--    direct subquery on profiles, which makes the policy reference its own table
--    and risks "infinite recursion detected in policy" on profiles SELECTs.
DROP POLICY IF EXISTS "Match participants see counterpart profiles" ON public.profiles;
CREATE POLICY "Match participants see counterpart profiles" ON public.profiles
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
