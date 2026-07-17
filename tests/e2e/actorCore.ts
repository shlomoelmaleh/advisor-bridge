/**
 * Pure core logic for the E2E actor CLI (tests/e2e/actor.ts): command surface,
 * argument parsing/validation, safety guards, and error redaction.
 *
 * This module must stay free of env loading, filesystem access, and network
 * side effects so the unit suite (tests/unit/actor-*.test.ts) can import it
 * directly without an .env.test present.
 */

export const TEST_PROJECT_REF = 'mijlphxzvyyvknulqozw';
export const TEST_PROJECT_URL = `https://${TEST_PROJECT_REF}.supabase.co`;

/** Closed command surface — anything else is rejected before any client exists. */
export const COMMANDS = [
  'list',
  'verify-test-users',
  'create-case',
  'create-appetite',
  'send-message',
  'set-status',
  'approve',
  'set-approval',
  'restore',
  'check-realtime',
  'cleanup',
] as const;
export type ActorCommand = (typeof COMMANDS)[number];

export const ACTOR_ROLES = ['advisor', 'bank'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

/** Closed value lists — mirror src/lib/labels.ts and src/types/*.ts. */
export const MATCH_STATUSES = ['interested', 'rejected'] as const;
export const APPROVE_TARGETS = ['case', 'appetite'] as const;
export const BORROWER_TYPES = ['employee', 'self_employed'] as const;
export const APPETITE_LEVELS = ['high', 'medium', 'low'] as const;
export const REGIONS = ['center', 'tel_aviv', 'jerusalem', 'north', 'south', 'sharon', 'shfela'] as const;
export const PROPERTY_TYPES = ['apartment', 'private_house', 'penthouse', 'commercial', 'land'] as const;

/** Strict run-id shape (e.g. E2E-20260717-01-R1) — also blocks path traversal
 *  since the run id becomes part of the manifest filename. */
export const RUN_ID_PATTERN = /^E2E-\d{8}-\d{2}-R\d{1,3}$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The case form's sliders move in 50,000 steps — reject values the UI could
 *  never produce so fixtures stay representative of real user input. */
export const LOAN_STEP = 50_000;

export class ActorError extends Error {}

/** Exact allowlist: the dedicated test project and nothing else.
 *  "Not production" is NOT sufficient — unknown refs must also refuse. */
export function assertTestProjectUrl(url: unknown): void {
  if (url !== TEST_PROJECT_URL) {
    throw new ActorError(
      `refusing to run: SUPABASE_URL is not exactly the dedicated test project (${TEST_PROJECT_URL})`,
    );
  }
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_PATTERN.test(v);

/**
 * Redaction for ERROR output only (success JSON may include full ids):
 * known secret values, JWT-shaped tokens, emails, and full UUIDs are masked.
 */
export function redactForError(message: unknown, secrets: readonly string[] = []): string {
  let out = String(message);
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join('[redacted]');
  }
  out = out.replace(/eyJ[\w-]{10,}\.[\w-]+\.[\w-]+/g, '[redacted-token]');
  out = out.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[redacted-email]');
  out = out.replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '$1…');
  return out;
}

// ─── argument parsing ────────────────────────────────────────────────────────

export interface CaseFields {
  loan_amount_min: number;
  loan_amount_max: number;
  ltv: number;
  borrower_type: (typeof BORROWER_TYPES)[number];
  property_type: (typeof PROPERTY_TYPES)[number];
  region: (typeof REGIONS)[number];
}

export interface AppetiteFields {
  bank_name: string;
  branch_name: string;
  appetite_level: (typeof APPETITE_LEVELS)[number];
  min_loan_amount: number;
  max_ltv: number;
  preferred_borrower_types: string[];
  preferred_regions: string[];
  sla_days: number;
  valid_until: string;
}

export interface ParsedArgs {
  command: ActorCommand;
  as?: ActorRole;
  run?: string;
  match?: string;
  text?: string;
  status?: (typeof MATCH_STATUSES)[number];
  target?: (typeof APPROVE_TARGETS)[number];
  id?: string;
  approved?: boolean;
  confirm?: string;
  timeoutMs?: number;
  expectNewMatches?: number;
  caseFields?: CaseFields;
  appetiteFields?: AppetiteFields;
}

