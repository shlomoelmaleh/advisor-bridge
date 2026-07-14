# Tests

Two very different kinds of tests live here.

## Unit tests — `tests/unit/` (Vitest)

Pure-logic tests with no database. Fast, deterministic, run in CI.

```sh
npm test          # run once
npm run test:watch
```

Vitest is scoped (see `vitest.config.ts`) to `tests/unit/**` only, so it never
picks up the integration scripts below.

## Integration tests — `tests/*.test.ts` (standalone tsx)

These hit a **live Supabase project** and mutate real data (create/delete users,
insert cases/appetites, run the matching engine). They are hybrid: automated
assertions plus interactive visual prompts (`Y`/`N`/`S`). Set `CI=1` to auto-pass
the visual checks.

```sh
npx tsx tests/auth-admin.test.ts
npx tsx tests/rls-security.test.ts
# ...etc
```

### They must run against a DEDICATED test project — never production

`tests/helpers/testEnv.ts` loads config from **`.env.test`** (not `.env`) and
**refuses to run** if the URL points at the production project ref. There is no
way to accidentally mutate production through these scripts.

### One-time setup

> Note: the base tables were created in Studio/Lovable and are NOT in
> `supabase/migrations`, so `supabase db push` alone will NOT build a fresh
> project. Use the full baseline instead.

1. Create a **new, free Supabase project** dedicated to testing
   (<https://supabase.com/dashboard> → New project). Keep it separate from the
   production project. No special settings — pick a region close to you and save
   the database password.
2. Apply the schema: open the new project's **SQL Editor** and run the entire
   contents of [`supabase/schema/baseline.sql`](../supabase/schema/baseline.sql)
   once. It creates every table, function, trigger, RLS policy and index that
   production has (webhook/email triggers are intentionally omitted).
   - `baseline.sql` is regenerated from production with
     `node scripts/generate-baseline.cjs` (needs the CLI linked to prod).
3. Copy `.env.test.example` → `.env.test` and fill in the **test project's**
   URL, publishable/anon key and service-role key (Project Settings → API).
   `.env.test` is gitignored.
4. Seed the canonical test users (advisor + banker, approved):
   ```sh
   npm run seed:test
   ```
5. Run any suite: `npx tsx tests/rls-security.test.ts`.

The email-webhook suite (and TC-H08 in rls-security) additionally needs the edge
functions deployed to the test project:
```sh
npx supabase functions deploy --project-ref <TEST_PROJECT_REF>
```
(`--project-ref` deploys without re-linking away from production.)

Validated end-to-end against a fresh test project with functions deployed:
`matching-engine` 15/15, `rls-security` 10/10, `advisor-banker-flows` 23/23,
`email-webhooks` 31/31, `auth-admin` 15/15 (+1 interactive check skipped under CI=1).
`npm run seed:test` provisions advisor, bank, admin and a pending user.
