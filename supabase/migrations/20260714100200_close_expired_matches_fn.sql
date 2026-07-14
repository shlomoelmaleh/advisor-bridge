-- Utility to purge "ghost" matches whose appetite is no longer live.
--
-- Background: run_matching_for_case only scores active, in-date appetites, so
-- expired/deactivated appetites never produce NEW matches — but matches created
-- while the appetite was live linger forever. There is no in-database scheduler
-- available on this project (pg_cron is not installed, only pg_net), so this is
-- exposed as an explicit callable function for an admin action or a future
-- edge-function/cron to invoke, rather than wired to a schedule that does not exist.
--
-- Why DELETE and not a status change: matches.status is DERIVED by the
-- compute_match_status BEFORE-UPDATE trigger from advisor_status/banker_status,
-- and 'closed' specifically means "both sides interested" (a success), so we
-- cannot repurpose it for expiry. Any status write would also fire the
-- notification webhooks. DELETE fires none of the match triggers.
--
-- Safety: only untouched matches are purged — both sides still 'pending' and no
-- messages exchanged. Anything a user actually engaged with is preserved. If the
-- appetite becomes valid again, run_matching regenerates the pairing.

CREATE OR REPLACE FUNCTION public.close_expired_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Authenticated callers must be admin; no-JWT contexts (service role, cron,
  -- migrations) are allowed to run maintenance.
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'close_expired_matches: admin only';
  END IF;

  WITH doomed AS (
    SELECT m.id
    FROM matches m
    JOIN branch_appetites a ON a.id = m.appetite_id
    WHERE (a.valid_until < current_date OR a.is_active = false)
      AND m.advisor_status = 'pending'
      AND m.banker_status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.match_id = m.id)
  )
  DELETE FROM matches WHERE id IN (SELECT id FROM doomed);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.close_expired_matches() IS
  'Deletes untouched matches (both sides pending, no messages) whose appetite is expired or inactive. Admin-only when called with a JWT. Returns number of rows removed.';
