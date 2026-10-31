// ─────────────────────────────────────────────────────────────────────────────
// The bulk-opening rules that are not screens.
//
// Constants and small pure helpers the Batches screens share — the intake
// segments and manifest format, the fields a maker adjudicates, the exception
// reason codes, the invitation funnel. They used to live inside each desk screen;
// they are here so the phone's Batches (src/employee/mobile) applies exactly the
// same rules as the desk instead of a copy that would drift.
// ─────────────────────────────────────────────────────────────────────────────
import { getActiveCountry, kycLabel } from '../../config/countries';
import { DECISION_LABEL, type InviteState, type OnboardingCase } from '../../onboarding';
import type { ExtractedApplicant } from '../bulk';
import type { IntakeRejection } from './batches';
import { actorOr } from '../actor';

const CO = getActiveCountry();

// ── Intake ───────────────────────────────────────────────────────────────────
export const SEGMENTS = [
  'Business Name (BN) — CAC registered',
  'Sole Trader',
  'Retail — Employee Value Banking',
];

/** The booking branches offered at intake, labelled the way the desk shows them. */
export const branchOptions = (): string[] =>
  CO.cities.slice(0, 3).map((c, i) => `${c} — ${String(42 + i * 11).padStart(4, '0')}`);

export const batchNameHint = (): string => `${CO.companies[3] ?? CO.companies[0]} — Sept drive`;

/** A manifest is a control list: a reference and the identifiers that pin a
 *  person down, nothing more. Anything wider is an attempt to submit data. */
export const MANIFEST_COLUMNS = ['Reference', 'First name', 'Last name', kycLabel('BVN', CO), kycLabel('NIN', CO), 'Phone', 'Email'];

export function sampleManifest(): string {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const f = CO.firstNames[i % CO.firstNames.length];
    const l = CO.lastNames[(i * 7 + 3) % CO.lastNames.length];
    return [
      `EVB-${String(i + 1).padStart(3, '0')}`, f, l,
      `${CO.primaryId.numPrefix}${String(1000001 + i).slice(-7)}`,
      `${CO.secondaryId.numPrefix}${String(2000001 + i).slice(-7)}`,
      `${CO.phoneTrunk}${String(3000001 + i).slice(-7)}`,
      `${f.toLowerCase()}.${l.toLowerCase()}@payroll.example`,
    ].join(',');
  });
  return [MANIFEST_COLUMNS.join(','), ...rows].join('\n');
}

/** How many data rows a pasted manifest holds (a header row is not one). */
export function manifestRowCount(text: string): number {
  const lines = text.split(/\r?\n/);
  return lines.filter((l) => l.trim()).length - (/reference|name|bvn/i.test(lines[0] ?? '') ? 1 : 0);
}

/** Manifest rows → the same applicant shape a bundle produces, so one engine
 *  serves both channels from here on. */
