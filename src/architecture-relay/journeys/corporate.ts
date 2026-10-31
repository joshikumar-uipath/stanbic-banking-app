import { buildModel, T } from '../model';
import { LAYER, WHY_BASE, pick } from './catalog';

// Corporate account opening — the CorporateOnboardingCase case plan
// (CorporateOnboardingCaseSolution/CorporateOnboardingCase/caseplan.json, 21-day
// SLA). Same five stages as the individual case; the work inside them is the
// entity's: CAC and FIRS at intake, every director through NIN/BVN, UBO and SCUML
// at verification, the mandate and signatories at activation.
//
// The case plan puts "Mandate and signatory activation" before the last two
// Activation tasks; the relay draws a stage's gate last, so it closes the stage
// here. Keys as src/onboarding/maestro-corporate.ts, copied, not imported.
const FOLDER_KEY = '8c65336d-24e4-4032-9137-39467c1aefce';
const RELEASE_KEY = '441e0bda-1ea1-4b7e-8021-19bb048f55b6';

export const corporate = buildModel({
  key: 'corporate',
  title: 'Corporate account opening',
  blurb: 'One company — its registration, its directors, its owners and its signatories — through the CorporateOnboardingCase case plan.',
  maestro: { url: `${T}/maestro_/cases/${RELEASE_KEY}`, folderKey: FOLDER_KEY },
  layers: [
    { ...LAYER.experience, nodes: [pick('customerApp', { sub: 'Business applies online' }), pick('desk'), pick('opsWorkbench')] },
    { ...LAYER.engagement, nodes: [pick('kycLink', { sub: 'Signatories finish KYC' })] },
    { ...LAYER.communication, nodes: [pick('twilio'), pick('outlook')] },
    { ...LAYER.hitl, nodes: [
      pick('actionCenter', { sub: 'Signs off every stage' }),
      pick('extractionReview', { sub: 'Confirms the CAC pack read' }),
    ] },
    { ...LAYER.orchestration, nodes: [
      pick('maestro', { sub: 'Case management — CorporateOnboardingCase', url: `${T}/maestro_/cases/${RELEASE_KEY}?folderKey=${FOLDER_KEY}` }),
      pick('orchestrator'), pick('exceptionStages', { sub: 'Corporate EDD, compliance' }), pick('agents', { sub: 'CAC pack, authenticity' }), pick('integrationService'),
    ] },
    { ...LAYER.automation, nodes: [pick('rpa')] },
    { ...LAYER.docAI, nodes: [pick('ixp', { sub: 'CorporateAOF model', plain: 'Reads the certificate, MEMART and CAC forms' })] },
    { ...LAYER.identity, nodes: [pick('cac'), pick('firs'), pick('scuml'), pick('nimc', { sub: 'Director NIN' }), pick('nibss', { sub: 'Director BVN' }), pick('faceid', { sub: 'Signatory liveness' }), pick('actimize', { sub: 'Entity & directors' })] },
    { ...LAYER.eventing, nodes: [pick('kafka')] },
    { ...LAYER.records, nodes: [pick('finacle', { sub: 'Corporate CIF & account' }), pick('dataFabric'), pick('googleDrive')] },
    { ...LAYER.analytics, nodes: [pick('tower'), pick('caseMirror')] },
  ],
  stages: [
    {
      key: 'intake', label: 'Intake', primary: 'cac', from: 'customerApp',
      active: ['customerApp', 'desk', 'ixp', 'extractionReview', 'agents', 'rpa', 'cac', 'firs', 'finacle', 'maestro', 'orchestrator', 'actionCenter', 'dataFabric', 'kafka'],
      tasks: [
        { label: 'IXP - Extract pack (cert, MEMART, CO2/CO7)', by: 'ixp' },
        { label: 'Confirm extracted details', by: 'extractionReview' },
        { label: 'Analyse CAC pack', by: 'agents' },
        { label: 'Lookup entity & KYC profile', by: 'rpa' },
        { label: 'RC / CAC registry verification', by: 'cac' },
        { label: 'TIN verification (FIRS)', by: 'firs' },
      ],
      gate: 'Entity duplicate & risk pre-screen', gateBy: 'actionCenter',
      note: 'IXP reads the incorporation pack, an agent analyses it, and the entity is checked against CAC and FIRS.',
      plain: 'A company has applied. The AI reads its registration documents, and the bank confirms with the company and tax registers that it exists and is who it says it is.',
    },
    {
      key: 'verification', label: 'Verification', primary: 'actimize', from: 'maestro',
      active: ['maestro', 'orchestrator', 'rpa', 'nimc', 'nibss', 'actimize', 'faceid', 'agents', 'cac', 'scuml', 'integrationService', 'exceptionStages', 'actionCenter', 'kycLink', 'twilio', 'kafka', 'dataFabric', 'opsWorkbench'],
      tasks: [
        { label: 'Assemble entity verification package', by: 'rpa' },
        { label: 'Director NIN validation', by: 'nimc' },
        { label: 'Director BVN validation', by: 'nibss' },
        { label: 'Sanctions & PEP — entity and directors', by: 'actimize' },
        { label: 'Signatory liveness & face match', by: 'faceid' },
        { label: 'Business address & document authenticity', by: 'agents' },
        { label: 'UBO determination (>5% ownership)', by: 'cac' },
        { label: 'SCUML registration check', by: 'scuml' },
      ],
      gate: 'Directors & UBO verification', gateBy: 'actionCenter',
      note: 'Every director through NIN and BVN, the entity and directors through screening, signatories through liveness, owners over 5% identified.',
      plain: 'Now the people behind the company: every director’s identity, every signatory’s face, everyone who owns more than 5%, all screened against the sanctions lists.',
    },
    {
      key: 'decision', label: 'Decision', primary: 'exceptionStages', from: 'maestro',
      active: ['maestro', 'exceptionStages', 'agents', 'actimize', 'outlook', 'twilio', 'actionCenter', 'kafka', 'dataFabric', 'desk'],
      tasks: [
        { label: 'Apply corporate routing rules', by: 'maestro' },
        { label: 'Corporate risk rating & EDD trigger', by: 'exceptionStages' },
        { label: 'Notify outcome', by: 'outlook' },
      ],
      gate: 'Corporate mandate decision', gateBy: 'actionCenter',
      note: 'Corporate routing rules and a risk rating; a high rating sends the case to Corporate EDD (UBO and PEP) first.',
      plain: 'The company is risk-rated. A higher-risk entity goes through enhanced due diligence on its owners, and an officer decides on the mandate.',
    },
    {
      key: 'activation', label: 'Activation', primary: 'finacle', from: 'rpa',
      active: ['maestro', 'orchestrator', 'rpa', 'finacle', 'desk', 'agents', 'outlook', 'twilio', 'kafka', 'dataFabric', 'actionCenter', 'customerApp'],
      tasks: [
        { label: 'Create corporate CIF & account (Finacle)', by: 'rpa' },
        { label: 'Provision corporate channels & tokens', by: 'finacle' },
        { label: 'Mandate, signing limits & funding setup', by: 'rpa' },
        { label: 'Capture specimen signatures', by: 'desk' },
        { label: 'Entity & RM comms', by: 'agents' },
      ],
      gate: 'Mandate and signatory activation', gateBy: 'actionCenter',
      note: 'A robot opens the corporate CIF and account; tokens, signing limits and specimen signatures follow.',
      plain: 'Approved. The company’s account is opened in the core system, its signatories and their limits are set up, and the business and its RM are told.',
    },
    {
      key: 'closure', label: 'Closure', primary: 'googleDrive', from: 'finacle',
      active: ['maestro', 'googleDrive', 'integrationService', 'dataFabric', 'kafka', 'tower', 'caseMirror', 'actionCenter', 'outlook'],
      tasks: [
        { label: 'Corporate case packet assembly', by: 'googleDrive' },
        { label: 'Schedule risk-based KYC review', by: 'maestro' },
      ],
      gate: 'Corporate audit report', gateBy: 'actionCenter',
      note: 'Packet to Drive, a review date set by the risk rating, the audit report generated.',
      plain: 'Case closed. The packet is filed, the next review is booked — sooner for a higher-risk company — and the outcome feeds the dashboards.',
    },
  ],
  actions: {
    intake: { maestro: 'opening the entity case', ixp: 'reading the CAC pack', cac: 'checking the RC number', firs: 'checking the TIN', actionCenter: 'entity pre-screen', kafka: 'account-opening-requested' },
    verification: { maestro: 'verifying directors & UBOs', nimc: 'director NIN', nibss: 'director BVN', actimize: 'screening entity + directors', faceid: 'signatory liveness', scuml: 'SCUML check', actionCenter: 'directors & UBO review', kafka: 'nin + bvn validation' },
    decision: { maestro: 'corporate routing rules', exceptionStages: 'corporate EDD if needed', actionCenter: 'mandate decision', kafka: 'exception-queue' },
    activation: { maestro: 'sequencing activation', rpa: 'creating corporate CIF', finacle: 'opening the account', desk: 'specimen signatures', actionCenter: 'signatory activation', kafka: 'account-created' },
    closure: { maestro: 'closing the case', googleDrive: 'filing the packet', actionCenter: 'audit report', kafka: 'customer-notification' },
  },
  why: {
    ...WHY_BASE,
    agents: 'AI agents for the judgement steps: analysing the CAC pack for what it says about ownership and control, judging whether the business address and documents are authentic, and writing the entity and RM messages.',
    cac: 'The Corporate Affairs Commission register: that the company exists under this RC number, and who its directors and shareholders are — which is also how owners over 5% are found. Mocked.',
    exceptionStages: 'The routes out of the happy path. A high corporate risk rating sends the case to Corporate EDD (UBO and PEP); a sanctions match to compliance; a missing document to Pending customer. The 21-day SLA keeps running throughout.',
    desk: 'The RM and operations workspace — here also where each signatory’s specimen signature is captured against the mandate.',
  },
  cases: [
    { Id: 'c1', CaseRef: 'CAO-2026-000118', ApplicantName: 'Adeyemi Logistics Ltd', Status: 'Verification', ApprovalStatus: '' },
    { Id: 'c2', CaseRef: 'CAO-2026-000115', ApplicantName: 'Lekki Fresh Foods Plc', Status: 'Decision', ApprovalStatus: 'Pending' },
    { Id: 'c3', CaseRef: 'CAO-2026-000121', ApplicantName: 'Okafor & Sons Enterprises', Status: 'Intake', ApprovalStatus: '' },
    { Id: 'c4', CaseRef: 'CAO-2026-000109', ApplicantName: 'Kano Agro Holdings', Status: 'Activation', ApprovalStatus: '' },
    { Id: 'c5', CaseRef: 'CAO-2026-000102', ApplicantName: 'Ibadan Tech Hub Ltd', Status: 'Closure', ApprovalStatus: '' },
  ],
});
