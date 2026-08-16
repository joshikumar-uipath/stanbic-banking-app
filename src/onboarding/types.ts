// ─────────────────────────────────────────────────────────────────────────────
// Digital Account Opening Factory — shared domain model.
//
// The single source of truth for the onboarding lifecycle, shared by every
// surface (Employee app, Operations Workbench, Customer app) and the demo
// consoles (mock Kafka, mock Finacle). All data access goes through the
// OnboardingStore interface (see ./store) so the mock implementation can later
// be swapped for the real UiPath layer without touching any UI.
// ─────────────────────────────────────────────────────────────────────────────

// ── Lifecycle state machine ──────────────────────────────────────────────────
export type OnboardingState =
  | 'AWAITING_EXTRACTION'     // corporate: form uploaded, case running, review not yet confirmed
  | 'PRE_REGISTERED'          // customer info captured, case created
  | 'VALIDATION_IN_PROGRESS'  // async validations running
  | 'VALIDATED'               // all mandatory validations passed
  | 'ACCOUNT_CREATED'         // Finacle CIF + account created
  | 'PENDING_DOCUMENTS'       // required documents outstanding
  | 'PENDING_LIVENESS'        // liveness verification outstanding
  | 'FULLY_ACTIVATED'         // all onboarding requirements complete
  | 'EXCEPTION'              // manual intervention required
  // ── Secondary / branch stages (mirror the Maestro case's exception lanes) ──
  | 'COMPLIANCE_HOLD'        // screening hit → routed to Compliance escalations (loops back to Verification)
  | 'EDD_REVIEW'             // enhanced due diligence required (loops back to Decision)
  | 'PENDING_CUSTOMER'       // info requested from customer / RFI (loops back to Decision)
  | 'DECLINED';              // application declined or withdrawn (terminal)

export interface StateMeta { state: OnboardingState; label: string; desc: string; tone: 'progress' | 'good' | 'pending' | 'exception'; }

export const ONBOARDING_STATES: StateMeta[] = [
  { state: 'PRE_REGISTERED',         label: 'Pre-registered',      desc: 'Customer information captured, case created.',   tone: 'progress' },
  { state: 'VALIDATION_IN_PROGRESS', label: 'Validating',          desc: 'Async validation activities are running.',       tone: 'progress' },
  { state: 'VALIDATED',              label: 'Validated',           desc: 'All mandatory validations completed.',           tone: 'progress' },
  { state: 'ACCOUNT_CREATED',        label: 'Account created',     desc: 'Finacle CIF & account successfully created.',    tone: 'good' },
  { state: 'PENDING_DOCUMENTS',      label: 'Pending documents',   desc: 'Required documents still outstanding.',          tone: 'pending' },
  { state: 'PENDING_LIVENESS',       label: 'Pending liveness',    desc: 'Liveness verification outstanding.',             tone: 'pending' },
  { state: 'FULLY_ACTIVATED',        label: 'Fully activated',     desc: 'All onboarding requirements complete.',          tone: 'good' },
  { state: 'EXCEPTION',              label: 'Exception',           desc: 'Manual intervention required in Operations.',    tone: 'exception' },
  { state: 'COMPLIANCE_HOLD',        label: 'Compliance hold',     desc: 'Screening hit — with Compliance escalations.',   tone: 'exception' },
  { state: 'EDD_REVIEW',             label: 'EDD review',          desc: 'Enhanced due diligence in progress.',            tone: 'progress' },
  { state: 'PENDING_CUSTOMER',       label: 'Pending customer',    desc: 'Awaiting information requested from customer.',   tone: 'pending' },
  { state: 'DECLINED',               label: 'Declined',            desc: 'Application declined or withdrawn.',             tone: 'exception' },
];

/** The linear happy path — the only states "Step N of M" counts.
 *
 *  EXCEPTION and the branch stages after it are states a case can be *in*, not
 *  steps it passes *through*, so they are excluded and render their own label
 *  instead. Derived from the list rather than hardcoded: this was originally
 *  written as `ONBOARDING_STATES.length - 1`, which was right when the array
 *  ended at EXCEPTION and silently wrong the moment the branch stages were
 *  appended (a declined case read "Step 12 of 11"). */
export const FUNNEL_STATES: StateMeta[] = ONBOARDING_STATES.slice(
  0, ONBOARDING_STATES.findIndex((m) => m.state === 'FULLY_ACTIVATED') + 1,
);

/** States that sit outside the onboarding funnel. Kept out of ONBOARDING_STATES
 *  because that array doubles as the step sequence — Opening derives "Step N of M"
 *  from its index and length, and stateMeta falls back to its first entry. Adding
 *  to it renumbers every case and changes what an unknown state renders as. */
const OFF_FUNNEL_STATES: StateMeta[] = [
  { state: 'AWAITING_EXTRACTION', label: 'Awaiting review', desc: 'Form uploaded and read — waiting on the extraction review.', tone: 'pending' },
];

export const stateMeta = (s: OnboardingState): StateMeta =>
  ONBOARDING_STATES.find((m) => m.state === s)
  ?? OFF_FUNNEL_STATES.find((m) => m.state === s)
  ?? ONBOARDING_STATES[0];

// ── How a case entered, and who owns it ──────────────────────────────────────
export type Channel = 'single' | 'bulk' | 'self';        // single/bulk = staff; self = customer-initiated
export type Source = 'rm' | 'branch' | 'contact-centre' | 'customer';

// ── Validations & screening (Step 4 in the guide) ────────────────────────────
export type ValidationKind = 'NIN' | 'BVN' | 'AML' | 'PEP' | 'FRAUD' | 'LIVENESS';
export type ValidationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'timeout' | 'retrying';

