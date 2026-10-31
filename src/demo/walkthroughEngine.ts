// ─────────────────────────────────────────────────────────────────────────────
// Local dev only. The walkthrough capture (public/walkthrough/capture) clicks through
// the real screens; between them it runs the case's AUTOMATED steps — what the Maestro
// case's service tasks do in production (validations, the Finacle account, closure) —
// as the same store writes the guided demo story makes (src/demo/story.ts). Every
// surface listens to the store, so Finacle, Kafka, comms and the tower all follow.
//
// Loaded from main.tsx only when import.meta.env.DEV is true; never in a build.
// ─────────────────────────────────────────────────────────────────────────────
import { store, mockCif, mockAccountNumber, type ValidationKind, type ValidationStatus } from '../onboarding';

async function setVals(id: string, patch: Partial<Record<ValidationKind, ValidationStatus>>) {
  const c = await store.get(id);
  if (!c) throw new Error(`walkthrough: no record ${id}`);
  const now = new Date().toISOString();
  await store.update(id, {
    validations: c.validations.map((v) => (patch[v.kind] ? { ...v, status: patch[v.kind]!, attempts: v.attempts + 1, updatedAt: now } : v)),
  });
}

export function expose() {
  (window as unknown as { __aofEngine: unknown }).__aofEngine = {
    /** Verification: NIN, BVN and screening came back clear. */
    verify: async (id: string) => {
      await store.advance(id, 'VALIDATION_IN_PROGRESS', 'Validation started — NIN, BVN and screening running');
      await setVals(id, { NIN: 'passed', BVN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed' });
      await store.advance(id, 'VALIDATED', 'All mandatory validations passed');
    },
    /** Activation: the CIF and account created in Finacle. Returns the account number. */
    account: async (id: string) => {
      await store.update(id, { cif: mockCif(), accountNumber: mockAccountNumber() });
      await store.advance(id, 'ACCOUNT_CREATED', 'Finacle CIF and account created');
      return (await store.get(id))?.accountNumber ?? null;
    },
    /** Closure: liveness passed and the account fully activated. */
    activate: async (id: string) => {
      await setVals(id, { LIVENESS: 'passed' });
      await store.advance(id, 'FULLY_ACTIVATED', 'KYC complete — account fully activated');
    },
  };
}
