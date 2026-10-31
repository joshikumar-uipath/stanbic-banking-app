// ─────────────────────────────────────────────────────────────────────────────
// Shared persistence for application records (Data Service entity `AOFCase`).
//
// The record store is a browser store: `aof_cases` in localStorage. That makes a
// captured application invisible to everyone else — the Maestro case is shared,
// but the record describing it is not. This mirrors real captures into Data
// Fabric so the desk converges across browsers, exactly as the record→instance
// links already do.
//
// TWO THINGS ARE DELIBERATELY NOT SHARED:
//
//  1. Seeded demo records. Every browser generates its own AO-2026-000101… band
//     from SEED_VERSION. Pushing those would put forty near-identical rows in a
//     shared table and, worse, let one browser's demo data overwrite another's.
//     The store marks them and they stay local.
//  2. Anything that would exceed the row. CaseJson is capped at 4000 chars by
//     Data Service; the timeline is the only unbounded part of a record, so it
//     is trimmed rather than letting a write fail silently.
//
// Best-effort throughout: Data Fabric being unreachable must degrade to the old
// per-browser behaviour, never break a capture. But not SILENT: a write that
// does not land is reported (onSyncProblem / 'aof-sync-problem'), kept queued,
// and retried on the next write; 'aof-sync-ok' follows once it lands. Writes to
// one record are serialised, and update the row in place where Data Service
// allows it, so the shared row is never briefly missing.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase } from './types';

const ORG = (import.meta.env.VITE_UIPATH_ORG_NAME as string) || 'mea';
const TENANT = (import.meta.env.VITE_UIPATH_TENANT_NAME as string) || 'DefaultTenant';
const TOKEN = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;

const DS_BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/dataservice_`
  : `https://staging.uipath.com/${ORG}/${TENANT}/dataservice_`;

const ENTITY = 'AOFCase';
const ENTITY_ID = '42c074b2-9e99-f111-9b32-000d3a69a13b';
/** Data Service caps a STRING field at 4000. Leave room for the JSON envelope. */
const JSON_LIMIT = 3900;

/** Fired after a hydrate merges shared records in, so open screens re-read. */
export const CASES_EVENT = 'aof-cases-hydrated';

export const casesShared = (): boolean => Boolean(TOKEN);

/** recordId → Data Fabric row id, learned on hydrate/insert so a later write can
 *  replace the right row without re-querying. */
const rowIdByRecord = new Map<string, string>();

/** The shared table's key. `id` is minted from a per-browser counter and repeats
 *  across browsers, so keying on it makes two unrelated applications collide and
 *  overwrite one another. `uid` is unique; fall back to `id` only for records
 *  written before uid existed, so their rows stay reachable. */
const keyOf = (c: Pick<OnboardingCase, 'id' | 'uid'>): string => c.uid || c.id;

// ── Sync problems ────────────────────────────────────────────────────────────
// A shared write that fails used to vanish: ds() swallowed it and the record was
// silently only on this phone. Now every failure is reported, and the first
// success after a problem says so, so a banner can come and go.

/** window CustomEvent, detail: SyncProblem. */
export const SYNC_PROBLEM_EVENT = 'aof-sync-problem';
/** window CustomEvent, detail: { recordId, outstanding } — a record that had a
 *  problem has now been written. `outstanding` is how many still have one. */
export const SYNC_OK_EVENT = 'aof-sync-ok';

export interface SyncProblem {
  /** The record's display id (AO-2026-000147). */
  recordId: string;
  /** The shared table's key for it (uid, or id on old records). */
  key: string;
  /** 'failed' will be retried on the next write; 'too-large' will not. */
  kind: 'failed' | 'too-large';
  message: string;
}

const problems = new Map<string, SyncProblem>();
const problemListeners = new Set<(p: SyncProblem) => void>();

/** Subscribe to sync problems. Returns an unsubscribe. */
export function onSyncProblem(fn: (p: SyncProblem) => void): () => void {
  problemListeners.add(fn);
  return () => { problemListeners.delete(fn); };
}

