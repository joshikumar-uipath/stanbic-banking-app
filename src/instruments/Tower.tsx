// ─────────────────────────────────────────────────────────────────────────────
// Control tower (/tower) — the account-opening line, one bold branded board.
//
// The design the client chose: a Stanbic-navy hero that owns the headline number
// in Space Grotesk display type with a gold accent, a smooth throughput curve,
// and a small set of supporting tiles. One strong focal point, everything else
// disciplined. Every figure is live off the shared store.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

const MANUAL_MIN = 35, AUTO_MIN = 4;
const GOLD = '#C8A24A', NAVY = '#012169', GREEN = '#2f9e6f', REDA = '#e5566b', REDB = '#d1344b';

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: '24H', hours: 24, bucketH: 2 },
  { id: '48h', label: '48H', hours: 48, bucketH: 3 },
  { id: '7d', label: '7D', hours: 168, bucketH: 12 },
];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
const opened = (c: OnboardingCase) => Boolean(c.accountNumber);
const stuck = (c: OnboardingCase) => c.state === 'EXCEPTION';
const touched = (c: OnboardingCase) =>
  stuck(c) || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');
const failedK = (c: OnboardingCase, k: ValidationKind) =>
  c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'));
const KINDS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];
const KLABEL: Record<string, string> = { NIN: 'NIN · NIMC', BVN: 'BVN · NIBSS', AML: 'AML', PEP: 'PEP', FRAUD: 'Fraud', LIVENESS: 'Selfie' };

interface Pt { label: string; full: string; n: number }
interface Tip { x: number; y: number; title: string; v: string }

