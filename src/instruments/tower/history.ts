// ─────────────────────────────────────────────────────────────────────────────
// Control tower — synthetic history.
//
// The case store holds the handful of cases this demo has actually run, so
// on its own a 30-day report is a flat line with one spike at the end. This
// backfills 60 days of plausible account-opening traffic behind the real rows —
// weekday seasonality, a month-end payroll surge, a realistic mix of outcomes —
// so the ranges, the prior-period deltas and the Sankey have something to say.
// Sixty days rather than thirty because the 30-day range compares itself with
// the thirty days before it.
//
// Deterministic: every case is derived from its calendar day and index through a
// seeded generator, so a reload shows the same month and the numbers do not
// jitter between ticks. Tower-only: nothing here touches the store, the desk or
// the ops console — the sheet already says "Computed in-app · demo data".
// ─────────────────────────────────────────────────────────────────────────────
import type {
  CaseEvent, Channel, OnboardingCase, OnboardingState, Source, ValidationKind, ValidationStatus,
} from '../../onboarding';

export const HISTORY_DAYS = 60;
const KINDS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];
const FIRST = ['Adaeze', 'Bolanle', 'Chidi', 'Damilola', 'Efe', 'Folake', 'Gbenga', 'Halima', 'Ifeoma', 'Jide',
  'Kemi', 'Lanre', 'Musa', 'Ngozi', 'Obinna', 'Peju', 'Rotimi', 'Sade', 'Tunde', 'Uche', 'Yemi', 'Zainab'];
const LAST = ['Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Ibrahim', 'Okonkwo', 'Olawale', 'Abubakar', 'Nwosu', 'Bello',
  'Chukwu', 'Danjuma', 'Ogunleye', 'Umar', 'Adebayo', 'Mohammed', 'Onyeka', 'Lawal', 'Igwe', 'Yusuf'];
const EMPLOYERS = ['Dangote Group', 'MTN Nigeria', 'Flour Mills', 'Nestlé Nigeria', 'Julius Berger'];

/** mulberry32 — small, fast, and good enough for a demo's month. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

// Arrivals per weekday, Sunday first. A branch network's week: quiet weekends,
// Monday's queue, Friday tailing off.
const WEEKDAY = [4, 24, 22, 21, 23, 19, 8];
const HOURS = [8, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 13, 14, 14, 15, 15, 16, 17];

interface Plan {
  state: OnboardingState;
  opened: boolean;
  activated: boolean;
  /** A check that timed out and was retried — the case opened, but a person looked. */
  touched?: ValidationKind;
  /** A check that failed outright — the case is stuck, or was declined. */
  failed?: ValidationKind;
  openAfterMin: number;
}

/** Where a case of this age has got to. Younger cases are still moving; older
 *  ones have settled, and the stuck ones have long since been worked. */
function plan(r: () => number, ageH: number): Plan {
  const p = r();
  const quick = 4 + Math.round(r() * 26);          // straight-through: minutes
  const slow = 90 + Math.round(r() * 320);         // after a human retry
  if (ageH < 3) {
    if (p < 0.42) return { state: 'VALIDATION_IN_PROGRESS', opened: false, activated: false, openAfterMin: 0 };
    if (p < 0.66) return { state: 'PENDING_LIVENESS', opened: true, activated: false, openAfterMin: quick };
    if (p < 0.88) return { state: 'ACCOUNT_CREATED', opened: true, activated: false, openAfterMin: quick };
    return { state: 'EXCEPTION', opened: false, activated: false, failed: pick(r, ['BVN', 'BVN', 'NIN', 'PEP', 'FRAUD']), openAfterMin: 0 };
  }
  if (ageH < 72) {
    if (p < 0.68) return { state: 'FULLY_ACTIVATED', opened: true, activated: true, openAfterMin: quick };
    if (p < 0.80) return { state: 'ACCOUNT_CREATED', opened: true, activated: false, openAfterMin: quick };
    if (p < 0.85) return { state: r() < 0.6 ? 'PENDING_LIVENESS' : 'PENDING_DOCUMENTS', opened: true, activated: false, openAfterMin: quick };
    if (p < 0.93) return { state: 'FULLY_ACTIVATED', opened: true, activated: true, touched: pick(r, ['NIN', 'LIVENESS', 'NIN']), openAfterMin: slow };
    if (p < 0.96) return { state: 'EXCEPTION', opened: false, activated: false, failed: pick(r, ['BVN', 'BVN', 'NIN', 'PEP', 'FRAUD', 'AML']), openAfterMin: 0 };
    return { state: 'DECLINED', opened: false, activated: false, failed: pick(r, ['AML', 'PEP', 'FRAUD', 'BVN']), openAfterMin: 0 };
  }
  if (p < 0.80) return { state: 'FULLY_ACTIVATED', opened: true, activated: true, openAfterMin: quick };
  if (p < 0.89) return { state: 'FULLY_ACTIVATED', opened: true, activated: true, touched: pick(r, ['NIN', 'LIVENESS', 'NIN', 'BVN']), openAfterMin: slow };
  if (p < 0.95) return { state: 'ACCOUNT_CREATED', opened: true, activated: false, openAfterMin: quick };
  return { state: 'DECLINED', opened: false, activated: false, failed: pick(r, ['AML', 'PEP', 'FRAUD', 'BVN']), openAfterMin: 0 };
}

