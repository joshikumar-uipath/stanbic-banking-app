import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Icn, Pill, TONE, RISK } from './customerUi';
import { approvals, money, type Approval } from '../approvalsData';
import ApprovalDetail from './ApprovalDetail';

type Filter = 'all' | 'value' | 'sla' | 'dual';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'value', label: 'High value' },
  { id: 'sla', label: 'SLA breaching' },
  { id: 'dual', label: 'Dual approval' },
];

export default function ApprovalsTab({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useTheme();
  const [selected, setSelected] = useState<Approval | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const open = approvals.filter((a) => !resolved.has(a.id));
  const pulse = useMemo(() => {
    const list = open;
    return { pending: list.length, value: list.reduce((s, a) => s + a.amount, 0), breaching: list.filter((a) => a.slaBreaching).length, dual: list.filter((a) => !a.withinAuthority).length };
  }, [open]);

  const list = useMemo(() => {
    let c = open;
    if (filter === 'value') c = c.filter((a) => a.amount >= 50000);
    if (filter === 'sla') c = c.filter((a) => a.slaBreaching);
    if (filter === 'dual') c = c.filter((a) => !a.withinAuthority);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, resolved]);

  if (selected) return <ApprovalDetail approval={selected} onBack={() => setSelected(null)} onResolved={(id) => { setResolved((r) => new Set(r).add(id)); setSelected(null); }} />;

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
            <div className="tracking-tight" style={{ fontWeight: 700, fontSize: 24, color: t.textPrimary }}>Approvals</div>
          </div>
          <div style={{ fontSize: 13.5, color: t.textMuted, marginTop: 4 }}>Pending authorizations · maker-checker</div>
        </div>

        {/* Pulse */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <Stat t={t} big={String(pulse.pending)} label="Pending" />
          <Stat t={t} big={pulse.value >= 1000 ? money(Math.round(pulse.value / 1000)) + 'k' : money(pulse.value)} label="Awaiting value" />
          <Stat t={t} big={String(pulse.breaching)} label="SLA breach" tone={pulse.breaching ? TONE.warn : undefined} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px', padding: '0 16px' }}>
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} style={{ flexShrink: 0, border: on ? 'none' : `1px solid ${t.border}`, cursor: 'pointer', borderRadius: 999, padding: '8px 16px', background: on ? 'var(--brand-primary)' : t.bgCard, color: on ? '#fff' : t.textMuted, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.label}</button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {list.length === 0 && <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 13, padding: 28 }}>{open.length === 0 ? 'All caught up — no pending approvals.' : 'Nothing matches this filter.'}</div>}
          {list.map((a) => (
            <button key={a.id} type="button" onClick={() => setSelected(a)} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, cursor: 'pointer', textAlign: 'left', padding: 14, display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(var(--brand-primary-rgb),0.12)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icn name={a.icon} size={22} color="var(--brand-primary)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 2 }}>{a.customer}{a.amount > 0 ? ` · ${money(a.amount)}` : ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
                  <Pill color={a.slaBreaching ? TONE.warn : t.textMuted} soft><Icn name="clock" size={11} color={a.slaBreaching ? TONE.warn : t.textMuted} /> {a.sla}</Pill>
                  {!a.withinAuthority && <Pill color={TONE.warn} soft>Dual approval</Pill>}
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: RISK[a.risk] }} />
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
function Stat({ t, big, label, tone }: { t: T; big: string; label: string; tone?: string }) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 15, padding: '12px 6px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: tone ?? t.textPrimary, letterSpacing: -0.3 }}>{big}</div>
      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
