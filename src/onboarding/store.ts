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
import { nextApplicationId, kycToken, uid, mockCif, mockAccountNumber } from './ids';

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
const SEED_VERSION = '5';   // bump to force a reseed when the demo data changes
const SEED_AT_KEY = 'aof_seed_at';   // wall-clock of the last seed, for staleness
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
    try {
      v = localStorage.getItem(SEED_VERSION_KEY);
      seededAt = Number(localStorage.getItem(SEED_AT_KEY)) || 0;
    } catch { /* ignore */ }
    // Reseed when: never seeded, the seed shape changed, OR the seed has gone
    // stale (last seeded > 12h ago — a new sitting, so refresh the ages). A stale
    // reseed also resets any in-session resolutions, which is intended: >12h means
    // a new demo, not a continuation. Within a session nothing is touched.
    const stale = seededAt > 0 && Date.now() - seededAt > SEED_STALE_AFTER_MS;
    if (this.cases.length === 0 || v !== SEED_VERSION || stale) {
      this.cases = []; this.log = [];
      try {
        localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
        localStorage.setItem(SEED_AT_KEY, String(Date.now()));
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
  async create(input: NewCaseInput): Promise<OnboardingCase> {
    const duplicate = await this.checkDuplicate(input);
    const now = nowIso();
    const c: OnboardingCase = {
      id: nextApplicationId(),
      firstName: input.firstName, lastName: input.lastName,
      phone: input.phone, email: input.email, bvn: input.bvn, nin: input.nin,
      address: input.address, employer: input.employer,
      channel: input.channel ?? 'single',
      source: input.source ?? 'rm',
      state: 'PRE_REGISTERED',
      duplicate,
      validations: emptyValidations(),
      batchId: input.batchId,
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

// Filler for the payroll batches. A real bulk upload is tens of people, and a
// one-row "batch" makes the grouped pipeline look broken — so the seeded batches
// carry a believable roster with the usual mix: most straight through, a few
// waiting on the customer, one or two that need a person.
const BULK_FIRST = ['Ibrahim', 'Amina', 'Emeka', 'Ngozi', 'Yakubu', 'Funke', 'Sadiq', 'Chioma', 'Tunde', 'Halima',
  'Peter', 'Grace', 'Musa', 'Zainab', 'Obinna', 'Folake', 'Bashir', 'Adaeze', 'Segun', 'Hauwa'];
const BULK_LAST = ['Musa', 'Sule', 'Obi', 'Umeh', 'Bello', 'Ade', 'Idris', 'Nwankwo', 'Balogun', 'Yusuf',
  'Okon', 'Effiong', 'Danladi', 'Abubakar', 'Chukwu', 'Adeyemi', 'Garba', 'Eze', 'Ogundipe', 'Lawal'];

/** Deterministic rows for one payroll batch — same set on every reseed. */
function bulkRows(employer: string, batchId: string, count: number, offset: number, agoMin: number): SeedRow[] {
  const out: SeedRow[] = [];
  for (let i = 0; i < count; i++) {
    const n = offset + i;
    const firstName = BULK_FIRST[n % BULK_FIRST.length];
    const lastName = BULK_LAST[(n * 7 + 3) % BULK_LAST.length];
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
      phone: `0803${String(2000000 + n).slice(-7)}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${n}@example.com`,
      bvn: `222${String(20000000 + n).slice(-8)}`,
      nin: `101${String(30000000 + n).slice(-8)}`,
      address: `${(n % 60) + 1} Station Rd, Lagos`,
      channel: 'bulk', source: 'rm', employer, batchId,
      state, account: state !== 'EXCEPTION', vals,
      agoMin: agoMin + (i % 12),
    });
  }
  return out;
}

function seed(s: MockOnboardingStore) {
  const rows: SeedRow[] = [
    { firstName: 'Amara', lastName: 'Okafor', phone: '08031234571', email: 'amara.okafor@example.com', bvn: '22212345671', nin: '10123456781', address: '14 Marina Rd, Lagos', source: 'rm', state: 'FULLY_ACTIVATED', account: true, agoMin: 2880 },
    { firstName: 'Tunde', lastName: 'Adeyemi', phone: '08067654322', email: 'tunde.adeyemi@example.com', bvn: '22212345672', nin: '10123456782', address: '22 Ahmadu Bello Way, Abuja', channel: 'self', source: 'customer', state: 'ACCOUNT_CREATED', account: true, agoMin: 180 },
    { firstName: 'Ngozi', lastName: 'Eze', phone: '07051239873', email: 'ngozi.eze@example.com', bvn: '22212345673', nin: '10123456783', address: '9 Aba Rd, Port Harcourt', source: 'branch', state: 'VALIDATED', agoMin: 22 },
    { firstName: 'Chidi', lastName: 'Balogun', phone: '08039876544', email: 'chidi.balogun@example.com', bvn: '22212345674', nin: '10123456784', address: '5 Awolowo Way, Ikeja', source: 'rm', state: 'PENDING_LIVENESS', account: true, vals: { LIVENESS: 'pending' }, agoMin: 65 },
    { firstName: 'Fatima', lastName: 'Bello', phone: '09012345675', email: 'fatima.bello@example.com', bvn: '22212345675', nin: '10123456785', address: '3 Ibrahim Rd, Kano', channel: 'bulk', source: 'rm', employer: 'NYSC', batchId: 'BATCH-001', state: 'PENDING_DOCUMENTS', account: true, agoMin: 300 },
    { firstName: 'Emeka', lastName: 'Nwosu', phone: '08023456786', email: 'emeka.nwosu@example.com', bvn: '22212345676', nin: '10123456786', address: '41 Chime Ave, Enugu', source: 'contact-centre', state: 'VALIDATION_IN_PROGRESS', vals: { NIN: 'running', BVN: 'passed', AML: 'running', PEP: 'pending', FRAUD: 'pending', LIVENESS: 'pending' }, agoMin: 4 },
    { firstName: 'Aisha', lastName: 'Yusuf', phone: '08134567897', email: 'aisha.yusuf@example.com', bvn: '22212345677', nin: '10123456787', address: '7 Sultan Rd, Sokoto', source: 'rm', state: 'EXCEPTION', vals: { NIN: 'timeout', BVN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }, agoMin: 35 },
    { firstName: 'Blessing', lastName: 'Okoro', phone: '08098765438', email: 'blessing.okoro@example.com', bvn: '22212345678', nin: '10123456788', address: '12 Warri Rd, Delta', channel: 'bulk', source: 'rm', employer: 'Delta Co-op', batchId: 'BATCH-002', state: 'EXCEPTION', vals: { BVN: 'failed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }, agoMin: 120 },
    // The two named rows above anchor the demo narrative; these fill their
    // batches out to a believable size — NYSC 10, Delta Co-op 20.
    ...bulkRows('NYSC', 'BATCH-001', 9, 100, 300),
    ...bulkRows('Delta Co-op', 'BATCH-002', 19, 200, 120),
  ];
  rows.forEach((r) => { void seedCase(s, r); });
}

async function seedCase(s: MockOnboardingStore, r: SeedRow) {
  const c = await s.create({
    firstName: r.firstName, lastName: r.lastName, phone: r.phone, email: r.email,
    bvn: r.bvn, nin: r.nin, address: r.address, employer: r.employer,
    channel: r.channel, source: r.source, batchId: r.batchId,
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
  const nin = validations.find((v) => v.kind === 'NIN')?.status;
  const bvn = validations.find((v) => v.kind === 'BVN')?.status;
  if (nin && nin !== 'pending') await s.publish(c.id, 'nin-validation', nin === 'timeout' ? `NIN check timed out for ${nm}` : nin === 'passed' ? `NIN verified with NIMC for ${nm}` : `NIN check ${nin} for ${nm}`);
  if (bvn && bvn !== 'pending') await s.publish(c.id, 'bvn-validation', bvn === 'failed' ? `BVN did not verify for ${nm}` : `BVN verified with NIBSS for ${nm}`);
  if (r.channel === 'bulk') await s.publish(c.id, 'bulk-upload', `Row loaded from bulk batch ${r.batchId ?? ''}`.trim());
  if (r.state === 'EXCEPTION') await s.publish(c.id, 'exception-queue', `Routed to Operations for review — ${nm}`);
  if (BEYOND_VALIDATION.includes(r.state)) await s.publish(c.id, 'account-creation-requested', `Account creation requested in Finacle for ${nm}`);
  if (r.account) await s.publish(c.id, 'account-created', `Finacle account ${patch.accountNumber} created for ${nm}`);
  if (r.state === 'PENDING_LIVENESS' || r.state === 'PENDING_DOCUMENTS') await s.publish(c.id, 'customer-notification', `KYC link sent by SMS to ${nm}`);
}

// Shared singleton — import this everywhere.
export const store: OnboardingStore = new MockOnboardingStore();
