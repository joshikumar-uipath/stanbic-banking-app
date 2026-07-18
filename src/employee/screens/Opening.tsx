// ─────────────────────────────────────────────────────────────────────────────
// Open an account — the branch pipeline, with capture docked beside it.
// The wizard itself is the same component the customer uses (mode='rm'), so the
// two surfaces can never drift apart. Everything around it is desk-native.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { stateMeta, fullName, ONBOARDING_STATES, type OnboardingCase, type OnboardingState } from '../../onboarding';
import AccountOpeningFlow from '../../customer/flow';
import CaseDetail from './CaseDetail';
import { I, Tag, Dot, Stat, type Tone } from '../ui';
import { ago } from '../time';

const TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };
type Filter = 'all' | 'needs' | 'flight' | 'done';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs', label: 'Needs attention' },
  { id: 'flight', label: 'In flight' },
  { id: 'done', label: 'Done' },
];

const needsAttention = (s: OnboardingState) => s === 'EXCEPTION' || s === 'PENDING_LIVENESS' || s === 'PENDING_DOCUMENTS';

export default function Opening({ cases, flow, setFlow }: { cases: OnboardingCase[]; flow: string | null; setFlow: (v: string | null) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    let l = cases;
    if (filter === 'needs') l = l.filter((c) => needsAttention(c.state));
    if (filter === 'flight') l = l.filter((c) => !needsAttention(c.state) && c.state !== 'FULLY_ACTIVATED');
    if (filter === 'done') l = l.filter((c) => c.state === 'FULLY_ACTIVATED');
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((c) => fullName(c).toLowerCase().includes(t) || c.id.toLowerCase().includes(t));
    return l;
  }, [cases, filter, q]);

  // Read the selected case out of the live list rather than holding a copy, so an
  // action taken in the right pane re-renders it as the store moves the case on.
  const picked = flow ? cases.find((c) => c.id === flow) ?? null : null;

  const open = cases.filter((c) => c.state !== 'FULLY_ACTIVATED').length;
  const waiting = cases.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length;
  const exc = cases.filter((c) => c.state === 'EXCEPTION').length;
  // Straight-through = never needed a person (matches My desk).
  const touched = cases.filter((c) => c.state === 'EXCEPTION' || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout')).length;
  const stp = cases.length ? Math.round(((cases.length - touched) / cases.length) * 100) : 0;

  return (
    <div className={`dk-split${flow !== null ? ' busy' : ''}`}>
      <div className="p l">
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
              <button className="dk-btn pri lg" onClick={() => setFlow('')}><I n="plus" s={15} w={2.4} />New application</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
              <div className="dk-find" style={{ maxWidth: 280 }}>
                <span className="s"><I n="search" s={15} /></span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or reference" />
              </div>
              <div className="dk-segs">
                {FILTERS.map((f) => (
                  <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
                ))}
              </div>
            </div>

            {list.length ? <Table list={list} active={flow} onPick={setFlow} /> : (
              <div className="dk-empty"><b>Nothing here</b><span>No applications match this filter.</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Right pane. A *new* capture gets the wizard — those screens face the
          customer, so customer voice is correct there. An *existing* case gets
          the staff view: what to do about it, in the banker's voice. */}
      <div className="p r" style={{ position: 'relative' }}>
        {flow === null && <Blank onNew={() => setFlow('')} />}
        {flow === '' && <div className="dk-flow"><AccountOpeningFlow mode="rm" onExit={() => setFlow(null)} /></div>}
        {flow && (picked
          ? <CaseDetail key={picked.id} c={picked} onClose={() => setFlow(null)} />
          : <Blank onNew={() => setFlow('')} />)}
      </div>
    </div>
  );
}

function Blank({ onNew }: { onNew: () => void }) {
  return (
    <div className="dk-flow">
      <div style={{ border: 'none', boxShadow: 'none', background: 'transparent', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 30 }}>
        <div>
          <div style={{ width: 46, height: 46, borderRadius: 13, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(var(--d-brand-rgb), .09)', color: 'var(--d-brand)' }}>
            <I n="idcard" s={23} />
          </div>
          <div style={{ font: '600 15px/1.35 inherit', marginBottom: 6 }}>Nothing open</div>
          <p style={{ fontSize: 13, color: 'var(--d-ink-2)', lineHeight: 1.55, maxWidth: 260, margin: '0 auto 16px' }}>
            Start a new application, or pick one from the pipeline to see where it got to.
          </p>
          <button className="dk-btn pri" onClick={onNew}><I n="plus" s={14} w={2.4} />New application</button>
        </div>
      </div>
    </div>
  );
}

const GRID = { gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 130px 84px 20px' };

function Table({ list, active, onPick }: { list: OnboardingCase[]; active: string | null; onPick: (id: string) => void }) {
  return (
    <div className="dk-rows">
      <div className="dk-cols" style={GRID}>
        <span>Applicant</span><span>Stage</span><span>Status</span><span>Started</span><span />
      </div>
      {list.map((c) => {
        const m = stateMeta(c.state);
        const tone = TONE[m.tone] ?? 'idle';
        const step = ONBOARDING_STATES.findIndex((x) => x.state === c.state) + 1;
        const failed = c.validations.filter((v) => v.status === 'failed' || v.status === 'timeout').map((v) => v.kind);
        const stage = c.state === 'EXCEPTION'
          ? (failed.length ? `${failed.join(' & ')} needs a person` : 'Needs review')
          : c.accountNumber ? null
          : `Step ${step} of ${ONBOARDING_STATES.length - 1}`;
        return (
          <button key={c.id} className="dk-row" style={GRID} aria-current={active === c.id} onClick={() => onPick(c.id)}>
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
            <span><Tag tone={tone}>{m.label}</Tag></span>
            <span className="rf">{ago(c.createdAt)}</span>
            <span className="ch"><I n="chevron" s={15} /></span>
          </button>
        );
      })}
    </div>
  );
}
