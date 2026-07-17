/**
 * E2E actor CLI — plays "the other side" during browser-driven system tests,
 * and performs the synthetic-admin fixture steps (approve) that the real admin
 * UI cannot perform yet (known is_admin RLS gap).
 *
 *   npx tsx tests/e2e/actor.ts <command> --flag value ...
 *
 * This file is environment WIRING only. Parsing/guards live in actorCore.ts;
 * command behavior and all safety invariants live in actorHandlers.ts (unit
 * tested against mocked clients in tests/unit/actor-handlers.test.ts).
 *
 * Privilege model:
 *   - list / create-case / create-appetite / send-message / set-status /
 *     check-realtime → authenticated USER client (anon key + password), RLS
 *     applies; mutations are additionally gated to the active run manifest.
 *   - approve / set-approval / restore / cleanup → service_role, fixture/setup
 *     ONLY, with provenance re-verification against live rows before every
 *     deletion and restore (the local manifest is never trusted on its own).
 *
 * Environment: tests/helpers/testEnv.ts loads .env.test and refuses prod; on
 * top of that main() refuses ANY ref except the dedicated test project.
 * Errors are emitted as JSON on stderr with secrets/emails/UUIDs redacted.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  SERVICE_KEY,
  SUPABASE_URL,
  TEST_ADVISOR_EMAIL,
  TEST_BANKER_EMAIL,
  TEST_PASSWORD,
  TEST_PENDING_EMAIL,
} from '../helpers/testEnv';
import { ActorError, ActorRole, assertTestProjectUrl, parseArgs, redactForError } from './actorCore';
import { ActorDeps, runCommand } from './actorHandlers';
import { DEFAULT_REPORTS_DIR, loadManifest, saveManifest } from './manifest';

const USAGE = `E2E actor CLI — commands (privilege in brackets):
  list            --as advisor|bank                                     [user/RLS]
  create-case     --as advisor --run <id> --min N --max N --ltv N
                  --borrower T --property T --region R                  [user/RLS]
  create-appetite --as bank --run <id> --bank-name S --branch-name S
                  --level L --min-loan N --max-ltv N --borrowers CSV
                  --regions CSV --sla N --valid-until YYYY-MM-DD        [user/RLS]
  send-message    --as advisor|bank --run <id> --match <uuid> --text S  [user/RLS, manifest-gated]
  set-status      --as advisor|bank --run <id> --match <uuid>
                  --status interested|rejected                          [user/RLS, manifest-gated]
  approve         --run <id> --target case|appetite --id <uuid>
                  --expect-new-matches N                                [service_role, manifest-gated]
  set-approval    --run <id> --approved true|false                      [service_role, TEST_PENDING_EMAIL only]
  restore         --run <id>                                            [service_role, revalidated pending user]
  check-realtime  --as advisor|bank [--timeout ms(1000..30000)]         [user/RLS, subscription-only]
  cleanup         --run <id> --confirm <same id>                        [service_role, provenance-verified]`;

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

const deps: ActorDeps = {
  async userClient(role: ActorRole) {
    const email = role === 'advisor' ? TEST_ADVISOR_EMAIL : TEST_BANKER_EMAIL;
    const client = createClient(SUPABASE_URL, ANON_KEY, clientOpts);
    const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (error || !data.user) throw new ActorError(`sign-in as ${role} failed: ${error?.message ?? 'no user'}`);
    return { client, userId: data.user.id };
  },
  serviceClient: () => createClient(SUPABASE_URL, SERVICE_KEY, clientOpts),
  loadManifest: (runId) => loadManifest(DEFAULT_REPORTS_DIR, runId),
  saveManifest: (manifest) => saveManifest(DEFAULT_REPORTS_DIR, manifest),
  genId: () => randomUUID(),
  env: {
    advisorEmail: TEST_ADVISOR_EMAIL,
    bankerEmail: TEST_BANKER_EMAIL,
    pendingEmail: TEST_PENDING_EMAIL,
  },
};

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === 'help') {
    console.log(USAGE);
    return;
  }
  // Exact allowlist gate — before parsing and before ANY client is constructed.
  assertTestProjectUrl(SUPABASE_URL);
  const args = parseArgs(argv);
  const result = await runCommand(deps, args);
  console.log(JSON.stringify({ ok: true, command: args.command, at: new Date().toISOString(), result }, null, 2));
}

main().catch((err: unknown) => {
  const secrets = [TEST_PASSWORD, SERVICE_KEY, ANON_KEY];
  const message = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ ok: false, error: redactForError(message, secrets) }));
  process.exit(1);
});
