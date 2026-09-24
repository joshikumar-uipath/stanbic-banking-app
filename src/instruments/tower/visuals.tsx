// ─────────────────────────────────────────────────────────────────────────────
// Control tower — the visuals.
//
// Hand-drawn SVG rather than a charting dependency, matching the rest of the
// instruments. Every visual that represents a dimension takes `selected` and
// `onSelect`, which is what makes the report cross-filter: clicking a bar, a
// slice or a Sankey node highlights it here and narrows every other visual on
// every page, because the selection lives in one place above all of them.
//
// The drawing language is Power BI's own: a category axis, hairline gridlines,
// data labels in the ink-2 grey, one series colour per measure, and no track
// behind a bar — a bar with a grey runway behind it reads as a progress bar,
// not as a value. Charts that need real geometry (markers, labels inside the
// plot) measure their container and draw in pixel space, so nothing stretches.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Bucket, FunnelStep, Kpi, Series, SkFlow, SkNode, Slice, StackBucket } from './metrics';

export interface TipFn { (e: React.MouseEvent, text: string): void }

const nf = (n: number) => n.toLocaleString();

/** Width of a block element, kept current through resizes. Charts draw in
 *  pixel space against this so circles stay round and text stays upright. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((es) => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A "nice" axis ceiling and its ticks: 27 → 30 in steps of 10, 4 → 4 in 1s. */
function niceScale(max: number, want = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / want;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

// ── KPI card (Power BI "card (new)") ─────────────────────────────────────────
export function KpiCard({ k, target, period, onClick, active }: {
  k: Kpi; target?: { value: number; label: string }; period?: string; onClick?: () => void; active?: boolean;
}) {
  const rising = k.delta > 0;
  const flat = k.delta === 0;
  const good = flat ? null : rising === k.goodUp;
  const hitTarget = target ? k.value >= target.value : null;
  // A measure that is itself a percentage moves in points, not in percent of a
  // percent — "+34%" on an 84% rate reads as a 34% relative gain, which is wrong.
  const isRate = k.suffix === '%';
  // "▲ 40 vs previous period" when the previous period held nothing is a
  // statement about the calendar, not the business. Say so instead.
  const noPrior = k.prev === 0 && !flat;
  return (
    <div className={`pb-kpi${active ? ' on' : ''}${onClick ? ' click' : ''}`}
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
      <div className="lb">{k.label}</div>
      <div className="v">{nf(k.value)}{k.suffix && <em>{k.suffix}</em>}</div>
      <div className="ref">
        {noPrior ? (
          <span className="dl flat">No prior-period data</span>
        ) : (
          <>
            <span className={`dl ${flat ? 'flat' : good ? 'good' : 'bad'}`}>
              {flat ? 'No change' : `${rising ? '▲' : '▼'} ${nf(Math.abs(k.delta))}${isRate ? ' pts' : ''}`}
              {!flat && !isRate && k.deltaPct !== null && <i> ({Math.abs(k.deltaPct)}%)</i>}
            </span>
            <span className="vs">vs prior {period ?? 'period'}</span>
          </>
        )}
      </div>
      <Spark points={k.spark} />
      {target && (
        <div className={`tg ${hitTarget ? 'ok' : 'under'}`}>
          <i />{hitTarget ? `On target · ${target.label}` : `${target.value - k.value} pts under ${target.label}`}
        </div>
      )}
    </div>
  );
}

/** The card's sparkline: a quiet area in the series colour under the value. */
function Spark({ points }: { points: number[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 28;
  const d = useMemo(() => {
    if (points.length < 2 || W < 10) return null;
    const max = Math.max(...points);
    const xy = points.map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = max === 0 ? H - 1 : H - 1 - (p / max) * (H - 4);
      return [x, y] as const;
    });
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const last = xy[xy.length - 1];
    return { line, area: `${line} L${W},${H} L0,${H} Z`, last };
  }, [points, W]);
  return (
    <div className="pb-spark" ref={ref}>
      {d && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <path d={d.area} className="ar" />
          <path d={d.line} className="ln" fill="none" />
          <circle cx={d.last[0]} cy={d.last[1]} r={2.5} className="pt" />
        </svg>
      )}
    </div>
  );
}

