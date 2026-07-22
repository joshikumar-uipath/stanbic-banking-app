// ─────────────────────────────────────────────────────────────────────────────
// Control tower (/tower) — account-opening dashboard.
//
// Design language adapted from the client's reference (a soft, rounded HR board):
// a light ground, big rounded white cards, a segmented allocation bar, pill
// bar-charts, a donut ring, circular-icon stat cards and a filled checklist card.
// Recoloured to Stanbic navy and rebuilt around the account-opening line — same
// chart types, our data, all live off the shared store.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

const MANUAL_MIN = 35, AUTO_MIN = 4;
const NAVY = '#012169', BLUE = '#3f6fd6', GOLD = '#C8A24A', GREEN = '#2f9e6f', RED = '#e0566b';

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: '24 hours', hours: 24, bucketH: 3 },
  { id: '48h', label: '48 hours', hours: 48, bucketH: 6 },
  { id: '7d', label: '7 days', hours: 168, bucketH: 24 },
];
const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAYF = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
const opened = (c: OnboardingCase) => Boolean(c.accountNumber);
const stuck = (c: OnboardingCase) => c.state === 'EXCEPTION';
const touched = (c: OnboardingCase) =>
  stuck(c) || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');
const failedK = (c: OnboardingCase, k: ValidationKind) =>
  c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'));
const KINDS: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD', 'LIVENESS'];
const KLABEL: Record<string, string> = { NIN: 'NIN · NIMC', BVN: 'BVN · NIBSS', AML: 'AML screening', PEP: 'PEP screening', FRAUD: 'Fraud screening', LIVENESS: 'Selfie check' };

