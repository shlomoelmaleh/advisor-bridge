/**
 * Command handlers for the E2E actor CLI, with injected dependencies so the
 * unit suite drives them against mocked Supabase clients (no network).
 * The safety invariants live here and in actorCore's parsing — actor.ts is
 * only environment wiring.
 *
 * Trust model: the manifest is an editable local JSON file, so it is NEVER
 * sufficient proof of ownership for service_role operations. Every privileged
 * deletion/restore re-derives the trusted anchors (test-account user ids via
 * the auth admin API, the run id from validated args) and re-verifies the
 * LIVE rows against them before mutating anything.
 */
import { ActorError, ActorRole, ParsedArgs } from './actorCore';
import {
  ManifestEntry,
  RunManifest,
  createManifest,
  createdEntries,
  hasRecordedId,
  idsByKind,
  recordEntry,
  unrestoredApprovalChanges,
} from './manifest';

export interface ActorDeps {
  userClient(role: ActorRole): Promise<{ client: any; userId: string }>;
  serviceClient(): any;
  loadManifest(runId: string): RunManifest | null;
  saveManifest(manifest: RunManifest): string;
  genId(): string;
  env: { advisorEmail: string; bankerEmail: string; pendingEmail: string };
}

const nowIso = () => new Date().toISOString();

/** Loud single-row guard: 0 or >1 rows means verification is ambiguous. */
function exactlyOne<T>(rows: T[] | null | undefined, what: string): T {
  if (!rows || rows.length !== 1) {
    throw new ActorError(`verification ambiguous: expected exactly 1 ${what}, got ${rows?.length ?? 0}`);
  }
  return rows[0];
}

function requireManifest(deps: ActorDeps, runId: string): RunManifest {
  const m = deps.loadManifest(runId);
  if (!m) throw new ActorError(`no manifest for run ${runId} — create entities via the actor first`);
  return m;
}

const loadOrCreateManifest = (deps: ActorDeps, runId: string): RunManifest =>
  deps.loadManifest(runId) ?? createManifest(runId);

const pick = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));

const checked = <T extends { data: unknown; error: { message: string } | null }>(res: T, what: string) => {
  if (res.error) throw new ActorError(`${what} failed: ${res.error.message}`);
  return res.data as any;
};

/** Resolve a test account's auth user id by email — the TRUSTED ownership
 *  anchor for privileged verification (comes from env, never the manifest). */
async function resolveUserId(admin: any, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new ActorError(`listUsers failed: ${error.message}`);
  const target = email.toLowerCase();
  const users = ((data?.users ?? []) as Array<{ id: string; email?: string }>).filter(
    (u) => (u.email ?? '').toLowerCase() === target,
  );
  if (users.length !== 1) {
    throw new ActorError(`verification ambiguous: expected exactly 1 auth user for the requested test account, got ${users.length}`);
  }
  return users[0].id;
}

// ─── provenance verification (shared by approve, cleanup, reconciliation) ───
// The manifest is editable JSON, so ownership is always proven against the
// LIVE row using trust anchors that do NOT come from the manifest: test-user
// ids re-resolved via the auth admin API, and the validated --run id.

const CASE_SIGNATURE_KEYS = ['loan_amount_min', 'loan_amount_max', 'ltv', 'borrower_type', 'property_type', 'region'] as const;

function verifyCaseProvenance(row: any, prov: Record<string, unknown>, advisorId: string): void {
  const signatureOk = CASE_SIGNATURE_KEYS.every((k) => prov[k] === row[k]);
  if (row.advisor_id !== advisorId || prov['advisor_id'] !== advisorId || !signatureOk) {
    throw new ActorError('a case row failed provenance verification (owner/signature mismatch) — refusing before any mutation');
  }
}

function verifyAppetiteProvenance(row: any, prov: Record<string, unknown>, bankerId: string, runId: string): void {
  if (
    row.banker_id !== bankerId ||
    prov['banker_id'] !== bankerId ||
    prov['branch_name'] !== row.branch_name ||
    typeof row.branch_name !== 'string' ||
    !row.branch_name.startsWith(runId)
  ) {
    throw new ActorError('an appetite row failed provenance verification (owner/run-id mismatch) — refusing before any mutation');
  }
}

