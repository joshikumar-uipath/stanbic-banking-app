// ─────────────────────────────────────────────────────────────────────────────
// Control tower — the semantic model.
//
// Everything the report renders is derived here, in one pure function, so the
// visuals stay dumb and the numbers stay testable. This is deliberately the
// "semantic model" half of the Power BI metaphor the surface presents: measures
// are defined once, and every visual on every page reads the same ones.
//
// Two windows are computed on each pass — the selected range and the range
// immediately before it — because a dashboard without "versus last period" only
// tells you where you are, never which way you are going.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase, ValidationKind, Channel } from '../../onboarding';
import { getActiveCountry, kycLabelAuthority } from '../../config/countries';
import type { OperationsConfig } from '../../config/types';

// ── Range ────────────────────────────────────────────────────────────────────
export type RangeId = '24h' | '48h' | '7d' | '30d';
export interface RangeCfg { id: RangeId; label: string; hours: number; bucketH: number }
export const RANGES: RangeCfg[] = [
  { id: '24h', label: '24 hours', hours: 24, bucketH: 3 },
  { id: '48h', label: '48 hours', hours: 48, bucketH: 6 },
  { id: '7d', label: '7 days', hours: 168, bucketH: 24 },
  { id: '30d', label: '30 days', hours: 720, bucketH: 24 },
];

// ── Filters (the report's filter pane + cross-filter selection) ──────────────
/** Outcome lanes, kept as a closed set so the Sankey and the pane agree. */
export type OutcomeKey = 'active' | 'kyc' | 'progress' | 'person' | 'declined';
export const OUTCOMES: OutcomeKey[] = ['active', 'kyc', 'progress', 'person', 'declined'];
export type VerificationKey = 'cleared' | 'flagged';
export interface Filters {
  channel: Channel | null;
  verification: VerificationKey | null;
  outcome: OutcomeKey | null;
  check: ValidationKind | null;
}
export const NO_FILTERS: Filters = { channel: null, verification: null, outcome: null, check: null };
export const filterCount = (f: Filters) => Object.values(f).filter((v) => v !== null).length;

// ── Palette ──────────────────────────────────────────────────────────────────
// Hues that carry meaning (good/warn/bad) stay fixed — a red exception must not
// turn green because a tenant picked green. Everything neutral reads the brand
// vars instead, so the report rebrands with the rest of the app.
export const SIG = { good: '#107c41', warn: '#b45309', bad: '#c4314b', info: '#0f6cbd' } as const;
export const BRAND = 'var(--brand-primary)';
export const BRAND_2 = 'var(--brand-secondary)';
/** Fabric's own accent, used only for the platform chrome — never for data. */
export const FABRIC = '#0f6cbd';

// ── Case predicates ──────────────────────────────────────────────────────────
export const CHECKS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];
const CO = getActiveCountry();
export const checkLabel: Record<ValidationKind, string> =
  Object.fromEntries(CHECKS.map((k) => [k, kycLabelAuthority(k, ' · ', CO)])) as Record<ValidationKind, string>;

export const isOpened = (c: OnboardingCase) => Boolean(c.accountNumber);
export const isStuck = (c: OnboardingCase) => c.state === 'EXCEPTION';
export const isDeclined = (c: OnboardingCase) => c.state === 'DECLINED';
export const isAwaitingKyc = (c: OnboardingCase) =>
  c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS';
/** "Touched" = a human had to look at it, so it is not straight-through. */
export const isTouched = (c: OnboardingCase) =>
  isStuck(c) || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');
export const failedCheck = (c: OnboardingCase, k: ValidationKind) =>
  c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'));
const timedOut = (c: OnboardingCase) => c.validations.some((v) => v.status === 'timeout');

export const channelOf = (c: OnboardingCase): Channel => c.channel ?? 'single';
export const verificationOf = (c: OnboardingCase): VerificationKey => (isTouched(c) ? 'flagged' : 'cleared');
export const outcomeOf = (c: OnboardingCase): OutcomeKey =>
  isStuck(c) ? 'person'
    : isDeclined(c) ? 'declined'
    : c.state === 'FULLY_ACTIVATED' ? 'active'
      : isAwaitingKyc(c) ? 'kyc' : 'progress';

