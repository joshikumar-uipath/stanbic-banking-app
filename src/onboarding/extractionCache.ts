// ─────────────────────────────────────────────────────────────────────────────
// Remembered reads, so a document already seen paints immediately.
//
// A real IXP read of a scanned pack takes 20s–2min — fine in production, painful
// in a demo where the same two forms are shown repeatedly and the audience waits
// on a spinner. The result is keyed to the FILE, so:
//
//   • a form seen before renders at once, from the last real read of that file
//   • a form never seen before still waits for the live extraction
//
// This is a display accelerator, not a substitute for the case. The instance is
// started either way, the live poll keeps running underneath, and whatever the
// case returns replaces the cached copy — so a stale entry self-corrects rather
// than persisting. Nothing is ever confirmed from cache alone: completing the
// review still writes to the real task.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'aof_extraction_cache';
const MAX = 8;                       // a demo shows a handful of documents, not a corpus

interface Entry {
  k: string;                         // file fingerprint
  at: string;
  taxonomy?: string;                 // guards against a renamed taxonomy serving stale field names
  result: unknown;
}

/** Identify a file by name + size. Deliberately not a content hash: reading the
 *  bytes to hash them costs more than it saves, and two different forms sharing a
 *  name AND an exact byte length is not a case worth designing for here. */
export function fingerprint(file: File): string {
  return `${file.name}::${file.size}`;
}

function read(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Entry[]; } catch { return []; }
}
function write(list: Entry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* quota */ }
}

/** The last real read of this file, when there is one. */
export function rememberedExtraction(key: string, taxonomy?: string): unknown | null {
  const hit = read().find((e) => e.k === key);
  if (!hit) return null;
  // A renamed or extended taxonomy changes the field names, so a read from the
  // previous one would show labels the app no longer maps.
  if (taxonomy && hit.taxonomy && hit.taxonomy !== taxonomy) return null;
  return hit.result ?? null;
}

/** Keep what the case actually returned, newest first. */
export function rememberExtraction(key: string, result: unknown, taxonomy?: string): void {
  if (!key || !result) return;
  const list = read().filter((e) => e.k !== key);
  list.unshift({ k: key, at: new Date().toISOString(), taxonomy, result });
  write(list);
}

export function forgetExtractions(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
