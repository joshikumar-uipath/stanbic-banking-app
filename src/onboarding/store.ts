// ─────────────────────────────────────────────────────────────────────────────
// OnboardingStore — the single data interface every surface reads & writes.
//
// The skeleton ships MockOnboardingStore (localStorage + in-memory subscribers,
// seeded demo cases). Later, a UiPathOnboardingStore implements the SAME
// interface backed by Data Fabric / Orchestrator / Finacle — the UI never
// changes. Import the shared singleton `store` everywhere.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  OnboardingCase, OnboardingState, NewCaseInput, DuplicateOutcome,
  CaseEvent, KafkaTopic, ValidationResult, ValidationKind, ValidationStatus,
} from './types';
import { VALIDATION_KINDS, fullName } from './types';
import { nextApplicationId, setApplicationSeq, kycToken, uid, mockCif, mockAccountNumber } from './ids';
import { getActiveCountry } from '../config/countries';

export interface ListFilter {
  state?: OnboardingState | OnboardingState[];
  channel?: OnboardingCase['channel'];
  batchId?: string;
  search?: string;            // matches name / id / phone / bvn / nin
}

export type StoreListener = () => void;

export interface OnboardingStore {
  list(filter?: ListFilter): Promise<OnboardingCase[]>;
  get(id: string): Promise<OnboardingCase | undefined>;
  getByKycToken(token: string): Promise<OnboardingCase | undefined>;
  create(input: NewCaseInput): Promise<OnboardingCase>;
  update(id: string, patch: Partial<OnboardingCase>): Promise<OnboardingCase>;
  /** Drop a record and its events entirely. Local only — it does not reach any
   *  case, account or task the record refers to. Callers own those consequences. */
  remove(id: string): Promise<void>;
  advance(id: string, state: OnboardingState, message?: string): Promise<OnboardingCase>;
  checkDuplicate(input: Pick<NewCaseInput, 'bvn' | 'nin' | 'phone'>): Promise<DuplicateOutcome>;
  publish(caseId: string, topic: KafkaTopic, message: string, payload?: Record<string, unknown>): Promise<void>;
  events(): Promise<CaseEvent[]>;      // global event log, newest first (drives the mock Kafka console)
  subscribe(listener: StoreListener): () => void;
}

// ── Mock implementation ──────────────────────────────────────────────────────
const CASES_KEY = 'aof_cases';
const EVENTS_KEY = 'aof_events';
const SEED_VERSION_KEY = 'aof_seed_v';
const SEED_VERSION = '13';  // bump to force a reseed when the demo data changes
const SEED_AT_KEY = 'aof_seed_at';   // wall-clock of the last seed, for staleness
const SEED_COUNTRY_KEY = 'aof_seed_country';   // market the current seed was localised to
// Seeded cases freeze their createdAt at seed time, so "opened 2h ago" drifts to
// "opened 3d ago" once the seed sits overnight. A new demo sitting should start
// with fresh ages — so if the last seed is older than this, reseed on load.
const SEED_STALE_AFTER_MS = 12 * 60 * 60 * 1000;   // 12h
const nowIso = () => new Date().toISOString();

const emptyValidations = (): ValidationResult[] =>
  VALIDATION_KINDS.map((kind: ValidationKind) => ({ kind, status: 'pending', attempts: 0, updatedAt: nowIso() }));

class MockOnboardingStore implements OnboardingStore {
  private cases: OnboardingCase[] = [];
  private log: CaseEvent[] = [];
  private listeners = new Set<StoreListener>();

