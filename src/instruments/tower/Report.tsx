// ─────────────────────────────────────────────────────────────────────────────
// Control tower (/tower) — account opening, as a Power BI report on Fabric.
//
// Brought over whole from the Microsoft sibling: the Power BI / Fabric chrome
// is the point of the surface. What differs here is the source — this app's
// own case store, mirrored to Data Fabric, rather than Dataverse — and the
// lineage strip at the top names it so. It also says plainly that the figures
// themselves are demo data computed in the browser rather than a live Fabric
// refresh.
//
// Structure mirrors a real report: one filter selection sits above three pages,
// so clicking a Sankey node on Flow narrows the KPIs on Overview. The measures
// all come from metrics.ts; nothing is computed in a visual.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { store, type OnboardingCase } from '../../onboarding';
import { useConfig } from '../../config';
import { runStory } from '../../demo/story';
import { InstrumentProvider } from '../shell';
import { useBrandVars } from '../brand';
import '../instruments.css';
import './tower.css';
import {
  BRAND, BRAND_2, CHANNEL_LABEL, NO_FILTERS, OUTCOMES, OUTCOME_LABEL, RANGES, SIG, checkLabel, computeTower, filterCount, mins,
  type Filters, type RangeId, type TowerModel,
} from './metrics';
import {
  ActionBar, FilterChips, FilterPane, Icon, Lineage, NavRail, PageTabs, SuiteBar, Visual, WorkspaceHeader,
  type LineageStage,
} from './chrome';
import { PAGES, type PageId } from './pages';
import { syntheticHistory } from './history';
import { Bars, Columns, Combo, Funnel, Gauge, Heatmap, KpiCard, Lines, Sankey, SplitBars, Stacked, StackedColumns } from './visuals';

/** How often the window slides forward on its own. The store only notifies on
 *  writes, so without this a report left open keeps measuring a frozen window
 *  and quietly drifts out of date. */
const TICK_MS = 30_000;

interface Tip { x: number; y: number; text: string }

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

/** Defaults for tenants saved before `operations` existed. Memoised because a
 *  fresh object literal every render would rebuild the whole model each pass. */
const OPS_FALLBACK = { stpTarget: 80, slaMinutes: 240, retryBackoffMins: [5, 15, 30, 60], routing: [] };

