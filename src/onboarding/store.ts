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
import { VALIDATION_KINDS, fullName, hasBranch } from './types';
import { nextApplicationId, setApplicationSeq, kycToken, uid, mockCif, mockAccountNumber } from './ids';
import { getActiveCountry } from '../config/countries';

/** True when `recordId` is linked to a Maestro case that has NOT finished.
 *  Injected rather than imported: this module must not depend on maestro.ts.
 *  Registered once, in main.tsx. */
let liveCaseUnfinished: ((recordId: string) => boolean) | null = null;
export function setLiveCaseGuard(fn: (recordId: string) => boolean): void {
  liveCaseUnfinished = fn;
}

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
  /** `at` back-dates the event (the seeder replaying a case's history); default now. */
  publish(caseId: string, topic: KafkaTopic, message: string, payload?: Record<string, unknown>, at?: string): Promise<void>;
  events(): Promise<CaseEvent[]>;      // global event log, newest first (drives the mock Kafka console)
  subscribe(listener: StoreListener): () => void;
}

// ── Mock implementation ──────────────────────────────────────────────────────
import { casesShared, pushCase, deleteCaseRemote, fetchSharedCases, CASES_EVENT } from './caseFabric';
// Re-exported so screens can show a "not synced" banner via the '../onboarding' barrel.
export { onSyncProblem, syncProblems, retryPendingSync, SYNC_PROBLEM_EVENT, SYNC_OK_EVENT, type SyncProblem } from './caseFabric';
import { getOperator, getOperatorBranch } from './operator';

// Seeded demo rows go through create() like any other record, so without this
// flag they are indistinguishable from a real capture — and forty of them would
// be pushed into the shared table on every fresh browser. Set only while seed()
// runs; the write-through checks it.
let seeding = false;