/** Flags each command accepts — anything else is rejected. */
const COMMAND_FLAGS: Record<ActorCommand, readonly string[]> = {
  'list': ['as'],
  'verify-test-users': [],
  'create-case': ['as', 'run', 'min', 'max', 'ltv', 'borrower', 'property', 'region'],
  'create-appetite': ['as', 'run', 'bank-name', 'branch-name', 'level', 'min-loan', 'max-ltv', 'borrowers', 'regions', 'sla', 'valid-until'],
  'send-message': ['as', 'run', 'match', 'text'],
  'set-status': ['as', 'run', 'match', 'status'],
  'approve': ['run', 'target', 'id', 'expect-new-matches'],
  'set-approval': ['run', 'approved'],
  'restore': ['run'],
  'check-realtime': ['as', 'timeout'],
  'cleanup': ['run', 'confirm'],
};

const fail = (msg: string): never => {
  throw new ActorError(msg);
};

const reqEnum = <T extends string>(name: string, v: string | undefined, allowed: readonly T[]): T => {
  if (v === undefined) fail(`missing required --${name} (one of: ${allowed.join(', ')})`);
  if (!(allowed as readonly string[]).includes(v as string)) {
    fail(`invalid --${name} "${v}" (allowed: ${allowed.join(', ')})`);
  }
  return v as T;
};

const reqInt = (name: string, v: string | undefined, min: number, max: number): number => {
  if (v === undefined) fail(`missing required --${name}`);
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    fail(`invalid --${name} "${v}" (integer ${min}..${max})`);
  }
  return n;
};

const reqRunId = (v: string | undefined): string => {
  if (v === undefined) fail('missing required --run');
  if (!RUN_ID_PATTERN.test(v as string)) {
    fail(`invalid --run "${v}" (expected e.g. E2E-20260717-01-R1)`);
  }
  return v as string;
};

const reqUuid = (name: string, v: string | undefined): string => {
  if (v === undefined) fail(`missing required --${name}`);
  if (!isUuid(v)) fail(`invalid --${name}: not a UUID`);
  return v as string;
};

const reqText = (name: string, v: string | undefined, maxLen: number): string => {
  if (v === undefined || v.trim() === '') fail(`missing required --${name}`);
  if ((v as string).length > maxLen) fail(`--${name} exceeds ${maxLen} characters`);
  return v as string;
};

const reqCsvSubset = (name: string, v: string | undefined, allowed: readonly string[]): string[] => {
  const raw = reqText(name, v, 200);
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) fail(`--${name} must contain at least one value`);
  for (const item of items) {
    if (!allowed.includes(item)) fail(`invalid --${name} value "${item}" (allowed: ${allowed.join(', ')})`);
  }
  return [...new Set(items)];
};

