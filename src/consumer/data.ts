// ─────────────────────────────────────────────────────────────────────────────
// Mock data for the consumer banking app (Aura-consumer).
//
// Localised to a Nigerian retail bank (Stanbic IBTC-style): NGN currency, Mobile Wallet / NIP Transfer
// / Pay Bill / Buy Goods rails, Loop digital account, Overdraft & EasySave, Pension (RSA).
// Information architecture mirrors the DBS reference screenshots; the products
// and terminology are localised. All amounts are fictional demo data.
// ─────────────────────────────────────────────────────────────────────────────

export const CURRENCY = 'NGN';

/** Format a number as a grouped string, e.g. 84250.5 → "84,250.50". */
export function fmt(amount: number, dp = 2): string {
  return amount.toLocaleString('en-KE', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
/** "NGN 84,250.50" */
export function money(amount: number, dp = 2): string {
  return `${CURRENCY} ${fmt(amount, dp)}`;
}

export const customer = {
  name: 'Adaeze Okafor',
  firstName: 'Adaeze',
  initials: 'AO',
  lastLogin: '11 Jun 2026, 04:15 PM (WAT)',
  phone: '+234 803 412 5567',
};

// ── Account groups (Home → Accounts) ─────────────────────────────────────────
export interface Account {
  id: string;
  name: string;
  number: string;
  balance: number;
  kind: 'current' | 'savings' | 'loop' | 'fixed' | 'mpesa';
}
export const depositAccounts: Account[] = [
  { id: 'cur', name: 'Current Account', number: '1002-0045-8891', balance: 84250.0, kind: 'current' },
  { id: 'sav', name: 'Savings Account', number: '6011-2238-1190', balance: 312900.5, kind: 'savings' },
  { id: 'loop', name: 'Flex Account', number: '0117-9920-3345', balance: 12430.0, kind: 'loop' },
  { id: 'fd', name: 'Fixed Deposit (12m)', number: 'FD-228-9931', balance: 500000.0, kind: 'fixed' },
];
export const depositsTotal = depositAccounts.reduce((s, a) => s + a.balance, 0);

export interface CardAccount {
  id: string;
  name: string;
  scheme: 'Visa' | 'Mastercard';
  last4: string;
  outstanding: number;
  limit: number;
  dueDate: string;
  gradient: [string, string];
}
export const cards: CardAccount[] = [
  { id: 'wmc', name: 'World Mastercard', scheme: 'Mastercard', last4: '7421', outstanding: 128540.0, limit: 400000, dueDate: '28 Jun 2026', gradient: ['#38302E', '#5A4D49'] },
  { id: 'vg', name: 'Visa Gold', scheme: 'Visa', last4: '3092', outstanding: 14280.5, limit: 150000, dueDate: '28 Jun 2026', gradient: ['#1C4E63', '#39B3E5'] },
];
export const cardsOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);

// ── Loans / overdraft ────────────────────────────────────────────────────────
export interface LoanAccount { id: string; name: string; outstanding: number; note: string; }
export const loans: LoanAccount[] = [
  { id: 'fuliza', name: 'Overdraft', outstanding: 1200.0, note: 'Available NGN 8,800' },
  { id: 'pl', name: 'Personal Loan', outstanding: 245000.0, note: '24 of 36 instalments left' },
];

// ── Mobile Wallet wallet (linked) ───────────────────────────────────────────────────
export const mpesa = { name: 'Mobile Wallet', number: '+234 803 412 5567', balance: 6320.0 };

// ── Net worth ────────────────────────────────────────────────────────────────
export const netWorth = depositsTotal + mpesa.balance - cardsOutstanding - loans.reduce((s, l) => s + l.outstanding, 0);

// ── Smart shortcuts (Home top row) ───────────────────────────────────────────
export const smartShortcuts = [
  { id: 'history', label: 'Transaction History', icon: 'history' },
  { id: 'send', label: 'Send Money', icon: 'transfer' },
  { id: 'paybill', label: 'Pay Bill', icon: 'bill' },
  { id: 'card', label: 'Pay Card Bill', icon: 'card' },
  { id: 'edocs', label: 'eStatements', icon: 'doc' },
  { id: 'airtime', label: 'Buy Airtime', icon: 'phone' },
] as const;

// ── Insights (Home → Insights tab) ───────────────────────────────────────────
export interface Insight { id: string; date: string; title: string; body: string; tone: 'info' | 'good' | 'warn'; }
export const insights: Insight[] = [
  { id: 'i1', date: '11 JUN', title: 'You received a large deposit', body: 'NGN 120,000 landed in your Savings Account. Tap for a full view.', tone: 'good' },
  { id: 'i2', date: '09 JUN', title: 'Grow your idle cash', body: 'You have NGN 312,900 sitting in Savings. The Stanbic IBTC Money Market Fund earns ~9.8% p.a.', tone: 'info' },
  { id: 'i3', date: '06 JUN', title: 'A late fee was charged', body: 'A NGN 1,500 late fee hit your World Mastercard. Set up auto-pay to avoid this.', tone: 'warn' },
  { id: 'i4', date: '02 JUN', title: 'Your spending is up 18%', body: 'You spent NGN 64,200 this month vs NGN 54,300 last month. See the breakdown.', tone: 'info' },
];

// ── Transactions ─────────────────────────────────────────────────────────────
export interface Txn { id: string; date: string; title: string; subtitle: string; amount: number; account: string; }
export const transactions: Txn[] = [
  { id: 't1', date: '11 Jun 2026', title: 'Salary — Acme Ltd', subtitle: 'Current Account', amount: 120000.0, account: 'Savings Account' },
  { id: 't2', date: '10 Jun 2026', title: 'Naivas Supermarket', subtitle: 'Buy Goods 5483', amount: -4320.0, account: 'Current Account' },
  { id: 't3', date: '10 Jun 2026', title: 'KPLC Prepaid', subtitle: 'Pay Bill 888880', amount: -2000.0, account: 'Current Account' },
  { id: 't4', date: '09 Jun 2026', title: 'Send Money — J. Otieno', subtitle: 'Mobile Wallet +234 7•• ••6 321', amount: -5000.0, account: 'Current Account' },
  { id: 't5', date: '08 Jun 2026', title: 'Java House', subtitle: 'Card •••• 7421', amount: -1180.0, account: 'World Mastercard' },
  { id: 't6', date: '07 Jun 2026', title: 'NIP Transfer — GTBank', subtitle: 'To 0803••• 901', amount: -15000.0, account: 'Savings Account' },
  { id: 't7', date: '05 Jun 2026', title: 'Airtime top-up', subtitle: 'MTN', amount: -500.0, account: 'Mobile Wallet' },
];

// ── Pay & Transfer ───────────────────────────────────────────────────────────
export const payActions = [
  { id: 'sendmoney', label: 'Send Money', icon: 'mpesa' },
  { id: 'pesalink', label: 'NIP Transfer', icon: 'transfer' },
  { id: 'scan', label: 'Scan & Pay', icon: 'qr' },
  { id: 'paybill', label: 'Pay Bill', icon: 'bill' },
  { id: 'buygoods', label: 'Buy Goods', icon: 'store' },
  { id: 'ownaccount', label: 'Own Accounts', icon: 'accounts' },
  { id: 'card', label: 'Pay Card', icon: 'card' },
  { id: 'airtime', label: 'Airtime', icon: 'phone' },
  { id: 'forex', label: 'Forex', icon: 'globe' },
] as const;

export interface Recipient { id: string; name: string; detail: string; channel: 'Mobile Wallet' | 'NIP Transfer' | 'Stanbic IBTC' | 'Pay Bill'; fav?: boolean; }
export const recipients: Recipient[] = [
  { id: 'r1', name: 'James Otieno', detail: 'Mobile Wallet · +234 7•• ••6 321', channel: 'Mobile Wallet', fav: true },
  { id: 'r2', name: 'Grace Njeri', detail: 'Stanbic IBTC · 1002-••••-2231', channel: 'Stanbic IBTC', fav: true },
  { id: 'r3', name: 'GTBank — Self', detail: 'NIP Transfer · 0803••• 901', channel: 'NIP Transfer' },
  { id: 'r4', name: 'KPLC Prepaid', detail: 'Pay Bill · 888880', channel: 'Pay Bill' },
  { id: 'r5', name: 'Lagos Water', detail: 'Pay Bill · 535353', channel: 'Pay Bill' },
  { id: 'r6', name: 'Brian Kips', detail: 'Mobile Wallet · +234 7•• ••1 044', channel: 'Mobile Wallet' },
];

// ── digiWealth ───────────────────────────────────────────────────────────────
export interface WealthProduct { id: string; name: string; desc: string; oneYear: number; risk: number; tag?: string; }
export const wealthProducts: WealthProduct[] = [
  { id: 'mmf', name: 'Stanbic IBTC Money Market Fund', desc: 'Earn daily interest on your cash with same-day access.', oneYear: 9.82, risk: 1, tag: 'POPULAR' },
  { id: 'eq', name: 'Stanbic IBTC Equity Fund', desc: 'Long-term growth across NGX-listed blue-chip companies.', oneYear: 21.4, risk: 4 },
  { id: 'bond', name: 'Stanbic IBTC Bond Fund', desc: 'A basket of Nigerian government & corporate bonds.', oneYear: 12.6, risk: 2 },
  { id: 'dollar', name: 'Dollar Money Market Fund', desc: 'Hold and grow USD with a low-risk fund.', oneYear: 4.9, risk: 1 },
];
export const investmentSummary = { total: 486120.55, change: 4210.0, changePct: 0.87, since: '31 May 2026' };

export interface CoverageNeed { id: string; name: string; cover: string; note: string; }
export const coverageNeeds: CoverageNeed[] = [
  { id: 'crit', name: 'Critical illness', cover: 'NGN 0', note: 'You may need ~NGN 6.6M during recovery from a health crisis.' },
  { id: 'health', name: 'Health (inpatient)', cover: 'NGN 2M', note: 'Helps ease large medical bills.' },
  { id: 'life', name: 'Life', cover: 'NGN 5M', note: 'Protect your family if something happens to you.' },
  { id: 'motor', name: 'Motor', cover: 'NGN 1.2M', note: 'Comprehensive cover for your vehicle.' },
];

export const retirement = {
  retireAge: 55,
  basicExpenses: 60000,
  lifestyleExpenses: 25000,
  untilAge: 80,
  projectedMonthly: 85000,
};
export const cashflow = {
  netCashflow: -8420.0,
  moneyIn: 132040.0,
  moneyOut: 140460.0,
  // [month, in, out]
  months: [
    ['Jan', 130000, 96000], ['Feb', 142000, 138000], ['Mar', 121000, 110000],
    ['Apr', 128000, 119000], ['May', 132040, 140460], ['Jun', 120000, 64200],
  ] as [string, number, number][],
};

// ── Notifications ────────────────────────────────────────────────────────────
export interface Notification { id: string; title: string; body: string; time: string; cat: 'banking' | 'deals'; unread?: boolean; }
export const notifications: Notification[] = [
  { id: 'n1', title: 'Your eStatement is ready', body: 'Your May 2026 statement is ready for viewing.', time: '11 Jun 2026 06:40', cat: 'banking', unread: true },
  { id: 'n2', title: 'Salary received', body: 'NGN 120,000.00 credited to your Savings Account from Acme Ltd.', time: '11 Jun 2026 09:02', cat: 'banking', unread: true },
  { id: 'n3', title: 'Card payment due', body: 'Your World Mastercard payment of NGN 128,540 is due on 28 Jun 2026.', time: '09 Jun 2026 14:35', cat: 'banking', unread: true },
  { id: 'n4', title: 'Overdraft repaid', body: 'NGN 1,200 Overdraft was auto-repaid from your incoming Mobile Wallet.', time: '08 Jun 2026 19:37', cat: 'banking' },
  { id: 'd1', title: 'Earn 9.8% on idle cash', body: 'Move to the Stanbic IBTC Money Market Fund and earn daily interest.', time: '07 Jun 2026 10:00', cat: 'deals', unread: true },
  { id: 'd2', title: '0% balance transfer', body: 'Transfer other card balances at 0% for 6 months.', time: '04 Jun 2026 08:15', cat: 'deals' },
];

// ── More tab menu groups ─────────────────────────────────────────────────────
export const moreQuickAccess = [
  { id: 'history', label: 'Transaction History', icon: 'history' },
  { id: 'edocs', label: 'eStatements', icon: 'doc' },
  { id: 'blockcard', label: 'Block / Replace Card', icon: 'cardoff' },
  { id: 'personalise', label: 'Personalise App', icon: 'grid' },
  { id: 'limits', label: 'Manage Limits', icon: 'sliders' },
  { id: 'particulars', label: 'Update Particulars', icon: 'user' },
];
export const moreApply = [
  { id: 'account', label: 'Open Account', icon: 'bank' },
  { id: 'card', label: 'Cards', icon: 'card' },
  { id: 'loan', label: 'Loans', icon: 'cash' },
  { id: 'fd', label: 'Fixed Deposit', icon: 'lock' },
];
export const moreSettings = [
  { id: 'peek', label: 'Peek Balance', icon: 'eye' },
  { id: 'biometric', label: 'Biometric Login', icon: 'face' },
  { id: 'notif', label: 'Manage Notifications', icon: 'bell' },
  { id: 'security', label: 'Security Checkup', icon: 'shield' },
  { id: 'privacy', label: 'Privacy', icon: 'lock' },
  { id: 'about', label: 'About & Legal', icon: 'info' },
];
