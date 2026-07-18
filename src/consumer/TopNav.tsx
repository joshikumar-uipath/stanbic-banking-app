// ─────────────────────────────────────────────────────────────────────────────
// Internet banking chrome — /customer-web only.
//
// The phone puts five tabs on a bottom bar because a thumb lives there. A laptop
// doesn't have a thumb: the nav goes across the top, which is what every bank's
// internet banking looks like and what a customer expects. Deliberately NOT the
// employee desk's left rail — a customer should never feel they've been handed
// the staff system.
//
// Same screens underneath. Only the chrome changes.
// ─────────────────────────────────────────────────────────────────────────────
import { C, SHADOW, FONT_BODY, FONT_HEAD } from './theme';
import Icon from './icons';
import { useNav, type TabId } from './nav';
import { useConfig } from '../config';
import { customer } from './data';

const LINKS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'pay', label: 'Pay & transfer' },
  { id: 'open', label: 'Open an account' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'more', label: 'More' },
];

export default function TopNav() {
  const nav = useNav();
  const { branding } = useConfig();

  return (
    <header style={{
      flexShrink: 0, background: C.card, borderBottom: `1px solid ${C.border}`,
      boxShadow: SHADOW.sm, position: 'relative', zIndex: 10,
    }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto', padding: '0 24px', height: 68,
        display: 'flex', alignItems: 'center', gap: 28,
      }}>
        {branding.logo
          ? <img src={branding.logo} alt={branding.appName} style={{ maxHeight: 34, maxWidth: 160, objectFit: 'contain', borderRadius: 4, flex: '0 0 auto' }} />
          : <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17, color: C.brand, flex: '0 0 auto' }}>{branding.appName}</span>}

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
          {LINKS.map((l) => {
            const on = nav.tab === l.id;
            return (
              <button key={l.id} type="button" onClick={() => nav.resetTo(l.id)} aria-current={on ? 'page' : undefined} style={{
                border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 14px',
                fontFamily: FONT_BODY, fontSize: 14, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
                background: on ? `rgba(var(--brand-primary-rgb), 0.09)` : 'transparent',
                color: on ? C.brand : C.textSoft,
              }}>{l.label}</button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
          <IconBtn name="bell" label="Notifications" badge={4} onClick={() => nav.push({ name: 'notifications' })} />
          <IconBtn name="chat" label="Ask Digibot" onClick={nav.openDigibot} />
          <span style={{
            width: 36, height: 36, borderRadius: 999, background: C.brand, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, marginLeft: 4,
          }}>{customer.initials}</span>
        </div>
      </div>
    </header>
  );
}

function IconBtn({ name, label, badge, onClick }: { name: string; label: string; badge?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} style={{
      position: 'relative', width: 38, height: 38, borderRadius: 999, border: 'none', cursor: 'pointer',
      background: C.page, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={name} size={18} />
      {badge ? (
        <span style={{
          position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 999,
          background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.card}`,
        }}>{badge}</span>
      ) : null}
    </button>
  );
}
