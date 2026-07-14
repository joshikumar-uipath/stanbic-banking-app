import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Icn, Avatar, SegBadge, Pill, TONE } from './customerUi';
import { customers, branchPulse, money, type Customer } from '../customersData';
import Customer360 from './Customer360';
import ScanId from './ScanId';

type Filter = 'all' | 'value' | 'risk' | 'maturing' | 'kyc';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'value', label: 'High value' },
  { id: 'risk', label: 'At-risk' },
  { id: 'maturing', label: 'Maturing' },
  { id: 'kyc', label: 'KYC due' },
];

export default function CustomersTab({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useTheme();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const pulse = branchPulse();

  const list = useMemo(() => {
    let c = customers;
    if (filter === 'value') c = c.filter((x) => x.relationshipValue >= 100000);
    if (filter === 'risk') c = c.filter((x) => x.headlineTone === 'warn');
    if (filter === 'maturing') c = c.filter((x) => x.products.some((p) => /matur/i.test(p.status ?? '')) || /matur/i.test(x.headline));
    if (filter === 'kyc') c = c.filter((x) => x.kyc !== 'Verified');
    if (query.trim()) c = c.filter((x) => x.name.toLowerCase().includes(query.toLowerCase()));
    return c;
  }, [filter, query]);

  if (scanning) return <ScanId onBack={() => setScanning(false)} onMatched={(c) => { setScanning(false); setSelected(c); }} />;
  if (selected) return <Customer360 customer={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: t.bgPage }}>
      <div style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onClose && (
              <button type="button" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 999, background: t.backBtnBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icn name="back" size={20} color={t.backBtnIcon} />
              </button>
            )}
            <div className="tracking-tight" style={{ fontWeight: 700, fontSize: 24, color: t.textPrimary }}>Customers</div>
          </div>
          <div style={{ fontSize: 13.5, color: t.textMuted, marginTop: 4 }}>Key relationships · Branch view</div>
        </div>

        {/* Branch pulse */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <Stat t={t} n={pulse.relationships} label="Relationships" />
          <Stat t={t} n={pulse.atRisk} label="At-risk" tone={TONE.warn} />
          <Stat t={t} n={pulse.nbas} label="Actions" tone="var(--brand-primary)" />
          <Stat t={t} n={pulse.kycDue} label="KYC due" tone={TONE.warn} />
        </div>

        {/* Scan ID — branch walk-in */}
        <button type="button" onClick={() => setScanning(true)} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.22)', borderRadius: 16, padding: '13px 14px', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 5px 14px rgba(var(--brand-primary-rgb),0.4)' }}><Icn name="idcard" size={22} color="#fff" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.textPrimary }}>Scan customer ID</span>
            <span style={{ display: 'block', fontSize: 12.5, color: t.textMuted, marginTop: 1 }}>Walk-in? Scan their ID to pull up their profile</span>
          </span>
          <Icn name="chevron" size={18} color={t.chevron} />
        </button>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 999, padding: '11px 16px' }}>
          <Icn name="search" size={18} color={t.textMuted} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, color: t.textPrimary }} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px', padding: '0 16px' }}>
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} style={{
                flexShrink: 0, border: on ? 'none' : `1px solid ${t.border}`, cursor: 'pointer', borderRadius: 999, padding: '8px 16px',
                background: on ? 'var(--brand-primary)' : t.bgCard, color: on ? '#fff' : t.textMuted, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}>{f.label}</button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {list.length === 0 && <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: 24 }}>No customers match.</div>}
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => setSelected(c)} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, cursor: 'pointer', textAlign: 'left', padding: 14, display: 'flex', alignItems: 'center', gap: 13 }}>
              <Avatar initials={c.initials} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: t.textPrimary, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <SegBadge segment={c.segment} />
                </div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>{money(c.relationshipValue)} · {c.products.length} products</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Pill color={TONE[c.headlineTone]} soft>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: TONE[c.headlineTone] }} /> {c.headline}
                  </Pill>
                  {c.nbas.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-primary)' }}>✦ {c.nbas.length} actions</span>}
                </div>
              </div>
              <Icn name="chevron" size={18} color={t.chevron} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTheme>['t'];
function Stat({ t, n, label, tone }: { t: T; n: number; label: string; tone?: string }) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 15, padding: '12px 6px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 20, color: tone ?? t.textPrimary, letterSpacing: -0.3 }}>{n}</div>
      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
