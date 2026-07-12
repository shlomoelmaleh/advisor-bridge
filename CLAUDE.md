# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**BranchMatch** (repo: advisor-bridge) — a Hebrew/RTL web app that matches mortgage **advisors**' cases with **banks**' lending "appetites". Built on [Lovable](https://lovable.dev) (project `01331859-8ad9-4e28-b8ca-f9ebae35e498`). Stack: Vite + React 18 + TypeScript + shadcn/ui (Radix) + Tailwind + Supabase (Postgres, Auth, Edge Functions).

## Commands

```sh
npm run dev        # Vite dev server on http://localhost:8080
npm run build      # production build
npm run build:dev  # build in development mode
npm run lint       # eslint over the repo

# Integration tests — standalone tsx scripts that hit a LIVE Supabase project.
# Require a .env with VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
# and SUPABASE_SERVICE_ROLE_KEY. They mutate real data (create/delete users etc.).
npx tsx tests/auth-admin.test.ts          # run a single suite
npx tsx tests/matching-engine.test.ts
# Tests are "hybrid": automated assertions + interactive visual prompts (Y/N/S).
# Set CI=1 to auto-pass visual checks. There is no `npm test` script and no test runner (no vitest/jest).
```

There is no local Supabase stack configured for routine work — the app and tests talk to the hosted project (`oasivruwsvhfmvynpbia`). The `supabase/` dir holds migrations + edge functions deployed to that project.

## Security model — read this before touching auth or data access

**All authorization is enforced server-side by Postgres RLS policies and `SECURITY DEFINER` functions.** Client-side role checks exist purely for UX (showing/hiding, avoiding wasted requests) and are explicitly commented as such. Do not rely on them for security, and do not "tighten" them assuming they gate access — the database does.

Concretely:
- `useAdmin`'s `checkAdmin()` is a UX guard; the real gate is the `is_admin()` SECURITY DEFINER function used in RLS.
- The role filtering in `useMatches` is a UX filter; the RLS "Match participants see matches" policy is authoritative.
- Match rows can only be created via the `run_matching_for_case` RPC — a "Deny direct match inserts" policy blocks direct inserts. Match status updates go through `advisor_status`/`banker_status` columns, validated by the `validate_match_update` trigger.

## Auth & role resolution ([src/hooks/useAuth.tsx](src/hooks/useAuth.tsx))

This is the most intricate part of the frontend. A small state machine resolves the user's role with two tiers of trust:

- **`roleSource`** tracks where the role came from: `jwt-optimistic` / `cache` (fast, for instant navigation) vs `db` (authoritative).
- **Optimistic roles unblock advisor/bank navigation immediately**, then the DB fetch upgrades `roleSource` to `db`.
- **`admin` is special: it must come from `db`** — never from JWT or cache. `isFinalForNavigation` and `isFinalForSecurity` encode this.
- `ProtectedRoute` consumes this: `requireFinalRole` (set on `/admin/*`) waits for the DB-authoritative role before granting access; advisor/bank routes render on the optimistic role.
- Profile is cached in `localStorage` (`advisor_bridge_profile` / `advisor_bridge_role`) and cleared on sign-out. Profile fetches are deduped per-userId via refs.

**Role naming gotcha:** the app's `UserRole` is `'advisor' | 'bank' | 'admin'`, but legacy data and some RLS policies still use `'banker'`. Hooks check both (`role === 'bank' || role === 'banker'`). When adding role logic, handle both spellings on the read side. (Note: `src/types/index.ts` has an unrelated, stale `UserRole` — the source of truth is the one exported from `useAuth.tsx`.)

## Domain model & core flow

Roles: **advisor**, **bank** (banker), **admin**. The central entities (DB-aligned types live in [src/types/](src/types/), snake_case to match Supabase tables):