// ── Column + line combo: arrivals as columns, opened as a line ───────────────
export function Combo({ buckets, onTip, clearTip, height = 210 }: {
  buckets: Bucket[]; max?: number; peak?: number; onTip: TipFn; clearTip: () => void; height?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = height;
  const M = { l: 30, r: 8, t: 16, b: 22 };
  const max = Math.max(0, ...buckets.map((b) => Math.max(b.arrived, b.opened)));
  const { top, ticks } = niceScale(max, 3);
  const n = Math.max(1, buckets.length);
  const pw = Math.max(0, W - M.l - M.r);
  const bw = pw / n;
  const colW = Math.min(bw * 0.58, 44);
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const cx = (i: number) => M.l + (i + 0.5) * bw;
  const line = buckets.map((b, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(b.opened).toFixed(1)}`).join(' ');
  // A month of daily buckets cannot all carry a label; show every nth, and the last.
  const every = n > 14 ? Math.ceil(n / 8) : 1;
  const showLabel = (i: number) => i % every === 0 || (every > 1 && i === n - 1 && (n - 1) % every >= 2);
  const showValue = (v: number) => v > 0 && (n <= 14 || v >= top * 0.55);
  return (
    <div className="pb-chart">
      <div className="pb-legend">
        <span><i className="sw col" />Arrived</span>
        <span><i className="sw line" />Opened</span>
      </div>
      <div className="pb-plot" ref={ref} style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} role="img"
            aria-label={`Applications received per bucket, ${buckets.reduce((a, b) => a + b.arrived, 0)} in total`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'ax' : 'gr'} />
                <text x={M.l - 6} y={y(t)} className="tk" textAnchor="end" dominantBaseline="middle">{nf(t)}</text>
              </g>
            ))}
            {buckets.map((b, i) => (
              <g key={i} onMouseMove={(e) => onTip(e, `${b.full} · ${b.arrived} arrived, ${b.opened} opened`)} onMouseLeave={clearTip}>
                <rect x={cx(i) - bw / 2} y={M.t} width={bw} height={H - M.t - M.b} fill="transparent" />
                {b.arrived > 0 && (
                  <rect x={cx(i) - colW / 2} y={y(b.arrived)} width={colW} height={y(0) - y(b.arrived)} className="col" />
                )}
                {showValue(b.arrived) && (
                  <text x={cx(i)} y={y(b.arrived) - 4} className="dl" textAnchor="middle">{nf(b.arrived)}</text>
                )}
                {showLabel(i) && <text x={cx(i)} y={H - 6} className="tk" textAnchor="middle">{b.label}</text>}
              </g>
            ))}
            <path d={line} className="ln" fill="none" />
            {n <= 14 && buckets.map((b, i) => (
              <circle key={i} cx={cx(i)} cy={y(b.opened)} r={3} className="mk" />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Gauge (Power BI's half dial, with a target line) ─────────────────────────
export function Gauge({ pct, target, caption, sub }: { pct: number; target?: number; caption: string; sub?: string }) {
  const W = 232, stroke = 16, r = 96, cx = W / 2, cy = r + stroke / 2 + 6, H = cy + 8;
  const pt = (p: number, rr = r) => {
    const a = Math.PI * (1 - Math.min(100, Math.max(0, p)) / 100);
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(from), [x1, y1] = pt(to);
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  const tone = target === undefined ? 'brand' : pct >= target ? 'good' : 'warn';
  return (
    <div className="pb-gauge">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${caption}: ${pct}%`}>
        <path d={arc(0, 100)} className="track" strokeWidth={stroke} fill="none" />
        {pct > 0 && <path d={arc(0, pct)} className={`fill ${tone}`} strokeWidth={stroke} fill="none" />}
        {target !== undefined && (() => {
          const [ix, iy] = pt(target, r - stroke / 2 - 4), [ox, oy] = pt(target, r + stroke / 2 + 4);
          return <line x1={ix} y1={iy} x2={ox} y2={oy} className="tgt" />;
        })()}
        <text x={cx - r} y={H - 1} className="end" textAnchor="middle">0%</text>
        <text x={cx + r} y={H - 1} className="end" textAnchor="middle">100%</text>
        <text x={cx} y={cy - 22} className="val" textAnchor="middle">{pct}<tspan className="u">%</tspan></text>
        {sub && <text x={cx} y={cy - 4} className="sub" textAnchor="middle">{sub}</text>}
      </svg>
      <div className="cap">{caption}{target !== undefined && <em> · target {target}%</em>}</div>
    </div>
  );
}

