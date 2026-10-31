// ─────────────────────────────────────────────────────────────────────────────
// The native kit's non-component half: theme tokens, haptics, avatar colour.
// (Kept apart from nkit.tsx so that file only exports components.)
//
// "Ledger": a calm, editorial look. Type and hairlines carry the structure —
// white ground, no cards, no shadows. The bank's navy is the colour of what you
// can act on; its gold only marks things (the active tab, the key number). The
// four statuses are told apart by shape as well as colour (see NStatus).
// ─────────────────────────────────────────────────────────────────────────────
import { useTheme } from '../../contexts/ThemeContext';

export function useNk() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    page: dark ? '#0B0F14' : '#FFFFFF',
    card: dark ? '#0B0F14' : '#FFFFFF',
    raised: dark ? '#151B23' : '#FFFFFF',
    fill: dark ? '#1A212B' : '#F4F5F7',
    ink: dark ? '#EEF2F6' : '#0B1A28',
    ink2: dark ? '#A6B1BD' : '#4A5867',
    ink3: dark ? '#7D8996' : '#66727F',
    sep: dark ? '#222B36' : '#E3E6EA',
    /** Outline of secondary buttons and tags. */
    line: dark ? '#3A4654' : '#B8C4D0',
    bar: dark ? 'rgba(11,15,20,0.94)' : 'rgba(255,255,255,0.94)',
    /** The brand colour for TEXT and icons — lifted toward white on a dark page. */
    accent: dark ? 'color-mix(in srgb, var(--brand-primary) 38%, #fff)' : 'var(--brand-primary)',
    /** The brand colour as a FILL behind white text — a deep brand (navy) is lifted
        enough on a dark page to read as a button, still dark enough for white. */
    brandFill: dark ? 'color-mix(in srgb, var(--brand-primary) 70%, #6f8fb0)' : 'var(--brand-primary)',
    /** The bank's second colour, used only as a marker. */
    mark: 'var(--brand-secondary, #F0BD2D)',
  };
}

/** Status colours, as CSS variables so they follow light and dark (nkit.css).
 *  red = needs you · orange = waiting on someone · blue = moving · green = done. */
export const C = {
  green: 'var(--nk-green)',
  orange: 'var(--nk-orange)',
  red: 'var(--nk-red)',
  blue: 'var(--nk-blue)',
  gray: 'var(--nk-gray)',
  purple: 'var(--nk-purple)',
};

/** The mono face for numbers, references, account numbers and times. */
export const MONO = "'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

/** A light tap of feedback where the device supports it (Android, some webviews). */
export function haptic(kind: 'tap' | 'success' | 'warn' = 'tap'): void {
  try {
    if (typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(kind === 'success' ? [12, 40, 18] : kind === 'warn' ? [30, 30, 30] : [8]);
  } catch { /* unsupported */ }
}

// People are easier to tell apart by colour than by initials alone.
const HUES = ['#5B6CFF', '#0EA5A4', '#E8890C', '#D9467A', '#7A5AF8', '#1FA463', '#2B8DD6', '#C2552B'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const today = (d = new Date()) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** What sits behind the orb film on a home, so its edges disappear into the screen. */
export const HERO_TINT = { light: '#E8EBED', dark: '#000000' };

/** Whether this browser can take speech input (Chrome, Safari; not Firefox). */
export const canListen = () => typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
