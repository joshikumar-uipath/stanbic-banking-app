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
  | 'PRE_REGISTERED'          // customer info captured, case created
  | 'VALIDATION_IN_PROGRESS'  // async validations running
  | 'VALIDATED'               // all mandatory validations passed
  | 'ACCOUNT_CREATED'         // Finacle CIF + account created
  | 'PENDING_DOCUMENTS'       // required documents outstanding
  | 'PENDING_LIVENESS'        // liveness verification outstanding
  | 'FULLY_ACTIVATED'         // all onboarding requirements complete
  | 'EXCEPTION';              // manual intervention required

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
];

export const stateMeta = (s: OnboardingState): StateMeta =>
  ONBOARDING_STATES.find((m) => m.state === s) ?? ONBOARDING_STATES[0];

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
export interface OnboardingCase {
  id: string;                 // AO-YYYY-NNNNNN
  firstName: string;
  lastName: string;
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
  createdAt: string;
  updatedAt: string;
  timeline: CaseEvent[];
}

export const fullName = (c: Pick<OnboardingCase, 'firstName' | 'lastName'>) =>
  `${c.firstName} ${c.lastName}`.trim();

// Fields a caller supplies to open a case; everything else is derived by the store.
export interface NewCaseInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  bvn: string;
  nin: string;
  address: string;
  employer?: string;
  channel?: Channel;
  source?: Source;
  batchId?: string;
}
