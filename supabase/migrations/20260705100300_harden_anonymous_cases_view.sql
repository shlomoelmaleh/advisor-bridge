-- RECOMMENDED HARDENING for the anonymous_cases view — NOT YET APPLIED.
--
-- Renamed to *.sql.pending so `supabase db push` skips it. Rename to *.sql and
-- push only after confirming the banker market flow still works (an approved
-- banker should still see open cases; unapproved users and anon should not).
--
-- Why: the view as deployed bypasses RLS on `cases` and is readable by `anon`,
-- leaking all open cases to anyone with the public key. security_invoker = true
-- makes the view honor the caller's RLS ("Bankers see approved open cases"),
-- and revoking anon closes the unauthenticated hole. advisor_id is still never
-- selected, so anonymity of the advisor is preserved.

ALTER VIEW public.anonymous_cases SET (security_invoker = true);

REVOKE ALL ON public.anonymous_cases FROM anon;
GRANT SELECT ON public.anonymous_cases TO authenticated;
