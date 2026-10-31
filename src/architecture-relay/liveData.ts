// ─────────────────────────────────────────────────────────────────────────────
// LIVE-DATA SEAM for the architecture relays — left on DEMO mode.
//
// Each relay plays its journey's own `cases` (./journeys/*.ts) and says so with
// a "demo cases" chip, so all three run the same way with no token and no tenant.
// The relays themselves make no tenant calls. (main.tsx loads
// src/onboarding/maestro.ts on every route regardless, and that module seeds
// AOFMaestroLink on load — see HANDOVER.md — but that is the app's, not these
// pages'.)
//
// To go live later, per journey: make `useLiveCases` read `store.list()` plus the
// linked instance states — maestro.ts for individual, maestro-corporate.ts for
// corporate; the kit's own version of this file shows the shape — and have
// `findCaseTaskId` return the instance's pending task id. Bulk has no case system
// of its own to read yet: its batches live in localStorage and its BPMN is not
// deployed.
// ─────────────────────────────────────────────────────────────────────────────

// The case record the relay renders. `Status` is one of the journey's own stage
// labels, which is how the "Live (where it is now)" marker finds its stage.
export interface OnboardingCase {
  Id: string;
  CaseRef: string;
  ApplicantName: string;
  Status: string;
  ApprovalStatus: string;     // e.g. 'Pending' — the stage's gate is open
  MaestroInstanceId?: string; // present → shown first in the picker
  [k: string]: unknown;
}

// The relay never touches an SDK directly; it only passes this through.
export type UiPath = unknown;

/** DEMO: the picker lists the journey's own cases. `live` false shows the chip. */
export function useLiveCases(fallback: OnboardingCase[]): { cases: OnboardingCase[]; live: boolean } {
  return { cases: fallback, live: false };
}

/** DEMO: a demo instance id has no real task behind it, so no deep link. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- LIVE mode's signature
export async function findCaseTaskId(_sdk: UiPath, _instanceId: string, _ref?: string): Promise<number | null> {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- LIVE mode's signature
export function actionCenterTaskUrl(_sdk: UiPath, _taskId: number): string {
  return '';
}

/** Per-label text overrides (e.g. renaming a product per customer). None today. */
export function useLabelOverrides(): Record<string, string> {
  return {};
}