- **`cases`** ([cases.ts](src/types/cases.ts)) — an advisor's mortgage case (loan range, LTV, borrower type, region, priorities, status).
- **`branch_appetites`** ([appetites.ts](src/types/appetites.ts)) — a bank's lending criteria (min loan, max LTV, preferred borrower types/regions, SLA, validity).
- **`matches`** ([matches.ts](src/types/matches.ts)) — a scored case↔appetite pairing with independent `advisor_status` and `banker_status`.
- **`messages`** — chat between matched parties.

**Approval + matching workflow:**
1. New users, cases, and appetites are created with `is_approved = false` and must be approved by an admin.
2. Approving a case or appetite fires a Postgres trigger (`auto_match_on_case_approval` / `auto_match_on_appetite_approval`) that runs the matching engine.
3. The matching engine (`compute_match_score` + `run_matching_for_case`) scores each active, in-date appetite against the case: loan amount (25), LTV fit (25), borrower type (20), region (15), fast SLA (15), then a multiplier for appetite level (high ×1.3 cap 100, low ×0.7). Pairs scoring **≥ 40** become `matches`.
4. Both sides express interest / reject via their status column. Note: the messages RLS policy allows chat as soon as a match exists (one-sided interest is enough) — "mutual interest opens chat" is a UX convention in the client, not a DB-enforced rule.

When changing matching behavior or the approval lifecycle, the logic lives in **SQL migrations**, not TypeScript. The newest migrations supersede older ones (filenames are timestamp-ordered); grep the whole `supabase/migrations/` tree for a function name to find its latest definition before editing.

## Frontend conventions

- **Routing** ([src/App.tsx](src/App.tsx)) is role-segmented: `/advisor/*`, `/bank/*`, `/admin/*` (each wrapped in `ProtectedRoute` with `allowedRoles` + `requireFinalRole`), plus shared `any-authenticated` routes (`/matches`, `/chat/:matchId`, `/conversations`). `getHomePathByRole` decides post-login landing.
- **Data layer** is custom hooks per entity (`useCases`, `useAppetites`, `useMatches`, `useAdmin`) calling `supabase` directly — not React Query for data fetching (the `QueryClientProvider` is present but hooks use `useState`/`useEffect` + manual refetch). Each hook returns action methods that call `fetchAll`/`refresh` after mutating.
- **Error handling:** wrap Supabase errors with `mapDatabaseError` ([src/lib/mapDatabaseError.ts](src/lib/mapDatabaseError.ts)), which returns safe Hebrew user-facing strings by Postgres error code. Don't surface raw DB errors to the UI.
- **i18n / RTL:** the app is Hebrew-only. `document.documentElement.dir='rtl'` and `lang='he'` are set globally in App.tsx. New UI strings should be Hebrew; keep `dir="rtl"` on standalone full-screen containers.
- **Imports** use the `@/` alias for `src/`. UI primitives in `src/components/ui/` are generated shadcn components — prefer composing them over hand-rolling.
- **TypeScript is intentionally loose** here (`strictNullChecks: false`, `noImplicitAny: false`, unused-vars lint disabled). Supabase query results are often cast through `as unknown as T`. Match the surrounding style; don't add strictness that fights the existing casts.

## Generated files — do not hand-edit

- [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) and `src/integrations/supabase/types.ts` are auto-generated (the client carries the publishable key inline). Regenerate types from the Supabase schema rather than editing.
- Code is **synced bidirectionally with Lovable** — changes pushed to this repo appear in Lovable and vice-versa. The `lovable-tagger` Vite plugin runs in dev mode only.

## Edge functions ([supabase/functions/](supabase/functions/))

Deno functions that send Hebrew transactional emails via Resend (`RESEND_API_KEY`) on key events (banker interest, case rejected, appetite approved/rejected). They use the service-role key and are invoked either by DB webhooks (`payload.record`) or directly from the client with the user's bearer token. `verify_jwt` settings are in [supabase/config.toml](supabase/config.toml). Some functions referenced by the client (e.g. `delete-user`, `notify-banker-appetite-rejected`) may not have source in this repo and live only in the deployed project.