/** Which check to blame when several failed — first match wins, worst first. */
const FAIL_ORDER: ValidationKind[] = ['BVN', 'NIN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];
export const primaryFail = (c: OnboardingCase): ValidationKind | null =>
  FAIL_ORDER.find((k) => failedCheck(c, k)) ?? null;

/** When the account actually opened, from the event backbone rather than
 *  updatedAt — updatedAt moves on every later touch and would lie. */
const openedAt = (c: OnboardingCase): number | null => {
  const ev = c.timeline.find((e) => e.topic === 'account-created');
  return ev ? Date.parse(ev.at) : null;
};

export const CHANNEL_LABEL: Record<Channel, string> = { bulk: 'Bulk payroll', single: 'Branch', self: 'Digital' };
export const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  active: 'Fully activated', kyc: 'Awaiting KYC', progress: 'In progress', person: 'Needs a person', declined: 'Declined',
};
export const OUTCOME_COLOR: Record<OutcomeKey, string> = {
  active: BRAND, kyc: SIG.info, progress: SIG.warn, person: SIG.bad, declined: '#8a8886',
};
export const channelColor = (k: Channel) => (k === 'bulk' ? BRAND_2 : k === 'self' ? SIG.good : BRAND);
/** One colour per check, shared by every page that draws one. Power BI's own
 *  categorical palette, so a stacked column of six reads at a glance. */
export const CHECK_COLOR: Record<ValidationKind, string> = {
  BVN: '#c4314b', NIN: '#e66c37', AML: '#118dff', PEP: '#744ec2', FRAUD: '#e044a7', LIVENESS: '#038387',
};

// ── Filtering ────────────────────────────────────────────────────────────────
export function matches(c: OnboardingCase, f: Filters): boolean {
  if (f.channel && channelOf(c) !== f.channel) return false;
  if (f.verification && verificationOf(c) !== f.verification) return false;
  if (f.outcome && outcomeOf(c) !== f.outcome) return false;
  if (f.check && !failedCheck(c, f.check)) return false;
  return true;
}

// ── Shapes the visuals consume ───────────────────────────────────────────────
export interface Kpi {
  key: string; label: string; value: number; suffix?: string;
  prev: number; delta: number; deltaPct: number | null;
  /** Whether a rise is good. Exceptions rising is bad; opened rising is good. */
  goodUp: boolean;
  spark: number[];
}
export interface Bucket { start: number; label: string; full: string; arrived: number; opened: number }
export interface Slice { key: string; label: string; n: number; pct: number; color: string }
export interface FunnelStep { label: string; n: number; pct: number; drop: number; dropPct: number }
export interface SlaBucket { key: string; label: string; n: number; color: string }
export interface QueueLoad { queue: string; cause: string; assignTo: string; n: number }
export interface Upstream { name: string; failures: number; sig: 'ok' | 'warn' | 'bad'; note: string }
export interface Attn { icon: string; title: string; sub: string; sig: 'ok' | 'warn' | 'bad'; check: ValidationKind | null }
export interface Part { key: string; label: string; color: string; n: number }
export interface StackBucket { label: string; full: string; parts: Part[] }
export interface Series { key: string; label: string; color: string; points: (number | null)[] }
export interface ChannelStat {
  key: Channel; label: string; color: string; n: number; pct: number;
  stp: number; opened: number; flagged: number; avgOpenMins: number | null;
}
export interface CheckStat {
  key: ValidationKind; label: string; passed: number; failed: number; timeout: number; pending: number;
  /** Passed on the first attempt, as a share of completed checks. */
  ftr: number; retries: number;
}
export interface SkNode { key: string; label: string; color: string; n: number }
export interface SkFlow { path: string[]; n: number }