function TowerInner() {
  useBrandVars('Control Tower');
  const cfgAll = useConfig();
  const ops = cfgAll.operations ?? OPS_FALLBACK;
  const workspace = cfgAll.branding.appName;

  const [range, setRange] = useState<RangeId>('48h');
  const [page, setPage] = useState<PageId>('overview');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [paneOpen, setPaneOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [tip, setTip] = useState<Tip | null>(null);
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  // ── Store subscription + the clock ────────────────────────────────────────
  const aliveRef = useRef(true);
  const load = useCallback(() => {
    void store.list().then((all) => {
      if (!aliveRef.current) return;
      setCases(all);
      setNow(Date.now());
      setRefreshedAt(Date.now());
    });
  }, []);
  useEffect(() => {
    aliveRef.current = true;
    load();
    const un = store.subscribe(load);
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => { aliveRef.current = false; un(); window.clearInterval(t); };
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
    // A beat of visible work: an instant refresh reads as a no-op.
    window.setTimeout(() => { if (aliveRef.current) setRefreshing(false); }, 550);
  };

  // ── The demo's own case, driven through the store ─────────────────────────
  const [sim, setSim] = useState<{ i: number; total: number; label: string } | null>(null);
  const simBusy = sim !== null && sim.i < sim.total;
  const cancelSim = useRef<(() => void) | null>(null);
  const simClear = useRef<number | null>(null);
  const playSim = () => {
    cancelSim.current?.();
    if (simClear.current) window.clearTimeout(simClear.current);
    setSim({ i: 0, total: 6, label: 'Starting…' });
    cancelSim.current = runStory((t) => {
      setSim({ i: t.i, total: t.total, label: t.label });
      if (t.done) simClear.current = window.setTimeout(() => setSim(null), 3200);
    });
  };
  useEffect(() => () => {
    cancelSim.current?.();
    if (simClear.current) window.clearTimeout(simClear.current);
  }, []);

  // ── Model ─────────────────────────────────────────────────────────────────
  const rangeCfg = RANGES.find((r) => r.id === range)!;
  // The real rows sit on top of a deterministic sixty-day backfill, so the
  // longer ranges and their prior-period comparisons have a month to draw.
  const history = useMemo(() => syntheticHistory(now), [now]);
  const m = useMemo(
    () => computeTower([...cases, ...history], now, rangeCfg, filters, ops),
    [cases, history, now, rangeCfg, filters, ops],
  );

  const setFilter = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
  }, []);
  const clearAll = useCallback(() => setFilters(NO_FILTERS), []);
  const toggle = useCallback(<K extends keyof Filters>(k: K, v: NonNullable<Filters[K]>) => {
    setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v } as Filters));
  }, []);

  /** Sankey columns map onto filter facets positionally — intake, verification,
   *  outcome, failing check — so a click anywhere in the diagram filters. */
  const onSankeyNode = useCallback((col: number, key: string) => {
    const facet = (['channel', 'verification', 'outcome', 'check'] as const)[col];
    if (!facet) return;
    toggle(facet, key as never);
  }, [toggle]);
  const sankeySelected = useMemo(() => {
    if (filters.channel) return { col: 0, key: filters.channel };
    if (filters.verification) return { col: 1, key: filters.verification };
    if (filters.outcome) return { col: 2, key: filters.outcome };
    if (filters.check) return { col: 3, key: filters.check };
    return null;
  }, [filters]);

  const onTip = useCallback((e: React.MouseEvent, text: string) => {
    setTip({ x: e.clientX, y: e.clientY, text });
  }, []);
  const clearTip = useCallback(() => setTip(null), []);

  const lineage: LineageStage[] = [
    // This project's system of record: the app's case store, shared through the
    // Data Fabric entity AOFCase (see onboarding/caseFabric.ts).
    { key: 'src', icon: 'db', name: 'Case store', kind: 'Source', detail: 'AOFCase · Data Fabric' },
    { key: 'lake', icon: 'lake', name: 'OneLake', kind: 'Lakehouse shortcut', detail: `${m.windowTotal.toLocaleString()} rows` },
    { key: 'model', icon: 'model', name: 'Account Opening', kind: 'Semantic model', detail: `${m.kpis.length + 6} measures` },
    { key: 'report', icon: 'report', name: 'Control Tower', kind: 'Report', detail: `${PAGES.length} pages` },
  ];

  const empty = m.windowTotal === 0;
  const filteredOut = !empty && m.total === 0;

  return (
    <div className="inst pb" onMouseLeave={clearTip}>
      {/* No app top bar here, on purpose: this surface presents as the Power BI
          service, and the Fabric suite bar is its top edge. The way back is the
          fixed Launcher button every surface keeps in the corner. */}
      <SuiteBar workspace={workspace} />

      <div className="pb-shell">
        <NavRail workspace={workspace} open={railOpen} onToggle={() => setRailOpen((o) => !o)} />

        <div className="pb-main">
          <WorkspaceHeader workspace={workspace} report="Control Tower" rows={m.total}
            refreshedAgo={ago(now - refreshedAt)} />
          <ActionBar
            ranges={RANGES} range={range} onRange={setRange}
            onRefresh={refresh} refreshing={refreshing}
            paneOpen={paneOpen} onTogglePane={() => setPaneOpen((p) => !p)}
            activeFilters={filterCount(filters)}
            onSimulate={playSim} simBusy={simBusy}
            simLabel={sim ? `${sim.i}/${sim.total} · ${sim.label}` : null}
          />
          <Lineage stages={lineage} />

          <div className="pb-body">
            {/* The grey report canvas, with the page floating on it as a sheet. */}
            <div className="pb-canvas">
              <div className="pb-sheet">
                <FilterChips
                  filters={filters}
                  onClear={(k) => setFilter(k, null as never)}
                  onClearAll={clearAll}
                />
                {empty ? (
                  <div className="pb-empty">
                    <b>No data in this window</b>
                    <span>Nothing arrived in the last {rangeCfg.label.toLowerCase()}. Widen the range, or simulate an application.</span>
                  </div>
                ) : filteredOut ? (
                  <div className="pb-empty">
                    <b>No rows match these filters</b>
                    <span>{m.windowTotal} applications are in the window, but none survive the current selection.</span>
                    <button className="pb-cmd-b on" onClick={clearAll}>Clear all filters</button>
                  </div>
                ) : page === 'overview' ? (
                  <Overview m={m} stpTarget={ops.stpTarget} period={rangeCfg.label.toLowerCase()} filters={filters} toggle={toggle} onTip={onTip} clearTip={clearTip} />
                ) : page === 'exceptions' ? (
                  <Exceptions m={m} filters={filters} toggle={toggle} onTip={onTip} clearTip={clearTip} />
                ) : page === 'flow' ? (
                  <Flow m={m} range={range} onNode={onSankeyNode} selected={sankeySelected} onTip={onTip} clearTip={clearTip} />
                ) : page === 'channels' ? (
                  <Channels m={m} filters={filters} toggle={toggle} onTip={onTip} clearTip={clearTip} />
                ) : page === 'verification' ? (
                  <Verification m={m} filters={filters} toggle={toggle} onTip={onTip} clearTip={clearTip} />
                ) : (
                  <Timing m={m} filters={filters} toggle={toggle} onTip={onTip} clearTip={clearTip} />
                )}
              </div>
            </div>

            {paneOpen && (
              <FilterPane
                model={m} filters={filters} set={setFilter}
                onClose={() => setPaneOpen(false)} onClearAll={clearAll}
              />
            )}
          </div>

          <PageTabs page={page} onPage={setPage} counts={{ exceptions: m.exceptions + m.sla.breached }} />
        </div>
      </div>

      {tip && <div className="pb-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}

// ── Page: Overview ───────────────────────────────────────────────────────────
type ToggleFn = <K extends keyof Filters>(k: K, v: NonNullable<Filters[K]>) => void;
interface PageProps {
  m: TowerModel; filters: Filters; toggle: ToggleFn;
  onTip: (e: React.MouseEvent, t: string) => void; clearTip: () => void;
}

function Overview({ m, stpTarget, period, filters, toggle, onTip, clearTip }: PageProps & { stpTarget: number; period: string }) {
  const stp = m.kpis.find((k) => k.key === 'stp')!;
  return (
    <div className="pb-page ov">
      <div className="pb-kpis">
        {m.kpis.map((k) => (
          <KpiCard key={k.key} k={k} period={period}
            target={k.key === 'stp' ? { value: stpTarget, label: `${stpTarget}% goal` } : undefined}
            onClick={k.key === 'exceptions' ? () => toggle('verification', 'flagged') : undefined}
            active={k.key === 'exceptions' && filters.verification === 'flagged'}
          />
        ))}
      </div>

      <Visual className="a" title="Applications received"
        subtitle={<>{m.total} in scope · peak {m.buckets[m.peakIndex]?.arrived ?? 0} at {m.buckets[m.peakIndex]?.full}</>}
        table={{ cols: ['Bucket', 'Arrived', 'Opened'], rows: m.buckets.map((b) => [b.full, b.arrived, b.opened]) }}>
        <Combo buckets={m.buckets} onTip={onTip} clearTip={clearTip} />
      </Visual>

      <Visual className="b" title="Straight-through rate"
        subtitle={<>{m.clean} of {m.settled} settled with no human touch</>}>
        <Gauge pct={m.stp} target={stpTarget} caption="Straight-through"
          sub={stp.prev === 0 ? undefined : stp.delta === 0 ? 'flat vs prior period' : `${stp.delta > 0 ? '+' : ''}${stp.delta} pts vs prior period`} />
        <div className="pb-mini">
          <div><b>{m.hoursReturned}h</b><span>handling time returned</span></div>
          <div><b>{m.avgOpenMins === null ? '—' : mins(m.avgOpenMins)}</b><span>average time to open</span></div>
        </div>
      </Visual>

      <Visual className="c" title="Where every application sits"
        subtitle={`${m.total} applications`}
        table={{ cols: ['Status', 'Cases', 'Share'], rows: m.mix.map((s) => [s.label, s.n, `${s.pct}%`]) }}>
        <Stacked slices={m.mix} onTip={onTip} clearTip={clearTip} />
      </Visual>

      <Visual className="d" title="How work arrives"
        subtitle="Click a channel to filter the report"
        table={{ cols: ['Channel', 'Cases', 'Share'], rows: m.channels.map((c) => [c.label, c.n, `${c.pct}%`]) }}>
        <Bars items={m.channels} selected={filters.channel}
          onSelect={(k) => toggle('channel', (k ?? filters.channel!) as never)} />
      </Visual>

      <Visual className="e" title="Reach by stage"
        subtitle={<>{m.funnel[0].n} arrived → {m.activated} activated · {m.activatedPct}% through</>}
        table={{ cols: ['Stage', 'Cases', '% of intake', 'Dropped'], rows: m.funnel.map((f) => [f.label, f.n, `${f.pct}%`, f.drop]) }}>
        <Funnel steps={m.funnel} />
      </Visual>

      <Visual className="f" title="Upstream systems" subtitle="Health inferred from live cases"
        table={{ cols: ['System', 'Signal', 'Cases'], rows: m.upstream.map((u) => [u.name, u.note, u.failures]) }}>
        <div className="pb-svc">
          {m.upstream.map((u) => (
            <div className="row" key={u.name}>
              <span className={`dot ${u.sig}`} />
              <span className="nm">{u.name}</span>
              <span className="st">{u.note}</span>
            </div>
          ))}
        </div>
      </Visual>
    </div>
  );
}

// ── Page: Exceptions & SLA ───────────────────────────────────────────────────
function Exceptions({ m, filters, toggle, onTip, clearTip }: PageProps) {
  const { sla } = m;
  const queueMax = Math.max(1, ...m.queues.map((q) => q.n));
  return (
    <div className="pb-page ex">
      <div className="pb-kpis four">
        <SmallStat label="Open work" value={sla.openWork} note="waiting on a person" />
        <SmallStat label="Breached SLA" value={sla.breached} note={`past ${mins(sla.slaMinutes)}`} tone={sla.breached ? 'bad' : 'ok'} />
        <SmallStat label="At risk" value={sla.atRisk} note="within the last quarter of SLA" tone={sla.atRisk ? 'warn' : 'ok'} />
        <SmallStat label="Oldest item" value={sla.worstMins} note="since arrival" format={mins} tone={sla.worstMins > sla.slaMinutes ? 'bad' : 'ok'} />
      </div>

      <Visual className="a" title="Why work stops"
        subtitle="Click a check to filter the report"
        table={{ cols: ['Check', 'Cases', '% of intake'], rows: m.causes.map((c) => [c.label, c.n, `${c.pct}%`]) }}>
        <Bars
          items={m.causes.map((c) => ({ key: c.key, label: c.label, n: c.n, pct: c.pct, color: BRAND }))}
          selected={filters.check}
          onSelect={(k) => toggle('check', (k ?? filters.check!) as never)}
        />
      </Visual>

      <Visual className="b" title="Against SLA"
        subtitle={<>Target {mins(sla.slaMinutes)} · {sla.openWork} items open</>}
        table={{ cols: ['Band', 'Items'], rows: sla.buckets.map((b) => [b.label, b.n]) }}>
        {sla.buckets.length
          ? <Stacked slices={sla.buckets.map((b) => ({ key: b.key, label: b.label, n: b.n, color: b.color, pct: Math.round((b.n / Math.max(1, sla.openWork)) * 100) }))} onTip={onTip} clearTip={clearTip} />
          : <div className="pb-none">Nothing is waiting on a person.</div>}
      </Visual>

      <Visual className="c" title="Queue load"
        subtitle="Routing rules from the tenant's operations config"
        table={{ cols: ['Queue', 'Cause', 'Owner', 'Items'], rows: m.queues.map((q) => [q.queue, q.cause, q.assignTo || 'unassigned', q.n]) }}>
        {m.queues.length ? (
          <table className="pb-grid">
            <thead>
              <tr><th>Queue</th><th>Cause</th><th>Owner</th><th className="num">Items</th><th className="bar" aria-hidden /></tr>
            </thead>
            <tbody>
              {m.queues.map((q) => (
                <tr key={`${q.queue}-${q.cause}`} className={q.n ? '' : 'zero'}>
                  <td><b>{q.queue}</b></td>
                  <td>{q.cause}</td>
                  <td>{q.assignTo || 'unassigned'}</td>
                  <td className="num">{q.n}</td>
                  <td className="bar"><i style={{ width: `${(q.n / queueMax) * 100}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="pb-none">No routing rules configured.</div>}
      </Visual>

      <Visual className="d" title="Aging"
        subtitle="How long open work has been waiting"
        table={{ cols: ['Age', 'Items'], rows: m.aging.map((a) => [a.label, a.n]) }}>
        <Columns items={m.aging.map((a, i) => ({ label: a.label, n: a.n, late: i >= 2 }))} height={150} />
      </Visual>

      <Visual className="e" title="Needs attention"
        subtitle={`${m.openItems} open`}
        table={{ cols: ['Item', 'Detail'], rows: m.attn.map((a) => [a.title, a.sub]) }}>
        <div className="pb-attn">
          {m.attn.length ? m.attn.map((a, i) => (
            <button key={i} className={`it${a.check && filters.check === a.check ? ' on' : ''}${a.check ? ' click' : ''}`}
              onClick={a.check ? () => toggle('check', a.check!) : undefined} disabled={!a.check}>
              <span className={`ic ${a.sig}`}><Icon n={a.icon} s={15} /></span>
              <span className="tx"><b>{a.title}</b><em>{a.sub}</em></span>
              {a.check && <span className="go"><Icon n="chevron" s={13} /></span>}
            </button>
          )) : <div className="pb-none">All clear — nothing waiting on a person.</div>}
        </div>
      </Visual>
    </div>
  );
}

function SmallStat({ label, value, note, tone = 'ok', format }: {
  label: string; value: number; note: string; tone?: 'ok' | 'warn' | 'bad'; format?: (n: number) => string;
}) {
  return (
    <div className={`pb-small ${tone}`}>
      <div className="lb">{label}</div>
      <div className="v">{format ? format(value) : value.toLocaleString()}</div>
      <div className="nt">{note}</div>
    </div>
  );
}

// ── Page: Flow ───────────────────────────────────────────────────────────────
function Flow({ m, range, onNode, selected, onTip, clearTip }: {
  m: TowerModel; range: string;
  onNode: (col: number, key: string) => void;
  selected: { col: number; key: string } | null;
  onTip: (e: React.MouseEvent, t: string) => void; clearTip: () => void;
}) {
  const rows = m.sankey.flows
    .slice()
    .sort((a, b) => b.n - a.n)
    .map((f) => [
      CHANNEL_LABEL[f.path[0] as keyof typeof CHANNEL_LABEL] ?? f.path[0],
      f.path[1] === 'cleared' ? 'Cleared' : 'Flagged',
      OUTCOME_LABEL[f.path[2] as keyof typeof OUTCOME_LABEL] ?? f.path[2],
      f.path[3] ? checkLabel[f.path[3] as keyof typeof checkLabel] ?? f.path[3] : '—',
      f.n,
    ]);
  return (
    <div className="pb-page fl">
      <Visual className="a" title="Account opening flow"
        subtitle={<>{m.total} applications · {m.clearedPct}% cleared checks, {m.flagged} flagged · click a node to filter</>}
        table={{ cols: ['Intake', 'Verification', 'Outcome', 'Failing check', 'Cases'], rows }}>
        {m.sankey.columns.length ? (
          <Sankey columns={m.sankey.columns} flows={m.sankey.flows} growKey={`${range}-${selected?.key ?? 'all'}`}
            onNode={onNode} selected={selected} onTip={onTip} clearTip={clearTip} />
        ) : <div className="pb-none">Nothing to trace in this window.</div>}
      </Visual>

      <Visual className="d" title="Intake" subtitle="By channel"
        table={{ cols: ['Channel', 'Cases'], rows: (m.sankey.columns[0] ?? []).map((nd) => [nd.label, nd.n]) }}>
        <Bars
          items={(m.sankey.columns[0] ?? []).map((nd) => ({ key: nd.key, label: nd.label, n: nd.n, pct: 0, color: nd.color }))}
          selected={selected?.col === 0 ? selected.key : null}
          onSelect={(k) => onNode(0, k ?? (selected?.key ?? ''))}
        />
      </Visual>

      <Visual className="b" title="Outcomes" subtitle={`${m.total} applications`}
        table={{ cols: ['Outcome', 'Cases'], rows: (m.sankey.columns[2] ?? []).map((nd) => [nd.label, nd.n]) }}>
        <Bars
          items={(m.sankey.columns[2] ?? []).map((nd) => ({ key: nd.key, label: nd.label, n: nd.n, pct: 0, color: nd.color }))}
          selected={selected?.col === 2 ? selected.key : null}
          onSelect={(k) => onNode(2, k ?? (selected?.key ?? ''))}
        />
      </Visual>

      <Visual className="c" title="Verification split" subtitle={`${m.clearedPct}% cleared first time`}
        table={{ cols: ['Result', 'Cases'], rows: (m.sankey.columns[1] ?? []).map((nd) => [nd.label, nd.n]) }}>
        <Bars
          items={(m.sankey.columns[1] ?? []).map((nd) => ({ key: nd.key, label: nd.label, n: nd.n, pct: 0, color: nd.color }))}
          selected={selected?.col === 1 ? selected.key : null}
          onSelect={(k) => onNode(1, k ?? (selected?.key ?? ''))}
        />
      </Visual>
    </div>
  );
}

// ── Page: Channels ───────────────────────────────────────────────────────────
function Channels({ m, filters, toggle, onTip, clearTip }: PageProps) {
  const ch = m.channelStats;
  return (
    <div className="pb-page ch">
      <div className={`pb-kpis ${ch.length === 3 ? 'three' : 'four'}`}>
        {ch.map((c) => (
          <div key={c.key} className={`pb-small${filters.channel === c.key ? ' on' : ''}`}>
            <div className="lb"><i style={{ background: c.color }} />{c.label}</div>
            <div className="v">{c.n.toLocaleString()}<em style={{ fontSize: 13, color: 'var(--pb-ink-3)', fontStyle: 'normal', marginLeft: 6 }}>{c.pct}% of intake</em></div>
            <div className="sub">
              <span>Straight-through <b>{c.stp}%</b></span>
              <span>Opened <b>{c.opened.toLocaleString()}</b></span>
              <span>Time to open <b>{c.avgOpenMins === null ? '—' : mins(c.avgOpenMins)}</b></span>
            </div>
          </div>
        ))}
        {!ch.length && <div className="pb-small"><div className="lb">Channels</div><div className="nt">Nothing in this window.</div></div>}
      </div>

      <Visual className="a" title="Intake by channel" subtitle="Arrivals per bucket, stacked by how the application came in"
        table={{ cols: ['Bucket', ...(m.arrivalsByChannel[0]?.parts.map((p) => p.label) ?? [])], rows: m.arrivalsByChannel.map((b) => [b.full, ...b.parts.map((p) => p.n)]) }}>
        <StackedColumns buckets={m.arrivalsByChannel} onTip={onTip} clearTip={clearTip} height={190} />
      </Visual>

      <Visual className="b" title="Straight-through by channel" subtitle="Click a channel to filter the report"
        table={{ cols: ['Channel', 'Straight-through', 'Flagged'], rows: ch.map((c) => [c.label, `${c.stp}%`, c.flagged]) }}>
        <Bars items={ch.map((c) => ({ key: c.key, label: c.label, n: c.stp, pct: c.stp, color: c.color }))}
          selected={filters.channel} onSelect={(k) => toggle('channel', (k ?? filters.channel!) as never)} unit="% straight-through" />
      </Visual>

      <Visual className="c" title="Channel × outcome" subtitle="Where each channel's applications ended up"
        table={{ cols: ['Channel', ...OUTCOMES.map((o) => OUTCOME_LABEL[o])], rows: m.channelOutcome.map((r) => [r.label, ...r.cells]) }}>
        <ChannelMatrix rows={m.channelOutcome} />
      </Visual>

      <Visual className="d" title="Top employers" subtitle="Bulk payroll batches by employer"
        table={{ cols: ['Employer', 'Applications', 'Opened'], rows: m.employers.map((e) => [e.name, e.n, e.opened]) }}>
        {m.employers.length
          ? <Bars items={m.employers.map((e) => ({ key: e.name, label: e.name, n: e.n, pct: 0, color: BRAND_2 }))} />
          : <div className="pb-none">No bulk payroll batches in this window.</div>}
      </Visual>
    </div>
  );
}

function ChannelMatrix({ rows }: { rows: TowerModel['channelOutcome'] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.cells));
  if (!rows.length) return <div className="pb-none">Nothing in this window.</div>;
  return (
    <table className="pb-grid">
      <thead><tr><th>Channel</th>{OUTCOMES.map((o) => <th key={o} className="right">{OUTCOME_LABEL[o]}</th>)}<th className="right">Total</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td><b>{r.label}</b></td>
            {r.cells.map((v, i) => (
              <td key={i} className="heat">
                <i style={{ background: BRAND, opacity: v ? 0.06 + 0.3 * (v / max) : 0 }} />
                <span>{v ? v.toLocaleString() : '·'}</span>
              </td>
            ))}
            <td className="num">{r.cells.reduce((a, b) => a + b, 0).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page: Verification ───────────────────────────────────────────────────────
function Verification({ m, filters, toggle, onTip, clearTip }: PageProps) {
  const split = m.checkStats.map((c) => ({
    key: c.key, label: c.label,
    parts: [
      { key: 'passed', label: 'Passed', n: c.passed, color: SIG.good },
      { key: 'timeout', label: 'Timed out', n: c.timeout, color: SIG.warn },
      { key: 'failed', label: 'Failed', n: c.failed, color: SIG.bad },
      { key: 'pending', label: 'Still running', n: c.pending, color: '#c8c6c4' },
    ],
  }));
  return (
    <div className="pb-page vf">
      <div className="pb-kpis four">
        <SmallStat label="First-time right" value={m.firstTimeRight} note="checks passed on the first attempt" format={(v) => `${v}%`} tone={m.firstTimeRight >= 90 ? 'ok' : 'warn'} />
        <SmallStat label="Failures" value={m.totalFailures} note="checks that failed outright" tone={m.totalFailures ? 'bad' : 'ok'} />
        <SmallStat label="Timeouts" value={m.totalTimeouts} note="gateway did not answer in time" tone={m.totalTimeouts ? 'warn' : 'ok'} />
        <SmallStat label="Retries" value={m.totalRetries} note="checks that needed a second attempt" />
      </div>

      <Visual className="a" title="Result by check" subtitle="Click a check to filter the report to its failures"
        table={{ cols: ['Check', 'Passed', 'Timed out', 'Failed', 'Running'], rows: m.checkStats.map((c) => [c.label, c.passed, c.timeout, c.failed, c.pending]) }}>
        <SplitBars rows={split} selected={filters.check} onSelect={(k) => toggle('check', (k ?? filters.check!) as never)} onTip={onTip} clearTip={clearTip} />
      </Visual>

      <Visual className="b" title="Failures over time" subtitle="Failed checks per bucket, by check"
        table={{ cols: ['Bucket', ...(m.failuresByBucket[0]?.parts.map((p) => p.label) ?? [])], rows: m.failuresByBucket.map((b) => [b.full, ...b.parts.map((p) => p.n)]) }}>
        <StackedColumns buckets={m.failuresByBucket} onTip={onTip} clearTip={clearTip} height={176} />
      </Visual>

      <Visual className="c" title="Cleared first time" subtitle="Applications with no failed or timed-out check, and checks passed at the first attempt"
        table={{ cols: ['Bucket', ...m.clearedTrend.map((sr) => sr.label)], rows: m.bucketLabels.map((l, i) => [l.full, ...m.clearedTrend.map((sr) => sr.points[i] === null ? '—' : `${sr.points[i]}%`)]) }}>
        <Lines labels={m.bucketLabels} series={m.clearedTrend} unit="%" max={100} onTip={onTip} clearTip={clearTip} height={150} />
      </Visual>

      <Visual className="d" title="Attempts" subtitle="How many tries a check took"
        table={{ cols: ['Attempts', 'Checks'], rows: m.attempts.map((a) => [a.label, a.n]) }}>
        <Columns items={m.attempts.map((a, i) => ({ label: a.label, n: a.n, late: i === 2 }))} height={160} />
      </Visual>
    </div>
  );
}

// ── Page: Timing ─────────────────────────────────────────────────────────────
function Timing({ m, onTip, clearTip }: PageProps) {
  const fastest = [...m.channelStats].filter((c) => c.avgOpenMins !== null).sort((a, b) => a.avgOpenMins! - b.avgOpenMins!)[0];
  return (
    <div className="pb-page tm">
      <div className="pb-kpis four">
        <SmallStat label="Median time to open" value={m.medianOpenMins ?? 0} note="from capture to account number" format={(v) => (m.medianOpenMins === null ? '—' : mins(v))} />
        <SmallStat label="90th percentile" value={m.p90OpenMins ?? 0} note="nine in ten opened within" format={(v) => (m.p90OpenMins === null ? '—' : mins(v))} tone={m.p90OpenMins !== null && m.p90OpenMins > 240 ? 'warn' : 'ok'} />
        <SmallStat label="Average" value={m.avgOpenMins ?? 0} note="mean time to open" format={(v) => (m.avgOpenMins === null ? '—' : mins(v))} />
        <div className="pb-small">
          <div className="lb">Fastest channel</div>
          <div className="v">{fastest ? fastest.label : '—'}</div>
          <div className="nt">{fastest ? `${mins(fastest.avgOpenMins!)} on average` : 'nothing opened yet'}</div>
        </div>
      </div>

      <Visual className="a" title="Time to open" subtitle="Distribution across opened applications"
        table={{ cols: ['Band', 'Applications'], rows: m.openHistogram.map((b) => [b.label, b.n]) }}>
        <Columns items={m.openHistogram} height={170} />
      </Visual>

      <Visual className="b" title="Time to open, over time" subtitle="Median and 90th percentile per bucket, in minutes"
        table={{ cols: ['Bucket', 'Median', '90th percentile'], rows: m.bucketLabels.map((l, i) => [l.full, ...m.medianOpenTrend.map((sr) => sr.points[i] === null ? '—' : mins(sr.points[i]!))]) }}>
        <Lines labels={m.bucketLabels} series={m.medianOpenTrend} unit="m" onTip={onTip} clearTip={clearTip} height={170} />
      </Visual>

      <Visual className="c" title="When applications arrive" subtitle="Weekday by hour of day · darker is busier"
        table={{ cols: ['Day', ...m.heat.cols], rows: m.heat.rows.map((r, i) => [r, ...m.heat.cells[i]]) }}>
        <Heatmap rows={m.heat.rows} cols={m.heat.cols} cells={m.heat.cells} color={BRAND} onTip={onTip} clearTip={clearTip} />
      </Visual>

      <Visual className="d" title="Hour of day" subtitle="Arrivals by hour, all days in the window"
        table={{ cols: ['Hour', 'Applications'], rows: m.hourOfDay.map((h, i) => [`${String(i).padStart(2, '0')}:00`, h.n]) }}>
        <Columns items={m.hourOfDay} height={160} />
      </Visual>

      <Visual className="e" title="Cumulative" subtitle="Arrived against opened, running total across the window"
        table={{ cols: ['Bucket', 'Arrived', 'Opened'], rows: m.bucketLabels.map((l, i) => [l.full, ...m.cumulative.map((sr) => sr.points[i] ?? 0)]) }}>
        <Lines labels={m.bucketLabels} series={m.cumulative} onTip={onTip} clearTip={clearTip} height={160} />
      </Visual>
    </div>
  );
}

export default function TowerConsole() {
  return <InstrumentProvider><TowerInner /></InstrumentProvider>;
}
