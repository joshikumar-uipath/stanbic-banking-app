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
/**
 * Where an application came from. Two families, and the split is what Operations
 * cares about: STAFF-OPERATED (rm, branch, contact-centre) already has a person
 * behind it, and SELF-SERVED (everything else) does not — a stuck case there is
 * nobody's until someone picks it up.
 *
 * `agent` sits between the two: a human took it, but not a bank employee.
 *
 * Kept market-neutral on purpose. The channels below are prominent across
 * markets rather than tuned to one; the caseplan already declares mobile and
 * email as real triggers, so the desk needs to be able to say so.
 * `customer` remains the generic self-service value for when the specific
 * channel is unknown.
 */
export type Source =
  | 'rm' | 'branch' | 'contact-centre'          // staff-operated
  | 'agent'                                      // agent / correspondent banking
  | 'customer' | 'mobile' | 'web' | 'whatsapp' | 'partner' | 'email';

/**
 * Does an application from this source happen AT a branch?
 *
 * Only where a person walked into one. An internet or mobile application has no
 * branch — the customer was on their phone — and stamping one on anyway is how
 * the desk ended up claiming a self-served case belonged to "Lagos main branch".
 * A contact centre is a centre, not a branch; an agent has an outlet, which is
 * not the same thing and which we do not capture. In both cases showing nothing
 * is truthful and showing a branch is not.
 */
export const hasBranch = (s?: Source): boolean => s === 'rm' || s === 'branch';

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

// ── Bulk account opening (BRD v1.0) ──────────────────────────────────────────
/**
 * Which intake channel a bulk application arrived through. The distinction is
 * not cosmetic: a `manifest` row was typed by the customer into a structured
 * form, so nothing was guessed and no one needs to confirm it; a `bundle` row
 * was read off a scanned AOP by OCR, and the BRD makes an Ops review mandatory
 * before an account can be created (BR-DOC-10).
 */
export type BulkChannel = 'manifest' | 'bundle';

/** Where an OCR-extracted application sits in the maker checkpoint. */
export type ReviewState = 'awaiting' | 'approved' | 'flagged';

/**
 * Business verifications the BRD requires on top of the six KYC validations.
 * Deliberately a SEPARATE list rather than more `ValidationKind`s: that union is
 * keyed exhaustively by the tower, the Ops workbench and the customer app, and
 * widening it would renumber and reshape all three for a gap none of them has.
 */
export type VerificationKind = 'TIN' | 'CAC' | 'ID_DOC' | 'SANCTIONS' | 'WATCHLIST' | 'ADVERSE_MEDIA';

export const VERIFICATION_KINDS: VerificationKind[] = ['TIN', 'CAC', 'ID_DOC', 'SANCTIONS', 'WATCHLIST', 'ADVERSE_MEDIA'];

export const VERIFICATION_LABEL: Record<VerificationKind, string> = {
  TIN: 'TIN — FIRS',
  CAC: 'CAC registry',
  ID_DOC: 'ID document',
  SANCTIONS: 'Sanctions',
  WATCHLIST: 'Internal watchlist',
  ADVERSE_MEDIA: 'Adverse media',
};

export interface Verification {
  kind: VerificationKind;
  status: ValidationStatus;
  attempts: number;
  detail?: string;
  updatedAt: string;
}

/** A field whose value does not agree across the sources that carry it. The
 *  BRD asks for the specific source-pair to be named, not just "mismatch". */
export interface ReconIssue {
  field: string;
  sources: { name: string; value: string }[];
}

/** The §9.1 decision table's outcomes. `EXCEPTION` on its own could not say
 *  whether a case goes back to the submitter, to Compliance, or nowhere. */
export type BulkDecision =
  | 'straight-through'    // digital channel, everything passed
  | 'maker-review'        // OCR channel — mandatory review before creation
  | 'refer-requester'     // reconciliation mismatch, PEP — back to the RM
  | 'refer-compliance'    // sanctions, watchlist
  | 'auto-reject'         // identity / registration / document failure
  | 'terminate'           // confirmed sanctions or watchlist match
  | 'parked';             // verification service persistently unavailable

export const DECISION_LABEL: Record<BulkDecision, string> = {
  'straight-through': 'Straight through',
  'maker-review': 'Awaiting review',
  'refer-requester': 'Referred to you',
  'refer-compliance': 'With Compliance',
  'auto-reject': 'Auto-rejected',
  terminate: 'Terminated',
  parked: 'Parked',
};

/** Where a manifest-channel invitee got to. */
export type InviteState = 'sent' | 'opened' | 'completed' | 'lapsed';

