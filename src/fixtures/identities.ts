// ─────────────────────────────────────────────────────────────────────────────
// Fixture identities — one persona per branch of the §9.1 decision table.
//
// These are INVENTED people with INVENTED identifiers. No real BVN, NIN, RC
// number or TIN appears here, and none of these will resolve against a live
// NIBSS, NIMC, CAC or FIRS endpoint. They exist so every path through the
// process can be demonstrated and tested before the client sends real data.
//
// The design rule: one persona holds open exactly one branch. If you delete
// Halima Sani, nothing exercises the confirmed-watchlist termination any more.
// `auditFixtures()` in ./index.ts re-runs every persona through the real
// `decide()` and tells you when a persona has stopped testing what it claims.
//
// REPLACING THESE WITH REAL DATA
//   Keep the `ref` and `expect` fields. Swap firstName/lastName/dob/bvn/nin/
//   business for the client's values and set `provenance: 'client'`. The
//   scripted outcomes in `script` stay — they are what you want the sandbox to
//   return, not a claim about the real person.
// ─────────────────────────────────────────────────────────────────────────────
import type { FixtureIdentity } from './types';

const addr = (n: number, street: string, city: string) =>
  `${n} ${street}, ${city}, Lagos State`;

/**
 * Sixteen personas. The first six are the volume — they are what a normal
 * submission looks like, and they go straight through or to a maker. The rest
 * are the exceptions, one per branch.
 */
