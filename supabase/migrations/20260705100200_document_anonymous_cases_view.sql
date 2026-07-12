-- Source-of-truth capture of the anonymous_cases view, which existed only in the
-- deployed project (used by src/hooks/useAppetites.tsx) and had no migration.
-- This recreates it EXACTLY as deployed so the repo can rebuild the environment.
--
-- ⚠️ SECURITY NOTE: as deployed, this view is owned by `postgres` and is NOT
-- security_invoker, so it runs with the owner's privileges and BYPASSES RLS on
-- `cases`. Combined with the SELECT grant to `anon`, this exposes every open,
-- approved case (loan amounts, LTV, region, borrower type) to anyone holding the
-- public publishable key — including unauthenticated visitors. See the companion
-- (not-yet-applied) migration 20260705100300 for the recommended hardening.
CREATE OR REPLACE VIEW public.anonymous_cases AS
  SELECT id,
    loan_amount_min,
    loan_amount_max,
    ltv,
    region,
    borrower_type,
    status,
    is_approved,
    created_at
   FROM cases
  WHERE status = 'open' AND is_approved = true;
