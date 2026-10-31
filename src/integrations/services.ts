// ─────────────────────────────────────────────────────────────────────────────
// Typed service wrappers.
//
// The rest of the app calls these, not `call()` directly. Each one knows how to
// build its request and how to read its answer, so when a contract changes the
// change lands here and nowhere else.
//
// The scripted persona decides WHICH fixture branch comes back. Someone not in
// the fixture set — which is every real customer once client data arrives — gets
// `undefined` from `findIdentity` and the caller falls back to its own
// deterministic behaviour. A fixture miss is normal, never an error.
// ─────────────────────────────────────────────────────────────────────────────
import { call, type CallResult } from './client';
import { findIdentity, type CheckOutcome, type FixtureIdentity, type ScreenOutcome } from '../fixtures';

/** Map a scripted outcome onto the fixture variant that represents it. */
function variantFor(o: CheckOutcome | undefined) {
  switch (o) {
    case 'fail': return 'noMatch' as const;
    case 'timeout': return 'timeout' as const;
    case 'unavailable': return 'unavailable' as const;
    default: return 'ok' as const;
  }
}

function screenVariant(worst: ScreenOutcome) {
  return worst === 'confirmed' ? ('confirmed' as const)
    : worst === 'possible' ? ('possible' as const)
    : ('ok' as const);
}

export interface Subject {
  ref?: string;
  firstName?: string;
  lastName?: string;
  bvn?: string;
  nin?: string;
  dob?: string;
  business?: { name: string; rcNumber: string; tin: string };
}

/** The persona behind a subject, if we have one. */
export function personaFor(s: Subject): FixtureIdentity | undefined {
  return findIdentity(s);
}

export interface CheckResult extends CallResult {
  outcome: CheckOutcome;
}

function asCheck(r: CallResult, scripted: CheckOutcome | undefined): CheckResult {
  const outcome: CheckOutcome = scripted
    ?? (r.ok ? 'pass' : r.status === 504 ? 'timeout' : r.status === 503 ? 'unavailable' : 'fail');
  return { ...r, outcome };
}

export async function verifyBvn(s: Subject): Promise<CheckResult> {
  const p = personaFor(s);
  const r = await call('bvn', { bvn: s.bvn, requestRef: s.ref }, { want: variantFor(p?.script.bvn) });
  return asCheck(r, p?.script.bvn);
}

export async function verifyNin(s: Subject): Promise<CheckResult> {
  const p = personaFor(s);
  // A reconciliation mismatch is carried on the NIN response, because NIMC is
  // the source that most often disagrees with the form.
  const want = p?.script.recon?.length && p.script.nin === 'pass'
    ? ('possible' as const) : variantFor(p?.script.nin);
  const r = await call('nin', { nin: s.nin, requestRef: s.ref }, { want });
  return asCheck(r, p?.script.nin);
}

export async function verifyCac(s: Subject): Promise<CheckResult> {
  const p = personaFor(s);
  if (p && p.script.cac === 'not-applicable') {
    return {
      ok: true, variant: 'ok', status: 200, simulated: true, service: 'cac', latencyMs: 0,
      body: { status: 'not_applicable', message: 'Not a registered entity — CAC does not apply' },
      outcome: 'not-applicable',
    };
  }
  const r = await call('cac', {
    rcNumber: s.business?.rcNumber ?? p?.business?.rcNumber,
    companyName: s.business?.name ?? p?.business?.name,
  }, { want: variantFor(p?.script.cac) });
  return asCheck(r, p?.script.cac);
}

export async function verifyTin(s: Subject): Promise<CheckResult> {
  const p = personaFor(s);
  const r = await call('tin', {
    tin: s.business?.tin ?? p?.business?.tin,
    rcNumber: s.business?.rcNumber ?? p?.business?.rcNumber,
  }, { want: variantFor(p?.script.tin) });
  return asCheck(r, p?.script.tin);
}

