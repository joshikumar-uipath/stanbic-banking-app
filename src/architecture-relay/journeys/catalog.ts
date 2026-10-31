import { T, type NodeSpec, type LayerSpec } from '../model';

// ─────────────────────────────────────────────────────────────────────────────
// Every product and system the three journeys draw, defined once. A journey picks
// the ones it uses with `pick(id, overrides)` — usually to give a card a
// journey-specific subtitle (the IXP model name, the approval app it opens).
//
// What is real and what is stood in for, so the copy never over-claims:
//   real   — Maestro, Orchestrator, Action Center + the coded action apps, IXP,
//            Integration Service, Data Fabric, face matching (kiosk), the voice agent
//   mocked — NIBSS, NIMC, CAC, FIRS, SCUML, the ID-document vendor, NICE Actimize,
//            Finacle, Kafka, SMS/WhatsApp delivery and the control tower
//
// Vendors: 'uipath'; 'bank' for the bank's own estate (Finacle, its Kafka, its
// reporting, the customer app, the employee desk and Ops workbench, and the
// approval and review apps its people work in — built on UiPath, but the bank's),
// named and marked from the admin theme; 'threep' for everyone else, including
// Microsoft's Outlook. The voice agent is shown as UiPath. Cloud providers are not named on the
// canvas — face matching is shown as the UiPath capability the case calls.
//
// Card subtitles have ~28 characters before they run into the next card.
//
// Links to this app's own surfaces are bare hashes: they resolve against the
// page the relay is on, so they work on localhost and under the coded-app base.
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG: Record<string, NodeSpec> = {
  // ── Channels ───────────────────────────────────────────────────────────────
  customerApp: { id: 'customerApp', label: 'Customer app', sub: 'Apply & track on phone or web', plain: 'Where a customer opens an account themselves', vendor: 'bank', logo: 'bank', url: '#customer-web' },
  kycLink: { id: 'kycLink', label: 'KYC completion link', sub: 'Customer finishes their KYC', plain: 'A link the customer opens to supply what is missing', vendor: 'uipath', logo: 'uipath', url: '#kyc/DEMO01' },
  desk: { id: 'desk', label: 'Employee desk', sub: 'RM & operations workspace', plain: 'The branch and operations team’s workspace', vendor: 'bank', logo: 'bank', url: '#employee-web' },
  opsWorkbench: { id: 'opsWorkbench', label: 'Ops workbench', sub: 'Exception queues', plain: 'Where operations works the exceptions', vendor: 'bank', logo: 'bank', url: '#ops' },
  voiceAgent: { id: 'voiceAgent', label: 'Voice agent', sub: 'Calls the applicant', plain: 'Phones the customer when the case needs something from them', vendor: 'uipath', logo: 'uipath' },
  twilio: { id: 'twilio', label: 'SMS & WhatsApp', sub: 'Twilio, via Integration Svc', plain: 'Texts the customer at every step', vendor: 'threep', logo: 'whatsapp', url: '#comms' },
  outlook: { id: 'outlook', label: 'Outlook 365', sub: 'Mail to customer and RM', plain: 'Email to the customer and the relationship manager', vendor: 'threep', logo: 'Outlook 365', url: 'https://outlook.office.com' },

  // ── Human in the loop ──────────────────────────────────────────────────────
  actionCenter: { id: 'actionCenter', label: 'Approval app', sub: 'Signs off every stage', plain: 'The bank’s approval app, running in UiPath Action Center', vendor: 'bank', logo: 'bank', url: `${T}/actions_/tasks` },
  extractionReview: { id: 'extractionReview', label: 'Extraction review', sub: 'Confirms what IXP read', plain: 'The bank’s review app, running in UiPath Action Center', vendor: 'bank', logo: 'bank', url: `${T}/actions_/tasks` },
  makerReview: { id: 'makerReview', label: 'Maker review', sub: 'Operations · Maker', plain: 'The maker checks each OCR’d record against its documents', vendor: 'bank', logo: 'bank', url: '#employee-web' },
  verifierAuth: { id: 'verifierAuth', label: 'Verifier authorisation', sub: 'Operations · Verifier', plain: 'A second person authorises opening — never the maker', vendor: 'bank', logo: 'bank', url: '#employee-web' },
  batchFinalCheck: { id: 'batchFinalCheck', label: 'Batch final check', sub: 'One sign-off per batch', plain: 'One sign-off for the whole batch before accounts are created', vendor: 'bank', logo: 'bank', url: `${T}/actions_/tasks` },

  // ── Orchestration ──────────────────────────────────────────────────────────
  maestro: { id: 'maestro', label: 'UiPath Maestro', sub: 'Case management', plain: 'The conductor that runs the whole case, start to finish', vendor: 'uipath', logo: 'uipath', bar: true },
  orchestrator: { id: 'orchestrator', label: 'Orchestrator', sub: 'Jobs, robots and folders', plain: 'Runs the robots and holds the deployed case', vendor: 'uipath', logo: 'uipath', url: `${T}/orchestrator_/` },
  exceptionStages: { id: 'exceptionStages', label: 'Exception stages', sub: 'EDD, compliance, customer', plain: 'Where a case goes when it cannot go straight through', vendor: 'uipath', logo: 'uipath' },
  agents: { id: 'agents', label: 'UiPath Agents', sub: 'Authenticity, next action', plain: 'AI workers that do case steps without a human', vendor: 'uipath', logo: 'uipath', url: `${T}/orchestrator_/` },
  integrationService: { id: 'integrationService', label: 'Integration Service', sub: 'Outlook, Twilio, Drive', plain: 'The governed connectors the case calls out through', vendor: 'uipath', logo: 'uipath', url: `${T}/integrationservice_/` },
  onboardingCase: { id: 'onboardingCase', label: 'OnboardingCase × N', sub: 'One case per customer', plain: 'The individual onboarding case, started once per record', vendor: 'uipath', logo: 'uipath' },
  batchEngine: { id: 'batchEngine', label: 'Batch rules engine', sub: 'Decision rules & PND', plain: 'Decides each record’s route and its post-no-debit position', vendor: 'uipath', logo: 'uipath', url: '#employee-web' },

  // ── Automation ─────────────────────────────────────────────────────────────
  rpa: { id: 'rpa', label: 'UiPath Robots', sub: 'Registry & core-banking work', plain: 'Software robots that drive systems with no usable API', vendor: 'uipath', logo: 'uipath', url: `${T}/orchestrator_/` },

  // ── Document AI ────────────────────────────────────────────────────────────
  ixp: { id: 'ixp', label: 'UiPath IXP', sub: 'Reads the account form', plain: 'Classifies what arrived and reads the application form', vendor: 'uipath', logo: 'uipath' },
  zipSplitter: { id: 'zipSplitter', label: 'Bundle splitter', sub: 'One customer per AOP', plain: 'Opens the uploaded .zip and separates it per customer', vendor: 'uipath', logo: 'uipath' },

  // ── Identity & screening (all mocked with fixtures in this demo) ───────────
  nimc: { id: 'nimc', label: 'NIMC', sub: 'NIN validation', plain: 'The national identity register', vendor: 'threep', logo: 'NIMC' },
  nibss: { id: 'nibss', label: 'NIBSS', sub: 'BVN validation', plain: 'The bank verification number register', vendor: 'threep', logo: 'NIBSS' },
  faceid: { id: 'faceid', label: 'Face matching', sub: 'Liveness & face match', plain: 'Proves the person is live and matches their ID photo', vendor: 'uipath', logo: 'uipath', url: '#faceid' },
  actimize: { id: 'actimize', label: 'NICE Actimize', sub: 'Sanctions, PEP, adverse media', plain: 'Screens against sanctions, PEP and watch lists', vendor: 'threep', logo: 'NICE Actimize' },
  cac: { id: 'cac', label: 'CAC registry', sub: 'RC number & directors', plain: 'The Corporate Affairs Commission company register', vendor: 'threep', logo: 'CAC' },
  firs: { id: 'firs', label: 'FIRS', sub: 'TIN verification', plain: 'The federal tax register', vendor: 'threep', logo: 'FIRS' },
  scuml: { id: 'scuml', label: 'SCUML', sub: 'DNFBP registration', plain: 'The anti-money-laundering register for designated businesses', vendor: 'threep', logo: 'SCUML' },
  idDoc: { id: 'idDoc', label: 'ID document check', sub: 'Vendor not yet named', plain: 'Checks the ID document is genuine and current', vendor: 'threep', logo: 'ID vendor' },

  // ── Eventing ───────────────────────────────────────────────────────────────
  kafka: { id: 'kafka', label: 'Kafka', sub: 'Eight topics (mocked)', plain: 'The stream every downstream system listens to', vendor: 'bank', logo: 'Kafka', url: '#kafka' },

  // ── Systems of record ──────────────────────────────────────────────────────
  finacle: { id: 'finacle', label: 'Finacle', sub: 'Core banking — CIF & account', plain: 'The core banking system that actually opens the account', vendor: 'bank', logo: 'Finacle', url: '#finacle' },
  dataFabric: { id: 'dataFabric', label: 'Data Fabric', sub: 'AOFCase, AOFMaestroLink', plain: 'The case records and their links to running cases', vendor: 'uipath', logo: 'uipath', url: `${T}/dataservice_/` },
  googleDrive: { id: 'googleDrive', label: 'Google Drive', sub: 'Case packet & evidence', plain: 'Where the case packet and evidence are filed', vendor: 'threep', logo: 'Google Drive' },

  // ── Analytics ──────────────────────────────────────────────────────────────
  tower: { id: 'tower', label: 'Control tower', sub: 'Throughput & straight-through', plain: 'A Power BI–style report of what flows and what breaks', vendor: 'bank', logo: 'Power BI', url: '#tower' },
  caseMirror: { id: 'caseMirror', label: 'Case management view', flex: 1.1, sub: 'Stages & tasks per case', plain: 'Every case drawn as its Maestro stages and tasks', vendor: 'uipath', logo: 'uipath', url: '#cases' },
};