  constructor() {
    this.load();
    let v: string | null = null;
    let seededAt = 0;
    let seededCountry: string | null = null;
    try {
      v = localStorage.getItem(SEED_VERSION_KEY);
      seededAt = Number(localStorage.getItem(SEED_AT_KEY)) || 0;
      seededCountry = localStorage.getItem(SEED_COUNTRY_KEY);
    } catch { /* ignore */ }
    // Reseed when: never seeded, the seed shape changed, the admin switched the
    // market (country differs), OR the seed has gone stale (last seeded > 12h ago
    // — a new sitting, so refresh the ages). A stale/country reseed also resets any
    // in-session resolutions, which is intended: it means a new demo, not a
    // continuation. Within a session, same country, nothing is touched.
    const activeCountry = getActiveCountry().code;
    const stale = seededAt > 0 && Date.now() - seededAt > SEED_STALE_AFTER_MS;
    if (this.cases.length === 0 || v !== SEED_VERSION || seededCountry !== activeCountry || stale) {
      this.cases = []; this.log = [];
      try {
        localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
        localStorage.setItem(SEED_AT_KEY, String(Date.now()));
        localStorage.setItem(SEED_COUNTRY_KEY, activeCountry);
      } catch { /* ignore */ }
      seed(this);
    }

    // Cross-document sync. The Operations Workbench runs in a same-origin iframe
    // (/ops-console.html) and shares this localStorage. A `storage` event fires
    // only in *other* documents than the one that wrote — so when Ops resolves a
    // case, this parent window hears it here, reloads, and re-renders every desk
    // and customer subscriber. The reverse (desk → Ops) is symmetric: Ops listens
    // for the same event on its side.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== CASES_KEY && e.key !== EVENTS_KEY && e.key !== null) return;
        this.load();
        this.emit();
      });
    }
  }

  // ── persistence ──
  private load() {
    try {
      this.cases = JSON.parse(localStorage.getItem(CASES_KEY) || '[]');
      this.log = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    } catch { this.cases = []; this.log = []; }
  }
  private save() {
    try {
      localStorage.setItem(CASES_KEY, JSON.stringify(this.cases));
      localStorage.setItem(EVENTS_KEY, JSON.stringify(this.log.slice(0, 300)));
    } catch { /* ignore quota / unavailable */ }
    this.emit();
  }
  private emit() { this.listeners.forEach((l) => l()); }

  subscribe(listener: StoreListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // ── reads ──
  async list(filter?: ListFilter): Promise<OnboardingCase[]> {
    let out = [...this.cases].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (filter?.state) {
      const states = Array.isArray(filter.state) ? filter.state : [filter.state];
      out = out.filter((c) => states.includes(c.state));
    }
    if (filter?.channel) out = out.filter((c) => c.channel === filter.channel);
    if (filter?.batchId) out = out.filter((c) => c.batchId === filter.batchId);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      out = out.filter((c) =>
        [c.id, fullName(c), c.phone, c.bvn, c.nin, c.email].some((v) => v.toLowerCase().includes(q)));
    }
    return out;
  }
  async get(id: string) { return this.cases.find((c) => c.id === id); }
  async getByKycToken(token: string) { return this.cases.find((c) => c.kycToken === token); }
  async events() { return [...this.log].sort((a, b) => (a.at < b.at ? 1 : -1)); }

  // ── writes ──
  async remove(id: string): Promise<void> {
    this.cases = this.cases.filter((c) => c.id !== id);
    // Its events go too, otherwise the Kafka console keeps replaying a case that
    // no longer exists and the log can never be reconciled against the desk.
    this.log = this.log.filter((e) => e.caseId !== id);
    this.save();
    this.emit();
  }

  async create(input: NewCaseInput): Promise<OnboardingCase> {
    const duplicate = await this.checkDuplicate(input);
    const now = nowIso();
    const c: OnboardingCase = {
      id: nextApplicationId(),
      firstName: input.firstName, lastName: input.lastName,
      entity: input.entity,
      phone: input.phone, email: input.email, bvn: input.bvn, nin: input.nin,
      address: input.address, employer: input.employer,
      channel: input.channel ?? 'single',
      source: input.source ?? 'rm',
      // A corporate upload creates the record before the wizard is finished, so the
      // running case is visible on the desk rather than invisible until submit.
      state: input.state ?? 'PRE_REGISTERED',
      duplicate,
      validations: emptyValidations(),
      batchId: input.batchId,
      documentId: input.documentId,
      documentName: input.documentName,
      // The rest of the application form, when the capture collected it.
      title: input.title, middleName: input.middleName, dob: input.dob,
      gender: input.gender, maritalStatus: input.maritalStatus,
      motherMaidenName: input.motherMaidenName, nationality: input.nationality,
      stateOfOrigin: input.stateOfOrigin,
      idType: input.idType, idNumber: input.idNumber, idExpiry: input.idExpiry, tin: input.tin,
      altPhone: input.altPhone, city: input.city, stateOfResidence: input.stateOfResidence,
      lga: input.lga, yearsAtAddress: input.yearsAtAddress,
      employmentStatus: input.employmentStatus, occupation: input.occupation,
      incomeBand: input.incomeBand, sourceOfFunds: input.sourceOfFunds,
      accountType: input.accountType, accountPurpose: input.accountPurpose, branch: input.branch,
      nextOfKin: input.nextOfKin,
      kycToken: kycToken(),
      createdAt: now, updatedAt: now,
      timeline: [],
    };
    this.cases.unshift(c);
    this.save();
    await this.publish(c.id, 'account-opening-requested', `Application received for ${fullName(c)}`, { channel: c.channel });
    return c;
  }

  async update(id: string, patch: Partial<OnboardingCase>): Promise<OnboardingCase> {
    const c = this.cases.find((x) => x.id === id);
    if (!c) throw new Error(`Case ${id} not found`);
    Object.assign(c, patch, { updatedAt: nowIso() });
    this.save();
    return c;
  }

  async advance(id: string, state: OnboardingState, message?: string): Promise<OnboardingCase> {
    const c = await this.update(id, { state });
    const topic: KafkaTopic =
      state === 'ACCOUNT_CREATED' ? 'account-created' :
      state === 'EXCEPTION' ? 'exception-queue' :
      state === 'VALIDATION_IN_PROGRESS' ? 'account-creation-requested' :
      'customer-notification';
    await this.publish(id, topic, message ?? `State → ${state}`);
    return c;
  }

  async checkDuplicate(input: Pick<NewCaseInput, 'bvn' | 'nin' | 'phone'>): Promise<DuplicateOutcome> {
    const hitExact = this.cases.some((c) => c.bvn === input.bvn && c.nin === input.nin);
    if (hitExact) return 'existing';
    const hitPartial = this.cases.some((c) => c.bvn === input.bvn || c.nin === input.nin || c.phone === input.phone);
    return hitPartial ? 'potential-duplicate' : 'new';
  }

  async publish(caseId: string, topic: KafkaTopic, message: string, payload?: Record<string, unknown>) {
    const ev: CaseEvent = { id: uid('ev'), caseId, topic, message, at: nowIso(), payload };
    this.log.unshift(ev);
    const c = this.cases.find((x) => x.id === caseId);
    if (c) c.timeline.unshift(ev);
    this.save();
  }
}

