// Handler-level tests for the E2E actor: privileged-command safety behavior
// against MOCKED Supabase clients. No env files, no network.
import { describe, expect, it } from 'vitest';
import { ParsedArgs } from '../e2e/actorCore';
import { ActorDeps, runCommand } from '../e2e/actorHandlers';
import { RunManifest, createManifest, recordEntry } from '../e2e/manifest';

const RUN = 'E2E-20260717-01-R1';
const ADVISOR_ID = 'a1111111-1111-4111-8111-111111111111';
const BANKER_ID = 'b1111111-1111-4111-8111-111111111111';
const PENDING_ID = 'c1111111-1111-4111-8111-111111111111';
const CASE_ID = 'd1111111-1111-4111-8111-111111111111';
const APPETITE_ID = 'e1111111-1111-4111-8111-111111111111';
const MATCH_1 = 'f1111111-1111-4111-8111-111111111111';
const MATCH_2 = 'f2222222-2222-4222-8222-222222222222';
const MSG_ID = 'a9999999-9999-4999-8999-999999999999';

const CASE_SIGNATURE = {
  loan_amount_min: 1_550_000,
  loan_amount_max: 1_850_000,
  ltv: 65,
  borrower_type: 'self_employed',
  property_type: 'private_house',
  region: 'north',
};

/** Full appetite signature — the provenance contract covers EVERY
 *  matching-relevant field, for created and adopted appetites alike. */
const APPETITE_SIGNATURE = {
  bank_name: 'בנק בדיקה',
  branch_name: `${RUN} סניף D2`,
  appetite_level: 'medium',
  min_loan_amount: 1_500_000,
  max_ltv: 65,
  preferred_borrower_types: ['self_employed'],
  preferred_regions: ['north'],
  sla_days: 30,
  valid_until: '2026-12-31',
};

interface Op {
  table: string;
  action: string;
  filters: Record<string, unknown>;
  payload?: unknown;
  count?: string;
  head?: boolean;
}

/** Minimal chainable mock of the supabase-js query builder + auth admin. */
function fakeClient(route: (op: Op) => { data?: unknown; error?: { message: string } | null }) {
  const calls: Op[] = [];
  const client: any = {
    calls,
    from(table: string) {
      const op: Op = { table, action: 'select', filters: {} };
      const b: any = {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts) {
            op.count = opts.count;
            op.head = opts.head;
          }
          return b;
        },
        insert: (rows: unknown) => ((op.action = 'insert'), (op.payload = rows), b),
        update: (patch: unknown) => ((op.action = 'update'), (op.payload = patch), b),
        delete: () => ((op.action = 'delete'), b),
        eq: (k: string, v: unknown) => ((op.filters[k] = v), b),
        in: (k: string, v: unknown) => ((op.filters[k] = v), b),
        is: (k: string, v: unknown) => ((op.filters[`${k}:is`] = v), b),
        gte: (k: string, v: unknown) => ((op.filters[`${k}:gte`] = v), b),
        order: () => b,
        then: (res: any, rej: any) => {
          calls.push(op);
          try {
            const r = route(op) as { data?: unknown; error?: { message: string } | null; count?: number };
            return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }).then(res, rej);
          } catch (e) {
            return Promise.reject(e).then(res, rej);
          }
        },
      };
      return b;
    },
    auth: {
      admin: {
        listUsers: async (params?: Record<string, unknown>) => {
          const op: Op = { table: '_auth', action: 'listUsers', filters: params ?? {} };
          calls.push(op);
          return route(op);
        },
      },
    },
    channel(name: string) {
      const ch: any = { name, on: () => ch, subscribe: (cb: (s: string) => void) => (cb('SUBSCRIBED'), ch) };
      return ch;
    },
    removeChannel: async () => {},
  };
  return client;
}

const TEST_USERS = {
  data: {
    users: [
      { id: ADVISOR_ID, email: 'advisor@t.test' },
      { id: BANKER_ID, email: 'banker@t.test' },
      { id: PENDING_ID, email: 'pending@t.test' },
    ],
  },
  error: null,
};

/** Stateful mock DB: selects see current rows, deletes remove them — needed
 *  for cleanup's post-deletion absence checks and crash/resume flows. */
function statefulAdmin(initial: Record<string, any[]>, opts: { failDeleteOnce?: string } = {}) {
  const state: Record<string, any[]> = Object.fromEntries(
    Object.entries(initial).map(([k, v]) => [k, v.map((r) => ({ ...r }))]),
  );
  let failDeleteOnce = opts.failDeleteOnce;
  const client = fakeClient((op) => {
    if (op.action === 'listUsers') return TEST_USERS;
    const rows = state[op.table] ?? [];
    const matchesFilters = (r: any) =>
      Object.entries(op.filters).every(([k, v]) => (Array.isArray(v) ? (v as any[]).includes(r[k]) : r[k] === v));
    if (op.action === 'select') return { data: rows.filter(matchesFilters).map((r) => ({ ...r })) };
    if (op.action === 'delete') {
      if (failDeleteOnce === op.table) {
        failDeleteOnce = undefined;
        return { error: { message: 'connection reset' } };
      }
      const hit = rows.filter(matchesFilters);
      state[op.table] = rows.filter((r) => !matchesFilters(r));
      return { data: hit.map((r) => ({ id: r.id })) };
    }
    throw new Error(`unexpected op ${op.action} on ${op.table}`);
  });
  (client as any).state = state;
  return client;
}

function makeDeps(opts: { admin?: any; user?: any; userId?: string; manifest?: RunManifest; genId?: () => string }) {
  const manifests: Record<string, RunManifest> = {};
  if (opts.manifest) manifests[opts.manifest.runId] = opts.manifest;
  const rolesRequested: string[] = [];
  const deps: ActorDeps = {
    userClient: async (role) => {
      rolesRequested.push(role);
      if (!opts.user) throw new Error('unexpected userClient call in this test');
      return { client: opts.user, userId: opts.userId ?? ADVISOR_ID };
    },
    serviceClient: () => {
      if (!opts.admin) throw new Error('unexpected serviceClient call in this test');
      return opts.admin;
    },
    loadManifest: (runId) => manifests[runId] ?? null,
    saveManifest: (m) => ((manifests[m.runId] = m), `mem://${m.runId}`),
    genId: opts.genId ?? (() => MSG_ID),
    env: { advisorEmail: 'advisor@t.test', bankerEmail: 'banker@t.test', adminEmail: 'admin@t.test', pendingEmail: 'pending@t.test' },
  };
  return { deps, manifests, rolesRequested };
}