/** One catalog product, optionally with a journey-specific label/subtitle/link. */
export function pick(id: string, over: Partial<NodeSpec> = {}): NodeSpec {
  const base = CATALOG[id];
  if (!base) throw new Error(`relay catalog has no product "${id}"`);
  return { ...base, ...over, id };
}

/** The layer frames all three journeys share — a journey supplies the products. */
export const LAYER = {
  experience: { key: 'experience', label: 'Experience', sub: 'Where people work the case', icon: 'MonitorSmartphone', vend: 'bank' },
  engagement: { key: 'engagement', label: 'Engagement', sub: 'The case reaching the customer', icon: 'MessagesSquare', vend: 'uip' },
  communication: { key: 'communication', label: 'Communication', sub: 'Customer and staff messages', icon: 'Mail', vend: 'threep' },
  hitl: { key: 'hitl', label: 'Human in the loop', sub: 'The bank’s own decisions', icon: 'UserCheck', vend: 'bank' },
  orchestration: { key: 'orchestration', label: 'Orchestration', sub: 'The case backbone', icon: 'Workflow', vend: 'uip', hero: true },
  automation: { key: 'automation', label: 'Automation', sub: 'Robots doing the system work', icon: 'Bot', vend: 'uip' },
  docAI: { key: 'doc-ai', label: 'Document AI', sub: 'Reading what arrived', icon: 'ScanText', vend: 'uip' },
  identity: { key: 'identity', label: 'Identity & screening', sub: 'National registers and lists', icon: 'Fingerprint', vend: 'threep' },
  eventing: { key: 'eventing', label: 'Eventing', sub: 'How everything hears of it', icon: 'RadioTower', vend: 'bank' },
  records: { key: 'records', label: 'Systems of record', sub: 'Where the outcome is kept', icon: 'Landmark', vend: 'both' },
  analytics: { key: 'analytics', label: 'Analytics', sub: 'What flows, what breaks', icon: 'BarChart3', vend: 'bank' },
} satisfies Record<string, Omit<LayerSpec, 'nodes'>>;