function TowerInner() {
  useBrandVars('Control Tower');
  const [range, setRange] = useState<Range>('48h');
  const [tip, setTip] = useState<Tip | null>(null);
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
    const clean = s.filter((c) => !touched(c)).length;
    const stp = s.length ? Math.round((clean / s.length) * 100) : 0;

    const count = Math.round(cfg.hours / cfg.bucketH), span = cfg.bucketH * 3600_000;
    const flow: Pt[] = Array.from({ length: count }, (_, i) => {
      const start = from + i * span, d = new Date(start + span / 2);
      const inB = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + span; });
      return { n: inB.length, label: cfg.bucketH >= 12 ? DAY[d.getDay()] : two(d.getHours()), full: cfg.bucketH >= 12 ? `${DAY[d.getDay()]} ${d.getDate()}` : `${two(d.getHours())}:00` };
    });
    const peak = flow.reduce((a, b) => (b.n > a.n ? b : a), flow[0] ?? { n: 0, full: '' });
    // Cumulative received across the window — an elegant rising curve, and honest:
    // the running total climbs to however many arrived.
    let run = 0;
    const curve: Pt[] = flow.map((p) => { run += p.n; return { ...p, n: run }; });

    const causes = KINDS.map((k) => ({ k, n: s.filter((c) => failedK(c, k)).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
    const channels = ([['bulk', 'Bulk payroll', GOLD], ['single', 'Branch', NAVY], ['self', 'Digital', GREEN]] as const)
      .map(([k, label, color]) => ({ k, label, color, n: s.filter((c) => (c.channel ?? 'single') === k).length })).filter((c) => c.n > 0);
    const funnel = [
      { label: 'Arrived', n: s.length },
      { label: 'Validated', n: s.filter((c) => opened(c) || (c.state === 'VALIDATED' && !stuck(c))).length },
      { label: 'Account open', n: s.filter(opened).length },
      { label: 'Activated', n: s.filter((c) => c.state === 'FULLY_ACTIVATED').length },
    ];

    return {
      total: s.length, opened: s.filter(opened).length, clean, stp,
      exceptions: s.filter(stuck).length, kyc: s.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length,
      hours: Math.round(clean * (MANUAL_MIN - AUTO_MIN) / 60 * 10) / 10,
      flow, curve, peak, causes, causeMax: Math.max(1, ...causes.map((c) => c.n)),
      channels, chTotal: channels.reduce((a, b) => a + b.n, 0), funnel,
    };
  }, [cases, now, cfg]);

  const onTip = (e: { clientX: number; clientY: number }, p: Pt) => setTip({ x: e.clientX, y: e.clientY, title: `by ${p.full}`, v: `${p.n} received` });

  return (
    <div className="inst bd" onMouseLeave={() => setTip(null)}>
      <TopBar system="Control Tower" sub="Account opening" />

      <div className="bd-scroll">
        <div className="bd-top">
          <div><h1>Account Opening</h1><div className="sub">The factory line · {cfg.label === '24H' ? 'last 24 hours' : cfg.label === '48H' ? 'last 48 hours' : 'last 7 days'}</div></div>
          <div className="bd-seg">{RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}</div>
        </div>

        {m.total === 0 ? (
          <div className="bd-empty"><b>The line is quiet</b><span>No applications in this window. Try a wider range.</span></div>
        ) : (
          <>
            <div className="bd-grid">
              {/* Hero — owns the headline */}
              <section className="bd-hero">
                <div className="k">Straight-through rate</div>
                <div className="big">{m.stp}<em>%</em></div>
                <div className="tag">{m.clean} of {m.total} accounts opened without anyone touching them.</div>
                <div className="foot">
                  <div><div className="fn">{m.opened}</div><div className="fl">opened</div></div>
                  <div><div className="fn" style={{ color: '#ff9a9a' }}>{m.exceptions}</div><div className="fl">exceptions</div></div>
                  <div><div className="fn" style={{ color: GOLD }}>{m.hours}h</div><div className="fl">returned</div></div>
                </div>
              </section>

              <section className="bd-tile"><div className="k">Accounts opened</div><div className="v">{m.opened}<span className="of">/{m.total}</span></div><div className="s">{m.total ? Math.round(m.opened / m.total * 100) : 0}% of arrivals</div></section>
              <section className="bd-tile"><div className="k">Awaiting KYC</div><div className="v gold">{m.kyc}</div><div className="s">open · limited</div></section>

              {/* Throughput */}
              <section className="bd-chart">
                <div className="hd"><h2>Applications received</h2><span className="mu">{m.total} total{m.peak.n > 0 ? ` · busiest ${m.peak.full}` : ''}</span></div>
                <Curve series={m.curve} onTip={onTip} />
                <div className="bd-x">{m.flow.filter((_, i) => i % Math.ceil(m.flow.length / 6) === 0).map((p, i) => <span key={i}>{p.label}</span>)}</div>
              </section>
            </div>

            <div className="bd-row3">
              <section className="bd-tile"><h2>What needs a person</h2>
                {m.causes.length ? (
                  <div className="bd-bars">
                    {m.causes.map((c) => (
                      <div className="b" key={c.k}><span className="nm">{KLABEL[c.k]}</span>
                        <span className="t"><i style={{ width: `${Math.max(6, c.n / m.causeMax * 100)}%`, background: `linear-gradient(90deg,${REDA},${REDB})` }} /></span>
                        <span className="n">{c.n}</span></div>
                    ))}
                  </div>
                ) : <div className="bd-clear">Every check passed first time.</div>}
              </section>

              <section className="bd-tile"><h2>How work arrives</h2>
                <div className="bd-bars">
                  {m.channels.map((c) => (
                    <div className="b" key={c.k}><span className="nm">{c.label}</span>
                      <span className="t"><i style={{ width: `${m.chTotal ? Math.max(5, c.n / m.chTotal * 100) : 0}%`, background: c.color }} /></span>
                      <span className="n">{c.n}</span></div>
                  ))}
                </div>
              </section>

              <section className="bd-tile"><h2>Pipeline reach</h2>
                <div className="bd-bars">
                  {m.funnel.map((f) => (
                    <div className="b" key={f.label}><span className="nm">{f.label}</span>
                      <span className="t"><i style={{ width: `${m.funnel[0].n ? Math.max(4, f.n / m.funnel[0].n * 100) : 0}%`, background: `color-mix(in srgb, ${NAVY} 82%, #6f8fd6)` }} /></span>
                      <span className="n">{f.n}</span></div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {tip && <div className="bd-tip" style={{ left: tip.x, top: tip.y }} role="status"><b>{tip.title}</b><span>{tip.v}</span></div>}
    </div>
  );
}

// Smooth throughput curve (Catmull-Rom → Bézier) with gold peak marker.
function Curve({ series, onTip }: { series: Pt[]; onTip: (e: { clientX: number; clientY: number }, p: Pt) => void }) {
  const W = 720, H = 150, PB = 14, PT = 12;
  const max = Math.max(1, ...series.map((p) => p.n));
  const X = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * W);
  const Y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const p = series.map((s, i) => ({ x: X(i), y: Y(s.n) }));
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p[i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${Math.min(H - PB, Math.max(PT, c1y)).toFixed(1)} ${c2x.toFixed(1)},${Math.min(H - PB, Math.max(PT, c2y)).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const peakI = series.reduce((a, b, i) => (b.n > series[a].n ? i : a), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bd-curve" preserveAspectRatio="none" role="img" aria-label="Applications received over time">
      <defs><linearGradient id="bdG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={NAVY} stopOpacity="0.16" /><stop offset="1" stopColor={NAVY} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#bdG)" />
      <path d={d} fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {series[peakI].n > 0 && <circle cx={X(peakI)} cy={Y(series[peakI].n)} r="5" fill={GOLD} />}
      {series.map((s, i) => <rect key={i} x={X(i) - W / series.length / 2} y="0" width={W / series.length} height={H} fill="transparent" onMouseMove={(e) => onTip(e, s)} />)}
    </svg>
  );
}

export default function TowerConsole() {
  return <InstrumentProvider><TowerInner /></InstrumentProvider>;
}