/** Manifest with one verified case+appetite+match+message, correct provenance. */
function seededManifest(): RunManifest {
  const m = createManifest(RUN);
  recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status: 'created', provenance: { advisor_id: ADVISOR_ID, ...CASE_SIGNATURE } });
  recordEntry(m, { kind: 'appetite', id: APPETITE_ID, by: 'bank', status: 'created', provenance: { banker_id: BANKER_ID, ...APPETITE_SIGNATURE } });
  recordEntry(m, { kind: 'match', id: MATCH_1, by: 'trigger', status: 'created', provenance: { case_id: CASE_ID, appetite_id: APPETITE_ID } });
  recordEntry(m, { kind: 'message', id: MSG_ID, by: 'bank', status: 'created', provenance: { sender_id: BANKER_ID, match_id: MATCH_1 } });
  return m;
}

const LIVE_ROWS: Record<string, any[]> = {
  cases: [{ id: CASE_ID, advisor_id: ADVISOR_ID, ...CASE_SIGNATURE }],
  branch_appetites: [{ id: APPETITE_ID, banker_id: BANKER_ID, ...APPETITE_SIGNATURE }],
  matches: [{ id: MATCH_1, case_id: CASE_ID, appetite_id: APPETITE_ID }],
  messages: [{ id: MSG_ID, sender_id: BANKER_ID, match_id: MATCH_1, content: `${RUN} שלום` }],
};

const cleanupArgs: ParsedArgs = { command: 'cleanup', run: RUN, confirm: RUN };

describe('cleanup — provenance verification before any delete', () => {
  it('verifies, journals, deletes with exact counts, confirms absence, then reports already-cleaned', async () => {
    const admin = statefulAdmin(LIVE_ROWS);
    const { deps, manifests } = makeDeps({ admin, manifest: seededManifest() });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.deleted).toEqual({ messages: 1, matches: 1, cases: 1, branch_appetites: 1 });
    expect(result.resumed).toBe(false);
    const journal = manifests[RUN].entries.find((e) => e.kind === 'cleanup')!;
    expect(journal.status).toBe('created');

    const again: any = await runCommand(deps, cleanupArgs);
    expect(again.alreadyCleaned).toBe(true);
  });

  it('refuses a tampered manifest (foreign case UUID) before ANY delete', async () => {
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.action === 'select' && op.table === 'cases') {
        // The live row belongs to someone else — manifest was hand-edited.
        return { data: [{ id: CASE_ID, advisor_id: 'someone-else', ...CASE_SIGNATURE }] };
      }
      if (op.action === 'select') return { data: LIVE_ROWS[op.table] };
      return { data: [] };
    });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/provenance/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });

  it('refuses when a match is not linked to any manifest case/appetite', async () => {
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.action === 'select' && op.table === 'matches') {
        return { data: [{ id: MATCH_1, case_id: 'other-case', appetite_id: 'other-appetite' }] };
      }
      if (op.action === 'select') return { data: LIVE_ROWS[op.table] };
      return { data: [] };
    });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/not linked/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });

  it('aborts before deleting when a row is missing WITHOUT a journaled plan', async () => {
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.action === 'select' && op.table === 'cases') return { data: [] }; // row gone, no journal
      if (op.action === 'select') return { data: LIVE_ROWS[op.table] };
      return { data: [] };
    });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/missing/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });

  it('fails loudly on a deleted-count mismatch and keeps the journal pending', async () => {
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.action === 'select') return { data: LIVE_ROWS[op.table] };
      if (op.action === 'delete' && op.table === 'messages') return { data: [] }; // deleted 0 of 1
      if (op.action === 'delete') return { data: LIVE_ROWS[op.table].map((r) => ({ id: r.id })) };
      return { data: [] };
    });
    const { deps, manifests } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/deleted 0 of 1/);
    const journal = manifests[RUN].entries.find((e) => e.kind === 'cleanup')!;
    expect(journal.status).toBe('pending');
  });

  it('resumes safely after a crash mid-deletion (journaled plan tolerates already-deleted rows)', async () => {
    const admin = statefulAdmin(LIVE_ROWS, { failDeleteOnce: 'matches' });
    const { deps, manifests } = makeDeps({ admin, manifest: seededManifest() });

    // First run: messages get deleted, then the matches delete fails.
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/delete on matches/);
    expect(manifests[RUN].entries.find((e) => e.kind === 'cleanup')!.status).toBe('pending');
    expect((admin as any).state['messages']).toHaveLength(0); // partial deletion happened

    // Retry: missing messages are allowed (they are in the journaled plan);
    // the rest is re-verified and deleted; the journal completes.
    const retry: any = await runCommand(deps, cleanupArgs);
    expect(retry.resumed).toBe(true);
    expect(retry.deleted).toEqual({ messages: 0, matches: 1, cases: 1, branch_appetites: 1 });
    expect(manifests[RUN].entries.find((e) => e.kind === 'cleanup')!.status).toBe('created');

    const third: any = await runCommand(deps, cleanupArgs);
    expect(third.alreadyCleaned).toBe(true);
  });
});

