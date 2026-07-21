// ─────────────────────────────────────────────────────────────────────────────
// Control tower (/tower) — the account-opening line, as an operations console.
//
// Not an admin dashboard of white cards. This is the tower: a dark instrument
// board in Stanbic navy where the numbers read like telemetry (mono), status is
// carried by signal colour, and the line's throughput sweeps across the top like
// an oscilloscope. One bold idea — the console aesthetic — held with restraint.
// Every reading is live off the shared store.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

const MANUAL_MIN = 35, AUTO_MIN = 4;

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: '24H', hours: 24, bucketH: 2 },
  { id: '48h', label: '48H', hours: 48, bucketH: 4 },
  { id: '7d', label: '7D', hours: 168, bucketH: 12 },
];
const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const two = (n: number) => String(n).padStart(2, '0');
const opened = (c: OnboardingCase) => Boolean(c.accountNumber);
const stuck = (c: OnboardingCase) => c.state === 'EXCEPTION';
const touched = (c: OnboardingCase) =>
  stuck(c) || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');
const failedK = (c: OnboardingCase, k: ValidationKind) =>
  c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'));
const KINDS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];
const KLABEL: Record<string, string> = { NIN: 'NIN', BVN: 'BVN', AML: 'AML', PEP: 'PEP', FRAUD: 'FRAUD', LIVENESS: 'SELFIE' };

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

    // Trend: straight-through in the first half of the window vs the second.
    const mid = from + (cfg.hours / 2) * 3600_000;
    const half = (a: OnboardingCase[]) => (a.length ? Math.round(a.filter((c) => !touched(c)).length / a.length * 100) : 0);
    const trend = half(s.filter((c) => Date.parse(c.createdAt) >= mid)) - half(s.filter((c) => Date.parse(c.createdAt) < mid));

    const count = Math.round(cfg.hours / cfg.bucketH), span = cfg.bucketH * 3600_000;
    const flow: Pt[] = Array.from({ length: count }, (_, i) => {
      const start = from + i * span, d = new Date(start + span / 2);
      const inB = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + span; });
      return { n: inB.length, label: cfg.bucketH >= 12 ? DAY[d.getDay()] : two(d.getHours()), full: cfg.bucketH >= 12 ? `${DAY[d.getDay()]} ${d.getDate()}` : `${two(d.getHours())}:00` };
    });

    // The line — reach at each milestone, and the drop between them.
    const line = [
      { label: 'ARRIVED', n: s.length },
      { label: 'VALIDATED', n: s.filter((c) => opened(c) || (c.state === 'VALIDATED' && !stuck(c))).length },
      { label: 'ACCOUNT OPEN', n: s.filter(opened).length },
      { label: 'ACTIVATED', n: s.filter((c) => c.state === 'FULLY_ACTIVATED').length },
    ];

    const holding = [
      { label: 'Exceptions', n: s.filter(stuck).length, sig: 'stop' as const },
      { label: 'Awaiting KYC', n: s.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length, sig: 'warn' as const },
      { label: 'In validation', n: s.filter((c) => c.state === 'VALIDATION_IN_PROGRESS').length, sig: 'data' as const },
    ].filter((h) => h.n > 0);

    const causes = KINDS.map((k) => ({ k, n: s.filter((c) => failedK(c, k)).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
    const oldestExc = s.filter(stuck).map((c) => c.createdAt).sort()[0];

    const channels = ([['bulk', 'PAYROLL', 'var(--gold)'], ['single', 'BRANCH', 'var(--data)'], ['self', 'DIGITAL', 'var(--go)']] as const)
      .map(([k, label, color]) => ({ k, label, color, n: s.filter((c) => (c.channel ?? 'single') === k).length }))
      .filter((c) => c.n > 0);

    // Upstream — status from the checks actually failing in the window.
    const svc = (kinds: ValidationKind[], name: string, note: string) => {
      const fails = s.filter((c) => kinds.some((k) => failedK(c, k))).length;
      const ran = s.filter((c) => c.validations.some((v) => kinds.includes(v.kind) && v.status !== 'pending')).length;
      return { name, note, fails, ran, sig: (fails >= 3 ? 'stop' : fails > 0 ? 'warn' : 'go') as 'stop' | 'warn' | 'go' };
    };
    const upstream = [
      svc(['NIN'], 'NIMC', 'Identity'),
      svc(['BVN'], 'NIBSS', 'Bank verify'),
      svc(['LIVENESS'], 'LIVENESS', 'Selfie · AWS'),
      { name: 'FINACLE', note: 'Core banking', fails: 0, ran: s.filter(opened).length, sig: 'go' as const },
    ];

    return {
      total: s.length, opened: s.filter(opened).length, clean, stp, trend,
      exceptions: s.filter(stuck).length, hours: Math.round(clean * (MANUAL_MIN - AUTO_MIN) / 60 * 10) / 10,
      flow, line, holding, causes, oldestExc, upstream, channels,
    };
  }, [cases, now, cfg]);

  const clock = now ? `${two(new Date(now).getHours())}:${two(new Date(now).getMinutes())}` : '';
  const age = (iso?: string) => {
    if (!iso) return '—';
    const mins = Math.floor((now - Date.parse(iso)) / 60000);
    return mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h${two(mins % 60)}m` : `${Math.floor(mins / 1440)}d`;
  };

  return (
    <div className="inst tower" onMouseLeave={() => setTip(null)}>
      <TopBar system="Control Tower" sub="Account opening" />

      <div className="tw-board">
        {/* Status ribbon */}
        <div className="tw-ribbon">
          <span className="live"><i />ON LINE</span>
          <span className="sep" />
          <span className="ttl">ACCOUNT&nbsp;OPENING · THE&nbsp;LINE</span>
          <div className="rng">
            {RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}
          </div>
          <span className="clk">{clock} <em>WAT</em></span>
        </div>

        {m.total === 0 ? (
          <div className="tw-quiet"><b>THE LINE IS QUIET</b><span>No applications in the {cfg.label} window. Widen the range.</span></div>
        ) : (
          <div className="tw-grid">
            {/* Hero: the straight-through instrument */}
            <section className="tw-panel p-stp">
              <div className="p-hd">STRAIGHT-THROUGH RATE</div>
              <div className="stp-read">
                <span className="big">{m.stp}</span><span className="pct">%</span>
                <span className={`trend ${m.trend >= 0 ? 'up' : 'dn'}`}>{m.trend >= 0 ? '▲' : '▼'} {Math.abs(m.trend)}</span>
              </div>
              <Bar pct={m.stp} target={80} />
              <div className="stp-sub"><b>{m.clean}</b> of <b>{m.total}</b> cleared with no one touching them · target 80%</div>
            </section>

            {/* Signature: the throughput trace */}
            <section className="tw-panel p-trace">
              <div className="p-hd">THROUGHPUT<span className="mu">/ arrivals · {cfg.label.toLowerCase()}</span></div>
              <Trace series={m.flow} onTip={(e, p) => setTip({ x: e.clientX, y: e.clientY, title: p.full, v: `${p.n} in` })} />
            </section>

            {/* The line — pipeline as a departures board */}
            <section className="tw-panel p-line">
              <div className="p-hd">THE LINE<span className="mu">/ reach by station</span></div>
              <div className="line-board">
                {m.line.map((st, i) => {
                  const pct = m.line[0].n ? (st.n / m.line[0].n) * 100 : 0;
                  const drop = i > 0 ? m.line[i - 1].n - st.n : 0;
                  return (
                    <div className="lrow" key={st.label}>
                      <span className="stn">{st.label}</span>
                      <span className="meter"><i style={{ width: `${Math.max(2, pct)}%` }} /></span>
                      <span className="cnt">{two(st.n)}</span>
                      <span className="drop">{i > 0 ? (drop > 0 ? `−${drop}` : '·') : ''}</span>
                    </div>
                  );
                })}
              </div>
              {/* Channel mix — fills the board, and says where the volume comes from. */}
              <div className="chan">
                <div className="chan-h">CHANNEL MIX</div>
                <div className="chan-bar">
                  {m.channels.map((c) => <i key={c.k} style={{ flexGrow: c.n, background: c.color }} title={`${c.label}: ${c.n}`} />)}
                </div>
                <div className="chan-key">
                  {m.channels.map((c) => <span key={c.k}><i style={{ background: c.color }} />{c.label}<b>{c.n}</b></span>)}
                </div>
              </div>
            </section>

            {/* Upstream systems — status lights */}
            <section className="tw-panel p-up">
              <div className="p-hd">UPSTREAM SYSTEMS</div>
              <div className="up-list">
                {m.upstream.map((u) => (
                  <div className={`up ${u.sig}`} key={u.name}>
                    <span className="led" />
                    <span className="nm">{u.name}</span>
                    <span className="stt">{u.sig === 'stop' ? 'DEGRADED' : u.sig === 'warn' ? 'WATCH' : 'NOMINAL'}</span>
                    <span className="nt">{u.note}</span>
                    <span className="qty">{u.sig === 'go' ? `${u.ran} clean` : `${u.fails} failing`}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Holding for a person */}
            <section className="tw-panel p-hold">
              <div className="p-hd">HOLDING FOR A PERSON<span className={`badge ${m.exceptions ? 'stop' : 'go'}`}>{m.exceptions + m.holding.filter((h) => h.sig === 'warn').reduce((a, b) => a + b.n, 0)}</span></div>
              <div className="hold-grid">
                {m.holding.map((h) => (
                  <div className={`hcell ${h.sig}`} key={h.label}>
                    <span className="hn">{two(h.n)}</span>
                    <span className="hl">{h.label}</span>
                  </div>
                ))}
              </div>
              {m.causes.length > 0 && (
                <div className="cause">
                  <div className="cause-h">FAILING CHECKS · oldest stuck {age(m.oldestExc)}</div>
                  {m.causes.map((c) => {
                    const w = (c.n / m.causes[0].n) * 100;
                    return (
                      <div className="crow" key={c.k}>
                        <span className="ck">{KLABEL[c.k]}</span>
                        <span className="cbar"><i style={{ width: `${Math.max(6, w)}%` }} /></span>
                        <span className="cn">{c.n}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {tip && <div className="tw-otip" style={{ left: tip.x, top: tip.y }} role="status"><b>{tip.title}</b><span>{tip.v}</span></div>}
    </div>
  );
}

// STP arc-bar with a target tick.
function Bar({ pct, target }: { pct: number; target: number }) {
  return (
    <div className="stp-bar">
      <i style={{ width: `${pct}%` }} />
      <span className="tick" style={{ left: `${target}%` }} />
    </div>
  );
}

// The oscilloscope trace — glowing line on a dark grid.
function Trace({ series, onTip }: { series: Pt[]; onTip: (e: React.MouseEvent, p: Pt) => void }) {
  const W = 760, H = 150, PB = 6, PT = 10;
  const max = Math.max(1, ...series.map((p) => p.n));
  const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * W);
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${H} L${x(0)},${H} Z`;
  const last = series.length - 1;
  const peak = series.reduce((a, b, i) => (b.n > series[a].n ? i : a), 0);
  return (
    <div className="trace-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="trace" preserveAspectRatio="none" role="img" aria-label="Throughput trace">
        <defs>
          <linearGradient id="trG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5aa0ff" stopOpacity="0.28" /><stop offset="1" stopColor="#5aa0ff" stopOpacity="0" /></linearGradient>
          <filter id="trGlow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="2.4" /></filter>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1="0" y1={PT + t * (H - PT - PB)} x2={W} y2={PT + t * (H - PT - PB)} className="grid" />)}
        <path d={area} fill="url(#trG)" />
        <path d={line} className="glow" fill="none" filter="url(#trGlow)" vectorEffect="non-scaling-stroke" />
        <path d={line} className="ln" fill="none" vectorEffect="non-scaling-stroke" />
        {series[peak].n > 0 && <circle cx={x(peak)} cy={y(series[peak].n)} r="3" className="pk" />}
        {series[last].n > 0 && <circle cx={x(last)} cy={y(series[last].n)} r="3.4" className="head" />}
        {series.map((p, i) => <rect key={i} x={x(i) - W / series.length / 2} y="0" width={W / series.length} height={H} fill="transparent" onMouseMove={(e) => onTip(e, p)} />)}
      </svg>
      <div className="trace-x">{series.filter((_, i) => i % Math.ceil(series.length / 6) === 0).map((p, i) => <span key={i}>{p.label}</span>)}</div>
    </div>
  );
}

export default function TowerConsole() {
  return <InstrumentProvider><TowerInner /></InstrumentProvider>;
}