export interface Invite {
  state: InviteState;
  sentAt: string;
  openedAt?: string;
  completedAt?: string;
  nudges: number;
  lastNudge?: string;
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
  /** Generated by the demo seeder rather than captured by anyone. Seeded rows
   *  stay out of the shared Data Fabric table: every browser makes its own from
   *  the same fixed id band, so sharing them would have browsers overwriting one
   *  another's demo data. */
  seeded?: boolean;
  /** Globally unique. `id` is a human reference (AO-2026-000147) minted from a
   *  per-browser counter, so two browsers reliably mint the SAME one — which is
   *  why a shared table keyed on it has records overwriting each other. Shared
   *  storage keys on this instead. Absent on records created before it existed. */
  uid?: string;
  /** The person who captured this application, when it was taken at a desk.
   *  Absent on a self-service opening — nobody was at a keyboard. Operations
   *  triages across the whole bank, so "whose capture is this" is what turns an
   *  unassigned queue back into something a person owns. */
  capturedBy?: string;
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

  // ── Bulk account opening. All optional: every one of these is absent on a
  // single capture, and on bulk rows created before the journey existed.
  /** Which intake channel this row arrived through. */
  bulkChannel?: BulkChannel;
  /** The maker checkpoint. Only OCR-extracted (`bundle`) rows ever carry it. */
  reviewState?: ReviewState;
  /** 0..100, what IXP reported for the read as a whole. */
  extractionConfidence?: number;
  /** Per-field confidence, so the review can highlight what to look at. */
  fieldConfidence?: Record<string, number>;
  /** Business verifications beyond the six KYC validations. */
  verifications?: Verification[];
  /** What was read off each uploaded document (type, tamper signals, MRZ, dates,
   *  fingerprint) — compact facts, judged against the Document rules DMN on every
   *  read. See src/integrations/docChecks.ts. */
  documentFacts?: { t: string; at: string; [k: string]: unknown }[];
  /** A person's decision on documents the rules referred or failed (BR-DOC-07). */
  documentReview?: { by: string; at: string; decision: 'accepted' | 'new-document-requested'; note?: string };
  /** Fields that do not agree across sources; empty or absent means they do. */
  recon?: ReconIssue[];
  /** The §9.1 outcome and the rule that produced it. */
  decision?: BulkDecision;
  decisionReason?: string;
  /** Post-no-debit at creation. Set by product rule, overridable with a deferral. */
  pnd?: boolean;
  deferralRef?: string;
  /** Who confirmed the extraction, and what they changed (BR-DOC-11). */
  reviewedBy?: string;
  reviewedAt?: string;
  edits?: { field: string; before: string; after: string; at: string; by: string }[];
  /** The checker who opened the account (four-eyes: never the same as
   *  `reviewedBy`). Absent on straight-through openings and older records. */
  openedBy?: string;
  openedAt?: string;
  /** Who has this case in Operations. Held on the record so a claim is shared,
   *  not per-device. `''` means explicitly unassigned (it overrides any older
   *  per-device claim); absent means nobody has written one to the record. */
  owner?: string;
  /** Manifest channel only — the invitation to self-complete. */
  invite?: Invite;
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
 *  `accountType` is the marker that matters: it is the only one that survives a
 *  reload. `entity` lives in memory alone — there is no Dataverse column for it —
 *  so a corporate case re-read from Dataverse used to come back classified as an
 *  individual and vanish from the Corporate filter.
 *
 *  AWAITING_EXTRACTION used to count as corporate here, back when only corporate
 *  uploaded a form and a draft had no other way to say what it was. The individual
 *  flow now uploads too and opens its draft in exactly that state, so the shortcut
 *  had begun filing scanned individual applications as corporate — putting them
 *  under the wrong filter and, worse, sending the desk to the corporate folder for
 *  their stage, where those instances do not exist. Both flows stamp accountType
 *  at draft time instead, which is durable and unambiguous. */
export const CORPORATE_ACCOUNT_TYPE = 'Corporate';

export const isCorporate = (c: Pick<OnboardingCase, 'entity' | 'state' | 'accountType'>) =>
  c.accountType === CORPORATE_ACCOUNT_TYPE || Boolean(c.entity);

// Fields a caller supplies to open a case; everything else is derived by the store.
export interface NewCaseInput extends ApplicantDetails {
  /** Overrides the ambient operator; normally left unset so create() stamps it. */
  capturedBy?: string;
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
  /** Bulk intake. */
  bulkChannel?: BulkChannel;
  reviewState?: ReviewState;
  extractionConfidence?: number;
  fieldConfidence?: Record<string, number>;
  verifications?: Verification[];
  /** What was read off each uploaded document (type, tamper signals, MRZ, dates,
   *  fingerprint) — compact facts, judged against the Document rules DMN on every
   *  read. See src/integrations/docChecks.ts. */
  documentFacts?: { t: string; at: string; [k: string]: unknown }[];
  /** A person's decision on documents the rules referred or failed (BR-DOC-07). */
  documentReview?: { by: string; at: string; decision: 'accepted' | 'new-document-requested'; note?: string };
  recon?: ReconIssue[];
  decision?: BulkDecision;
  decisionReason?: string;
  pnd?: boolean;
  invite?: Invite;
}
