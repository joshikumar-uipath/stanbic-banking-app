// Shared, theme-agnostic UI bits for the Customers feature (employee app).
import type { CSSProperties, ReactNode } from 'react';
import type { Segment, Risk, Tone } from '../customersData';

const PATHS: Record<string, ReactNode> = {
  users: <><path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="8" r="3.2" /><path d="M21 19a3.5 3.5 0 0 0-5-3.2M3 19a3.5 3.5 0 0 1 5-3.2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></>,
  chevron: <><path d="M9 6l6 6-6 6" /></>,
  back: <><path d="M15 5l-7 7 7 7" /></>,
  trend: <><path d="M4 18l5-5 3 3 7-8" /><path d="M16 8h4v4" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></>,
  phone: <><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  refresh: <><path d="M20 11A8 8 0 0 0 6 6l-2 2M4 13a8 8 0 0 0 14 5l2-2" /><path d="M4 4v4h4M20 20v-4h-4" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  gift: <><rect x="3" y="9" width="18" height="11" rx="1.5" /><path d="M3 13h18M12 9v11M12 9c-2-4-6-3-6 0M12 9c2-4 6-3 6 0" /></>,
  home: <><path d="M3 10.5 12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /></>,
  invest: <><path d="M4 19V5m0 14h16M8 16l3-4 3 2 4-6" /></>,
  building: <><path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3" /></>,
  overdraft: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M8 12h8" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h3M3 10h18" /></>,
  deposit: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  loan: <><circle cx="12" cy="12" r="9" /><path d="M9 9.5a3 3 0 0 1 5 1c0 2-3 2-3 4M12 16h.01" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>,
  phoneSmall: <><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
  note: <><path d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2z" /><path d="M9 8h6M9 12h4" /></>,
  check: <><path d="M5 13l4 4L19 7" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  dot: <><circle cx="12" cy="12" r="4" /></>,
  idcard: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2.2" /><path d="M6 16c0-1.6 1.7-2.2 2.5-2.2S11 14.4 11 16" /><path d="M14 9.5h4M14 12.5h4M14 15h2.5" /></>,
  camera: <><path d="M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.4" /></>,
  scanLine: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M3 12h18" /></>,
};

export function Icn({ name, size = 20, color = 'currentColor', strokeWidth = 1.8, style }: { name: string; size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      {PATHS[name] ?? PATHS.dot}
    </svg>
  );
}

export function Avatar({ initials, size = 46 }: { initials: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 16, flexShrink: 0, background: 'linear-gradient(140deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 55%, #000))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.34, letterSpacing: -0.2, boxShadow: '0 4px 14px rgba(var(--brand-primary-rgb),0.35)' }}>{initials}</span>
  );
}

const SEG: Record<Segment, string> = { Premier: '#C8A24A', Priority: '#7C6CF0', Business: '#2EA8C0', Retail: '#7A8896' };
export function SegBadge({ segment }: { segment: Segment }) {
  const c = SEG[segment];
  return <span style={{ background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, padding: '3px 9px', borderRadius: 7, textTransform: 'uppercase' }}>{segment}</span>;
}

export const TONE: Record<Tone, string> = { good: '#16A968', warn: '#E0904A', info: 'var(--brand-secondary)' };
export const RISK: Record<Risk, string> = { Low: '#16A968', Medium: '#E0904A', High: '#E0533D' };

export function Pill({ children, color, soft }: { children: ReactNode; color: string; soft?: boolean }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: soft ? `color-mix(in srgb, ${color} 14%, transparent)` : color, color: soft ? color : '#fff', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999 }}>{children}</span>;
}
