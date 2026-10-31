import { buildModel, T } from '../model';
import { LAYER, WHY_BASE, pick } from './catalog';

// Individual account opening — the OnboardingCase case plan
// (OnboardingCaseSolution/OnboardingCase/caseplan.json). The five stages and every
// task and gate title are the case plan's own. Each gate is the stage's task in
// the onboardingapprovalappao coded action app.
//
// Folder Banking/Account Opening/OnboardingCase — the same keys as
// src/onboarding/maestro.ts, copied rather than imported: that module writes to
// the tenant when it loads (see liveData.ts).
const FOLDER_KEY = '34480da8-1d41-479f-bf3f-40689043c59a';
const RELEASE_KEY = '381f59ef-2dd1-4c00-8395-4b3d055fe430';

export const individual = buildModel({
  key: 'individual',
  title: 'Individual account opening',
  blurb: 'One applicant, from the form they upload to the account they can use — through the OnboardingCase case plan, stage by stage.',
  maestro: { url: `${T}/maestro_/cases/${RELEASE_KEY}`, folderKey: FOLDER_KEY },
  layers: [
    { ...LAYER.experience, nodes: [pick('customerApp'), pick('desk'), pick('opsWorkbench')] },
    { ...LAYER.engagement, nodes: [pick('kycLink'), pick('voiceAgent')] },
    { ...LAYER.communication, nodes: [pick('twilio'), pick('outlook')] },
    { ...LAYER.hitl, nodes: [
      pick('actionCenter', { sub: 'Signs off every stage' }),
      pick('extractionReview', { sub: 'Confirms what IXP read' }),
    ] },
    { ...LAYER.orchestration, nodes: [
      pick('maestro', { sub: 'Case management — OnboardingCase', url: `${T}/maestro_/cases/${RELEASE_KEY}?folderKey=${FOLDER_KEY}` }),
      pick('orchestrator'), pick('exceptionStages'), pick('agents'), pick('integrationService'),
    ] },
    { ...LAYER.automation, nodes: [pick('rpa')] },
    { ...LAYER.docAI, nodes: [pick('ixp', { sub: 'IndividualAOF model' })] },
    { ...LAYER.identity, nodes: [pick('nimc'), pick('nibss'), pick('faceid'), pick('actimize')] },
    { ...LAYER.eventing, nodes: [pick('kafka')] },
    { ...LAYER.records, nodes: [pick('finacle'), pick('dataFabric'), pick('googleDrive')] },
    { ...LAYER.analytics, nodes: [pick('tower'), pick('caseMirror')] },
  ],
  stages: [
    {
      key: 'intake', label: 'Intake', primary: 'ixp', from: 'customerApp',
      active: ['customerApp', 'desk', 'ixp', 'extractionReview', 'rpa', 'finacle', 'dataFabric', 'maestro', 'orchestrator', 'actionCenter', 'kafka', 'twilio'],
      tasks: [
        { label: 'IXP - Extract pack', by: 'ixp' },
        { label: 'Confirm extracted details', by: 'extractionReview' },
        { label: 'Lookup customer & KYC profile', by: 'rpa' },
        { label: 'Pull relationships & CIF', by: 'finacle' },
      ],
      gate: 'Duplicate & risk pre-screen', gateBy: 'actionCenter',
      note: 'Application lands → IXP reads the pack → a person confirms it → robots look the customer up in Finacle.',
      plain: 'A new application has arrived. The AI reads the form and documents, a person confirms what it read, and the bank checks whether it already knows this customer.',
    },
    {
      key: 'verification', label: 'Verification', primary: 'faceid', from: 'maestro',
      active: ['maestro', 'orchestrator', 'rpa', 'nimc', 'nibss', 'integrationService', 'faceid', 'actimize', 'agents', 'exceptionStages', 'actionCenter', 'kafka', 'voiceAgent', 'kycLink', 'twilio', 'dataFabric', 'opsWorkbench'],
      tasks: [
        { label: 'Assemble verification package', by: 'rpa' },
        { label: 'NIN validation', by: 'nimc' },
        { label: 'BVN validation', by: 'nibss' },
        { label: 'Liveness & face match', by: 'faceid' },
        { label: 'Sanctions & PEP screening', by: 'actimize' },
        { label: 'Address & document authenticity', by: 'agents' },
      ],
      gate: 'Analyst review & exceptions', gateBy: 'actionCenter',
      note: 'NIN and BVN against the registers, liveness and face matching, screening through Actimize, authenticity by an agent — anything off goes to an analyst.',
      plain: 'Now the bank checks the applicant is real and allowed: their identity numbers against the national registers, their face against their ID, and their name against the sanctions lists.',
    },
    {
      key: 'decision', label: 'Decision', primary: 'exceptionStages', from: 'maestro',
      active: ['maestro', 'exceptionStages', 'agents', 'actimize', 'twilio', 'outlook', 'actionCenter', 'kafka', 'dataFabric', 'desk', 'voiceAgent'],
      tasks: [
        { label: 'Apply routing rules', by: 'maestro' },
        { label: 'Risk-based EDD trigger', by: 'exceptionStages' },
        { label: 'Notify outcome', by: 'twilio' },
      ],
      gate: 'Onboarding officer decision', gateBy: 'actionCenter',
      note: 'Routing rules decide the path; a high risk score sends the case to the EDD stage; the officer takes the decision.',
      plain: 'The evidence is weighed. A higher-risk applicant goes through enhanced due diligence first, and an onboarding officer makes the call.',
    },
    {
      key: 'activation', label: 'Activation', primary: 'finacle', from: 'rpa',
      active: ['maestro', 'orchestrator', 'rpa', 'finacle', 'agents', 'twilio', 'outlook', 'kafka', 'dataFabric', 'actionCenter', 'customerApp'],
      tasks: [
        { label: 'Create CIF & account (Finacle)', by: 'rpa' },
        { label: 'Provision channels & card', by: 'finacle' },
        { label: 'Mandate & funding setup', by: 'rpa' },
        { label: 'Customer & RM comms', by: 'agents' },
      ],
      gate: 'Activation sign-off', gateBy: 'actionCenter',
      note: 'A robot opens the CIF and account in Finacle; channels, card and mandate follow; an agent writes the welcome.',
      plain: 'Approved. A robot opens the real account in the bank’s core system, the channels and card are set up, and the customer and their RM are told.',
    },
    {
      key: 'closure', label: 'Closure', primary: 'googleDrive', from: 'finacle',
      active: ['maestro', 'googleDrive', 'integrationService', 'dataFabric', 'kafka', 'tower', 'caseMirror', 'actionCenter', 'outlook'],
      tasks: [
        { label: 'Case packet assembly', by: 'googleDrive' },
        { label: 'Schedule periodic KYC review', by: 'maestro' },
      ],
      gate: 'Generate audit report', gateBy: 'actionCenter',
      note: 'Packet filed to Drive, the next KYC review booked, the audit report generated, the outcome in the control tower.',
      plain: 'Case closed. The full packet is filed, the next KYC review is booked, and the result shows up in the dashboards.',
    },
  ],
  actions: {
    intake: { maestro: 'opening the case', ixp: 'reading the pack', rpa: 'looking up the customer', actionCenter: 'duplicate pre-screen', kafka: 'account-opening-requested' },
    verification: { maestro: 'running verification', nimc: 'validating NIN', nibss: 'validating BVN', faceid: 'liveness & face match', actimize: 'screening', agents: 'checking authenticity', voiceAgent: 'calling for missing documents', actionCenter: 'analyst review', kafka: 'nin + bvn validation' },
    decision: { maestro: 'applying routing rules', exceptionStages: 'EDD if risk warrants', actionCenter: 'officer decision', twilio: 'telling the customer', kafka: 'exception-queue' },
    activation: { maestro: 'sequencing activation', rpa: 'creating CIF & account', finacle: 'opening the account', agents: 'writing the welcome', actionCenter: 'activation sign-off', kafka: 'account-created' },
    closure: { maestro: 'closing the case', googleDrive: 'filing the packet', actionCenter: 'audit report', tower: 'updating the dashboards', kafka: 'customer-notification' },
  },
  why: {
    ...WHY_BASE,
    exceptionStages: 'The routes out of the happy path. A risk score over the threshold sends the case to EDD review; a true sanctions match to compliance; a missing document to Pending customer, where the voice agent can call. The case keeps its SLA the whole way.',
  },
  cases: [
    { Id: 'i1', CaseRef: 'AO-2026-000341', ApplicantName: 'Amara Okonkwo', Status: 'Activation', ApprovalStatus: '' },
    { Id: 'i2', CaseRef: 'AO-2026-000338', ApplicantName: 'Tunde Balogun', Status: 'Decision', ApprovalStatus: 'Pending' },
    { Id: 'i3', CaseRef: 'AO-2026-000335', ApplicantName: 'Ngozi Eze', Status: 'Verification', ApprovalStatus: '' },
    { Id: 'i4', CaseRef: 'AO-2026-000329', ApplicantName: 'Chidi Nwosu', Status: 'Closure', ApprovalStatus: '' },
    { Id: 'i5', CaseRef: 'AO-2026-000344', ApplicantName: 'Fatima Yusuf', Status: 'Intake', ApprovalStatus: '' },
  ],
});
