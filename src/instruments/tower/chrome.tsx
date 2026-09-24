// ─────────────────────────────────────────────────────────────────────────────
// Control tower — the platform chrome.
//
// The frame around the data: a Fabric workspace breadcrumb, a lineage strip
// showing where the numbers came from, the report's page tabs, a filter pane and
// the per-visual header. None of these know anything about account opening; they
// take a model and callbacks and render the surface a Power BI report presents.
//
// The lineage strip is honest about itself — the pill in its corner says the
// numbers are demo data computed in the browser, not a live OneLake refresh.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import type { Channel, ValidationKind } from '../../onboarding';
import {
  CHANNEL_LABEL, CHECKS, OUTCOMES, OUTCOME_LABEL, checkLabel, filterCount,
  type Filters, type OutcomeKey, type RangeCfg, type RangeId, type TowerModel, type VerificationKey,
} from './metrics';
import { PAGES, type PageId } from './pages';

// ── Icons ────────────────────────────────────────────────────────────────────
const PATHS: Record<string, string> = {
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5 6l-3 6v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3-6a2 2 0 0 0-2-1H7a2 2 0 0 0-2 1Z',
  check: 'M20 6 9 17l-5-5',
  alert: 'M10.3 3.1 1.8 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3L12.7 3.1a2 2 0 0 0-2.4 0Z M12 9v4 M12 17h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5 18 18 M18 6l-2.5 2.5 M8.5 15.5 6 18',
  filter: 'M3 5h18l-7 8v6l-4 2v-8Z',
  table: 'M3 4h18v16H3z M3 10h18 M9 10v10',
  expand: 'M4 9V4h5 M20 15v5h-5 M4 4l6 6 M20 20l-6-6',
  collapse: 'M10 4v5H5 M14 20v-5h5 M4 4l5 5 M20 20l-5-5',
  refresh: 'M21 12a9 9 0 1 1-3-6.7 M21 3v5h-5',
  chevron: 'M9 6l6 6-6 6',
  db: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6',
  lake: 'M2 16c2.5-2 4-2 6 0s3.5 2 6 0 3.5-2 6 0 M3 5h18v11H3z',
  model: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z M12 12l8-4.5 M12 12v9 M12 12 4 7.5',
  report: 'M4 4h16v16H4z M8 16V10 M12 16V7 M16 16v-4',
  close: 'M6 6l12 12 M18 6 6 18',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 11v5 M12 8h.01',
  // Suite bar + nav rail
  waffle: 'M4 4h5v5H4z M10 4h5v5h-5z M16 4h4v5h-4z M4 10h5v5H4z M10 10h5v5h-5z M16 10h4v5h-4z M4 16h5v4H4z M10 16h5v4h-5z M16 16h4v4h-4z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4-4',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10.3 21a2 2 0 0 0 3.4 0',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.8-2.8 2.8 M12 17h.01',
  home: 'M3 10.5 12 3l9 7.5 M5 9.5V20h14V9.5 M10 20v-6h4v6',
  create: 'M12 5v14 M5 12h14',
  browse: 'M4 5h16 M4 12h16 M4 19h10',
  workspaces: 'M4 6a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
  apps: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  // Action bar
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z M14 3v5h5',
  export: 'M12 16V4 M8 8l4-4 4 4 M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  share: 'M18 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z M6 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z M18 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z M8.2 10.8l7.6-3.6 M8.2 13.2l7.6 3.6',
  teams: 'M9 7a3 3 0 1 0 0-.1Z M3 20v-1.5C3 16 5.5 15 9 15s6 1 6 3.5V20 M17 9h5 M19.5 6.5v5 M17 20v-1.5c0-1.2-.5-2.1-1.4-2.7',
  insights: 'M9 21h6 M10 18h4 M12 3a6 6 0 0 0-3.5 10.9c.5.4.8.9.9 1.6h5.2c.1-.7.4-1.2.9-1.6A6 6 0 0 0 12 3Z',
  subscribe: 'M4 6h16v12H4z M4 7l8 6 8-6',
  edit: 'M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17Z M14 6l3 3',
  bookmark: 'M6 3h12v18l-6-4.5L6 21Z',
  view: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  more: 'M6 12h.01 M12 12h.01 M18 12h.01',
};
export function Icon({ n, s = 16 }: { n: string; s?: number }) {
  const d = PATHS[n] ?? PATHS.info;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : `M${seg}`} />)}
    </svg>
  );
}

