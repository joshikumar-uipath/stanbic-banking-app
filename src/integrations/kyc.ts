// ─────────────────────────────────────────────────────────────────────────────
// The BVN and NIN calls, as the desk shows them.
//
// Both contracts are the bank's own, from the documents it supplied:
//
//   BVN  — "BVN Validation Service REST API", a wrapper over NIBSS.
//          POST /api/Nibbs/GetSingleBVN  { bvn }
//          Answers with the identity NIBSS holds for that BVN. responseCode
//          "00" valid · "01" invalid · "500" service not available — and only
//          "00" counts. Validating a BVN is therefore two things: the code must be
//          00, AND the record NIBSS returns must be the person on the form.
//
//   NIN  — the "NIN Linkage" API (IBPS account-opening maintenance).
//          POST /api/v1/checkNIN  { NIN, RequestID, AccountNo, Key, Channel }
//            validates the NIN with NIMC at Verification. AccountNo is base64,
//            and before an account exists the collection sends a placeholder.
//          POST /api/v1/LinkNIN   { RequestID, AccountNo, NIN, vNIN, BVN, Channel, Key }
//            after the account is opened, ties the NIN (and BVN) to it — every
//            account must carry both.
//          The collection has NO sample responses, so the response shape below is
//          assumed (ResponseCode/ResponseMessage, mirroring the BVN service).
//
// Nothing here calls the network. Every response is built from the applicant's
// own record and agrees with the status the case reports for that check, so the
// panel can never show "Verified" over a 01. Credentials (AppKey, AppId, Key) are
// never in this file — the request shows them masked.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase, ValidationStatus } from '../onboarding/types';
import { seededStepAt, type SeedStep } from '../onboarding/store';

export interface Exchange {
  service: 'bvn' | 'nin-check' | 'nin-link';
  /** What the service is, for the panel header. */
  name: string;
  /** One line: what this call is for in account opening. */
  purpose: string;
  method: 'POST';
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  /** When the request went out, ISO — from the record's own event trail. Absent
      when it has not been sent. */
  sentAt?: string;
  /** null while the request is out and nothing has come back. */
  response: { http: number; latencyMs: number; body: Record<string, unknown> } | null;
  /** The bank's reading of the response, in words. */
  verdict: { tone: 'good' | 'crit' | 'idle'; text: string };
  /** Application vs. what the authority returned, field by field. */
  matches: { field: string; application: string; authority: string; ok: boolean }[];
  /** Why there is nothing to show (no BVN on the form, not reached yet, …). */
  note?: string;
}

