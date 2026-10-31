// ─────────────────────────────────────────────────────────────────────────────
// Alerts — what changed that a banker should know about, derived from the same
// shared record the rest of the app reads. Nothing here is a canned message:
// a failed check, an SLA about to lapse, a batch ready to authorise, a screening
// hold, an account opened, a gateway outage — each comes from a real case.
//
// Only alerts that need a person carry buttons, and every button does the work
// itself (re-runs the check, re-sends the chaser) or opens where it is done.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase, ValidationKind } from '../../onboarding';
import type { EmployeeRole } from '../../config';
import { slaOf } from '../../ops/derive';
import { getLinkedInstance } from '../../onboarding/maestro';
import { rerunAll, remindAll, sayTally } from './actions';
import { awaitingAuthorisation } from '../bulk/engine';
import type { BatchMeta } from '../bulk/batches';
import type { Route } from './nav';
import { name, storyOf } from './story';
import { telHref } from './links';

export type AlertKind = 'needs' | 'sla' | 'ready' | 'compliance' | 'opened' | 'system';
export type AlertFilter = 'all' | 'needs' | 'customers' | 'system';

/** run resolves to the sentence the toast shows (what actually happened). */
export interface AlertAction { label: string; run?: () => Promise<string>; href?: string; route?: Route }

export interface MAlert {
  id: string;
  kind: AlertKind;
  at: string;
  title: string;
  sub?: string;
  ref?: string;
  /** Where tapping the alert goes. */
  route?: Route;
  actions?: AlertAction[];
}

export const KIND_LABEL: Record<AlertKind, string> = {
  needs: 'Needs you', sla: 'SLA', ready: 'Ready', compliance: 'Compliance', opened: 'Opened', system: 'System',
};

const filterOf: Record<AlertKind, AlertFilter> = {
  needs: 'needs', sla: 'needs', ready: 'needs', compliance: 'customers', opened: 'customers', system: 'system',
};
export const matches = (a: MAlert, f: AlertFilter) => f === 'all' || filterOf[a.kind] === f;
/** The alerts that ask something of you — the tab bar's badge. */
export const actionable = (a: MAlert) => a.kind === 'needs' || a.kind === 'sla' || a.kind === 'ready';

const CHECK_NAME: Partial<Record<ValidationKind, string>> = { BVN: 'BVN', NIN: 'NIN', LIVENESS: 'Selfie' };

