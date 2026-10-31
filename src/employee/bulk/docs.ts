// ─────────────────────────────────────────────────────────────────────────────
// Which documents belong to which application.
//
// The bundle's bytes arrive at intake and are needed much later — on the batch
// monitor, in the customer sheet, beside the extracted fields. They cannot ride
// on the case: the store serialises a case to a 4KB JSON column, and a scanned
// ID is three orders of magnitude past that.
//
// So they live here, in memory, for the session. That is a deliberate limit,
// not an oversight: a reload loses them and the sheet says so rather than
// showing an empty document pane and letting you assume nothing was attached.
// The real fix is the evidence store (BR-DOC-09), which is not built.
// ─────────────────────────────────────────────────────────────────────────────
import type { ViewerDoc } from './DocViewer';

const byCase = new Map<string, ViewerDoc[]>();

export function rememberDocs(caseId: string, docs: ViewerDoc[]): void {
  if (docs.length) byCase.set(caseId, docs);
}

export function docsFor(caseId: string): ViewerDoc[] {
  return byCase.get(caseId) ?? [];
}

/** Whether ANY document in this session has bytes behind it — the sheet uses
 *  this to tell "nothing was attached" apart from "you reloaded the page". */
export const haveAnyDocs = (): boolean => byCase.size > 0;

export function forgetBatch(caseIds: string[]): void {
  for (const id of caseIds) byCase.delete(id);
}
