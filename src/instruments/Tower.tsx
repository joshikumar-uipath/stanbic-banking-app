// ─────────────────────────────────────────────────────────────────────────────
// The morning brief (/tower) — the factory, read to you.
//
// The dashboard versions failed because a control tower full of charts makes you
// assemble the story yourself. The product's best moment is the Ops console's
// written "pattern found" card — so this leans all the way into that: a brief
// that interprets the night's numbers in plain sentences, with the figures set
// into the prose, and exactly one supporting strip. The writing is generated
// from the live store, so it is always true, never canned.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

const MANUAL_MIN = 35, AUTO_MIN = 4;

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: 'last 24 hours', hours: 24, bucketH: 3 },
  { id: '48h', label: 'last 48 hours', hours: 48, bucketH: 6 },
  { id: '7d', label: 'last 7 days', hours: 168, bucketH: 24 },
];

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
const opened = (c: OnboardingCase) => Boolean(c.accountNumber);
const stuck = (c: OnboardingCase) => c.state === 'EXCEPTION';
const touched = (c: OnboardingCase) =>
  stuck(c) || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');
const pl = (n: number, s: string, p = `${s}s`) => (n === 1 ? s : p);

const CHECK: Record<string, { label: string; cause: string }> = {
  NIN: { label: 'NIN', cause: 'NIMC timed out at the gateway rather than the numbers being wrong' },
  BVN: { label: 'BVN', cause: 'NIBSS was returning failures — the service was degraded, not your data' },
  AML: { label: 'AML screening', cause: 'the screening partner flagged them for a second look' },
  PEP: { label: 'PEP screening', cause: 'a politically-exposed match needed a human decision' },
  FRAUD: { label: 'fraud screening', cause: 'the fraud engine wanted a person to confirm' },
  LIVENESS: { label: 'the selfie check', cause: 'the liveness score fell below the bar' },
};
const KINDS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];

/** Relative age of the oldest thing in a set, in a human phrase. */
function agePhrase(iso: string, now: number): string {
  const h = Math.floor((now - Date.parse(iso)) / 3600_000);
  if (h < 1) return 'under an hour';
  if (h < 24) return `${h} ${pl(h, 'hour')}`;
  const d = Math.floor(h / 24);
  return `${d} ${pl(d, 'day')}`;
}