/** Records whose latest version is not in the shared table right now. */
export const syncProblems = (): SyncProblem[] => [...problems.values()];

function reportProblem(p: SyncProblem): void {
  problems.set(p.key, p);
  problemListeners.forEach((fn) => { try { fn(p); } catch { /* a listener must not break sync */ } });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_PROBLEM_EVENT, { detail: p }));
}

function reportOk(key: string, recordId: string): void {
  if (!problems.delete(key)) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_OK_EVENT, { detail: { recordId, outstanding: problems.size } }));
  }
}

// ── Transport ────────────────────────────────────────────────────────────────

interface DsFailure { status: number; message: string }
type DsResult<T> = { data: T; fail: null } | { data: null; fail: DsFailure };

/** One Data Service call, with the reason when it fails (no token, network,
 *  non-2xx, bad JSON) so a writer can report it and pick a fallback. */
async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<DsResult<T>> {
  const fail = (status: number, message: string): DsResult<T> => ({ data: null, fail: { status, message } });
  if (!TOKEN) return fail(0, 'Sharing is not configured');
  try {
    const res = await fetch(`${DS_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) return fail(res.status, `Data Service ${res.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
    return { data: (text ? JSON.parse(text) : {}) as T, fail: null };
  } catch (e) {
    return fail(0, e instanceof Error ? e.message : 'Network error');
  }
}

/** The body, or null on any failure. Reads use this; writes use call() and
 *  report what went wrong (see reportProblem). */
async function ds<T = unknown>(method: string, path: string, body?: unknown): Promise<T | null> {
  return (await call<T>(method, path, body)).data;
}

/** The record as it goes on the wire. The timeline is trimmed from the OLD end —
 *  the newest entries are the ones anyone reads. */
function serialise(c: OnboardingCase): string {
  let out = { ...c, timeline: (c.timeline ?? []).slice(0, 12) };
  let json = JSON.stringify(out);
  while (json.length > JSON_LIMIT && (out.timeline?.length ?? 0) > 0) {
    out = { ...out, timeline: out.timeline.slice(0, out.timeline.length - 1) };
    json = JSON.stringify(out);
  }
  return json;
}

/** Find a record's row when we have not learned it (another browser inserted
 *  it, or a hydrate has not run yet). Single-field filter on the query endpoint. */
async function lookupRowId(key: string): Promise<string | null> {
  const body = { filterGroup: { logicalOperator: 0, queryFilters: [{ fieldName: 'RecordId', operator: '=', value: key }], filterGroups: [] } };
  const r = await ds<{ value?: { Id?: string; RecordId?: string }[] }>('POST', `/api/EntityService/entity/${ENTITY_ID}/query`, body);
  const id = r?.value?.find((row) => row?.RecordId === key)?.Id ?? null;
  if (id) rowIdByRecord.set(key, id);
  return id;
}

/** null until tried; false once update-batch has answered 404/405, after which
 *  writes go straight to delete-then-insert. */
let updateSupported: boolean | null = null;

type Fields = { RecordId: string; CaseJson: string; CaseState: string; UpdatedAtIso: string };
type WriteResult = { ok: true } | { ok: false; message: string };

/** Update the row in place (the SDK's Entities.updateRecordsById shape: an
 *  array of records, each carrying its Id). 'gone' = the call worked but the
 *  row was not updated (deleted meanwhile); 'unsupported' = no such endpoint. */
async function updateInPlace(rowId: string, fields: Fields): Promise<{ r: 'ok' | 'gone' | 'unsupported' | 'failed'; message?: string }> {
  type Op = { SuccessRecords?: unknown[]; successRecords?: unknown[]; FailureRecords?: unknown[]; failureRecords?: unknown[] };
  const res = await call<Op>('POST', `/api/EntityService/entity/${ENTITY_ID}/update-batch`, [{ Id: rowId, ...fields }]);
  if (res.fail) {
    if (res.fail.status === 404 || res.fail.status === 405) { updateSupported = false; return { r: 'unsupported' }; }
    return { r: 'failed', message: res.fail.message };
  }
  updateSupported = true;
  const failures = res.data.FailureRecords ?? res.data.failureRecords ?? [];
  const successes = res.data.SuccessRecords ?? res.data.successRecords;
  if (failures.length || (Array.isArray(successes) && successes.length === 0)) return { r: 'gone' };
  return { r: 'ok' };
}

async function insertRow(key: string, fields: Fields): Promise<DsFailure | null> {
  const res = await call<{ Id?: string }>('POST', `/api/EntityService/${ENTITY}/insert`, fields);
  if (res.fail) return res.fail;
  if (res.data.Id) rowIdByRecord.set(key, res.data.Id);
  return null;
}

/** Insert, retrying once after a short pause. */
async function insertWithRetry(key: string, fields: Fields): Promise<DsFailure | null> {
  const first = await insertRow(key, fields);
  if (!first) return null;
  await new Promise((r) => setTimeout(r, 400));
  return insertRow(key, fields);
}

/**
 * Write one record.
 *
 * 1. Known row → update it in place: there is never a moment the shared row is
 *    missing.
 * 2. No known row → insert. A 400 there is the unique RecordId — a row exists
 *    that this browser never learned — so look it up and update that.
 * 3. Only when update-batch is unavailable: delete then insert (RecordId is
 *    unique, so the insert cannot go first), with the insert retried once. If
 *    it still fails, the caller keeps the record queued and the next write puts
 *    the row back.
 */
async function writeRecord(c: OnboardingCase): Promise<WriteResult> {
  const key = keyOf(c);
  const fields: Fields = { RecordId: key, CaseJson: serialise(c), CaseState: c.state, UpdatedAtIso: c.updatedAt ?? '' };
  let rowId = rowIdByRecord.get(key) ?? null;

  if (rowId && updateSupported !== false) {
    const u = await updateInPlace(rowId, fields);
    if (u.r === 'ok') return { ok: true };
    if (u.r === 'failed') return { ok: false, message: u.message ?? 'Update failed' };
    if (u.r === 'gone') { rowIdByRecord.delete(key); rowId = null; }
  }

  if (!rowId) {
    const f = await insertRow(key, fields);
    if (!f) return { ok: true };
    if (f.status !== 400) return { ok: false, message: f.message };
    rowId = await lookupRowId(key);
    if (!rowId) return { ok: false, message: f.message };
    if (updateSupported !== false) {
      const u = await updateInPlace(rowId, fields);
      if (u.r === 'ok') return { ok: true };
      if (u.r === 'failed') return { ok: false, message: u.message ?? 'Update failed' };
      if (u.r === 'gone') { rowIdByRecord.delete(key); return { ok: false, message: 'The shared row changed underneath this write' }; }
    }
  }

  // Replace. A failed delete leaves the old row in place — nothing is lost.
  const del = await call('POST', `/api/EntityService/${ENTITY}/delete`, [rowId]);
  if (del.fail) return { ok: false, message: del.fail.message };
  rowIdByRecord.delete(key);
  const ins = await insertWithRetry(key, fields);
  if (!ins) return { ok: true };
  return { ok: false, message: `the shared row was removed and could not be rewritten (${ins.message})` };
}

// ── Per-record write queue ───────────────────────────────────────────────────
// Writes to one record run one at a time (two quick saves used to interleave
// their delete/insert pairs and could leave two rows, or none). While a write is
// in flight, later saves just replace the queued snapshot, so a burst of edits
// costs one extra write, not one per edit. A record whose write failed stays in
// `retry` and goes again on the next write to ANY record (or when the browser
// comes back online).
const latest = new Map<string, OnboardingCase>();   // newest unsynced snapshot per key
const running = new Map<string, Promise<void>>();  // in-flight drain per key
const retry = new Map<string, OnboardingCase>();    // failed, waiting for the next write

function schedule(key: string): Promise<void> {
  const inflight = running.get(key);
  if (inflight) return inflight;
  const p = (async () => {
    for (;;) {
      const c = latest.get(key);
      if (!c) break;
      latest.delete(key);
      const json = serialise(c);
      if (json.length > 4000) {
        retry.delete(key);
        reportProblem({ recordId: c.id, key, kind: 'too-large', message: `${c.id} is too large to share — kept on this phone only` });
        continue;
      }
      const r = await writeRecord(c);
      if (r.ok) { retry.delete(key); reportOk(key, c.id); continue; }
      // Keep it unless a newer snapshot has arrived meanwhile (that one is next).
      if (!latest.has(key)) retry.set(key, c);
      reportProblem({ recordId: c.id, key, kind: 'failed', message: `${c.id} did not reach the shared record — ${r.message}. It will retry on the next save.` });
      if (!latest.has(key)) break;
    }
  })().finally(() => { running.delete(key); if (latest.has(key)) void schedule(key); });
  running.set(key, p);
  return p;
}

function retryFailed(except?: string): void {
  for (const [k, c] of retry) {
    if (k === except || latest.has(k)) continue;
    retry.delete(k);
    latest.set(k, c);
    void schedule(k);
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => retryFailed());

/** Write a record to the shared table, replacing any row already there for it.
 *  Serialised per record; failures are reported (onSyncProblem /
 *  'aof-sync-problem') and retried on the next write. Resolves once the write
 *  carrying this snapshot (or a newer one) has finished. Never rejects. */
export async function pushCase(c: OnboardingCase): Promise<void> {
  if (!TOKEN) return;
  const key = keyOf(c);
  latest.set(key, c);
  retry.delete(key);
  retryFailed(key);
  await schedule(key);
}

/** Retry every record whose last shared write failed. */
export function retryPendingSync(): void { retryFailed(); }

export async function deleteCaseRemote(c: Pick<OnboardingCase, 'id' | 'uid'>): Promise<void> {
  if (!TOKEN) return;
  const key = keyOf(c);
  // Drop anything queued, then wait out an in-flight write so it cannot
  // re-insert the row after we delete it.
  latest.delete(key);
  retry.delete(key);
  problems.delete(key);
  await running.get(key)?.catch(() => undefined);
  const existing = rowIdByRecord.get(key) ?? await lookupRowId(key);
  if (!existing) return;
  const res = await call('POST', `/api/EntityService/${ENTITY}/delete`, [existing]);
  if (!res.fail) rowIdByRecord.delete(key);
}

interface Row { Id: string; RecordId: string; CaseJson: string; UpdatedAtIso?: string }

/**
 * Every shared record. Uses the query endpoint, not `/read`: that one hard-caps
 * at 100 rows and silently ignores $top/$skip/$filter, so a table past 100 rows
 * reads as truncated with no error. Query has the same 100 cap but at least
 * honours a single-field filter, which is what keeps this usable — only real
 * captures are ever written here, never the seeded demo band.
 */
export async function fetchSharedCases(): Promise<OnboardingCase[]> {
  if (!TOKEN) return [];
  const body = { filterGroup: { logicalOperator: 0, queryFilters: [], filterGroups: [] } };
  const r = await ds<{ value?: Row[] }>('POST', `/api/EntityService/entity/${ENTITY_ID}/query`, body);
  const out: OnboardingCase[] = [];
  for (const row of r?.value ?? []) {
    if (!row?.CaseJson) continue;
    try {
      const c = JSON.parse(row.CaseJson) as OnboardingCase;
      if (!c?.id) continue;
      rowIdByRecord.set(keyOf(c), row.Id);
      out.push(c);
    } catch { /* a hand-edited row must not take the whole hydrate down */ }
  }
  return out;
}