describe('cleanup — reconciliation of pending/failed entries', () => {
  const pendingCaseManifest = (status: 'pending' | 'failed') => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status, provenance: { advisor_id: ADVISOR_ID, ...CASE_SIGNATURE } });
    return m;
  };

  it('recovers a pending entry whose insert landed (crash before created) and deletes it', async () => {
    const admin = statefulAdmin({ cases: LIVE_ROWS.cases });
    const { deps, manifests } = makeDeps({ admin, manifest: pendingCaseManifest('pending') });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.reconciliation).toEqual({ recovered: 1, resolvedAbsent: 0, recoveredMatches: 0 });
    expect(result.deleted.cases).toBe(1);
    expect(manifests[RUN].entries.find((e) => e.kind === 'case')!.status).toBe('created');
  });

  it('recovers a failed entry whose insert actually landed (lost response)', async () => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'appetite', id: APPETITE_ID, by: 'bank', status: 'failed', provenance: { banker_id: BANKER_ID, ...APPETITE_SIGNATURE } });
    const admin = statefulAdmin({ branch_appetites: LIVE_ROWS.branch_appetites });
    const { deps } = makeDeps({ admin, manifest: m });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.reconciliation.recovered).toBe(1);
    expect(result.deleted.branch_appetites).toBe(1);
  });

  it('marks a pending entry with no live row as resolved-absent and continues', async () => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'message', id: MSG_ID, by: 'bank', status: 'pending', provenance: { sender_id: BANKER_ID, match_id: MATCH_1 } });
    const admin = statefulAdmin({ messages: [] });
    const { deps, manifests } = makeDeps({ admin, manifest: m });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.reconciliation).toEqual({ recovered: 0, resolvedAbsent: 1, recoveredMatches: 0 });
    expect(result.deleted).toEqual({ messages: 0, matches: 0, cases: 0, branch_appetites: 0 });
    expect(manifests[RUN].entries.find((e) => e.kind === 'message')!.status).toBe('resolved-absent');
  });

  it('aborts before any delete when a stale entry exists but fails provenance', async () => {
    const admin = statefulAdmin({ cases: [{ id: CASE_ID, advisor_id: 'someone-else', ...CASE_SIGNATURE }] });
    const { deps } = makeDeps({ admin, manifest: pendingCaseManifest('pending') });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/provenance/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });

  it('recovers a create whose post-insert verification threw after the DB row landed', async () => {
    // create-case: the insert returns a row that fails verification (is_approved
    // came back true) → the command throws, the entry stays pending…
    const user = fakeClient((op) => {
      if (op.table === 'cases' && op.action === 'insert') {
        const payload = (op.payload as any[])[0];
        return { data: [{ ...payload, is_approved: true, created_at: 'now' }] };
      }
      throw new Error(`unexpected op ${op.action} on ${op.table}`);
    });
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, genId: () => CASE_ID, admin: undefined });
    await expect(
      runCommand(deps, { command: 'create-case', as: 'advisor', run: RUN, caseFields: { ...CASE_SIGNATURE } as any }),
    ).rejects.toThrow(/not pending approval/);
    expect(manifests[RUN].entries.find((e) => e.kind === 'case')!.status).toBe('pending');

    // …and cleanup reconciliation later finds the live row, verifies it and removes it.
    const admin = statefulAdmin({ cases: [{ id: CASE_ID, advisor_id: ADVISOR_ID, ...CASE_SIGNATURE }] });
    const deps2 = { ...deps, serviceClient: () => admin };
    const result: any = await runCommand(deps2, cleanupArgs);
    expect(result.reconciliation.recovered).toBe(1);
    expect(result.deleted.cases).toBe(1);
  });
});

describe('cleanup — reconciliation of crashed approve lifecycles', () => {
  const approvePendingManifest = (recordedMatches: string[] = []) => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status: 'created', provenance: { advisor_id: ADVISOR_ID, ...CASE_SIGNATURE } });
    recordEntry(m, {
      kind: 'approve',
      id: CASE_ID,
      by: 'service_role',
      status: 'pending',
      before: { target: 'case', table: 'cases', fk: 'case_id', is_approved: false, matchIdsBefore: [], expectNewMatches: 1 },
    });
    for (const id of recordedMatches) {
      recordEntry(m, { kind: 'match', id, by: 'trigger', status: 'created', provenance: { case_id: CASE_ID, appetite_id: APPETITE_ID } });
    }
    return m;
  };
  const approvedCaseRow = { id: CASE_ID, advisor_id: ADVISOR_ID, ...CASE_SIGNATURE, is_approved: true };
  const liveMatch = (id: string) => ({ id, case_id: CASE_ID, appetite_id: APPETITE_ID });

  it('recovers trigger-created matches after a crash between update and matchesAfter recording', async () => {
    const admin = statefulAdmin({ cases: [approvedCaseRow], matches: [liveMatch(MATCH_1)] });
    const { deps, manifests } = makeDeps({ admin, manifest: approvePendingManifest() });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.reconciliation.recoveredMatches).toBe(1);
    expect(result.deleted).toEqual({ messages: 0, matches: 1, cases: 1, branch_appetites: 0 });
    expect(manifests[RUN].entries.find((e) => e.kind === 'approve')!.status).toBe('created');
  });

  it('recovers without duplicates when some matches were already recorded before the crash', async () => {
    const admin = statefulAdmin({ cases: [approvedCaseRow], matches: [liveMatch(MATCH_1), liveMatch(MATCH_2)] });
    const { deps, manifests } = makeDeps({ admin, manifest: approvePendingManifest([MATCH_1]) });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.reconciliation.recoveredMatches).toBe(1); // only MATCH_2
    expect(result.deleted.matches).toBe(2);
    expect(manifests[RUN].entries.filter((e) => e.kind === 'match' && e.id === MATCH_1)).toHaveLength(1);
  });

  it('completes a lifecycle that crashed after recording all derivatives (no new entries)', async () => {
    const admin = statefulAdmin({ cases: [approvedCaseRow], matches: [liveMatch(MATCH_1)] });
    const { deps, manifests } = makeDeps({ admin, manifest: approvePendingManifest([MATCH_1]) });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(result.reconciliation.recoveredMatches).toBe(0);
    expect(manifests[RUN].entries.find((e) => e.kind === 'approve')!.status).toBe('created');
    expect(manifests[RUN].entries.filter((e) => e.kind === 'match')).toHaveLength(1);
  });

  it('marks an approve whose update never landed as resolved-absent (target still unapproved)', async () => {
    const admin = statefulAdmin({ cases: [{ ...approvedCaseRow, is_approved: false }] });
    const { deps, manifests } = makeDeps({ admin, manifest: approvePendingManifest() });
    const result: any = await runCommand(deps, cleanupArgs);
    expect(manifests[RUN].entries.find((e) => e.kind === 'approve')!.status).toBe('resolved-absent');
    expect(result.reconciliation.recoveredMatches).toBe(0);
    expect(result.deleted.cases).toBe(1); // the created case itself is still cleaned
  });

  it('aborts before any delete on an unexpected live target state', async () => {
    const admin = statefulAdmin({ cases: [{ ...approvedCaseRow, is_approved: null }] });
    const { deps } = makeDeps({ admin, manifest: approvePendingManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/unexpected live target state/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });
});

describe('cleanup — message provenance completeness', () => {
  it('aborts before any delete when a message row belongs to a different match', async () => {
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.action === 'select' && op.table === 'messages') {
        return { data: [{ id: MSG_ID, sender_id: BANKER_ID, match_id: 'a-different-match', content: `${RUN} שלום` }] };
      }
      if (op.action === 'select') return { data: LIVE_ROWS[op.table] };
      return { data: [] };
    });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/provenance/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });
});

