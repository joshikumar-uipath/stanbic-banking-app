// ─────────────────────────────────────────────────────────────────────────────
// Factory control tower (/tower) — the line, drawn.
//
// Every other screen answers "what do I do about this case?". This one answers
// "is the factory working?" — and the honest form for that is a flow, not a
// grid of stat cards. Volume enters on the left, splits at verification into
// the work that opened itself and the work that needed a person, and lands in
// one of three outcomes. Ribbon thickness IS the volume, so a bottleneck shows
// up as a fat amber stream instead of a number you have to interpret.
//
// The panel is deliberately the same navy as the Ops console's pattern card:
// this is the same product speaking, and it opens with a written read of the
// numbers rather than making you assemble one.
//
// Stream colours are validated against the navy surface (dataviz validator:
// lightness band, chroma floor, CVD ΔE 30.2, normal-vision 34.2, contrast ≥3:1).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, VALIDATION_KINDS, type OnboardingCase, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

const CLEAN = '#3B82F6';   // opened itself — cool
const PERSON = '#D97706';  // needed a person — warm, the opposite pole
const DIM = '#7C93C4';     // still moving, nobody blocked — recessive, not a status

// Minutes of human handling: what an application costs when nobody touches it,
// what it costs when somebody must, and what one exception costs to work.
const MANUAL_MIN = 35;
const AUTO_MIN = 4;
const HANDLE_MIN = 18;

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: '24 hours', hours: 24, bucketH: 4 },
  { id: '48h', label: '48 hours', hours: 48, bucketH: 6 },
  { id: '7d', label: '7 days', hours: 168, bucketH: 24 },
];

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
const opened = (c: OnboardingCase) => Boolean(c.accountNumber);
const stuck = (c: OnboardingCase) => c.state === 'EXCEPTION';
/** Touched = a person had to get involved at some point on this application. */
const touched = (c: OnboardingCase) =>
  stuck(c) || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');

const CHECK_LABEL: Record<string, string> = {
  NIN: 'NIN · NIMC', BVN: 'BVN · NIBSS', AML: 'AML screening',
  PEP: 'PEP screening', FRAUD: 'Fraud screening', LIVENESS: 'Selfie check',
};

// ── The line: a stream that narrows, with tributaries peeling off ────────────
// A factory line is not a set of stacked bars — material enters, travels through
// stations, and at each one some of it falls out. Thickness is what is still
// moving; every tributary is work that left the line and why.
const VB_W = 1000, VB_H = 300;
const S_TOP = 74;        // top edge of the first lane (labels ride above it)
const S_MAX = 104;       // total thickness shared by both lanes at full intake
const LANE_GAP = 13;     // surface gap between the two lines
const LEAK_Y = 216;      // where tributaries land
const SX = [26, 350, 674, 962];

/** One lane: straight top edge, bottom edge easing down past each station. */
function stream(th: number[], top: number): string {
  const last = SX.length - 1;
  let d = `M${SX[0]},${top} L${SX[last]},${top} L${SX[last]},${top + th[last]}`;
  for (let i = last; i > 0; i--) {
    const x0 = SX[i], x1 = SX[i - 1], xm = (x0 + x1) / 2;
    d += ` C${xm},${top + th[i]} ${xm},${top + th[i - 1]} ${x1},${top + th[i - 1]}`;
  }
  return d + ' Z';
}