/** Shared "why this product" lines; a journey overrides the ones it tells differently. */
export const WHY_BASE: Record<string, string> = {
  customerApp: 'The customer’s own banking app — phone or web — where they apply, upload their documents and watch their case move. It is a UiPath Coded App, so it reads the same case the bank works.',
  kycLink: 'A one-time link for the customer to finish their own KYC: the missing document, the selfie, the consent. It is how a stalled case becomes the customer’s action rather than a branch visit.',
  desk: 'The RM and operations workspace. Every case, every batch and every exception, in one place; it is the same Coded App as the customer side, so both read one record.',
  opsWorkbench: 'The operations team’s exception queues — where a case the automation could not settle lands with an owner.',
  voiceAgent: 'When a reviewer finds something missing the case can phone the applicant itself: it verifies who it is speaking to, explains what is outstanding and sends the upload link. The call comes back onto the case.',
  twilio: 'Every SMS and WhatsApp the customer receives, sent through the Twilio connection in Integration Service. In this demo the messages are derived from the case state and shown in the notification console.',
  outlook: 'Email to the customer and the RM through the Outlook 365 connection in Integration Service.',
  actionCenter: 'The governed human gate, and it is the bank’s: its own approval app, in its own branding, running in UiPath Action Center. Every stage closes on a task here, with a full audit trail — nothing advances without one.',
  extractionReview: 'The bank’s own review app, running in UiPath Action Center. A person confirms the fields IXP read before anything is checked against a register — so a misread name never reaches NIBSS or Finacle.',
  maestro: 'The conductor, and the differentiator. Maestro runs the case durably for as long as it takes — sequencing every stage, holding state, enforcing the SLA, routing to exception stages and waiting on people. Without it nothing coordinates the robots, agents, registers and human gates.',
  orchestrator: 'Runs the robots and processes the case calls, and holds the case deployment itself in its folder.',
  exceptionStages: 'The routes out of the happy path: EDD review, compliance escalation, pending customer, declined or withdrawn. A case that cannot go straight through moves to a stage someone owns rather than stalling.',
  agents: 'AI agents for the judgement steps: whether an address and document are authentic, what the next best action is, and writing the customer and RM messages.',
  integrationService: 'The governed connectors — Outlook 365, Twilio and Google Drive — so credentials and rate limits are managed once rather than per automation.',
  rpa: 'Software robots for the systems with no usable API: the registry look-ups and Finacle itself, driven exactly as a person would.',
  ixp: 'UiPath IXP reads the account-opening form and the documents that came with it, whatever shape they arrived in, and returns fields a person can confirm.',
  nimc: 'NIN validation against the national identity register. Mocked in this demo with fixtures; each register switches to live through an environment variable.',
  nibss: 'BVN validation against NIBSS — the name, date of birth and phone the bank already holds. Mocked in this demo.',
  faceid: 'Proves the applicant is a live person, then compares their face to the photo on their ID. This one is real — try it on the FaceID kiosk.',
  actimize: 'Sanctions, PEP, watch-list and adverse-media screening. Mocked in this demo with NICE Actimize-shaped responses.',
  cac: 'The Corporate Affairs Commission register — that the company exists, its RC number, and who its directors and shareholders are. Mocked.',
  firs: 'The federal tax register: that the TIN is real and belongs to this business. Mocked.',
  scuml: 'SCUML registration, required for designated non-financial businesses before a corporate account can open. Mocked.',
  idDoc: 'Checks the identity document itself is genuine and in date. The vendor is not yet chosen, so this is a placeholder check.',
  kafka: 'Every case transition is published as an event — account-opening-requested, nin-validation, bvn-validation, account-created, exception-queue, customer-notification and more — and everything downstream subscribes. A mock console in this demo.',
  finacle: 'The bank’s core banking system, where the CIF and account are really created. A mock Finacle back office in this demo.',
  dataFabric: 'UiPath Data Fabric holds the case record (AOFCase) and the link from each record to its running Maestro case (AOFMaestroLink), so every surface reads the same state.',
  googleDrive: 'Where the case packet, evidence and audit report are filed, through the Google Drive connection.',
  tower: 'The operational view — throughput, straight-through rate, and where cases break — drawn as a Power BI-style report. Simulated in this demo.',
  caseMirror: 'Every case drawn as its Maestro stages and tasks, so anyone can see where a case is without opening Maestro.',
};
