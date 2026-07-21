// ─────────────────────────────────────────────────────────────────────────────
// Control tower (/tower) — the account-opening factory as an operations board.
//
// A real dashboard, read at a glance: a KPI strip, a throughput area chart, a
// straight-through gauge, the pipeline as a funnel, what breaks and how work
// arrives as donuts, and an upstream-service health strip. Every figure is live
// off the shared store. The chart marks follow the house rules — smooth 2px
// lines, one-hue gauges, a validated categorical palette for the channel mix,
// solid hairline grids, and a hover read on the plotted series.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, ONBOARDING_STATES, type OnboardingCase, type ValidationKind, type OnboardingState } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

const MANUAL_MIN = 35, AUTO_MIN = 4;
// Validated categorical trio for the channel mix (dataviz validator, white
// surface: CVD ΔE 13.5, normal-vision 19.8, contrast ≥3:1).
const CH = { bulk: '#A16207', single: '#2563EB', self: '#0D9488' } as const;
const CH_LABEL = { bulk: 'Bulk payroll', single: 'Walk-in & branch', self: 'Self-service' } as const;

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: '24 hours', hours: 24, bucketH: 3 },
  { id: '48h', label: '48 hours', hours: 48, bucketH: 6 },
  { id: '7d', label: '7 days', hours: 168, bucketH: 24 },
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

// ── Chart primitives (self-contained SVG) ────────────────────────────────────
function Gauge({ pct, color, size = 116 }: { pct: number; color: string; size?: number }) {
  const r = (size - 16) / 2, cy = size / 2 + r / 2 - 4, circ = Math.PI * r;
  const d = `M 8 ${cy} A ${r} ${r} 0 0 1 ${size - 8} ${cy}`;
  return (
    <svg width={size} height={cy + 8} viewBox={`0 0 ${size} ${cy + 8}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--i-line)" strokeWidth="11" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} />
    </svg>
  );
}

function Donut({ segments, size = 128, stroke = 18, center }: {
  segments: { label: string; value: number; color: string }[]; size?: number; stroke?: number; center: { v: string; k: string };
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2, c = size / 2, circ = 2 * Math.PI * r, gap = segments.filter((s) => s.value).length > 1 ? 3 : 0;
  // Precompute each segment's start offset so nothing mutates during render.
  const arcs = segments.reduce<{ seg: typeof segments[number]; len: number; off: number }[]>((acc, seg) => {
    const len = (seg.value / total) * circ;
    acc.push({ seg, len, off: acc.reduce((s, a) => s + a.len, 0) });
    return acc;
  }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g transform={`rotate(-90 ${c} ${c})`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--i-line)" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={a.seg.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, a.len - gap)} ${circ - Math.max(0, a.len - gap)}`} strokeDashoffset={-a.off} strokeLinecap="round" />
        ))}
      </g>
      <text x={c} y={c - 1} textAnchor="middle" className="do-v">{center.v}</text>
      <text x={c} y={c + 15} textAnchor="middle" className="do-k">{center.k}</text>
    </svg>
  );
}