function verifyMessageProvenance(row: any, prov: Record<string, unknown>, advisorId: string, bankerId: string, runId: string): void {
  const testActor = row.sender_id === advisorId || row.sender_id === bankerId;
  if (
    !testActor ||
    prov['sender_id'] !== row.sender_id ||
    prov['match_id'] !== row.match_id ||
    typeof row.content !== 'string' ||
    !row.content.includes(runId)
  ) {
    throw new ActorError('a message row failed provenance verification (sender/match/run-id mismatch) — refusing before any mutation');
  }
}

/** Gate for user-level mutations: the match must be a verified entity of the
 *  ACTIVE run — the actor never touches pre-existing data. Checked before any
 *  client is created. */
function requireManifestMatch(deps: ActorDeps, runId: string, matchId: string): RunManifest {
  const manifest = requireManifest(deps, runId);
  if (!hasRecordedId(manifest, 'match', matchId)) {
    throw new ActorError(`refusing: match id is not recorded (status=created) in the manifest of ${runId}`);
  }
  return manifest;
}

/**
 * Crash-recoverable create: the manifest gets a 'pending' entry (with the
 * locally generated UUID and full provenance) BEFORE the insert, so a crash
 * can never leave DB rows the manifest does not know about.
 */
async function insertWithPendingEntry(opts: {
  deps: ActorDeps;
  runId: string;
  kind: 'case' | 'appetite' | 'message';
  by: string;
  provenance: Record<string, unknown>;
  insert: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  verify: (row: any) => void;
  afterKeys: string[];
}): Promise<{ row: any; manifestFile: string }> {
  const { deps } = opts;
  const id = deps.genId();
  const manifest = loadOrCreateManifest(deps, opts.runId);
  const entry = recordEntry(manifest, {
    kind: opts.kind,
    id,
    by: opts.by,
    status: 'pending',
    provenance: opts.provenance,
  });
  deps.saveManifest(manifest);

  const { data, error } = await opts.insert(id);
  if (error) {
    entry.status = 'failed';
    entry.note = `insert failed: ${error.message}`;
    deps.saveManifest(manifest);
    throw new ActorError(`${opts.kind} insert failed (entry retained as status=failed): ${error.message}`);
  }
  const row = exactlyOne(data, `inserted ${opts.kind} row`);
  if (row.id !== id) throw new ActorError(`${opts.kind} verification failed: returned id differs from the generated id`);
  opts.verify(row);
  entry.status = 'created';
  entry.after = pick(row, opts.afterKeys);
  const manifestFile = deps.saveManifest(manifest);
  return { row, manifestFile };
}

// ─── user-level commands (authenticated, RLS applies) ───────────────────────

async function cmdList(deps: ActorDeps, args: ParsedArgs) {
  const { client } = await deps.userClient(args.as!);
  const own = args.as === 'advisor' ? 'cases' : 'branch_appetites';
  const matches = checked(await client.from('matches').select('*').order('created_at', { ascending: false }), 'list matches');
  const ownRows = checked(await client.from(own).select('*').order('created_at', { ascending: false }), `list ${own}`);
  const matchKeys = ['id', 'case_id', 'appetite_id', 'status', 'advisor_status', 'banker_status', 'score', 'created_at'];
  const ownKeys = ['id', 'is_approved', 'status', 'is_active', 'branch_name', 'loan_amount_min', 'loan_amount_max', 'ltv', 'created_at'];
  return {
    role: args.as,
    matches: (matches ?? []).map((r: any) => pick(r, matchKeys)),
    [own]: (ownRows ?? []).map((r: any) => pick(r, ownKeys)),
  };
}

async function cmdCreateCase(deps: ActorDeps, args: ParsedArgs) {
  const { client, userId } = await deps.userClient('advisor');
  const fields = args.caseFields!;
  const { row, manifestFile } = await insertWithPendingEntry({
    deps,
    runId: args.run!,
    kind: 'case',
    by: 'advisor',
    provenance: { advisor_id: userId, ...fields },
    insert: (id) =>
      client
        .from('cases')
        .insert([{ id, ...fields, priorities: { speed: false, rate: false, ltv: false }, advisor_id: userId, status: 'open' }])
        .select(),
    verify: (r) => {
      for (const [k, v] of Object.entries(fields)) {
        if (r[k] !== v) throw new ActorError(`create-case verification failed: ${k} mismatch after insert`);
      }
      if (r.is_approved !== false) throw new ActorError('create-case verification failed: new case is not pending approval');
    },
    afterKeys: ['is_approved', 'status'],
  });
  return { caseId: row.id, is_approved: row.is_approved, status: row.status, createdAt: row.created_at, manifestFile };
}

