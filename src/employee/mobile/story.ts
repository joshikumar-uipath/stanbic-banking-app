// ─────────────────────────────────────────────────────────────────────────────
// A case, said the way a person would say it.
//
// A banker glancing at a phone between customers should not decode
// "VALIDATION_IN_PROGRESS". Every state gets: a colour (green = done, blue =
// moving on its own, orange = waiting on the customer, red = needs a person),
// a two-word label, a sentence, who is holding it, and where it is on the
// five-step journey.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase, OnboardingState } from '../../onboarding';
import { C } from './nk';

export const JOURNEY = ['Captured', 'Checks', 'Decision', 'Account', 'Ready'] as const;

export type Lane = 'moving' | 'customer' | 'you' | 'done' | 'closed';

export interface Story {
  lane: Lane;
  color: string;
  label: string;
  sentence: string;
  /** 0..4 on JOURNEY. */
  step: number;
}

const S: Record<OnboardingState, Omit<Story, 'sentence'> & { sentence: (c: OnboardingCase) => string }> = {
  AWAITING_EXTRACTION: { lane: 'you', color: C.orange, label: 'Form to confirm', step: 0, sentence: () => 'The form was read — someone needs to confirm what was read off it.' },
  PRE_REGISTERED: { lane: 'moving', color: C.blue, label: 'Starting checks', step: 1, sentence: () => 'Captured. Identity checks are queued and will run on their own.' },
  VALIDATION_IN_PROGRESS: { lane: 'moving', color: C.blue, label: 'Checking', step: 1, sentence: () => 'Identity and screening checks are running. Nothing for you to do.' },
  VALIDATED: { lane: 'moving', color: C.blue, label: 'Checks passed', step: 2, sentence: () => 'Every check passed. The account is being created in core banking.' },
  ACCOUNT_CREATED: { lane: 'done', color: C.green, label: 'Account open', step: 3, sentence: (c) => `Account ${c.accountNumber ?? ''} is live and can receive funds today.` },
  PENDING_DOCUMENTS: { lane: 'customer', color: C.orange, label: 'Waiting on documents', step: 3, sentence: () => 'The account is open. Their documents are still outstanding.' },
  PENDING_LIVENESS: { lane: 'customer', color: C.orange, label: 'Waiting on selfie', step: 3, sentence: () => 'The account is open. Only the selfie check is outstanding.' },
  PENDING_CUSTOMER: { lane: 'customer', color: C.orange, label: 'Waiting on customer', step: 2, sentence: () => 'We asked the customer for something and are waiting to hear back.' },
  FULLY_ACTIVATED: { lane: 'done', color: C.green, label: 'Fully active', step: 4, sentence: () => 'Everything is complete. The customer is fully onboarded.' },
  EXCEPTION: { lane: 'you', color: C.red, label: 'Needs you', step: 1, sentence: (c) => {
    const f = c.validations.find((v) => v.status === 'failed' || v.status === 'timeout');
    return f ? `The ${f.kind} check ${f.status === 'timeout' ? 'timed out' : 'failed'} — a person has to act before it can continue.` : 'A check needs a person before this can continue.';
  } },
  COMPLIANCE_HOLD: { lane: 'you', color: C.red, label: 'With Compliance', step: 2, sentence: () => 'A screening hit is with Compliance. They will clear or decline it.' },
  EDD_REVIEW: { lane: 'moving', color: C.purple, label: 'Due diligence', step: 2, sentence: () => 'Enhanced due diligence is under way before a decision.' },
  DECLINED: { lane: 'closed', color: C.gray, label: 'Declined', step: 2, sentence: () => 'The application was declined or withdrawn.' },
};

export function storyOf(c: OnboardingCase): Story {
  const s = S[c.state] ?? S.PRE_REGISTERED;
  return { lane: s.lane, color: s.color, label: s.label, step: s.step, sentence: s.sentence(c) };
}

/** Names typed in capitals on a form (GEORGE EMORE TECHNICAL ENTERPRISES LTD)
 *  read as Title Case; registry abbreviations keep their capitals. */
const KEEP_CAPS = new Set(['LTD', 'PLC', 'LLC', 'NIG', 'RC', 'BN', 'CAC', 'NGO', 'UK', 'USA', 'II', 'III', 'IV']);
export function tidyName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4 || letters !== letters.toUpperCase()) return t;
  return t.split(' ').map((w) => (KEEP_CAPS.has(w.replace(/[^A-Z]/g, '')) ? w : w.charAt(0) + w.slice(1).toLowerCase()).replace(/(^|[-'’])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase())).join(' ');
}

export const name = (c: OnboardingCase) => tidyName(c.entity?.companyName || `${c.firstName} ${c.lastName}`) || 'Unnamed applicant';
