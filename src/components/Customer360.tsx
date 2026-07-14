import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Icn, Avatar, SegBadge, Pill, TONE, RISK } from './customerUi';
import { money, type Customer, type NBA, type Product } from '../customersData';

export default function Customer360({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const { t, theme } = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const act = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2200); };
  const nbas = customer.nbas.filter((n) => !dismissed.has(n.id));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bgPage }}>
      {/* Header */}
      <div style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
          <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 999, background: t.backBtnBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icn name="back" size={20} color={t.backBtnIcon} />
          </button>
          <span className="tracking-tight" style={{ fontWeight: 700, fontSize: 19, color: t.textPrimary }}>Customer 360</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
       <div style={{ padding: '6px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={customer.initials} size={58} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="tracking-tight" style={{ fontWeight: 700, fontSize: 19, color: t.textPrimary }}>{customer.name}</span>
              <SegBadge segment={customer.segment} />
            </div>
            <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 3 }}>{customer.maskedId} · Customer since {customer.since} · RM: {customer.rm}</div>
          </div>
        </div>

        {/* Governance + risk strip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.textMuted, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 999, padding: '5px 11px' }}>
            <Icn name="lock" size={13} color={t.textMuted} /> View logged · PII masked
          </span>
          <Pill color={RISK[customer.risk]} soft><Icn name="shield" size={12} color={RISK[customer.risk]} /> {customer.risk} risk</Pill>
          <Pill color={customer.kyc === 'Verified' ? TONE.good : TONE.warn} soft><Icn name="check" size={12} color={customer.kyc === 'Verified' ? TONE.good : TONE.warn} /> KYC: {customer.kyc}</Pill>
        </div>

        {/* Snapshot KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <Kpi t={t} label="Relationship value" value={money(customer.relationshipValue)} strong />
          <Kpi t={t} label="Products" value={String(customer.products.length)} />
          <Kpi t={t} label="Monthly profit" value={money(customer.monthlyProfit)} />
          <Kpi t={t} label="Lifetime value" value={money(customer.clv)} />
        </div>

        {/* NEXT BEST ACTIONS */}
        <Section t={t} title="Next best actions" right={<span style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600 }}>{nbas.length} suggested</span>} icon="sparkle" />
        {nbas.length === 0 && <Muted t={t}>All suggestions actioned. Nice work.</Muted>}
        {nbas.map((n) => (
          <NbaCard key={n.id} t={t} theme={theme} nba={n} onAction={(label) => { if (label === 'Dismiss') setDismissed((d) => new Set(d).add(n.id)); else act(`"${label}" — sent for approval (maker-checker)`); }} />
        ))}

        {/* Products */}
        <Section t={t} title="Products & accounts" icon="building" />
        <Card t={t}>
          {customer.products.map((p, i) => <ProductRow key={i} t={t} p={p} divider={i > 0} />)}
        </Card>

        {/* Signals */}
        <Section t={t} title="Signals" icon="trend" />
        <Card t={t}>
          {customer.signals.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 16px', borderTop: i > 0 ? `1px solid ${t.divider}` : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: TONE[s.tone], marginTop: 5, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13.5, color: t.textBody }}>{s.text}</span>
              <span style={{ fontSize: 11.5, color: t.textMuted, whiteSpace: 'nowrap' }}>{s.when}</span>
            </div>
          ))}
        </Card>

        {/* Cases & notes */}
        {(customer.cases.length > 0 || customer.notes.length > 0) && (
          <>
            <Section t={t} title="Cases & notes" icon="note" />
            <Card t={t}>
              {customer.cases.map((c, i) => (
                <div key={c.ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderTop: i > 0 ? `1px solid ${t.divider}` : 'none' }}>
                  <span style={{ fontSize: 13.5, color: t.textBody }}>{c.title} <span style={{ color: t.textMuted }}>· {c.ref}</span></span>
                  <Pill color={c.status === 'Open' ? TONE.warn : TONE.good} soft>{c.status}</Pill>
                </div>
              ))}
              {customer.notes.map((nt, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: (i > 0 || customer.cases.length > 0) ? `1px solid ${t.divider}` : 'none' }}>
                  <Icn name="note" size={16} color={t.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13.5, color: t.textBody }}>{nt}</span>
                </div>
              ))}
            </Card>
          </>
        )}

        <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'center', padding: '4px 16px', lineHeight: 1.5 }}>
          Actions require two-person approval (maker-checker). Every view and action is audit-logged.
        </div>
       </div>
      </div>

      {/* Manager action bar */}
      <div style={{ flexShrink: 0, background: t.navBg, borderTop: `1px solid ${t.navBorder}`, backdropFilter: 'blur(20px)', padding: '10px 12px max(env(safe-area-inset-bottom), 10px)', display: 'flex', gap: 8 }}>
        <BarBtn t={t} primary label="Approve" icon="check" onClick={() => act('Exception approved — routed to checker')} />
        <BarBtn t={t} label="Waive fee" icon="cash" onClick={() => act('Fee waiver sent for approval')} />
        <BarBtn t={t} label="Note" icon="note" onClick={() => act('Note added to file')} />
        <BarBtn t={t} label="Call" icon="phone" onClick={() => act(`Calling ${customer.name.split(' ')[0]}…`)} />
      </div>

      {toast && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 84, background: '#11181d', color: '#fff', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 500, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', textAlign: 'center', zIndex: 30 }}>{toast}</div>
      )}
    </div>
  );
}