async function cmdCreateAppetite(deps: ActorDeps, args: ParsedArgs) {
  const { client, userId } = await deps.userClient('bank');
  const fields = args.appetiteFields!;
  const { row, manifestFile } = await insertWithPendingEntry({
    deps,
    runId: args.run!,
    kind: 'appetite',
    by: 'bank',
    provenance: { banker_id: userId, branch_name: fields.branch_name },
    insert: (id) => client.from('branch_appetites').insert([{ id, ...fields, banker_id: userId, is_active: true }]).select(),
    verify: (r) => {
      if (r.branch_name !== fields.branch_name) throw new ActorError('create-appetite verification failed: branch_name mismatch after insert');
      if (r.is_approved !== false) throw new ActorError('create-appetite verification failed: new appetite is not pending approval');
    },
    afterKeys: ['is_approved', 'is_active'],
  });
  return { appetiteId: row.id, is_approved: row.is_approved, createdAt: row.created_at, manifestFile };
}

async function cmdSendMessage(deps: ActorDeps, args: ParsedArgs) {
  // Manifest gate BEFORE any client/network: only matches of the active run.
  requireManifestMatch(deps, args.run!, args.match!);
  const { client, userId } = await deps.userClient(args.as!);
  const { row, manifestFile } = await insertWithPendingEntry({
    deps,
    runId: args.run!,
    kind: 'message',
    by: args.as!,
    provenance: { sender_id: userId, match_id: args.match },
    insert: (id) => client.from('messages').insert([{ id, match_id: args.match, sender_id: userId, content: args.text }]).select(),
    verify: (r) => {
      if (r.content !== args.text) throw new ActorError('send-message verification failed: content mismatch after insert');
    },
    afterKeys: ['created_at'],
  });
  return { messageId: row.id, matchId: args.match, sentAt: row.created_at, manifestFile };
}

async function cmdSetStatus(deps: ActorDeps, args: ParsedArgs) {
  // Manifest gate BEFORE any client/network: only matches of the active run.
  requireManifestMatch(deps, args.run!, args.match!);
  const { client } = await deps.userClient(args.as!);
  const column = args.as === 'advisor' ? 'advisor_status' : 'banker_status';
  const before = exactlyOne(
    checked(await client.from('matches').select('*').eq('id', args.match), 'set-status before-read'),
    'match row before update (is the user a participant?)',
  ) as any;
  if (before[column] === args.status) {
    throw new ActorError(`refusing no-op: ${column} is already "${args.status}"`);
  }
  const updated = checked(
    await client.from('matches').update({ [column]: args.status }).eq('id', args.match).select(),
    'set-status update',
  );
  const after = exactlyOne(updated, 'updated match row') as any;
  if (after[column] !== args.status) {
    throw new ActorError(`set-status verification failed: ${column} did not change to ${args.status}`);
  }
  const keys = ['status', 'advisor_status', 'banker_status'];
  return { matchId: args.match, column, requested: args.status, before: pick(before, keys), after: pick(after, keys) };
}

// ─── privileged commands (service_role, fixture/setup only) ─────────────────

