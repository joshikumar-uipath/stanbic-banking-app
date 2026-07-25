// ─────────────────────────────────────────────────────────────────────────────
// Guided demo / story mode.
//
// A scripted play that drives ONE fresh case through the whole factory, writing to
// the shared OnboardingStore exactly as the real capture + robots + Ops would. Every
// surface listens to that store — so with /kafka, /finacle, /ops, /employee-web and
// the customer tracker open in other tabs, the case visibly flows across all of them:
//   capture → validation running → an exception in Ops → cleared → Finacle account
//   → KYC link → fully activated.
//
// It's just store writes on timers; nothing here is surface-specific. Returns a
// cancel function so a running story can be stopped.
// ─────────────────────────────────────────────────────────────────────────────
import { store, mockCif, mockAccountNumber, type ValidationKind, type ValidationStatus } from '../onboarding';
import { getActiveCountry } from '../config/countries';

export interface StoryTick {
  /** 1-based index of the step that just ran. */
  i: number;
  total: number;
  /** Human label for the step, in the active market's terms. */
  label: string;
  caseId: string | null;
  done: boolean;
}

async function setVals(id: string, patch: Partial<Record<ValidationKind, ValidationStatus>>) {
  const c = await store.get(id);
  if (!c) return;
  const now = new Date().toISOString();
  await store.update(id, {
    validations: c.validations.map((v) => (patch[v.kind] ? { ...v, status: patch[v.kind]!, attempts: v.attempts + 1, updatedAt: now } : v)),
  });
}

/** Run the guided story. `onTick` fires as each step lands; the returned function
 *  cancels any pending steps. `speed` scales the gaps (1 = default ~11s run). */
export function runStory(onTick: (t: StoryTick) => void, speed = 1): () => void {
  const co = getActiveCountry();
  const first = co.firstNames[3] ?? 'Sam';
  const last = co.lastNames[6] ?? 'Traveller';
  const name = `${first} ${last}`;
  const P = co.primaryId, Sc = co.secondaryId;   // primary = BVN slot, secondary = NIN slot

  let caseId: string | null = null;
  const timers: number[] = [];
  const at = (ms: number, fn: () => void | Promise<void>) => { timers.push(window.setTimeout(() => { void fn(); }, ms * speed)); };

  const steps: { label: string; run: () => Promise<void> }[] = [
    {
      label: `${name} captured on the branch desk`,
      run: async () => {
        const c = await store.create({
          firstName: first, lastName: last,
          phone: `${co.phoneTrunk}${String(4000000 + Math.floor(Math.random() * 900000)).slice(-7)}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
          bvn: `${P.numPrefix}45500123`, nin: `${Sc.numPrefix}67800456`,
          address: `12 ${co.streets[0]}, ${co.cities[0]}`,
          channel: 'self', source: 'rm',
        });
        caseId = c.id;
      },
    },
    {
      label: `Validation started — ${Sc.label}, ${P.label} and screening running`,
      run: async () => {
        if (!caseId) return;
        await store.advance(caseId, 'VALIDATION_IN_PROGRESS', `Validation started — ${Sc.label}, ${P.label} and screening running`);
        await setVals(caseId, { NIN: 'running', BVN: 'running', AML: 'running' });
      },
    },
    {
      label: `${P.label} did not verify with ${P.authority} — routed to Operations`,
      run: async () => {
        if (!caseId) return;
        await setVals(caseId, { NIN: 'passed', BVN: 'failed', AML: 'passed', PEP: 'passed', FRAUD: 'passed' });
        await store.advance(caseId, 'EXCEPTION', `${P.label} did not verify with ${P.authority} — routed to Operations`);
      },
    },
    {
      label: 'Operations cleared the check — Finacle account created',
      run: async () => {
        if (!caseId) return;
        await setVals(caseId, { BVN: 'passed' });
        await store.update(caseId, { cif: mockCif(), accountNumber: mockAccountNumber() });
        await store.advance(caseId, 'ACCOUNT_CREATED', 'Resolved in Operations — checks cleared, Finacle account created');
      },
    },
    {
      label: 'Account open — KYC link sent to the customer',
      run: async () => {
        if (!caseId) return;
        await store.advance(caseId, 'PENDING_LIVENESS', 'Account open — liveness outstanding. KYC link sent by SMS.');
      },
    },
    {
      label: `${name} fully activated`,
      run: async () => {
        if (!caseId) return;
        await setVals(caseId, { LIVENESS: 'passed' });
        await store.advance(caseId, 'FULLY_ACTIVATED', 'KYC complete — account fully activated');
      },
    },
  ];

  const GAP = 1900;   // ms between steps (before speed scaling)
  steps.forEach((s, idx) => {
    at(idx * GAP + 200, async () => {
      await s.run();
      onTick({ i: idx + 1, total: steps.length, label: s.label, caseId, done: idx === steps.length - 1 });
    });
  });

  return () => { timers.forEach((t) => window.clearTimeout(t)); };
}