interface Pt { label: string; full: string; n: number }
function Area({ series, color, tip }: { series: Pt[]; color: string; tip: (e: React.MouseEvent, p: Pt) => void }) {
  const W = 720, H = 168, PAD_B = 22, PAD_T = 12;
  const max = Math.max(1, ...series.map((p) => p.n));
  const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * W);
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${H - PAD_B} L${x(0)},${H - PAD_B} Z`;
  const peak = series.reduce((a, b, i) => (b.n > series[a].n ? i : a), 0);
  const gy = [0, 0.5, 1].map((t) => PAD_T + t * (H - PAD_T - PAD_B));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="db-area" preserveAspectRatio="none" role="img" aria-label="Applications received over time">
      <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.2" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {gy.map((yy, i) => <line key={i} x1="0" y1={yy} x2={W} y2={yy} stroke="var(--i-line)" strokeWidth="1" />)}
      <path d={area} fill="url(#areaG)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {series[peak].n > 0 && <circle cx={x(peak)} cy={y(series[peak].n)} r="3.4" fill={color} stroke="var(--i-card)" strokeWidth="2" />}
      {series.map((p, i) => (
        <rect key={i} x={x(i) - W / series.length / 2} y="0" width={W / series.length} height={H}
          fill="transparent" onMouseMove={(e) => tip(e, p)} />
      ))}
    </svg>
  );
}

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
      return {
        n: inB.length,
        label: cfg.bucketH >= 24 ? DAY[d.getDay()] : two(d.getHours()),
        full: cfg.bucketH >= 24 ? `${DAY[d.getDay()]} ${d.getDate()}` : `${two(d.getHours())}:00`,
      };
    });

    // Funnel: reach of each milestone (a case counts for every stage it passed).
    const reached = (st: OnboardingState) => {
      const idx = ONBOARDING_STATES.findIndex((x) => x.state === st);
      return s.filter((c) => ONBOARDING_STATES.findIndex((x) => x.state === c.state) >= idx || (st === 'ACCOUNT_CREATED' && opened(c))).length;
    };
    const funnel = [
      { label: 'Arrived', n: s.length },
      { label: 'Validated', n: s.filter((c) => !failedK(c, 'NIN') && !failedK(c, 'BVN') && c.state !== 'EXCEPTION' && (opened(c) || reached('VALIDATED'))).length },
      { label: 'Account open', n: s.filter(opened).length },
      { label: 'Fully activated', n: s.filter((c) => c.state === 'FULLY_ACTIVATED').length },
    ];

    // Ordered red→amber ramp so the donut's segments stay distinguishable — they
    // are all "needs a person", ranked by how many.
    const CAUSE_RAMP = ['#B91C1C', '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#A16207'];
    const causes = KINDS.map((k) => ({ label: KLABEL[k], value: s.filter((c) => failedK(c, k)).length }))
      .filter((c) => c.value > 0).sort((a, b) => b.value - a.value)
      .map((c, i) => ({ ...c, color: CAUSE_RAMP[i % CAUSE_RAMP.length] }));
    const causeTotal = causes.reduce((a, b) => a + b.value, 0);

    const channels = (['bulk', 'single', 'self'] as const)
      .map((k) => ({ key: k, label: CH_LABEL[k], value: s.filter((c) => (c.channel ?? 'single') === k).length, color: CH[k] }))
      .filter((c) => c.value > 0);

    // Upstream health, derived from the checks actually failing in the window.
    const svc = (kinds: ValidationKind[], name: string, sys: string) => {
      const fails = s.filter((c) => kinds.some((k) => failedK(c, k))).length;
      const ran = s.filter((c) => c.validations.some((v) => kinds.includes(v.kind) && v.status !== 'pending')).length;
      return { name, sys, fails, ran, status: fails >= 3 ? 'degraded' : fails > 0 ? 'watch' : 'healthy' as const };
    };
    const upstream = [
      svc(['NIN'], 'NIMC', 'Identity'),
      svc(['BVN'], 'NIBSS', 'Bank verification'),
      svc(['LIVENESS'], 'Liveness', 'Selfie / AWS'),
      { name: 'Finacle', sys: 'Core banking', fails: 0, ran: s.filter(opened).length, status: 'healthy' as const },
    ];

    return {
      total: s.length, opened: s.filter(opened).length, stp, exceptions: s.filter(stuck).length,
      kyc: s.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length,
      hours: Math.round((clean * (MANUAL_MIN - AUTO_MIN)) / 60 * 10) / 10,
      flow, funnel, causes, causeTotal, channels, chTotal: channels.reduce((a, b) => a + b.value, 0), upstream,
    };
  }, [cases, now, cfg]);

  const stpColor = m.stp >= 80 ? 'var(--i-good)' : m.stp >= 60 ? 'var(--i-warn)' : 'var(--i-red)';
  const spark = m.flow.map((p) => p.n);
  const onTip = (e: React.MouseEvent, p: Pt) => setTip({ x: e.clientX, y: e.clientY, title: p.full, v: `${p.n} ${p.n === 1 ? 'application' : 'applications'}` });

  return (
    <div className="inst" onMouseLeave={() => setTip(null)}>
      <TopBar system="Control Tower" sub="Account opening" />
      <div className="db-scroll">
        <div className="db-filters">
          <div className="cm-segs" role="group" aria-label="Time range">
            {RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}
          </div>
        </div>

        {m.total === 0 ? (
          <div className="fn-empty"><b>Nothing in this window</b><span>No applications in the last {cfg.label}. Try a wider range.</span></div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="db-kpis">
              <Kpi label="Straight through" value={`${m.stp}%`} tone={m.stp >= 80 ? 'good' : m.stp >= 60 ? 'warn' : 'bad'} spark={spark} sparkColor={stpColor} />
              <Kpi label="Accounts opened" value={m.opened} sub={`of ${m.total} received`} spark={spark} />
              <Kpi label="Exceptions" value={m.exceptions} tone={m.exceptions ? 'bad' : 'good'} sub="need a person" />
              <Kpi label="Awaiting KYC" value={m.kyc} tone="mute" sub="open, limited" />
              <Kpi label="Hours returned" value={`${m.hours}h`} tone="mute" sub={`vs ${MANUAL_MIN}-min manual`} />
            </div>

            <div className="db-grid">
              {/* Throughput */}
              <section className="db-card a-flow">
                <header><h2>Applications received</h2><span className="mu">last {cfg.label}</span></header>
                <Area series={m.flow} color="var(--i-accent)" tip={onTip} />
                <div className="db-axis">{m.flow.filter((_, i) => i % Math.ceil(m.flow.length / 6) === 0).map((p, i) => <span key={i}>{p.label}</span>)}</div>
              </section>

              {/* STP gauge */}
              <section className="db-card a-gauge">
                <header><h2>Straight-through</h2></header>
                <div className="db-gauge">
                  <Gauge pct={m.stp} color={stpColor} />
                  <div className="db-gauge-v" style={{ color: stpColor }}>{m.stp}<em>%</em></div>
                </div>
                <p className="db-note">{m.total - Math.round(m.total * m.stp / 100)} of {m.total} needed a person. Target 80%.</p>
              </section>

              {/* Funnel */}
              <section className="db-card a-funnel">
                <header><h2>Pipeline</h2><span className="mu">reach by stage</span></header>
                <div className="db-funnel">
                  {m.funnel.map((f, i) => {
                    const pct = m.funnel[0].n ? Math.round((f.n / m.funnel[0].n) * 100) : 0;
                    return (
                      <div className="row" key={f.label}>
                        <span className="lb">{f.label}</span>
                        <span className="track"><i style={{ width: `${Math.max(3, pct)}%`, background: `color-mix(in srgb, var(--i-brand) ${100 - i * 16}%, #7F9CE0)` }} /></span>
                        <span className="vl">{f.n}<em>{pct}%</em></span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Needs a person */}
              <section className="db-card a-cause">
                <header><h2>What needs a person</h2></header>
                {m.causes.length ? (
                  <div className="db-split">
                    <Donut segments={m.causes} center={{ v: String(m.causeTotal), k: 'CASES' }} />
                    <ul className="db-leg">
                      {m.causes.map((c) => <li key={c.label}><i style={{ background: c.color }} />{c.label}<b>{c.value}</b></li>)}
                    </ul>
                  </div>
                ) : <div className="db-clear">Every check passed first time.</div>}
              </section>

              {/* Channels */}
              <section className="db-card a-chan">
                <header><h2>How work arrives</h2></header>
                <div className="db-split">
                  <Donut segments={m.channels} center={{ v: String(m.chTotal), k: 'APPS' }} />
                  <ul className="db-leg">
                    {m.channels.map((c) => <li key={c.key}><i style={{ background: c.color }} />{c.label}<b>{m.chTotal ? Math.round((c.value / m.chTotal) * 100) : 0}%</b></li>)}
                  </ul>
                </div>
              </section>

              {/* Upstream health */}
              <section className="db-card a-up">
                <header><h2>Upstream services</h2><span className="mu">live</span></header>
                <div className="db-svc">
                  {m.upstream.map((u) => (
                    <div className={`svc ${u.status}`} key={u.name}>
                      <span className="dot" /><span className="nm">{u.name}</span>
                      <span className="sys">{u.sys}</span>
                      <span className="st">{u.status === 'degraded' ? `${u.fails} failing` : u.status === 'watch' ? `${u.fails} to watch` : `${u.ran} clean`}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {tip && <div className="tw-tip" style={{ left: tip.x, top: tip.y }} role="status"><b>{tip.title}</b><span>{tip.v}</span></div>}
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'mute', spark, sparkColor }: {
  label: string; value: string | number; sub?: string; tone?: 'good' | 'warn' | 'bad' | 'mute'; spark?: number[]; sparkColor?: string;
}) {
  return (
    <div className="db-kpi">
      <div className="k">{label}</div>
      <div className={`v ${tone}`}>{value}</div>
      {sub && <div className="s">{sub}</div>}
      {spark && spark.length > 1 && <MiniSpark data={spark} color={sparkColor ?? 'var(--i-ink-4)'} />}
    </div>
  );
}

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const W = 132, H = 26, max = Math.max(1, ...data);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - 2 - (v / max) * (H - 5);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="db-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.85" />
    </svg>
  );
}

export default function TowerConsole() {
  return <InstrumentProvider><TowerInner /></InstrumentProvider>;
}