// ── Seed cases across the whole lifecycle so every Ops queue has content ──────
interface SeedRow extends NewCaseInput {
  state: OnboardingState;
  agoMin: number;                                   // minutes ago the case was created
  vals?: Partial<Record<ValidationKind, ValidationStatus>>;
  account?: boolean;                                // has a Finacle CIF + account
}

const BEYOND_VALIDATION: OnboardingState[] = ['VALIDATED', 'ACCOUNT_CREATED', 'PENDING_DOCUMENTS', 'PENDING_LIVENESS', 'FULLY_ACTIVATED'];

// All seeded people/addresses/IDs are drawn from the active country's profile
// (config/countries.ts) so switching market in the admin relocalises the whole
// account-opening pipeline. The KYC engine still runs on internal BVN/NIN keys.
type SeedCtx = ReturnType<typeof getActiveCountry>;

const seedFirst = (co: SeedCtx, n: number) => co.firstNames[n % co.firstNames.length];
const seedLast = (co: SeedCtx, n: number) => co.lastNames[(n * 7 + 3) % co.lastNames.length];
const seedPhone = (co: SeedCtx, n: number) => `${co.phoneTrunk}${String(2000000 + n).slice(-7)}`;
// numPrefix is 4 chars for NG (BVN 2221 / NIN 1012); a 7-digit body makes the total 11 —
// the correct length for a Nigerian BVN/NIN. (Shorter prefixes for other markets shift down.)
const seedPrimaryId = (co: SeedCtx, n: number) => `${co.primaryId.numPrefix}${String(2000000 + n).slice(-7)}`;
const seedSecondaryId = (co: SeedCtx, n: number) => `${co.secondaryId.numPrefix}${String(3000000 + n).slice(-7)}`;
const seedAddr = (co: SeedCtx, n: number) =>
  `${(n % 60) + 1} ${co.streets[n % co.streets.length]}, ${co.cities[n % co.cities.length]}`;