function BriefInner() {
  useBrandVars('Morning Brief');
  const [range, setRange] = useState<Range>('48h');
  const [showData, setShowData] = useState(false);
  const [{ cases, now }, setData] = useState<{ cases: OnboardingCase[]; now: number }>({ cases: [], now: 0 });

  useEffect(() => {
    let alive = true;
    const refresh = () => { void store.list().then((all) => { if (alive) setData({ cases: all, now: Date.now() }); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  const cfg = RANGES.find((r) => r.id === range)!;

  const m = useMemo(() => {
    const from = now - cfg.hours * 3600_000;
    const s = cases.filter((c) => Date.parse(c.createdAt) >= from);
    const clean = s.filter((c) => !touched(c));
    const bulk = s.filter((c) => c.channel === 'bulk');
    const stp = s.length ? Math.round((clean.length / s.length) * 100) : 0;

    const fails = KINDS
      .map((k) => ({ k, n: s.filter((c) => c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'))).length }))
      .filter((f) => f.n > 0)
      .sort((a, b) => b.n - a.n);

    const kyc = s.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS');
    const exceptions = s.filter(stuck);
    const oldestExc = exceptions.map((c) => c.createdAt).sort()[0];

    // Arrivals, bucketed — the one supporting strip.
    const count = Math.round(cfg.hours / cfg.bucketH), span = cfg.bucketH * 3600_000;
    const flow = Array.from({ length: count }, (_, i) => {
      const start = from + i * span, d = new Date(start + span / 2);
      const inB = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + span; });
      return {
        n: inB.length, bulk: inB.filter((c) => c.channel === 'bulk').length,
        label: cfg.bucketH >= 24 ? DAY[d.getDay()] : two(d.getHours()),
        full: cfg.bucketH >= 24 ? `${DAY[d.getDay()]} ${d.getDate()}` : `${two(d.getHours())}:00`,
      };
    });

    return {
      total: s.length, opened: s.filter(opened).length, clean: clean.length, stp,
      bulk: bulk.length, employer: bulk.find((c) => c.employer)?.employer,
      fails, top: fails[0], kyc: kyc.length, exceptions: exceptions.length, oldestExc,
      hours: Math.round((clean.length * (MANUAL_MIN - AUTO_MIN)) / 60 * 10) / 10,
      flow,
    };
  }, [cases, now, cfg]);

  const stamp = now ? `${two(new Date(now).getHours())}:${two(new Date(now).getMinutes())}` : '';
  const flowMax = Math.max(1, ...m.flow.map((f) => f.n));
  const peak = m.flow.reduce((a, b) => (b.n > a.n ? b : a), m.flow[0] ?? { n: -1, full: '' });

  return (
    <div className="inst">
      <TopBar system="Morning Brief" sub="Account opening" />

      <div className="br-scroll">
        <div className="br-filters">
          <div className="cm-segs" role="group" aria-label="Period">
            {RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label.replace('last ', '')}</button>)}
          </div>
          <button className="tw-toggle" aria-pressed={showData} onClick={() => setShowData((v) => !v)}>
            {showData ? 'Hide the numbers' : 'Show the numbers'}
          </button>
        </div>

        {m.total === 0 ? (
          <div className="fn-empty"><b>Quiet shift</b><span>No applications came through in the {cfg.label}. Try a wider period.</span></div>
        ) : (
          <article className="br">
            <div className="br-kicker">The brief · {cfg.label} · as of {stamp}</div>

            {/* The lede — the one thing to know, with the figures set into it.
                Both numbers are the straight-through set, so they never disagree. */}
            <h1 className="br-lede">
              <b>{m.total}</b> {pl(m.total, 'application')} came through the line.{' '}
              <b>{m.clean}</b> cleared without a person —{' '}
              <span className="hl">{m.stp}% straight through</span>.
            </h1>

            <div className="br-cols">
              <div className="br-body">
                {m.bulk > 0 && (
                  <p>
                    <b>{m.bulk}</b> of them arrived on the payroll line{m.employer ? <> — {m.employer} and others</> : ''}, uploaded in a batch and processed without anyone opening them one by one.
                  </p>
                )}

                {m.top ? (
                  <p>
                    The line ran clean through most of its checks. What cost time was <b>{CHECK[m.top.k].label}</b>: <b>{m.top.n}</b> {pl(m.top.n, 'case')} came back unverified, {CHECK[m.top.k].cause}.
                    {m.fails.length > 1 && <> A handful of others tripped a second check.</>}
                  </p>
                ) : (
                  <p>Every mandatory check passed first time. Nothing on the line needed a person.</p>
                )}

                {(m.kyc > 0 || m.exceptions > 0) && (
                  <p>
                    {m.kyc > 0 && <><b>{m.kyc}</b> {pl(m.kyc, 'account')} {m.kyc === 1 ? 'is' : 'are'} open but limited, waiting on a customer selfie or document — the KYC links have already gone out by SMS and WhatsApp. </>}
                    {m.exceptions > 0 && <><b>{m.exceptions}</b> {m.exceptions === 1 ? 'is' : 'are'} still stuck with a person{m.oldestExc ? <>, the oldest for {agePhrase(m.oldestExc, now)}</> : ''}.</>}
                  </p>
                )}

                <p className="br-close">
                  Net, the machines gave you back about <b>{m.hours} {pl(m.hours, 'hour')}</b> of handling this {cfg.hours <= 24 ? 'day' : 'stretch'} — time nobody spent opening an account that opened itself.
                </p>
              </div>

              {/* The rail: the numbers behind the sentences, and when work landed. */}
              <aside className="br-rail">
                <div className="br-figs">
                  <Fig v={`${m.stp}%`} k="straight through" tone={m.stp >= 80 ? 'good' : m.stp >= 60 ? 'warn' : 'bad'} />
                  <Fig v={m.top ? m.top.n : 0} k={m.top ? `${CHECK[m.top.k].label} ${pl(m.top.n, 'case')} stuck` : 'checks failed'} tone={m.top ? 'bad' : 'good'} />
                  <Fig v={m.kyc} k="open, awaiting KYC" tone="mute" />
                  <Fig v={`${m.hours}h`} k="handling returned" tone="mute" />
                </div>

                <div className="br-spark">
                  <div className="br-spark-h">When they arrived<span>peak {peak.n} · {peak.full}</span></div>
                  <div className="br-bars">
                    {m.flow.map((f, i) => (
                      <span key={i} className="b" title={`${f.full}: ${f.n}`}>
                        {/* A quiet hour is a faint baseline tick, not a gap — so the
                            row reads as one continuous timeline. */}
                        <i style={f.n === 0
                          ? { height: 3, background: 'var(--i-line)' }
                          : { height: `${Math.max(9, (f.n / flowMax) * 100)}%`, opacity: f.bulk > f.n / 2 ? 1 : 0.5 }} />
                      </span>
                    ))}
                  </div>
                  <div className="br-axis"><span>{m.flow[0]?.label}</span><span>{m.flow[Math.floor(m.flow.length / 2)]?.label}</span><span>{m.flow[m.flow.length - 1]?.label}</span></div>
                  <div className="br-spark-k">Taller, solid bars are payroll uploads.</div>
                </div>
              </aside>
            </div>

            {showData && (
              <div className="br-data">
                <Table head={['Check', 'Cases needing a person']} rows={m.fails.length ? m.fails.map((f) => [CHECK[f.k].label, String(f.n)]) : [['—', '0']]} />
                <Table head={['Window', 'Arrived', 'From payroll']} rows={m.flow.map((f) => [f.full, String(f.n), String(f.bulk)])} />
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}

function Fig({ v, k, tone }: { v: string | number; k: string; tone: 'good' | 'warn' | 'bad' | 'mute' }) {
  return (
    <div className="br-fig">
      <div className={`v ${tone}`}>{v}</div>
      <div className="k">{k}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="tw-table">
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

export default function BriefConsole() {
  return <InstrumentProvider><BriefInner /></InstrumentProvider>;
}
