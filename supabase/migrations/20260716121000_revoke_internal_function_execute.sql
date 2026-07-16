-- Lock down EXECUTE on internal/maintenance functions.
--
-- The project has a blanket `GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon,
-- authenticated, service_role` plus matching default privileges, so every function —
-- including internal matching helpers and test scaffolding — was callable by any
-- client via PostgREST /rpc. No app code calls these four (verified: only the
-- generated src/integrations/supabase/types.ts mentions them):
--   internal_run_matching_for_case  — called by run_matching_for_case / triggers,
--                                     which run as the function owner (postgres)
--   internal_compute_match_score    — same
--   compute_match_score_test        — test scaffolding; tests use the service role
--   close_expired_matches           — maintenance; also self-guards (admin only)
--
-- Client-facing RPCs (run_matching_for_case, express_interest_in_case/appetite)
-- keep their grants — do NOT revoke those.
--
-- Also stops future functions created by postgres (migrations) from being
-- auto-granted to anon/authenticated. From now on, any NEW function that clients
-- should call via supabase.rpc() needs an explicit:
--   GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.internal_run_matching_for_case(uuid) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.internal_compute_match_score(uuid, uuid) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.compute_match_score_test(uuid, uuid) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.close_expired_matches() TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.internal_run_matching_for_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.internal_compute_match_score(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_match_score_test(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_expired_matches() FROM PUBLIC, anon, authenticated;

-- service_role keeps EXECUTE (explicit, used by integration tests / maintenance)
GRANT EXECUTE ON FUNCTION public.internal_run_matching_for_case(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_compute_match_score(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_match_score_test(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_expired_matches() TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