export function parseManifest(text: string): { rows: ExtractedApplicant[]; bad: IntakeRejection[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const body = /reference|name|bvn|nin/i.test(lines[0] ?? '') ? lines.slice(1) : lines;
  const rows: ExtractedApplicant[] = [];
  const bad: IntakeRejection[] = [];
  const seen = new Set<string>();

  body.forEach((line, i) => {
    const c = line.split(',').map((s) => s.trim());
    const [ref, first, last, bvn, nin, phone, email] = c;
    const who = `${first ?? ''} ${last ?? ''}`.trim();
    const where = ref || `row ${i + 2}`;
    if (!ref) { bad.push({ source: `row ${i + 2}`, customer: who, reason: 'No unique reference in the first column', fixable: true }); return; }
    if (!who) { bad.push({ source: where, customer: '', reason: 'No name against the reference', fixable: true }); return; }
    if (!bvn && !nin) { bad.push({ source: where, customer: who, reason: `Neither ${kycLabel('BVN', CO)} nor ${kycLabel('NIN', CO)} given — the row identifies nobody`, fixable: true }); return; }
    if (!email && !phone) { bad.push({ source: where, customer: who, reason: 'No email or phone — there is no way to send the invitation', fixable: true }); return; }
    if (seen.has(ref)) { bad.push({ source: where, customer: who, reason: 'Reference appears more than once in this manifest', fixable: false }); return; }
    seen.add(ref);
    rows.push({
      firstName: first, lastName: last, phone: phone ?? '', email: email ?? '',
      bvn: bvn ?? '', nin: nin ?? '', address: '',
      docs: [], complete: true, missing: [],
    });
  });
  return { rows, bad };
}

// ── Maker review ─────────────────────────────────────────────────────────────
/** The demo maker persona. The desk still names it; writes should use reviewer(). */
export const REVIEWER = 'Ifeoma Nwosu';
/** Who is confirming extractions on this device: the signed-in actor when one
 *  is set (src/employee/actor.ts), else the demo persona. */
export const reviewer = (): string => actorOr(REVIEWER);

/** The fields a maker actually adjudicates, in the order the form asks them. */
export const REVIEW_FIELDS: { key: string; label: string; of: (c: OnboardingCase) => string }[] = [
  { key: 'firstName', label: 'First name', of: (c) => c.firstName },
  { key: 'lastName', label: 'Last name', of: (c) => c.lastName },
  { key: 'dob', label: 'Date of birth', of: (c) => c.dob ?? '14/03/1988' },
  { key: 'bvn', label: kycLabel('BVN', CO), of: (c) => c.bvn },
  { key: 'nin', label: kycLabel('NIN', CO), of: (c) => c.nin },
  { key: 'tin', label: 'Tax ID (TIN)', of: (c) => c.tin ?? '20441887-0001' },
  { key: 'address', label: 'Address', of: (c) => c.address },
];

/** The maker's queue order: the doubtful work first. */
export const byConfidence = (a: OnboardingCase, b: OnboardingCase) =>
  (a.extractionConfidence ?? 100) - (b.extractionConfidence ?? 100);

// ── Verifier ─────────────────────────────────────────────────────────────────
/** The demo checker persona. The desk still names it; writes should use verifier(). */
export const VERIFIER = 'Chidinma Eze';
/** Who is authorising openings on this device: the actor when set, else the persona. */
export const verifier = (): string => actorOr(VERIFIER);

// ── Exceptions ───────────────────────────────────────────────────────────────
export const EXCEPTION_REASONS = [
  'PEP — false positive, a different person',
  'PEP — true match, approval attached',
  'Date of birth — the customer confirms the registry is right',
  'Date of birth — the registry is wrong, correction lodged',
  'Document quality — replacement obtained',
  'Cannot resolve — return to the customer',
];

/** 24h / 48h / 5 days, as §9.3 sets them. */
export function ageBucket(iso: string): { label: string; step: number } {
  const h = (Date.now() - Date.parse(iso)) / 3600_000;
  if (h < 24) return { label: 'Under 24h', step: 0 };
  if (h < 48) return { label: 'Over 24h', step: 1 };
  if (h < 120) return { label: 'Over 48h', step: 2 };
  return { label: 'Over 5 days', step: 3 };
}

// ── Monitor ──────────────────────────────────────────────────────────────────
/**
 * What the decision column should say RIGHT NOW.
 *
 * `c.decision` records the routing the rule engine chose when the application
 * was decided; it does not move afterwards. So a row a maker has already
 * confirmed still carried "Awaiting review", which is worse than unhelpful —
 * it tells an RM someone still has to look at something nobody does. The live
 * position wins wherever it differs.
 */
export function decisionLabel(c: OnboardingCase): string {
  if (c.accountNumber) return `Account ${c.accountNumber}`;
  if (c.reviewState === 'approved') return 'With authoriser';
  if (c.reviewState === 'flagged') return 'Flagged at review';
  return c.decision ? DECISION_LABEL[c.decision] : 'Verifying…';
}

// ── Invitations (manifest channel) ───────────────────────────────────────────
export const INVITE_LABEL: Record<InviteState, string> = { sent: 'Invited', opened: 'Opened the link', completed: 'Completed', lapsed: 'No response' };

/** An invitee's state, derived from the case when the manifest row has no
 *  explicit invite yet — a row that reached an account plainly completed. */
export function inviteStateOf(c: OnboardingCase): InviteState {
  if (c.invite) return c.invite.state;
  if (c.accountNumber || c.state === 'ACCOUNT_CREATED' || c.state === 'FULLY_ACTIVATED') return 'completed';
  if (c.state === 'VALIDATION_IN_PROGRESS' || c.state === 'VALIDATED') return 'opened';
  if (Date.now() - Date.parse(c.createdAt) > 3 * 24 * 3600_000) return 'lapsed';
  return 'sent';
}