function makeCase(r: () => number, id: string, at: number, now: number, channel: Channel, batchId: string | undefined, n: number): OnboardingCase {
  const ageH = (now - at) / 3600_000;
  const pl = plan(r, ageH);
  const first = pick(r, FIRST), last = pick(r, LAST);
  const created = new Date(at).toISOString();
  const openedAt = pl.opened ? at + pl.openAfterMin * 60_000 : null;
  const validations = KINDS.map((kind) => {
    let status: ValidationStatus = 'passed';
    if (pl.state === 'VALIDATION_IN_PROGRESS') status = kind === 'NIN' || kind === 'BVN' ? 'passed' : kind === 'LIVENESS' ? 'pending' : 'running';
    if (pl.touched === kind) status = 'timeout';
    if (pl.failed === kind) status = 'failed';
    if (pl.state === 'PENDING_LIVENESS' && kind === 'LIVENESS') status = 'pending';
    const attempts = status === 'timeout' ? 3 : status === 'pending' ? 0 : 1;
    return { kind, status, attempts, updatedAt: created };
  });
  const timeline: CaseEvent[] = [
    { id: `${id}-e0`, caseId: id, topic: 'account-opening-requested', message: `Account opening requested for ${first} ${last}`, at: created },
  ];
  if (openedAt !== null) {
    timeline.push({ id: `${id}-e1`, caseId: id, topic: 'account-created', message: `Account created for ${first} ${last}`, at: new Date(openedAt).toISOString() });
  }
  if (pl.state === 'EXCEPTION') {
    timeline.push({ id: `${id}-e2`, caseId: id, topic: 'exception-queue', message: `${pl.failed} check failed for ${first} ${last}`, at: created });
  }
  const source: Source = channel === 'self' ? 'customer' : channel === 'bulk' ? 'rm' : r() < 0.7 ? 'branch' : 'rm';
  const last3 = String(1000 + n).slice(-3);
  return {
    id, firstName: first, lastName: last,
    phone: `+23480${String(1000000 + Math.floor(r() * 8999999))}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    bvn: `221${String(10000000 + Math.floor(r() * 89999999))}`,
    nin: `${String(10000000000 + Math.floor(r() * 89999999999))}`,
    address: `${1 + Math.floor(r() * 120)} ${pick(r, ['Adeola Odeku', 'Broad Street', 'Awolowo Road', 'Herbert Macaulay', 'Aminu Kano Crescent'])}`,
    employer: channel === 'bulk' ? pick(r, EMPLOYERS) : undefined,
    channel, source, batchId,
    state: pl.state, duplicate: 'new',
    validations,
    cif: pl.opened ? `CIF${last3}${String(at).slice(-5)}` : undefined,
    accountNumber: pl.opened ? `00${String(at).slice(-8)}` : undefined,
    createdAt: created,
    updatedAt: new Date(openedAt ?? at).toISOString(),
    timeline,
  };
}

let cache: { key: number; rows: OnboardingCase[] } | null = null;

/**
 * The backfill for the sixty days ending now. Memoised in quarter-hour steps:
 * within a step the set is identical, and as the clock moves on today's later
 * arrivals appear, the way a live table would fill.
 */
export function syntheticHistory(now: number): OnboardingCase[] {
  const key = Math.floor(now / 900_000);
  if (cache && cache.key === key) return cache.rows;
  const rows: OnboardingCase[] = [];
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const day = new Date(midnight); day.setDate(midnight.getDate() - d);
    const dayStart = day.getTime();
    const stamp = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
    const r = rng(stamp * 7919 + 17);
    // Volume: the weekday's base, a gentle upward trend into the present, and
    // a month-end payroll batch when the 24th–27th falls on a working day.
    const wd = day.getDay();
    const trend = 0.9 + 0.1 * (1 - d / HISTORY_DAYS);
    const n = Math.round(WEEKDAY[wd] * trend * (0.78 + r() * 0.44));
    const payroll = wd >= 1 && wd <= 5 && day.getDate() >= 24 && day.getDate() <= 27;
    const batchN = payroll ? 12 + Math.floor(r() * 6) : (wd >= 1 && wd <= 5 && r() < 0.18 ? 4 + Math.floor(r() * 3) : 0);
    const batchId = batchN ? `BATCH-${stamp}` : undefined;
    const batchAt = dayStart + (9 * 60 + Math.floor(r() * 50)) * 60_000;
    let i = 0;
    for (; i < n; i++) {
      const at = dayStart + (pick(r, HOURS) * 60 + Math.floor(r() * 60)) * 60_000;
      if (at > now - 45 * 60_000) continue;
      const channel: Channel = r() < 0.34 ? 'self' : 'single';
      rows.push(makeCase(r, `HX-${stamp}-${String(i).padStart(3, '0')}`, at, now, channel, undefined, i));
    }
    for (let b = 0; b < batchN; b++, i++) {
      const at = batchAt + b * 45_000;
      if (at > now - 45 * 60_000) continue;
      rows.push(makeCase(r, `HX-${stamp}-${String(i).padStart(3, '0')}`, at, now, 'bulk', batchId, i));
    }
  }
  cache = { key, rows };
  return rows;
}