async function cmdApprove(deps: ActorDeps, args: ParsedArgs) {
  const manifest = requireManifest(deps, args.run!);
  if (!hasRecordedId(manifest, args.target!, args.id!)) {
    throw new ActorError(`refusing approve: ${args.target} id is not recorded (status=created) in the manifest of ${args.run}`);
  }
  const entry = createdEntries(manifest, args.target!).find((e) => e.id === args.id);
  if (!entry?.provenance) {
    throw new ActorError(`refusing approve: the manifest entry for this ${args.target} carries no provenance`);
  }
  const table = args.target === 'case' ? 'cases' : 'branch_appetites';
  const fk = args.target === 'case' ? 'case_id' : 'appetite_id';
  const admin = deps.serviceClient();

  const before = exactlyOne(
    checked(await admin.from(table).select('*').eq('id', args.id), `approve before-read of ${args.target}`),
    `${args.target} row before approve`,
  ) as any;
  // Ownership proof BEFORE any service_role mutation: the live row must belong
  // to the re-resolved test actor and match the recorded signature.
  if (args.target === 'case') {
    const advisorId = await resolveUserId(admin, deps.env.advisorEmail);
    verifyCaseProvenance(before, entry.provenance, advisorId);
  } else {
    const bankerId = await resolveUserId(admin, deps.env.bankerEmail);
    verifyAppetiteProvenance(before, entry.provenance, bankerId, args.run!);
  }
  if (before.is_approved !== false) {
    throw new ActorError(`refusing approve: ${args.target} is already approved (is_approved must be false before approve)`);
  }
  const matchesBefore = checked(
    await admin.from('matches').select('id').eq(fk, args.id),
    'approve before-read of matches',
  ) as Array<{ id: string }>;

  // approve is a lifecycle operation: the entry starts as 'pending' with the
  // EXACT pre-mutation match id list, so a crash anywhere after the update is
  // recoverable by cleanup reconciliation (trigger-created matches can be
  // re-derived and recorded without duplicates).
  const approveEntry = recordEntry(manifest, {
    kind: 'approve',
    id: args.id!,
    by: 'service_role',
    status: 'pending',
    before: {
      target: args.target,
      table,
      fk,
      is_approved: before.is_approved,
      matchIdsBefore: matchesBefore.map((r) => r.id),
      expectNewMatches: args.expectNewMatches,
    },
  });
  deps.saveManifest(manifest);

  const updated = checked(
    await admin.from(table).update({ is_approved: true }).eq('id', args.id).select(),
    'approve update',
  );
  const after = exactlyOne(updated, `${args.target} row after approve`) as any;
  if (after.is_approved !== true) throw new ActorError('approve verification failed: is_approved is not true after update');

  const matchesAfter = checked(
    await admin.from('matches').select('id, case_id, appetite_id').eq(fk, args.id),
    'approve after-read of matches',
  ) as Array<{ id: string; case_id: string; appetite_id: string }>;
  const beforeIds = new Set(matchesBefore.map((r) => r.id));
  const newMatches = matchesAfter.filter((r) => !beforeIds.has(r.id));
  // Record new matches (with provenance) BEFORE the count assertion so cleanup
  // can still remove them when the expectation fails.
  for (const m of newMatches) {
    recordEntry(manifest, {
      kind: 'match',
      id: m.id,
      by: 'trigger',
      status: 'created',
      provenance: { case_id: m.case_id, appetite_id: m.appetite_id },
    });
  }
  // Derivatives are recorded and the lifecycle completes even when the count
  // assertion below fails — cleanup must be able to remove everything.
  approveEntry.status = 'created';
  approveEntry.after = { is_approved: true, matchCount: matchesAfter.length, newMatches: newMatches.length };
  const manifestFile = deps.saveManifest(manifest);

  if (newMatches.length !== args.expectNewMatches) {
    throw new ActorError(
      `approve verification failed: expected ${args.expectNewMatches} new match(es), trigger produced ${newMatches.length} ` +
        '(the approval itself was applied and all new matches are recorded in the manifest)',
    );
  }
  return {
    target: args.target,
    id: args.id,
    approvedAt: nowIso(),
    matchesBefore: matchesBefore.length,
    matchesAfter: matchesAfter.length,
    newMatchIds: newMatches.map((m) => m.id),
    manifestFile,
    note: 'synthetic-admin fixture step: exercises trigger+matching only, proves nothing about admin permissions/RLS/UI',
  };
}

async function cmdSetApproval(deps: ActorDeps, args: ParsedArgs) {
  const admin = deps.serviceClient();
  // Hard-scoped: the pending test account only, resolved via auth admin.
  const userId = await resolveUserId(admin, deps.env.pendingEmail);
  const before = exactlyOne(
    checked(await admin.from('profiles').select('user_id, is_approved, role').eq('user_id', userId), 'set-approval before-read'),
    'pending-user profile before update',
  ) as any;
  if (before.is_approved === args.approved) {
    throw new ActorError(`refusing no-op set-approval: is_approved is already ${args.approved} (no-ops create ambiguous restore chains)`);
  }
  const manifest = loadOrCreateManifest(deps, args.run!);
  // before AND intended are both recorded pre-mutation, so restore can tell a
  // crash-before-update (live===before) from a completed one (live===intended).
  const entry = recordEntry(manifest, {
    kind: 'approval-change',
    id: userId,
    by: 'service_role',
    before: { is_approved: before.is_approved, role: before.role },
    intended: { is_approved: args.approved },
  });
  deps.saveManifest(manifest);

  const updated = checked(
    await admin.from('profiles').update({ is_approved: args.approved }).eq('user_id', userId).select(),
    'set-approval update',
  );
  const after = exactlyOne(updated, 'pending-user profile after update') as any;
  if (after.is_approved !== args.approved) {
    throw new ActorError('set-approval verification failed: is_approved did not change to the requested value');
  }
  entry.after = { is_approved: after.is_approved };
  const manifestFile = deps.saveManifest(manifest);
  return { userId, before: entry.before, after: entry.after, manifestFile };
}

