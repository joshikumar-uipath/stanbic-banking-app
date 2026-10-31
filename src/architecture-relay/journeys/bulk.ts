import { buildModel, T } from '../model';
import { LAYER, WHY_BASE, pick } from './catalog';

// Bulk account opening — what the desk's Batches workbench actually does
// (src/employee/bulk/), joined to the batch BPMN that tracks it
// (BulkOnboardingBatchSolution/BulkOnboardingBatch.bpmn): one BPMN instance per
// batch, a parallel loop that starts OnboardingCase for each record, a batch
// summary, the BatchFinalCheck sign-off, then Finacle and the RM.
//
// Two things the copy is careful about, because they are true today:
//  - The batch BPMN is uploaded to Studio Web but not deployed. The desk starts
//    OnboardingCase directly, and only for the first MAESTRO_CAP (8) rows of a
//    batch; the rest are settled locally by the batch engine.
//  - The decision rules and PND position run in the desk (engine.ts), not in a
//    deployed service.
//
// The child case is the individual OnboardingCase deployment, so the Maestro
// links go there.
const FOLDER_KEY = '34480da8-1d41-479f-bf3f-40689043c59a';
const RELEASE_KEY = '381f59ef-2dd1-4c00-8395-4b3d055fe430';

export const bulk = buildModel({
  key: 'bulk',
  title: 'Bulk account opening',
  blurb: 'A whole batch — an Excel manifest or a bundle of scanned forms — split into one case per customer, reviewed by a maker, authorised by a verifier and signed off once.',
  maestro: { url: `${T}/maestro_/cases/${RELEASE_KEY}`, folderKey: FOLDER_KEY },
  layers: [
    { ...LAYER.experience, nodes: [pick('desk', { label: 'Batches workbench', sub: 'RM uploads & tracks batches', url: '#employee-web' })] },
    { ...LAYER.engagement, nodes: [pick('kycLink', { sub: 'Manifest customers self-serve' })] },
    { ...LAYER.communication, nodes: [pick('twilio'), pick('outlook', { sub: 'Mail to the RM' })] },
    { ...LAYER.hitl, nodes: [pick('makerReview'), pick('verifierAuth'), pick('batchFinalCheck'), pick('actionCenter', { sub: 'Each customer’s own gates' })] },
    { ...LAYER.orchestration, nodes: [
      pick('maestro', { sub: 'BPMN BulkOnboardingBatch — one instance per batch', url: `${T}/maestro_/cases/${RELEASE_KEY}?folderKey=${FOLDER_KEY}` }),
      pick('onboardingCase', { url: `${T}/maestro_/cases/${RELEASE_KEY}?folderKey=${FOLDER_KEY}` }),
      pick('batchEngine'), pick('orchestrator'), pick('integrationService'),
    ] },
    { ...LAYER.automation, nodes: [pick('rpa', { sub: 'Account creation in bulk' })] },
    { ...LAYER.docAI, nodes: [pick('zipSplitter'), pick('ixp', { sub: 'Reads each AOP' })] },
    { ...LAYER.identity, nodes: [pick('cac'), pick('firs'), pick('idDoc'), pick('actimize', { sub: 'Sanctions, watchlist, media' })] },
    { ...LAYER.eventing, nodes: [pick('kafka')] },
    { ...LAYER.records, nodes: [pick('finacle'), pick('dataFabric', { sub: 'A case record per customer' })] },
    { ...LAYER.analytics, nodes: [pick('tower')] },
  ],
  stages: [
    {
      key: 'intake', label: 'Batch intake', primary: 'zipSplitter', from: 'desk',
      active: ['desk', 'zipSplitter', 'ixp', 'batchEngine', 'kafka', 'maestro'],
      tasks: [
        { label: 'Upload manifest or AOP bundle', by: 'desk' },
        { label: 'Split one customer per AOP', by: 'zipSplitter' },
        { label: 'Read each account form', by: 'ixp' },
        { label: 'Reject incomplete records', by: 'batchEngine' },
      ],
      gate: 'RM submits the batch', gateBy: 'desk',
      note: 'A .csv manifest or a .zip of AOPs → split per customer → each AOP read → incomplete records bounced back before the batch starts.',
      plain: 'The RM uploads a batch. A bundle is split into one customer each and read; records missing an ID, proof of address or a reference are bounced back before anything starts.',
    },
    {
      key: 'fanout', label: 'Per-customer checks', primary: 'onboardingCase', from: 'maestro',
      active: ['maestro', 'onboardingCase', 'orchestrator', 'cac', 'firs', 'idDoc', 'actimize', 'batchEngine', 'kycLink', 'twilio', 'integrationService', 'actionCenter', 'dataFabric', 'kafka'],
      tasks: [
        { label: 'Register batch', by: 'maestro' },
        { label: 'Start OnboardingCase per customer', by: 'onboardingCase' },
        { label: 'Invite manifest customers', by: 'twilio' },
        { label: 'Verify CAC registration', by: 'cac' },
        { label: 'Verify TIN', by: 'firs' },
        { label: 'Verify identification document', by: 'idDoc' },
        { label: 'Screen sanctions, watchlist, media', by: 'actimize' },
        { label: 'Reconcile across sources', by: 'batchEngine' },
      ],
      gate: 'Each case’s own approvals', gateBy: 'actionCenter',
      note: 'The BPMN loops over the records and starts OnboardingCase for each; every customer is checked on their own, and keeps their own human tasks.',
      plain: 'Every customer in the batch gets their own case, running side by side. Manifest customers are invited to fill the form themselves; everyone is checked against the registers and the sanctions lists.',
    },
    {
      key: 'maker', label: 'Maker review', primary: 'makerReview', from: 'batchEngine',
      active: ['batchEngine', 'makerReview', 'desk', 'actionCenter', 'maestro', 'dataFabric', 'kafka'],
      tasks: [
        { label: 'Apply decision rules', by: 'batchEngine' },
        { label: 'Refer exceptions back to the RM', by: 'desk' },
      ],
      gate: 'Confirm extracted details', gateBy: 'makerReview',
      note: 'Watchlist → terminate; sanctions → compliance; identity failure → reject; mismatch or possible PEP → back to the RM; OCR’d data → maker; manifest data → straight through.',
      plain: 'The rules sort the batch: clean manifest records go straight through, anything read from a scan goes to a maker to check against its documents, and anything doubtful goes back to the RM.',
    },
    {
      key: 'verifier', label: 'Verifier authorisation', primary: 'verifierAuth', from: 'makerReview',
      active: ['verifierAuth', 'batchEngine', 'desk', 'maestro', 'dataFabric', 'kafka'],
      tasks: [
        { label: 'Keep maker and verifier apart', by: 'desk' },
        { label: 'Apply PND position', by: 'batchEngine' },
      ],
      gate: 'Authorise account opening', gateBy: 'verifierAuth',
      note: 'The verifier cannot be the maker. Business accounts open on post-no-debit; savings and salary open operative — overridable only against a deferral reference.',
      plain: 'A second person — never the one who checked the data — authorises each account. Business accounts open blocked for debits until their paperwork is complete.',
    },
    {
      key: 'final', label: 'Batch final check', primary: 'batchFinalCheck', from: 'verifierAuth',
      active: ['maestro', 'batchFinalCheck', 'onboardingCase', 'dataFabric', 'kafka'],
      tasks: [
        { label: 'Collect case outcomes', by: 'onboardingCase' },
        { label: 'Summarise batch', by: 'maestro' },
      ],
      gate: 'Final check: create all accounts', gateBy: 'batchFinalCheck',
      note: 'The BPMN collects every case’s outcome, summarises the batch and waits on one BatchFinalCheck task for the whole lot.',
      plain: 'Every customer’s outcome is gathered into one summary, and a person signs the whole batch off in one go.',
    },
    {
      key: 'opening', label: 'Account opening', primary: 'finacle', from: 'batchFinalCheck',
      active: ['maestro', 'rpa', 'finacle', 'outlook', 'twilio', 'integrationService', 'kafka', 'dataFabric', 'tower'],
      tasks: [
        { label: 'Create all accounts in Finacle', by: 'rpa' },
        { label: 'Publish account-created', by: 'kafka' },
        { label: 'Notify RM: accounts opened', by: 'outlook' },
        { label: 'Tell each customer', by: 'twilio' },
      ],
      note: 'Approved → the accounts are created together in Finacle → the RM is mailed → each customer is texted. Rejected → the RM is told the batch is returned.',
      plain: 'Signed off. The accounts are opened in the core system together, the RM hears the batch is done, and every customer gets their account details.',
    },
  ],
  actions: {
    intake: { maestro: 'batch submitted', desk: 'RM uploads the batch', zipSplitter: 'splitting the bundle', batchEngine: 'bouncing incomplete rows', kafka: 'bulk-upload' },
    fanout: { maestro: 'one case per customer, in parallel', onboardingCase: 'running per customer', actimize: 'screening', actionCenter: 'per-customer gates', kafka: 'account-opening-requested' },
    maker: { maestro: 'waiting on review', batchEngine: 'applying decision rules', makerReview: 'maker checks OCR’d rows', kafka: 'exception-queue' },
    verifier: { maestro: 'waiting on authorisation', verifierAuth: 'verifier authorises', batchEngine: 'setting PND' },
    final: { maestro: 'summarising the batch', batchFinalCheck: 'one sign-off for all' },
    opening: { maestro: 'creating all accounts', rpa: 'creating accounts', finacle: 'opening the accounts', kafka: 'account-created' },
  },
  why: {
    ...WHY_BASE,
    desk: 'The RM’s Batches workbench on the employee desk: upload a manifest or a bundle, watch every row move, and take back the ones referred to you.',
    kycLink: 'A manifest row carries only who the customer is, not their application — so each one gets a link to fill the form and do their own KYC. That is why manifest records need no maker.',
    maestro: 'The batch as one Maestro BPMN instance: register the batch, loop over every record starting its own case, collect the outcomes, and hold for one final sign-off before any account is created. Uploaded to Studio Web, not yet deployed — the desk starts the per-customer cases itself today.',
    onboardingCase: 'The same individual OnboardingCase, started once per customer and awaited. Each customer keeps every human task of their own. In the demo only the first 8 rows of a batch get a real case; 200 live instances on a shared tenant is not viable.',
    batchEngine: 'The decision rules, in order — watchlist terminates, sanctions refers to compliance, a service outage parks, an identity failure rejects, a mismatch or possible PEP goes back to the RM, OCR’d data goes to a maker, manifest data goes straight through — plus the post-no-debit position. Runs in the desk today.',
    ixp: 'Reads each customer’s account-opening form out of the bundle. In the bulk demo this read is still stood in for — see HANDOVER-BULK.md.',
    actionCenter: 'Each customer’s OnboardingCase keeps its own governed gates here, independent of the batch — the batch only decides when the accounts are created.',
    rpa: 'Creates the approved batch’s accounts in Finacle together, once the final check is signed.',
  },
  cases: [
    { Id: 'b1', CaseRef: 'BATCH-0412', ApplicantName: 'Lagos Island · 48 salary accounts', Status: 'Maker review', ApprovalStatus: 'Pending' },
    { Id: 'b2', CaseRef: 'BATCH-0409', ApplicantName: 'Ikeja · 12 business accounts', Status: 'Verifier authorisation', ApprovalStatus: 'Pending' },
    { Id: 'b3', CaseRef: 'BATCH-0415', ApplicantName: 'Abuja · 30 manifest rows', Status: 'Per-customer checks', ApprovalStatus: '' },
    { Id: 'b4', CaseRef: 'BATCH-0401', ApplicantName: 'Port Harcourt · 22 AOPs', Status: 'Batch final check', ApprovalStatus: 'Pending' },
    { Id: 'b5', CaseRef: 'BATCH-0417', ApplicantName: 'Kano · sole traders', Status: 'Batch intake', ApprovalStatus: '' },
  ],
});