// ── Icons (monoline) ─────────────────────────────────────────────────────────
const IP: Record<string, string> = {
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5 6l-3 6v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3-6a2 2 0 0 0-2-1H7a2 2 0 0 0-2 1Z',
  check: 'M20 6 9 17l-5-5',
  alert: 'M10.3 3.1 1.8 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3L12.7 3.1a2 2 0 0 0-2.4 0Z M12 9v4 M12 17h.01',
  card: 'M2 5h20v14H2z M2 10h20',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2',
  users: 'M16 19a4 4 0 0 0-8 0 M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  layers: 'm12 2 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 17l9 5 9-5',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5 18 18 M18 6l-2.5 2.5 M8.5 15.5 6 18',
};
function I({ n, s = 18 }: { n: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{IP[n].split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}</svg>;
}

interface Tip { x: number; y: number; t: string }

function TowerInner() {
  useBrandVars('Control Tower');
  const [range, setRange] = useState<Range>('48h');
  const [acc, setAcc] = useState<'channels' | 'systems'>('channels');
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
    const T = s.length;
    const clean = s.filter((c) => !touched(c)).length;
    const stp = T ? Math.round(clean / T * 100) : 0;
    const opn = s.filter(opened).length;
    const exc = s.filter(stuck).length;
    const kyc = s.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length;
    const inval = s.filter((c) => c.state === 'VALIDATION_IN_PROGRESS' || (c.state === 'VALIDATED' && !opened(c))).length;
    const activated = s.filter((c) => c.state === 'FULLY_ACTIVATED').length;

    const pctOf = (n: number) => (T ? Math.round(n / T * 100) : 0);
    const mix = [
      { label: 'Straight-through', n: clean, pct: pctOf(clean), color: NAVY, solid: true },
      { label: 'Awaiting KYC', n: kyc, pct: pctOf(kyc), color: BLUE, solid: false },
      { label: 'Needs a person', n: exc, pct: pctOf(exc), color: RED, solid: false },
      { label: 'In validation', n: inval, pct: pctOf(inval), color: GOLD, solid: false },
    ].filter((x) => x.n > 0);

    const count = Math.round(cfg.hours / cfg.bucketH), span = cfg.bucketH * 3600_000;
    const flow = Array.from({ length: count }, (_, i) => {
      const start = from + i * span, d = new Date(start + span / 2);
      const inB = s.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + span; });
      return { n: inB.length, label: cfg.bucketH >= 24 ? DAY[d.getDay()] : two(d.getHours()), full: cfg.bucketH >= 24 ? DAYF[d.getDay()] : `${two(d.getHours())}:00` };
    });
    const peakI = flow.reduce((a, b, i) => (b.n > flow[a].n ? i : a), 0);

    const channels = ([['bulk', 'Bulk payroll', GOLD], ['single', 'Branch', NAVY], ['self', 'Digital', GREEN]] as const)
      .map(([k, label, color]) => ({ k, label, color, n: s.filter((c) => (c.channel ?? 'single') === k).length })).filter((c) => c.n > 0);

    const svc = (kinds: ValidationKind[], name: string) => {
      const f = s.filter((c) => kinds.some((k) => failedK(c, k))).length;
      return { name, f, sig: (f >= 3 ? 'bad' : f > 0 ? 'warn' : 'ok') as 'bad' | 'warn' | 'ok' };
    };
    const upstream = [svc(['NIN'], 'NIMC'), svc(['BVN'], 'NIBSS'), svc(['LIVENESS'], 'Liveness'), { name: 'Finacle', f: 0, sig: 'ok' as const }];

    const funnel = [
      { label: 'Arrived', n: T }, { label: 'Validated', n: s.filter((c) => opened(c) || (c.state === 'VALIDATED' && !stuck(c))).length },
      { label: 'Account open', n: opn }, { label: 'Activated', n: activated },
    ];

    const causes = KINDS.map((k) => ({ k, n: s.filter((c) => failedK(c, k)).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
    // Attention list for the checklist card.
    const attn = [
      ...causes.map((c) => ({ icon: 'alert', title: KLABEL[c.k], sub: `${c.n} ${c.n === 1 ? 'case' : 'cases'} to review`, sig: 'bad' as const })),
      ...(kyc ? [{ icon: 'clock', title: 'Awaiting KYC', sub: `${kyc} open · links sent`, sig: 'warn' as const }] : []),
      ...(inval ? [{ icon: 'spark', title: 'In validation', sub: `${inval} running now`, sig: 'ok' as const }] : []),
    ].slice(0, 5);

    // Sankey — three stages: how the work came in, whether it cleared its checks,
    // and where it ended up. Ribbons carry the intake colour the whole way, so a
    // reader can trace bulk vs single from left to right.
    const intakeOf = (c: OnboardingCase) => (c.channel === 'bulk' ? 'bulk' : 'single');
    const checkOf = (c: OnboardingCase) => (touched(c) ? 'flagged' : 'cleared');
    const outcomeOf = (c: OnboardingCase) => stuck(c) ? 'person'
      : c.state === 'FULLY_ACTIVATED' ? 'active'
      : (c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS') ? 'kyc' : 'progress';
    const C0 = [{ key: 'bulk', label: 'Bulk upload', color: GOLD }, { key: 'single', label: 'Single', color: NAVY }];
    const C1 = [{ key: 'cleared', label: 'Cleared checks', color: GREEN }, { key: 'flagged', label: 'Flagged for review', color: RED }];
    const C2 = [
      { key: 'active', label: 'Fully activated', color: NAVY }, { key: 'kyc', label: 'Awaiting KYC', color: BLUE },
      { key: 'progress', label: 'In progress', color: GOLD }, { key: 'person', label: 'Needs a person', color: RED },
    ];
    const pathN: Record<string, number> = {};
    s.forEach((c) => { const k = `${intakeOf(c)}>${checkOf(c)}>${outcomeOf(c)}`; pathN[k] = (pathN[k] ?? 0) + 1; });
    const flows = Object.entries(pathN).map(([k, n]) => { const path = k.split('>'); return { path, n, color: path[0] === 'bulk' ? GOLD : NAVY }; });
    const nAt = (ci: number, key: string) => flows.filter((f) => f.path[ci] === key).reduce((a, b) => a + b.n, 0);
    const columns = [C0, C1, C2].map((col, ci) => col.map((nd) => ({ ...nd, n: nAt(ci, nd.key) })).filter((nd) => nd.n > 0));
    const flaggedN = s.filter((c) => touched(c)).length;

    return {
      T, clean, opn, exc, kyc, stp, activated, activatedPct: pctOf(activated),
      hours: Math.round(clean * (MANUAL_MIN - AUTO_MIN) / 60 * 10) / 10,
      mix, flow, peakI, flowMax: Math.max(1, ...flow.map((f) => f.n)),
      channels, chTotal: channels.reduce((a, b) => a + b.n, 0), upstream, funnel, attn, openCount: exc + kyc,
      sankey: { columns, flows }, flaggedN, clearedPct: T ? Math.round((T - flaggedN) / T * 100) : 0,
    };
  }, [cases, now, cfg]);

  return (
    <div className="inst cl" onMouseLeave={() => setTip(null)}>
      <TopBar system="Control Tower" sub="Account opening" />
      <div className="cl-bg">
        <div className="cl-scroll">
          {/* Header */}
          <div className="cl-head">
            <div><h1>Account Opening</h1><p>Live view of the automated line</p></div>
            <div className="cl-seg">{RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}</div>
          </div>

          {m.T === 0 ? (
            <div className="cl-empty"><b>The line is quiet</b><span>No applications in this window.</span></div>
          ) : (
            <>
              {/* Allocation bar + stat cards */}
              <div className="cl-top">
                <div className="cl-mix">
                  <div className="lbls">{m.mix.map((x) => <span key={x.label}>{x.label}</span>)}</div>
                  <div className="bar">{m.mix.map((x) => (
                    <span key={x.label} className={`seg${x.solid ? ' solid' : ''}`} style={{ flexGrow: Math.max(x.n, 0.6), ['--c' as string]: x.color }}>{x.pct}%</span>
                  ))}</div>
                </div>
                <div className="cl-stats">
                  <Stat icon="inbox" label="Arrived" v={m.T} />
                  <Stat icon="check" label="Opened" v={m.opn} />
                  <Stat icon="alert" label="Exceptions" v={m.exc} bad={m.exc > 0} />
                </div>
              </div>

              {/* Main grid */}
              <div className="cl-grid">
                {/* Left column: feature + accordion */}
                <div className="cl-col">
                  <section className="cl-feature">
                    <div className="k">Straight-through rate</div>
                    <div className="big">{m.stp}<em>%</em></div>
                    <div className="tag">{m.clean} of {m.T} opened with no one touching them</div>
                    <div className="foot">
                      <div><b>{m.opn}</b><span>opened</span></div>
                      <div><b style={{ color: GOLD }}>{m.hours}h</b><span>returned</span></div>
                    </div>
                  </section>

                  <section className="cl-acc">
                    <button className={`row ${acc === 'channels' ? 'on' : ''}`} onClick={() => setAcc('channels')}><span>How work arrives</span><i>{acc === 'channels' ? '–' : '+'}</i></button>
                    {acc === 'channels' && <div className="body">{m.channels.map((c) => (
                      <div className="cbar" key={c.k}><span className="nm">{c.label}</span><span className="t"><i style={{ width: `${m.chTotal ? Math.max(6, c.n / m.chTotal * 100) : 0}%`, background: c.color }} /></span><b>{c.n}</b></div>
                    ))}</div>}
                    <button className={`row ${acc === 'systems' ? 'on' : ''}`} onClick={() => setAcc('systems')}><span>Upstream systems</span><i>{acc === 'systems' ? '–' : '+'}</i></button>
                    {acc === 'systems' && <div className="body">{m.upstream.map((u) => (
                      <div className="srow" key={u.name}><span className={`dot ${u.sig}`} /><span className="nm">{u.name}</span><span className="st">{u.sig === 'bad' ? `${u.f} failing` : u.sig === 'warn' ? `${u.f} to watch` : 'nominal'}</span></div>
                    ))}</div>}
                  </section>
                </div>

                {/* Pill bars */}
                <section className="cl-card cl-bars">
                  <div className="hd"><div><div className="t">Applications received</div><div className="v">{m.T}<span> total</span></div></div><button className="go" aria-label="expand"><I n="spark" s={16} /></button></div>
                  <div className="bars">
                    {m.flow.map((f, i) => (
                      <button className="b" key={i} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, t: `${f.full} · ${f.n}` })} onMouseLeave={() => setTip(null)}>
                        {i === m.peakI && f.n > 0 && <span className="tip">{f.n}</span>}
                        <i className={i === m.peakI && f.n > 0 ? 'hi' : ''} style={{ height: f.n ? `${Math.max(8, f.n / m.flowMax * 100)}%` : '6px' }} />
                        <em>{f.label}</em>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Ring */}
                <section className="cl-card cl-ring">
                  <div className="hd"><div><div className="t">Activation</div><div className="v">{m.activatedPct}<span>% fully active</span></div></div></div>
                  <Ring pct={m.activatedPct} />
                  <div className="ring-legend"><span><i style={{ background: NAVY }} />Activated {m.activated}</span><span><i style={{ background: '#e7ecf7' }} />In flight {m.T - m.activated}</span></div>
                </section>

                {/* Wide: reach by stage (funnel) */}
                <section className="cl-card cl-wide">
                  <div className="hd"><div><div className="t">Reach by stage</div><div className="v">{m.funnel[0].n}<span> arrived → {m.activated} activated</span></div></div></div>
                  <div className="cl-funnel">
                    {m.funnel.map((f, i) => {
                      const pct = m.funnel[0].n ? f.n / m.funnel[0].n * 100 : 0;
                      const drop = i > 0 ? m.funnel[i - 1].n - f.n : 0;
                      return (
                        <div className="fr" key={f.label}>
                          <span className="fl">{f.label}</span>
                          <span className="ft"><i style={{ width: `${Math.max(3, pct)}%`, background: `color-mix(in srgb, ${NAVY} ${100 - i * 15}%, #8aa2dc)` }} /></span>
                          <span className="fn">{f.n}</span>
                          <span className="fd">{i > 0 && drop > 0 ? `−${drop}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Onboarding / attention checklist */}
                <section className="cl-onb">
                  <div className="onb-hd"><div className="t">Onboarding</div><div className="pct">{m.activatedPct}%</div></div>
                  <div className="onb-seg">
                    {m.funnel.slice(1).map((f, i) => <div key={f.label} className="s"><i style={{ width: `${m.funnel[0].n ? f.n / m.funnel[0].n * 100 : 0}%`, background: i === 2 ? NAVY : '#c3d0ec' }} /><span>{f.label}</span></div>)}
                  </div>
                  <div className="onb-task">
                    <div className="th"><span>Needs attention</span><b>{m.openCount}</b></div>
                    <div className="tl">
                      {m.attn.length ? m.attn.map((a, i) => (
                        <div className="ti" key={i}>
                          <span className="ic"><I n={a.icon} s={15} /></span>
                          <span className="tx"><b>{a.title}</b><em>{a.sub}</em></span>
                          <span className={`ck ${a.sig}`}>{a.sig === 'ok' ? <I n="check" s={12} /> : ''}</span>
                        </div>
                      )) : <div className="clear">All clear — nothing waiting on a person.</div>}
                    </div>
                  </div>
                </section>
              </div>

              {/* Sankey — intake → verification → outcome, ribbons coloured by intake */}
              <section className="cl-card cl-sankey">
                <div className="hd">
                  <div><div className="t">Account opening flow</div><div className="v">{m.T}<span> applications · {m.clearedPct}% cleared checks, {m.flaggedN} flagged</span></div></div>
                  <div className="sk-key">
                    <span className="col">Traced by</span>
                    <span><i style={{ background: GOLD }} />Bulk upload</span>
                    <span><i style={{ background: NAVY }} />Single</span>
                  </div>
                </div>
                <Sankey columns={m.sankey.columns} flows={m.sankey.flows}
                  onTip={(e, t) => setTip({ x: e.clientX, y: e.clientY, t })} clearTip={() => setTip(null)} />
              </section>
            </>
          )}
        </div>
      </div>
      {tip && <div className="cl-tip" style={{ left: tip.x, top: tip.y }}>{tip.t}</div>}
    </div>
  );
}

// A filled sankey ribbon between two node faces.
function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number): string {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xm},${y1 + h1} ${xm},${y0 + h0} ${x0},${y0 + h0} Z`;
}

interface SkNode { key: string; label: string; color: string; n: number }
interface SkFlow { path: string[]; n: number; color: string }
const STAGE = ['Intake', 'Verification', 'Outcome'];
function Sankey({ columns, flows, onTip, clearTip }: {
  columns: SkNode[][]; flows: SkFlow[];
  onTip: (e: React.MouseEvent, t: string) => void; clearTip: () => void;
}) {
  const W = 940, H = 320, NW = 13, GAP = 26, PAD = 12, GUT = 150;
  const T = columns[0].reduce((a, b) => a + b.n, 0) || 1;
  const nCols = columns.length;
  const maxNodes = Math.max(...columns.map((c) => c.length), 1);
  const unit = (H - PAD * 2 - GAP * (maxNodes - 1)) / T;   // one px-per-case, so ribbons keep width across stages
  const colX = (i: number) => (nCols === 1 ? 0 : (i / (nCols - 1)) * (W - NW));
  type Box = SkNode & { x: number; y: number; h: number; ci: number };
  const pos: Record<string, Box> = {};
  const laid = columns.map((col, ci) => {
    const colH = col.reduce((s, n) => s + n.n * unit, 0) + GAP * Math.max(0, col.length - 1);
    let y = PAD + (H - PAD * 2 - colH) / 2;   // centre shorter columns
    return col.map((nd) => { const h = nd.n * unit; const box: Box = { ...nd, ci, x: colX(ci), y, h }; pos[`${ci}:${nd.key}`] = box; y += h + GAP; return box; });
  });
  const idx = columns.map((col) => Object.fromEntries(col.map((n, i) => [n.key, i])));
  const sorted = [...flows].sort((a, b) => { for (let i = 0; i < a.path.length; i++) { const d = (idx[i]?.[a.path[i]] ?? 9) - (idx[i]?.[b.path[i]] ?? 9); if (d) return d; } return 0; });
  // Advance both faces of a middle node together per flow, so ribbons pass straight through.
  const outC: Record<string, number> = {}, inC: Record<string, number> = {};
  const ribs: { d: string; color: string; tip: string }[] = [];
  sorted.forEach((f) => {
    for (let ci = 0; ci < f.path.length - 1; ci++) {
      const src = pos[`${ci}:${f.path[ci]}`], tgt = pos[`${ci + 1}:${f.path[ci + 1]}`];
      if (!src || !tgt) continue;
      const h = f.n * unit, sk = `${ci}:${src.key}`, tk = `${ci + 1}:${tgt.key}`;
      const y0 = src.y + (outC[sk] ?? 0), y1 = tgt.y + (inC[tk] ?? 0);
      outC[sk] = (outC[sk] ?? 0) + h; inC[tk] = (inC[tk] ?? 0) + h;
      ribs.push({ d: ribbon(src.x + NW, y0 + 0.4, Math.max(1, h - 0.8), tgt.x, y1 + 0.4, Math.max(1, h - 0.8)), color: f.color, tip: `${src.label} → ${tgt.label}: ${f.n}` });
    }
  });
  const nodes = laid.flat();
  return (
    <svg viewBox={`${-GUT} -30 ${W + GUT * 2} ${H + 38}`} className="cl-sk-svg" role="img" aria-label="Account opening flow: intake, verification and outcome">
      {columns.map((_, ci) => <text key={ci} x={colX(ci) + NW / 2} y={-16} textAnchor={ci === 0 ? 'start' : ci === nCols - 1 ? 'end' : 'middle'} className="sk-stage">{STAGE[ci]}</text>)}
      {ribs.map((r, i) => <path key={i} d={r.d} fill={r.color} fillOpacity={0.3} className="rb" onMouseMove={(e) => onTip(e, r.tip)} onMouseLeave={clearTip} />)}
      {nodes.map((nd) => <rect key={`${nd.ci}:${nd.key}`} x={nd.x} y={nd.y} width={NW} height={nd.h} rx={3} fill={nd.color} />)}
      {nodes.map((nd) => {
        if (nd.ci === 0) return <text key={`l${nd.key}`} x={-14} y={nd.y + nd.h / 2} textAnchor="end" dominantBaseline="middle" className="sk-lb"><tspan className="n">{nd.n}</tspan><tspan dx={7} className="l">{nd.label}</tspan></text>;
        if (nd.ci === nCols - 1) return <text key={`r${nd.key}`} x={W + 14} y={nd.y + nd.h / 2} textAnchor="start" dominantBaseline="middle" className="sk-lb"><tspan className="l">{nd.label}</tspan><tspan dx={7} className="n">{nd.n}</tspan></text>;
        return <text key={`m${nd.key}`} x={nd.x + NW / 2} y={nd.y - 9} textAnchor="middle" className="sk-lb mid"><tspan className="n">{nd.n}</tspan><tspan dx={6} className="l">{nd.label}</tspan></text>;
      })}
    </svg>
  );
}

function Stat({ icon, label, v, bad }: { icon: string; label: string; v: number; bad?: boolean }) {
  return (
    <div className="cl-stat">
      <span className={`ic${bad ? ' bad' : ''}`}><I n={icon} s={19} /></span>
      <div><div className="l">{label}</div><div className="n">{v}</div></div>
    </div>
  );
}

function Ring({ pct, size = 168 }: { pct: number; size?: number }) {
  const stroke = 20, r = (size - stroke) / 2, c = size / 2, circ = 2 * Math.PI * r;
  return (
    <div className="cl-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#e7ecf7" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${c} ${c})`}><circle cx={c} cy={c} r={r} fill="none" stroke={NAVY} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${pct / 100 * circ} ${circ}`} /></g>
      </svg>
      <div className="ring-c"><b>{pct}<em>%</em></b></div>
    </div>
  );
}

export default function TowerConsole() {
  return <InstrumentProvider><TowerInner /></InstrumentProvider>;
}