/** A sankey ribbon: two cubic curves, filled. */
function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number): string {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xm},${y1 + h1} ${xm},${y0 + h0} ${x0},${y0 + h0} Z`;
}

interface Tip { x: number; y: number; title: string; rows: { k: string; v: string }[] }

function TowerInner() {
  useBrandVars('Control Tower');
  const [range, setRange] = useState<Range>('48h');
  const [showData, setShowData] = useState(false);
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

    // One lane per channel, both scaled by the same intake so a thick lane really
    // does mean more work. The question this answers: does the payroll line run
    // cleaner than the walk-in line?
    const failed = (c: OnboardingCase, ...k: ValidationKind[]) =>
      c.validations.some((v) => k.includes(v.kind) && (v.status === 'failed' || v.status === 'timeout'));

    const total = s.length;
    const lanesIn = [
      { key: 'bulk', label: 'Bulk payroll', arr: s.filter((c) => c.channel === 'bulk') },
      { key: 'single', label: 'Walk-in & self-serve', arr: s.filter((c) => c.channel !== 'bulk') },
    ].filter((l) => l.arr.length > 0);

    const scale = (n: number) => (total ? (n / total) * S_MAX : 0);
    const lanesOut: {
      key: string; label: string; top: number; n: number; th: number[]; counts: number[]; d: string;
      leaks: { n: number; c: string; label: string; at: number }[];
    }[] = [];

    let top = S_TOP;
    for (const l of lanesIn) {
      const a = l.arr;
      const leakId = a.filter((c) => failed(c, 'NIN', 'BVN')).length;
      const afterId = a.length - leakId;
      const leakScreen = a.filter((c) => !failed(c, 'NIN', 'BVN') && failed(c, 'AML', 'PEP', 'FRAUD')).length;
      const afterScreen = afterId - leakScreen;
      const open = a.filter(opened).length;
      const leakRunning = Math.max(0, afterScreen - open);
      const activated = a.filter((c) => c.state === 'FULLY_ACTIVATED').length;
      const leakKyc = Math.max(0, open - activated);
      const counts = [a.length, afterId, open, activated];
      const th = counts.map((n) => (n > 0 ? Math.max(1.5, scale(n)) : 0));
      lanesOut.push({
        key: l.key, label: l.label, top, n: a.length, counts, th, d: stream(th, top),
        leaks: [
          { at: 0, n: leakId, c: PERSON, label: 'NIN or BVN needed a person' },
          { at: 1, n: leakScreen, c: PERSON, label: 'Screening needed a person' },
          { at: 1, n: leakRunning, c: DIM, label: 'Still running its checks' },
          { at: 2, n: leakKyc, c: DIM, label: 'Open, KYC outstanding' },
        ].filter((x) => x.n > 0),
      });
      top += scale(a.length) + LANE_GAP;
    }

    // Both lanes leak for the same reasons, so a reason gets ONE landing and one
    // label — each lane just feeds a slice of it. Repeating the label per lane
    // read as a duplicate rather than a split.
    const raw = lanesOut.flatMap((lane) => lane.leaks.map((l) => ({ ...l, lane })));
    const groups = new Map<string, { at: number; label: string; c: string; n: number; items: typeof raw }>();
    for (const r of raw) {
      const k = `${r.at}|${r.label}`;
      const g = groups.get(k) ?? { at: r.at, label: r.label, c: r.c, n: 0, items: [] as typeof raw };
      g.n += r.n; g.items.push(r); groups.set(k, g);
    }

    const landLanes: Record<number, number> = {};
    const rivers: { d: string; c: string; n: number; label: string; lane: string }[] = [];
    const landings: { lx: number; ly: number; lh: number; n: number; label: string; c: string }[] = [];
    for (const g of groups.values()) {
      const lx = SX[g.at + 1] - 30;
      const lh = Math.max(2, scale(g.n));
      const ly = LEAK_Y + (landLanes[lx] ?? 0);
      landLanes[lx] = (landLanes[lx] ?? 0) + lh + 9;
      let off = 0;
      for (const it of g.items) {
        const ih = Math.max(1.5, scale(it.n));
        const y0 = it.lane.top + it.lane.th[g.at + 1];   // peels from under the narrowing edge
        rivers.push({ d: ribbon(SX[g.at], y0, ih, lx, ly + off, ih), c: g.c, n: it.n, label: g.label, lane: it.lane.label });
        off += ih;
      }
      landings.push({ lx, ly, lh, n: g.n, label: g.label, c: g.c });
    }

    // Station heads show the combined line.
    const stations = ['Arrived', 'Identity verified', 'Account open', 'Fully activated'].map((label, i) => ({
      key: label, label, n: lanesOut.reduce((sum, l) => sum + l.counts[i], 0),
    }));

    const person = s.filter(touched);
    const clean = s.filter((c) => !touched(c));
    const bulkN = s.filter((c) => c.channel === 'bulk').length;
    const totals = { open: s.filter(opened).length, checks: 0, stuck: s.filter(stuck).length };

    // What is actually costing people time.
    const causes = VALIDATION_KINDS
      .map((k: ValidationKind) => ({
        key: k, label: CHECK_LABEL[k] ?? k,
        n: s.filter((c) => c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'))).length,
      }))
      .filter((c) => c.n > 0)
      .sort((x, y) => y.n - x.n);

    // Arrivals, bucketed across the window.
    const count = Math.round(cfg.hours / cfg.bucketH), span = cfg.bucketH * 3600_000;
    const flow = Array.from({ length: count }, (_, i) => {
      const start = from + i * span, d = new Date(start + span / 2);
      const inBucket = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + span; });
      return {
        label: cfg.bucketH >= 24 ? DAY[d.getDay()] : `${two(d.getHours())}:00`,
        full: cfg.bucketH >= 24 ? `${DAY[d.getDay()]} ${d.getDate()}` : `${two(d.getHours())}:00–${two((d.getHours() + cfg.bucketH) % 24)}:00`,
        n: inBucket.length, bulk: inBucket.filter((c) => c.channel === 'bulk').length,
      };
    });

    return {
      total: s.length, clean: clean.length, person: person.length, totals,
      stations, lanes: lanesOut, rivers, landings, causes, flow, bulkN,
      hoursBack: Math.round((clean.length * (MANUAL_MIN - AUTO_MIN)) / 60),
      hoursSpent: Math.round((person.length * HANDLE_MIN) / 60 * 10) / 10,
    };
  }, [cases, now, cfg]);

  const pct = m.total ? Math.round((m.clean / m.total) * 100) : 0;
  const top = m.causes[0];
  const flowMax = Math.max(1, ...m.flow.map((f) => f.n));

  const over = (e: { clientX: number; clientY: number }, title: string, rows: { k: string; v: string }[]) =>
    setTip({ x: e.clientX, y: e.clientY, title, rows });
  const blur = () => setTip(null);

  return (
    <div className="inst" onMouseLeave={blur}>
      <TopBar system="Control Tower" sub="The line" />

      <div className="tw-scroll">
        <div className="tw-filters">
          <div className="cm-segs" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
          </div>
          <button className="tw-toggle" aria-pressed={showData} onClick={() => setShowData((v) => !v)}>
            {showData ? 'Hide data tables' : 'Show data tables'}
          </button>
        </div>

        {m.total === 0 ? (
          <div className="fn-empty"><b>The line is quiet</b><span>No applications arrived in the last {cfg.label}. Try a wider range.</span></div>
        ) : (
          <>
            {/* ── The line. The hero is the flow, not a number. ── */}
            <section className="tw-floor">
              <header>
                <span className="eyebrow">The line · last {cfg.label}</span>
                <h1>
                  <b>{m.total}</b> arrived. <b>{m.clean}</b> opened themselves —{' '}
                  <span className="hl">{pct}%</span> never reached a person.
                </h1>
                <p>
                  {m.bulkN > 0 && <><b>{m.bulkN}</b> of them came in on the payroll line. </>}
                  {top
                    ? <>The rest cost you about <b>{m.hoursSpent}h</b> of handling, nearly all of it <b>{top.label}</b>{m.totals.stuck > 0 ? <> — {m.totals.stuck} {m.totals.stuck === 1 ? 'is' : 'are'} still waiting on somebody.</> : '.'}</>
                    : <>Nothing failed a check. The line ran clean.</>}
                </p>
              </header>

              <div className="tw-plot">
              <svg className="tw-sankey" viewBox={`0 0 ${VB_W} ${VB_H}`}
                role="img" aria-label={`The line: ${m.stations.map((st) => `${st.n} ${st.label}`).join(', ')}. Leaving the line: ${m.rivers.map((r) => `${r.n} ${r.label}`).join(', ')}.`}>
                <defs>
                  <linearGradient id="mainflow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={CLEAN} stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#5FD39A" stopOpacity={0.9} />
                  </linearGradient>
                  {m.rivers.map((r, i) => (
                    <linearGradient key={i} id={`lk${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={r.c} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={r.c} stopOpacity={0.85} />
                    </linearGradient>
                  ))}
                </defs>

                {/* Station rules — recessive hairlines the stream passes through. */}
                {SX.map((x, i) => (
                  <line key={i} x1={x} y1={S_TOP - 34} x2={x} y2={LEAK_Y + 46} stroke="#fff" strokeOpacity={0.11} strokeWidth={1} />
                ))}

                {/* Tributaries first, so the main line sits over them. */}
                {m.rivers.map((r, i) => (
                  <path key={i} d={r.d} fill={`url(#lk${i})`} className="rb"
                    onMouseMove={(e) => over(e, r.label, [{ k: r.lane, v: String(r.n) }])}
                    onMouseLeave={blur} />
                ))}
                {m.landings.map((l, i) => <rect key={i} x={l.lx} y={l.ly} width={5} height={l.lh} rx={2} fill={l.c} />)}

                {/* One lane per channel. Same gradient — hue means "on the line",
                    the lanes are told apart by position and their left-edge label. */}
                {m.lanes.map((lane) => (
                  <path key={lane.key} d={lane.d} fill="url(#mainflow)" className="rb"
                    onMouseMove={(e) => over(e, lane.label, [
                      { k: 'Arrived', v: String(lane.counts[0]) },
                      { k: 'Account open', v: String(lane.counts[2]) },
                      { k: 'Fully activated', v: String(lane.counts[3]) },
                    ])}
                    onMouseLeave={blur} />
                ))}
              </svg>

              {/* Station and tributary labels in HTML — crisp at any scale. */}
              <div className="tw-marks">
                {m.stations.map((st, i) => (
                  <span key={st.key} className={`st ${i === SX.length - 1 ? 'right' : ''}`}
                    style={{ left: `${(SX[i] / VB_W) * 100}%`, top: `${((S_TOP - 30) / VB_H) * 100}%` }}>
                    <b>{st.n}</b><em>{st.label}</em>
                  </span>
                ))}
                {m.lanes.map((lane) => (
                  <span key={lane.key} className="ln" style={{ left: `${(SX[0] / VB_W) * 100}%`, top: `${((lane.top + lane.th[0] / 2) / VB_H) * 100}%` }}>
                    {lane.label}<b>{lane.n}</b>
                  </span>
                ))}
                {m.landings.map((l, i) => (
                  <span key={i} className="lk" style={{ left: `${((l.lx + 12) / VB_W) * 100}%`, top: `${((l.ly + l.lh / 2) / VB_H) * 100}%` }}>
                    <b>{l.n}</b>{l.label}
                  </span>
                ))}
              </div>
              </div>

              <div className="tw-key">
                <span><i style={{ background: CLEAN }} />On the line</span>
                <span><i style={{ background: PERSON }} />Left it — needs a person</span>
                <span><i style={{ background: DIM }} />Left it — still working</span>
                <em>Thickness is volume</em>
              </div>
            </section>

            <div className="tw-grid">
              {/* ── The constraint, named and costed ── */}
              <section className="tw-card">
                <header><h2>What is holding the line</h2><p>Checks that failed or timed out, by the time they cost.</p></header>
                {m.causes.length ? (
                  <div className="tw-bars">
                    {m.causes.map((c) => (
                      <div className="row" key={c.key}>
                        <span className="lb">{c.label}</span>
                        <span className="track">
                          <button className="bar bad" style={{ width: `${Math.max(3, (c.n / m.causes[0].n) * 100)}%` }}
                            aria-label={`${c.label}: ${c.n} cases`}
                            onMouseMove={(e) => over(e, c.label, [{ k: 'Cases', v: String(c.n) }, { k: 'Handling', v: `${Math.round(c.n * HANDLE_MIN / 6) / 10}h` }])}
                            onMouseLeave={blur} />
                        </span>
                        <span className="vl">{c.n}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="tw-clear">Nothing failed in this window — every check passed first time.</div>}
                {showData && m.causes.length > 0 && (
                  <Table head={['Check', 'Cases', 'Handling']} rows={m.causes.map((c) => [c.label, String(c.n), `${Math.round(c.n * HANDLE_MIN / 6) / 10}h`])} />
                )}
              </section>

              {/* ── Arrivals: the batch spikes are the point ── */}
              <section className="tw-card">
                <header><h2>When the work arrived</h2><p>Bulk uploads land as spikes; walk-ins trickle.</p></header>
                <div className="tw-cols">
                  <div className="plot">
                    <div className="grid" aria-hidden><i /><i /><i /><i /></div>
                    {m.flow.map((f, i) => (
                      <button className="hit" key={i} aria-label={`${f.full}: ${f.n} applications, ${f.bulk} from bulk`}
                        onMouseMove={(e) => over(e, f.full, [{ k: 'Arrived', v: String(f.n) }, { k: 'From bulk', v: String(f.bulk) }])}
                        onMouseLeave={blur}>
                        <i className="col" style={{ height: f.n ? `${Math.max(3, (f.n / flowMax) * 110)}px` : 0 }} />
                      </button>
                    ))}
                  </div>
                  <div className="axis">{m.flow.map((f, i) => <span key={i}>{f.label}</span>)}</div>
                </div>
                {showData && <Table head={['Window', 'Arrived', 'From bulk']} rows={m.flow.map((f) => [f.full, String(f.n), String(f.bulk)])} />}
              </section>
            </div>

            {showData && (
              <section className="tw-card" style={{ marginTop: 12 }}>
                <header><h2>The line, as numbers</h2></header>
                <Table head={['Station', 'Still on the line']} rows={m.stations.map((st) => [st.label, String(st.n)])} />
                <Table head={['Left the line', 'Applications']} rows={m.rivers.map((r) => [r.label, String(r.n)])} />
              </section>
            )}
          </>
        )}
      </div>

      {tip && (
        <div className="tw-tip" style={{ left: tip.x, top: tip.y }} role="status">
          <b>{tip.title}</b>
          {tip.rows.filter((r) => r.v).map((r, i) => <span key={i}>{r.k}<em>{r.v}</em></span>)}
        </div>
      )}
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

export default function TowerConsole() {
  return <InstrumentProvider><TowerInner /></InstrumentProvider>;
}