describe('restore — revalidated pending user, state contract, reverse order', () => {
  const approvalEntry = (id: string, before: unknown, intended: unknown) =>
    ({ kind: 'approval-change', id, by: 'service_role', before, intended }) as const;

  it('refuses when an approval-change entry is not the resolved pending user', async () => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry('99999999-9999-4999-8999-999999999999', { is_approved: true, role: 'advisor' }, { is_approved: false }));
    const admin = fakeClient((op) => (op.action === 'listUsers' ? TEST_USERS : { data: [] }));
    const { deps } = makeDeps({ admin, manifest });
    await expect(runCommand(deps, { command: 'restore', run: RUN })).rejects.toThrow(/pending test user/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('restores stacked changes newest-first, ending at the original state', async () => {
    const manifest = createManifest(RUN);
    // Original false → set true (before false) → set false (before true).
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: false, role: 'advisor' }, { is_approved: true }));
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: true, role: 'advisor' }, { is_approved: false }));
    const profile = { user_id: PENDING_ID, is_approved: false, role: 'advisor' };
    const updatePayloads: unknown[] = [];
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'profiles' && op.action === 'select') return { data: [{ ...profile }] };
      if (op.table === 'profiles' && op.action === 'update') {
        updatePayloads.push((op.payload as any).is_approved);
        profile.is_approved = (op.payload as any).is_approved;
        return { data: [{ ...profile }] };
      }
      throw new Error(`unexpected op ${op.action} on ${op.table}`);
    });
    const { deps, manifests } = makeDeps({ admin, manifest });
    const result: any = await runCommand(deps, { command: 'restore', run: RUN });
    expect(updatePayloads).toEqual([true, false]); // newest entry first, oldest last
    expect(result.finalState).toBe(false); // back to the original state
    expect(profile.is_approved).toBe(false);
    expect(manifests[RUN].entries.filter((e) => e.kind === 'approval-change').every((e) => e.restored)).toBe(true);
  });

  it('refuses when the live profile role differs from the recorded before-state', async () => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: false, role: 'advisor' }, { is_approved: true }));
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'profiles' && op.action === 'select') {
        return { data: [{ user_id: PENDING_ID, is_approved: true, role: 'bank' }] };
      }
      return { data: [] };
    });
    const { deps } = makeDeps({ admin, manifest });
    await expect(runCommand(deps, { command: 'restore', run: RUN })).rejects.toThrow(/role differs/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it.each([
    ['null before value', { is_approved: null, role: 'advisor' }, { is_approved: true }],
    ['string before value', { is_approved: 'yes', role: 'advisor' }, { is_approved: true }],
    ['missing intended', { is_approved: false, role: 'advisor' }, undefined],
    ['invalid role', { is_approved: false, role: 'superadmin' }, { is_approved: true }],
  ])('refuses a malformed recorded state (%s) without updating', async (_label, before, intended) => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry(PENDING_ID, before, intended));
    const admin = fakeClient((op) => (op.action === 'listUsers' ? TEST_USERS : { data: [] }));
    const { deps } = makeDeps({ admin, manifest });
    await expect(runCommand(deps, { command: 'restore', run: RUN })).rejects.toThrow(/malformed/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('preflights the WHOLE chain: a newer valid entry never restores when an older entry is malformed', async () => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: null, role: 'advisor' }, { is_approved: true })); // older, malformed
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: true, role: 'advisor' }, { is_approved: false })); // newer, valid
    const admin = fakeClient((op) => (op.action === 'listUsers' ? TEST_USERS : { data: [] }));
    const { deps } = makeDeps({ admin, manifest });
    await expect(runCommand(deps, { command: 'restore', run: RUN })).rejects.toThrow(/malformed/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('refuses an inconsistent chain (a change does not start from the previous intended state)', async () => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: false, role: 'advisor' }, { is_approved: true }));
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: false, role: 'advisor' }, { is_approved: true })); // should start from true
    const admin = fakeClient((op) => (op.action === 'listUsers' ? TEST_USERS : { data: [] }));
    const { deps } = makeDeps({ admin, manifest });
    await expect(runCommand(deps, { command: 'restore', run: RUN })).rejects.toThrow(/chain is inconsistent/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('refuses when the live state matches neither before nor intended', async () => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: false, role: 'advisor' }, { is_approved: true }));
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'profiles' && op.action === 'select') {
        return { data: [{ user_id: PENDING_ID, is_approved: null, role: 'advisor' }] }; // nullable column drifted
      }
      return { data: [] };
    });
    const { deps } = makeDeps({ admin, manifest });
    await expect(runCommand(deps, { command: 'restore', run: RUN })).rejects.toThrow(/neither/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('marks an entry restored WITHOUT updating when the mutation never applied (crash before update)', async () => {
    const manifest = createManifest(RUN);
    recordEntry(manifest, approvalEntry(PENDING_ID, { is_approved: false, role: 'advisor' }, { is_approved: true }));
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'profiles' && op.action === 'select') {
        return { data: [{ user_id: PENDING_ID, is_approved: false, role: 'advisor' }] }; // still the before-state
      }
      throw new Error('update must not run when the live state equals the before-state');
    });
    const { deps, manifests } = makeDeps({ admin, manifest });
    const result: any = await runCommand(deps, { command: 'restore', run: RUN });
    expect(result.applied).toBe(0);
    expect(result.skippedNeverApplied).toBe(1);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
    expect(manifests[RUN].entries[0].restored).toBe(true);
  });
});

