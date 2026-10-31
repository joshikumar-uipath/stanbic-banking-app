// ─────────────────────────────────────────────────────────────────────────────
// Operations triage, as data — for the analyst's phone app.
//
// The same model the Operations Workbench (public/ops-console.html) runs: an
// exception is filed under ONE root cause (deriveCause), causes become incidents
// with a single bulk fix, and resolving a case clears its failed checks and moves
// it on exactly as that console's resolveStoreCase does — so the desk, the
// customer and the console all see the same outcome.
// ─────────────────────────────────────────────────────────────────────────────
import { store, mockCif, mockAccountNumber, type OnboardingCase, type ValidationKind, type ValidationStatus, type KafkaTopic } from '../onboarding';
import { getLinkedInstance } from '../onboarding/maestro';
import { valOf, slaOf, riskOf } from './derive';
import { getActiveCountry, kycLabel } from '../config/countries';

const CO = getActiveCountry();

export type Cause = 'nimc_timeout' | 'name_mismatch' | 'bvn_check' | 'liveness_low' | 'doc_stale' | 'needs_review';

export interface CauseMeta {
  title: string;
  /** What it means, in a sentence an analyst can act on. */
  detail: string;
  tag: string;
  severity: 'red' | 'orange' | 'gray';
  /** The one fix that clears the whole incident, if there is one. */
  bulk: { label: string; check?: ValidationKind } | null;
  icon: string;
}

export const CAUSES: Record<Cause, CauseMeta> = {
  nimc_timeout: { title: `${CO.secondaryId.authority} gateway timeout`, detail: `Stalled at the ${kycLabel('NIN', CO)} check while the gateway was down. It has recovered — these will pass on a retry.`, tag: 'Infrastructure, not data', severity: 'red', bulk: { label: `Retry ${kycLabel('NIN', CO)} on all`, check: 'NIN' }, icon: 'refresh' },
  name_mismatch: { title: `${kycLabel('NIN', CO)} name mismatch`, detail: `The name on the form differs from ${CO.secondaryId.authority} by a character or two. A person has to decide which is right.`, tag: 'Needs a human call', severity: 'orange', bulk: null, icon: 'user' },
  bvn_check: { title: `${kycLabel('BVN', CO)} did not verify`, detail: `${CO.primaryId.authority} returned no match. Usually a mistyped number — retry, then call the customer.`, tag: 'Needs a customer call', severity: 'red', bulk: { label: `Retry ${kycLabel('BVN', CO)} on all`, check: 'BVN' }, icon: 'idcard' },
  liveness_low: { title: 'Liveness below threshold', detail: 'The selfie scored under 0.60 — poor light, mostly. A fresh selfie usually clears it.', tag: 'Likely retryable', severity: 'orange', bulk: { label: 'Request a new selfie from all', check: 'LIVENESS' }, icon: 'camera' },
  doc_stale: { title: 'Proof of address outstanding', detail: 'Waiting on the applicant. A chaser was sent; no reply yet.', tag: 'Applicant action', severity: 'gray', bulk: { label: 'Re-send the chaser to all' }, icon: 'mail' },
  needs_review: { title: 'Needs a manual review', detail: 'Captured on the desk and stopped for a person to look at.', tag: 'From the branch desk', severity: 'orange', bulk: null, icon: 'eye' },
};

/** Same precedence as the console: the first failing check names the cause. */
export function deriveCause(c: OnboardingCase): Cause {
  const nin = valOf(c, 'NIN'), bvn = valOf(c, 'BVN'), live = valOf(c, 'LIVENESS');
  if (nin === 'timeout') return 'nimc_timeout';
  if (nin === 'failed') return 'name_mismatch';
  if (bvn === 'failed' || bvn === 'timeout') return 'bvn_check';
  if (live === 'failed' || live === 'timeout') return 'liveness_low';
  if (c.state === 'PENDING_DOCUMENTS') return 'doc_stale';
  return 'needs_review';
}

/** What the analyst's queue holds: every case that stopped for a person. */
export const isOpsCase = (c: OnboardingCase) => c.state === 'EXCEPTION';

export interface Incident { cause: Cause; meta: CauseMeta; cases: OnboardingCase[]; breaching: number }

export function incidentsOf(cases: OnboardingCase[]): Incident[] {
  const by = new Map<Cause, OnboardingCase[]>();
  for (const c of cases.filter(isOpsCase)) {
    const k = deriveCause(c);
    by.set(k, [...(by.get(k) ?? []), c]);
  }
  return [...by.entries()]
    .map(([cause, cs]) => ({ cause, meta: CAUSES[cause], cases: cs, breaching: cs.filter((c) => slaOf(c).tone === 'breach').length }))
    .sort((a, b) => b.cases.length - a.cases.length);
}

