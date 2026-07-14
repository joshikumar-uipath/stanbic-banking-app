import { C, SHADOW, R, FONT_HEAD } from '../theme';
import Icon from '../icons';
import { useNav } from '../nav';
import { Card } from '../components';
import { customer, moreQuickAccess, moreApply, moreSettings } from '../data';

export default function MoreScreen() {
  const nav = useNav();
  const onItem = (id: string, label: string) => {
    if (id === 'history') return nav.push({ name: 'transactions', title: 'Transaction History' });
    if (id === 'peek') return nav.toggleBalances();
    nav.push({ name: `more-${id}`, title: label });
  };

  return (
    <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card, boxShadow: SHADOW.sm, borderRadius: R.pill, padding: '12px 16px' }}>
        <Icon name="search" size={18} color={C.textFaint} />
        <input placeholder="Search settings & services" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, color: C.text }} />
      </div>

      {/* Profile */}
      <Card>
        <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 56, height: 56, borderRadius: 999, background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 55%, #000))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 20, boxShadow: SHADOW.sm }}>{customer.initials}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, color: C.text, letterSpacing: -0.3 }}>{customer.name}</div>
            <div style={{ fontSize: 13, color: C.textSoft, marginTop: 1 }}>{customer.phone}</div>
          </div>
          <button type="button" onClick={() => nav.push({ name: 'more-profile', title: 'My Profile' })} style={{ background: `rgba(${C.brandRgb},0.10)`, border: 'none', borderRadius: 999, padding: '8px 16px', fontWeight: 600, fontSize: 13, color: C.brand, cursor: 'pointer' }}>Profile</button>
        </div>
      </Card>

      {/* Security checkup */}
      <Card onClick={() => onItem('security', 'Security Checkup')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px' }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: C.goodSoft, color: C.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={22} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.text }}>Security Checkup</span>
            <span style={{ display: 'block', fontSize: 12.5, color: C.textSoft }}>Easy ways to secure your account</span>
          </span>
          <Icon name="chevron" size={18} color={C.textFaint} />
        </div>
      </Card>

      <GridSection title="Quick Access" items={moreQuickAccess} onItem={onItem} />
      <GridSection title="Apply" items={moreApply} onItem={onItem} />

      {/* Settings */}
      <div>
        <GroupLabel>App &amp; Security</GroupLabel>
        <Card>
          {moreSettings.map((s, i) => (
            <button key={s.id} type="button" onClick={() => onItem(s.id, s.label)} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: i > 0 ? `1px solid ${C.hairline}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 18px', textAlign: 'left' }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={19} /></span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: C.text }}>{s.label}</span>
              {s.id === 'peek' || s.id === 'biometric' ? <Toggle on={false} /> : <Icon name="chevron" size={17} color={C.textFaint} />}
            </button>
          ))}
        </Card>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: C.textFaint, padding: '4px 0' }}>Aura Consumer · v1.0.0 (demo)</div>
    </div>
  );
}

function GridSection({ title, items, onItem }: { title: string; items: { id: string; label: string; icon: string }[]; onItem: (id: string, label: string) => void }) {
  return (
    <div>
      <GroupLabel>{title}</GroupLabel>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '18px 6px', rowGap: 20 }}>
          {items.map((it) => (
            <button key={it.id} type="button" onClick={() => onItem(it.id, it.label)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '0 4px' }}>
              <span style={{ width: 48, height: 48, borderRadius: 15, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={it.icon} size={22} strokeWidth={1.9} /></span>
              <span style={{ fontSize: 11.5, color: C.text, textAlign: 'center', lineHeight: 1.25, fontWeight: 500 }}>{it.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, letterSpacing: 0.4, padding: '0 4px 10px', textTransform: 'uppercase' }}>{children}</div>;
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span style={{ width: 42, height: 24, borderRadius: 999, background: on ? 'var(--brand-primary)' : 'rgba(17,24,29,0.16)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
    </span>
  );
}
