// ─────────────────────────────────────────────────────────────────────────────
// Open an account — the branch pipeline, with capture docked beside it.
// The wizard itself is the same component the customer uses (mode='rm'), so the
// two surfaces can never drift apart. Everything around it is desk-native.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { stateMeta, fullName, ONBOARDING_STATES, type OnboardingCase, type OnboardingState } from '../../onboarding';
import { useMaestroStates, MaestroCell } from '../maestroStatus';
import type { LiveStateLite } from '../../onboarding/maestro';
import AccountOpeningFlow from '../../customer/flow';
import CaseDetail from './CaseDetail';
import BulkUpload from './BulkUpload';
import { I, Tag, Dot, Stat, type Tone } from '../ui';
import { ago } from '../time';

// Sentinel for the right-pane mode: '' = new single capture, '__bulk__' = bulk
// upload, a case id = track that case, null = nothing open.
const BULK = '__bulk__';

const TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };
type Filter = 'all' | 'needs' | 'flight' | 'done';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs', label: 'Needs attention' },
  { id: 'flight', label: 'In flight' },
  { id: 'done', label: 'Done' },
];
type Src = 'all' | 'bulk' | 'single';
const SOURCES: { id: Src; label: string }[] = [
  { id: 'all', label: 'All sources' },
  { id: 'bulk', label: 'Bulk' },
  { id: 'single', label: 'Single' },
];

const needsAttention = (s: OnboardingState) => s === 'EXCEPTION' || s === 'PENDING_LIVENESS' || s === 'PENDING_DOCUMENTS';