describe('approve — provenance and expected trigger outcome', () => {
  const approveArgs: ParsedArgs = { command: 'approve', run: RUN, target: 'case', id: CASE_ID, expectNewMatches: 1 };

  function approveAdmin(opts: { alreadyApproved?: boolean; foreignOwner?: boolean; newMatches: Array<{ id: string }> }) {
    let matchesReads = 0;
    return fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'cases' && op.action === 'select') {
        return {
          data: [{ id: CASE_ID, is_approved: opts.alreadyApproved ?? false, advisor_id: opts.foreignOwner ? 'someone-else' : ADVISOR_ID, ...CASE_SIGNATURE }],
        };
      }
      if (op.table === 'cases' && op.action === 'update') return { data: [{ id: CASE_ID, is_approved: true }] };
      if (op.table === 'matches' && op.action === 'select') {
        matchesReads += 1;
        if (matchesReads === 1) return { data: [] };
        return { data: opts.newMatches.map((m) => ({ ...m, case_id: CASE_ID, appetite_id: APPETITE_ID })) };
      }
      throw new Error(`unexpected op ${op.action} on ${op.table}`);
    });
  }

  it('succeeds when the trigger produced exactly the expected new matches (with provenance)', async () => {
    const admin = approveAdmin({ newMatches: [{ id: MATCH_1 }] });
    const { deps, manifests } = makeDeps({ admin, manifest: seededManifest() });
    const result: any = await runCommand(deps, approveArgs);
    expect(result.newMatchIds).toEqual([MATCH_1]);
    const matchEntries = manifests[RUN].entries.filter((e) => e.kind === 'match' && e.id === MATCH_1);
    expect(matchEntries.at(-1)!.provenance).toEqual({ case_id: CASE_ID, appetite_id: APPETITE_ID });
  });

  it('refuses a live row owned by someone else (tampered created entry) with zero updates', async () => {
    const admin = approveAdmin({ foreignOwner: true, newMatches: [] });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, approveArgs)).rejects.toThrow(/provenance/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('fails when the new-match count differs, but records the matches first', async () => {
    const admin = approveAdmin({ newMatches: [{ id: MATCH_1 }, { id: MATCH_2 }] });
    const { deps, manifests } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, approveArgs)).rejects.toThrow(/expected 1 new match\(es\), trigger produced 2/);
    const recorded = manifests[RUN].entries.filter((e) => e.kind === 'match').map((e) => e.id);
    expect(recorded).toContain(MATCH_2); // recorded despite the failure, so cleanup can remove it
    // the approve lifecycle still completed — cleanup can account for everything
    expect(manifests[RUN].entries.find((e) => e.kind === 'approve')!.status).toBe('created');
  });

  it('refuses an already-approved target without updating', async () => {
    const admin = approveAdmin({ alreadyApproved: true, newMatches: [] });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, approveArgs)).rejects.toThrow(/already approved/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('refuses an id that is not a verified manifest entity', async () => {
    const admin = fakeClient(() => {
      throw new Error('no DB access expected for a non-manifest id');
    });
    const { deps } = makeDeps({ admin, manifest: createManifest(RUN) });
    await expect(runCommand(deps, approveArgs)).rejects.toThrow(/not recorded/);
    expect(admin.calls).toHaveLength(0);
  });
});

describe('user mutations — gated to the active manifest', () => {
  it('set-status refuses a match that is not recorded in the run manifest', async () => {
    const { deps, rolesRequested } = makeDeps({ manifest: createManifest(RUN) });
    await expect(
      runCommand(deps, { command: 'set-status', as: 'bank', run: RUN, match: MATCH_1, status: 'interested' }),
    ).rejects.toThrow(/not recorded/);
    expect(rolesRequested).toHaveLength(0); // refused before any sign-in
  });

  it('send-message refuses a match that is not recorded in the run manifest', async () => {
    const { deps, rolesRequested } = makeDeps({ manifest: createManifest(RUN) });
    await expect(
      runCommand(deps, { command: 'send-message', as: 'bank', run: RUN, match: MATCH_1, text: `${RUN} hi` }),
    ).rejects.toThrow(/not recorded/);
    expect(rolesRequested).toHaveLength(0);
  });

  it('set-status refuses a no-op (status already set) and requires one updated row', async () => {
    const user = fakeClient((op) => {
      if (op.table === 'matches' && op.action === 'select') {
        return { data: [{ id: MATCH_1, banker_status: 'interested', advisor_status: 'pending', status: 'pending' }] };
      }
      throw new Error('update must not run for a no-op');
    });
    const { deps } = makeDeps({ user, userId: BANKER_ID, manifest: seededManifest() });
    await expect(
      runCommand(deps, { command: 'set-status', as: 'bank', run: RUN, match: MATCH_1, status: 'interested' }),
    ).rejects.toThrow(/no-op/);
  });
});

describe('verify-test-users — read-only account verification', () => {
  const ADMIN_ID = 'd9999999-9999-4999-8999-999999999999';
  type SeedState = { users?: Array<{ id: string; email: string }>; profiles?: Record<string, any> };

  const CONFIRMED = '2026-01-01T00:00:00Z';
  const goodUsers = [
    { id: ADVISOR_ID, email: 'advisor@t.test', email_confirmed_at: CONFIRMED },
    { id: BANKER_ID, email: 'banker@t.test', email_confirmed_at: CONFIRMED },
    { id: ADMIN_ID, email: 'admin@t.test', email_confirmed_at: CONFIRMED },
    { id: PENDING_ID, email: 'pending@t.test', email_confirmed_at: CONFIRMED },
  ];
  const goodProfiles: Record<string, any> = {
    [ADVISOR_ID]: { user_id: ADVISOR_ID, role: 'advisor', is_approved: true },
    [BANKER_ID]: { user_id: BANKER_ID, role: 'bank', is_approved: true },
    [ADMIN_ID]: { user_id: ADMIN_ID, role: 'admin', is_approved: true },
    [PENDING_ID]: { user_id: PENDING_ID, role: 'advisor', is_approved: true },
  };

  const verifyAdmin = (state: SeedState = {}) => {
    const users = state.users ?? goodUsers;
    const profiles = state.profiles ?? goodProfiles;
    return fakeClient((op) => {
      if (op.action === 'listUsers') return { data: { users }, error: null };
      if (op.table === 'profiles' && op.action === 'select') {
        const row = profiles[op.filters['user_id'] as string];
        return { data: row ? [{ ...row }] : [] };
      }
      throw new Error(`unexpected op ${op.action} on ${op.table} — verify-test-users must be read-only`);
    });
  };
  const args: ParsedArgs = { command: 'verify-test-users' };

  it('passes on a healthy seed baseline, read-only, without emails or full UUIDs in output', async () => {
    const admin = verifyAdmin();
    const { deps } = makeDeps({ admin });
    const result: any = await runCommand(deps, args);
    expect(result.accounts.advisor.ok).toBe(true);
    expect(result.accounts.bank.ok).toBe(true);
    expect(result.accounts.admin.ok).toBe(true);
    expect(result.accounts.pending.ok).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('@t.test');
    expect(serialized).not.toContain(ADVISOR_ID); // only 8-char prefixes
    expect(result.accounts.advisor.userIdPrefix).toBe(ADVISOR_ID.slice(0, 8));
    expect(admin.calls.every((c: Op) => c.action === 'select' || c.action === 'listUsers')).toBe(true);
  });

  it('documents the is_admin gap as a NON-blocking diagnostic on the admin account', async () => {
    const admin = verifyAdmin(); // goodUsers carry no app_metadata.role
    const { deps } = makeDeps({ admin });
    const result: any = await runCommand(deps, args); // still succeeds
    expect(result.accounts.admin.appMetadataRole).toBeNull();
    expect(result.accounts.admin.diagnostic).toMatch(/is_admin/);
    expect(result.accounts.admin.ok).toBe(true); // diagnostic, not a failure
  });

  it('paginates through ALL auth pages — a duplicate beyond page 1 is detected', async () => {
    const filler = Array.from({ length: 200 }, (_, i) => ({
      id: `f${i}`.padEnd(8, '0'),
      email: `filler${i}@x.test`,
      email_confirmed_at: CONFIRMED,
    }));
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') {
        // page 1 is full (forces another fetch); page 2 holds the real users + a duplicate
        return op.filters['page'] === 1
          ? { data: { users: filler }, error: null }
          : { data: { users: [...goodUsers, { id: MATCH_2, email: 'advisor@t.test', email_confirmed_at: CONFIRMED }] }, error: null };
      }
      if (op.table === 'profiles' && op.action === 'select') {
        const row = goodProfiles[op.filters['user_id'] as string];
        return { data: row ? [{ ...row }] : [] };
      }
      throw new Error(`unexpected op ${op.action} on ${op.table}`);
    });
    const { deps } = makeDeps({ admin });
    await expect(runCommand(deps, args)).rejects.toThrow(/advisor: found 2 duplicate/);
    expect(admin.calls.filter((c: Op) => c.action === 'listUsers')).toHaveLength(2);
  });

  it.each([
    ['missing auth user', { users: goodUsers.filter((u) => u.email !== 'admin@t.test') }, /admin: auth user missing/],
    ['duplicate auth users', { users: [...goodUsers, { id: MATCH_2, email: 'advisor@t.test', email_confirmed_at: CONFIRMED }] }, /advisor: found 2 duplicate/],
    ['unconfirmed auth account', { users: goodUsers.map((u) => (u.email === 'admin@t.test' ? { id: u.id, email: u.email } : u)) }, /admin: auth account is not confirmed/],
    ['missing profile', { profiles: { ...goodProfiles, [BANKER_ID]: undefined } }, /bank: expected exactly 1 profile/],
    ['wrong role', { profiles: { ...goodProfiles, [PENDING_ID]: { user_id: PENDING_ID, role: 'bank', is_approved: true } } }, /pending: profile role/],
    ['wrong is_approved', { profiles: { ...goodProfiles, [ADVISOR_ID]: { user_id: ADVISOR_ID, role: 'advisor', is_approved: false } } }, /advisor: is_approved/],
  ])('fails loudly on %s without mutating anything', async (_label, state, pattern) => {
    const admin = verifyAdmin(state as SeedState);
    const { deps } = makeDeps({ admin });
    await expect(runCommand(deps, args)).rejects.toThrow(pattern);
    expect(admin.calls.every((c: Op) => c.action === 'select' || c.action === 'listUsers')).toBe(true);
  });

  it('reports the account key, not the email, in error messages', async () => {
    const admin = verifyAdmin({ users: goodUsers.filter((u) => u.email !== 'pending@t.test') });
    const { deps } = makeDeps({ admin });
    await expect(runCommand(deps, args)).rejects.toThrow();
    try {
      await runCommand(deps, args);
    } catch (e: any) {
      expect(e.message).toContain('pending:');
      expect(e.message).not.toContain('@t.test');
    }
  });
});

