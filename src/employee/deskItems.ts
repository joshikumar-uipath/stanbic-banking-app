// ─────────────────────────────────────────────────────────────────────────────
// The desk's work items — openings, approvals and clients as one ranked list.
//
// Lives apart from MyDesk.tsx so the phone (Home's "Your work" card and the
// work tabs) can count "needs you" exactly the way My desk does, without
// importing a screen. MyDesk renders these; nothing here renders.
// ─────────────────────────────────────────────────────────────────────────────
import { stateMeta, fullName, isCorporate, type OnboardingCase } from '../onboarding';
import { approvals, money, type Approval } from '../approvalsData';
import { customers, type Customer } from '../customersData';
import type { Tone } from './ui';
import { ago } from './time';

/** One line on the desk, whatever it came from. */
export type Item = {
  key: string;
  dot: Tone;
  who: string;
  ref: string;
  cta: string;          // what the attention-bar button should say
  what: string;
  why: string;          // a fuller, one-sentence reason — drives the "next move" hero
  when: string;
  /** Onboarding record id — set for openings only, so the Maestro lane can resolve it. */
  recordId?: string;
  tag?: { tone: Tone; text: string };
  /** Where the application came from — set for openings only, so a banker can
   *  tell a payroll row from a walk-in without opening it. */
  src?: { kind: 'bulk' | 'single'; label: string };
  /** Business openings are marked; individuals are left unmarked, being the norm. */
  corporate?: boolean;
  rank: number;          // lower = more urgent
  go: () => void;
};

const STATE_TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };

export function fromCases(cases: OnboardingCase[], open: (id: string) => void): Item[] {
  return cases.map((c) => {
    const m = stateMeta(c.state);
    const exc = c.state === 'EXCEPTION';
    const pend = c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS';
    // What actually went wrong, in the banker's words — not the state name.
    const failed = c.validations.filter((v) => v.status === 'failed' || v.status === 'timeout').map((v) => v.kind);
    const what = exc
      ? (failed.length ? `${failed.join(' & ')} needs a person` : 'Needs review')
      : pend
        ? (c.state === 'PENDING_LIVENESS' ? 'Account open — selfie outstanding' : 'Account open — documents outstanding')
        : m.label;
    const why = exc
      ? `${failed.length ? failed.join(' & ') + ' validation ' : 'A check '}needs a person before this application can continue — clear it to send the case back into straight-through processing.`
      : pend
        ? (c.state === 'PENDING_LIVENESS'
          ? 'The account is open but the customer’s selfie is still outstanding — nudge them to finish liveness.'
          : 'The account is open but required documents are still outstanding from the customer.')
        : m.desc;
    return {
      key: `c-${c.uid ?? c.id}`,
      dot: STATE_TONE[m.tone] ?? 'idle',
      who: fullName(c).trim() || 'Unnamed applicant',
      ref: c.id,
      cta: c.id,
      what,
      why,
      when: ago(c.createdAt),
      recordId: c.id,
      tag: { tone: STATE_TONE[m.tone] ?? 'idle', text: m.label },
      src: c.batchId
        ? { kind: 'bulk', label: c.employer || 'Bulk' }
        : { kind: 'single', label: 'Walk-in' },
      corporate: isCorporate(c),
      rank: exc ? 0 : pend ? 2 : 5,
      go: () => open(c.id),
    };
  });
}

export function fromApprovals(list: Approval[], go: () => void): Item[] {
  return list.map((a) => ({
    key: `a-${a.id}`,
    dot: a.slaBreaching ? 'crit' : a.risk === 'High' ? 'warn' : 'info',
    who: a.customer,
    ref: `Raised by ${a.maker}`,   // the demo ids ('a3') mean nothing to a banker
    cta: a.customer,
    what: `${a.typeLabel}${a.amount ? ` · ${money(a.amount)}` : ''}`,
    why: `${a.typeLabel}${a.amount ? ` for ${money(a.amount)}` : ''} — ${a.slaBreaching ? 'past its SLA and needs your sign-off now.' : !a.withinAuthority ? 'above your limit, so it needs dual approval.' : 'awaiting your approval.'}`,
    when: a.ago,
    tag: a.slaBreaching ? { tone: 'crit', text: 'SLA breach' } : !a.withinAuthority ? { tone: 'warn', text: 'Dual approval' } : undefined,
    rank: a.slaBreaching ? 1 : 3,
    go,
  }));
}

export function fromClients(list: Customer[], go: () => void): Item[] {
  return list
    .filter((c) => c.kyc !== 'Verified' || c.headlineTone === 'warn')
    .map((c) => ({
      key: `k-${c.id}`,
      dot: c.kyc !== 'Verified' ? 'warn' : 'idle',
      who: c.name,
      ref: c.maskedId,
      cta: c.name,
      what: c.kyc !== 'Verified' ? `KYC ${c.kyc.toLowerCase()}` : c.headline,
      why: c.kyc !== 'Verified' ? `KYC is ${c.kyc.toLowerCase()} — refresh due diligence to keep this relationship compliant.` : c.headline,
      when: '',
      tag: c.kyc !== 'Verified' ? { tone: 'warn', text: 'KYC due' } : undefined,
      rank: 4,
      go,
    }));
}

/** How many things on the desk need a person — the same number as My desk's
 *  "Needs you" tile (openings, approvals and clients, ranked). The phone's Home
 *  card and work tabs read it so the three never disagree. */
export function needsYouCount(cases: OnboardingCase[]): number {
  const noop = () => undefined;
  return [...fromCases(cases, noop), ...fromApprovals(approvals, noop), ...fromClients(customers, noop)]
    .filter((i) => i.rank <= 4).length;
}

/** The desk's standing measures — the four numbers on My desk's health strip.
 *  Read over the whole book, never the current filter: a filter narrowing
 *  "Needs you" to 1 must not read as the work having gone away. */
export function deskHealth(cases: OnboardingCase[]): { items: number; breaching: number; flight: number; stp: number } {
  const noop = () => undefined;
  const everything = [...fromCases(cases, noop), ...fromApprovals(approvals, noop), ...fromClients(customers, noop)];
  // Straight-through = never needed a person. Not "reached account created" —
  // that penalises everything still legitimately in flight.
  const touched = cases.filter((c) => c.state === 'EXCEPTION' || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout')).length;
  return {
    items: everything.filter((i) => i.rank <= 4).length,
    breaching: approvals.filter((a) => a.slaBreaching).length + cases.filter((c) => c.state === 'EXCEPTION').length,
    flight: everything.filter((i) => i.rank > 4).length,
    stp: cases.length ? Math.round(((cases.length - touched) / cases.length) * 100) : 0,
  };
}
