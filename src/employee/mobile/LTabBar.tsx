// The phone's tab bar: a floating pill in the bank's primary colour. The tab
// you are on is a white pill carrying its icon and name in that colour — white
// reads on every bank's theme, where a second brand colour may not. The others
// are icons only; Alerts carries a count badge.
import type { ReactNode } from 'react';
import type { Tab } from '../../components/BottomNav';
import { useNk, haptic } from './nk';
import './nkit.css';

const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6h-6v6H4.5a1 1 0 0 1-1-1z" />,
  chat: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17A1.5 1.5 0 0 1 4 15.5z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></>,
  explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  alerts: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'chat', label: 'Aura' },
  { id: 'explore', label: 'Explore' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'profile', label: 'Profile' },
];

export default function LTabBar({ active, onChange, alerts = 0 }: { active: Tab; onChange: (t: Tab) => void; alerts?: number }) {
  const nk = useNk();
  return (
    <div className="lt-dock" style={{ background: nk.page }}>
      <nav className="lt-bar" aria-label="Main" style={{ background: nk.brandFill }}>
        {TABS.map((t) => {
          const on = t.id === active;
          const label = t.id === 'alerts' && alerts > 0 ? `${t.label}, ${alerts} new` : t.label;
          return (
            <button key={t.id} type="button" className={`lt-tab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}
              aria-label={on ? undefined : label} onClick={() => { haptic(); onChange(t.id); }}
              style={on ? { background: '#fff', color: nk.dark ? '#0B1A28' : 'var(--brand-primary)', boxShadow: '0 2px 8px rgba(0,0,0,.18)' } : { color: 'rgba(255,255,255,0.82)' }}>
              <svg width={on ? 22 : 24} height={on ? 22 : 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ICONS[t.id]}
              </svg>
              {on && <span>{t.label}</span>}
              {t.id === 'alerts' && alerts > 0 && !on && (
                <span className="lt-badge" style={{ background: '#fff', color: 'var(--brand-primary)', boxShadow: `0 0 0 2px ${nk.brandFill}` }} aria-hidden>{alerts > 9 ? '9+' : alerts}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