describe('verify-empty-match-inventory — global read-only counts', () => {
  const args: ParsedArgs = { command: 'verify-empty-match-inventory' };
  const countsRoute =
    (caseCount: number, inDateAppetites: number, noExpiryAppetites = 0) =>
    (op: Op) => {
      if (op.action !== 'select' || op.head !== true || op.count !== 'exact') {
        throw new Error('inventory must use head+count selects only — no rows may be fetched');
      }
      if (op.table === 'cases') return { count: caseCount };
      if (op.table === 'branch_appetites') {
        return { count: 'valid_until:is' in op.filters ? noExpiryAppetites : inDateAppetites };
      }
      throw new Error(`unexpected table ${op.table}`);
    };

  it('passes on 0/0 using GLOBAL head+count selects (no owner filter, no rows)', async () => {
    const admin = fakeClient(countsRoute(0, 0, 0));
    const { deps } = makeDeps({ admin });
    const result: any = await runCommand(deps, args);
    expect(result.empty).toBe(true);
    expect(result.openApprovedCases).toBe(0);
    expect(result.eligibleAppetites).toBe(0);
    expect(admin.calls.every((c: Op) => c.action === 'select')).toBe(true);
    const casesOp = admin.calls.find((c: Op) => c.table === 'cases')!;
    // trigger-equivalent predicates, and NO owner scoping — this is the global claim
    expect(casesOp.filters).toEqual({ status: 'open', is_approved: true });
    expect(casesOp.filters).not.toHaveProperty('advisor_id');
    const appetiteOps = admin.calls.filter((c: Op) => c.table === 'branch_appetites');
    expect(appetiteOps).toHaveLength(2); // no-expiry + in-date
    for (const op of appetiteOps) expect(op.filters).not.toHaveProperty('banker_id');
  });

  it('fails on other-owners cases (positive global count) before any mutation', async () => {
    const admin = fakeClient(countsRoute(2, 0));
    const { deps } = makeDeps({ admin });
    await expect(runCommand(deps, args)).rejects.toThrow(/found 2 open\+approved case/);
    expect(admin.calls.every((c: Op) => c.action === 'select')).toBe(true);
  });

  it('fails on eligible appetites, summing no-expiry and in-date', async () => {
    const admin = fakeClient(countsRoute(0, 1, 1));
    const { deps } = makeDeps({ admin });
    await expect(runCommand(deps, args)).rejects.toThrow(/2 matching-eligible appetite/);
  });

  it('fails loudly when the count is missing from the response', async () => {
    const admin = fakeClient(() => ({ data: null }));
    const { deps } = makeDeps({ admin });
    await expect(runCommand(deps, args)).rejects.toThrow(/count missing/);
  });
});