async function cmdRestore(deps: ActorDeps, args: ParsedArgs) {
  const manifest = requireManifest(deps, args.run!);
  const pending = unrestoredApprovalChanges(manifest);
  if (pending.length === 0) return { restored: 0, note: 'no unrestored approval changes in this run' };

  const admin = deps.serviceClient();
  // Re-resolve the ONLY legitimate target; entry ids from the (editable)
  // manifest must all equal it, or nothing is touched.
  const pendingUserId = await resolveUserId(admin, deps.env.pendingEmail);
  for (const entry of pending) {
    if (entry.id !== pendingUserId) {
      throw new ActorError('refusing restore: an approval-change entry does not match the resolved pending test user (tampered manifest?)');
    }
  }

  // ── preflight: the WHOLE chain is validated before the first update, so a
  //    malformed old entry can never be discovered after a newer one was
  //    already restored. The manifest is editable JSON and is_approved is a
  //    nullable column, so every recorded value is type-checked here.
  const VALID_PROFILE_ROLES = ['advisor', 'bank', 'admin'];
  const validated = pending.map((entry) => {
    const before = entry.before as { is_approved?: unknown; role?: unknown } | undefined;
    const intended = entry.intended as { is_approved?: unknown } | undefined;
    if (
      typeof before?.is_approved !== 'boolean' ||
      typeof intended?.is_approved !== 'boolean' ||
      !VALID_PROFILE_ROLES.includes(before?.role as string)
    ) {
      throw new ActorError('refusing restore: recorded before/intended state is malformed (tampered manifest?)');
    }
    return { entry, before: before as { is_approved: boolean; role: string }, intended: intended as { is_approved: boolean } };
  });
  // Chain consistency (chronological order): each change must start from the
  // state the previous change intended to produce.
  for (let i = 1; i < validated.length; i += 1) {
    if (validated[i].before.is_approved !== validated[i - 1].intended.is_approved) {
      throw new ActorError('refusing restore: the approval-change chain is inconsistent (a change does not start from the previous intended state)');
    }
  }

  // ── restore phase: reverse chronological order so stacked set-approval
  //    calls unwind back to the original (oldest) before-state.
  const ordered = [...validated].reverse();
  let applied = 0;
  let skippedNeverApplied = 0;
  let finalState: boolean | undefined;
  for (const { entry, before, intended } of ordered) {
    const current = exactlyOne(
      checked(await admin.from('profiles').select('user_id, is_approved, role').eq('user_id', entry.id), 'restore before-read'),
      'profile row before restore',
    ) as any;
    if (current.role !== before.role) {
      throw new ActorError('refusing restore: profile role differs from the recorded before-state (tampered manifest or wrong account?)');
    }
    if (current.is_approved === before.is_approved) {
      // The set-approval mutation evidently never landed (crash before update).
      entry.restored = true;
      entry.note = 'restore: live state already equals before-state — mutation never applied';
      skippedNeverApplied += 1;
      finalState = before.is_approved;
      deps.saveManifest(manifest);
      continue;
    }
    if (current.is_approved !== intended.is_approved) {
      throw new ActorError('refusing restore: live state matches neither the recorded before nor intended state (external change or corrupt manifest?)');
    }
    const updated = checked(
      await admin.from('profiles').update({ is_approved: before.is_approved }).eq('user_id', entry.id).select(),
      'restore update',
    );
    const after = exactlyOne(updated, 'profile row after restore') as any;
    if (after.is_approved !== before.is_approved) throw new ActorError('restore verification failed: is_approved mismatch');
    entry.restored = true;
    applied += 1;
    finalState = before.is_approved;
    deps.saveManifest(manifest);
  }
  const manifestFile = deps.saveManifest(manifest);
  return { restored: applied + skippedNeverApplied, applied, skippedNeverApplied, finalState, manifestFile };
}

