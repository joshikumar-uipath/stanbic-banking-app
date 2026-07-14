// Reusable presentational primitives — light & airy premium.
import type { CSSProperties, ReactNode } from 'react';
import { C, SHADOW, R, FONT_HEAD } from './theme';
import { money } from './data';
import Icon from './icons';
import { useNav } from './nav';

/** White rounded card with a soft layered shadow. */
export function Card({ children, style, onClick, soft }: { children: ReactNode; style?: CSSProperties; onClick?: () => void; soft?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card, borderRadius: R.card, boxShadow: soft ? SHADOW.sm : SHADOW.md,
        overflow: 'hidden', cursor: onClick ? 'pointer' : undefined, ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Uppercase section label with optional right slot. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 10px' }}>
      <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16.5, color: C.text, letterSpacing: -0.2 }}>{children}</span>
      {right}
    </div>
  );
}

/** Money amount that respects the global "hide balances" toggle. */
export function Amount({ value, dp = 2, size = 18, weight = 700, color = C.text }: { value: number; dp?: number; size?: number; weight?: number; color?: string }) {
  const { hideBalances } = useNav();
  const text = hideBalances ? '••••••' : money(value, dp);
  const neg = value < 0;
  return (
    <span style={{ fontFamily: FONT_HEAD, fontWeight: weight, fontSize: size, color: neg && !hideBalances ? C.warn : color, whiteSpace: 'nowrap', letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}

/** A tappable list row: optional icon, title/subtitle, right content + chevron. */
export function ListRow({ icon, title, subtitle, right, onClick, chevron = true, danger }: {
  icon?: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', background: 'transparent', border: 'none', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px', cursor: onClick ? 'pointer' : 'default',
    }}>
      {icon && (
        <span style={{ width: 42, height: 42, borderRadius: 13, background: `rgba(${C.brandRgb},0.10)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.brand }}>
          <Icon name={icon} size={21} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: danger ? C.warn : C.text }}>{title}</span>
        {subtitle && <span style={{ display: 'block', fontSize: 12.5, color: C.textSoft, marginTop: 2 }}>{subtitle}</span>}
      </span>
      {right}
      {chevron && onClick && <Icon name="chevron" size={18} color={C.textFaint} />}
    </button>
  );
}

/** Pill-style segmented tabs (rounded track). */
export function SegTabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(17,24,29,0.05)', borderRadius: R.pill, padding: 4 }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            flex: 1, border: 'none', cursor: 'pointer', padding: '9px 4px', borderRadius: R.pill,
            background: on ? C.card : 'transparent', boxShadow: on ? SHADOW.sm : 'none',
            fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: on ? C.text : C.textSoft, transition: 'all 0.18s',
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pill / chip. */
export function Pill({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: active ? 'var(--brand-primary)' : C.card, border: active ? 'none' : `1px solid ${C.border}`,
      boxShadow: active ? 'none' : SHADOW.sm,
      borderRadius: R.pill, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: active ? '#fff' : C.textSoft, cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap', transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

/** Small coloured tag/badge. */
export function Tag({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'good' | 'neutral' }) {
  const map = {
    brand: { bg: `rgba(${C.brandRgb},0.12)`, col: C.brand },
    good: { bg: C.goodSoft, col: C.good },
    neutral: { bg: 'rgba(17,24,29,0.06)', col: C.textSoft },
  }[tone];
  return <span style={{ background: map.bg, color: map.col, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, padding: '3px 8px', borderRadius: 7, textTransform: 'uppercase' }}>{children}</span>;
}

/** A risk meter (1–5 dots). */
export function RiskMeter({ level }: { level: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: i <= level ? C.brand : 'rgba(17,24,29,0.12)' }} />
      ))}
    </span>
  );
}

/** Gradient area sparkline. Pass a series of values. */
export function Sparkline({ data, w = 92, h = 36, color = 'var(--brand-primary)' }: { data: number[]; w?: number; h?: number; color?: string }) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const id = `spk${Math.round(min)}_${data.length}_${Math.round(max)}`;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.6} fill={color} />
    </svg>
  );
}

/** Thin divider. */
export function Divider() {
  return <div style={{ height: 1, background: C.hairline }} />;
}

/** Large screen title. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 26, color: C.text, letterSpacing: -0.6, padding: '4px 2px 0' }}>{children}</div>;
}

/** Circular initials avatar (brand-tinted). */
export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.33, flexShrink: 0, fontFamily: FONT_HEAD }}>{initials}</span>
  );
}

/** Scrollable chip-style tab bar (for many tabs). */
export function ChipTabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px', padding: '0 16px' }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            flexShrink: 0, background: on ? 'var(--brand-primary)' : C.card, color: on ? '#fff' : C.textSoft,
            border: 'none', boxShadow: on ? 'none' : SHADOW.sm, borderRadius: R.pill, padding: '9px 18px',
            fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}