const CASES_KEY = 'aof_cases';
const EVENTS_KEY = 'aof_events';
const SEED_VERSION_KEY = 'aof_seed_v';
const SEED_VERSION = '15';  // bump to force a reseed when the demo data changes
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
      seeding = true;
      void seed(this).finally(() => { seeding = false; void this.hydrateShared(); });
    } else {
      // Already seeded — repair any duplicate references first, then pick up
      // whatever other browsers have captured since.
      this.reserveIdsUpTo();
      if (this.dedupeIds()) this.save();
      void this.hydrateShared();
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
  /** Mirror one record to the shared table. Fire-and-forget: a capture must not
   *  wait on Data Fabric, and must not fail if it is unreachable. */
  private share(c: OnboardingCase) {
    if (seeding || c.seeded || !casesShared()) return;
    void pushCase(c);
  }

  /** Merge the shared table in on load. A remote record wins only when it is
   *  genuinely newer; a remote row whose id collides with a LOCAL SEEDED record is
   *  skipped outright, because record ids restart at AO-2026-000101 in every
   *  browser and the demo band would otherwise be overwritten by someone else's
   *  application that happens to share a number. */
  private async hydrateShared() {
    if (!casesShared()) return;
    const remote = await fetchSharedCases();
    if (!remote.length) return;
    let changed = false;
    for (const r of remote) {
      // Match on uid where both sides have one — two browsers mint the same
      // display id, so matching on that merges unrelated applications.
      const local = this.cases.find((c) => (r.uid && c.uid ? c.uid === r.uid : c.id === r.id));
      if (local?.seeded) continue;
      if (!local) { this.cases.unshift(r); changed = true; continue; }
      if ((r.updatedAt ?? '') > (local.updatedAt ?? '')) {
        Object.assign(local, r); changed = true;
      }
    }
    if (changed) {
      // Advance past every id now in the store. A hydrated record does not touch
      // the counter, so a browser sitting at 146 that pulls in AO-2026-000147 will
      // happily mint AO-2026-000147 again on the next capture — which is how one
      // application ended up sharing a reference with two others, selecting them
      // together and sharing a single Maestro link between them.
      this.reserveIdsUpTo();
      this.save();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CASES_EVENT));
    }
  }

  /**
   * Repair references that were minted twice.
   *
   * Hydration used to add a shared record without advancing the counter, so the
   * next capture reissued an id that already existed. Records sharing a reference
   * select together, look like duplicates of one another, and share a single
   * Maestro link. Keep the OLDEST holder of each id and reissue for the rest.
   *
   * The link map is keyed by reference, so a reissued record cannot keep its
   * instance — but those links were already lost when the ids collided: one entry
   * per id means the later link overwrote the earlier. Nothing recoverable is
   * being discarded here.
   */
  private dedupeIds(): boolean {
    const byId = new Map<string, OnboardingCase[]>();
    for (const c of this.cases) {
      const list = byId.get(c.id) ?? [];
      list.push(c);
      byId.set(c.id, list);
    }
    let fixed = false;
    for (const [, list] of byId) {
      if (list.length < 2) continue;
      // Oldest keeps the reference; it is the one the link and any Data Fabric row
      // already point at.
      list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      for (const c of list.slice(1)) {
        const was = c.id;
        c.id = nextApplicationId();
        c.timeline = [{ id: uid(), caseId: c.id, topic: 'account-opening-requested', at: nowIso(),
          message: `Reference reissued from ${was} — it had been minted for more than one application` },
          ...(c.timeline ?? [])];
        fixed = true;
      }
    }
    return fixed;
  }

  /** Push the id counter past the highest reference held locally. */
  private reserveIdsUpTo() {
    let hi = 0;
    for (const c of this.cases) {
      const n = parseInt((c.id.split('-').pop() || '0'), 10);
      if (Number.isFinite(n) && n > hi) hi = n;
    }
    let cur = 0;
    try { cur = parseInt(localStorage.getItem('aof_app_seq') || '0', 10) || 0; } catch { /* ignore */ }
    if (hi > cur) setApplicationSeq(hi);
  }

  /** Notify subscribers — once per synchronous burst. Writes made in the same
   *  tick (remove() saving then emitting, Promise.all over many creates, a
   *  storage event landing mid-write) collapse into one notification. Listeners
   *  still run before any timer or I/O callback. Note an AWAITED chain
   *  (await update → await publish) yields between steps, so each step still
   *  notifies — coalescing those would need a macrotask, which delays every
   *  listener behind pending timers. */
  private emitQueued = false;
  private emit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    queueMicrotask(() => {
      this.emitQueued = false;
      this.listeners.forEach((l) => l());
    });
  }

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
    const gone = this.cases.find((c) => c.id === id);
    if (gone && !gone.seeded) void deleteCaseRemote(gone);
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
      uid: (globalThis.crypto?.randomUUID?.() ?? `u_${Date.now()}_${Math.random().toString(36).slice(2)}`),
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
      // Bulk intake — absent on every single capture.
      bulkChannel: input.bulkChannel,
      reviewState: input.reviewState,
      extractionConfidence: input.extractionConfidence,
      fieldConfidence: input.fieldConfidence,
      verifications: input.verifications,
      recon: input.recon,
      decision: input.decision,
      decisionReason: input.decisionReason,
      pnd: input.pnd,
      invite: input.invite,
      // What the document checks read off the uploaded files (src/integrations/docChecks).
      documentFacts: input.documentFacts,
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
      accountType: input.accountType, accountPurpose: input.accountPurpose,
      branch: input.branch || (hasBranch(input.source) ? getOperatorBranch() ?? undefined : undefined),
      nextOfKin: input.nextOfKin,
      kycToken: kycToken(),
      // Provenance. A self-service opening has no operator, and that absence is
      // the signal Operations needs — it means no RM is already chasing it.
      capturedBy: input.capturedBy ?? (input.source === 'customer' ? undefined : getOperator() ?? undefined),
      createdAt: now, updatedAt: now,
      timeline: [],
    };
    this.cases.unshift(c);
    if (seeding) c.seeded = true;
    this.save();
    this.share(c);
    await this.publish(c.id, 'account-opening-requested', `Application received for ${fullName(c)}`, { channel: c.channel });
    return c;
  }

  async update(id: string, patch: Partial<OnboardingCase>): Promise<OnboardingCase> {
    const c = this.cases.find((x) => x.id === id);
    if (!c) throw new Error(`Case ${id} not found`);
    // A record whose case is still running in Maestro cannot be "fully activated":
    // that is the state the LAST task of Closure produces. Several writers used to
    // jump straight to it — the FaceID approval and the KYC completion both set it
    // the moment liveness passed — which put "Fully activated" in the outcome
    // column beside a live case parked at Decision. The guard lives here rather
    // than in advance() because those writers call update() directly.
    if (patch.state === 'FULLY_ACTIVATED' && liveCaseUnfinished?.(id)) {
      patch = { ...patch, state: c.accountNumber ? 'ACCOUNT_CREATED' : c.state };
    }
    Object.assign(c, patch, { updatedAt: nowIso() });
    this.save();
    this.share(c);
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

  async publish(caseId: string, topic: KafkaTopic, message: string, payload?: Record<string, unknown>, at?: string) {
    const ev: CaseEvent = { id: uid('ev'), caseId, topic, message, at: at ?? nowIso(), payload };
    this.log.unshift(ev);
    const c = this.cases.find((x) => x.id === caseId);
    if (c) c.timeline.unshift(ev);
    // A back-dated event lands in time order, not on top: the timeline and the
    // log are both newest first.
    if (at) {
      const byTime = (a: CaseEvent, b: CaseEvent) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
      this.log.sort(byTime);
      c?.timeline.sort(byTime);
    }
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

function seed(s: MockOnboardingStore): Promise<unknown> {
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

    // ── Origination mix ─────────────────────────────────────────────────────
    // The desk used to know four origins, all of them staffed or generic, while
    // the caseplan already declared mobile and email triggers. These give the Ops
    // view a realistic spread so "what is stuck" can be read against "where it
    // came from" — the self-served ones matter most there, because no RM is
    // already chasing them. Appended last, so existing ids and SEED_LINKS hold.
    named(13, { source: 'mobile',   channel: 'self', state: 'EXCEPTION',              vals: { LIVENESS: 'failed', BVN: 'passed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed' }, agoMin: 95 }),
    named(14, { source: 'whatsapp', channel: 'self', state: 'PENDING_DOCUMENTS',      vals: { BVN: 'passed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }, agoMin: 320 }),
    named(15, { source: 'agent',    channel: 'single', state: 'VALIDATION_IN_PROGRESS', vals: { NIN: 'running', BVN: 'passed', AML: 'pending', PEP: 'pending', FRAUD: 'pending', LIVENESS: 'pending' }, agoMin: 18 }),
    named(16, { source: 'web',      channel: 'self', state: 'EXCEPTION',              vals: { NIN: 'timeout', BVN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'pending' }, agoMin: 740 }),
    named(17, { source: 'partner',  channel: 'self', state: 'VALIDATED',              vals: { BVN: 'passed', NIN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed', LIVENESS: 'passed' }, agoMin: 210 }),
    named(18, { source: 'email',    channel: 'single', state: 'PRE_REGISTERED',         agoMin: 40 }),
  ];
  return Promise.all(rows.map((r, i) => seedCase(s, r, i)));
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
  // Split so the job matches how the person is employed — a "Business owner ·
  // Nurse" reads as two facts about two different people.
  const salaried = ['Teacher', 'Engineer', 'Nurse', 'Accountant', 'Civil servant', 'Bank officer'];
  const ownAccount = ['Trader', 'Driver', 'Consultant', 'Farmer', 'Tailor', 'Contractor'];
  const purposes = ['Everyday banking', 'Salary account', 'Savings', 'Business banking'];
  const funds = ['Salary', 'Business income', 'Investments', 'Pension'];
  const cur = co.currency.symbol;
  const incomes = [`Under ${cur}1m`, `${cur}1m – ${cur}5m`, `${cur}5m – ${cur}20m`, `Above ${cur}20m`];
  const year = 1968 + (n * 7) % 32;
  const pad = (x: number) => String(x).padStart(2, '0');
  // Everything the details popup can show gets a value. A seeded case with
  // "Not captured" down half the panel reads as a broken record rather than a
  // demo one: TIN and the alternate phone were never generated at all, and
  // `employer` only arrived on bulk rows, so every walk-in looked unemployed.
  const tinBase = 20000000000 + n * 7919;
  return {
    title,
    tin: `${String(tinBase).slice(0, 11)}-${pad(1 + n % 9)}${pad(1 + (n * 3) % 9)}`,
    altPhone: `${co.phoneTrunk}${String(3100000 + n * 37).slice(-7)}`,
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
    // Bulk rows carry their batch's employer; everyone else gets one that agrees
    // with their employment status — self-employed and business owners are named
    // after their own trade rather than left blank.
    employer: r.employer
      ?? (employment === 'Employed' ? co.companies[(n + 1) % co.companies.length]
        : `${co.lastNames[(n * 5 + 2) % co.lastNames.length]} ${['Ventures', 'Enterprises', 'Trading', 'Services'][n % 4]}`),
    occupation: employment === 'Employed' ? salaried[n % salaried.length] : ownAccount[n % ownAccount.length],
    // These three have to agree with the employment status, or the record reads
    // as randomly generated — which it is, but it should not look it.
    incomeBand: employment === 'Business owner' ? incomes[2 + (n % 2)] : incomes[n % 3],
    sourceOfFunds: employment === 'Employed' ? 'Salary'
      : employment === 'Self-employed' || employment === 'Business owner' ? 'Business income'
      : funds[n % funds.length],
    accountType: n % 5 === 0 ? 'Current' : 'Savings',
    accountPurpose: employment === 'Employed' ? 'Salary account'
      : employment === 'Self-employed' || employment === 'Business owner' ? 'Business banking'
      : purposes[n % purposes.length],
    // Only where someone actually stood in one — see hasBranch(). A bulk payroll
    // row is loaded centrally, so its batch is the locus, not a branch.
    branch: hasBranch(r.source) && r.channel !== 'bulk' ? `${co.cities[ci]} main branch` : undefined,
    nextOfKin: {
      name: `${co.firstNames[(n + 6) % co.firstNames.length]} ${r.lastName}`,
      relationship: ['Spouse', 'Sibling', 'Parent', 'Child'][n % 4],
      phone: `${co.phoneTrunk}${String(2000000 + n * 811).slice(0, 7)}`,
      // Same household as the applicant — the common case, and it stops the
      // next-of-kin block ending on an empty line.
      address: r.address,
    },
  };
}

/** The steps of a seeded case's history, in the order they happen. */
export type SeedStep = 'intake' | 'nin' | 'bvn' | 'exception' | 'accountRequested' | 'accountCreated' | 'notify';
/** Where each step falls between the case opening (0) and now (1). */
const SEED_STEP_AT: Record<SeedStep, number> = {
  intake: 0.02, nin: 0.08, bvn: 0.11, exception: 0.3, accountRequested: 0.62, accountCreated: 0.7, notify: 0.9,
};
/**
 * When a seeded case did a given step: a fixed fraction of the way from when it
 * opened to now, so its events read in order and a few minutes apart. Seeded
 * records have no real history to remember; this is the history they would have.
 * Exported so the BVN/NIN call panels can place a seeded record's calls on the
 * same timeline as its events.
 */
export function seededStepAt(openedAt: string, step: SeedStep, now = Date.now()): string {
  const t0 = new Date(openedAt).getTime();
  return new Date(t0 + Math.max(0, now - t0) * SEED_STEP_AT[step]).toISOString();
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
  // create() logged "application received" as of now; this case opened `at`. The
  // event object is shared by the case timeline and the global log.
  const received = c.timeline.find((e) => e.topic === 'account-opening-requested');
  if (received) received.at = at;

  // Emit the events this case would have produced on its way to its state, so the
  // Kafka console shows a realistic multi-topic stream on load (create() already
  // logged 'account-opening-requested'). Each is back-dated onto the case's own
  // history — see seededStepAt — rather than all landing in the second the seed
  // ran, which put a NIN check and an account opening at the same instant.
  const nm = `${r.firstName} ${r.lastName}`;
  const when = (step: SeedStep) => seededStepAt(at, step);
  const co = getActiveCountry();
  const P = co.primaryId, Sc = co.secondaryId;   // primary=BVN slot, secondary=NIN slot
  const nin = validations.find((v) => v.kind === 'NIN')?.status;
  const bvn = validations.find((v) => v.kind === 'BVN')?.status;
  if (nin && nin !== 'pending') await s.publish(c.id, 'nin-validation', nin === 'timeout' ? `${Sc.label} check timed out for ${nm}` : nin === 'passed' ? `${Sc.label} verified with ${Sc.authority} for ${nm}` : `${Sc.label} check ${nin} for ${nm}`, undefined, when('nin'));
  if (bvn && bvn !== 'pending') await s.publish(c.id, 'bvn-validation', bvn === 'failed' ? `${P.label} did not verify for ${nm}` : `${P.label} verified with ${P.authority} for ${nm}`, undefined, when('bvn'));
  if (r.channel === 'bulk') await s.publish(c.id, 'bulk-upload', `Row loaded from bulk batch ${r.batchId ?? ''}`.trim(), undefined, when('intake'));
  if (r.state === 'EXCEPTION') await s.publish(c.id, 'exception-queue', `Routed to Operations for review — ${nm}`, undefined, when('exception'));
  if (BEYOND_VALIDATION.includes(r.state)) await s.publish(c.id, 'account-creation-requested', `Account creation requested in Finacle for ${nm}`, undefined, when('accountRequested'));
  if (r.account) await s.publish(c.id, 'account-created', `Finacle account ${patch.accountNumber} created for ${nm}`, undefined, when('accountCreated'));
  if (r.state === 'PENDING_LIVENESS' || r.state === 'PENDING_DOCUMENTS') await s.publish(c.id, 'customer-notification', `KYC link sent by SMS to ${nm}`, undefined, when('notify'));
  // Secondary / branch-stage narrative — show how the case diverted (and will loop back).
  if (r.state === 'COMPLIANCE_HOLD') await s.publish(c.id, 'exception-queue', `Sanctions/PEP screening hit — routed from Verification to Compliance escalations for ${nm}`, undefined, when('exception'));
  if (r.state === 'EDD_REVIEW') await s.publish(c.id, 'customer-notification', `Risk-based enhanced due diligence opened from Decision for ${nm} — returns to Decision when cleared`, undefined, when('notify'));
  if (r.state === 'PENDING_CUSTOMER') await s.publish(c.id, 'customer-notification', `Additional information requested from ${nm} (RFI) — paused pending customer response`, undefined, when('notify'));
  if (r.state === 'DECLINED') await s.publish(c.id, 'customer-notification', `Application declined at Decision for ${nm} — case closed`, undefined, when('notify'));
}

// Shared singleton — import this everywhere.
export const store: OnboardingStore = new MockOnboardingStore();
