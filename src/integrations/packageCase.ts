// ─────────────────────────────────────────────────────────────────────────────
// A package application, handed to its Maestro case.
//
// In the package flow the fields were read in the browser and CONFIRMED by the
// person in the package review (PackageReview.tsx). The case still runs its own
// "Confirm extracted details" gate — the corporate plan parks on it even with no
// document — and leaving it there made the desk ask for the same confirmation a
// second time, against a sample read. So once the case parks that task, it is
// completed here with what was confirmed — the same Accept, with the same payload,
// the extraction review screen sends. The case then moves on to its next real
// gate. Nothing about IXP changes; this only answers the review task.
// ─────────────────────────────────────────────────────────────────────────────
import * as indiv from '../onboarding/maestro';
import * as corp from '../onboarding/maestro-corporate';
import type { Row } from './packageDocs';

/** Confirm now, from the desk: complete the parked review task with the package's
 *  rows, or say why it could not be done. */
export async function confirmPackageNow(instanceId: string, rows: Row[], corporate: boolean): Promise<string | null> {
  const api = corporate ? corp : indiv;
  const confirmed = rows.filter((r) => r.value).map((r) => ({
    fieldId: r.id, name: r.name, group: r.group, value: r.value, confidence: r.confidence, corrected: false,
  }));
  try {
    const t = await api.findExtractionTask(instanceId);
    if (!t) return (await api.reviewTaskState(instanceId)) === 'done' ? null : 'The case has not parked its review task yet — give it a moment and try again.';
    await api.completeExtractionTask(t.taskId, 'Accept', { confirmed, corrections: [], notes: 'Confirmed in the account-opening package review' });
    return null;
  } catch (e) { return `Maestro did not accept the confirmation: ${(e as Error).message}`; }
}

const POLL_MS = 5000;
const GIVE_UP_MS = 4 * 60_000;

/**
 * Watch a newly started case and complete its extraction review with the
 * package's confirmed rows. Runs in the background; resolves to what happened.
 */
export async function confirmPackageReview(instanceId: string, rows: Row[], corporate: boolean): Promise<'confirmed' | 'no-task' | 'failed'> {
  const api = corporate ? corp : indiv;
  const confirmed = rows.filter((r) => r.value).map((r) => ({
    fieldId: r.id, name: r.name, group: r.group, value: r.value, confidence: r.confidence, corrected: false,
  }));
  const started = Date.now();
  while (Date.now() - started < GIVE_UP_MS) {
    // Done already — nothing to answer. A plan that skips extraction when there is
    // no document (the individual one) never creates the step: stop after a minute.
    let state: 'open' | 'done' | null = null;
    try { state = await api.reviewTaskState(instanceId); } catch { /* keep looking */ }
    if (state === 'done') return 'no-task';
    if (state === null && Date.now() - started > 60_000) return 'no-task';
    try {
      const t = await api.findExtractionTask(instanceId);
      if (t) {
        await api.completeExtractionTask(t.taskId, 'Accept', {
          confirmed, corrections: [], notes: 'Confirmed in the account-opening package review',
        });
        return 'confirmed';
      }
    } catch { return 'failed'; }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return 'no-task';
}
