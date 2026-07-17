/**
 * Run-manifest handling for the E2E actor CLI.
 *
 * Every entity the actor creates (and every privileged mutation's before-state)
 * is recorded here. The manifest is the ONLY source of ids that `approve` may
 * touch and that `cleanup` may delete — nothing outside it is ever mutated.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { ActorError, RUN_ID_PATTERN, isUuid } from './actorCore';

export const ENTRY_KINDS = ['case', 'appetite', 'match', 'message', 'approve', 'approval-change', 'cleanup'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Entity lifecycle: 'pending' is written (and saved) BEFORE the DB insert so
 *  a crash between insert and manifest save can never leave untracked data;
 *  'created' after post-insert verification; 'failed' when the insert errored;
 *  'resolved-absent' when cleanup reconciliation proved the row never landed
 *  (or is already gone). Cleanup reconciles pending/failed entries against the
 *  live DB before planning any deletion, so nothing is orphaned forever. */
export type EntryStatus = 'pending' | 'created' | 'failed' | 'resolved-absent';

export interface ManifestEntry {
  kind: EntryKind;
  id: string;
  at: string;
  by: string;
  status?: EntryStatus;
  /** Ownership/signature fields captured at creation time; cleanup re-verifies
   *  them against the LIVE rows (the manifest alone is never trusted). */
  provenance?: Record<string, unknown>;
  before?: unknown;
  /** For privileged mutations: the state the mutation intends to produce,
   *  recorded BEFORE the mutation so restore can disambiguate a crash that
   *  happened before vs after the update. */
  intended?: unknown;
  after?: unknown;
  restored?: boolean;
  note?: string;
}

export interface RunManifest {
  runId: string;
  createdAt: string;
  updatedAt: string;
  entries: ManifestEntry[];
}

export const DEFAULT_REPORTS_DIR = join('tests', 'e2e', 'reports');

/** RUN_ID_PATTERN doubles as a path-traversal guard: the run id becomes the
 *  manifest filename, so anything outside the strict shape is rejected. */
export function manifestPath(baseDir: string, runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new ActorError(`invalid run id "${runId}" (expected e.g. E2E-20260717-01-R1)`);
  }
  return resolve(baseDir, `${runId}.manifest.json`);
}

export function createManifest(runId: string): RunManifest {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new ActorError(`invalid run id "${runId}" (expected e.g. E2E-20260717-01-R1)`);
  }
  const now = new Date().toISOString();
  return { runId, createdAt: now, updatedAt: now, entries: [] };
}

export function loadManifest(baseDir: string, runId: string): RunManifest | null {
  const path = manifestPath(baseDir, runId);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as RunManifest;
  if (parsed.runId !== runId || !Array.isArray(parsed.entries)) {
    throw new ActorError(`manifest at ${path} is corrupt or belongs to a different run`);
  }
  return parsed;
}

export function saveManifest(baseDir: string, manifest: RunManifest): string {
  const path = manifestPath(baseDir, manifest.runId);
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename so a crash mid-write never leaves a truncated manifest.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
  return path;
}

export function recordEntry(
  manifest: RunManifest,
  entry: Omit<ManifestEntry, 'at'> & { at?: string },
): ManifestEntry {
  const full: ManifestEntry = { at: new Date().toISOString(), ...entry };
  manifest.entries.push(full);
  manifest.updatedAt = new Date().toISOString();
  return full;
}

/** Is this id recorded in the manifest as a VERIFIED created entity of this
 *  kind? Pending/failed entries never gate approve or feed cleanup. */
export function hasRecordedId(manifest: RunManifest, kind: EntryKind, id: string): boolean {
  return manifest.entries.some((e) => e.kind === kind && e.id === id && e.status === 'created');
}

/** Entries of a kind that reached 'created' — the only cleanup candidates. */
export function createdEntries(manifest: RunManifest, kind: EntryKind): ManifestEntry[] {
  return manifest.entries.filter((e) => e.kind === kind && e.status === 'created' && isUuid(e.id));
}

/** Unique verified-created UUIDs per kind — the only ids cleanup may delete. */
export function idsByKind(manifest: RunManifest): Record<EntryKind, string[]> {
  const out = Object.fromEntries(ENTRY_KINDS.map((k) => [k, [] as string[]])) as Record<EntryKind, string[]>;
  for (const e of manifest.entries) {
    if (e.status === 'created' && isUuid(e.id) && !out[e.kind].includes(e.id)) out[e.kind].push(e.id);
  }
  return out;
}

/** Privileged approval changes (set-approval) that were never restored —
 *  restore replays these; cleanup refuses to run while any exist. */
export function unrestoredApprovalChanges(manifest: RunManifest): ManifestEntry[] {
  return manifest.entries.filter((e) => e.kind === 'approval-change' && e.restored !== true);
}
