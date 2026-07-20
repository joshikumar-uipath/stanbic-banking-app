// ─────────────────────────────────────────────────────────────────────────────
// Factory control tower (/tower) — the management view of the account opening
// factory, read live off the shared store.
//
// Everything else in this demo answers "what should I do about this case?".
// This answers "is the factory working?" — throughput, straight-through rate,
// where applications sit, what actually breaks, and how the work arrives.
//
// Charts follow the house rules: one filter row scoping every card, thin marks
// with rounded data-ends, solid hairline grids, selective direct labels, a
// hover/focus tooltip on every mark, and a table twin so no value is gated
// behind a hover.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, ONBOARDING_STATES, VALIDATION_KINDS, type OnboardingCase, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

// Validated categorical trio (see dataviz validator: lightness band, chroma
// floor, CVD ΔE 13.5, normal-vision 19.8, contrast ≥3:1 on a light surface).
// Identity colours for how work arrives — deliberately not the brand hue, which
// is reserved for single-series magnitude.
const CHANNEL_COLOR: Record<string, string> = { single: '#2563EB', bulk: '#A16207', self: '#0D9488' };
const CHANNEL_LABEL: Record<string, string> = { single: 'Walk-in / branch', bulk: 'Bulk payroll', self: 'Self-service' };
const CHANNELS = ['single', 'bulk', 'self'] as const;

// Minutes of human handling saved per application that never needed a person.
const MANUAL_MIN = 35;
const AUTO_MIN = 4;

type Range = '24h' | '48h' | '7d';
const RANGES: { id: Range; label: string; hours: number; bucketH: number }[] = [
  { id: '24h', label: '24 hours', hours: 24, bucketH: 4 },
  { id: '48h', label: '48 hours', hours: 48, bucketH: 6 },
  { id: '7d', label: '7 days', hours: 168, bucketH: 24 },
];

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
const opened = (c: OnboardingCase) => Boolean(c.accountNumber);
/** Touched = a person had to get involved at some point. */
const touched = (c: OnboardingCase) =>
  c.state === 'EXCEPTION' || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout');

interface Tip { x: number; y: number; title: string; rows: { k: string; v: string }[] }

