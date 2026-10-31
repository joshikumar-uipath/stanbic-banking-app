// ─────────────────────────────────────────────────────────────────────────────
// Payload fixtures — the request/response contract for every external service.
//
// These are OUR BEST GUESS at each contract, not the client's. Field names and
// shapes are modelled on the published behaviour of each authority and on the
// BRD; they are marked `provenance: 'demo'` and each carries an `awaiting` note
// saying precisely what we asked Stanbic for.
//
// Every service carries at least three samples — ok, noMatch and timeout — and
// the screening service carries six, because a POSSIBLE match and a CONFIRMED
// match route to different people and that distinction drives most of §9.1.
// The failure and timeout samples matter as much as the happy path: roughly
// half the decision table exists to handle them.
//
// REPLACING THESE WITH REAL DATA
//   Drop the client's sample into `response`, set `provenance: 'client'` and
//   delete the `awaiting` line. If their field names differ, change them HERE —
//   the adapter in src/integrations reads through these, so nothing downstream
//   needs to know the shape moved.
// ─────────────────────────────────────────────────────────────────────────────
import type { ServiceFixture } from './types';

/** Standard latency bands, so retry behaviour is testable rather than instant. */
const FAST = 400;
const SLOW = 2_500;
const TIMEOUT = 30_000;

