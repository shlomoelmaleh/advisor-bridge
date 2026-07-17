// Unit tests for the E2E actor CLI core: command allowlists, argument
// validation, environment guards, and error redaction. Pure logic — no env
// files, no network, no Supabase client.
import { describe, expect, it } from 'vitest';
import {
  ActorError,
  COMMANDS,
  MATCH_STATUSES,
  TEST_PROJECT_URL,
  assertTestProjectUrl,
  isUuid,
  parseArgs,
  redactForError,
} from '../e2e/actorCore';

const RUN = 'E2E-20260717-01-R1';
const UUID = '123e4567-e89b-42d3-a456-426614174000';

const CASE_ARGS = [
  'create-case', '--as', 'advisor', '--run', RUN,
  '--min', '1550000', '--max', '1850000', '--ltv', '65',
  '--borrower', 'self_employed', '--property', 'private_house', '--region', 'north',
];

const APPETITE_ARGS = [
  'create-appetite', '--as', 'bank', '--run', RUN,
  '--bank-name', 'בנק בדיקה', '--branch-name', `${RUN} סניף בדיקה`,
  '--level', 'high', '--min-loan', '500000', '--max-ltv', '70',
  '--borrowers', 'employee,self_employed', '--regions', 'north,center',
  '--sla', '7', '--valid-until', '2027-01-01',
];

describe('command surface', () => {
  it('is the exact closed set from the approved plan', () => {
    expect([...COMMANDS].sort()).toEqual(
      ['approve', 'check-realtime', 'cleanup', 'create-appetite', 'create-case',
        'list', 'restore', 'send-message', 'set-approval', 'set-status',
        'verify-empty-match-inventory', 'verify-test-users'].sort(),
    );
  });

  it('parses verify-test-users bare and rejects any flag', () => {
    expect(parseArgs(['verify-test-users'])).toMatchObject({ command: 'verify-test-users' });
    expect(() => parseArgs(['verify-test-users', '--as', 'advisor'])).toThrow(/unknown flag/);
  });

  it('parses verify-empty-match-inventory bare and rejects any flag', () => {
    expect(parseArgs(['verify-empty-match-inventory'])).toMatchObject({ command: 'verify-empty-match-inventory' });
    expect(() => parseArgs(['verify-empty-match-inventory', '--run', 'E2E-20260717-00-R1'])).toThrow(/unknown flag/);
  });

  it('allows only interested/rejected as match statuses', () => {
    expect([...MATCH_STATUSES]).toEqual(['interested', 'rejected']);
  });

  it('rejects an unknown command', () => {
    expect(() => parseArgs(['drop-table'])).toThrow(ActorError);
    expect(() => parseArgs([])).toThrow(/missing command/);
  });
});

describe('assertTestProjectUrl (exact allowlist)', () => {
  it('accepts exactly the dedicated test project URL', () => {
    expect(() => assertTestProjectUrl(TEST_PROJECT_URL)).not.toThrow();
  });

  it.each([
    ['production project', 'https://oasivruwsvhfmvynpbia.supabase.co'],
    ['unknown ref (not-prod is not enough)', 'https://someotherproject.supabase.co'],
    ['http scheme', 'http://mijlphxzvyyvknulqozw.supabase.co'],
    ['trailing slash', 'https://mijlphxzvyyvknulqozw.supabase.co/'],
    ['lookalike host suffix', 'https://mijlphxzvyyvknulqozw.supabase.co.evil.example'],
    ['undefined', undefined],
    ['empty', ''],
  ])('rejects %s', (_label, url) => {
    expect(() => assertTestProjectUrl(url)).toThrow(ActorError);
  });
});

describe('parseArgs — valid invocations', () => {
  it('parses list', () => {
    expect(parseArgs(['list', '--as', 'bank'])).toMatchObject({ command: 'list', as: 'bank' });
  });

  it('parses create-case with the signed fixture combination', () => {
    const p = parseArgs(CASE_ARGS);
    expect(p.caseFields).toEqual({
      loan_amount_min: 1_550_000,
      loan_amount_max: 1_850_000,
      ltv: 65,
      borrower_type: 'self_employed',
      property_type: 'private_house',
      region: 'north',
    });
  });

  it('parses create-appetite and dedupes CSV lists', () => {
    const p = parseArgs(
      APPETITE_ARGS.map((v) => (v === 'employee,self_employed' ? 'employee,self_employed,employee' : v)),
    );
    expect(p.appetiteFields!.preferred_borrower_types).toEqual(['employee', 'self_employed']);
    expect(p.appetiteFields!.preferred_regions).toEqual(['north', 'center']);
    expect(p.appetiteFields!.branch_name.startsWith(RUN)).toBe(true);
  });

  it('parses send-message when the text carries the run id', () => {
    const p = parseArgs(['send-message', '--as', 'advisor', '--run', RUN, '--match', UUID, '--text', `${RUN} שלום`]);
    expect(p).toMatchObject({ command: 'send-message', match: UUID });
  });

  it('parses set-status with an allowlisted status (run-gated)', () => {
    const p = parseArgs(['set-status', '--as', 'bank', '--run', RUN, '--match', UUID, '--status', 'interested']);
    expect(p.status).toBe('interested');
    expect(p.run).toBe(RUN);
  });

  it('parses approve / set-approval / restore / cleanup', () => {
    const approve = parseArgs(['approve', '--run', RUN, '--target', 'case', '--id', UUID, '--expect-new-matches', '2']);
    expect(approve.target).toBe('case');
    expect(approve.expectNewMatches).toBe(2);
    expect(parseArgs(['set-approval', '--run', RUN, '--approved', 'false']).approved).toBe(false);
    expect(parseArgs(['restore', '--run', RUN]).run).toBe(RUN);
    expect(parseArgs(['cleanup', '--run', RUN, '--confirm', RUN]).confirm).toBe(RUN);
  });

  it('requires an authenticated role and bounds the check-realtime timeout', () => {
    expect(parseArgs(['check-realtime', '--as', 'advisor']).timeoutMs).toBe(10_000);
    const p = parseArgs(['check-realtime', '--as', 'bank', '--timeout', '5000']);
    expect(p.timeoutMs).toBe(5_000);
    expect(p.as).toBe('bank');
  });
});