async function cmdCheckRealtime(deps: ActorDeps, args: ParsedArgs) {
  // Authenticated subscriber: Postgres Changes are filtered by the
  // subscriber's RLS read access, so this must run in the same authenticated
  // context the app uses — not anon. Subscription-only; no data is touched.
  const { client } = await deps.userClient(args.as!);
  const tables = ['messages', 'matches'] as const;
  const results: Record<string, { status: string; ms: number }> = {};
  for (const table of tables) {
    const started = Date.now();
    const channel = client
      .channel(`actor-check-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {});
    const status = await new Promise<string>((resolvePromise) => {
      const timer = setTimeout(() => resolvePromise('ACTOR_TIMEOUT'), args.timeoutMs);
      channel.subscribe((s: string) => {
        if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          clearTimeout(timer);
          resolvePromise(s);
        }
      });
    });
    results[table] = { status, ms: Date.now() - started };
    await client.removeChannel(channel);
  }
  const allSubscribed = tables.every((t) => results[t].status === 'SUBSCRIBED');
  if (!allSubscribed) {
    throw new ActorError(`check-realtime failed: ${JSON.stringify(results)} (subscription-only check, no data was touched)`);
  }
  return { role: args.as, subscribed: true, results, timeoutMs: args.timeoutMs };
}

const CLEANUP_TABLES = ['messages', 'matches', 'cases', 'branch_appetites'] as const;
type CleanupPlan = Record<(typeof CLEANUP_TABLES)[number], string[]>;

const KIND_TO_TABLE = { message: 'messages', match: 'matches', case: 'cases', appetite: 'branch_appetites' } as const;

/**
 * Reconciliation: entities stuck in pending/failed (crash or lost response
 * around the insert) are resolved against the LIVE DB before cleanup plans
 * anything. A row that exists must pass full provenance verification and is
 * promoted to 'created' (recovered); a row that does not exist becomes
 * 'resolved-absent'. Any provenance mismatch aborts before any deletion.
 */
async function reconcileStaleEntries(
  deps: ActorDeps,
  admin: any,
  manifest: RunManifest,
  runId: string,
  advisorId: string,
  bankerId: string,
): Promise<{ recovered: number; resolvedAbsent: number; recoveredMatches: number }> {
  let recovered = 0;
  let resolvedAbsent = 0;
  let recoveredMatches = 0;
  for (const kind of ['case', 'appetite', 'message'] as const) {
    const table = KIND_TO_TABLE[kind];
    const stale = manifest.entries.filter(
      (e) => e.kind === kind && (e.status === 'pending' || e.status === 'failed'),
    );
    for (const entry of stale) {
      const rows = checked(await admin.from(table).select('*').eq('id', entry.id), `cleanup reconciliation read of ${table}`) as any[];
      if (!rows || rows.length === 0) {
        entry.status = 'resolved-absent';
        entry.note = 'cleanup reconciliation: no live row for this id — insert never landed or row already gone';
        resolvedAbsent += 1;
        continue;
      }
      const row = exactlyOne(rows, `reconciliation row for a stale ${kind} entry`);
      if (!entry.provenance) {
        throw new ActorError(`refusing cleanup: stale ${kind} entry has no provenance to verify — aborting before any deletion`);
      }
      if (kind === 'case') verifyCaseProvenance(row, entry.provenance, advisorId);
      else if (kind === 'appetite') verifyAppetiteProvenance(row, entry.provenance, bankerId, runId);
      else verifyMessageProvenance(row, entry.provenance, advisorId, bankerId, runId);
      entry.status = 'created';
      entry.note = 'recovered by cleanup reconciliation (insert landed but confirmation was lost)';
      recovered += 1;
    }
  }

  // approve lifecycle reconciliation: a crash between the approve update and
  // recording its trigger-created matches must not orphan those matches (the
  // DB would cascade-delete them, but the manifest and report would be
  // partial and a resumed run could not account for them).
  // Runs AFTER the entity loop so a recovered case/appetite already counts as
  // a verified target here.
  const staleApproves = manifest.entries.filter((e) => e.kind === 'approve' && e.status === 'pending');
  for (const entry of staleApproves) {
    const b = entry.before as { target?: string; matchIdsBefore?: unknown } | undefined;
    const target = b?.target;
    if ((target !== 'case' && target !== 'appetite') || !Array.isArray(b?.matchIdsBefore)) {
      throw new ActorError('refusing cleanup: a pending approve entry is malformed — aborting before any deletion');
    }
    const table = KIND_TO_TABLE[target];
    const fk = target === 'case' ? 'case_id' : 'appetite_id';
    const targetEntry = createdEntries(manifest, target).find((e) => e.id === entry.id);
    if (!targetEntry?.provenance) {
      throw new ActorError('refusing cleanup: a pending approve entry references a target that is not a verified entity of this run — aborting before any deletion');
    }
    const row = exactlyOne(
      checked(await admin.from(table).select('*').eq('id', entry.id), `cleanup approve-reconciliation read of ${table}`) as any[],
      `live ${target} row for a pending approve entry`,
    ) as any;
    if (target === 'case') verifyCaseProvenance(row, targetEntry.provenance, advisorId);
    else verifyAppetiteProvenance(row, targetEntry.provenance, bankerId, runId);

    if (row.is_approved === false) {
      // The privileged update evidently never landed.
      entry.status = 'resolved-absent';
      entry.note = 'cleanup reconciliation: approve mutation never landed (target still unapproved)';
      resolvedAbsent += 1;
      continue;
    }
    if (row.is_approved !== true) {
      throw new ActorError('refusing cleanup: a pending approve entry has an unexpected live target state — aborting before any deletion');
    }
    const matchesNow = checked(
      await admin.from('matches').select('id, case_id, appetite_id').eq(fk, entry.id),
      'cleanup approve-reconciliation read of matches',
    ) as Array<{ id: string; case_id: string; appetite_id: string }>;
    const beforeIds = new Set(b!.matchIdsBefore as string[]);
    for (const m of matchesNow) {
      if ((m as any)[fk] !== entry.id) {
        throw new ActorError('refusing cleanup: a derived match is not linked to the approve target — aborting before any deletion');
      }
      // No duplicates: matches recorded before the crash are left as-is.
      if (beforeIds.has(m.id) || hasRecordedId(manifest, 'match', m.id)) continue;
      recordEntry(manifest, {
        kind: 'match',
        id: m.id,
        by: 'trigger',
        status: 'created',
        provenance: { case_id: m.case_id, appetite_id: m.appetite_id },
        note: 'recovered by cleanup reconciliation (approve crashed before recording derivatives)',
      });
      recoveredMatches += 1;
    }
    entry.status = 'created';
    entry.note = 'recovered by cleanup reconciliation';
    recovered += 1;
  }

  deps.saveManifest(manifest);
  return { recovered, resolvedAbsent, recoveredMatches };
}

async function cmdCleanup(deps: ActorDeps, args: ParsedArgs) {
  const manifest = requireManifest(deps, args.run!);
  const runId = args.run!;
  // alreadyCleaned applies ONLY to a COMPLETED cleanup; a pending journal
  // means a crashed run that must be resumed.
  const journalEntries = manifest.entries.filter((e) => e.kind === 'cleanup');
  const completed = journalEntries.find((e) => e.status === 'created');
  if (completed) {
    return { alreadyCleaned: true, cleanedAt: completed.at, deleted: completed.after, note: 'cleanup already completed for this run — nothing was touched' };
  }
  let journal = journalEntries.find((e) => e.status === 'pending');
  const isResume = journal !== undefined;

  const pendingRestores = unrestoredApprovalChanges(manifest);
  if (pendingRestores.length > 0) {
    throw new ActorError(`refusing cleanup: ${pendingRestores.length} unrestored approval change(s) — run restore first`);
  }

  const admin = deps.serviceClient();
  // Trusted anchors, independent of the manifest.
  const advisorId = await resolveUserId(admin, deps.env.advisorEmail);
  const bankerId = await resolveUserId(admin, deps.env.bankerEmail);

  const reconciliation = await reconcileStaleEntries(deps, admin, manifest, runId, advisorId, bankerId);

  // The plan: on a first run, everything verified-created right now; on a
  // resume, the journaled plan (frozen pre-deletion) plus anything recovered
  // since. Ids missing from the DB are tolerated ONLY when the journaled plan
  // already contains them (i.e. a previous attempt already deleted them).
  const ids = idsByKind(manifest);
  const currentPlan: CleanupPlan = {
    messages: ids['message'],
    matches: ids['match'],
    cases: ids['case'],
    branch_appetites: ids['appetite'],
  };
  const journaledPlan = (isResume ? (journal!.before as { plan?: Partial<CleanupPlan> })?.plan : undefined) ?? {};
  const plan: CleanupPlan = { messages: [], matches: [], cases: [], branch_appetites: [] };
  for (const table of CLEANUP_TABLES) {
    plan[table] = [...new Set([...(journaledPlan[table] ?? []), ...currentPlan[table]])];
  }
  const allowedMissing = new Set(CLEANUP_TABLES.flatMap((t) => journaledPlan[t] ?? []));

  const caseIdSet = new Set(plan.cases);
  const appetiteIdSet = new Set(plan.branch_appetites);

  // ── verification phase: re-read every live row and prove provenance.
  //    Aborts BEFORE anything is deleted.
  const provenanceOf = (kind: 'case' | 'appetite' | 'message', id: string): Record<string, unknown> => {
    const entry = createdEntries(manifest, kind).find((e) => e.id === id);
    if (!entry || !entry.provenance) {
      throw new ActorError(`refusing cleanup: manifest ${kind} entry has no provenance — aborting before any deletion`);
    }
    return entry.provenance;
  };

  const existing: Record<string, string[]> = {};
  for (const table of CLEANUP_TABLES) {
    const tableIds = plan[table];
    if (tableIds.length === 0) {
      existing[table] = [];
      continue;
    }
    const rows = checked(await admin.from(table).select('*').in('id', tableIds), `cleanup verification read of ${table}`) as any[];
    const found = new Set(rows.map((r) => r.id));
    const missing = tableIds.filter((id) => !found.has(id));
    const unexplained = missing.filter((id) => !allowedMissing.has(id));
    if (unexplained.length > 0 || rows.length > tableIds.length) {
      throw new ActorError(`refusing cleanup: ${unexplained.length} ${table} row(s) from the manifest are missing or duplicated — aborting before any deletion`);
    }
    // Every row that still exists must pass provenance verification, resume or not.
    for (const row of rows) {
      if (table === 'cases') verifyCaseProvenance(row, provenanceOf('case', row.id), advisorId);
      else if (table === 'branch_appetites') verifyAppetiteProvenance(row, provenanceOf('appetite', row.id), bankerId, runId);
      else if (table === 'messages') verifyMessageProvenance(row, provenanceOf('message', row.id), advisorId, bankerId, runId);
      else if (!caseIdSet.has(row.case_id) && !appetiteIdSet.has(row.appetite_id)) {
        throw new ActorError('refusing cleanup: a match row is not linked to any case/appetite of this manifest — aborting before any deletion');
      }
    }
    existing[table] = rows.map((r) => r.id);
  }

  // ── journal: the exact plan is frozen and persisted BEFORE the first
  //    deletion, so a crash mid-way is resumable instead of wedged.
  if (!journal) {
    journal = recordEntry(manifest, { kind: 'cleanup', id: runId, by: 'service_role', status: 'pending', before: { plan } });
  } else {
    journal.before = { plan };
  }
  deps.saveManifest(manifest);

  // ── deletion phase: dependency order; only rows that still exist; exact
  //    per-table count verification.
  const deleted: Record<string, number> = {};
  for (const table of CLEANUP_TABLES) {
    const targets = existing[table];
    if (targets.length === 0) {
      deleted[table] = 0;
      continue;
    }
    const rows = checked(await admin.from(table).delete().in('id', targets).select('id'), `cleanup delete on ${table}`) as any[];
    deleted[table] = rows?.length ?? 0;
    if (deleted[table] !== targets.length) {
      throw new ActorError(
        `cleanup verification failed: deleted ${deleted[table]} of ${targets.length} expected ${table} row(s) — journal retained; rerun cleanup to resume`,
      );
    }
  }

  // ── completion: only after every planned id is verified absent.
  for (const table of CLEANUP_TABLES) {
    if (plan[table].length === 0) continue;
    const leftovers = checked(await admin.from(table).select('id').in('id', plan[table]), `cleanup absence check on ${table}`) as any[];
    if (leftovers && leftovers.length > 0) {
      throw new ActorError(`cleanup verification failed: ${leftovers.length} ${table} row(s) still exist after deletion — journal retained; rerun cleanup`);
    }
  }
  journal.status = 'created';
  journal.after = deleted;
  const manifestFile = deps.saveManifest(manifest);
  return {
    runId,
    resumed: isResume,
    reconciliation,
    deleted,
    manifestFile,
    note: 'targeted cleanup: only verified UUIDs recorded in this run manifest were touched',
  };
}

// ─── dispatch ────────────────────────────────────────────────────────────────

const HANDLERS: Record<string, (deps: ActorDeps, args: ParsedArgs) => Promise<unknown>> = {
  'list': cmdList,
  'create-case': cmdCreateCase,
  'create-appetite': cmdCreateAppetite,
  'send-message': cmdSendMessage,
  'set-status': cmdSetStatus,
  'approve': cmdApprove,
  'set-approval': cmdSetApproval,
  'restore': cmdRestore,
  'check-realtime': cmdCheckRealtime,
  'cleanup': cmdCleanup,
};

export const runCommand = (deps: ActorDeps, args: ParsedArgs): Promise<unknown> =>
  HANDLERS[args.command](deps, args);