export interface TowerModel {
  /** Rows after the filter pane, inside the selected window. */
  total: number;
  /** Rows inside the window before filtering — the pane's denominators. */
  windowTotal: number;
  kpis: Kpi[];
  buckets: Bucket[];
  bucketMax: number;
  peakIndex: number;
  mix: Slice[];
  channels: Slice[];
  funnel: FunnelStep[];
  activated: number;
  activatedPct: number;
  stp: number;
  settled: number;
  clean: number;
  hoursReturned: number;
  exceptions: number;
  awaitingKyc: number;
  openItems: number;
  causes: { key: ValidationKind; label: string; n: number; pct: number }[];
  sla: { buckets: SlaBucket[]; breached: number; atRisk: number; worstMins: number; slaMinutes: number; openWork: number };
  queues: QueueLoad[];
  aging: { label: string; n: number }[];
  upstream: Upstream[];
  attn: Attn[];
  avgOpenMins: number | null;
  sankey: { columns: SkNode[][]; flows: SkFlow[] };
  clearedPct: number;
  flagged: number;
  // ── Channels page ──
  arrivalsByChannel: StackBucket[];
  channelStats: ChannelStat[];
  channelOutcome: { key: Channel; label: string; cells: number[] }[];
  employers: { name: string; n: number; opened: number }[];
  // ── Verification page ──
  checkStats: CheckStat[];
  failuresByBucket: StackBucket[];
  clearedTrend: Series[];
  attempts: { label: string; n: number }[];
  firstTimeRight: number;
  totalFailures: number;
  totalTimeouts: number;
  totalRetries: number;
  // ── Timing page ──
  openHistogram: { label: string; n: number; late?: boolean }[];
  medianOpenTrend: Series[];
  cumulative: Series[];
  heat: { rows: string[]; cols: string[]; cells: number[][] };
  hourOfDay: { label: string; n: number }[];
  weekdayLoad: { label: string; n: number }[];
  medianOpenMins: number | null;
  p90OpenMins: number | null;
  bucketLabels: { label: string; full: string }[];
  /** Unfiltered counts per facet, so the pane can show what each option would yield. */
  facets: {
    channel: Record<string, number>;
    verification: Record<string, number>;
    outcome: Record<string, number>;
    check: Record<string, number>;
  };
}