type T = ReturnType<typeof useTheme>['t'];

function Card({ t, children }: { t: T; children: React.ReactNode }) {
  return <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, overflow: 'hidden' }}>{children}</div>;
}
function Section({ t, title, right, icon }: { t: T; title: string; right?: React.ReactNode; icon?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <Icn name={icon} size={17} color="var(--brand-primary)" />}
        <span style={{ fontWeight: 700, fontSize: 16, color: t.textPrimary, letterSpacing: -0.3 }}>{title}</span>
      </span>
      {right}
    </div>
  );
}
function Muted({ t, children }: { t: T; children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: 16 }}>{children}</div>;
}
function Kpi({ t, label, value, strong }: { t: T; label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: '13px 14px' }}>
      <div style={{ fontSize: 11.5, color: t.textMuted }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: strong ? 19 : 16, color: strong ? 'var(--brand-primary)' : t.textPrimary, marginTop: 4, letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
}

function NbaCard({ t, theme, nba, onAction }: { t: T; theme: 'dark' | 'light'; nba: NBA; onAction: (label: string) => void }) {
  const accent = nba.kind === 'risk' ? '#E0904A' : 'var(--brand-primary)';
  const accentRgb = nba.kind === 'risk' ? '224,144,74' : 'var(--brand-primary-rgb)';
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 30%, transparent))` }} />
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icn name={nba.icon} size={21} color={accent} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, lineHeight: 1.3 }}>{nba.title}</div>
            <div style={{ fontSize: 13, color: t.textBody, lineHeight: 1.5, marginTop: 4 }}>{nba.rationale}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8 }}>{nba.value}</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: t.textMuted }}>{nba.confidence}%</span>
            <span style={{ width: 46, height: 5, borderRadius: 999, background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${nba.confidence}%`, background: accent, borderRadius: 999 }} />
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {nba.actions.map((a, i) => {
            const primary = i === 0;
            return (
              <button key={a} type="button" onClick={() => onAction(a)} style={{
                flex: primary ? 1 : undefined, minWidth: primary ? 120 : undefined,
                border: primary ? 'none' : `1px solid ${t.border}`, cursor: 'pointer', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: primary ? accent : (theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)'),
                color: primary ? '#fff' : t.textBody,
                boxShadow: primary ? `0 6px 16px rgba(${accentRgb},0.4)` : 'none',
              }}>{a}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProductRow({ t, p, divider }: { t: T; p: Product; divider?: boolean }) {
  const neg = p.balance < 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: divider ? `1px solid ${t.divider}` : 'none' }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(var(--brand-primary-rgb),0.12)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icn name={p.type} size={19} color="var(--brand-primary)" /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{p.name}</span>
        {p.status && <span style={{ display: 'block', fontSize: 12, color: t.textMuted, marginTop: 1 }}>{p.status}</span>}
      </span>
      <span style={{ fontWeight: 700, fontSize: 14.5, color: neg ? '#E0533D' : t.textPrimary, whiteSpace: 'nowrap' }}>{money(p.balance)}</span>
    </div>
  );
}

function BarBtn({ t, label, icon, primary, onClick }: { t: T; label: string; icon: string; primary?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, border: 'none', cursor: 'pointer', borderRadius: 14, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      background: primary ? 'var(--brand-primary)' : (t.bgCardStrong), color: primary ? '#fff' : t.textBody,
      boxShadow: primary ? '0 6px 16px rgba(var(--brand-primary-rgb),0.4)' : 'none',
    }}>
      <Icn name={icon} size={19} color={primary ? '#fff' : t.textBody} />
      <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
    </button>
  );
}
