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
// per-browser behaviour, never break a capture.
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

async function ds<T = unknown>(method: string, path: string, body?: unknown): Promise<T | null> {
  if (!TOKEN) return null;
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
    if (!res.ok) return null;
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch { return null; }
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

/** Write a record to the shared table, replacing any row already there for it.
 *  Delete-then-insert rather than update: RecordId is unique, and this is the
 *  same shape the link write-through uses. */
export async function pushCase(c: OnboardingCase): Promise<void> {
  if (!TOKEN) return;
  const json = serialise(c);
  if (json.length > 4000) return;                    // unwritable; keep it local
  const key = keyOf(c);
  const existing = rowIdByRecord.get(key);
  if (existing) {
    await ds('POST', `/api/EntityService/${ENTITY}/delete`, [existing]);
    rowIdByRecord.delete(key);
  }
  const row = await ds<{ Id?: string }>('POST', `/api/EntityService/${ENTITY}/insert`, {
    RecordId: key,
    CaseJson: json,
    CaseState: c.state,
    UpdatedAtIso: c.updatedAt ?? '',
  });
  if (row?.Id) rowIdByRecord.set(key, row.Id);
}

export async function deleteCaseRemote(c: Pick<OnboardingCase, 'id' | 'uid'>): Promise<void> {
  if (!TOKEN) return;
  const existing = rowIdByRecord.get(keyOf(c));
  if (!existing) return;
  await ds('POST', `/api/EntityService/${ENTITY}/delete`, [existing]);
  rowIdByRecord.delete(keyOf(c));
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
