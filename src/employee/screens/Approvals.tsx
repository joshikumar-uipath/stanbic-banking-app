// Approvals — maker-checker queue, desk-native. Same shape as "Open an account":
// the queue holds the left pane and the decision opens beside it on the right,
// rather than replacing the whole screen. Keeping the list on screen is the point
// of a queue — you can see what else is waiting, and how this one compares, while
// you decide. Reuses the existing ApprovalDetail sheet for the decision itself
// (it's already good, and shared with the phone), so only the shell changed.
import { useMemo, useState } from 'react';
import { approvals, approvalsPulse, money, type Approval } from '../../approvalsData';
import ApprovalDetail from '../../components/ApprovalDetail';
import { I, Tag, Dot, Stat, type Tone } from '../ui';

type Filter = 'all' | 'sla' | 'dual' | 'high';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sla', label: 'Breaching SLA' },
  { id: 'dual', label: 'Dual approval' },
  { id: 'high', label: 'High risk' },
];

const riskTone = (a: Approval): Tone => (a.slaBreaching ? 'crit' : a.risk === 'High' ? 'warn' : a.risk === 'Medium' ? 'info' : 'idle');

// Defined in desk.css so the open and closed widths can differ — see the two
// `--dk-appr-grid` declarations there.
const GRID = { gridTemplateColumns: 'var(--dk-appr-grid)' };

export default function Approvals() {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  // Hold the id, not the object: the row stays highlighted across a filter or
  // search change, and the pane keeps showing the decision you were mid-way
  // through even when the list it came from no longer contains it.
  const [openId, setOpenId] = useState<string | null>(null);

  const p = approvalsPulse();

  const list = useMemo(() => {
    let l = approvals;
    if (filter === 'sla') l = l.filter((a) => a.slaBreaching);
    if (filter === 'dual') l = l.filter((a) => !a.withinAuthority);
    if (filter === 'high') l = l.filter((a) => a.risk === 'High');
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((a) => a.customer.toLowerCase().includes(t) || a.id.toLowerCase().includes(t) || a.title.toLowerCase().includes(t));
    return l;
  }, [filter, q]);

  const picked = openId ? approvals.find((a) => a.id === openId) ?? null : null;

  return (
    <div className={`dk-split${picked ? ' busy' : ''}`}>
      <div className="p l">
        <div className="dk-scroll">
          <div className="dk-health">
            <Stat k="Pending you" v={p.pending} />
            <Stat k="Value awaiting" v={money(p.value)} />
            <Stat k="Breaching SLA" v={p.breaching} tone={p.breaching ? '#dc2626' : undefined} />
            <Stat k="Dual approval" v={p.dual} tone={p.dual ? '#d97706' : undefined} />
          </div>

          <div className="dk-body">
            <div className="dk-col">
              <div className="dk-qhead">
                <div>
                  <h1>Approvals<span className="n">{list.length}</span></h1>
                  <div className="sub">Maker-checker · your authority</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, flexWrap: 'wrap' }}>
                <div className="dk-find" style={{ flex: '1 1 200px', maxWidth: 300 }}>
                  <span className="s"><I n="search" s={15} /></span>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, reference or request" />
                </div>
                <div className="dk-segs">
                  {FILTERS.map((f) => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
                </div>
              </div>

              {list.length ? (
                <div className="dk-rows">
                  <div className="dk-cols" style={GRID}>
                    <span>Customer</span><span>Request</span><span>Amount</span><span>Flags</span><span>SLA</span><span />
                  </div>
                  {list.map((a) => (
                    <button
                      key={a.id}
                      className="dk-row dk-approw"
                      style={GRID}
                      aria-current={openId === a.id}
                      onClick={() => setOpenId(a.id)}
                    >
                      <span className="who">
                        <Dot tone={riskTone(a)} />
                        <span style={{ minWidth: 0 }}>
                          <span className="nm" style={{ display: 'block' }}>{a.customer}</span>
                          <span className="rf">Raised by {a.maker}</span>
                        </span>
                      </span>
                      <span className="mu">{a.title}</span>
                      <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{a.amount ? money(a.amount) : '—'}</span>
                      <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {a.slaBreaching && <Tag tone="crit">SLA</Tag>}
                        {!a.withinAuthority && <Tag tone="warn">Dual</Tag>}
                        {a.risk === 'High' && <Tag tone="warn">High risk</Tag>}
                      </span>
                      <span className="rf">{a.sla}</span>
                      <span className="ch"><I n="chevron" s={15} /></span>
                    </button>
                  ))}
                </div>
              ) : <div className="dk-empty"><b>Nothing here</b><span>No approvals match this filter.</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Right pane: the decision itself. ApprovalDetail already fills its
          container and carries its own header and action bar, so it drops in
          unchanged — the same component the phone uses. */}
      <div className="p r">
        {picked
          ? <ApprovalDetail key={picked.id} approval={picked} onBack={() => setOpenId(null)} onResolved={() => setOpenId(null)} />
          : <Blank />}
      </div>
    </div>
  );
}

function Blank() {
  return (
    <div className="dk-flow">
      <div style={{ border: 'none', boxShadow: 'none', background: 'transparent', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 30 }}>
        <div>
          <div style={{ width: 46, height: 46, borderRadius: 13, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(var(--d-brand-rgb), .09)', color: 'var(--d-brand)' }}>
            <I n="check" s={23} />
          </div>
          <div style={{ font: '600 15px/1.35 inherit', marginBottom: 6 }}>Nothing open</div>
          <p style={{ fontSize: 13, color: 'var(--d-ink-2)', lineHeight: 1.55, maxWidth: 260, margin: '0 auto' }}>
            Pick a request from the queue to see the maker's justification, the checks behind it, and what your authority allows.
          </p>
        </div>
      </div>
    </div>
  );
}