export async function verifyIdDocument(s: Subject): Promise<CheckResult> {
  const p = personaFor(s);
  const r = await call('idDoc', {
    documentType: 'NATIONAL_ID', imageRef: `dsx://${s.ref ?? 'unknown'}/national-id.jpg`,
  }, { want: variantFor(p?.script.idDoc) });
  return asCheck(r, p?.script.idDoc);
}

export async function checkLiveness(s: Subject): Promise<CheckResult> {
  const p = personaFor(s);
  const r = await call('liveness', {
    selfieRef: `dsx://${s.ref ?? 'unknown'}/selfie.jpg`,
    documentPortraitRef: `dsx://${s.ref ?? 'unknown'}/national-id.jpg`,
  }, { want: variantFor(p?.script.liveness) });
  return asCheck(r, p?.script.liveness);
}

export interface ScreeningResult extends CallResult {
  sanctions: ScreenOutcome;
  watchlist: ScreenOutcome;
  pep: ScreenOutcome;
  adverseMedia: ScreenOutcome;
}

/** One call covering all four Actimize screening types, as the real engine does. */
export async function screenCustomer(s: Subject): Promise<ScreeningResult> {
  const p = personaFor(s);
  const sc = p?.script;
  const worst: ScreenOutcome =
    sc?.watchlist === 'confirmed' || sc?.sanctions === 'confirmed' ? 'confirmed'
    : sc?.sanctions === 'possible' || sc?.pep === 'possible' || sc?.watchlist === 'possible' || sc?.adverseMedia === 'possible' ? 'possible'
    : 'clear';

  const r = await call('screening', {
    requestId: s.ref,
    screeningType: ['SANCTIONS', 'WATCHLIST', 'PEP', 'ADVERSE_MEDIA'],
    subject: {
      fullName: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
      dateOfBirth: s.dob, nationality: 'NG', idNumber: s.bvn,
    },
  }, { want: screenVariant(worst) });

  return {
    ...r,
    sanctions: sc?.sanctions ?? 'clear',
    watchlist: sc?.watchlist ?? 'clear',
    pep: sc?.pep ?? 'clear',
    adverseMedia: sc?.adverseMedia ?? 'clear',
  };
}

export interface AccountResult extends CallResult {
  accountNumber: string | null;
  cif: string | null;
  /** False when the service recognised this as a repeat — BR-PROV-04. */
  created: boolean;
}

export async function createAccount(o: {
  ref: string; firstName: string; lastName: string; bvn?: string; nin?: string;
  productCode: string; branchCode: string; postNoDebit: boolean;
}): Promise<AccountResult> {
  const r = await call('coreBanking', {
    requestRef: o.ref, customerRef: o.ref,
    customer: { firstName: o.firstName, lastName: o.lastName, bvn: o.bvn, nin: o.nin },
    productCode: o.productCode, branchCode: o.branchCode, currency: 'NGN',
    postNoDebit: o.postNoDebit,
  }, { want: 'ok' });

  const data = (r.body as { data?: { accountNumber?: string; cif?: string; created?: boolean } }).data;
  return {
    ...r,
    accountNumber: data?.accountNumber ?? null,
    cif: data?.cif ?? null,
    created: data?.created !== false,
  };
}

export async function raisePostKycCase(o: { ref: string; accountNumber: string; cif: string }) {
  return call('omniflow', {
    caseType: 'POST_KYC_REVIEW', customerRef: o.ref,
    accountNumber: o.accountNumber, cif: o.cif,
    openedVia: 'BULK_ACCOUNT_OPENING', evidenceRef: `dsx://${o.ref}/`,
  }, { want: 'ok' });
}

export async function pushEvidence(o: { ref: string; accountNumber?: string; documents: { name: string; kind: string }[] }) {
  return call('dsx', {
    customerRef: o.ref, accountNumber: o.accountNumber, documents: o.documents,
  }, { want: 'ok' });
}

export async function extractDocument(o: { ref: string; taxonomy: 'individual' | 'corporate' }) {
  return call('ixp', {
    documentRef: `dsx://${o.ref}/account-opening-form.pdf`, taxonomy: o.taxonomy,
  }, { want: 'ok' });
}
