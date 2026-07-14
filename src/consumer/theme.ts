// Light & airy premium palette. Brand colours come from CSS variables
// (--brand-primary / --brand-secondary) so the app re-themes per white-label
// brand. Soft layered shadows + generous radii give depth without heavy chrome.
export const C = {
  page: '#F4F5F8',
  card: '#FFFFFF',
  cardAlt: '#FBFBFD',
  text: '#11181D',
  textSoft: 'rgba(17,24,29,0.52)',
  textFaint: 'rgba(17,24,29,0.34)',
  border: 'rgba(17,24,29,0.07)',
  borderStrong: 'rgba(17,24,29,0.12)',
  hairline: 'rgba(17,24,29,0.05)',
  good: '#16A968',
  goodSoft: 'rgba(22,169,104,0.12)',
  warn: '#E0533D',
  warnSoft: 'rgba(224,83,61,0.12)',
  brand: 'var(--brand-primary)',
  brandRgb: 'var(--brand-primary-rgb)',
  secondary: 'var(--brand-secondary)',
  secondaryRgb: 'var(--brand-secondary-rgb)',
} as const;

// Layered, soft shadows for an airy premium depth.
export const SHADOW = {
  sm: '0 1px 2px rgba(17,24,29,0.05)',
  md: '0 6px 20px -6px rgba(17,24,29,0.12), 0 2px 6px rgba(17,24,29,0.05)',
  lg: '0 18px 40px -12px rgba(17,24,29,0.18), 0 4px 12px rgba(17,24,29,0.06)',
  brand: '0 16px 34px -10px rgba(var(--brand-primary-rgb),0.45)',
  nav: '0 -2px 24px rgba(17,24,29,0.08)',
} as const;

export const R = { card: 22, tile: 18, pill: 999, sm: 12 } as const;

export const FONT_HEAD = "'Poppins', Arial, sans-serif";
export const FONT_BODY = "'Inter', Arial, sans-serif";

// Subtle page background with a faint brand glow at the top.
export const PAGE_BG = `radial-gradient(130% 55% at 50% -8%, rgba(var(--brand-primary-rgb),0.07) 0%, transparent 60%), ${C.page}`;