/** Minutes the case has been open — the queue's urgency order. */
export const ageMin = (c: OnboardingCase) => Math.max(0, Math.round((Date.now() - Date.parse(c.createdAt)) / 60000));

export function ageText(c: OnboardingCase): string {
  const m = ageMin(c);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export function opsHealth(all: OnboardingCase[], stpTarget: number) {
  const open = all.filter(isOpsCase);
  const touched = all.filter((c) => c.state === 'EXCEPTION' || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout')).length;
  const stp = all.length ? Math.round(((all.length - touched) / all.length) * 100) : 0;
  return {
    open: open.length,
    breaching: open.filter((c) => slaOf(c).tone === 'breach').length,
    unassigned: open.filter((c) => !assignee(c)).length,
    highRisk: open.filter((c) => riskOf(c).level === 'high').length,
    stp,
    target: stpTarget,
  };
}

// ── Ownership ────────────────────────────────────────────────────────────────
// Who has a case in Operations. Held on the shared record (`owner`), so a claim
// made on one phone shows on every other. Claims made before the field existed
// were held per device in localStorage; those are still read as a fallback for
// records that have never had an owner written, and are cleared as soon as the
// record gets one.
const OWN_KEY = 'aof_ops_owner';
/** Fired on window after any claim/unclaim (kept for existing listeners). */
export const OWNER_EVENT = 'aof-ops-owner';
export const ME = 'You';

let ownersCache: Record<string, string> | null = null;
function owners(): Record<string, string> {
  if (ownersCache) return ownersCache;
  try { ownersCache = JSON.parse(localStorage.getItem(OWN_KEY) || '{}') as Record<string, string>; } catch { ownersCache = {}; }
  return ownersCache;
}
function writeOwners(o: Record<string, string>): void {
  ownersCache = o;
  try { localStorage.setItem(OWN_KEY, JSON.stringify(o)); } catch { /* unavailable */ }
}
if (typeof window !== 'undefined') {
  // Another tab wrote the legacy map, or someone announced a claim: re-read.
  window.addEventListener('storage', (e) => { if (e.key === OWN_KEY || e.key === null) ownersCache = null; });
  window.addEventListener(OWNER_EVENT, () => { ownersCache = null; });
}

/** Who has the case, or null. The record's own `owner` wins (`''` = nobody). */
export function assignee(c: OnboardingCase): string | null {
  if (c.owner !== undefined) return c.owner || null;
  return owners()[c.id] ?? null;
}

/** Take (or with `who === null`, release) a case. Written to the record, so it
 *  is shared; falls back to a per-device claim only if the record is gone. */
export function claim(id: string, who: string | null): void {
  const local = owners();
  if (id in local) { const o = { ...local }; delete o[id]; writeOwners(o); }
  // store.update applies synchronously (the await inside is only the save), so
  // the record carries the new owner before this returns.
  store.update(id, { owner: who ?? '' }).catch(() => {
    if (!who) return;
    writeOwners({ ...owners(), [id]: who });
    window.dispatchEvent(new Event(OWNER_EVENT));
  });
  window.dispatchEvent(new Event(OWNER_EVENT));
}

// ── Actions — every one writes through the shared store ─────────────────────
const label = (k: ValidationKind) => (k === 'NIN' || k === 'BVN' ? kycLabel(k, CO) : k === 'LIVENESS' ? 'liveness check' : `${k} screening`);
const topicOf = (k: ValidationKind): KafkaTopic => (k === 'NIN' ? 'nin-validation' : k === 'BVN' ? 'bvn-validation' : 'exception-queue');
const isBad = (s: ValidationStatus) => s === 'failed' || s === 'timeout';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

/** What a re-run (or a selfie request) did.
 *  - passed: the check passed and nothing else is failing — the case moved to VALIDATED.
 *  - still-failing: the check was handled but another check still fails; the case stays in EXCEPTION.
 *  - awaiting-customer: a new selfie was asked for; the case is now PENDING_LIVENESS. */
export type RerunResult =
  | { ok: true; outcome: 'passed' | 'still-failing' | 'awaiting-customer' }
  | { ok: false; reason: 'maestro' | 'not-found' | 'not-stuck' | 'error'; message: string };

const MAESTRO_REFUSAL: RerunResult = { ok: false, reason: 'maestro', message: 'This case is running in Maestro — retry it from the case.' };
const notFound = (id: string): RerunResult => ({ ok: false, reason: 'not-found', message: `${id} is no longer in the store — it may have been removed.` });
const errorOf = (e: unknown): RerunResult => ({ ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) });

async function mustGet(id: string): Promise<OnboardingCase> {
  const c = await store.get(id);
  if (!c) throw new Error(`${id} is no longer in the store — it may have been removed.`);
  return c;
}

/**
 * Clear the failed checks and open the account — the console's resolve, for a
 * case a person has decided on. Throws unless the case is still in EXCEPTION
 * (someone else may have resolved, rejected or re-run it since the list loaded).
 */
export async function resolveCase(id: string, how: string): Promise<void> {
  const c = await mustGet(id);
  if (c.state !== 'EXCEPTION') {
    throw new Error(`${id} is no longer with Operations (it is ${c.state.replace(/_/g, ' ').toLowerCase()}) — nothing was changed.`);
  }
  const now = nowIso();
  await store.update(id, {
    validations: c.validations.map((v) => (isBad(v.status)
      ? { ...v, status: 'passed', attempts: v.attempts + 1, updatedAt: now, detail: 'Cleared in Operations' } : v)),
    cif: c.cif ?? mockCif(),
    accountNumber: c.accountNumber ?? mockAccountNumber(),
  });
  await store.advance(id, 'ACCOUNT_CREATED', `Resolved in Operations (${how}) — checks cleared, Finacle account created`);
  claim(id, null);
}

/**
 * Re-run ONE check. Never opens an account: on a pass the case goes back to
 * VALIDATED, which is where an un-orchestrated case rests until someone takes it
 * on (nothing in the store moves VALIDATED forward by itself).
 *
 * A case linked to a live Maestro instance is refused — the orchestration owns
 * its checks, and a local pass would put the record and the case out of step.
 *
 * LIVENESS is not re-run: the same selfie scores the same, so it is routed to
 * requestNewSelfie() and the check is never passed here.
 */
export async function rerunCheck(id: string, kind: ValidationKind): Promise<RerunResult> {
  if (kind === 'LIVENESS') return requestNewSelfie(id);
  try {
    if (getLinkedInstance(id)) return MAESTRO_REFUSAL;
    const c = await store.get(id);
    if (!c) return notFound(id);
    const v = c.validations.find((x) => x.kind === kind);
    if (c.state !== 'EXCEPTION') return { ok: false, reason: 'not-stuck', message: `${id} is no longer with Operations — nothing to re-run.` };
    if (!v || !isBad(v.status)) return { ok: false, reason: 'not-stuck', message: `The ${label(kind)} is not failing on ${id} — nothing to re-run.` };
    const was = v.status;

    await store.update(id, {
      validations: c.validations.map((x) => (x.kind === kind ? { ...x, status: 'retrying', updatedAt: nowIso() } : x)),
    });
    await store.publish(id, topicOf(kind), `${label(kind)} re-run from Operations`);
    await sleep(650);

    // Re-read: the case may have been resolved, rejected or removed meanwhile.
    const after = await store.get(id);
    if (!after) return notFound(id);
    if (after.state !== 'EXCEPTION') {
      // Someone else decided it during the wait. Put the check back as it was
      // rather than leave it spinning on "retrying" for ever.
      if (after.validations.find((x) => x.kind === kind)?.status === 'retrying') {
        await store.update(id, { validations: after.validations.map((x) => (x.kind === kind ? { ...x, status: was } : x)) });
      }
      return { ok: false, reason: 'not-stuck', message: `${id} was moved on by someone else while the check re-ran.` };
    }
    const now = nowIso();
    const validations = after.validations.map((x) => (x.kind === kind
      ? { ...x, status: 'passed' as const, attempts: x.attempts + 1, updatedAt: now, detail: 'Re-run passed' } : x));
    await store.update(id, { validations });
    await store.publish(id, topicOf(kind), `${label(kind)} passed on re-run`);
    if (validations.some((x) => isBad(x.status))) return { ok: true, outcome: 'still-failing' };
    await store.advance(id, 'VALIDATED', 'Checks passed after re-run — continuing');
    return { ok: true, outcome: 'passed' };
  } catch (e) { return errorOf(e); }
}

/**
 * Ask the customer for a fresh selfie. The liveness check is reset to pending —
 * it is never passed here; only a new capture can pass it. When nothing else is
 * failing the case leaves Operations for PENDING_LIVENESS; otherwise it stays
 * in EXCEPTION for the other failure (outcome 'still-failing').
 */
export async function requestNewSelfie(id: string): Promise<RerunResult> {
  try {
    if (getLinkedInstance(id)) return MAESTRO_REFUSAL;
    const c = await store.get(id);
    if (!c) return notFound(id);
    if (c.state !== 'EXCEPTION') return { ok: false, reason: 'not-stuck', message: `${id} is no longer with Operations — no selfie needed.` };
    const live = c.validations.find((x) => x.kind === 'LIVENESS');
    if (!live || !isBad(live.status)) return { ok: false, reason: 'not-stuck', message: `The liveness check is not failing on ${id} — no new selfie needed.` };
    const validations = c.validations.map((x) => (x.kind === 'LIVENESS'
      ? { ...x, status: 'pending' as const, updatedAt: nowIso(), detail: 'New selfie requested' } : x));
    await store.update(id, { validations });
    await store.publish(id, 'customer-notification', 'Asked the customer for a new selfie');
    if (validations.some((x) => isBad(x.status))) return { ok: true, outcome: 'still-failing' };
    await store.advance(id, 'PENDING_LIVENESS', 'Waiting on a new selfie from the customer');
    return { ok: true, outcome: 'awaiting-customer' };
  } catch (e) { return errorOf(e); }
}

/**
 * @deprecated Use rerunCheck() (or requestNewSelfie() for LIVENESS), which
 * report what happened. Kept for old callers: it delegates — so retrying never
 * opens an account any more — and THROWS the refusal message when nothing was
 * done (Maestro-owned, gone, no longer stuck), so a caller cannot report a
 * success that did not happen.
 */
export async function retryCheck(id: string, kind: ValidationKind): Promise<void> {
  const r = await rerunCheck(id, kind);
  if (!r.ok) throw new Error(r.message);
}

export async function escalate(id: string, note = 'Escalated to a supervisor from Operations'): Promise<void> {
  await mustGet(id);
  await store.publish(id, 'exception-queue', note);
  claim(id, 'Supervisor');
}

export async function rejectCase(id: string, reason: string): Promise<void> {
  await mustGet(id);
  await store.advance(id, 'DECLINED', `Rejected in Operations — ${reason}`);
  claim(id, null);
}

export async function chase(id: string): Promise<void> {
  await mustGet(id);
  await store.publish(id, 'customer-notification', 'Chaser re-sent from Operations — complete your application');
}

/** What one bulk run did. `skipped` = no longer stuck, gone, or owned by Maestro. */
export interface IncidentRun {
  done: number;
  skipped: number;
  failed: number;
  results: { id: string; result: 'done' | 'skipped' | 'failed'; outcome?: string; message?: string }[];
}

/**
 * The incident's one fix, applied to every case in it. Each case is re-read
 * first: the incident was built from a list that may be stale, and a case
 * someone else has already cleared is skipped, not processed twice.
 * `onEach(processed, last)` fires after every case.
 */
export async function runIncident(inc: Incident, onEach?: (processed: number, last: IncidentRun['results'][number]) => void): Promise<IncidentRun> {
  const run: IncidentRun = { done: 0, skipped: 0, failed: 0, results: [] };
  const check = inc.meta.bulk?.check;
  for (const listed of inc.cases) {
    let res: IncidentRun['results'][number];
    const c = await store.get(listed.id);
    if (!c || c.state !== 'EXCEPTION') {
      res = { id: listed.id, result: 'skipped', message: c ? 'No longer with Operations' : 'No longer in the store' };
    } else if (check) {
      const r = check === 'LIVENESS' ? await requestNewSelfie(c.id) : await rerunCheck(c.id, check);
      res = r.ok
        ? { id: c.id, result: 'done', outcome: r.outcome }
        : { id: c.id, result: r.reason === 'error' ? 'failed' : 'skipped', outcome: r.reason, message: r.message };
    } else {
      try { await chase(c.id); res = { id: c.id, result: 'done', outcome: 'chased' }; }
      catch (e) { res = { id: c.id, result: 'failed', message: e instanceof Error ? e.message : String(e) }; }
    }
    run[res.result]++;
    run.results.push(res);
    onEach?.(run.results.length, res);
  }
  return run;
}

/** @deprecated Use runIncident(). Same run; returns how many cases it actually
 *  fixed (skipped and failed ones are not counted). `onEach` gets the number
 *  processed so far, so a progress bar still reaches the end. */
export async function runBulk(inc: Incident, onEach?: (done: number) => void): Promise<number> {
  const r = await runIncident(inc, (n) => onEach?.(n));
  return r.done;
}