// Filler for the payroll batches. A real bulk upload is tens of people, and a
// one-row "batch" makes the grouped pipeline look broken — so the seeded batches
// carry a believable roster with the usual mix: most straight through, a few
// waiting on the customer, one or two that need a person.
/** Deterministic rows for one payroll batch — same set on every reseed. */
function bulkRows(co: SeedCtx, employer: string, batchId: string, count: number, offset: number, agoMin: number): SeedRow[] {
  const out: SeedRow[] = [];
  for (let i = 0; i < count; i++) {
    const n = offset + i;
    const firstName = seedFirst(co, n);
    const lastName = seedLast(co, n);
    const m = i % 10;
    const state: OnboardingState =
      m === 3 ? 'EXCEPTION'
      : m === 6 ? 'PENDING_DOCUMENTS'
      : m === 1 || m === 8 ? 'PENDING_LIVENESS'
      : m === 5 ? 'ACCOUNT_CREATED'
      : 'FULLY_ACTIVATED';
    const vals: SeedRow['vals'] =
      state === 'EXCEPTION' ? { BVN: 'failed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }
      : state === 'PENDING_LIVENESS' ? { LIVENESS: 'pending' }
      : undefined;
    out.push({
      firstName, lastName,
      phone: seedPhone(co, n),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${n}@example.com`,
      bvn: seedPrimaryId(co, n),
      nin: seedSecondaryId(co, n),
      address: seedAddr(co, n),
      channel: 'bulk', source: 'rm', employer, batchId,
      state, account: state !== 'EXCEPTION', vals,
      agoMin: agoMin + (i % 12),
    });
  }
  return out;
}

// Seeded desk cases start here (→ first id AO-YYYY-000101). Kept well clear of the
// Ops console's curated 000001–000035 so those hand-written narratives always
// survive the merge, and fixed so the ids are the same on every fresh browser —
// which lets the Maestro embed link real, existing records deterministically.
export const SEED_BASE = 100;

function seed(s: MockOnboardingStore) {
  const co = getActiveCountry();
  setApplicationSeq(SEED_BASE);   // park the demo cases in a high, deterministic band
  const emp1 = co.companies[0], emp2 = co.companies[1];
  // A named person built from the pool at a fixed index, so the demo narrative is
  // stable within a country but relocalises when the country changes.
  const named = (idx: number, over: Omit<SeedRow, 'firstName' | 'lastName' | 'phone' | 'email' | 'bvn' | 'nin' | 'address'>): SeedRow => {
    const firstName = co.firstNames[idx % co.firstNames.length];
    const lastName = co.lastNames[(idx * 3 + 1) % co.lastNames.length];
    return {
      firstName, lastName,
      phone: seedPhone(co, idx),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      bvn: seedPrimaryId(co, idx),
      nin: seedSecondaryId(co, idx),
      address: seedAddr(co, idx),
      ...over,
    };
  };
  const rows: SeedRow[] = [
    named(1, { source: 'rm', state: 'FULLY_ACTIVATED', account: true, agoMin: 2880 }),
    named(2, { channel: 'self', source: 'customer', state: 'ACCOUNT_CREATED', account: true, agoMin: 180 }),
    named(3, { source: 'branch', state: 'VALIDATED', agoMin: 22 }),
    named(4, { source: 'rm', state: 'PENDING_LIVENESS', account: true, vals: { LIVENESS: 'pending' }, agoMin: 65 }),
    named(5, { channel: 'bulk', source: 'rm', employer: emp1, batchId: 'BATCH-001', state: 'PENDING_DOCUMENTS', account: true, agoMin: 1800 }),
    named(6, { source: 'contact-centre', state: 'VALIDATION_IN_PROGRESS', vals: { NIN: 'running', BVN: 'passed', AML: 'running', PEP: 'pending', FRAUD: 'pending', LIVENESS: 'pending' }, agoMin: 4 }),
    named(7, { source: 'rm', state: 'EXCEPTION', vals: { NIN: 'timeout', BVN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }, agoMin: 35 }),
    named(8, { channel: 'bulk', source: 'rm', employer: emp2, batchId: 'BATCH-002', state: 'EXCEPTION', vals: { BVN: 'failed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }, agoMin: 120 },
    ),
    // The two named rows above anchor the demo narrative; these fill their
    // batches out to a believable size — batch 1 → 10, batch 2 → 20.
    ...bulkRows(co, emp1, 'BATCH-001', 9, 100, 1800),
    ...bulkRows(co, emp2, 'BATCH-002', 19, 200, 120),
    // ── Secondary / branch-stage cases ──────────────────────────────────────
    // Store-only demo cases parked in the Maestro case's exception lanes, so the
    // case view shows cases sitting across EVERY stage (not just the main spine).
    // Appended last on purpose — keeps every existing id + SEED_LINKS stable.
    named(9,  { source: 'branch',         state: 'COMPLIANCE_HOLD',  vals: { PEP: 'failed', AML: 'passed', BVN: 'passed', NIN: 'passed', FRAUD: 'passed', LIVENESS: 'passed' }, agoMin: 260 }),
    named(10, { source: 'rm',             state: 'EDD_REVIEW',       vals: { PEP: 'passed', AML: 'passed', BVN: 'passed', NIN: 'passed', FRAUD: 'passed', LIVENESS: 'passed' }, agoMin: 610 }),
    named(11, { source: 'contact-centre', state: 'PENDING_CUSTOMER', vals: { BVN: 'passed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'passed' }, agoMin: 1560 }),
    named(12, { source: 'rm',             state: 'DECLINED',         vals: { FRAUD: 'failed', BVN: 'passed', NIN: 'passed', AML: 'passed', PEP: 'passed', LIVENESS: 'passed' }, agoMin: 4380 }),
  ];
  rows.forEach((r, i) => { void seedCase(s, r, i); });
}

/** The rest of the application form for a seeded record.
 *
 *  Derived from the row's own index so it is stable across reseeds and internally
 *  consistent (the next of kin shares the applicant's surname, the salary account
 *  has an employer). Without this every seeded record reads "Not captured" down
 *  the whole details popup, which looks like the popup is broken rather than like
 *  demo data. */
function seedDetails(co: SeedCtx, r: SeedRow, n: number): Partial<NewCaseInput> {
  const marital = ['Single', 'Married', 'Married', 'Divorced'];
  // From the name, not the row number — "Amina · Male" is exactly the detail that
  // makes seeded data read as broken. Markets without a name split leave it blank.
  const gender = co.femaleNames
    ? (co.femaleNames.includes(r.firstName) ? 'Female' : 'Male')
    : undefined;
  const status = marital[n % marital.length];
  // A title that contradicts the gender ("Ms" on a male record) is the kind of
  // detail that makes seeded data look broken rather than plausible.
  const title = gender === 'Female' ? (status === 'Married' ? 'Mrs' : 'Ms')
    : gender === 'Male' ? (n % 9 === 0 ? 'Dr' : 'Mr')
    : undefined;
  // Read the city back off the address rather than recomputing it: seedAddr is
  // keyed by the row's own index, which is not the array position passed here, so
  // deriving it independently put the applicant in two cities at once.
  const addrCity = (r.address.split(',').pop() ?? '').trim();
  const found = co.cities.indexOf(addrCity);
  const ci = found >= 0 ? found : n % co.cities.length;
  const idTypes = ['International Passport', "Driver's licence", "Voter's card", 'NIN slip'];
  const employment = r.employer ? 'Employed' : ['Self-employed', 'Business owner', 'Employed'][n % 3];
  const occupations = ['Teacher', 'Engineer', 'Trader', 'Nurse', 'Accountant', 'Driver', 'Consultant', 'Farmer'];
  const purposes = ['Everyday banking', 'Salary account', 'Savings', 'Business banking'];
  const funds = ['Salary', 'Business income', 'Investments', 'Pension'];
  const cur = co.currency.symbol;
  const incomes = [`Under ${cur}1m`, `${cur}1m – ${cur}5m`, `${cur}5m – ${cur}20m`, `Above ${cur}20m`];
  const year = 1968 + (n * 7) % 32;
  const pad = (x: number) => String(x).padStart(2, '0');
  return {
    title,
    dob: `${year}-${pad(1 + (n * 5) % 12)}-${pad(1 + (n * 3) % 28)}`,
    gender,
    maritalStatus: status,
    motherMaidenName: co.lastNames[(n + 4) % co.lastNames.length],
    nationality: co.name,
    stateOfOrigin: co.states[(n + 2) % co.states.length] ?? co.cities[(n + 2) % co.cities.length],
    idType: idTypes[n % idTypes.length],
    idNumber: `${String.fromCharCode(65 + (n % 26))}${50000000 + n * 137}`,
    idExpiry: `${2028 + (n % 4)}-${pad(1 + (n * 2) % 12)}-15`,
    city: co.cities[ci],
    stateOfResidence: co.states[ci] ?? co.cities[ci],
    lga: `${co.cities[ci]} Central`,
    yearsAtAddress: String(1 + (n % 12)),
    employmentStatus: employment,
    occupation: occupations[n % occupations.length],
    incomeBand: incomes[n % incomes.length],
    sourceOfFunds: r.employer ? 'Salary' : funds[n % funds.length],
    accountType: n % 5 === 0 ? 'Current' : 'Savings',
    accountPurpose: r.employer ? 'Salary account' : purposes[n % purposes.length],
    branch: `${co.cities[ci]} main branch`,
    nextOfKin: {
      name: `${co.firstNames[(n + 6) % co.firstNames.length]} ${r.lastName}`,
      relationship: ['Spouse', 'Sibling', 'Parent', 'Child'][n % 4],
      phone: `${co.phoneTrunk}${String(2000000 + n * 811).slice(0, 7)}`,
    },
  };
}

async function seedCase(s: MockOnboardingStore, r: SeedRow, n: number) {
  const c = await s.create({
    firstName: r.firstName, lastName: r.lastName, phone: r.phone, email: r.email,
    bvn: r.bvn, nin: r.nin, address: r.address, employer: r.employer,
    channel: r.channel, source: r.source, batchId: r.batchId,
    ...seedDetails(getActiveCountry(), r, n),
  });
  const beyond = BEYOND_VALIDATION.includes(r.state);
  const at = new Date(Date.now() - r.agoMin * 60000).toISOString();
  const validations: ValidationResult[] = VALIDATION_KINDS.map((kind) => {
    const status: ValidationStatus = r.vals?.[kind] ?? (beyond ? 'passed' : 'pending');
    const attempts = status === 'timeout' || status === 'retrying' ? 3 : status === 'passed' || status === 'failed' ? 1 : 0;
    return { kind, status, attempts, updatedAt: at };
  });
  const patch: Partial<OnboardingCase> = { state: r.state, validations, createdAt: at, updatedAt: at };
  if (r.account) { patch.cif = mockCif(); patch.accountNumber = mockAccountNumber(); }
  await s.update(c.id, patch);

  // Emit the events this case would have produced on its way to its state, so the
  // Kafka console shows a realistic multi-topic stream on load (create() already
  // logged 'account-opening-requested'). Best-effort, in rough chronological order.
  const nm = `${r.firstName} ${r.lastName}`;
  const co = getActiveCountry();
  const P = co.primaryId, Sc = co.secondaryId;   // primary=BVN slot, secondary=NIN slot
  const nin = validations.find((v) => v.kind === 'NIN')?.status;
  const bvn = validations.find((v) => v.kind === 'BVN')?.status;
  if (nin && nin !== 'pending') await s.publish(c.id, 'nin-validation', nin === 'timeout' ? `${Sc.label} check timed out for ${nm}` : nin === 'passed' ? `${Sc.label} verified with ${Sc.authority} for ${nm}` : `${Sc.label} check ${nin} for ${nm}`);
  if (bvn && bvn !== 'pending') await s.publish(c.id, 'bvn-validation', bvn === 'failed' ? `${P.label} did not verify for ${nm}` : `${P.label} verified with ${P.authority} for ${nm}`);
  if (r.channel === 'bulk') await s.publish(c.id, 'bulk-upload', `Row loaded from bulk batch ${r.batchId ?? ''}`.trim());
  if (r.state === 'EXCEPTION') await s.publish(c.id, 'exception-queue', `Routed to Operations for review — ${nm}`);
  if (BEYOND_VALIDATION.includes(r.state)) await s.publish(c.id, 'account-creation-requested', `Account creation requested in Finacle for ${nm}`);
  if (r.account) await s.publish(c.id, 'account-created', `Finacle account ${patch.accountNumber} created for ${nm}`);
  if (r.state === 'PENDING_LIVENESS' || r.state === 'PENDING_DOCUMENTS') await s.publish(c.id, 'customer-notification', `KYC link sent by SMS to ${nm}`);
  // Secondary / branch-stage narrative — show how the case diverted (and will loop back).
  if (r.state === 'COMPLIANCE_HOLD') await s.publish(c.id, 'exception-queue', `Sanctions/PEP screening hit — routed from Verification to Compliance escalations for ${nm}`);
  if (r.state === 'EDD_REVIEW') await s.publish(c.id, 'customer-notification', `Risk-based enhanced due diligence opened from Decision for ${nm} — returns to Decision when cleared`);
  if (r.state === 'PENDING_CUSTOMER') await s.publish(c.id, 'customer-notification', `Additional information requested from ${nm} (RFI) — paused pending customer response`);
  if (r.state === 'DECLINED') await s.publish(c.id, 'customer-notification', `Application declined at Decision for ${nm} — case closed`);
}

// Shared singleton — import this everywhere.
export const store: OnboardingStore = new MockOnboardingStore();