function TowerInner() {
  useBrandVars('Control Tower');
  const [range, setRange] = useState<Range>('48h');
  const [showData, setShowData] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  // `now` travels with the data so nothing time-dependent is computed in render.
  const [{ cases, now }, setData] = useState<{ cases: OnboardingCase[]; now: number }>({ cases: [], now: 0 });

  useEffect(() => {
    let alive = true;
    const refresh = () => { void store.list().then((all) => { if (alive) setData({ cases: all, now: Date.now() }); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  const cfg = RANGES.find((r) => r.id === range)!;

  const model = useMemo(() => {
    const from = now - cfg.hours * 3600_000;
    const scoped = cases.filter((c) => Date.parse(c.createdAt) >= from);

    // Headline figures.
    const stpCount = scoped.filter((c) => !touched(c)).length;
    const kpi = {
      opened: scoped.filter(opened).length,
      received: scoped.length,
      stp: scoped.length ? Math.round((stpCount / scoped.length) * 100) : 0,
      exceptions: scoped.filter((c) => c.state === 'EXCEPTION').length,
      hours: Math.round((stpCount * (MANUAL_MIN - AUTO_MIN)) / 60),
    };

    // Throughput — equal buckets across the window, oldest first.
    const count = Math.round(cfg.hours / cfg.bucketH);
    const span = cfg.bucketH * 3600_000;
    const flow = Array.from({ length: count }, (_, i) => {
      const start = from + i * span;
      const d = new Date(start + span / 2);
      return {
        label: cfg.bucketH >= 24 ? DAY[d.getDay()] : `${two(d.getHours())}:00`,
        full: cfg.bucketH >= 24 ? `${DAY[d.getDay()]} ${d.getDate()}` : `${two(d.getHours())}:00–${two((d.getHours() + cfg.bucketH) % 24)}:00`,
        n: scoped.filter((c) => { const t = Date.parse(c.createdAt); return t >= start && t < start + span; }).length,
      };
    });

    // Where applications sit right now.
    const stages = ONBOARDING_STATES
      .map((s) => ({ label: s.label, n: scoped.filter((c) => c.state === s.state).length }))
      .filter((s) => s.n > 0);

    // What actually breaks — a case can fail more than one check.
    const causes = VALIDATION_KINDS
      .map((k: ValidationKind) => ({
        label: k === 'LIVENESS' ? 'Selfie check' : k === 'FRAUD' ? 'Fraud screening' : k,
        n: scoped.filter((c) => c.validations.some((v) => v.kind === k && (v.status === 'failed' || v.status === 'timeout'))).length,
      }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n);

    // How the work arrives.
    const mix = CHANNELS.map((k) => ({ key: k, label: CHANNEL_LABEL[k], color: CHANNEL_COLOR[k], n: scoped.filter((c) => (c.channel ?? 'single') === k).length }));

    return { kpi, flow, stages, causes, mix, total: scoped.length };
  }, [cases, now, cfg]);

  const { kpi, flow, stages, causes, mix, total } = model;
  const flowMax = Math.max(1, ...flow.map((f) => f.n));
  const flowPeak = flow.reduce((a, b) => (b.n > a.n ? b : a), flow[0] ?? { n: -1, label: '' });
  const stageMax = Math.max(1, ...stages.map((s) => s.n));
  const causeMax = Math.max(1, ...causes.map((c) => c.n));
  const mixTotal = mix.reduce((s, m) => s + m.n, 0);

  const over = (e: { clientX: number; clientY: number }, title: string, rows: { k: string; v: string }[]) =>
    setTip({ x: e.clientX, y: e.clientY, title, rows });
  const focusTip = (el: EventTarget & Element, title: string, rows: { k: string; v: string }[]) => {
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top, title, rows });
  };

  return (
    <div className="inst" onMouseLeave={() => setTip(null)}>
      <TopBar system="Control Tower" sub="Account opening" />

      <div className="tw-scroll">
        {/* One filter row, scoping every card below it. */}
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

        {total === 0 ? (
          <div className="fn-empty"><b>Nothing in this window</b><span>No applications were received in the last {cfg.label}. Try a wider range.</span></div>
        ) : (
          <>
            {/* Hero + supporting tiles. Exactly one hero figure per view. */}
            <div className="tw-kpis">
              <div className="tw-hero">
                <div className="k">Accounts opened</div>
                <div className="v">{kpi.opened}</div>
                <div className="s">of {kpi.received} received · last {cfg.label}</div>
              </div>
              <div className="tw-tiles">
                <Tile label="Straight through" value={`${kpi.stp}%`} sub="never needed a person" tone={kpi.stp >= 80 ? 'good' : kpi.stp >= 60 ? 'warn' : 'bad'} />
                <Tile label="Exceptions" value={kpi.exceptions} sub="waiting on a person" tone={kpi.exceptions === 0 ? 'good' : 'bad'} />
                <Tile label="Hours returned" value={kpi.hours} sub={`vs ${MANUAL_MIN}-min manual open`} tone="none" />
              </div>
            </div>

            <div className="tw-grid">
              {/* ── Throughput: change over time, single series → no legend ── */}
              <section className="tw-card wide">
                <header><h2>Applications received</h2><p>Each bar is {cfg.bucketH >= 24 ? 'a day' : `${cfg.bucketH} hours`}. Peak {flowPeak.n} in {flowPeak.label}.</p></header>
                <div className="tw-cols">
                  <div className="plot">
                    <div className="grid" aria-hidden><i /><i /><i /><i /></div>
                    {flow.map((f, i) => (
                      <button
                        className="hit" key={i}
                        aria-label={`${f.full}: ${f.n} applications`}
                        onMouseMove={(e) => over(e, f.full, [{ k: 'Applications', v: String(f.n) }])}
                        onFocus={(e) => focusTip(e.currentTarget, f.full, [{ k: 'Applications', v: String(f.n) }])}
                        onBlur={() => setTip(null)}
                      >
                        {f.n === flowPeak.n && f.n > 0 && <span className="cap">{f.n}</span>}
                        {/* An empty bucket draws nothing — a minimum-height stub
                            would read as volume that isn't there. */}
                        <i className="col" style={{ height: f.n ? `${Math.max(3, (f.n / flowMax) * 128)}px` : 0 }} />
                      </button>
                    ))}
                  </div>
                  <div className="axis">{flow.map((f, i) => <span key={i}>{f.label}</span>)}</div>
                </div>
                {showData && <Table head={['Bucket', 'Applications']} rows={flow.map((f) => [f.full, String(f.n)])} />}
              </section>

              {/* ── Where they sit: magnitude across ordered stages ── */}
              <section className="tw-card">
                <header><h2>Where applications sit</h2><p>Live count by stage.</p></header>
                <BarList
                  items={stages.map((s) => ({ label: s.label, n: s.n }))}
                  max={stageMax}
                  onTip={over} onFocusTip={focusTip} unit="applications"
                />
                {showData && <Table head={['Stage', 'Applications']} rows={stages.map((s) => [s.label, String(s.n)])} />}
              </section>

              {/* ── What breaks ── */}
              <section className="tw-card">
                <header><h2>What needs a person</h2><p>Checks that failed or timed out.</p></header>
                {causes.length ? (
                  <>
                    <BarList
                      items={causes.map((c) => ({ label: c.label, n: c.n }))}
                      max={causeMax} tone="bad"
                      onTip={over} onFocusTip={focusTip} unit="cases"
                    />
                    {showData && <Table head={['Check', 'Cases']} rows={causes.map((c) => [c.label, String(c.n)])} />}
                  </>
                ) : (
                  <div className="tw-clear">Nothing failed in this window — every check passed first time.</div>
                )}
              </section>

              {/* ── How work arrives: part-to-whole, 3 categorical hues + legend ── */}
              <section className="tw-card wide">
                <header><h2>How the work arrives</h2><p>Share of applications by channel.</p></header>
                <div className="tw-stack">
                  {mix.filter((m) => m.n > 0).map((m) => (
                    <button
                      key={m.key} className="seg" style={{ flexGrow: m.n, background: m.color }}
                      aria-label={`${m.label}: ${m.n} applications, ${Math.round((m.n / mixTotal) * 100)}%`}
                      onMouseMove={(e) => over(e, m.label, [{ k: 'Applications', v: String(m.n) }, { k: 'Share', v: `${Math.round((m.n / mixTotal) * 100)}%` }])}
                      onFocus={(e) => focusTip(e.currentTarget, m.label, [{ k: 'Applications', v: String(m.n) }])}
                      onBlur={() => setTip(null)}
                    />
                  ))}
                </div>
                <div className="tw-legend">
                  {mix.map((m) => (
                    <span key={m.key}><i style={{ background: m.color }} />{m.label}<b>{mixTotal ? Math.round((m.n / mixTotal) * 100) : 0}%</b></span>
                  ))}
                </div>
                {showData && <Table head={['Channel', 'Applications', 'Share']} rows={mix.map((m) => [m.label, String(m.n), `${mixTotal ? Math.round((m.n / mixTotal) * 100) : 0}%`])} />}
              </section>
            </div>
          </>
        )}
      </div>

      {tip && (
        <div className="tw-tip" style={{ left: tip.x, top: tip.y }} role="status">
          <b>{tip.title}</b>
          {tip.rows.map((r) => <span key={r.k}>{r.k}<em>{r.v}</em></span>)}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone: 'good' | 'warn' | 'bad' | 'none' }) {
  return (
    <div className="tw-tile">
      <div className="k">{label}</div>
      <div className={`v ${tone}`}>{value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}

/** Horizontal bars — one series, one colour; value rides the tip. */
function BarList({ items, max, tone, onTip, onFocusTip, unit }: {
  items: { label: string; n: number }[]; max: number; tone?: 'bad'; unit: string;
  onTip: (e: { clientX: number; clientY: number }, t: string, r: { k: string; v: string }[]) => void;
  onFocusTip: (el: EventTarget & Element, t: string, r: { k: string; v: string }[]) => void;
}) {
  return (
    <div className="tw-bars">
      {items.map((it) => (
        <div className="row" key={it.label}>
          <span className="lb">{it.label}</span>
          <span className="track">
            <button
              className={`bar${tone === 'bad' ? ' bad' : ''}`} style={{ width: `${Math.max(2, (it.n / max) * 100)}%` }}
              aria-label={`${it.label}: ${it.n} ${unit}`}
              onMouseMove={(e) => onTip(e, it.label, [{ k: unit[0].toUpperCase() + unit.slice(1), v: String(it.n) }])}
              onFocus={(e) => onFocusTip(e.currentTarget, it.label, [{ k: unit[0].toUpperCase() + unit.slice(1), v: String(it.n) }])}
              onBlur={() => onTip({ clientX: -9999, clientY: -9999 }, '', [])}
            />
          </span>
          <span className="vl">{it.n}</span>
        </div>
      ))}
    </div>
  );
}

/** The table twin — every charted value readable without a hover. */
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