// ── Funnel (centred, the way Power BI draws one) ─────────────────────────────
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="pb-funnel">
      {steps.map((f, i) => (
        <div className="fr" key={f.label}>
          <div className="fl">{f.label}</div>
          <div className="fbar">
            <span className="fill" style={{ width: `${Math.max(1.5, f.pct)}%` }}>
              {f.pct >= 18 && <b>{nf(f.n)}</b>}
            </span>
          </div>
          <div className="fn">
            {i === 0 ? <b>{nf(f.n)}</b> : <><b>{f.pct}%</b><em>{f.drop > 0 ? `−${nf(f.drop)}` : 'no drop'}</em></>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Horizontal bar chart, cross-filtering ────────────────────────────────────
export function Bars({ items, selected, onSelect, unit = 'cases' }: {
  items: Slice[]; selected?: string | null; onSelect?: (key: string | null) => void; unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.n));
  if (!items.length) return <div className="pb-none">Nothing in this window.</div>;
  return (
    <div className="pb-bars">
      {items.map((it) => {
        const on = selected === it.key;
        const dim = selected != null && !on;
        return (
          <button key={it.key} className={`br${on ? ' on' : ''}${dim ? ' dim' : ''}${onSelect ? '' : ' static'}`}
            onClick={onSelect ? () => onSelect(on ? null : it.key) : undefined}
            aria-pressed={onSelect ? on : undefined}
            aria-label={`${it.label}: ${it.n} ${unit}`}>
            <span className="nm">{it.label}</span>
            <span className="tr">
              <i style={{ width: `${(it.n / max) * 100}%`, background: it.color }} />
              <b>{nf(it.n)}</b>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Column chart (aging) ─────────────────────────────────────────────────────
export function Columns({ items, height = 150 }: {
  items: { label: string; n: number; late?: boolean }[]; height?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = height, M = { l: 26, r: 6, t: 16, b: 20 };
  const { top, ticks } = niceScale(Math.max(0, ...items.map((i) => i.n)), 3);
  const n = Math.max(1, items.length);
  const bw = Math.max(0, W - M.l - M.r) / n;
  const colW = Math.min(bw * 0.56, 42);
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const cx = (i: number) => M.l + (i + 0.5) * bw;
  return (
    <div className="pb-plot" ref={ref} style={{ height: H }}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Open work by age">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'ax' : 'gr'} />
              <text x={M.l - 6} y={y(t)} className="tk" textAnchor="end" dominantBaseline="middle">{nf(t)}</text>
            </g>
          ))}
          {items.map((it, i) => (
            <g key={i}>
              {it.n > 0 && (
                <>
                  <rect x={cx(i) - colW / 2} y={y(it.n)} width={colW} height={y(0) - y(it.n)} className={`col${it.late ? ' late' : ''}`} />
                  <text x={cx(i)} y={y(it.n) - 4} className="dl" textAnchor="middle">{nf(it.n)}</text>
                </>
              )}
              <text x={cx(i)} y={H - 5} className="tk" textAnchor="middle">{it.label}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ── 100% stacked bar ─────────────────────────────────────────────────────────
export function Stacked({ slices, onTip, clearTip }: { slices: Slice[]; onTip: TipFn; clearTip: () => void }) {
  if (!slices.length) return <div className="pb-none">Nothing in this window.</div>;
  return (
    <div className="pb-stack">
      <div className="bar">
        {slices.map((s) => (
          <span key={s.key} style={{ flexGrow: Math.max(s.n, 0.4), background: s.color }}
            onMouseMove={(e) => onTip(e, `${s.label}: ${s.n} · ${s.pct}%`)} onMouseLeave={clearTip}>
            {s.pct >= 12 ? `${s.pct}%` : ''}
          </span>
        ))}
      </div>
      <div className="key">
        {slices.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}<b>{nf(s.n)}</b><em>{s.pct}%</em></span>
        ))}
      </div>
    </div>
  );
}

// ── Stacked column chart (one category per colour, per bucket) ───────────────
export function StackedColumns({ buckets, onTip, clearTip, height = 200 }: {
  buckets: StackBucket[]; onTip: TipFn; clearTip: () => void; height?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = height, M = { l: 30, r: 8, t: 14, b: 22 };
  const totals = buckets.map((b) => b.parts.reduce((a, p) => a + p.n, 0));
  const { top, ticks } = niceScale(Math.max(0, ...totals), 3);
  const n = Math.max(1, buckets.length);
  const bw = Math.max(0, W - M.l - M.r) / n;
  const colW = Math.min(bw * 0.6, 44);
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const cx = (i: number) => M.l + (i + 0.5) * bw;
  const every = n > 14 ? Math.ceil(n / 8) : 1;
  const legend = (buckets[0]?.parts ?? []).filter((p) => buckets.some((b) => b.parts.find((q) => q.key === p.key)!.n > 0));
  return (
    <div className="pb-chart">
      <div className="pb-legend">
        {legend.map((p) => <span key={p.key}><i className="sw" style={{ background: p.color }} />{p.label}</span>)}
      </div>
      <div className="pb-plot" ref={ref} style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} role="img" aria-label="Stacked columns per bucket">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'ax' : 'gr'} />
                <text x={M.l - 6} y={y(t)} className="tk" textAnchor="end" dominantBaseline="middle">{nf(t)}</text>
              </g>
            ))}
            {buckets.map((b, i) => {
              let acc = 0;
              return (
                <g key={i}>
                  {b.parts.map((p) => {
                    if (!p.n) return null;
                    const y0 = y(acc + p.n), y1 = y(acc); acc += p.n;
                    return (
                      <rect key={p.key} x={cx(i) - colW / 2} y={y0} width={colW} height={Math.max(0, y1 - y0)} fill={p.color}
                        onMouseMove={(e) => onTip(e, `${b.full} · ${p.label}: ${p.n} of ${totals[i]}`)} onMouseLeave={clearTip} />
                    );
                  })}
                  {totals[i] > 0 && (n <= 14 || totals[i] >= top * 0.55) && (
                    <text x={cx(i)} y={y(totals[i]) - 4} className="dl" textAnchor="middle">{nf(totals[i])}</text>
                  )}
                  {(i % every === 0 || (every > 1 && i === n - 1 && (n - 1) % every >= 2)) && (
                    <text x={cx(i)} y={H - 6} className="tk" textAnchor="middle">{b.label}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Line chart, several series, gaps where a bucket has nothing to say ───────
export function Lines({ labels, series, unit = '', max, onTip, clearTip, height = 200 }: {
  labels: { label: string; full: string }[]; series: Series[]; unit?: string; max?: number;
  onTip: TipFn; clearTip: () => void; height?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = height, M = { l: 34, r: 10, t: 14, b: 22 };
  const all = series.flatMap((sr) => sr.points.filter((v): v is number => v !== null));
  const { top, ticks } = max !== undefined ? { top: max, ticks: [0, max / 4, max / 2, (max * 3) / 4, max] } : niceScale(Math.max(0, ...all), 3);
  const n = Math.max(1, labels.length);
  const bw = Math.max(0, W - M.l - M.r) / n;
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const cx = (i: number) => M.l + (i + 0.5) * bw;
  const every = n > 14 ? Math.ceil(n / 8) : 1;
  const path = (pts: (number | null)[]) => {
    let d = '', pen = false;
    pts.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${cx(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    return d;
  };
  const fmt = (v: number) => `${nf(Math.round(v))}${unit}`;
  return (
    <div className="pb-chart">
      <div className="pb-legend">
        {series.map((sr) => <span key={sr.key}><i className="sw line" style={{ background: sr.color }} />{sr.label}</span>)}
      </div>
      <div className="pb-plot" ref={ref} style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} role="img" aria-label={series.map((sr) => sr.label).join(', ')}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'ax' : 'gr'} />
                <text x={M.l - 6} y={y(t)} className="tk" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
              </g>
            ))}
            {labels.map((l, i) => (
              <g key={i}>
                <rect x={cx(i) - bw / 2} y={M.t} width={bw} height={H - M.t - M.b} fill="transparent"
                  onMouseMove={(e) => onTip(e, `${l.full} · ${series.map((sr) => `${sr.label} ${sr.points[i] === null ? '—' : fmt(sr.points[i]!)}`).join(', ')}`)}
                  onMouseLeave={clearTip} />
                {(i % every === 0 || (every > 1 && i === n - 1 && (n - 1) % every >= 2)) && (
                  <text x={cx(i)} y={H - 6} className="tk" textAnchor="middle">{l.label}</text>
                )}
              </g>
            ))}
            {series.map((sr) => <path key={sr.key} d={path(sr.points)} fill="none" stroke={sr.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
            {n <= 14 && series.map((sr) => sr.points.map((v, i) => v === null ? null : (
              <circle key={`${sr.key}${i}`} cx={cx(i)} cy={y(v)} r={3} fill="#fff" stroke={sr.color} strokeWidth={2} />
            )))}
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Heatmap (weekday × hour) ─────────────────────────────────────────────────
export function Heatmap({ rows, cols, cells, color, onTip, clearTip }: {
  rows: string[]; cols: string[]; cells: number[][]; color: string; onTip: TipFn; clearTip: () => void;
}) {
  const max = Math.max(1, ...cells.flat());
  return (
    <div className="pb-heat" style={{ gridTemplateColumns: `36px repeat(${cols.length}, minmax(0, 1fr))` }}>
      <span />
      {cols.map((c, i) => <span key={c} className="ch">{i % 3 === 0 ? c : ''}</span>)}
      {rows.map((r, ri) => (
        <Fragment key={r}>
          <span className="rh">{r}</span>
          {cells[ri].map((v, ci) => (
            <span key={ci} className="cell" style={{ background: color, opacity: v ? 0.12 + 0.88 * (v / max) : 0.04 }}
              onMouseMove={(e) => onTip(e, `${r} ${cols[ci]}:00 · ${v} ${v === 1 ? 'application' : 'applications'}`)} onMouseLeave={clearTip} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

// ── 100% split bars, one row per category (pass / fail / timeout per check) ─
export function SplitBars({ rows, selected, onSelect, onTip, clearTip }: {
  rows: { key: string; label: string; parts: { key: string; label: string; n: number; color: string }[] }[];
  selected?: string | null; onSelect?: (key: string | null) => void; onTip: TipFn; clearTip: () => void;
}) {
  const legend = rows[0]?.parts ?? [];
  return (
    <div className="pb-split">
      {rows.map((r) => {
        const total = r.parts.reduce((a, p) => a + p.n, 0) || 1;
        const on = selected === r.key, dim = selected != null && !on;
        return (
          <button key={r.key} className={`row${on ? ' on' : ''}${dim ? ' dim' : ''}${onSelect ? '' : ' static'}`}
            onClick={onSelect ? () => onSelect(on ? null : r.key) : undefined} aria-pressed={onSelect ? on : undefined}>
            <span className="nm">{r.label}</span>
            <span className="bar">
              {r.parts.map((p) => p.n > 0 && (
                <i key={p.key} style={{ flexGrow: p.n, background: p.color }}
                  onMouseMove={(e) => onTip(e, `${r.label} · ${p.label}: ${p.n} (${Math.round((p.n / total) * 100)}%)`)} onMouseLeave={clearTip}>
                  {p.n / total >= 0.14 ? `${Math.round((p.n / total) * 100)}%` : ''}
                </i>
              ))}
            </span>
            <span className="n">{nf(total)}</span>
          </button>
        );
      })}
      <div className="pb-legend">
        {legend.map((p) => <span key={p.key}><i className="sw" style={{ background: p.color }} />{p.label}</span>)}
      </div>
    </div>
  );
}

// ── Sankey ───────────────────────────────────────────────────────────────────
function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number): string {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xm},${y1 + h1} ${xm},${y0 + h0} ${x0},${y0 + h0} Z`;
}

const STAGE = ['Intake', 'Verification', 'Outcome', 'Failing check'];

/**
 * The flow diagram. Ribbon thickness is one pixel-per-case throughout, so widths
 * stay comparable across stages instead of each column normalising to its own
 * total — the whole point of the visual is that you can see where volume goes.
 *
 * Nodes are real buttons in the tab order: this is the primary way to cross-filter
 * the report, and a mouse-only control would put that out of reach.
 */
export function Sankey({ columns, flows, growKey, onNode, selected, onTip, clearTip }: {
  columns: SkNode[][]; flows: SkFlow[]; growKey: string;
  onNode: (colIndex: number, key: string) => void;
  selected: { col: number; key: string } | null;
  onTip: TipFn; clearTip: () => void;
}) {
  const [hoverFlow, setHoverFlow] = useState<number | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  const geo = useMemo(() => {
    const W = 1180, H = 300, NW = 12, GAP = 24, PAD = 10;
    const total = columns[0]?.reduce((a, b) => a + b.n, 0) || 1;
    const nCols = columns.length;
    const maxNodes = Math.max(...columns.map((c) => c.length), 1);
    const unit = (H - PAD * 2 - GAP * (maxNodes - 1)) / total;
    const colX = (i: number) => (nCols === 1 ? 0 : (i / (nCols - 1)) * (W - NW));
    type Box = SkNode & { x: number; y: number; h: number; ci: number; id: string };
    const pos: Record<string, Box> = {};
    const laid: Box[][] = [];
    columns.forEach((col, ci) => {
      const colH = col.reduce((s, nd) => s + nd.n * unit, 0) + GAP * Math.max(0, col.length - 1);
      let y: number;
      if (ci === 0) y = PAD + (H - PAD * 2 - colH) / 2;
      else {
        // A column fed by exactly one node lines up with it; otherwise centre.
        const srcs = new Set(flows.filter((f) => f.path.length > ci).map((f) => f.path[ci - 1]));
        const only = srcs.size === 1 ? pos[`${ci - 1}:${[...srcs][0]}`] : undefined;
        y = only ? only.y : PAD + (H - PAD * 2 - colH) / 2;
      }
      laid.push(col.map((nd) => {
        const h = nd.n * unit;
        const b: Box = { ...nd, ci, x: colX(ci), y, h, id: `${ci}:${nd.key}` };
        pos[b.id] = b; y += h + GAP; return b;
      }));
    });
    const order = columns.map((col) => Object.fromEntries(col.map((nd, i) => [nd.key, i])));
    const sorted = flows.map((f, i) => ({ ...f, fi: i })).sort((a, b) => {
      for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
        const d = (order[i]?.[a.path[i]] ?? 9) - (order[i]?.[b.path[i]] ?? 9);
        if (d) return d;
      }
      return 0;
    });
    const outC: Record<string, number> = {}, inC: Record<string, number> = {};
    const segs: { d: string; sc: string; tc: string; tip: string; fi: number; ids: string[] }[] = [];
    sorted.forEach((f) => {
      const ids = f.path.map((k, ci) => `${ci}:${k}`);
      for (let ci = 0; ci < f.path.length - 1; ci++) {
        const src = pos[`${ci}:${f.path[ci]}`], tgt = pos[`${ci + 1}:${f.path[ci + 1]}`];
        if (!src || !tgt) continue;
        const h = f.n * unit;
        const y0 = src.y + (outC[src.id] ?? 0), y1 = tgt.y + (inC[tgt.id] ?? 0);
        outC[src.id] = (outC[src.id] ?? 0) + h; inC[tgt.id] = (inC[tgt.id] ?? 0) + h;
        segs.push({
          d: ribbon(src.x + NW, y0 + 0.4, Math.max(1, h - 0.8), tgt.x, y1 + 0.4, Math.max(1, h - 0.8)),
          sc: src.color, tc: tgt.color, tip: `${src.label} → ${tgt.label}: ${f.n}`, fi: f.fi, ids,
        });
      }
    });
    return { W, H, NW, GUT: 148, nCols, colX, nodes: laid.flat(), segs };
  }, [columns, flows]);

  const selId = selected ? `${selected.col}:${selected.key}` : null;
  const anyHover = hoverFlow !== null || hoverNode !== null;

  return (
    <svg viewBox={`${-geo.GUT} -28 ${geo.W + geo.GUT * 2} ${geo.H + 36}`} className="pb-sk" role="img"
      aria-label="Account opening flow, intake through verification to outcome"
      onMouseLeave={() => { setHoverFlow(null); setHoverNode(null); clearTip(); }}>
      <defs>
        {geo.segs.map((s, i) => (
          <linearGradient key={i} id={`pbsk${i}`}><stop offset="0" stopColor={s.sc} /><stop offset="1" stopColor={s.tc} /></linearGradient>
        ))}
      </defs>
      {columns.map((_, ci) => (
        <text key={ci} x={geo.colX(ci) + geo.NW / 2} y={-14} className="stage"
          textAnchor={ci === 0 ? 'start' : ci === geo.nCols - 1 ? 'end' : 'middle'}>{STAGE[ci]}</text>
      ))}
      <g className="ribs" key={growKey}>
        {geo.segs.map((s, i) => {
          const traced = (hoverFlow !== null && s.fi === hoverFlow) || (hoverNode !== null && s.ids.includes(hoverNode));
          const offSel = selId !== null && !s.ids.includes(selId);
          const hi = traced && !offSel;
          return (
            <path key={i} d={s.d} fill={`url(#pbsk${i})`} className={`rb${hi ? ' hi' : ''}${offSel || (anyHover && !traced) ? ' dim' : ''}`}
              onMouseEnter={() => setHoverFlow(s.fi)} onMouseMove={(e) => onTip(e, s.tip)}
              onMouseLeave={() => { setHoverFlow(null); clearTip(); }} />
          );
        })}
      </g>
      {geo.nodes.map((nd) => (
        <rect key={nd.id} x={nd.x} y={nd.y} width={geo.NW} height={nd.h} rx={1.5} fill={nd.color}
          className={`nd${selId === nd.id ? ' sel' : ''}${selId && selId !== nd.id && selected!.col === nd.ci ? ' ndim' : ''}`}
          tabIndex={0} role="button" aria-pressed={selId === nd.id}
          aria-label={`${nd.label}, ${nd.n} cases. Filter the report by this.`}
          onMouseEnter={() => setHoverNode(nd.id)} onMouseLeave={() => setHoverNode(null)}
          onFocus={() => setHoverNode(nd.id)} onBlur={() => setHoverNode(null)}
          onClick={() => onNode(nd.ci, nd.key)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNode(nd.ci, nd.key); } }} />
      ))}
      {geo.nodes.map((nd) => {
        const mid = nd.y + nd.h / 2;
        if (nd.ci === 0) {
          return <text key={`l${nd.id}`} x={-12} y={mid} textAnchor="end" dominantBaseline="middle" className="lb">
            <tspan className="n">{nd.n}</tspan><tspan dx={7} className="l">{nd.label}</tspan></text>;
        }
        if (nd.ci === geo.nCols - 1) {
          return <text key={`r${nd.id}`} x={geo.W + 12} y={mid} textAnchor="start" dominantBaseline="middle" className="lb">
            <tspan className="l">{nd.label}</tspan><tspan dx={7} className="n">{nd.n}</tspan></text>;
        }
        return <text key={`m${nd.id}`} x={nd.x + geo.NW / 2} y={nd.y - 8} textAnchor="middle" className="lb mid">
          <tspan className="n">{nd.n}</tspan><tspan dx={6} className="l">{nd.label}</tspan></text>;
      })}
    </svg>
  );
}
