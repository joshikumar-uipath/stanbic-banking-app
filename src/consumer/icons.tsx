// Lightweight line-icon set for the consumer app. Stroke-based, inherits
// `color` (currentColor) and `size`. Keyed by name so data files can reference
// icons as strings.
import type { CSSProperties, ReactNode } from 'react';

type P = { name: string; size?: number; color?: string; strokeWidth?: number; style?: CSSProperties };

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /></>,
  pay: <><path d="M4 7h16M4 7l3-3M20 17H4m16 0-3 3" /></>,
  wealth: <><path d="M4 19V5m0 14h16M8 16l3-4 3 2 4-6" /></>,
  more: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  chat: <><path d="M4 5h16v11H9l-4 3v-3H4z" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  back: <><path d="M15 5l-7 7 7 7" /></>,
  chevron: <><path d="M9 6l6 6-6 6" /></>,
  chevronDown: <><path d="M6 9l6 6 6-6" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" /><path d="M12 8v4l3 2" /></>,
  transfer: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  bill: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  cardoff: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M5 5l14 14" /></>,
  doc: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  mpesa: <><circle cx="12" cy="12" r="9" /><path d="M8 14V9l4 3 4-3v5" /></>,
  store: <><path d="M4 9l1-4h14l1 4M5 9v10h14V9M5 9h14" /></>,
  accounts: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 14h4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  sliders: <><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></>,
  bank: <><path d="M3 9l9-5 9 5M5 9v9m14-9v9M9 9v9M15 9v9M3 20h18" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  face: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 10h.01M15 10h.01M9 15c1 1 5 1 6 0" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  star: <><path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 19.2l.9-5.5-4-3.9L9.5 9z" /></>,
  leaf: <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-14 13Z" /><path d="M5 19c3-4 6-6 9-7" /></>,
  gift: <><rect x="3" y="9" width="18" height="11" rx="1.5" /><path d="M3 13h18M12 9v11M12 9c-2-4-6-3-6 0M12 9c2-4 6-3 6 0" /></>,
  sustainability: <><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12 19 5M14 4h5v5" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h3v3M20 14v6M14 20h3" /></>,
  check: <><path d="M5 13l4 4L19 7" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /></>,
  edit: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m13 6 4 4" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="m8.2 11 6.6-3.5M8.2 13l6.6 3.5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  arrowDown: <><path d="M12 5v14M6 13l6 6 6-6" /></>,
};

export default function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.7, style }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}
