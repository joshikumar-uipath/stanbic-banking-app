// The phone's case actions, with an honest result for the toast. A re-run
// passes only the check it re-ran (never opens an account); a case running in
// Maestro is left to Maestro; a case someone else already moved is skipped.
import type { ValidationKind } from '../../onboarding';
import { rerunCheck, requestNewSelfie, chase, type RerunResult } from '../../ops/opsModel';

export interface Tally { passed: number; still: number; asked: number; skipped: number; failed: number; note?: string }

const add = (t: Tally, r: RerunResult) => {
  if (r.ok) { if (r.outcome === 'passed') t.passed++; else if (r.outcome === 'awaiting-customer') t.asked++; else t.still++; }
  else if (r.reason === 'error') { t.failed++; t.note ??= r.message; }
  else { t.skipped++; t.note ??= r.message; }
};

/** Re-run one check (or ask for a new selfie) on each case, one at a time. */
export async function rerunAll(ids: string[], kind: ValidationKind): Promise<Tally> {
  const t: Tally = { passed: 0, still: 0, asked: 0, skipped: 0, failed: 0 };
  for (const id of ids) add(t, kind === 'LIVENESS' ? await requestNewSelfie(id) : await rerunCheck(id, kind));
  return t;
}

/** Log a reminder to each customer (nothing is sent from the demo). */
export async function remindAll(ids: string[]): Promise<Tally> {
  const t: Tally = { passed: 0, still: 0, asked: 0, skipped: 0, failed: 0 };
  for (const id of ids) {
    try { await chase(id); t.asked++; } catch (e) { t.failed++; t.note ??= (e as Error).message; }
  }
  return t;
}

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** One sentence for the toast. */
export function sayTally(t: Tally, what: string): string {
  const parts: string[] = [];
  if (t.passed) parts.push(`${n(t.passed, what)} passed — checks continue`);
  if (t.asked) parts.push(`${n(t.asked, 'customer')} asked`);
  if (t.still) parts.push(`${n(t.still, 'case')} still need${t.still === 1 ? 's' : ''} a person`);
  if (t.skipped) parts.push(`${t.skipped} skipped${t.note && t.skipped === 1 ? ` (${t.note.replace(/\.$/, '')})` : ''}`);
  if (t.failed) parts.push(`${t.failed} failed${t.note ? ` — ${t.note.replace(/\.$/, '')}` : ''}`);
  return parts.join(' · ') || 'Nothing to do';
}
