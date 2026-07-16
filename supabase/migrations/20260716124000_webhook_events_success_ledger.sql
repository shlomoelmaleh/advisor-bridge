-- Turn webhook_events from a "claim before send" table into a SUCCESS ledger.
--
-- The first idempotency design (20260716123000) recorded the event BEFORE sending
-- the email, so a Resend/network failure after the insert would make the pg_net
-- retry see a "duplicate" and silently drop the email. The edge functions now
-- record a row ONLY after Resend accepts the send, and carry a Resend
-- Idempotency-Key so a retried send can never duplicate. This migration adapts
-- the table to that semantics.
--
-- Old rows were "claims" (may have failed to send), so they must not be treated
-- as proof of delivery — clear them. Safe: any event that returned 2xx will not
-- be retried by pg_net, and Resend's 24h Idempotency-Key guards the rest.
TRUNCATE public.webhook_events;

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS sent_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resend_id text;

-- Rollback: ALTER TABLE public.webhook_events DROP COLUMN resend_id, DROP COLUMN sent_at;