export const SERVICES: ServiceFixture[] = [
  // ── BVN — NIBSS ───────────────────────────────────────────────────────────
  // The bank's own contract: "BVN Validation Service REST API", a wrapper over
  // NIBSS. POST /api/Nibbs/GetSingleBVN with { bvn }; headers AppKey + AppId (the
  // caller's IP must also be profiled on WsProfiler). responseCode 00 valid,
  // 01 invalid, 500 not available — only 00 counts. Values are ours; the shape
  // is the bank's sample. Credentials are never stored here.
  {
    id: 'bvn', label: 'BVN verification', authority: 'NIBSS',
    provenance: 'derived',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: FAST, provenance: 'derived',
        request: { bvn: '22210000101' },
        response: {
          responseCode: '00', bvn: '22210000101',
          firstName: 'Adaeze', middleName: '', lastName: 'Okafor',
          dateOfBirth: '14-Mar-1988', registrationDate: '20-Dec-2016',
          enrollmentBank: '011', enrollmentBranch: 'Marina', email: '',
          gender: 'Female', levelOfAccount: 'Level 3 - High Level Accounts',
          lgaOfOrigin: 'Nnewi North', lgaOfResidence: 'Eti-Osa', maritalStatus: 'Single',
          nin: '101-200-00101', nameOnCard: 'Adaeze Okafor', nationality: 'Nigeria',
          phoneNumber1: '08030000101', phoneNumber2: '',
          residentialAddress: '12 Marina Road', stateOfOrigin: 'anambra state',
          stateOfResidence: 'lagos state', title: 'Ms.', watchListed: 'NO',
          base64Image: '<photo omitted>',
        },
      },
      {
        variant: 'noMatch', status: 200, latencyMs: FAST, provenance: 'derived',
        request: { bvn: '22210000107' },
        response: { responseCode: '01', bvn: '22210000107' },
      },
      {
        variant: 'timeout', status: 500, latencyMs: TIMEOUT, provenance: 'derived',
        request: { bvn: '22210000115' },
        response: { responseCode: '500' },
      },
      {
        variant: 'unavailable', status: 500, latencyMs: SLOW, provenance: 'derived',
        request: { bvn: '22210000115' },
        response: { responseCode: '500' },
      },
    ],
  },

  // ── NIN — NIMC, via the bank's NIN Linkage API ────────────────────────────
  // POST /api/v1/checkNIN { NIN, RequestID, AccountNo (base64), Key, Channel:
  // "IBPS" } validates the NIN; POST /api/v1/LinkNIN links NIN + BVN to an
  // account once it exists. Requests are the bank's (Postman collection); the
  // collection carries no sample responses, so the responses are ours.
  {
    id: 'nin', label: 'NIN verification', authority: 'NIMC',
    provenance: 'derived',
    awaiting: 'Sample responses for checkNIN and LinkNIN — the NIN Linkage collection documents requests only.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: FAST, provenance: 'demo',
        request: { NIN: '10120000101', RequestID: 'FBN-0000000101-NIN', AccountNo: 'OTk5OTk5OTk5OA==', Channel: 'IBPS' },
        response: {
          ResponseCode: '00', ResponseMessage: 'NIN validated successfully', RequestID: 'FBN-0000000101-NIN',
          NIN: '10120000101', FirstName: 'ADAEZE', MiddleName: '', LastName: 'OKAFOR',
          DateOfBirth: '1988-03-14', Gender: 'F', PhoneNumber: '08030000101',
        },
      },
      {
        variant: 'noMatch', status: 200, latencyMs: FAST, provenance: 'demo',
        request: { NIN: '10120000108', RequestID: 'FBN-0000000108-NIN', AccountNo: 'OTk5OTk5OTk5OA==', Channel: 'IBPS' },
        response: { ResponseCode: '01', ResponseMessage: 'NIN not found', RequestID: 'FBN-0000000108-NIN', NIN: '10120000108' },
      },
      {
        variant: 'possible', status: 200, latencyMs: FAST, provenance: 'demo',
        request: { NIN: '10120000111', RequestID: 'FBN-0000000111-NIN', AccountNo: 'OTk5OTk5OTk5OA==', Channel: 'IBPS' },
        response: {
          ResponseCode: '00', ResponseMessage: 'NIN validated successfully', RequestID: 'FBN-0000000111-NIN',
          // Deliberately five years out from the AOP — this is what drives the
          // reconciliation branch, and it is the most common real mismatch.
          NIN: '10120000111', FirstName: 'YAKUBU', MiddleName: '', LastName: 'CHUKWU',
          DateOfBirth: '1976-10-28', Gender: 'M', PhoneNumber: '08030000111',
        },
      },
      {
        variant: 'timeout', status: 500, latencyMs: TIMEOUT, provenance: 'demo',
        request: { NIN: '10120000115', RequestID: 'FBN-0000000115-NIN', AccountNo: 'OTk5OTk5OTk5OA==', Channel: 'IBPS' },
        response: { ResponseCode: '500', ResponseMessage: 'Service not available', RequestID: 'FBN-0000000115-NIN' },
      },
      {
        variant: 'unavailable', status: 500, latencyMs: SLOW, provenance: 'demo',
        request: { NIN: '10120000115', RequestID: 'FBN-0000000115-NIN-r4', AccountNo: 'OTk5OTk5OTk5OA==', Channel: 'IBPS' },
        response: { ResponseCode: '500', ResponseMessage: 'Service not available', RequestID: 'FBN-0000000115-NIN-r4' },
      },
    ],
  },

  // ── CAC registry ──────────────────────────────────────────────────────────
  {
    id: 'cac', label: 'Business registration', authority: 'Corporate Affairs Commission',
    provenance: 'demo',
    awaiting: 'CAC registry search contract and samples, including what it returns for a dissolved or inactive entity. Email item 5.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { rcNumber: 'BN 2481907', companyName: 'Nwosu Logistics Enterprises' },
        response: {
          status: 'found',
          company: {
            rcNumber: 'BN 2481907', companyName: 'NWOSU LOGISTICS ENTERPRISES',
            companyType: 'BUSINESS NAME', companyStatus: 'ACTIVE',
            registrationDate: '2016-06-08', natureOfBusiness: 'HAULAGE AND FREIGHT FORWARDING',
            registeredAddress: '219 ABA RD, PORT HARCOURT, RIVERS',
            proprietors: [{ name: 'EMEKA NWOSU', role: 'PROPRIETOR' }],
          },
        },
      },
      {
        variant: 'noMatch', status: 404, latencyMs: SLOW, provenance: 'demo',
        request: { rcNumber: 'BN 9999999', companyName: 'Unknown Ventures' },
        response: { status: 'not_found', message: 'No entity matches the supplied registration number' },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { rcNumber: 'BN 1772630' },
        response: { status: 'error', message: 'Registry did not respond' },
      },
    ],
  },

  // ── TIN — FIRS ────────────────────────────────────────────────────────────
  {
    id: 'tin', label: 'Tax identification', authority: 'FIRS',
    provenance: 'demo',
    awaiting: 'FIRS TIN verification contract and samples. Email item 5.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { tin: '20481907-0001', rcNumber: 'BN 2481907' },
        response: {
          responseCode: '00',
          data: {
            tin: '20481907-0001', taxpayerName: 'NWOSU LOGISTICS ENTERPRISES',
            taxOffice: 'PORT HARCOURT MTO', status: 'ACTIVE',
            registrationDate: '2016-07-02', taxpayerType: 'NON-INDIVIDUAL',
          },
        },
      },
      {
        variant: 'noMatch', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { tin: '30910244-0001', rcNumber: 'BN 3910244' },
        response: { responseCode: '04', responseMessage: 'TIN not found or inactive', data: null },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { tin: '10772630-0001' },
        response: { responseCode: '96', responseMessage: 'No response from FIRS' },
      },
    ],
  },

  // ── Identification document authenticity ──────────────────────────────────
  {
    id: 'idDoc', label: 'Identification document check', authority: '<UNRESOLVED — vendor not named in BRD>',
    provenance: 'demo',
    awaiting: 'Which vendor performs document authenticity, and its contract. The BRD names the check but not the provider. Email item 5.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { documentType: 'NATIONAL_ID', imageRef: 'dsx://BAO-0001/national-id.jpg' },
        response: {
          result: 'AUTHENTIC', confidence: 0.97,
          checks: { mrzChecksum: 'pass', fontConsistency: 'pass', portraitTamper: 'pass', expiry: 'pass' },
          extracted: { surname: 'OKAFOR', givenNames: 'ADAEZE', documentNumber: 'A01234567', expiryDate: '2029-05-30' },
        },
      },
      {
        variant: 'noMatch', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { documentType: 'NATIONAL_ID', imageRef: 'dsx://BAO-0010/national-id.jpg' },
        response: {
          result: 'FAILED', confidence: 0.31,
          checks: { mrzChecksum: 'fail', fontConsistency: 'fail', portraitTamper: 'pass', expiry: 'pass' },
          reason: 'MRZ checksum does not match the printed data',
        },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { documentType: 'NATIONAL_ID', imageRef: 'dsx://BAO-0015/national-id.jpg' },
        response: { result: 'ERROR', message: 'Document service timed out' },
      },
    ],
  },

  // ── Liveness ──────────────────────────────────────────────────────────────
  {
    id: 'liveness', label: 'Liveness and face match', authority: 'FaceID service',
    provenance: 'demo',
    awaiting: 'Confirmation this is the in-house FaceID service and its response contract, or the third-party vendor if not. Email items 3 and 5.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { selfieRef: 'dsx://BAO-0001/selfie.jpg', documentPortraitRef: 'dsx://BAO-0001/national-id.jpg' },
        response: { live: true, livenessScore: 0.96, faceMatch: true, matchScore: 0.93, threshold: 0.80 },
      },
      {
        variant: 'noMatch', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: { selfieRef: 'dsx://BAO-0016/selfie.jpg', documentPortraitRef: 'dsx://BAO-0016/national-id.jpg' },
        response: { live: true, livenessScore: 0.91, faceMatch: false, matchScore: 0.42, threshold: 0.80, reason: 'Face does not match the document portrait' },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { selfieRef: 'dsx://BAO-0015/selfie.jpg' },
        response: { error: 'Liveness service timed out' },
      },
    ],
  },

  // ── NICE Actimize — the four screening shapes ─────────────────────────────
  {
    id: 'screening', label: 'Sanctions, watchlist, PEP and adverse media', authority: 'NICE Actimize',
    provenance: 'demo',
    awaiting: 'All four response shapes separately, and for PEP a POSSIBLE match as well as a confirmed one — they route to different people. This is the highest-value item on the list: it covers more branches of the decision table than anything else. Email item 5.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: {
          requestId: 'BAO-0001', screeningType: ['SANCTIONS', 'WATCHLIST', 'PEP', 'ADVERSE_MEDIA'],
          subject: { fullName: 'Adaeze Okafor', dateOfBirth: '1988-03-14', nationality: 'NG', idNumber: '22210000101' },
        },
        response: {
          requestId: 'BAO-0001', overallStatus: 'CLEAR',
          results: [
            { screeningType: 'SANCTIONS', status: 'CLEAR', hits: [] },
            { screeningType: 'WATCHLIST', status: 'CLEAR', hits: [] },
            { screeningType: 'PEP', status: 'CLEAR', hits: [] },
            { screeningType: 'ADVERSE_MEDIA', status: 'CLEAR', hits: [] },
          ],
        },
      },
      {
        variant: 'possible', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: {
          requestId: 'BAO-0012', screeningType: ['PEP'],
          subject: { fullName: 'Funke Nwankwo', dateOfBirth: '1989-06-13', nationality: 'NG' },
        },
        response: {
          requestId: 'BAO-0012', overallStatus: 'POTENTIAL_MATCH',
          results: [{
            screeningType: 'PEP', status: 'POTENTIAL_MATCH',
            hits: [{
              matchId: 'PEP-773401', matchScore: 0.78, matchStrength: 'WEAK',
              listName: 'Global PEP Register',
              matchedName: 'FUNKE ADEBISI NWANKWO',
              position: 'Former Commissioner, State Ministry of Works',
              country: 'NG', dateOfBirth: '1989-06-13',
              // The reviewer needs to know WHY it matched, not just that it did.
              matchedFields: ['name', 'dateOfBirth'], unmatchedFields: ['middleName'],
            }],
          }],
        },
      },
      {
        variant: 'possible', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: {
          requestId: 'BAO-0013', screeningType: ['SANCTIONS', 'ADVERSE_MEDIA'],
          subject: { fullName: 'Sadiq Okon', dateOfBirth: '1974-03-09', nationality: 'NG' },
        },
        response: {
          requestId: 'BAO-0013', overallStatus: 'POTENTIAL_MATCH',
          results: [
            {
              screeningType: 'SANCTIONS', status: 'POTENTIAL_MATCH',
              hits: [{
                matchId: 'SAN-118902', matchScore: 0.84, matchStrength: 'MEDIUM',
                listName: 'OFAC SDN', matchedName: 'SADIQ OKON',
                programme: 'NPWMD', country: 'NG',
                matchedFields: ['name'], unmatchedFields: ['dateOfBirth', 'nationality'],
              }],
            },
            {
              screeningType: 'ADVERSE_MEDIA', status: 'POTENTIAL_MATCH',
              hits: [{
                matchId: 'AM-559021', matchScore: 0.71, category: 'FINANCIAL_CRIME',
                headline: 'Marine logistics operator named in customs inquiry',
                publishedDate: '2023-11-04', source: 'Regional business daily',
              }],
            },
          ],
        },
      },
      {
        variant: 'confirmed', status: 200, latencyMs: SLOW, provenance: 'demo',
        request: {
          requestId: 'BAO-0014', screeningType: ['WATCHLIST'],
          subject: { fullName: 'Halima Sani', dateOfBirth: '1980-12-21', nationality: 'NG', idNumber: '22210000114' },
        },
        response: {
          requestId: 'BAO-0014', overallStatus: 'CONFIRMED_MATCH',
          results: [{
            screeningType: 'WATCHLIST', status: 'CONFIRMED_MATCH',
            hits: [{
              matchId: 'IWL-004417', matchScore: 0.99, matchStrength: 'EXACT',
              listName: 'Internal Watchlist', matchedName: 'HALIMA SANI',
              reason: 'Previously exited relationship — internal financial crime referral',
              addedDate: '2021-08-17', addedBy: 'Financial Crime Unit',
              matchedFields: ['name', 'dateOfBirth', 'idNumber'], unmatchedFields: [],
            }],
          }],
        },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { requestId: 'BAO-0015', screeningType: ['SANCTIONS'] , subject: { fullName: 'Obinna Effiong' } },
        response: { error: 'SCREENING_TIMEOUT', message: 'No response from screening engine within the window' },
      },
      {
        variant: 'unavailable', status: 503, latencyMs: SLOW, provenance: 'demo',
        request: { requestId: 'BAO-0015-r4', screeningType: ['SANCTIONS'], subject: { fullName: 'Obinna Effiong' } },
        response: { error: 'SERVICE_UNAVAILABLE', message: 'Screening engine is not accepting requests' },
      },
    ],
  },

  // ── Core banking ──────────────────────────────────────────────────────────
  {
    id: 'coreBanking', label: 'Account creation', authority: 'Core banking',
    provenance: 'demo',
    awaiting: 'Account creation contract, the branch and product codes for the test environment, and crucially what it returns when the SAME customer is submitted twice — BR-PROV-04 idempotency cannot be tested without it. Email items 5 and 7.',
    samples: [
      {
        variant: 'ok', status: 201, latencyMs: SLOW, provenance: 'demo',
        request: {
          requestRef: 'BAO-0001', customerRef: 'BAO-0001',
          customer: { firstName: 'Adaeze', lastName: 'Okafor', bvn: '22210000101', nin: '10120000101', dateOfBirth: '1988-03-14' },
          productCode: 'SAV001', branchCode: '0001', currency: 'NGN',
          postNoDebit: false,
        },
        response: {
          responseCode: '00', responseMessage: 'Account created',
          data: { cif: '1002384471', accountNumber: '0123456789', accountStatus: 'ACTIVE', postNoDebit: false, openedAt: '2026-09-26T10:14:22Z' },
        },
      },
      {
        variant: 'ok', status: 201, latencyMs: SLOW, provenance: 'demo',
        request: {
          requestRef: 'BAO-0004', customerRef: 'BAO-0004',
          customer: { firstName: 'Emeka', lastName: 'Nwosu', bvn: '22210000104' },
          productCode: 'CUR010', branchCode: '0044', currency: 'NGN',
          postNoDebit: true, pndReason: 'Business account pending deferral clearance',
        },
        response: {
          responseCode: '00', responseMessage: 'Account created',
          data: { cif: '1002384512', accountNumber: '0123456812', accountStatus: 'ACTIVE', postNoDebit: true, openedAt: '2026-09-26T10:16:03Z' },
        },
      },
      {
        // BR-PROV-04. The same requestRef must never open a second account.
        variant: 'noMatch', status: 200, latencyMs: FAST, provenance: 'demo',
        request: { requestRef: 'BAO-0001', customerRef: 'BAO-0001', productCode: 'SAV001', branchCode: '0001' },
        response: {
          responseCode: '09', responseMessage: 'Duplicate request — account already exists for this reference',
          data: { cif: '1002384471', accountNumber: '0123456789', accountStatus: 'ACTIVE', created: false },
        },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { requestRef: 'BAO-0015', customerRef: 'BAO-0015', productCode: 'SAV001', branchCode: '0001' },
        response: { responseCode: '96', responseMessage: 'No response from core banking' },
      },
    ],
  },

  // ── Omniflow ──────────────────────────────────────────────────────────────
  {
    id: 'omniflow', label: 'Post-KYC case', authority: 'Omniflow',
    provenance: 'demo',
    awaiting: 'Omniflow case creation contract and the case type to raise. Email item 5.',
    samples: [
      {
        variant: 'ok', status: 201, latencyMs: SLOW, provenance: 'demo',
        request: {
          caseType: 'POST_KYC_REVIEW', customerRef: 'BAO-0001',
          accountNumber: '0123456789', cif: '1002384471',
          openedVia: 'BULK_ACCOUNT_OPENING', evidenceRef: 'dsx://BAO-0001/',
        },
        response: { status: 'created', omniflowCaseId: 'OMF-2026-114873', assignedQueue: 'POST KYC - LAGOS' },
      },
      {
        variant: 'noMatch', status: 422, latencyMs: FAST, provenance: 'demo',
        request: { caseType: 'POST_KYC_REVIEW', customerRef: 'BAO-0099', accountNumber: null },
        response: { status: 'rejected', message: 'Account number is required to raise a post-KYC case' },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { caseType: 'POST_KYC_REVIEW', customerRef: 'BAO-0015' },
        response: { status: 'error', message: 'Omniflow did not respond' },
      },
    ],
  },

  // ── DSX evidence store ────────────────────────────────────────────────────
  {
    id: 'dsx', label: 'Evidence store', authority: 'DSX',
    provenance: 'demo',
    awaiting: 'DSX upload contract, the folder convention for an account opening, and the retention policy. Email item 5.',
    samples: [
      {
        variant: 'ok', status: 201, latencyMs: SLOW, provenance: 'demo',
        request: {
          customerRef: 'BAO-0001', accountNumber: '0123456789',
          documents: [
            { name: 'account-opening-form.pdf', kind: 'aof', contentType: 'application/pdf', bytes: 248113 },
            { name: 'national-id.jpg', kind: 'id', contentType: 'image/jpeg', bytes: 91204 },
            { name: 'utility-bill.pdf', kind: 'address', contentType: 'application/pdf', bytes: 132880 },
          ],
          evidence: { verifications: 'BAO-0001/verifications.json', screening: 'BAO-0001/screening.json' },
        },
        response: {
          status: 'stored', dsxRef: 'dsx://account-opening/2026/09/BAO-0001/',
          storedCount: 5, retentionUntil: '2036-09-26',
        },
      },
      {
        variant: 'noMatch', status: 413, latencyMs: FAST, provenance: 'demo',
        request: { customerRef: 'BAO-0002', documents: [{ name: 'scan.pdf', bytes: 52428800 }] },
        response: { status: 'rejected', message: 'Document exceeds the maximum accepted size' },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'demo',
        request: { customerRef: 'BAO-0015' },
        response: { status: 'error', message: 'Evidence store did not respond' },
      },
    ],
  },

  // ── IXP / document extraction ─────────────────────────────────────────────
  {
    id: 'ixp', label: 'Document extraction', authority: 'UiPath IXP',
    provenance: 'derived',
    awaiting: 'A handful of real scanned AOFs so the model can be trained and the confidence thresholds set against genuine handwriting. The shape below is ours and is already correct; the VALUES need real forms. Email item 3.',
    samples: [
      {
        variant: 'ok', status: 200, latencyMs: SLOW, provenance: 'derived',
        request: { documentRef: 'dsx://BAO-0004/account-opening-form.pdf', taxonomy: 'corporate' },
        response: {
          documentId: 'ixp-9f31c2', taxonomy: 'corporate', pages: 4,
          fields: {
            businessName: { value: 'Nwosu Logistics Enterprises', confidence: 0.94 },
            registrationNumber: { value: 'BN 2481907', confidence: 0.88 },
            tin: { value: '20481907-0001', confidence: 0.71 },
            natureOfBusiness: { value: 'Haulage and freight forwarding', confidence: 0.83 },
            dateOfRegistration: { value: '08/06/2016', confidence: 0.62 },
            proprietorName: { value: 'Emeka Nwosu', confidence: 0.96 },
            bvn: { value: '22210000104', confidence: 0.97 },
          },
          // What the reader could not settle. These are the reason a form does
          // not go straight through, and the maker sees them above the fields.
          exceptions: [
            { code: 'LOW_CONFIDENCE', severity: 'medium', field: 'dateOfRegistration', detail: 'Handwritten year is ambiguous — could read 2016 or 2018' },
          ],
        },
      },
      {
        variant: 'noMatch', status: 200, latencyMs: SLOW, provenance: 'derived',
        request: { documentRef: 'dsx://BAO-0010/account-opening-form.pdf', taxonomy: 'individual' },
        response: {
          documentId: 'ixp-4a77b1', taxonomy: 'individual', pages: 2,
          fields: {
            firstName: { value: 'Amina', confidence: 0.92 },
            lastName: { value: 'Umeh', confidence: 0.90 },
            dateOfBirth: { value: null, confidence: null },
            bvn: { value: '22210000110', confidence: 0.95 },
          },
          exceptions: [
            { code: 'FIELD_NOT_FOUND', severity: 'high', field: 'dateOfBirth', detail: 'Date of birth box is blank on the scanned page' },
            { code: 'PAGE_MISSING', severity: 'critical', field: 'signature', detail: 'Signature page absent from the scan' },
          ],
        },
      },
      {
        variant: 'timeout', status: 504, latencyMs: TIMEOUT, provenance: 'derived',
        request: { documentRef: 'dsx://BAO-0015/account-opening-form.pdf', taxonomy: 'individual' },
        response: { error: 'EXTRACTION_TIMEOUT', message: 'Extraction did not complete within the window' },
      },
    ],
  },
];

export const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]));
