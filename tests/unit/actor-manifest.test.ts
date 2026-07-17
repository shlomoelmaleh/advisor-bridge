// Unit tests for the E2E actor run-manifest: persistence, before-state
// recording, approve-gating lookups, and cleanup scoping. Uses a temp dir —
// no env files, no network.
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActorError } from '../e2e/actorCore';
import {
  createManifest,
  hasRecordedId,
  idsByKind,
  loadManifest,
  manifestPath,
  recordEntry,
  saveManifest,
  unrestoredApprovalChanges,
} from '../e2e/manifest';

const RUN = 'E2E-20260717-01-R1';
const CASE_ID = '123e4567-e89b-42d3-a456-426614174000';
const MATCH_ID = '223e4567-e89b-42d3-a456-426614174000';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'actor-manifest-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('run-id gating', () => {
  it.each([
    ['path traversal', '../../E2E-20260717-01-R1'],
    ['wrong shape', 'E2E-2026-R1'],
    ['empty', ''],
    ['embedded separator', 'E2E-20260717-01-R1/x'],
  ])('rejects %s in manifestPath and createManifest', (_label, runId) => {
    expect(() => manifestPath(dir, runId)).toThrow(ActorError);
    expect(() => createManifest(runId)).toThrow(ActorError);
  });

  it('derives the filename from the exact run id', () => {
    expect(manifestPath(dir, RUN).endsWith(`${RUN}.manifest.json`)).toBe(true);
  });
});

describe('persistence', () => {
  it('save/load roundtrip preserves entries', () => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor' });
    saveManifest(dir, m);
    const loaded = loadManifest(dir, RUN)!;
    expect(loaded.runId).toBe(RUN);
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0]).toMatchObject({ kind: 'case', id: CASE_ID, by: 'advisor' });
    expect(loaded.entries[0].at).toBeTruthy();
  });

  it('returns null when no manifest exists for the run', () => {
    expect(loadManifest(dir, RUN)).toBeNull();
  });

  it('creates the reports dir on save', () => {
    const nested = join(dir, 'a', 'b');
    expect(saveManifest(nested, createManifest(RUN))).toContain('.manifest.json');
    expect(loadManifest(nested, RUN)).not.toBeNull();
  });
});

describe('approve gating (hasRecordedId)', () => {
  it('finds only VERIFIED (status=created) ids of the matching kind', () => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status: 'created' });
    expect(hasRecordedId(m, 'case', CASE_ID)).toBe(true);
    expect(hasRecordedId(m, 'appetite', CASE_ID)).toBe(false);
    expect(hasRecordedId(m, 'case', MATCH_ID)).toBe(false);
  });

  it('never gates on pending or failed entries', () => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status: 'pending' });
    recordEntry(m, { kind: 'case', id: MATCH_ID, by: 'advisor', status: 'failed' });
    expect(hasRecordedId(m, 'case', CASE_ID)).toBe(false);
    expect(hasRecordedId(m, 'case', MATCH_ID)).toBe(false);
  });
});

describe('before-state recording', () => {
  it('keeps before-state on privileged entries', () => {
    const m = createManifest(RUN);
    recordEntry(m, {
      kind: 'approval-change',
      id: CASE_ID,
      by: 'service_role',
      before: { is_approved: true },
    });
    saveManifest(dir, m);
    const loaded = loadManifest(dir, RUN)!;
    expect(loaded.entries[0].before).toEqual({ is_approved: true });
  });
});

describe('cleanup scoping (idsByKind)', () => {
  it('groups unique verified UUIDs by kind; drops non-uuid, pending and failed', () => {
    const m = createManifest(RUN);
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status: 'created' });
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor', status: 'created' }); // duplicate
    recordEntry(m, { kind: 'match', id: MATCH_ID, by: 'trigger', status: 'created' });
    recordEntry(m, { kind: 'message', id: 'not-a-uuid', by: 'bank', status: 'created' });
    recordEntry(m, { kind: 'appetite', id: '323e4567-e89b-42d3-a456-426614174000', by: 'bank', status: 'pending' });
    recordEntry(m, { kind: 'appetite', id: '423e4567-e89b-42d3-a456-426614174000', by: 'bank', status: 'failed' });
    const ids = idsByKind(m);
    expect(ids['case']).toEqual([CASE_ID]);
    expect(ids['match']).toEqual([MATCH_ID]);
    expect(ids['message']).toEqual([]);
    expect(ids['appetite']).toEqual([]);
  });
});

describe('restore bookkeeping (unrestoredApprovalChanges)', () => {
  it('lists only approval changes that were not restored', () => {
    const m = createManifest(RUN);
    const a = recordEntry(m, { kind: 'approval-change', id: CASE_ID, by: 'service_role', before: { is_approved: true } });
    recordEntry(m, { kind: 'approval-change', id: MATCH_ID, by: 'service_role', before: { is_approved: false }, restored: true });
    recordEntry(m, { kind: 'case', id: CASE_ID, by: 'advisor' });
    const pending = unrestoredApprovalChanges(m);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toBe(a);
  });
});