export const VALIDATION_KINDS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];

export interface ValidationResult {
  kind: ValidationKind;
  status: ValidationStatus;
  attempts: number;        // drives the 5/15/30/60-min retry framework
  updatedAt: string;
  detail?: string;
}

// ── Duplicate detection (Step 2) ─────────────────────────────────────────────
export type DuplicateOutcome = 'new' | 'existing' | 'potential-duplicate';

// ── Event backbone (Kafka topics) ────────────────────────────────────────────
export type KafkaTopic =
  | 'account-opening-requested'
  | 'nin-validation'
  | 'bvn-validation'
  | 'account-creation-requested'
  | 'account-created'
  | 'bulk-upload'
  | 'exception-queue'
  | 'customer-notification';

export const KAFKA_TOPICS: KafkaTopic[] = [
  'account-opening-requested', 'nin-validation', 'bvn-validation',
  'account-creation-requested', 'account-created', 'bulk-upload',
  'exception-queue', 'customer-notification',
];

// A published event — feeds both the case timeline and the mock Kafka console.
export interface CaseEvent {
  id: string;
  caseId: string;
  topic: KafkaTopic;
  message: string;
  at: string;
  payload?: Record<string, unknown>;
}

// ── The onboarding case (system-of-record record) ────────────────────────────
/** A director / signatory on a corporate account. */
export interface EntityDirector {
  name: string;
  bvn?: string;
  idType?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  role?: string;              // Director / Shareholder / Signatory
}

/** Corporate/entity details, present only on business account openings. The case
 *  still carries the individual fields (set from the primary signatory) so the
 *  pipeline, validations and lists work unchanged. */
export interface EntityInfo {
  companyName: string;
  rcNumber?: string;
  businessType?: string;      // Limited Liability Company, Partnership, …
  sector?: string;
  tin?: string;
  turnover?: string;
  address?: string;
  email?: string;
  phone?: string;
  directors: EntityDirector[];
}

/** Who to reach if the bank cannot reach the customer. Every retail AOF asks. */
export interface NextOfKin {
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

/** The rest of a real retail account opening form.
 *
 *  All optional: records created before these existed (and the bulk/payroll rows,
 *  which genuinely arrive with less) stay valid, and the details popup shows
 *  "Not captured" rather than inventing anything. `state` is taken by the
 *  lifecycle, hence `stateOfResidence`. */
export interface ApplicantDetails {
  title?: string;                 // Mr / Mrs / Ms / Dr …
  middleName?: string;
  dob?: string;                   // ISO date
  gender?: string;
  maritalStatus?: string;
  motherMaidenName?: string;      // the classic retail-bank security question
  nationality?: string;
  stateOfOrigin?: string;

  idType?: string;                // International Passport / Driver's licence / …
  idNumber?: string;
  idExpiry?: string;
  tin?: string;

  altPhone?: string;
  city?: string;
  stateOfResidence?: string;
  lga?: string;
  yearsAtAddress?: string;

  employmentStatus?: string;      // Employed / Self-employed / Student / …
  occupation?: string;
  incomeBand?: string;
  sourceOfFunds?: string;

  accountType?: string;           // Savings / Current / Domiciliary
  accountPurpose?: string;
  branch?: string;

  nextOfKin?: NextOfKin;
}

export interface OnboardingCase extends ApplicantDetails {
  id: string;                 // AO-YYYY-NNNNNN
  firstName: string;
  lastName: string;
  entity?: EntityInfo;        // set on corporate openings; absent for individuals
  phone: string;
  email: string;
  bvn: string;
  nin: string;
  address: string;
  employer?: string;          // salary / bulk onboarding
  channel: Channel;
  source: Source;
  state: OnboardingState;
  duplicate: DuplicateOutcome;
  validations: ValidationResult[];
  cif?: string;               // Finacle customer id, once created
  accountNumber?: string;     // Finacle account number, once created
  batchId?: string;           // groups rows from one bulk upload
  kycToken?: string;          // tokenised customer completion link
  /** The uploaded form this record was opened from, as an Orchestrator attachment.
   *  Held on the record because the parked-review slot is cleared on confirm and
   *  the task closes — leaving nowhere else to find the pages afterwards. The id
   *  rather than a URL: read links are short-lived and minted on demand. */
  documentId?: string;
  documentName?: string;
  createdAt: string;
  updatedAt: string;
  timeline: CaseEvent[];
}

export const fullName = (c: Pick<OnboardingCase, 'firstName' | 'lastName'>) =>
  `${c.firstName} ${c.lastName}`.trim();

/** Whether a case is a business opening. The entity block is the marker, but a
 *  corporate upload opens its draft before the extraction is confirmed — so that
 *  state counts as corporate too, otherwise a draft would file as an individual
 *  until the reviewer accepts it. */
export const isCorporate = (c: Pick<OnboardingCase, 'entity' | 'state'>) =>
  Boolean(c.entity) || c.state === 'AWAITING_EXTRACTION';

// Fields a caller supplies to open a case; everything else is derived by the store.
export interface NewCaseInput extends ApplicantDetails {
  firstName: string;
  lastName: string;
  entity?: EntityInfo;
  phone: string;
  email: string;
  bvn: string;
  nin: string;
  address: string;
  employer?: string;
  channel?: Channel;
  source?: Source;
  batchId?: string;
  /** Defaults to PRE_REGISTERED. The corporate upload path opens a record at
   *  AWAITING_EXTRACTION so the running case shows on the desk before capture ends. */
  state?: OnboardingState;
  /** The uploaded form, when the record was opened from one. */
  documentId?: string;
  documentName?: string;
}