describe('check-realtime — authenticated context', () => {
  it('subscribes with the requested authenticated role, subscription-only', async () => {
    const user = fakeClient(() => {
      throw new Error('no table access expected — subscription only');
    });
    const { deps, rolesRequested } = makeDeps({ user, userId: BANKER_ID });
    const result: any = await runCommand(deps, { command: 'check-realtime', as: 'bank', timeoutMs: 2_000 });
    expect(rolesRequested).toEqual(['bank']);
    expect(result.subscribed).toBe(true);
    expect(result.role).toBe('bank');
    expect(user.calls).toHaveLength(0); // no reads/writes, only channels
  });

  it('subscribes BOTH channels before any removeChannel, and cleans both even when one fails', async () => {
    const events: string[] = [];
    const makeChannel = (name: string) => {
      const ch: any = {
        name,
        on: () => ch,
        subscribe: (cb: (s: string) => void) => {
          events.push(`subscribe:${name}`);
          // async terminal status: matches errors, messages subscribes
          setTimeout(() => cb(name.includes('matches') ? 'CHANNEL_ERROR' : 'SUBSCRIBED'), 0);
          return ch;
        },
      };
      return ch;
    };
    const user: any = {
      channel: (name: string) => makeChannel(name),
      removeChannel: async (ch: any) => {
        events.push(`remove:${ch.name}`);
      },
    };
    const { deps } = makeDeps({ user, userId: BANKER_ID });
    await expect(
      runCommand(deps, { command: 'check-realtime', as: 'bank', timeoutMs: 2_000 }),
    ).rejects.toThrow(/check-realtime failed/);

    const subscribes = events.filter((e) => e.startsWith('subscribe:'));
    const removes = events.filter((e) => e.startsWith('remove:'));
    expect(subscribes).toHaveLength(2);
    expect(removes).toHaveLength(2); // one channel failed — BOTH still cleaned
    const firstRemoveIdx = events.findIndex((e) => e.startsWith('remove:'));
    // every subscribe happened before the first removal
    expect(events.slice(0, firstRemoveIdx).filter((e) => e.startsWith('subscribe:'))).toHaveLength(2);
  });
});

// ─── adopt-case / adopt-appetite — read-only manifest registration ──────────

const ADOPTED_CASE_ID = 'd2222222-2222-4222-8222-222222222222';
const ADOPTED_APPETITE_ID = 'e2222222-2222-4222-8222-222222222222';

const adoptCaseArgs: ParsedArgs = { command: 'adopt-case', as: 'advisor', run: RUN, caseFields: { ...CASE_SIGNATURE } as any };
const adoptAppetiteArgs: ParsedArgs = { command: 'adopt-appetite', as: 'bank', run: RUN, appetiteFields: { ...APPETITE_SIGNATURE } as any };

const liveAdoptableCase = (over: Record<string, unknown> = {}) => ({
  id: ADOPTED_CASE_ID,
  advisor_id: ADVISOR_ID,
  ...CASE_SIGNATURE,
  is_approved: false,
  status: 'open',
  created_at: '2999-01-01T00:00:00.000Z',
  ...over,
});

const liveAdoptableAppetite = (over: Record<string, unknown> = {}) => ({
  id: ADOPTED_APPETITE_ID,
  banker_id: BANKER_ID,
  ...APPETITE_SIGNATURE,
  is_approved: false,
  is_active: true,
  created_at: '2999-01-01T00:00:00.000Z',
  ...over,
});

