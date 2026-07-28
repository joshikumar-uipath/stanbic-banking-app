// ─────────────────────────────────────────────────────────────────────────────
// Customer 360 + Next-Best-Action demo data.
//
// Localised to the market chosen in the admin (config/countries.ts): the currency
// symbol, code and number format all come from the active country, and the
// personas + amounts are tuned to that market (the demo ships pointed at Nigeria,
// so figures read in Naira). Products & terminology stay universal.
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveCountry } from './config/countries';

const CO = getActiveCountry();
export const LOCALE = { code: CO.currency.code, symbol: CO.currency.symbol, numberLocale: CO.currency.locale };

export function money(n: number, dp = 0): string {
  const v = Math.abs(n).toLocaleString(LOCALE.numberLocale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${n < 0 ? '-' : ''}${LOCALE.symbol}${v}`;
}

export type Segment = 'Premier' | 'Priority' | 'Business' | 'Retail';
export type Risk = 'Low' | 'Medium' | 'High';
export type Tone = 'good' | 'warn' | 'info';

export interface Product { type: string; name: string; balance: number; status?: string }
export interface Signal { tone: Tone; text: string; when: string }
export interface NBA {
  id: string; icon: string; title: string; rationale: string; value: string;
  confidence: number; actions: string[]; kind: 'opportunity' | 'risk';
}
export interface CaseItem { ref: string; title: string; status: string }

export interface Customer {
  id: string; name: string; initials: string; segment: Segment;
  since: string; rm: string; maskedId: string; phone: string; email: string;
  risk: Risk; kyc: string;
  relationshipValue: number; monthlyProfit: number; clv: number;
  headline: string; headlineTone: Tone;
  products: Product[]; signals: Signal[]; nbas: NBA[]; cases: CaseItem[]; notes: string[];
}

export const customers: Customer[] = [
  {
    id: 'sofia', name: 'Adaeze Balogun', initials: 'AB', segment: 'Premier',
    since: '2014', rm: 'You', maskedId: '••• ••• 4821', phone: '+234 ••• ••• 8810', email: 'a.balogun@••••.com',
    risk: 'Low', kyc: 'Verified',
    relationshipValue: 742000000, monthlyProfit: 1850000, clv: 96000000,
    headline: 'Deposit maturing in 7 days', headlineTone: 'info',
    products: [
      { type: 'current', name: 'Premier Current', balance: 480000000, status: 'High idle balance' },
      { type: 'savings', name: 'Premier Savings', balance: 12000000 },
      { type: 'deposit', name: 'Term Deposit', balance: 250000000, status: 'Matures in 7 days' },
      { type: 'card', name: 'Platinum Credit Card', balance: -3200000 },
    ],
    signals: [
      { tone: 'good', text: 'Large inflow of ₦120,000,000 received', when: '4 days ago' },
      { tone: 'info', text: '₦250,000,000 term deposit matures in 7 days', when: 'upcoming' },
      { tone: 'info', text: 'High idle balance sitting in current account', when: 'ongoing' },
    ],
    nbas: [
      { id: 'mmf', icon: 'cash', kind: 'opportunity', title: 'Move idle cash to Money Market Fund', rationale: '₦480m earning ~0.1% in a current account. The Money Market Fund yields ~9.8% p.a. with same-day access.', value: '+₦47m / yr est.', confidence: 92, actions: ['Propose', 'Assign to RM', 'Dismiss'] },
      { id: 'roll', icon: 'refresh', kind: 'opportunity', title: 'Roll over the maturing term deposit', rationale: '₦250m term deposit matures in 7 days. Without action it lapses to a low-rate call account.', value: 'Retain ₦250,000,000', confidence: 88, actions: ['Offer rollover', 'Schedule call', 'Dismiss'] },
      { id: 'wealth', icon: 'trend', kind: 'opportunity', title: 'Schedule a portfolio review', rationale: 'Premier client holding no investment products despite high liquidity. Strong propensity to invest.', value: '+₦3.4m / yr fees est.', confidence: 74, actions: ['Assign to RM', 'Dismiss'] },
    ],
    cases: [{ ref: 'SR-2293', title: 'Statement copy request', status: 'Resolved' }],
    notes: ['Prefers contact after 4pm.', 'Interested in offshore options (mentioned last review).'],
  },
  {
    id: 'daniel', name: 'Emeka Okafor', initials: 'EO', segment: 'Priority',
    since: '2019', rm: 'Aisha N.', maskedId: '••• ••• 1190', phone: '+234 ••• ••• 4402', email: 'e.okafor@••••.com',
    risk: 'Medium', kyc: 'Review due in 12 days',
    relationshipValue: 38000000, monthlyProfit: 240000, clv: 14000000,
    headline: 'Churn & credit risk', headlineTone: 'warn',
    products: [
      { type: 'mortgage', name: 'Home Mortgage', balance: -315000000, status: '1 payment overdue' },
      { type: 'loan', name: 'Personal Loan', balance: -18400000 },
      { type: 'current', name: 'Everyday Current', balance: 2100000 },
      { type: 'card', name: 'Debit Card', balance: 0 },
    ],
    signals: [
      { tone: 'warn', text: 'Mortgage payment 6 days overdue', when: 'now' },
      { tone: 'warn', text: '2 declined card transactions this week', when: '2 days ago' },
      { tone: 'info', text: 'Savings balance falling for 3 months', when: 'trend' },
    ],
    nbas: [
      { id: 'retention', icon: 'phone', kind: 'risk', title: 'Retention call — churn risk', rationale: 'Missed payment + declined transactions + falling balances. Churn score 0.78 (high).', value: 'Protect ₦333m exposure', confidence: 81, actions: ['Schedule call', 'Assign to RM', 'Dismiss'] },
      { id: 'restructure', icon: 'shield', kind: 'risk', title: 'Offer loan restructuring', rationale: 'Affordability stress detected. A restructured plan can prevent default and preserve the relationship.', value: 'Reduce default risk', confidence: 69, actions: ['Propose', 'Discuss', 'Dismiss'] },
    ],
    cases: [{ ref: 'SR-3310', title: 'Dispute — declined transaction', status: 'Open' }],
    notes: ['Recently changed jobs — verify income at KYC review.'],
  },
  {
    id: 'meridian', name: 'Meridian Trading Ltd.', initials: 'MT', segment: 'Business',
    since: '2017', rm: 'You', maskedId: 'REG ••• 7741', phone: '+234 ••• ••• 2200', email: 'finance@••••.com',
    risk: 'Low', kyc: 'Verified',
    relationshipValue: 156000000, monthlyProfit: 2100000, clv: 71000000,
    headline: 'Overdraft near limit', headlineTone: 'warn',
    products: [
      { type: 'current', name: 'Business Current', balance: 42000000 },
      { type: 'overdraft', name: 'Overdraft Facility', balance: -95000000, status: '95% utilised of ₦100m' },
      { type: 'wallet', name: 'FX Wallet', balance: 11000000 },
      { type: 'card', name: 'Corporate Card', balance: -8600000 },
    ],
    signals: [
      { tone: 'warn', text: 'Overdraft 95% utilised', when: 'now' },
      { tone: 'good', text: 'Receivables up 22% this quarter', when: 'trend' },
      { tone: 'info', text: 'Regular international payments to 3 suppliers', when: 'ongoing' },
    ],
    nbas: [
      { id: 'wc', icon: 'briefcase', kind: 'opportunity', title: 'Offer a working-capital loan', rationale: 'Overdraft maxing out despite strong inflows. A better-priced WC facility fits the cash cycle.', value: '+₦4.1m / yr est.', confidence: 86, actions: ['Propose', 'Assign to RM', 'Dismiss'] },
      { id: 'fx', icon: 'globe', kind: 'opportunity', title: 'Introduce FX hedging', rationale: 'Recurring supplier payments in two currencies. Forward contracts would reduce FX exposure.', value: 'Reduce FX risk', confidence: 72, actions: ['Assign to RM', 'Dismiss'] },
    ],
    cases: [],
    notes: ['Director prefers quarterly business reviews.'],
  },
  {
    id: 'omar', name: 'Yusuf Ibrahim', initials: 'YI', segment: 'Retail',
    since: '2021', rm: 'Unassigned', maskedId: '••• ••• 9930', phone: '+234 ••• ••• 7720', email: 'y.ibrahim@••••.com',
    risk: 'Low', kyc: 'Overdue',
    relationshipValue: 1250000, monthlyProfit: 4000, clv: 2200000,
    headline: 'Dormant 8 months', headlineTone: 'warn',
    products: [
      { type: 'savings', name: 'Everyday Savings', balance: 1250000, status: 'Dormant' },
    ],
    signals: [
      { tone: 'warn', text: 'No account activity in 8 months', when: 'now' },
      { tone: 'warn', text: 'KYC documents expired', when: 'now' },
      { tone: 'info', text: 'Salary was previously credited monthly', when: 'history' },
    ],
    nbas: [
      { id: 'kyc', icon: 'lock', kind: 'risk', title: 'Prompt a KYC refresh', rationale: 'KYC has expired — the account will be restricted in 14 days unless refreshed.', value: 'Avoid restriction', confidence: 95, actions: ['Send reminder', 'Assign to RM', 'Dismiss'] },
      { id: 'react', icon: 'gift', kind: 'opportunity', title: 'Send a reactivation offer', rationale: 'Dormant but previously a salaried, active client. Win-back propensity is moderate.', value: 'Reactivate relationship', confidence: 64, actions: ['Send offer', 'Dismiss'] },
    ],
    cases: [],
    notes: [],
  },
  {
    id: 'grace', name: 'Ngozi Adeyemi', initials: 'NA', segment: 'Premier',
    since: '2012', rm: 'You', maskedId: '••• ••• 2056', phone: '+234 ••• ••• 9014', email: 'n.adeyemi@••••.com',
    risk: 'Low', kyc: 'Verified',
    relationshipValue: 410000000, monthlyProfit: 1320000, clv: 88000000,
    headline: 'Cross-sell ready', headlineTone: 'good',
    products: [
      { type: 'current', name: 'Premier Current', balance: 60000000 },
      { type: 'savings', name: 'Premier Savings', balance: 180000000 },
      { type: 'mortgage', name: 'Home Mortgage', balance: -220000000, status: 'On track' },
      { type: 'invest', name: 'Investment Account', balance: 390000000, status: '+9% YTD' },
    ],
    signals: [
      { tone: 'good', text: 'Consistent monthly surplus', when: 'trend' },
      { tone: 'good', text: 'Investments up 9% year-to-date', when: 'trend' },
      { tone: 'info', text: 'No credit card on file', when: 'gap' },
    ],
    nbas: [
      { id: 'card', icon: 'card', kind: 'opportunity', title: 'Offer a premium credit card', rationale: 'High spend via debit and no card on file. Eligibility and fit are strong.', value: '+₦1.2m / yr est.', confidence: 83, actions: ['Send offer', 'Dismiss'] },
      { id: 'topup', icon: 'home', kind: 'opportunity', title: 'Mortgage top-up — pre-qualified', rationale: 'Equity built up; pre-qualified for an ₦80m top-up at preferential pricing.', value: '+₦2.6m / yr est.', confidence: 77, actions: ['Propose', 'Assign to RM', 'Dismiss'] },
    ],
    cases: [{ ref: 'SR-1180', title: 'Travel notice', status: 'Resolved' }],
    notes: ['Long-standing client — handle personally.'],
  },
];

/** Branch-pulse summary for the Branch Manager header. */
export function branchPulse() {
  const relationships = customers.length;
  const atRisk = customers.filter((c) => c.headlineTone === 'warn').length;
  const nbas = customers.reduce((s, c) => s + c.nbas.length, 0);
  const kycDue = customers.filter((c) => c.kyc !== 'Verified').length;
  return { relationships, atRisk, nbas, kycDue };
}
