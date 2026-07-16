-- HARDENING for the anonymous_cases view — APPLIED (in the migration history of
-- both prod `oasivruwsvhfmvynpbia` and the test project; verified 2026-07-16:
-- reloptions = {security_invoker=true} and relacl has no anon grant).
--
-- Why: the view as originally deployed bypassed RLS on `cases` and was readable
-- by `anon`, leaking all open cases to anyone with the public key. security_invoker
-- = true makes the view honor the caller's RLS ("Bankers see approved open cases"),
-- and revoking anon closes the unauthenticated hole. advisor_id is still never
-- selected, so anonymity of the advisor is preserved.
--
-- (An earlier revision of this header said "NOT YET APPLIED / renamed to .sql.pending";
-- that was stale — the file is a plain .sql and has been applied. Statements below
-- are idempotent and safe to re-run.)

ALTER VIEW public.anonymous_cases SET (security_invoker = true);

REVOKE ALL ON public.anonymous_cases FROM anon;
GRANT SELECT ON public.anonymous_cases TO authenticated;
