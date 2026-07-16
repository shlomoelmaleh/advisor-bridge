-- ==========================================================================
-- Security hotfix: close function-privilege gaps found in review of the two
-- 2026-07-16 migrations. Applied test → prod; both are in prod migration history.
-- ==========================================================================

-- (A) Default privileges. The prior migration (20260716121000) revoked EXECUTE on
-- NEW functions from anon/authenticated only, but PostgreSQL still grants EXECUTE
-- to PUBLIC by default — verified empirically: a freshly created public function
-- came out with `=X` (PUBLIC EXECUTE). Crucially, a SCHEMA-scoped revoke does NOT
-- remove it: the built-in PUBLIC EXECUTE on functions is a GLOBAL default, so it
-- must be revoked FOR ROLE postgres WITHOUT `IN SCHEMA` (verified: after the
-- global revoke a fresh function came out `{postgres=X, service_role=X}` — no
-- PUBLIC). Any new client RPC must now be granted to `authenticated` explicitly
-- (documented in CLAUDE.md).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- (B) has_approved_role was SECURITY DEFINER taking an arbitrary _user_id uuid,
-- so any caller could probe ANOTHER user's role/approval (the definer bypasses
-- profiles RLS). Recreate it to check ONLY the caller's own auth.uid(), and
-- restrict EXECUTE to authenticated. The two market policies depend on it, so
-- drop them, swap the function, then recreate the policies against the new
-- single-arg signature.
--
-- (auth.uid() resolves the caller's JWT claim regardless of SECURITY DEFINER, so
-- reading profiles as owner still avoids the profiles↔cases policy recursion.)
DROP POLICY IF EXISTS "Advisors see approved active appetites" ON public.branch_appetites;
DROP POLICY IF EXISTS "Bankers see approved open cases" ON public.cases;
DROP FUNCTION IF EXISTS public.has_approved_role(uuid, text);

CREATE OR REPLACE FUNCTION public.has_approved_role(_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = _role AND is_approved = true
  )
$$;
REVOKE ALL ON FUNCTION public.has_approved_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_approved_role(text) TO authenticated;

CREATE POLICY "Advisors see approved active appetites" ON public.branch_appetites
  FOR SELECT TO authenticated
  USING (is_active = true AND is_approved = true AND public.has_approved_role('advisor'));

CREATE POLICY "Bankers see approved open cases" ON public.cases
  FOR SELECT TO authenticated
  USING (status = 'open' AND is_approved = true AND public.has_approved_role('bank'));

-- (C) Trigger-only SECURITY DEFINER functions run inside triggers as the table
-- owner and are never meant to be reachable via PostgREST /rpc. Remove all direct
-- EXECUTE (triggers keep working — they don't check the invoker's EXECUTE).
REVOKE EXECUTE ON FUNCTION public.auto_match_on_case_approval()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_match_rate_limit()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_message_update()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_fields()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_match_update()           FROM PUBLIC, anon, authenticated;

-- (D) compute_match_score is an internal scoring helper, only called by
-- run_matching_for_case (SECURITY DEFINER, runs as owner). Clients never call it
-- directly. Lock it to service_role like the internal_* variants already are.
REVOKE EXECUTE ON FUNCTION public.compute_match_score(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- (E) Client RPCs (verified as the only rpc() calls in src/): keep authenticated,
-- drop PUBLIC + anon — logged-out callers have no business running these.
REVOKE EXECUTE ON FUNCTION public.run_matching_for_case(uuid)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.express_interest_in_case(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.express_interest_in_appetite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_matching_for_case(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_interest_in_case(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_interest_in_appetite(uuid) TO authenticated;

-- (F) RLS helper functions are evaluated inside policies by the querying role
-- (anon and/or authenticated), so they must retain those grants — but the blanket
-- PUBLIC grant is unnecessary. Drop PUBLIC only.
--
-- KNOWN residual (pre-existing, intentionally NOT changed here): is_admin(uuid)
-- still accepts an arbitrary uuid, so an authenticated user can probe whether a
-- given user is an admin. Its signature is used by ~10 policies and two edge
-- functions (delete-user, notify-banker-appetite-rejected), so changing it is a
-- separate, larger change tracked for follow-up.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_banker_in_case(uuid, uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid) FROM PUBLIC;

-- Rollback: re-GRANT EXECUTE ... TO PUBLIC on each function above, restore
-- has_approved_role(uuid, text) from 20260716120000, and
-- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC;`
