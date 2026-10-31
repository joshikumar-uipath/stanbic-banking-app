// ─────────────────────────────────────────────────────────────────────────────
// Maker handle time (BR-DOC-13): how long each extraction review took, from the
// application opening on the review screen to Approve or Flag. Kept in this
// browser — it measures the reviewer at this desk, and the worklist shows the
// average against the BRD's five-minute target.
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'aof_handle_times';
/** The BRD's target average handle time for an Ops review. */
export const HANDLE_TARGET_MS = 5 * 60_000;

export interface HandleTime { id: string; ms: number; at: string; by: string; outcome: 'approved' | 'flagged' }

export function handleTimes(): HandleTime[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as HandleTime[]; } catch { return []; }
}

export function recordHandleTime(t: HandleTime): void {
  // Ignore an accidental double-submit and a tab left open overnight: neither is
  // how long the review took.
  if (t.ms < 1_000 || t.ms > 60 * 60_000) return;
  const all = [t, ...handleTimes()].slice(0, 500);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full */ }
}

export function averageHandleMs(): { avg: number; n: number } {
  const all = handleTimes();
  return { avg: all.length ? Math.round(all.reduce((s, x) => s + x.ms, 0) / all.length) : 0, n: all.length };
}

export const mmss = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;

/** Close the clock on one review that started at `startedAt` (epoch ms). */
export function finishReview(id: string, startedAt: number, by: string, outcome: HandleTime['outcome']): void {
  recordHandleTime({ id, ms: Date.now() - startedAt, at: new Date().toISOString(), by, outcome });
}