const MASK = '•••••••• (from config)';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A small stable hash, so the same record always produces the same reply. */
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
/** yyyy-mm-dd → "06-Jan-1974", the way the BVN service writes dates. */
function nibssDate(iso?: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${MON[Number(m[2]) - 1]}-${m[1]}` : '';
}
/** The BVN service writes the NIN grouped, as in its sample ("304-403-5058"). */
function groupedNin(nin?: string): string {
  const d = (nin ?? '').replace(/\D/g, '');
  return d.length >= 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d;
}
const digits = (s?: string) => (s ?? '').replace(/\D/g, '');
const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const b64 = (s: string) => (typeof btoa === 'function' ? btoa(s) : s);

type Outcome = 'ok' | 'invalid' | 'unavailable' | 'waiting' | 'notReached';

/**
 * When a call went out. The event trail is the truth — the bvn-validation /
 * nin-validation / account-created events are stamped when the step ran, and the
 * seeder now back-dates a demo case's events onto its own history.
 *
 * Demo data seeded before that change has every event stamped in the same second
 * (the moment the seed ran). For those, place the call where the seeder would
 * now put it, anchored to that seed moment so the time does not drift. A live
 * Maestro check only carries the time it was last polled, so it is never used.
 */
function sentAtFor(c: OnboardingCase, topic: string, kind?: 'BVN' | 'NIN'): string | undefined {
  const STEP: Record<string, SeedStep> = { 'nin-validation': 'nin', 'bvn-validation': 'bvn', 'account-created': 'accountCreated' };
  const times = (c.timeline ?? []).map((e) => new Date(e.at).getTime()).filter((t) => !Number.isNaN(t));
  const seededAtOnce = c.seeded && times.length > 1 && Math.max(...times) - Math.min(...times) < 2_000;
  if (seededAtOnce && c.createdAt && STEP[topic]) return seededStepAt(c.createdAt, STEP[topic], Math.max(...times));
  const ev = (c.timeline ?? []).filter((e) => e.topic === topic).map((e) => e.at).sort();
  if (ev.length) return ev[ev.length - 1];
  return kind ? c.validations?.find((v) => v.kind === kind)?.updatedAt : undefined;
}

/** The row's status decides which reply came back. */
function outcomeOf(st: ValidationStatus | undefined): Outcome {
  switch (st) {
    case 'passed': return 'ok';
    case 'failed': return 'invalid';
    case 'timeout': return 'unavailable';
    case 'running': case 'retrying': return 'waiting';
    default: return 'notReached';
  }
}

/** Account-opening requests are referenced by the application, FBN-prefixed as in
 *  the bank's collection. */
const requestId = (c: OnboardingCase, step: string) =>
  `FBN-${c.id.replace(/[^0-9]/g, '').slice(-10)}-${step}`;

// ── BVN ─────────────────────────────────────────────────────────────────────
export function bvnExchange(c: OnboardingCase, st: ValidationStatus | undefined): Exchange {
  const bvn = digits(c.bvn);
  const base: Exchange = {
    service: 'bvn',
    name: 'BVN Validation Service · NIBSS',
    purpose: 'Asks NIBSS who this BVN belongs to, then checks that person is the applicant and is not watch-listed.',
    method: 'POST', path: '/api/Nibbs/GetSingleBVN',
    headers: { 'Content-Type': 'application/json', AppKey: MASK, AppId: MASK },
    body: { bvn },
    response: null, verdict: { tone: 'idle', text: '' }, matches: [],
  };
  if (!bvn) return { ...base, verdict: { tone: 'idle', text: 'Not sent' }, note: 'No BVN on the application, so there is nothing to validate.' };

  const o = outcomeOf(st);
  const latencyMs = 280 + (h(c.id + 'bvn') % 900);
  if (o === 'notReached') return { ...base, verdict: { tone: 'idle', text: 'Not sent yet' }, note: 'The case has not reached BVN validation yet.' };
  base.sentAt = sentAtFor(c, 'bvn-validation', 'BVN');
  if (o === 'waiting') return { ...base, verdict: { tone: 'idle', text: 'Awaiting NIBSS' }, note: 'Request sent — waiting for NIBSS to answer.' };
  if (o === 'unavailable') {
    return {
      ...base,
      response: { http: 500, latencyMs: 30_000, body: { responseCode: '500' } },
      verdict: { tone: 'crit', text: '500 — Service not available. Parked for retry; only "00" counts as valid.' },
    };
  }
  if (o === 'invalid') {
    return {
      ...base,
      response: { http: 200, latencyMs, body: { responseCode: '01', bvn } },
      verdict: { tone: 'crit', text: '01 — Invalid BVN. NIBSS holds no record for this number.' },
    };
  }

  // 00 — NIBSS's record, which for a verified applicant is the applicant.
  const record: Record<string, unknown> = {
    responseCode: '00',
    bvn,
    firstName: c.firstName ?? '',
    middleName: c.middleName ?? '',
    lastName: c.lastName ?? '',
    dateOfBirth: nibssDate(c.dob),
    registrationDate: `${10 + (h(bvn) % 18)}-${MON[h(bvn + 'm') % 12]}-${2014 + (h(bvn + 'y') % 8)}`,
    enrollmentBank: '011',
    enrollmentBranch: c.branch || c.city || 'Marina',
    email: c.email ?? '',
    gender: c.gender ?? '',
    levelOfAccount: 'Level 3 - High Level Accounts',
    lgaOfOrigin: '',
    lgaOfResidence: c.lga ?? '',
    maritalStatus: c.maritalStatus ?? '',
    nin: groupedNin(c.nin),
    nameOnCard: [c.firstName, c.lastName].filter(Boolean).join(' '),
    nationality: c.nationality || 'Nigeria',
    phoneNumber1: digits(c.phone),
    phoneNumber2: digits(c.altPhone),
    residentialAddress: c.address ?? '',
    stateOfOrigin: c.stateOfOrigin ? `${c.stateOfOrigin.toLowerCase()} state` : '',
    stateOfResidence: c.stateOfResidence ? `${c.stateOfResidence.toLowerCase()} state` : '',
    title: c.title ? `${c.title.replace(/\.$/, '')}.` : '',
    watchListed: 'NO',
    base64Image: '<photo omitted>',
  };
  const matches = [
    { field: 'First name', application: c.firstName ?? '', authority: String(record.firstName) },
    { field: 'Last name', application: c.lastName ?? '', authority: String(record.lastName) },
    { field: 'Date of birth', application: c.dob ?? '', authority: String(record.dateOfBirth) },
    { field: 'Phone', application: digits(c.phone), authority: String(record.phoneNumber1) },
    // The BVN record carries the NIN too — the one place the two checks meet.
    { field: 'NIN on the BVN record', application: digits(c.nin), authority: String(record.nin) },
  ].filter((m) => m.application)
    .map((m) => ({ ...m, ok: m.field === 'Date of birth' ? nibssDate(m.application) === m.authority
      : m.field.startsWith('NIN') || m.field === 'Phone' ? digits(m.application) === digits(m.authority)
      : norm(m.application) === norm(m.authority) }));
  matches.push({ field: 'Watch-listed', application: '—', authority: 'NO', ok: true });

  return {
    ...base,
    response: { http: 200, latencyMs, body: record },
    verdict: { tone: 'good', text: '00 — Valid BVN. The record NIBSS returned is the applicant, and they are not watch-listed.' },
    matches,
  };
}

// ── NIN: checkNIN (Verification) ────────────────────────────────────────────
export function ninCheckExchange(c: OnboardingCase, st: ValidationStatus | undefined): Exchange {
  const nin = digits(c.nin);
  // Before the account exists the collection sends a placeholder account, base64.
  const accountNo = b64(c.accountNumber || '9999999998');
  const base: Exchange = {
    service: 'nin-check',
    name: 'NIN Linkage API · checkNIN · NIMC',
    purpose: 'Validates the NIN with NIMC and returns the identity it belongs to, so it can be matched to the applicant.',
    method: 'POST', path: '/api/v1/checkNIN',
    headers: { 'Content-Type': 'application/json', Origin: 'customer-nin-update-portal', AppId: MASK, AppKey: MASK },
    body: { NIN: nin, RequestID: requestId(c, 'NIN'), AccountNo: accountNo, Key: MASK, Channel: 'IBPS' },
    response: null, verdict: { tone: 'idle', text: '' }, matches: [],
  };
  if (!nin) return { ...base, verdict: { tone: 'idle', text: 'Not sent' }, note: 'No NIN on the application, so there is nothing to validate.' };

  const o = outcomeOf(st);
  const latencyMs = 340 + (h(c.id + 'nin') % 1100);
  if (o === 'notReached') return { ...base, verdict: { tone: 'idle', text: 'Not sent yet' }, note: 'The case has not reached NIN validation yet.' };
  base.sentAt = sentAtFor(c, 'nin-validation', 'NIN');
  if (o === 'waiting') return { ...base, verdict: { tone: 'idle', text: 'Awaiting NIMC' }, note: 'Request sent — waiting for NIMC to answer.' };
  if (o === 'unavailable') {
    return {
      ...base,
      response: { http: 500, latencyMs: 30_000, body: { ResponseCode: '500', ResponseMessage: 'Service not available', RequestID: base.body.RequestID } },
      verdict: { tone: 'crit', text: '500 — NIMC did not answer. Parked for retry.' },
    };
  }
  if (o === 'invalid') {
    return {
      ...base,
      response: { http: 200, latencyMs, body: { ResponseCode: '01', ResponseMessage: 'NIN not found', RequestID: base.body.RequestID, NIN: nin } },
      verdict: { tone: 'crit', text: '01 — NIMC holds no record for this NIN.' },
    };
  }
  const body = {
    ResponseCode: '00',
    ResponseMessage: 'NIN validated successfully',
    RequestID: base.body.RequestID,
    NIN: nin,
    FirstName: (c.firstName ?? '').toUpperCase(),
    MiddleName: (c.middleName ?? '').toUpperCase(),
    LastName: (c.lastName ?? '').toUpperCase(),
    DateOfBirth: c.dob ?? '',
    Gender: (c.gender ?? '').charAt(0).toUpperCase(),
    PhoneNumber: digits(c.phone),
  };
  const matches = [
    { field: 'First name', application: c.firstName ?? '', authority: body.FirstName },
    { field: 'Last name', application: c.lastName ?? '', authority: body.LastName },
    { field: 'Date of birth', application: c.dob ?? '', authority: body.DateOfBirth },
  ].filter((m) => m.application).map((m) => ({ ...m, ok: norm(m.application) === norm(m.authority) }));
  return {
    ...base,
    response: { http: 200, latencyMs, body },
    verdict: { tone: 'good', text: '00 — NIN is valid and belongs to the applicant.' },
    matches,
  };
}

// ── NIN: LinkNIN (after the account is opened) ──────────────────────────────
export function ninLinkExchange(c: OnboardingCase): Exchange {
  const nin = digits(c.nin);
  const base: Exchange = {
    service: 'nin-link',
    name: 'NIN Linkage API · LinkNIN',
    purpose: 'Links the NIN and BVN to the new account number — every account must carry both.',
    method: 'POST', path: '/api/v1/LinkNIN',
    headers: { 'Content-Type': 'application/json', Origin: 'customer-nin-update-portal', AppId: MASK },
    body: { RequestID: requestId(c, 'LINK'), AccountNo: c.accountNumber ?? '', NIN: nin, vNIN: '', BVN: digits(c.bvn), Channel: 'IBPS', Key: MASK },
    response: null, verdict: { tone: 'idle', text: '' }, matches: [],
  };
  if (!c.accountNumber) {
    return { ...base, verdict: { tone: 'idle', text: 'Runs at Activation' }, note: 'Sent once the account is opened in Finacle — there is no account number to link to yet.' };
  }
  if (!nin) return { ...base, verdict: { tone: 'idle', text: 'Not sent' }, note: 'No NIN on the application to link.' };
  return {
    ...base,
    sentAt: sentAtFor(c, 'account-created') ?? c.updatedAt,
    response: {
      http: 200, latencyMs: 420 + (h(c.id + 'link') % 700),
      body: { ResponseCode: '00', ResponseMessage: 'NIN linked to account successfully', RequestID: base.body.RequestID, AccountNo: c.accountNumber },
    },
    verdict: { tone: 'good', text: `00 — NIN and BVN are linked to account ${c.accountNumber}.` },
  };
}
