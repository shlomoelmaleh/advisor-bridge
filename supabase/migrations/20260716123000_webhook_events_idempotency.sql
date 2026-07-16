-- Idempotency ledger for DB-webhook edge functions.
--
-- pg_net delivers webhooks with at-least-once semantics: on a slow/failed
-- response it retries with an IDENTICAL body, which the per-function transition
-- guards do NOT deduplicate (a retry of a real state change re-sends the email).
-- Each notify-* function now hashes (slug + raw body) and records it here before
-- sending; a duplicate key means "already delivered — skip".
--
-- Only the service role (used by the edge functions) touches this table.
-- RLS is enabled with no policies, so anon/authenticated have no access even
-- though the service role bypasses RLS.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT ALL ON public.webhook_events TO service_role;

-- Rollback: DROP TABLE public.webhook_events;