/** The Fabric mark — a stylised four-facet diamond, drawn rather than shipped
 *  as an asset so nothing has to be fetched and nothing can 404. */
function FabricMark({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2 22 8v8l-10 6L2 16V8Z" fill="#0f6cbd" opacity=".18" />
      <path d="M12 2 22 8l-10 6Z" fill="#0f6cbd" />
      <path d="M12 8 22 8v8Z" fill="#1a9ed9" opacity=".85" />
      <path d="M2 8l10 6v8L2 16Z" fill="#0b4f8a" />
      <path d="M12 14l10-6v8l-10 6Z" fill="#1a9ed9" opacity=".55" />
    </svg>
  );
}

/** The Power BI mark — the three ascending bars in Microsoft's amber, drawn
 *  rather than shipped as an asset so nothing has to be fetched and nothing
 *  can 404. */
function PowerBiMark({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <rect x="15" y="2" width="6" height="20" rx="1.4" fill="#f9e589" />
      <rect x="9" y="6" width="6" height="16" rx="1.4" fill="#f2c811" />
      <rect x="3" y="11" width="6" height="11" rx="1.4" fill="#e8b400" />
    </svg>
  );
}

// ── Report pages ─────────────────────────────────────────────────────────────
export type { PageId } from './pages';

// ── Fabric suite bar ─────────────────────────────────────────────────────────
/**
 * The band across the top of every Fabric workload: waffle, product name,
 * global search, then the account cluster. Everything here is set dressing, so
 * it is rendered inert rather than wired to handlers that do nothing — a dead
 * click is worse than a control that is visibly unavailable.
 */
export function SuiteBar({ workspace }: { workspace: string }) {
  const initials = workspace.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="pb-suite">
      <button className="pb-waffle" aria-label="App launcher" disabled><Icon n="waffle" s={17} /></button>
      <span className="pb-product"><PowerBiMark s={21} /><b>Power BI</b></span>
      <div className="pb-search" aria-hidden>
        <Icon n="search" s={14} /><span>Search</span>
      </div>
      <span className="pb-cmd-grow" />
      <span className="pb-trial">Fabric trial · 46 days left</span>
      <button className="pb-suite-ic" aria-label="Notifications" disabled><Icon n="bell" s={16} /></button>
      <button className="pb-suite-ic" aria-label="Settings" disabled><Icon n="gear" s={16} /></button>
      <button className="pb-suite-ic" aria-label="Help" disabled><Icon n="help" s={16} /></button>
      <span className="pb-avatar" title={workspace}>{initials || 'AO'}</span>
    </div>
  );
}