describe('parseArgs — safety rejections', () => {
  it.each([
    ['unknown flag', ['list', '--as', 'bank', '--table', 'profiles']],
    ['duplicate flag', ['list', '--as', 'bank', '--as', 'advisor']],
    ['missing required flag', ['set-status', '--as', 'bank', '--run', RUN, '--match', UUID]],
    ['set-status without --run', ['set-status', '--as', 'bank', '--match', UUID, '--status', 'rejected']],
    ['bad uuid', ['set-status', '--as', 'bank', '--run', RUN, '--match', 'not-a-uuid', '--status', 'rejected']],
    ['status outside allowlist', ['set-status', '--as', 'bank', '--run', RUN, '--match', UUID, '--status', 'closed']],
    ['free-text status injection', ['set-status', '--as', 'bank', '--run', RUN, '--match', UUID, '--status', "x'; drop table matches;--"]],
    ['create-case as bank', ['create-case', ...CASE_ARGS.slice(1)].map((v, i) => (i === 2 ? 'bank' : v))],
    ['create-appetite as advisor', APPETITE_ARGS.map((v, i) => (i === 2 ? 'advisor' : v))],
    ['approve with a non-uuid id', ['approve', '--run', RUN, '--target', 'case', '--id', 'cases', '--expect-new-matches', '1']],
    ['approve with target outside allowlist', ['approve', '--run', RUN, '--target', 'profiles', '--id', UUID, '--expect-new-matches', '1']],
    ['approve without --expect-new-matches', ['approve', '--run', RUN, '--target', 'case', '--id', UUID]],
    ['approve with negative expected matches', ['approve', '--run', RUN, '--target', 'case', '--id', UUID, '--expect-new-matches', '-1']],
    ['approve with non-integer expected matches', ['approve', '--run', RUN, '--target', 'case', '--id', UUID, '--expect-new-matches', 'many']],
    ['set-approval non-boolean', ['set-approval', '--run', RUN, '--approved', 'maybe']],
    ['bad run id shape', ['restore', '--run', 'E2E-oops']],
    ['run id path traversal', ['restore', '--run', '../../E2E-20260717-01-R1']],
    ['check-realtime without --as', ['check-realtime']],
    ['timeout below bound', ['check-realtime', '--as', 'advisor', '--timeout', '10']],
    ['timeout above bound', ['check-realtime', '--as', 'advisor', '--timeout', '999999']],
    ['flag without value', ['list', '--as']],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseArgs(argv as string[])).toThrow(ActorError);
  });

  it('rejects loan amounts the case form sliders cannot produce (step 50k)', () => {
    const bad = CASE_ARGS.map((v) => (v === '1550000' ? '1517000' : v));
    expect(() => parseArgs(bad)).toThrow(/50,?000|50_000/);
  });

  it('rejects min >= max', () => {
    const bad = CASE_ARGS.map((v) => (v === '1850000' ? '1550000' : v));
    expect(() => parseArgs(bad)).toThrow(ActorError);
  });

  it('rejects a branch name that does not start with the run id', () => {
    const bad = APPETITE_ARGS.map((v) => (v === `${RUN} סניף בדיקה` ? 'סניף בלי מזהה' : v));
    expect(() => parseArgs(bad)).toThrow(/branch-name/);
  });

  it('rejects a message text without the run id', () => {
    expect(() =>
      parseArgs(['send-message', '--as', 'advisor', '--run', RUN, '--match', UUID, '--text', 'שלום']),
    ).toThrow(/run id/);
  });

  it('rejects cleanup when --confirm does not repeat the exact run id', () => {
    expect(() => parseArgs(['cleanup', '--run', RUN, '--confirm', 'E2E-20260717-01-R2'])).toThrow(/confirm/);
    expect(() => parseArgs(['cleanup', '--run', RUN])).toThrow(ActorError);
  });

  it('rejects CSV values outside the closed lists', () => {
    const bad = APPETITE_ARGS.map((v) => (v === 'north,center' ? 'north,narnia' : v));
    expect(() => parseArgs(bad)).toThrow(/regions/);
  });
});

describe('redactForError', () => {
  it('masks provided secret values', () => {
    expect(redactForError('boom: Q1234567 leaked', ['Q1234567'])).not.toContain('Q1234567');
  });

  it('masks JWT-shaped tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig-part_123';
    expect(redactForError(`auth failed for ${jwt}`)).toContain('[redacted-token]');
  });

  it('masks emails', () => {
    const out = redactForError('user admin@branchmatch.test not found');
    expect(out).not.toContain('admin@branchmatch.test');
    expect(out).toContain('[redacted-email]');
  });

  it('truncates full UUIDs to an 8-char prefix', () => {
    const out = redactForError(`row ${UUID} missing`);
    expect(out).not.toContain(UUID);
    expect(out).toContain('123e4567…');
  });

  it('never throws on non-string input', () => {
    expect(redactForError(undefined)).toBe('undefined');
  });
});

describe('isUuid', () => {
  it('accepts a canonical uuid and rejects lookalikes', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid(`${UUID} `)).toBe(false);
    expect(isUuid('123e4567e89b42d3a456426614174000')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
