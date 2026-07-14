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

1. Create a **new, free Supabase project** dedicated to testing
   (<https://supabase.com/dashboard> → New project). Keep it separate from the
   production project.
2. Apply the schema to it by pushing this repo's migrations:
   ```sh
   npx supabase link --project-ref <TEST_PROJECT_REF>
   npx supabase db push
   # then re-link back to production when done:
   # npx supabase link --project-ref oasivruwsvhfmvynpbia
   ```
   (Deploy the edge functions too if you run the email-webhook suite:
   `npx supabase functions deploy`.)
3. Copy `.env.test.example` → `.env.test` and fill in the **test project's**
   URL, publishable/anon key and service-role key (Project Settings → API).
   `.env.test` is gitignored.
4. Run any suite: `npx tsx tests/rls-security.test.ts`.

The suites self-provision their test users via the service role, so no manual
seeding is required.