export const IDENTITIES: FixtureIdentity[] = [
  // ── The normal case. Most of any real submission looks like this. ──────────
  {
    ref: 'EVB-001', firstName: 'Adaeze', lastName: 'Okafor', dob: '14/03/1988',
    phone: '08030000101', email: 'adaeze.okafor@payroll.example',
    address: addr(12, 'Marina Rd', 'Lagos'),
    bvn: '22210000101', nin: '10120000101',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'straight-through',
    note: 'The baseline. Everything verifies, every source agrees, savings product so no PND. On the manifest channel this is a straight-through open.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-002', firstName: 'Chidi', lastName: 'Balogun', dob: '02/11/1979',
    phone: '08030000102', email: 'chidi.balogun@payroll.example',
    address: addr(48, 'Awolowo Rd', 'Lagos'),
    bvn: '22210000102', nin: '10120000102',
    entityType: 'Retail EVB', productType: 'Salary',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'straight-through',
    note: 'Second clean one, on a salary product — confirms salary also opens unrestricted.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-003', firstName: 'Ngozi', lastName: 'Eze', dob: '25/07/1992',
    phone: '08030000103', email: 'ngozi.eze@payroll.example',
    address: addr(7, 'Adeola Odeku St', 'Lagos'),
    bvn: '22210000103', nin: '10120000103',
    entityType: 'Sole Trader', productType: 'Current',
    flows: ['bulk', 'corporate'],
    script: {
      bvn: 'pass', nin: 'pass', tin: 'pass', cac: 'not-applicable', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'straight-through',
    note: 'Sole trader on a current account — clean, but opens on PND. This is the persona that proves the PND rule fires on a non-savings product.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-004', firstName: 'Emeka', lastName: 'Nwosu', dob: '30/01/1985',
    phone: '08030000104', email: 'emeka.nwosu@payroll.example',
    address: addr(219, 'Aba Rd', 'Port Harcourt'),
    bvn: '22210000104', nin: '10120000104',
    entityType: 'Business Name', productType: 'Business Current',
    business: {
      name: 'Nwosu Logistics Enterprises', rcNumber: 'BN 2481907', tin: '20481907-0001',
      natureOfBusiness: 'Haulage and freight forwarding', dateOfRegistration: '08/06/2016',
      registeredAddress: addr(219, 'Aba Rd', 'Port Harcourt'),
    },
    flows: ['bulk', 'corporate'],
    script: {
      bvn: 'pass', nin: 'pass', tin: 'pass', cac: 'pass', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'straight-through',
    note: 'Registered business, everything verifies including CAC and FIRS. Opens on PND until the deferral is cleared.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-005', firstName: 'Aisha', lastName: 'Yusuf', dob: '19/09/1990',
    phone: '08030000105', email: 'aisha.yusuf@payroll.example',
    address: addr(64, 'Ahmadu Bello Way', 'Abuja'),
    bvn: '22210000105', nin: '10120000105',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'straight-through',
    note: 'Volume filler. Present so a submission is not six people, four of whom are exceptions.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-006', firstName: 'Tunde', lastName: 'Adeyemi', dob: '11/05/1983',
    phone: '08030000106', email: 'tunde.adeyemi@payroll.example',
    address: addr(3, 'Broad St', 'Lagos'),
    bvn: '22210000106', nin: '10120000106',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'straight-through',
    note: 'Volume filler.',
    provenance: 'demo',
  },

  // ── Identity and registration failures → auto-reject ───────────────────────
  {
    ref: 'EVB-007', firstName: 'Fatima', lastName: 'Bello', dob: '06/12/1994',
    phone: '08030000107', email: 'fatima.bello@payroll.example',
    address: addr(88, 'Ahmadu Bello Way', 'Kano'),
    bvn: '22210000107', nin: '10120000107',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'fail', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'auto-reject',
    note: 'BVN does not verify at NIBSS. Auto-rejected with the reason returned to the submitter — the single most common real rejection.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-008', firstName: 'Blessing', lastName: 'Okoro', dob: '22/02/1991',
    phone: '08030000108', email: 'blessing.okoro@payroll.example',
    address: addr(15, 'Marina Rd', 'Lagos'),
    bvn: '22210000108', nin: '10120000108',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'fail', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'auto-reject',
    note: 'NIN does not verify at NIMC. Separate persona from the BVN failure so the reason text can be checked independently.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-009', firstName: 'Ibrahim', lastName: 'Obi', dob: '17/08/1976',
    phone: '08030000109', email: 'ibrahim.obi@payroll.example',
    address: addr(41, 'Aba Rd', 'Port Harcourt'),
    bvn: '22210000109', nin: '10120000109',
    entityType: 'Business Name', productType: 'Business Current',
    business: {
      name: 'Obi Agro Ventures', rcNumber: 'BN 3910244', tin: '30910244-0001',
      natureOfBusiness: 'Agricultural produce trading', dateOfRegistration: '21/02/2019',
      registeredAddress: addr(41, 'Aba Rd', 'Port Harcourt'),
    },
    flows: ['bulk', 'corporate'],
    script: {
      bvn: 'pass', nin: 'pass', tin: 'fail', cac: 'pass', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'auto-reject',
    note: 'TIN does not verify at FIRS although CAC does. Tests that a registration failure rejects on the corporate path.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-010', firstName: 'Amina', lastName: 'Umeh', dob: '04/04/1987',
    phone: '08030000110', email: 'amina.umeh@payroll.example',
    address: addr(9, 'Awolowo Rd', 'Lagos'),
    bvn: '22210000110', nin: '10120000110',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'fail', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'auto-reject',
    note: 'The identification document itself fails authenticity. Distinct from the identifiers verifying — the number is real, the document is not.',
    provenance: 'demo',
  },

  // ── Reconciliation and PEP → back to the requester ─────────────────────────
  {
    ref: 'EVB-011', firstName: 'Yakubu', lastName: 'Chukwu', dob: '28/10/1981',
    phone: '08030000111', email: 'yakubu.chukwu@payroll.example',
    address: addr(76, 'Ahmadu Bello Way', 'Abuja'),
    bvn: '22210000111', nin: '10120000111',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
      recon: [{
        field: 'Date of birth',
        sources: [
          { name: 'AOP', value: '28/10/1981' },
          { name: 'NIMC response', value: '28/10/1976' },
        ],
      }],
    },
    expect: 'refer-requester',
    note: 'Every check passes but the date of birth disagrees between the form and NIMC. Only the submitting RM can say which is right — §8.4 reconciliation.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-012', firstName: 'Funke', lastName: 'Nwankwo', dob: '13/06/1989',
    phone: '08030000112', email: 'funke.nwankwo@payroll.example',
    address: addr(22, 'Adeola Odeku St', 'Lagos'),
    bvn: '22210000112', nin: '10120000112',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'possible', adverseMedia: 'clear',
      recon: [{
        field: 'Name',
        sources: [
          { name: 'AOP', value: 'Funke Nwankwo' },
          { name: 'NIBSS response', value: 'Funke Adebisi Nwankwo' },
        ],
      }],
    },
    expect: 'refer-requester',
    note: 'A POSSIBLE PEP match plus a middle name present on one source only. The pair is deliberate: this is the persona that proves possible ≠ confirmed and goes to the RM, not to Compliance.',
    provenance: 'demo',
  },

  // ── Screening → Compliance, and termination ────────────────────────────────
  {
    ref: 'EVB-013', firstName: 'Sadiq', lastName: 'Okon', dob: '09/03/1974',
    phone: '08030000113', email: 'sadiq.okon@payroll.example',
    address: addr(55, 'Aba Rd', 'Port Harcourt'),
    bvn: '22210000113', nin: '10120000113',
    entityType: 'Business Name', productType: 'Business Current',
    business: {
      name: 'Okon Maritime Services', rcNumber: 'BN 1772630', tin: '10772630-0001',
      natureOfBusiness: 'Marine logistics', dateOfRegistration: '30/11/2012',
      registeredAddress: addr(55, 'Aba Rd', 'Port Harcourt'),
    },
    flows: ['bulk', 'corporate'],
    script: {
      bvn: 'pass', nin: 'pass', tin: 'pass', cac: 'pass', idDoc: 'pass',
      sanctions: 'possible', watchlist: 'clear', pep: 'clear', adverseMedia: 'possible',
    },
    expect: 'refer-compliance',
    note: 'Sanctions screening returns a possible match, with adverse media alongside it. Only a Compliance Officer may disposition this — no other persona may clear it.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-014', firstName: 'Halima', lastName: 'Sani', dob: '21/12/1980',
    phone: '08030000114', email: 'halima.sani@payroll.example',
    address: addr(30, 'Ahmadu Bello Way', 'Kaduna'),
    bvn: '22210000114', nin: '10120000114',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'confirmed', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'terminate',
    note: 'Confirmed internal watchlist match. The case terminates and is never counted as an opened account — the one persona that exercises the non-completing case exit.',
    provenance: 'demo',
  },

  // ── Service failure → parked ───────────────────────────────────────────────
  {
    ref: 'EVB-015', firstName: 'Obinna', lastName: 'Effiong', dob: '07/07/1993',
    phone: '08030000115', email: 'obinna.effiong@payroll.example',
    address: addr(18, 'Broad St', 'Lagos'),
    bvn: '22210000115', nin: '10120000115',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk', 'individual'],
    script: {
      bvn: 'pass', nin: 'unavailable', idDoc: 'pass', liveness: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'parked',
    note: 'NIMC is down past the retry window. Parks for technical investigation rather than rejecting the customer for the bank\'s outage — this is the persona the 5/15/30/60 retry framework is tested against.',
    provenance: 'demo',
  },

  // ── Liveness, on the individual path ───────────────────────────────────────
  {
    ref: 'EVB-016', firstName: 'Folake', lastName: 'Lawal', dob: '02/02/1996',
    phone: '08030000116', email: 'folake.lawal@payroll.example',
    address: addr(101, 'Awolowo Rd', 'Lagos'),
    bvn: '22210000116', nin: '10120000116',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['individual'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass', liveness: 'fail',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'auto-reject',
    note: 'Liveness capture fails against the document photo. Only reachable on the individual digital journey — a bulk submission has no selfie.',
    provenance: 'demo',
  },

  // ── Broken packages. These never reach the decision table — they are ──────
  // ── bounced at intake with a reason the submitter can act on (§8.1).  ─────
  {
    ref: 'EVB-017', firstName: 'Bashir', lastName: 'Garba', dob: '15/01/1986',
    phone: '08030000117', email: 'bashir.garba@payroll.example',
    address: addr(27, 'Ahmadu Bello Way', 'Kaduna'),
    bvn: '22210000117', nin: '10120000117',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'rejected-at-intake',
    intakeDefect: 'no-id',
    note: 'Folder contains a utility bill but no identification document. Rejected before any verification is attempted — the bank does not spend API calls on an incomplete package.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-018', firstName: 'Segun', lastName: 'Abubakar', dob: '03/09/1990',
    phone: '08030000118', email: 'segun.abubakar@payroll.example',
    address: addr(61, 'Broad St', 'Lagos'),
    bvn: '22210000118', nin: '10120000118',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'rejected-at-intake',
    intakeDefect: 'no-address',
    note: 'Identification document present, no proof of address. Separate persona from EVB-017 so the two rejection reasons can be checked independently.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-019', firstName: 'Hauwa', lastName: 'Idris', dob: '28/04/1993',
    phone: '08030000119', email: 'hauwa.idris@payroll.example',
    address: addr(14, 'Marina Rd', 'Lagos'),
    bvn: '22210000119', nin: '10120000119',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'rejected-at-intake',
    intakeDefect: 'expired-address',
    note: 'Utility bill is dated outside the three-month currency window (BR-DOC-06). A fixable rejection — the submitter re-uploads a current bill.',
    provenance: 'demo',
  },
  {
    ref: 'EVB-020', firstName: 'Musa', lastName: 'Ogundipe', dob: '14/03/1988',
    phone: '08030000120', email: 'musa.ogundipe@payroll.example',
    address: addr(12, 'Marina Rd', 'Lagos'),
    // Deliberately the SAME BVN as EVB-001 Adaeze Okafor.
    bvn: '22210000101', nin: '10120000120',
    entityType: 'Retail EVB', productType: 'Savings',
    flows: ['bulk'],
    script: {
      bvn: 'pass', nin: 'pass', idDoc: 'pass',
      sanctions: 'clear', watchlist: 'clear', pep: 'clear', adverseMedia: 'clear',
    },
    expect: 'rejected-at-intake',
    intakeDefect: 'duplicate',
    note: 'Carries the same BVN as EVB-001 earlier in the same submission. Not fixable by re-uploading — the submitter has to resolve which record is right.',
    provenance: 'demo',
  },
];

/** Keyed by manifest reference. */
export const BY_REF = new Map(IDENTITIES.map((i) => [i.ref, i]));

/**
 * Keyed by the identifiers a service would be called with.
 *
 * First entry wins, deliberately: EVB-020 carries EVB-001's BVN on purpose, to
 * test duplicate detection. A plain `new Map(...)` would let the duplicate
 * overwrite the original and silently break every lookup for Adaeze Okafor.
 */
function firstWins<T>(pairs: [string, T][]): Map<string, T> {
  const m = new Map<string, T>();
  for (const [k, v] of pairs) if (!m.has(k)) m.set(k, v);
  return m;
}

export const BY_BVN = firstWins(IDENTITIES.filter((i) => i.bvn).map((i) => [i.bvn, i] as [string, FixtureIdentity]));
export const BY_NIN = firstWins(IDENTITIES.filter((i) => i.nin).map((i) => [i.nin, i] as [string, FixtureIdentity]));

/** Keyed by lower-cased full name, which is how a document bundle identifies
 *  someone — there is no reference on a scanned page. */
export const BY_NAME = new Map(
  IDENTITIES.map((i) => [`${i.firstName} ${i.lastName}`.toLowerCase(), i]),
);

/**
 * Find the persona a call is about, from whatever the caller happens to hold.
 *
 * Returns `undefined` for anyone not in the fixture set — which is the normal
 * case once real client data arrives, and the reason the engine keeps its
 * deterministic fallback. A fixture miss must never be an error.
 */
export function findIdentity(q: {
  ref?: string; bvn?: string; nin?: string; firstName?: string; lastName?: string;
}): FixtureIdentity | undefined {
  if (q.ref && BY_REF.has(q.ref)) return BY_REF.get(q.ref);
  if (q.bvn && BY_BVN.has(q.bvn)) return BY_BVN.get(q.bvn);
  if (q.nin && BY_NIN.has(q.nin)) return BY_NIN.get(q.nin);
  const name = `${q.firstName ?? ''} ${q.lastName ?? ''}`.trim().toLowerCase();
  if (name && BY_NAME.has(name)) return BY_NAME.get(name);
  return undefined;
}