// ── Left navigation rail ─────────────────────────────────────────────────────
const NAV = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'create', icon: 'create', label: 'Create' },
  { key: 'browse', icon: 'browse', label: 'Browse' },
  { key: 'onelake', icon: 'lake', label: 'OneLake catalog' },
  { key: 'apps', icon: 'apps', label: 'Apps' },
  { key: 'workspaces', icon: 'workspaces', label: 'Workspaces' },
];
export function NavRail({ workspace, open, onToggle }: {
  workspace: string; open: boolean; onToggle: () => void;
}) {
  return (
    <nav className={`pb-rail${open ? '' : ' mini'}`} aria-label="Fabric navigation">
      <button className="pb-rail-toggle" onClick={onToggle}
        aria-expanded={open} title={open ? 'Collapse navigation' : 'Expand navigation'}>
        <Icon n="browse" s={16} /><span>Navigation</span>
      </button>
      <ul>
        {NAV.map((n) => (
          <li key={n.key}>
            <span className="pb-rail-i" title={n.label}>
              <Icon n={n.icon} s={16} /><span>{n.label}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="pb-rail-ws" title={`${workspace} workspace`}>
        <span className="dot">{workspace.slice(0, 1).toUpperCase()}</span>
        <span>{workspace}</span>
      </div>
    </nav>
  );
}

// ── Report action bar ────────────────────────────────────────────────────────
/** The commands Power BI puts above a report. The four this demo can honour —
 *  Refresh, the time range, Simulate, Filters — are live; the rest are the
 *  surrounding furniture, disabled for the same reason as the suite bar. */
export function ActionBar({
  ranges, range, onRange, onRefresh, refreshing, paneOpen, onTogglePane, activeFilters, onSimulate, simLabel, simBusy,
}: {
  ranges: RangeCfg[]; range: RangeId; onRange: (r: RangeId) => void;
  onRefresh: () => void; refreshing: boolean;
  paneOpen: boolean; onTogglePane: () => void; activeFilters: number;
  onSimulate: () => void; simLabel: string | null; simBusy: boolean;
}) {
  return (
    <div className="pb-cmd">
      <button className="pb-cmd-b ghost" disabled><Icon n="file" s={15} />File</button>
      <button className="pb-cmd-b ghost" disabled><Icon n="export" s={15} />Export</button>
      <button className="pb-cmd-b ghost" disabled><Icon n="share" s={15} />Share</button>
      <button className="pb-cmd-b ghost hide-md" disabled><Icon n="teams" s={15} />Chat in Teams</button>
      <span className="pb-cmd-sep" />
      <button className="pb-cmd-b" onClick={onRefresh} disabled={refreshing}>
        <span className={refreshing ? 'spin' : ''}><Icon n="refresh" s={15} /></span>Refresh
      </button>
      <div className="pb-seg" role="group" aria-label="Time range">
        {ranges.map((r) => (
          <button key={r.id} aria-pressed={range === r.id} onClick={() => onRange(r.id)}>{r.label}</button>
        ))}
      </div>
      <button className="pb-cmd-b" onClick={onSimulate} disabled={simBusy}>
        <Icon n="spark" s={15} />{simBusy ? 'Running…' : 'Simulate an application'}
      </button>
      {simLabel && <span className="pb-sim"><i />{simLabel}</span>}
      <span className="pb-cmd-grow" />
      <button className="pb-cmd-b ghost hide-md" disabled><Icon n="insights" s={15} />Get insights</button>
      <button className="pb-cmd-b ghost hide-md" disabled><Icon n="subscribe" s={15} />Subscribe</button>
      <button className="pb-cmd-b ghost hide-sm" disabled><Icon n="bookmark" s={15} />Bookmarks</button>
      <button className="pb-cmd-b ghost hide-sm" disabled><Icon n="view" s={15} />View</button>
      <span className="pb-cmd-sep" />
      <button className={`pb-cmd-b${paneOpen ? ' on' : ''}`} onClick={onTogglePane} aria-pressed={paneOpen}>
        <Icon n="filter" s={15} />Filters{activeFilters > 0 && <b className="pb-badge">{activeFilters}</b>}
      </button>
      <button className="pb-cmd-b primary" disabled><Icon n="edit" s={15} />Edit</button>
    </div>
  );
}

// ── Report title bar ─────────────────────────────────────────────────────────
export function WorkspaceHeader({ workspace, report, rows, refreshedAgo }: {
  workspace: string; report: string; rows: number; refreshedAgo: string;
}) {
  return (
    <div className="pb-ws">
      <FabricMark s={22} />
      <nav className="pb-crumb" aria-label="Workspace">
        <span>{workspace}</span><Icon n="chevron" s={13} />
        <span>Account Opening</span><Icon n="chevron" s={13} />
        <b>{report}</b>
      </nav>
      <span className="pb-ws-tag">Power BI report</span>
      <span className="pb-cmd-grow" />
      <span className="pb-rows">{rows.toLocaleString()} rows in scope</span>
      <span className="pb-ws-sep" />
      <span className="pb-fresh"><i />Refreshed {refreshedAgo}</span>
      <span className="pb-ws-sep" />
      {/* The one honest line on the shell: the figures are computed in the
          app from its own case store, not refreshed from OneLake. Quiet, so
          it reads as provenance rather than as an apology. */}
      <span className="pb-computed" title="Figures are computed in the app from the cases this demo writes to its own store (mirrored to Data Fabric), on top of a synthetic sixty-day history — not refreshed from a Fabric lakehouse.">
        Computed in-app · demo data
      </span>
    </div>
  );
}

// ── Lineage bar ──────────────────────────────────────────────────────────────
/** Power BI puts a light information band under the action bar; this is that
 *  band, carrying the one thing a Power BI report cannot show you from the
 *  report canvas — where its numbers came from. */
export interface LineageStage { key: string; icon: string; name: string; kind: string; detail: string }
export function Lineage({ stages }: { stages: LineageStage[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`pb-lin${open ? '' : ' closed'}`}>
      <div className="pb-lin-h">
        <Icon n="model" s={15} />
        <b>Lineage</b>
        {/* The source is named for what it is HERE: this app's own case store,
            mirrored to Data Fabric — not the sibling's Dataverse tables. The
            rest of the path is the Fabric chrome the report presents as. */}
        <span className="sub">Case store → OneLake → semantic model → this report</span>
        {open && (
          <ol className="pb-lin-row">
            {stages.map((st, i) => (
              <li key={st.key}>
                <div className="pb-lin-node">
                  <span className="ic"><Icon n={st.icon} s={15} /></span>
                  <span className="tx"><b>{st.name}</b><em>{st.kind}</em></span>
                  <span className="dt">{st.detail}</span>
                </div>
                {i < stages.length - 1 && <span className="pb-lin-arrow" aria-hidden><Icon n="chevron" s={13} /></span>}
              </li>
            ))}
          </ol>
        )}
        <span className="pb-cmd-grow" />
        <button className="pb-lin-caret" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          title={open ? 'Hide lineage' : 'Show lineage'}>
          <Icon n={open ? 'collapse' : 'expand'} s={13} />
        </button>
      </div>
    </section>
  );
}

// ── Page tabs (docked to the bottom of the canvas, as Power BI docks them) ───
export function PageTabs({ page, onPage, counts }: {
  page: PageId; onPage: (p: PageId) => void; counts: Partial<Record<PageId, number>>;
}) {
  const i = PAGES.findIndex((p) => p.id === page);
  return (
    <div className="pb-tabs">
      <div className="pb-tabs-l" role="tablist" aria-label="Report pages">
        {PAGES.map((p) => (
          <button key={p.id} role="tab" aria-selected={page === p.id} onClick={() => onPage(p.id)}>
            {p.name}
            {counts[p.id] !== undefined && counts[p.id]! > 0 && <b className="pb-badge">{counts[p.id]}</b>}
          </button>
        ))}
      </div>
      <span className="pb-cmd-grow" />
      <span className="pb-tabs-r">Page {i + 1} of {PAGES.length} · Fit to width</span>
    </div>
  );
}

// ── Visual card ──────────────────────────────────────────────────────────────
/**
 * A report visual. The header only appears on hover, the way Power BI's does,
 * and carries the two affordances people reach for: focus mode, and "show the
 * numbers behind this". `table` is optional — a visual that has no sensible
 * tabular form simply does not offer the toggle.
 */
export function Visual({
  title, subtitle, className, table, children, footer,
}: {
  title: string; subtitle?: ReactNode; className?: string;
  table?: { cols: string[]; rows: (string | number)[][] };
  children: ReactNode; footer?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <>
      {focus && <div className="pb-scrim" onClick={() => setFocus(false)} />}
      <section className={`pb-vis${className ? ` ${className}` : ''}${focus ? ' focus' : ''}`}>
        <header className="pb-vis-h">
          <div className="t">
            <b>{title}</b>
            {subtitle && <em>{subtitle}</em>}
          </div>
          <div className="acts">
            {table && (
              <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
                title={asTable ? 'Show the visual' : 'Show as a table'}>
                <Icon n="table" s={14} />
              </button>
            )}
            <button onClick={() => setFocus((v) => !v)} aria-pressed={focus}
              title={focus ? 'Back to report' : 'Focus mode'}>
              <Icon n={focus ? 'collapse' : 'expand'} s={14} />
            </button>
          </div>
        </header>
        <div className="pb-vis-b">
          {asTable && table ? <DataTable {...table} /> : children}
        </div>
        {footer && <div className="pb-vis-f">{footer}</div>}
      </section>
    </>
  );
}

export function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="pb-table-wrap">
      <table className="pb-table">
        <thead><tr>{cols.map((c, i) => <th key={c} className={i ? 'num' : ''}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length
            ? rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j ? 'num' : ''}>{v}</td>)}</tr>)
            : <tr><td colSpan={cols.length} className="empty">No rows.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Applied-filter chips ─────────────────────────────────────────────────────
export function FilterChips({ filters, onClear, onClearAll }: {
  filters: Filters; onClear: (k: keyof Filters) => void; onClearAll: () => void;
}) {
  const chips: { k: keyof Filters; label: string }[] = [];
  if (filters.channel) chips.push({ k: 'channel', label: `Channel: ${CHANNEL_LABEL[filters.channel]}` });
  if (filters.verification) chips.push({ k: 'verification', label: `Checks: ${filters.verification === 'cleared' ? 'Cleared' : 'Flagged'}` });
  if (filters.outcome) chips.push({ k: 'outcome', label: `Outcome: ${OUTCOME_LABEL[filters.outcome]}` });
  if (filters.check) chips.push({ k: 'check', label: `Failing: ${checkLabel[filters.check]}` });
  if (!chips.length) return null;
  return (
    <div className="pb-chips">
      <span className="lb">Filtered by</span>
      {chips.map((c) => (
        <button key={c.k} className="chip" onClick={() => onClear(c.k)} title="Remove this filter">
          {c.label}<Icon n="close" s={11} />
        </button>
      ))}
      <button className="clear" onClick={onClearAll}>Clear all</button>
    </div>
  );
}

// ── Filter pane ──────────────────────────────────────────────────────────────
function Group<T extends string>({ title, options, value, counts, onPick }: {
  title: string;
  options: { key: T; label: string }[];
  value: T | null; counts: Record<string, number>;
  onPick: (v: T | null) => void;
}) {
  const live = options.filter((o) => (counts[o.key] ?? 0) > 0 || value === o.key);
  return (
    <div className="pb-fg">
      <div className="pb-fg-h">
        <b>{title}</b>
        {value && <button onClick={() => onPick(null)} title="Clear">Clear</button>}
      </div>
      {live.length ? live.map((o) => (
        <label key={o.key} className={value === o.key ? 'on' : ''}>
          <input type="checkbox" checked={value === o.key} onChange={() => onPick(value === o.key ? null : o.key)} />
          <span className="nm">{o.label}</span>
          <span className="n">{counts[o.key] ?? 0}</span>
        </label>
      )) : <div className="pb-fg-none">Nothing in this window.</div>}
    </div>
  );
}

export function FilterPane({ model, filters, set, onClose, onClearAll }: {
  model: TowerModel; filters: Filters;
  set: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  onClose: () => void; onClearAll: () => void;
}) {
  return (
    <aside className="pb-pane" aria-label="Filters">
      <div className="pb-pane-h">
        <b>Filters</b>
        <span className="pb-cmd-grow" />
        {filterCount(filters) > 0 && <button className="lnk" onClick={onClearAll}>Clear all</button>}
        <button className="x" onClick={onClose} aria-label="Close filter pane"><Icon n="close" s={14} /></button>
      </div>
      <div className="pb-pane-note">Filters apply to every visual on every page.</div>
      <div className="pb-pane-b">
        <Group<Channel>
          title="Channel" value={filters.channel} counts={model.facets.channel}
          options={(['bulk', 'single', 'self'] as Channel[]).map((k) => ({ key: k, label: CHANNEL_LABEL[k] }))}
          onPick={(v) => set('channel', v)}
        />
        <Group<VerificationKey>
          title="Verification" value={filters.verification} counts={model.facets.verification}
          options={[{ key: 'cleared', label: 'Cleared checks' }, { key: 'flagged', label: 'Flagged for review' }]}
          onPick={(v) => set('verification', v)}
        />
        <Group<OutcomeKey>
          title="Outcome" value={filters.outcome} counts={model.facets.outcome}
          options={OUTCOMES.map((k) => ({ key: k, label: OUTCOME_LABEL[k] }))}
          onPick={(v) => set('outcome', v)}
        />
        <Group<ValidationKind>
          title="Failing check" value={filters.check} counts={model.facets.check}
          options={CHECKS.map((k) => ({ key: k, label: checkLabel[k] }))}
          onPick={(v) => set('check', v)}
        />
      </div>
      <div className="pb-pane-f">
        {model.total.toLocaleString()} of {model.windowTotal.toLocaleString()} applications
      </div>
    </aside>
  );
}
