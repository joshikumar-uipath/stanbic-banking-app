// Approvals — maker-checker queue, desk-native. Reuses the existing
// ApprovalDetail sheet for the actual decision (it's already good, and shared
// with the phone), so only the queue itself is redesigned here.
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

export default function Approvals() {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Approval | null>(null);
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

  // The decision sheet is already good and is shared with the phone — reuse it
  // as-is rather than fork a desktop copy that would drift.
  if (open) return <div className="dk-hold"><ApprovalDetail approval={open} onBack={() => setOpen(null)} onResolved={() => setOpen(null)} /></div>;

  return (
    <>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
            <div className="dk-find" style={{ maxWidth: 300 }}>
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
                <button key={a.id} className="dk-row" style={GRID} onClick={() => setOpen(a)}>
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
    </>
  );
}

const GRID = { gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.2fr) 110px 170px 80px 20px' };
