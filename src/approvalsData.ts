// ─────────────────────────────────────────────────────────────────────────────
// Mobile Approvals & Authorizations — Branch Manager / Approver demo data.
// Uses the shared LOCALE/money from customersData, so amounts follow the active
// market's currency (Naira in the shipped demo). Universal banking approval
// types. Scripted/mock — no backend.
// ─────────────────────────────────────────────────────────────────────────────
import { money } from './customersData';

export { money };

export type ApprovalType = 'feeWaiver' | 'loan' | 'limit' | 'payment' | 'accountException' | 'cardLimit';
export type Risk = 'Low' | 'Medium' | 'High';

export interface Approval {
  id: string;
  type: ApprovalType;
  typeLabel: string;
  icon: string;
  title: string;
  customer: string;
  initials: string;
  amount: number;          // 0 → no monetary figure
  maker: string;           // requested by (the "maker" in maker-checker)
  ago: string;
  sla: string;
  slaBreaching?: boolean;
  risk: Risk;
  withinAuthority: boolean; // within the approver's limit? false → dual approval
  reason: string;           // the maker's justification
  details: { label: string; value: string }[];
  recommendation: string;   // agent/system recommendation
}

export const APPROVE_REASONS = [
  'Within policy & limits',
  'Relationship value / retention',
  'Affordability / collateral adequate',
  'Service recovery',
  'Documented exception',
];
export const REJECT_REASONS = [
  'Outside policy',
  'Insufficient affordability',
  'Incomplete documentation',
  'Risk too high',
];

export const approvals: Approval[] = [
  {
    id: 'a1', type: 'payment', typeLabel: 'Payment release', icon: 'briefcase',
    title: 'International payment release', customer: 'Meridian Trading Ltd.', initials: 'MT',
    amount: 86500000, maker: 'Payments Ops', ago: '8m ago', sla: 'Due in 12m', slaBreaching: false, risk: 'Medium',
    withinAuthority: true,
    reason: 'Supplier payment; beneficiary verified; sanctions screening passed.',
    details: [
      { label: 'Beneficiary', value: 'Verified' },
      { label: 'Sanctions screen', value: 'Clear' },
      { label: 'Channel', value: 'SWIFT' },
      { label: 'Your limit', value: money(250000000) },
    ],
    recommendation: 'All checks passed — safe to release.',
  },
  {
    id: 'a2', type: 'feeWaiver', typeLabel: 'Fee waiver', icon: 'cash',
    title: 'Overdraft penalty waiver', customer: 'Emeka Okafor', initials: 'EO',
    amount: 45000, maker: 'Aisha N. · Teller', ago: '18m ago', sla: 'Due in 42m', risk: 'Low',
    withinAuthority: true,
    reason: 'Long-standing client, first occurrence; charge caused by a delayed salary credit.',
    details: [
      { label: 'Policy cap', value: money(100000) + ' / month' },
      { label: 'Waived this month', value: money(45000) },
      { label: 'Your limit', value: money(500000) },
    ],
    recommendation: 'Within policy — agent suggests approve for retention.',
  },
  {
    id: 'a3', type: 'limit', typeLabel: 'Limit increase', icon: 'overdraft',
    title: 'Overdraft limit increase', customer: 'Meridian Trading Ltd.', initials: 'MT',
    amount: 150000000, maker: 'RM · You', ago: '1h ago', sla: 'Breaching SLA', slaBreaching: true, risk: 'Medium',
    withinAuthority: false,
    reason: 'Strong receivables; overdraft 95% utilised; seasonal working-capital need.',
    details: [
      { label: 'Current limit', value: money(100000000) },
      { label: 'Utilisation', value: '95%' },
      { label: 'Annual turnover', value: money(2100000000) },
      { label: 'Your limit', value: money(100000000) },
    ],
    recommendation: 'Exceeds your limit — route to Regional Credit (dual approval).',
  },
  {
    id: 'a4', type: 'loan', typeLabel: 'Loan approval', icon: 'loan',
    title: 'Personal loan', customer: 'Tunde Bello', initials: 'TB',
    amount: 18000000, maker: 'Branch Officer', ago: '35m ago', sla: 'Due in 1h', risk: 'Medium',
    withinAuthority: true,
    reason: 'Affordability ratio 38%, clean repayment history, 4-year tenure.',
    details: [
      { label: 'Credit score', value: '742' },
      { label: 'Debt-to-income', value: '38%' },
      { label: 'Collateral', value: 'None' },
      { label: 'Your limit', value: money(25000000) },
    ],
    recommendation: 'Affordability within threshold — eligible.',
  },
  {
    id: 'a5', type: 'cardLimit', typeLabel: 'Card limit', icon: 'card',
    title: 'Credit card limit increase', customer: 'Adaeze Balogun', initials: 'AB',
    amount: 12000000, maker: 'Cards Team', ago: '2h ago', sla: 'Due in 3h', risk: 'Low',
    withinAuthority: true,
    reason: 'Premier client, low utilisation, income verified.',
    details: [
      { label: 'Current limit', value: money(5000000) },
      { label: 'Requested', value: money(12000000) },
      { label: 'Utilisation', value: '12%' },
      { label: 'Your limit', value: money(20000000) },
    ],
    recommendation: 'Strong fit — within policy.',
  },
  {
    id: 'a6', type: 'accountException', typeLabel: 'Account opening', icon: 'idcard',
    title: 'Address-proof exception', customer: 'Amara Nwosu', initials: 'AN',
    amount: 0, maker: 'Onboarding Officer', ago: '50m ago', sla: 'Due in 2h', risk: 'Low',
    withinAuthority: true,
    reason: 'Utility bill older than 3 months; applicant provided an employer letter as alternate proof.',
    details: [
      { label: 'Alternate proof', value: 'Employer letter' },
      { label: 'KYC tier', value: 'Standard' },
      { label: 'Risk rating', value: 'Low' },
    ],
    recommendation: 'Acceptable alternate proof under policy 4.2.',
  },
];

export function approvalsPulse() {
  const pending = approvals.length;
  const value = approvals.reduce((s, a) => s + a.amount, 0);
  const breaching = approvals.filter((a) => a.slaBreaching).length;
  const dual = approvals.filter((a) => !a.withinAuthority).length;
  return { pending, value, breaching, dual };
}