describe('adopt-case / adopt-appetite', () => {
  it('adopts a browser-created case: manifest entry with full provenance, ZERO DB writes', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase()] }));
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    const res: any = await runCommand(deps, adoptCaseArgs);
    expect(res.adopted).toBe(true);
    expect(res.caseId).toBe(ADOPTED_CASE_ID);
    // read-only proof: every Supabase call was a select
    expect(user.calls.length).toBeGreaterThan(0);
    expect(user.calls.every((c: Op) => c.action === 'select')).toBe(true);
    const entry = manifests[RUN].entries.find((e) => e.kind === 'case' && e.id === ADOPTED_CASE_ID)!;
    expect(entry.status).toBe('created');
    expect(entry.note).toContain('adopted');
    expect(entry.provenance).toEqual({ advisor_id: ADVISOR_ID, ...CASE_SIGNATURE });
  });

  it('adopts an appetite comparing list fields as sets (chip order does not matter)', async () => {
    const fields = { ...APPETITE_SIGNATURE, preferred_borrower_types: ['employee', 'self_employed'] };
    const row = liveAdoptableAppetite({ preferred_borrower_types: ['self_employed', 'employee'] });
    const user = fakeClient(() => ({ data: [row] }));
    const { deps, manifests } = makeDeps({ user, userId: BANKER_ID, manifest: createManifest(RUN) });
    const res: any = await runCommand(deps, { ...adoptAppetiteArgs, appetiteFields: fields as any });
    expect(res.adopted).toBe(true);
    expect(user.calls.every((c: Op) => c.action === 'select')).toBe(true);
    const entry = manifests[RUN].entries.find((e) => e.kind === 'appetite' && e.id === ADOPTED_APPETITE_ID)!;
    expect(entry.status).toBe('created');
    // FULL provenance: every matching-relevant field is recorded, not just identity.
    expect(entry.provenance).toEqual({ banker_id: BANKER_ID, ...fields });
  });

  it('accepts PostgREST timestamp style (+00:00, microseconds) and puts the run window in the query', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ created_at: '2999-01-01T00:00:00.123456+00:00' })] }));
    const { deps } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    const res: any = await runCommand(deps, adoptCaseArgs);
    expect(res.adopted).toBe(true);
    const selectOp = user.calls.find((c: Op) => c.table === 'cases')!;
    expect(selectOp.filters).toHaveProperty('created_at:gte');
  });

  it('refuses an unparseable created_at instead of comparing it as a string', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ created_at: 'not-a-timestamp' })] }));
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/unparseable/);
    expect(manifests[RUN].entries).toHaveLength(0);
  });

  it.each([
    ['0 rows', [] as any[]],
    ['2+ rows (ambiguous signature)', [liveAdoptableCase(), liveAdoptableCase({ id: MSG_ID })]],
  ])('refuses adopt-case on %s — no blind pick, nothing recorded', async (_label, rows) => {
    const user = fakeClient(() => ({ data: rows }));
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/exactly 1/);
    expect(manifests[RUN].entries).toHaveLength(0);
  });

  it('refuses a row owned by someone else even if the query returned it (hostile backend)', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ advisor_id: 'someone-else' })] }));
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/not owned/);
    expect(manifests[RUN].entries).toHaveLength(0);
  });

  it('refuses a signature mismatch on the returned row (hostile backend)', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ ltv: 70 })] }));
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/signature mismatch on ltv/);
    expect(manifests[RUN].entries).toHaveLength(0);
  });

  it('refuses an already-approved case and a non-open case', async () => {
    const approved = fakeClient(() => ({ data: [liveAdoptableCase({ is_approved: true })] }));
    const { deps: d1 } = makeDeps({ user: approved, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(d1, adoptCaseArgs)).rejects.toThrow(/already approved/);

    const closed = fakeClient(() => ({ data: [liveAdoptableCase({ status: 'closed' })] }));
    const { deps: d2 } = makeDeps({ user: closed, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(d2, adoptCaseArgs)).rejects.toThrow(/expected "open"/);
  });

  it('refuses appetite rows that are inactive, approved, foreign-owned, or off-signature', async () => {
    const mk = (over: Record<string, unknown>) => {
      const user = fakeClient(() => ({ data: [liveAdoptableAppetite(over)] }));
      return makeDeps({ user, userId: BANKER_ID, manifest: createManifest(RUN) }).deps;
    };
    await expect(runCommand(mk({ is_active: false }), adoptAppetiteArgs)).rejects.toThrow(/not active/);
    await expect(runCommand(mk({ is_approved: true }), adoptAppetiteArgs)).rejects.toThrow(/already approved/);
    await expect(runCommand(mk({ banker_id: 'someone-else' }), adoptAppetiteArgs)).rejects.toThrow(/not owned/);
    await expect(runCommand(mk({ sla_days: 3 }), adoptAppetiteArgs)).rejects.toThrow(/mismatch on sla_days/);
    await expect(runCommand(mk({ preferred_regions: ['north', 'south'] }), adoptAppetiteArgs)).rejects.toThrow(/preferred_regions/);
  });

  it('refuses a same-signature leftover row that predates the run', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ created_at: '2000-01-01T00:00:00.000Z' })] }));
    const { deps, manifests } = makeDeps({ user, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/predates this run/);
    expect(manifests[RUN].entries).toHaveLength(0);
  });

  it('refuses an id that is already recorded in the manifest (duplicate adoption)', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ id: CASE_ID })] }));
    const { deps } = makeDeps({ user, userId: ADVISOR_ID, manifest: seededManifest() });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/already recorded/);
  });

  it('refuses an id already recorded under ANY kind, not just the adopted kind', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase({ id: MATCH_1 })] }));
    const { deps } = makeDeps({ user, userId: ADVISOR_ID, manifest: seededManifest() });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/already recorded/);
  });

  it('refuses once cleanup started or completed — gated BEFORE any client exists', async () => {
    for (const status of ['pending', 'created'] as const) {
      const manifest = createManifest(RUN);
      recordEntry(manifest, { kind: 'cleanup', id: RUN, by: 'service_role', status });
      // makeDeps gets NO user client: reaching userClient would throw a
      // different error, so matching this message proves the gate runs first.
      const { deps } = makeDeps({ manifest });
      await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/cleanup has already started or completed/);
    }
  });

  it('requires an existing manifest for the run (adoption never opens a run)', async () => {
    const { deps } = makeDeps({ user: fakeClient(() => ({ data: [liveAdoptableCase()] })), userId: ADVISOR_ID });
    await expect(runCommand(deps, adoptCaseArgs)).rejects.toThrow(/no manifest for run/);
  });

  const adoptedAppetiteAdmin = (liveOverride: Record<string, unknown>) => {
    let approved = false;
    return fakeClient((op: Op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'branch_appetites' && op.action === 'select') {
        return { data: [liveAdoptableAppetite({ is_approved: approved, ...liveOverride })] };
      }
      if (op.table === 'branch_appetites' && op.action === 'update') {
        approved = true;
        return { data: [liveAdoptableAppetite({ is_approved: true, ...liveOverride })] };
      }
      if (op.table === 'matches') return { data: [] };
      return { data: [] };
    });
  };
  const approveAppetiteArgs: ParsedArgs = {
    command: 'approve', run: RUN, target: 'appetite', id: ADOPTED_APPETITE_ID, expectNewMatches: 0,
  };

  it('an adopted appetite is approvable when the live row still matches the FULL provenance', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableAppetite()] }));
    const admin = adoptedAppetiteAdmin({});
    const { deps, manifests } = makeDeps({ user, admin, userId: BANKER_ID, manifest: createManifest(RUN) });
    await runCommand(deps, adoptAppetiteArgs);
    expect(manifests[RUN].entries[0].provenance).toEqual({ banker_id: BANKER_ID, ...APPETITE_SIGNATURE });
    const res: any = await runCommand(deps, approveAppetiteArgs);
    expect(res.newMatchIds).toEqual([]);
  });

  it.each([
    ['max_ltv changed', { max_ltv: 90 }],
    ['preferred_regions changed', { preferred_regions: ['north', 'south'] }],
    ['preferred_borrower_types changed', { preferred_borrower_types: ['employee'] }],
  ])('approve refuses an adopted appetite whose %s after adoption — zero updates', async (_label, drift) => {
    const user = fakeClient(() => ({ data: [liveAdoptableAppetite()] }));
    const admin = adoptedAppetiteAdmin(drift);
    const { deps } = makeDeps({ user, admin, userId: BANKER_ID, manifest: createManifest(RUN) });
    await runCommand(deps, adoptAppetiteArgs);
    await expect(runCommand(deps, approveAppetiteArgs)).rejects.toThrow(/provenance/);
    expect(admin.calls.some((c: Op) => c.action === 'update')).toBe(false);
  });

  it('cleanup aborts before ANY delete when a matching field of a recorded appetite changed', async () => {
    const admin = statefulAdmin({
      ...LIVE_ROWS,
      branch_appetites: [{ ...LIVE_ROWS.branch_appetites[0], sla_days: 3 }],
    });
    const { deps } = makeDeps({ admin, manifest: seededManifest() });
    await expect(runCommand(deps, cleanupArgs)).rejects.toThrow(/provenance/);
    expect(admin.calls.some((c: Op) => c.action === 'delete')).toBe(false);
  });

  it('an adopted case is immediately approvable: approve accepts the entry and its provenance', async () => {
    const user = fakeClient(() => ({ data: [liveAdoptableCase()] }));
    let approved = false;
    const admin = fakeClient((op) => {
      if (op.action === 'listUsers') return TEST_USERS;
      if (op.table === 'cases' && op.action === 'select') return { data: [liveAdoptableCase({ is_approved: approved })] };
      if (op.table === 'cases' && op.action === 'update') {
        approved = true;
        return { data: [liveAdoptableCase({ is_approved: true })] };
      }
      if (op.table === 'matches') return { data: [] };
      return { data: [] };
    });
    const { deps } = makeDeps({ user, admin, userId: ADVISOR_ID, manifest: createManifest(RUN) });
    await runCommand(deps, adoptCaseArgs);
    const res: any = await runCommand(deps, {
      command: 'approve', run: RUN, target: 'case', id: ADOPTED_CASE_ID, expectNewMatches: 0,
    });
    expect(res.newMatchIds).toEqual([]);
    expect(res.matchesAfter).toBe(0);
  });
});