export default function Opening({ cases, flow, setFlow, onNewApplication, captureSeq }: { cases: OnboardingCase[]; flow: string | null; setFlow: (v: string | null) => void; onNewApplication: () => void; captureSeq: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState<Src>('all');
  const [q, setQ] = useState('');
  // Which groups the banker has expanded/collapsed by hand. Bulk batches start
  // collapsed (so the batch roots read at a glance); direct captures start open.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // A case can be opened from outside this screen (My desk, global search). Reveal
  // it in context: collapse EVERY group — the other batches and the walk-in/direct
  // lane — and open only the one the case lives in, so the row is visible and
  // highlighted, never sharing the view with an unrelated expanded group.
  // Render-phase adjustment: it reacts to `flow` changing, not a click.
  const [revealed, setRevealed] = useState<string | null>(null);
  if (flow !== revealed) {
    setRevealed(flow);
    const target = flow && flow !== '' && flow !== BULK ? cases.find((c) => c.id === flow) : null;
    if (target) {
      setOpenMap((m) => {
        const next = { ...m };
        for (const c of cases) if (c.batchId) next[c.batchId] = false;
        next['__direct__'] = false;
        next[target.batchId ?? '__direct__'] = true;
        return next;
      });
    }
  }

  const list = useMemo(() => {
    let l = cases;
    if (source === 'bulk') l = l.filter((c) => !!c.batchId);
    if (source === 'single') l = l.filter((c) => !c.batchId);
    if (filter === 'needs') l = l.filter((c) => needsAttention(c.state));
    if (filter === 'flight') l = l.filter((c) => !needsAttention(c.state) && c.state !== 'FULLY_ACTIVATED');
    if (filter === 'done') l = l.filter((c) => c.state === 'FULLY_ACTIVATED');
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((c) => fullName(c).toLowerCase().includes(t) || c.id.toLowerCase().includes(t));
    return l;
  }, [cases, filter, source, q]);

  // A batch upload is one node; loose single captures share a "Walk-in" node.
  const groups = useMemo(() => buildGroups(list), [list]);

  // A text search or status filter forces every group open so matches show.
  // The source filter only narrows which nodes appear — the roots stay foldable.
  const searching = filter !== 'all' || q.trim() !== '';
  const storedOpen = (g: Group) => (g.key in openMap ? openMap[g.key] : g.kind === 'direct');
  const isOpen = (g: Group) => searching || storedOpen(g);
  // Batches behave as an accordion: opening one payroll collapses the others, so
  // a 20-row roster never buries the batch below it. Walk-in folds independently.
  const toggle = (g: Group) => setOpenMap((m) => {
    const willOpen = !storedOpen(g);
    if (g.kind !== 'batch' || !willOpen) return { ...m, [g.key]: willOpen };
    const next = { ...m };
    for (const other of groups) if (other.kind === 'batch') next[other.key] = false;
    next[g.key] = true;
    return next;
  });
  const anyOpen = groups.some(storedOpen);
  const setAll = (v: boolean) => setOpenMap(Object.fromEntries(groups.map((g) => [g.key, v])));

  // Read the selected case out of the live list rather than holding a copy, so an
  // action taken in the right pane re-renders it as the store moves the case on.
  // '' (new) and BULK are pane modes, not case ids.
  const picked = flow && flow !== '' && flow !== BULK ? cases.find((c) => c.id === flow) ?? null : null;

  const open = cases.filter((c) => c.state !== 'FULLY_ACTIVATED').length;
  const waiting = cases.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length;
  const exc = cases.filter((c) => c.state === 'EXCEPTION').length;
  // Straight-through = never needed a person (matches My desk).
  const touched = cases.filter((c) => c.state === 'EXCEPTION' || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout')).length;
  const stp = cases.length ? Math.round(((cases.length - touched) / cases.length) * 100) : 0;

  // Live Maestro status for the list column (shared hook — two API calls per refresh).
  const mstates = useMaestroStates(useMemo(() => cases.map((c) => c.id), [cases]));

  // The capture wizard opens as a centred overlay, not in the right pane: at
  // pane width it's a 440px column, which is too narrow for the corporate
  // two-column form and far too narrow for the side-by-side document read.
  const composing = flow === '';
  useEffect(() => {
    if (!composing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFlow(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composing, setFlow]);

  return (
    <div className={`dk-split${flow !== null ? ' busy' : ''}`}>
      <div className="p l">
        <div className="dk-scroll">
        {/* Three stats, not four: this pane is half-width, and straight-through
            is a desk-level number that already leads My desk. */}
        <div className="dk-health">
          <Stat k="In progress" v={open} />
          <Stat k="Awaiting KYC" v={waiting} tone={waiting ? '#d97706' : undefined} />
          <Stat k="Exceptions" v={exc} tone={exc ? '#dc2626' : undefined} />
          <Stat k="Straight through" v={`${stp}%`} tone={stp >= 80 ? '#16a34a' : undefined} />
        </div>

        <div className="dk-body">
          <div className="dk-col">
            <div className="dk-qhead">
              <div>
                <h1>Open an account<span className="n">{list.length}</span></h1>
                <div className="sub">Assisted capture · branch pipeline</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="dk-btn lg" onClick={() => setFlow(BULK)}><I n="layers" s={15} />Bulk upload</button>
                <button className="dk-btn pri lg" onClick={onNewApplication}><I n="plus" s={15} w={2.4} />New application</button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, flexWrap: 'wrap' }}>
              <div className="dk-find" style={{ flex: '1 1 200px', maxWidth: 280 }}>
                <span className="s"><I n="search" s={15} /></span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or reference" />
              </div>
              <div className="dk-segs">
                {FILTERS.map((f) => (
                  <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
                ))}
              </div>
              <div className="dk-segs">
                {SOURCES.map((f) => (
                  <button key={f.id} aria-pressed={source === f.id} onClick={() => setSource(f.id)}>{f.label}</button>
                ))}
              </div>
              <button className="dk-btn" style={{ marginLeft: 'auto' }} onClick={() => setAll(!anyOpen)} disabled={searching} title={searching ? 'Groups open automatically while searching' : undefined}>
                <I n={anyOpen ? 'collapse' : 'expand'} s={14} />{anyOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            {list.length ? (
              <GroupedTable groups={groups} active={flow} onPick={setFlow} isOpen={isOpen} toggle={toggle} mstates={mstates} />
            ) : (
              <div className="dk-empty"><b>Nothing here</b><span>No applications match this filter.</span></div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Right pane. A *new* capture gets the wizard — those screens face the
          customer, so customer voice is correct there. An *existing* case gets
          the staff view: what to do about it, in the banker's voice. */}
      <div className="p r" style={{ position: 'relative' }}>
        {(flow === null || composing) && <Blank onNew={onNewApplication} onBulk={() => setFlow(BULK)} />}
        {flow === BULK && <BulkUpload onExit={() => setFlow(null)} />}
        {flow && flow !== BULK && flow !== '' && (picked
          ? <CaseDetail key={picked.id} c={picked} onClose={() => setFlow(null)} />
          : <Blank onNew={onNewApplication} onBulk={() => setFlow(BULK)} />)}
      </div>

      {composing && (
        <div className="dk-capture-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setFlow(null); }}>
          <div className="dk-capture" role="dialog" aria-modal="true" aria-label="New application">
            <AccountOpeningFlow key={captureSeq} mode="rm" onExit={() => setFlow(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Blank({ onNew, onBulk }: { onNew: () => void; onBulk: () => void }) {
  return (
    <div className="dk-flow">
      <div style={{ border: 'none', boxShadow: 'none', background: 'transparent', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 30 }}>
        <div>
          <div style={{ width: 46, height: 46, borderRadius: 13, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(var(--d-brand-rgb), .09)', color: 'var(--d-brand)' }}>
            <I n="idcard" s={23} />
          </div>
          <div style={{ font: '600 15px/1.35 inherit', marginBottom: 6 }}>Nothing open</div>
          <p style={{ fontSize: 13, color: 'var(--d-ink-2)', lineHeight: 1.55, maxWidth: 260, margin: '0 auto 16px' }}>
            Start a new application, upload many at once, or pick one from the pipeline to see where it got to.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="dk-btn" onClick={onBulk}><I n="layers" s={14} />Bulk upload</button>
            <button className="dk-btn pri" onClick={onNew}><I n="plus" s={14} w={2.4} />New application</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const GRID = { gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 148px 130px 84px 20px' };

// ── Grouping: each bulk upload is a node; loose single captures share one. ──
type Group = { key: string; kind: 'batch' | 'direct'; title: string; batchId?: string; createdAt: string; rows: OnboardingCase[] };

const isOpened = (c: OnboardingCase) =>
  !!c.accountNumber || c.state === 'ACCOUNT_CREATED' || c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS' || c.state === 'FULLY_ACTIVATED';

function summarize(rows: OnboardingCase[]) {
  const opened = rows.filter(isOpened).length;
  const exc = rows.filter((c) => c.state === 'EXCEPTION').length;
  return { total: rows.length, opened, exc, proc: rows.length - opened - exc };
}

function buildGroups(list: OnboardingCase[]): Group[] {
  const batches = new Map<string, OnboardingCase[]>();
  const direct: OnboardingCase[] = [];
  for (const c of list) {
    if (c.batchId) { const a = batches.get(c.batchId) ?? []; a.push(c); batches.set(c.batchId, a); }
    else direct.push(c);
  }
  const batchGroups: Group[] = [];
  for (const [batchId, rows] of batches) {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const employer = sorted.find((c) => c.employer)?.employer;
    const createdAt = sorted.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), sorted[0].createdAt);
    batchGroups.push({ key: batchId, kind: 'batch', title: employer || 'Bulk batch', batchId, createdAt, rows: sorted });
  }
  batchGroups.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // newest batch first
  // Walk-in / direct always leads the list; bulk uploads follow (newest first).
  const groups: Group[] = [];
  if (direct.length) groups.push({ key: '__direct__', kind: 'direct', title: 'Walk-in / direct', createdAt: '', rows: direct });
  groups.push(...batchGroups);
  return groups;
}

function GroupedTable({ groups, active, onPick, isOpen, toggle, mstates }: {
  groups: Group[]; active: string | null; onPick: (id: string) => void; isOpen: (g: Group) => boolean; toggle: (g: Group) => void;
  mstates: Record<string, LiveStateLite>;
}) {
  return (
    <div className="dk-groups">
      {/* Two labelled status lanes: the real Maestro stage, and the business outcome. */}
      <div className="dk-colhead" style={GRID}>
        <span>Applicant</span>
        <span />
        <span>Maestro stage</span>
        <span>Outcome</span>
        <span />
        <span />
      </div>
      {groups.map((g) => {
        const open = isOpen(g);
        const s = summarize(g.rows);
        // How many of this group's cases are live in Maestro right now (a real running or
        // awaiting instance — not completed, not still loading, not unlinked).
        const live = g.rows.filter((c) => { const m = mstates[c.id]; return m && m.jobState !== 'Loading' && m.jobState !== 'Unknown' && !m.done; }).length;
        return (
          <div className="dk-group" data-open={open} key={g.key}>
            <button className="dk-group-hd" aria-expanded={open} onClick={() => toggle(g)}>
              <span className="tw"><I n="chevron" s={15} /></span>
              <span className={`gi${g.kind === 'direct' ? ' direct' : ''}`}><I n={g.kind === 'batch' ? 'layers' : 'user'} s={16} /></span>
              <span className="gt">
                <b>{g.title}</b>
                <span className="gs">{g.kind === 'batch' ? `${g.batchId} · ${ago(g.createdAt)}` : 'Single captures'}</span>
              </span>
              <span className="gc">
                <span className="dk-chip">{s.total} {g.kind === 'batch' ? (s.total === 1 ? 'person' : 'people') : (s.total === 1 ? 'app' : 'apps')}</span>
                {s.opened > 0 && <span className="dk-chip green">{s.opened} opened</span>}
                {s.exc > 0 && <span className="dk-chip red">{s.exc} exception{s.exc === 1 ? '' : 's'}</span>}
                {s.proc > 0 && <span className="dk-chip amber">{s.proc} in flight</span>}
                {live > 0 && <span className="dk-chip live" title={`${live} case${live === 1 ? '' : 's'} live in Maestro`}><i />{live} live in Maestro</span>}
              </span>
            </button>
            {open && (
              <div className="dk-group-body">
                {g.rows.map((c) => <Row key={c.id} c={c} active={active} onPick={onPick} maestro={mstates[c.id]} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ c, active, onPick, maestro }: { c: OnboardingCase; active: string | null; onPick: (id: string) => void; maestro?: LiveStateLite }) {
  const m = stateMeta(c.state);
  const tone = TONE[m.tone] ?? 'idle';
  const step = ONBOARDING_STATES.findIndex((x) => x.state === c.state) + 1;
  const failed = c.validations.filter((v) => v.status === 'failed' || v.status === 'timeout').map((v) => v.kind);
  const stage = c.state === 'EXCEPTION'
    ? (failed.length ? `${failed.join(' & ')} needs a person` : 'Needs review')
    : c.accountNumber ? null
    : `Step ${step} of ${ONBOARDING_STATES.length - 1}`;
  return (
    <button className="dk-row" style={GRID} aria-current={active === c.id} onClick={() => onPick(c.id)}>
      <span className="who">
        <Dot tone={tone} live={tone === 'info'} />
        <span style={{ minWidth: 0 }}>
          <span className="nm" style={{ display: 'block' }}>{fullName(c).trim() || 'Unnamed applicant'}</span>
          <span className="rf">{c.id}</span>
        </span>
      </span>
      <span className="mu">
        {stage ?? <>Account <span className="num">{c.accountNumber}</span></>}
      </span>
      <MaestroCell m={maestro} />
      <span><Tag tone={tone}>{m.label}</Tag></span>
      <span className="rf">{ago(c.createdAt)}</span>
      <span className="ch"><I n="chevron" s={15} /></span>
    </button>
  );
}
