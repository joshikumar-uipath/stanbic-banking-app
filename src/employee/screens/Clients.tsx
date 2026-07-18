// Clients — the branch book, desk-native. Customer360 (shared with the phone)
// still handles the individual profile.
import { useMemo, useState } from 'react';
import { customers, branchPulse, money, type Customer } from '../../customersData';
import Customer360 from '../../components/Customer360';
import { I, Tag, Dot, Stat, type Tone } from '../ui';

type Filter = 'all' | 'value' | 'risk' | 'kyc';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'value', label: 'High value' },
  { id: 'risk', label: 'At-risk' },
  { id: 'kyc', label: 'KYC due' },
];

const SEG: Record<string, string> = { Premier: '#C8A24A', Priority: '#7C6CF0', Business: '#2EA8C0', Retail: '#7A8896' };
const tone = (c: Customer): Tone => (c.headlineTone === 'warn' ? 'warn' : c.headlineTone === 'good' ? 'good' : 'info');

export default function Clients() {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Customer | null>(null);
  const p = branchPulse();

  const list = useMemo(() => {
    let l = customers;
    if (filter === 'value') l = l.filter((c) => c.relationshipValue >= 100000);
    if (filter === 'risk') l = l.filter((c) => c.headlineTone === 'warn');
    if (filter === 'kyc') l = l.filter((c) => c.kyc !== 'Verified');
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((c) => c.name.toLowerCase().includes(t) || c.maskedId.toLowerCase().includes(t));
    return l;
  }, [filter, q]);

  if (open) return <div className="dk-hold"><Customer360 customer={open} onBack={() => setOpen(null)} /></div>;

  return (
    <>
      <div className="dk-health">
        <Stat k="Relationships" v={p.relationships} />
        <Stat k="At-risk" v={p.atRisk} tone={p.atRisk ? '#d97706' : undefined} />
        <Stat k="Next best actions" v={p.nbas} tone="var(--d-brand)" />
        <Stat k="KYC due" v={p.kycDue} tone={p.kycDue ? '#d97706' : undefined} />
      </div>

      <div className="dk-body">
        <div className="dk-col">
          <div className="dk-qhead">
            <div>
              <h1>Clients<span className="n">{list.length}</span></h1>
              <div className="sub">Key relationships · branch book</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
            <div className="dk-find" style={{ maxWidth: 300 }}>
              <span className="s"><I n="search" s={15} /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or CIF" />
            </div>
            <div className="dk-segs">
              {FILTERS.map((f) => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
            </div>
          </div>

          {list.length ? (
            <div className="dk-rows">
              <div className="dk-cols" style={GRID}>
                <span>Client</span><span>Headline</span><span>Relationship</span><span>Segment</span><span>KYC</span><span />
              </div>
              {list.map((c) => (
                <button key={c.id} className="dk-row" style={GRID} onClick={() => setOpen(c)}>
                  <span className="who">
                    <Dot tone={tone(c)} />
                    <span style={{ minWidth: 0 }}>
                      <span className="nm" style={{ display: 'block' }}>{c.name}</span>
                      <span className="rf">{c.maskedId} · {c.products.length} product{c.products.length === 1 ? '' : 's'}</span>
                    </span>
                  </span>
                  <span className="mu">{c.headline}</span>
                  <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{money(c.relationshipValue)}</span>
                  <span><span className="dk-tag" style={{ background: `color-mix(in srgb, ${SEG[c.segment]} 16%, transparent)`, color: SEG[c.segment] }}>{c.segment}</span></span>
                  <span>{c.kyc === 'Verified' ? <span className="rf">Verified</span> : <Tag tone="warn">{c.kyc}</Tag>}</span>
                  <span className="ch"><I n="chevron" s={15} /></span>
                </button>
              ))}
            </div>
          ) : <div className="dk-empty"><b>Nothing here</b><span>No clients match this filter.</span></div>}
        </div>
      </div>
    </>
  );
}

const GRID = { gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.2fr) 120px 100px 150px 20px' };
