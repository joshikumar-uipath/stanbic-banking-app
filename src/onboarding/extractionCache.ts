// ─────────────────────────────────────────────────────────────────────────────
// Remembered reads, held in the module — not in browser storage.
//
// A real IXP read of a scanned pack takes 20s–2min. That is fine in production
// and painful in a demo where the same forms are shown repeatedly. There are two
// ways to be fast, and only one of them is trustworthy:
//
//   1. a PACK in verifiedReads.ts — checked against the page, committed, the
//      same on every machine and every browser. This is the real answer.
//   2. this module — a plain Map, alive for as long as the tab is. It makes a
//      SECOND upload of the same file in the same sitting instant, and it
//      claims nothing beyond that.
//
// This used to persist to localStorage. It no longer does: a demo that depends
// on what a particular browser profile happens to remember is a demo that fails
// on someone else's laptop, in an incognito window, or after a cache clear. If a
// document needs to be reliably fast, it belongs in the code as a pack — call
// packSkeleton() below and paste the result into verifiedReads.ts.
// ─────────────────────────────────────────────────────────────────────────────

interface Entry {
  at: string;
  taxonomy?: string;      // guards against a renamed taxonomy serving stale field names
  result: unknown;
}

/** Lives as long as the page does. Deliberately not persisted. */
const MEMORY = new Map<string, Entry>();
const MAX = 8;            // a demo shows a handful of documents, not a corpus

/** Identify a file by name + size. Deliberately not a content hash: reading the
 *  bytes to hash them costs more than it saves, and two different forms sharing a
 *  name AND an exact byte length is not a case worth designing for here. */
export function fingerprint(file: File): string {
  return `${file.name}::${file.size}`;
}

/** The last real read of this file in this session, when there is one. */
export function rememberedExtraction(key: string, taxonomy?: string): unknown | null {
  const hit = MEMORY.get(key);
  if (!hit) return null;
  // A renamed or extended taxonomy changes the field names, so a read from the
  // previous one would show labels the app no longer maps.
  if (taxonomy && hit.taxonomy && hit.taxonomy !== taxonomy) return null;
  return hit.result ?? null;
}

/** Keep what the case actually returned, newest first. */
export function rememberExtraction(key: string, result: unknown, taxonomy?: string): void {
  if (!key || !result) return;
  MEMORY.delete(key);
  MEMORY.set(key, { at: new Date().toISOString(), taxonomy, result });
  // Map preserves insertion order, so the oldest key is the first one out.
  while (MEMORY.size > MAX) MEMORY.delete(MEMORY.keys().next().value as string);
}

export function forgetExtractions(): void {
  MEMORY.clear();
}

/** Turn a live read into a pack you can commit.
 *
 *  A remembered read disappears when the tab closes, which is the whole reason
 *  not to lean on it. This prints the same values in the shape verifiedReads.ts
 *  expects, so a document that read well once can be pasted into the source and
 *  be right on every machine afterwards. Call it from the console:
 *      window.__aofPack?.()
 */
export function packSkeleton(rows: { group: string; name: string; value: string }[]): string {
  const byGroup = new Map<string, { name: string; value: string }[]>();
  rows.forEach((r) => {
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group)!.push({ name: r.name, value: r.value });
  });
  const q = (s: string) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) ? s : JSON.stringify(s));
  const lines = ['fields: {'];
  byGroup.forEach((fs, g) => {
    lines.push(`  ${q(g)}: {`);
    fs.forEach((f) => lines.push(`    ${q(f.name)}: ${f.value ? JSON.stringify(f.value) : 'null'},`));
    lines.push('  },');
  });
  lines.push('},');
  return lines.join('\n');
}
