-- Rate-limit match status changes (express interest / reject).
--
-- Why: every advisor_status/banker_status change fires the AFTER-UPDATE
-- notification webhooks (pg_net -> edge function -> Resend email). Nothing
-- throttled this, so a repeated click or a script could blast the counterpart
-- with emails (spam + Resend cost). run_matching_for_case already has a
-- timestamp cooldown; this brings the same protection to the interest actions.
--
-- Design: a tiny append-only log of real status changes. Two limits are enforced
-- from it, mirroring the agreed policy:
--   * per-match  : min 2s between two status changes on the same match (stops
--                  double-submits / accidental repeats)
--   * per-user   : max 10 status changes per rolling minute (stops scripted spam)
-- The log is pruned per-user on every write so it stays tiny. RLS is enabled with
-- no policies, so only the SECURITY DEFINER trigger below can touch it.

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  action     text NOT NULL,
  match_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_user_time
  ON public.rate_limit_hits (user_id, created_at);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_match_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_same_match int;
  v_recent     int;
BEGIN
  -- Only guard genuine interest-status changes. The internal matching path
  -- (ON CONFLICT DO UPDATE SET score) leaves both status columns untouched and
  -- is therefore never rate limited.
  IF NEW.advisor_status IS NOT DISTINCT FROM OLD.advisor_status
     AND NEW.banker_status IS NOT DISTINCT FROM OLD.banker_status THEN
    RETURN NEW;
  END IF;

  -- Service-role / migration / cron contexts have no JWT and are not limited.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Per-match cooldown: 2 seconds between status changes on the same match.
  SELECT count(*) INTO v_same_match
  FROM rate_limit_hits
  WHERE user_id = v_uid
    AND match_id = NEW.id
    AND created_at > now() - interval '2 seconds';
  IF v_same_match > 0 THEN
    RAISE EXCEPTION 'Please wait a moment before updating this match again';
  END IF;

  -- Per-user window: at most 10 status changes per rolling minute.
  SELECT count(*) INTO v_recent
  FROM rate_limit_hits
  WHERE user_id = v_uid
    AND action = 'match_status'
    AND created_at > now() - interval '1 minute';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many updates in a short time, please try again in a minute';
  END IF;

  -- Record this hit and prune the user's stale rows to keep the table small.
  INSERT INTO rate_limit_hits (user_id, action, match_id)
  VALUES (v_uid, 'match_status', NEW.id);
  DELETE FROM rate_limit_hits
  WHERE user_id = v_uid AND created_at < now() - interval '1 minute';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_match_rate_limit ON public.matches;
CREATE TRIGGER enforce_match_rate_limit
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_rate_limit();