/** 10-digit NUBAN as it is read aloud: 3089 4417 25. */
export const nuban = (n?: string) => (n && /^\d{10}$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}` : n ?? '');

export function buildAlerts(all: OnboardingCase[], batches: BatchMeta[], role: EmployeeRole): MAlert[] {
  const out: MAlert[] = [];
  const mine = role === 'rm' ? all.filter((c) => c.source === 'rm' || c.source === 'branch' || !!c.batchId) : all;
  const openRoute = (c: OnboardingCase): Route => (role === 'ops' ? { k: 'opsCase', id: c.id } : { k: 'case', id: c.id });

  // What needs a person — the same lane Today counts as "Need you" (a check
  // that stopped, a form to confirm), less screening holds, which have their own.
  const stuck = mine.filter((c) => storyOf(c).lane === 'you' && c.state !== 'COMPLIANCE_HOLD').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const c of stuck.slice(0, 4)) {
    const v = c.validations.find((x) => x.status === 'failed' || x.status === 'timeout');
    const k = v ? CHECK_NAME[v.kind] ?? v.kind : null;
    const title = c.state === 'AWAITING_EXTRACTION' ? 'Form to confirm'
      : v ? v.status === 'timeout' ? `${k} check timed out` : v.attempts >= 2 ? `${k} failed twice` : `${k} check failed`
      : 'Stopped for a review';
    const actions: AlertAction[] = [];
    // A case running in Maestro is worked from the case, where Maestro's own next step is.
    if (!getLinkedInstance(c.id) && v && (v.kind === 'BVN' || v.kind === 'NIN' || v.kind === 'LIVENESS')) {
      const kind = v.kind;
      actions.push({ label: kind === 'LIVENESS' ? 'Ask for a new selfie' : `Re-run ${k}`, run: async () => sayTally(await rerunAll([c.id], kind), `${k} check`) });
    } else {
      actions.push({ label: 'Open', route: openRoute(c) });
    }
    if (telHref(c.phone)) actions.push({ label: 'Call', href: telHref(c.phone) });
    out.push({ id: `needs-${c.id}`, kind: 'needs', at: c.updatedAt, title, sub: name(c), ref: c.id, route: openRoute(c), actions });
  }
  if (stuck.length > 4) {
    const rest = stuck.length - 4;
    out.push({ id: `needs-more-${stuck.length}`, kind: 'needs', at: stuck[4].updatedAt, title: `${rest} more need${rest === 1 ? 's' : ''} you`, sub: 'Oldest first in your pipeline', route: { k: 'pipeline', lane: 'you' } });
  }

  // Waiting on the customer, and close to (or past) the SLA.
  const waiting = mine.filter((c) => (c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS' || c.state === 'PENDING_CUSTOMER') && slaOf(c).tone !== 'ok' && slaOf(c).has);
  if (waiting.length) {
    const selfie = waiting.filter((c) => c.state === 'PENDING_LIVENESS').length;
    const what = selfie === waiting.length ? 'All waiting on a selfie' : selfie ? `${selfie} waiting on a selfie, ${waiting.length - selfie} on documents` : 'Waiting on documents from the customer';
    const past = waiting.filter((c) => slaOf(c).tone === 'breach').length;
    out.push({
      id: `sla-${waiting.length}`, kind: 'sla', at: waiting.reduce((m, c) => (c.updatedAt > m ? c.updatedAt : m), waiting[0].updatedAt),
      title: past === waiting.length
        ? `${waiting.length} application${waiting.length === 1 ? ' is' : 's are'} past their SLA`
        : `${waiting.length} application${waiting.length === 1 ? '' : 's'} near or past their SLA`,
      sub: what,
      route: { k: 'pipeline', lane: 'customer' },
      actions: [{ label: 'Log reminders', run: async () => `${sayTally(await remindAll(waiting.map((c) => c.id)), 'reminder')} — not sent in this demo` }],
    });
  }

  // A batch confirmed by a maker, ready for the verifier.
  const ready = awaitingAuthorisation(all);
  const byBatch = new Map<string, OnboardingCase[]>();
  for (const c of ready) if (c.batchId) byBatch.set(c.batchId, [...(byBatch.get(c.batchId) ?? []), c]);
  for (const [bid, cs] of byBatch) {
    const b = batches.find((x) => x.id === bid);
    const makers = [...new Set(cs.map((c) => c.reviewedBy).filter(Boolean))] as string[];
    out.push({
      id: `ready-${bid}-${cs.length}`, kind: 'ready', at: cs.reduce((m, c) => ((c.reviewedAt ?? c.updatedAt) > m ? (c.reviewedAt ?? c.updatedAt) : m), cs[0].updatedAt),
      title: `${b?.name ?? 'Bulk batch'}: ${cs.length} account${cs.length === 1 ? '' : 's'} ready to authorise`,
      sub: makers.length ? `Confirmed by ${makers.join(', ')}` : 'Confirmed by a maker',
      route: role === 'verifier' ? { k: 'authorise', batchId: bid } : { k: 'batch', id: bid },
    });
  }

  // A screening hit, with Compliance.
  for (const c of mine.filter((x) => x.state === 'COMPLIANCE_HOLD').slice(0, 3)) {
    out.push({ id: `comp-${c.id}`, kind: 'compliance', at: c.updatedAt, title: 'Possible screening match', sub: `${name(c)}, sent to Compliance`, ref: c.id, route: openRoute(c) });
  }

  // Accounts opened.
  const openedNow = mine.filter((c) => (c.state === 'ACCOUNT_CREATED' || c.state === 'FULLY_ACTIVATED') && c.accountNumber)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  for (const c of openedNow) {
    out.push({ id: `open-${c.id}`, kind: 'opened', at: c.updatedAt, title: `Account opened — ${name(c)}`, sub: `${c.accountType ?? 'Account'} · ${nuban(c.accountNumber)}`, route: openRoute(c) });
  }

  // Gateway trouble — infrastructure, not the customer.
  const nimc = all.filter((c) => c.state === 'EXCEPTION' && c.validations.some((v) => v.kind === 'NIN' && v.status === 'timeout'));
  if (nimc.length) {
    out.push({
      id: `sys-nimc-${nimc.length}`, kind: 'system', at: nimc.reduce((m, c) => (c.updatedAt > m ? c.updatedAt : m), nimc[0].updatedAt),
      title: 'NIMC gateway timeouts',
      sub: `${nimc.length} NIN check${nimc.length === 1 ? '' : 's'} waiting for a retry`,
      actions: role === 'ops' || role === 'rm' ? [{ label: 'Re-run all', run: async () => sayTally(await rerunAll(nimc.map((c) => c.id), 'NIN'), 'NIN check') }] : undefined,
    });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Today / Yesterday / the date. */
export function dayOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

// Read state is a per-device convenience.
const READ_KEY = 'aof_mobile_alerts_read';
export function readIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]') as string[]); } catch { return new Set(); }
}
export function markRead(ids: string[]): void {
  const s = readIds();
  ids.forEach((i) => s.add(i));
  try { localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-400))); } catch { /* unavailable */ }
  window.dispatchEvent(new Event('aof-alerts-read'));
}
