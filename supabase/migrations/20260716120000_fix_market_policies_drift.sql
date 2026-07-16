-- Fix prod drift: market visibility policies must not trust client-mutable user_metadata.
--
-- Migration 20260301151751 already defined these two policies correctly (FOR SELECT,
-- role checked against profiles). However, the live database drifted afterwards
-- (edited outside migrations, likely via Lovable/dashboard): as of 2026-07-16 prod had
-- them as FOR ALL policies gated on auth.jwt()->user_metadata->>role — a value any
-- authenticated user can set on themselves via supabase.auth.updateUser(). Combined
-- with FOR ALL (no WITH CHECK), this allowed any authenticated user to read, UPDATE
-- and DELETE other users' open cases / active appetites.
--
-- The role check goes through a SECURITY DEFINER helper (same pattern as is_admin)
-- rather than a direct EXISTS on profiles: the "Match participants see counterpart
-- profiles" policy on profiles references cases/branch_appetites, so a plain
-- profiles subquery here creates infinite policy recursion (42P17) — caught by
-- tests/rls-security.test.ts on the test project before rollout.
--
-- This migration is idempotent (safe to re-run).
--
-- Rollback (restores the previous — insecure — prod state; for emergency only):
--   DROP POLICY IF EXISTS "Advisors see approved active appetites" ON public.branch_appetites;
--   CREATE POLICY "Advisors see approved active appetites" ON public.branch_appetites
--     FOR ALL USING (is_active = true AND is_approved = true
--       AND ((auth.jwt() -> 'user_metadata') ->> 'role') = 'advisor');
--   DROP POLICY IF EXISTS "Bankers see approved open cases" ON public.cases;
--   CREATE POLICY "Bankers see approved open cases" ON public.cases
--     FOR ALL USING (status = 'open' AND is_approved = true
--       AND ((auth.jwt() -> 'user_metadata') ->> 'role') = 'bank');

CREATE OR REPLACE FUNCTION public.has_approved_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = _role AND is_approved = true
  )
$$;

DROP POLICY IF EXISTS "Advisors see approved active appetites" ON public.branch_appetites;
CREATE POLICY "Advisors see approved active appetites" ON public.branch_appetites
  FOR SELECT TO authenticated
  USING (is_active = true AND is_approved = true
         AND public.has_approved_role(auth.uid(), 'advisor'));

DROP POLICY IF EXISTS "Bankers see approved open cases" ON public.cases;
CREATE POLICY "Bankers see approved open cases" ON public.cases
  FOR SELECT TO authenticated
  USING (status = 'open' AND is_approved = true
         AND public.has_approved_role(auth.uid(), 'bank'));