const MANUAL_MIN = 35, AUTO_MIN = 4;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
/** Minutes as something a person reads at a glance. */
export const mins = (m: number) => (m < 60 ? `${Math.round(m)}m` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`);

function kpi(
  key: string, label: string, value: number, prev: number, goodUp: boolean, spark: number[], suffix?: string,
): Kpi {
  const delta = value - prev;
  return { key, label, value, prev, delta, deltaPct: prev ? Math.round((delta / prev) * 100) : null, goodUp, spark, suffix };
}

/**
 * Build the whole report model.
 *
 * `now` is passed in rather than read from the clock so the caller controls the
 * tick — the window has to keep moving while the store is idle, otherwise a
 * dashboard left open silently shows a stale slice of time.
 */
export function computeTower(
  cases: OnboardingCase[], now: number, cfg: RangeCfg, filters: Filters, ops: OperationsConfig,
): TowerModel {
  const span = cfg.hours * 3600_000;
  const from = now - span;
  const prevFrom = from - span;

  const inWindow = cases.filter((c) => Date.parse(c.createdAt) >= from);
  const s = inWindow.filter((c) => matches(c, filters));
  const prev = cases
    .filter((c) => { const t = Date.parse(c.createdAt); return t >= prevFrom && t < from; })
    .filter((c) => matches(c, filters));

  const T = s.length;
  // Straight-through is a rate over *settled* work only. Measured across every
  // case in the window it counts applications that are untouched purely because
  // they landed a minute ago, which inflates the rate and then makes it fall as
  // the backlog is worked — exactly backwards from what an operator expects.
  const settledOf = (set: OnboardingCase[]) => set.filter((c) => isOpened(c) || isStuck(c) || isDeclined(c));
  const settled = settledOf(s);
  const clean = settled.filter((c) => !isTouched(c)).length;
  const opened = s.filter(isOpened).length;
  const exceptions = s.filter(isStuck).length;
  const awaitingKyc = s.filter(isAwaitingKyc).length;
  const inValidation = s.filter(
    (c) => c.state === 'VALIDATION_IN_PROGRESS' || (c.state === 'VALIDATED' && !isOpened(c)),
  ).length;
  const activated = s.filter((c) => c.state === 'FULLY_ACTIVATED').length;
  const stp = pct(clean, settled.length);

  // ── Buckets: the throughput spine, and the source of every sparkline ───────
  const count = Math.max(1, Math.round(cfg.hours / cfg.bucketH));
  const bucketMs = cfg.bucketH * 3600_000;
  const daily = cfg.bucketH >= 24;
  // A week reads by weekday; a month reads by date.
  const byDate = daily && count > 10;
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => {
    const start = from + i * bucketMs;
    const d = new Date(start + bucketMs / 2);
    const inB = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + bucketMs; });
    return {
      start,
      label: byDate ? `${d.getDate()} ${MON[d.getMonth()]}` : daily ? DAY_SHORT[d.getDay()] : two(d.getHours()),
      full: byDate ? `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` : daily ? DAY_FULL[d.getDay()] : `${two(d.getHours())}:00`,
      arrived: inB.length,
      opened: inB.filter(isOpened).length,
    };
  });
  const inBucket = (c: OnboardingCase, b: Bucket) => { const t = Date.parse(c.createdAt); return t >= b.start && t < b.start + bucketMs; };
  const bucketMax = Math.max(1, ...buckets.map((b) => b.arrived));
  const peakIndex = buckets.reduce((a, b, i) => (b.arrived > buckets[a].arrived ? i : a), 0);

  const sparkOf = (pred: (c: OnboardingCase) => boolean) =>
    buckets.map((b) => s.filter((c) => {
      const t = Date.parse(c.createdAt);
      return t >= b.start && t < b.start + bucketMs && pred(c);
    }).length);
  // The STP sparkline is a rate, not a count, so it needs its own pass.
  const stpSpark = buckets.map((b) => {
    const inB = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= b.start && t < b.start + bucketMs; });
    const st = settledOf(inB);
    return pct(st.filter((c) => !isTouched(c)).length, st.length);
  });

  const prevSettled = settledOf(prev);
  const prevClean = prevSettled.filter((c) => !isTouched(c)).length;
  const kpis: Kpi[] = [
    kpi('arrived', 'Applications', T, prev.length, true, buckets.map((b) => b.arrived)),
    kpi('stp', 'Straight-through', stp, pct(prevClean, prevSettled.length), true, stpSpark, '%'),
    kpi('opened', 'Accounts opened', opened, prev.filter(isOpened).length, true, buckets.map((b) => b.opened)),
    // Cases a person had to look at — still open or since worked. Counting only
    // the ones open now makes the prior period read as zero once its queue has
    // been cleared, which is a fact about the operators, not the intake.
    kpi('exceptions', 'Exceptions', s.filter(isTouched).length, prev.filter(isTouched).length, false, sparkOf(isTouched)),
  ];

  // ── Mix & channels ────────────────────────────────────────────────────────
  // A 100% stack has to partition the set, so each case falls into exactly one
  // lane by priority. The previous version tested overlapping predicates — a
  // clean case awaiting KYC counted twice — and the percentages summed past 100.
  const laneOf = (c: OnboardingCase): string => {
    if (isStuck(c)) return 'person';
    if (isDeclined(c)) return 'declined';
    if (isAwaitingKyc(c)) return 'kyc';
    if (c.state === 'VALIDATION_IN_PROGRESS' || (c.state === 'VALIDATED' && !isOpened(c))) return 'validation';
    if (isOpened(c)) return isTouched(c) ? 'reviewed' : 'clean';
    return 'arrived';
  };
  const LANES: { key: string; label: string; color: string }[] = [
    { key: 'clean', label: 'Opened, no touch', color: BRAND },
    { key: 'reviewed', label: 'Opened after review', color: BRAND_2 },
    { key: 'kyc', label: 'Awaiting KYC', color: SIG.info },
    { key: 'validation', label: 'In validation', color: SIG.warn },
    { key: 'person', label: 'Needs a person', color: SIG.bad },
    { key: 'declined', label: 'Declined', color: '#8a8886' },
    { key: 'arrived', label: 'Just arrived', color: '#c8c6c4' },
  ];
  const mix: Slice[] = LANES
    .map((l) => { const n = s.filter((c) => laneOf(c) === l.key).length; return { ...l, n, pct: pct(n, T) }; })
    .filter((x) => x.n > 0);

  const channels: Slice[] = (['bulk', 'single', 'self'] as Channel[])
    .map((k) => {
      const n = s.filter((c) => channelOf(c) === k).length;
      return { key: k, label: CHANNEL_LABEL[k], n, pct: pct(n, T), color: channelColor(k) };
    })
    .filter((c) => c.n > 0);

  // ── Funnel ────────────────────────────────────────────────────────────────
  const reached = [
    T,
    s.filter((c) => isOpened(c) || (c.state === 'VALIDATED' && !isStuck(c))).length,
    opened,
    activated,
  ];
  const funnel: FunnelStep[] = ['Arrived', 'Validated', 'Account open', 'Activated'].map((label, i) => {
    const n = reached[i];
    const drop = i > 0 ? reached[i - 1] - n : 0;
    return { label, n, pct: pct(n, T), drop, dropPct: i > 0 ? pct(drop, reached[i - 1]) : 0 };
  });

  // ── Causes ────────────────────────────────────────────────────────────────
  const causes = CHECKS
    .map((k) => { const n = s.filter((c) => failedCheck(c, k)).length; return { key: k, label: checkLabel[k], n, pct: pct(n, T) }; })
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  // ── SLA (config.operations.slaMinutes, previously unread) ─────────────────
  const slaMinutes = ops.slaMinutes;
  const ageMins = (c: OnboardingCase) => (now - Date.parse(c.createdAt)) / 60_000;
  /** Only work still waiting on somebody can breach; a closed case cannot. */
  const openWork = s.filter((c) => isStuck(c) || isAwaitingKyc(c) || c.state === 'COMPLIANCE_HOLD' || c.state === 'EDD_REVIEW');
  const breached = openWork.filter((c) => ageMins(c) > slaMinutes).length;
  const atRisk = openWork.filter((c) => { const a = ageMins(c); return a > slaMinutes * 0.75 && a <= slaMinutes; }).length;
  const sla = {
    slaMinutes,
    breached,
    atRisk,
    openWork: openWork.length,
    worstMins: openWork.length ? Math.round(Math.max(...openWork.map(ageMins))) : 0,
    buckets: ([
      { key: 'ok', label: 'Within SLA', n: openWork.length - breached - atRisk, color: SIG.good },
      { key: 'risk', label: 'At risk', n: atRisk, color: SIG.warn },
      { key: 'breach', label: 'Breached', n: breached, color: SIG.bad },
    ] as SlaBucket[]).filter((b) => b.n > 0),
  };

  // ── Routing (config.operations.routing, previously unread) ────────────────
  // Map each piece of open work onto the cause the routing table names, so the
  // queue load is the tenant's own rules applied to live cases rather than a
  // second, parallel taxonomy invented here.
  const causeOf = (c: OnboardingCase): string | null => {
    if (timedOut(c)) return 'Gateway timeout';
    if (failedCheck(c, 'LIVENESS')) return 'Liveness below threshold';
    if (CHECKS.some((k) => k !== 'LIVENESS' && failedCheck(c, k))) return 'Identity check failed';
    if (c.state === 'PENDING_DOCUMENTS' || c.state === 'PENDING_LIVENESS') return 'Documents outstanding';
    return null;
  };
  const queues: QueueLoad[] = ops.routing
    .map((r) => ({
      queue: r.queue, cause: r.cause, assignTo: r.assignTo ?? '',
      n: openWork.filter((c) => causeOf(c) === r.cause).length,
    }))
    .sort((a, b) => b.n - a.n);

  // ── Aging ─────────────────────────────────────────────────────────────────
  const AGE_EDGES = [60, 240, 720, Infinity];
  const AGE_LABELS = ['< 1h', '1–4h', '4–12h', '12h+'];
  const aging = AGE_LABELS.map((label, i) => ({
    label,
    n: openWork.filter((c) => { const a = ageMins(c); return a < AGE_EDGES[i] && (i === 0 || a >= AGE_EDGES[i - 1]); }).length,
  }));

  // ── Upstream health ───────────────────────────────────────────────────────
  // Finacle used to be hardcoded "nominal". Its real signal is work that passed
  // every check yet still has no account number well past half SLA: the checks
  // are fine, so the core is what is not answering.
  // Health is a rate, not a count: three failures in an hour is an outage,
  // three in a month is Tuesday. Above 5% of intake reads bad, above 1.5% warn.
  const rate = (n: number) => (T ? n / T : 0);
  const sigOf = (n: number): Upstream['sig'] => (rate(n) > 0.05 ? 'bad' : rate(n) > 0.015 ? 'warn' : 'ok');
  const pctOf = (n: number) => `${Math.round(rate(n) * 1000) / 10}%`;
  const svc = (kinds: ValidationKind[], name: string): Upstream => {
    const failures = s.filter((c) => kinds.some((k) => failedCheck(c, k))).length;
    const sig = sigOf(failures);
    return { name, failures, sig, note: failures === 0 ? 'nominal' : `${failures} failing · ${pctOf(failures)}` };
  };
  const finacleStalled = s.filter(
    (c) => !isOpened(c) && !isTouched(c) && c.state === 'VALIDATED' && ageMins(c) > slaMinutes / 2,
  ).length;
  const upstream: Upstream[] = [
    svc(['NIN'], CO.secondaryId.authority),
    svc(['BVN'], CO.primaryId.authority),
    svc(['LIVENESS'], 'Liveness'),
    {
      name: 'Finacle',
      failures: finacleStalled,
      sig: sigOf(finacleStalled),
      note: finacleStalled ? `${finacleStalled} cleared but unopened · ${pctOf(finacleStalled)}` : 'nominal',
    },
  ];

  // ── Attention list ────────────────────────────────────────────────────────
  // "Why work stops" is historical — every failure in the window. The attention
  // list is not: it counts the cases a person still has to pick up.
  const openCauses = CHECKS
    .map((k) => ({ key: k, label: checkLabel[k], n: openWork.filter((c) => isStuck(c) && primaryFail(c) === k).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const attn: Attn[] = [
    ...openCauses.map((c) => ({
      icon: 'alert', title: c.label, sub: `${c.n} ${c.n === 1 ? 'case' : 'cases'} to review`,
      sig: 'bad' as const, check: c.key,
    })),
    ...(sla.breached ? [{ icon: 'clock', title: 'SLA breached', sub: `${sla.breached} past ${slaMinutes}m`, sig: 'bad' as const, check: null }] : []),
    ...(awaitingKyc ? [{ icon: 'clock', title: 'Awaiting KYC', sub: `${awaitingKyc} open · links sent`, sig: 'warn' as const, check: null }] : []),
    ...(inValidation ? [{ icon: 'spark', title: 'In validation', sub: `${inValidation} running now`, sig: 'ok' as const, check: null }] : []),
  ].slice(0, 6);

  // ── Average time to open ──────────────────────────────────────────────────
  const openDurations = s
    .map((c) => { const o = openedAt(c); return o === null ? null : (o - Date.parse(c.createdAt)) / 60_000; })
    .filter((v): v is number => v !== null && v >= 0);
  const avgOpenMins = openDurations.length
    ? Math.round(openDurations.reduce((a, b) => a + b, 0) / openDurations.length)
    : null;

  // ── Sankey: intake → verification → outcome → failing check ──────────────
  const flowCounts: Record<string, number> = {};
  s.forEach((c) => {
    const path: string[] = [channelOf(c), verificationOf(c), outcomeOf(c)];
    if (outcomeOf(c) === 'person') { const f = primaryFail(c); if (f) path.push(f); }
    const k = path.join('>');
    flowCounts[k] = (flowCounts[k] ?? 0) + 1;
  });
  const flows: SkFlow[] = Object.entries(flowCounts).map(([k, n]) => ({ path: k.split('>'), n }));
  const nAt = (ci: number, key: string) => flows.filter((f) => f.path[ci] === key).reduce((a, b) => a + b.n, 0);
  const col0: SkNode[] = (['bulk', 'single', 'self'] as Channel[])
    .map((k) => ({ key: k, label: CHANNEL_LABEL[k], color: channelColor(k), n: 0 }));
  const col1: SkNode[] = [
    { key: 'cleared', label: 'Cleared checks', color: SIG.good, n: 0 },
    { key: 'flagged', label: 'Flagged for review', color: SIG.bad, n: 0 },
  ];
  const col2: SkNode[] = OUTCOMES
    .map((k) => ({ key: k, label: OUTCOME_LABEL[k], color: OUTCOME_COLOR[k], n: 0 }));
  const col3: SkNode[] = FAIL_ORDER
    .filter((k) => flows.some((f) => f.path[3] === k))
    .map((k) => ({ key: k, label: checkLabel[k], color: k === 'BVN' ? SIG.bad : k === 'NIN' ? SIG.warn : SIG.info, n: 0 }));
  const columns = (col3.length ? [col0, col1, col2, col3] : [col0, col1, col2])
    .map((col, ci) => col.map((nd) => ({ ...nd, n: nAt(ci, nd.key) })).filter((nd) => nd.n > 0));

  const flagged = s.filter(isTouched).length;

  // ── Channels ──────────────────────────────────────────────────────────────
  const CHANNELS: Channel[] = ['bulk', 'single', 'self'];
  const openMinsOf = (c: OnboardingCase): number | null => {
    const o = openedAt(c); if (o === null) return null;
    const m = (o - Date.parse(c.createdAt)) / 60_000; return m >= 0 ? m : null;
  };
  // Anything that took more than a day to open is an exception story, not a
  // timing one; one such row would flatten every other point on the trend.
  const nums = (set: OnboardingCase[]) => set.map(openMinsOf).filter((v): v is number => v !== null && v <= 1440);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const quantile = (xs: number[], q: number) => {
    if (!xs.length) return null;
    const a = [...xs].sort((x, y) => x - y);
    return Math.round(a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]);
  };
  const arrivalsByChannel: StackBucket[] = buckets.map((b) => ({
    label: b.label, full: b.full,
    parts: CHANNELS.map((k) => ({
      key: k, label: CHANNEL_LABEL[k], color: channelColor(k),
      n: s.filter((c) => channelOf(c) === k && inBucket(c, b)).length,
    })),
  }));
  const channelStats: ChannelStat[] = CHANNELS.map((k) => {
    const set = s.filter((c) => channelOf(c) === k);
    const st = settledOf(set);
    return {
      key: k, label: CHANNEL_LABEL[k], color: channelColor(k), n: set.length, pct: pct(set.length, T),
      stp: pct(st.filter((c) => !isTouched(c)).length, st.length),
      opened: set.filter(isOpened).length, flagged: set.filter(isTouched).length, avgOpenMins: avg(nums(set)),
    };
  }).filter((x) => x.n > 0);
  const channelOutcome = channelStats.map((ch) => ({
    key: ch.key, label: ch.label,
    cells: OUTCOMES.map((o) => s.filter((c) => channelOf(c) === ch.key && outcomeOf(c) === o).length),
  }));
  const byEmployer: Record<string, { n: number; opened: number }> = {};
  s.forEach((c) => {
    if (!c.employer) return;
    const e = (byEmployer[c.employer] ??= { n: 0, opened: 0 });
    e.n += 1; if (isOpened(c)) e.opened += 1;
  });
  const employers = Object.entries(byEmployer).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n).slice(0, 6);

  // ── Verification ──────────────────────────────────────────────────────────
  const checkStats: CheckStat[] = CHECKS.map((k) => {
    const vs = s.map((c) => c.validations.find((v) => v.kind === k)).filter((v): v is NonNullable<typeof v> => Boolean(v));
    const passed = vs.filter((v) => v.status === 'passed').length;
    const failed = vs.filter((v) => v.status === 'failed').length;
    const timeout = vs.filter((v) => v.status === 'timeout').length;
    const done = passed + failed + timeout;
    return {
      key: k, label: checkLabel[k], passed, failed, timeout, pending: vs.length - done,
      ftr: pct(vs.filter((v) => v.status === 'passed' && v.attempts <= 1).length, done),
      retries: vs.filter((v) => v.attempts > 1).length,
    };
  });
  const failuresByBucket: StackBucket[] = buckets.map((b) => ({
    label: b.label, full: b.full,
    parts: CHECKS.map((k) => ({
      key: k, label: checkLabel[k], color: CHECK_COLOR[k],
      n: s.filter((c) => inBucket(c, b) && failedCheck(c, k)).length,
    })),
  }));
  const clearedTrend: Series[] = [
    {
      key: 'cleared', label: 'Cleared first time', color: SIG.good,
      points: buckets.map((b) => { const inB = s.filter((c) => inBucket(c, b)); return inB.length ? pct(inB.filter((c) => !isTouched(c)).length, inB.length) : null; }),
    },
    {
      // Per check rather than per case: the share of completed checks that
      // passed at the first attempt. Diverges from the case rate when one
      // check is retrying a lot without ever quite failing.
      key: 'ftr', label: 'Checks passed first time', color: BRAND,
      points: buckets.map((b) => {
        const done = s.filter((c) => inBucket(c, b)).flatMap((c) => c.validations.filter((v) => v.status === 'passed' || v.status === 'failed' || v.status === 'timeout'));
        return done.length ? pct(done.filter((v) => v.status === 'passed' && v.attempts <= 1).length, done.length) : null;
      }),
    },
  ];
  const allDone = s.flatMap((c) => c.validations.filter((v) => v.status === 'passed' || v.status === 'failed' || v.status === 'timeout'));
  const attempts = [
    { label: 'First attempt', n: allDone.filter((v) => v.attempts <= 1).length },
    { label: 'One retry', n: allDone.filter((v) => v.attempts === 2).length },
    { label: 'Two or more', n: allDone.filter((v) => v.attempts >= 3).length },
  ];
  const firstTimeRight = pct(allDone.filter((v) => v.status === 'passed' && v.attempts <= 1).length, allDone.length);
  const totalFailures = checkStats.reduce((a, c) => a + c.failed, 0);
  const totalTimeouts = checkStats.reduce((a, c) => a + c.timeout, 0);
  const totalRetries = checkStats.reduce((a, c) => a + c.retries, 0);

  // ── Timing ────────────────────────────────────────────────────────────────
  const openMins = nums(s);
  const BANDS = [
    { label: '< 5m', max: 5 }, { label: '5–15m', max: 15 }, { label: '15–30m', max: 30 },
    { label: '30–60m', max: 60 }, { label: '1–4h', max: 240 }, { label: '4h+', max: Infinity },
  ];
  const openHistogram = BANDS.map((b, i) => ({
    label: b.label, late: i >= 4,
    n: openMins.filter((v) => v < b.max && (i === 0 || v >= BANDS[i - 1].max)).length,
  }));
  const medianOpenTrend: Series[] = [
    { key: 'median', label: 'Median', color: BRAND, points: buckets.map((b) => quantile(nums(s.filter((c) => inBucket(c, b))), 0.5)) },
    { key: 'p90', label: '90th percentile', color: SIG.warn, points: buckets.map((b) => quantile(nums(s.filter((c) => inBucket(c, b))), 0.9)) },
  ];
  let runA = 0, runO = 0;
  const cumulative: Series[] = [
    { key: 'arrived', label: 'Arrived', color: BRAND, points: buckets.map((b) => (runA += b.arrived)) },
    { key: 'opened', label: 'Opened', color: BRAND_2, points: buckets.map((b) => (runO += b.opened)) },
  ];
  const DOW = [1, 2, 3, 4, 5, 6, 0];   // Monday first
  const heatCells = DOW.map((d) => Array.from({ length: 24 }, (_, h) =>
    s.filter((c) => { const t = new Date(c.createdAt); return t.getDay() === d && t.getHours() === h; }).length));
  const heat = { rows: DOW.map((d) => DAY_SHORT[d]), cols: Array.from({ length: 24 }, (_, h) => two(h)), cells: heatCells };
  const hourOfDay = Array.from({ length: 24 }, (_, h) => ({
    label: h % 3 === 0 ? `${two(h)}:00` : '',
    n: s.filter((c) => new Date(c.createdAt).getHours() === h).length,
  }));
  const weekdayLoad = DOW.map((d) => ({ label: DAY_SHORT[d], n: s.filter((c) => new Date(c.createdAt).getDay() === d).length }));

  // ── Facet counts, computed before filtering so the pane stays navigable ───
  const facetOf = <K extends string>(keys: K[], of: (c: OnboardingCase) => K) =>
    Object.fromEntries(keys.map((k) => [k, inWindow.filter((c) => of(c) === k).length])) as Record<string, number>;

  return {
    total: T,
    windowTotal: inWindow.length,
    kpis, buckets, bucketMax, peakIndex,
    mix, channels, funnel,
    activated, activatedPct: pct(activated, T), stp, clean, settled: settled.length,
    hoursReturned: Math.round((clean * (MANUAL_MIN - AUTO_MIN)) / 60 * 10) / 10,
    exceptions, awaitingKyc, openItems: openWork.length,
    causes, sla, queues, aging, upstream, attn, avgOpenMins,
    sankey: { columns, flows },
    clearedPct: pct(T - flagged, T), flagged,
    arrivalsByChannel, channelStats, channelOutcome, employers,
    checkStats, failuresByBucket, clearedTrend, attempts, firstTimeRight, totalFailures, totalTimeouts, totalRetries,
    openHistogram, medianOpenTrend, cumulative, heat, hourOfDay, weekdayLoad,
    medianOpenMins: quantile(openMins, 0.5), p90OpenMins: quantile(openMins, 0.9),
    bucketLabels: buckets.map((b) => ({ label: b.label, full: b.full })),
    facets: {
      channel: facetOf(['bulk', 'single', 'self'] as Channel[], channelOf),
      verification: facetOf(['cleared', 'flagged'] as VerificationKey[], verificationOf),
      outcome: facetOf(OUTCOMES, outcomeOf),
      check: Object.fromEntries(CHECKS.map((k) => [k, inWindow.filter((c) => failedCheck(c, k)).length])),
    },
  };
}