/** Strict `--flag value` parser over a closed per-command flag set. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  if (argv.length === 0) fail(`missing command (one of: ${COMMANDS.join(', ')})`);
  const command = reqEnum('command', argv[0], COMMANDS);

  const flags: Record<string, string> = {};
  for (let i = 1; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag.startsWith('--')) fail(`unexpected argument "${flag}" (flags must be --name value)`);
    const name = flag.slice(2);
    if (!COMMAND_FLAGS[command].includes(name)) {
      fail(`unknown flag --${name} for ${command} (allowed: ${COMMAND_FLAGS[command].map((f) => `--${f}`).join(', ') || 'none'})`);
    }
    if (name in flags) fail(`duplicate flag --${name}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`missing value for --${name}`);
    flags[name] = value;
  }

  const parsed: ParsedArgs = { command };

  switch (command) {
    case 'list':
      parsed.as = reqEnum('as', flags['as'], ACTOR_ROLES);
      break;

    case 'verify-test-users':
      // No flags: a fixed read-only verification of the canonical test accounts.
      break;

    case 'create-case': {
      parsed.as = reqEnum('as', flags['as'], ACTOR_ROLES);
      if (parsed.as !== 'advisor') fail('create-case requires --as advisor');
      parsed.run = reqRunId(flags['run']);
      const min = reqInt('min', flags['min'], 100_000, 10_000_000);
      const max = reqInt('max', flags['max'], 100_000, 10_000_000);
      if (min % LOAN_STEP !== 0 || max % LOAN_STEP !== 0) {
        fail(`--min/--max must be multiples of ${LOAN_STEP} (the case form's slider step)`);
      }
      if (min >= max) fail('--min must be lower than --max');
      parsed.caseFields = {
        loan_amount_min: min,
        loan_amount_max: max,
        ltv: reqInt('ltv', flags['ltv'], 1, 95),
        borrower_type: reqEnum('borrower', flags['borrower'], BORROWER_TYPES),
        property_type: reqEnum('property', flags['property'], PROPERTY_TYPES),
        region: reqEnum('region', flags['region'], REGIONS),
      };
      break;
    }

    case 'create-appetite': {
      parsed.as = reqEnum('as', flags['as'], ACTOR_ROLES);
      if (parsed.as !== 'bank') fail('create-appetite requires --as bank');
      parsed.run = reqRunId(flags['run']);
      const branchName = reqText('branch-name', flags['branch-name'], 100);
      if (!branchName.startsWith(parsed.run)) {
        fail('--branch-name must start with the run id (traceability of test data)');
      }
      parsed.appetiteFields = {
        bank_name: reqText('bank-name', flags['bank-name'], 100),
        branch_name: branchName,
        appetite_level: reqEnum('level', flags['level'], APPETITE_LEVELS),
        min_loan_amount: reqInt('min-loan', flags['min-loan'], 0, 10_000_000),
        max_ltv: reqInt('max-ltv', flags['max-ltv'], 1, 95),
        preferred_borrower_types: reqCsvSubset('borrowers', flags['borrowers'], BORROWER_TYPES),
        preferred_regions: reqCsvSubset('regions', flags['regions'], REGIONS),
        sla_days: reqInt('sla', flags['sla'], 1, 60),
        valid_until: (() => {
          const v = reqText('valid-until', flags['valid-until'], 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) fail('--valid-until must be YYYY-MM-DD');
          return v;
        })(),
      };
      break;
    }

    case 'send-message': {
      parsed.as = reqEnum('as', flags['as'], ACTOR_ROLES);
      parsed.run = reqRunId(flags['run']);
      parsed.match = reqUuid('match', flags['match']);
      parsed.text = reqText('text', flags['text'], 500);
      if (!parsed.text.includes(parsed.run)) {
        fail('--text must include the run id (traceability of test data)');
      }
      break;
    }

    case 'set-status':
      parsed.as = reqEnum('as', flags['as'], ACTOR_ROLES);
      parsed.run = reqRunId(flags['run']);
      parsed.match = reqUuid('match', flags['match']);
      parsed.status = reqEnum('status', flags['status'], MATCH_STATUSES);
      break;

    case 'approve':
      parsed.run = reqRunId(flags['run']);
      parsed.target = reqEnum('target', flags['target'], APPROVE_TARGETS);
      parsed.id = reqUuid('id', flags['id']);
      // The expected trigger outcome is part of the command contract: approve
      // FAILS when the matching engine produced a different number of matches.
      parsed.expectNewMatches = reqInt('expect-new-matches', flags['expect-new-matches'], 0, 50);
      break;

    case 'set-approval': {
      parsed.run = reqRunId(flags['run']);
      const approved = reqEnum('approved', flags['approved'], ['true', 'false'] as const);
      parsed.approved = approved === 'true';
      break;
    }

    case 'restore':
      parsed.run = reqRunId(flags['run']);
      break;

    case 'check-realtime':
      // Authenticated context: Postgres Changes are filtered by the subscriber's
      // RLS read access, so an anon subscription would not represent the app.
      parsed.as = reqEnum('as', flags['as'], ACTOR_ROLES);
      parsed.timeoutMs =
        flags['timeout'] === undefined ? 10_000 : reqInt('timeout', flags['timeout'], 1_000, 30_000);
      break;

    case 'cleanup':
      parsed.run = reqRunId(flags['run']);
      parsed.confirm = reqText('confirm', flags['confirm'], 40);
      if (parsed.confirm !== parsed.run) {
        fail('cleanup requires --confirm to repeat the exact run id');
      }
      break;
  }

  return parsed;
}
