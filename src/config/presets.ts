// Built-in, non-deletable configuration presets shown at the top of the admin
// picker. Loading one makes it the live config (no profile created); editing +
// saving creates a new named profile copy. The bundled `defaultConfig` IS the
// "Aura AI (Default)" preset (Robotic Orange + Agentic Teal + Deep Blue); the
// Zara one is the red alternative.

import type { TenantConfig } from './types';
import { defaultConfig } from './default';

// Resolve a bundled public asset (logo/favicon) against the APP BASE, so it loads both
// on localhost (served at "/") and when deployed as a UiPath coded app (the host injects
// <base href="/<app>/"> and the assets live under that path). Resolving against the base —
// not the current route — also fixes deep routes like /kyc/:token, where a route-relative
// path would ask the SPA for /kyc/logo.png and get index.html back. A leading-"/" absolute
// path breaks the coded-app case (it escapes the app); this fixes both.
export const asset = (name: string): string => {
  try {
    const base = (typeof document !== 'undefined' && document.querySelector('base')?.getAttribute('href')) || '/';
    const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    return new URL(name, new URL(base, origin)).pathname;
  } catch { return '/' + name; }
};

export const DEFAULT_PRESET_ID = '__default__';
export const ZARA_PRESET_ID = '__preset_zara__';
export const STANBIC_PRESET_ID = '__preset_stanbic__';
// Back-compat: an earlier build had a separate "Aura (UiPath)" preset. Its id
// now resolves to the Aura AI default (same look), so existing active configs
// keep working. Kept exported so older imports don't break.
export const UIPATH_PRESET_ID = '__preset_uipath__';

// The previous bundled default (red), kept as a selectable alternative.
const zaraConfig: TenantConfig = {
  ...defaultConfig,
  branding: {
    ...defaultConfig.branding,
    appName: 'Zara AI',
    tagline: 'Your AI assistant, at your fingertips',
    primaryColor: '#FF3333',
    secondaryColor: '#1E6482',
    accentColor: '#1A1A1A',
    deepBlue: '#182126',
  },
};

// Stanbic IBTC — the retail-banking / account-opening identity. Stanbic blue as
// primary with the brighter sky blue alongside it; the consumer app defaults to
// this, and it's selectable here so the whole app can wear it.
export const stanbicConfig: TenantConfig = {
  ...defaultConfig,
  branding: {
    ...defaultConfig.branding,
    appName: 'Stanbic IBTC',
    tagline: 'Banking that moves with you',
    // Ships with the preset, so every surface (desk rail, phone, customer app,
    // KYC link) is branded on a fresh browser without an admin upload first.
    // Admin → Branding still overrides it.
    // NB: the artwork is the full wordmark in Stanbic blue on a TRANSPARENT
    // background (2026-08-20 refresh — it replaced a version that was white on a
    // solid #0032A1 plate, which needed the surface painted behind it to hide the
    // plate). Being blue on transparent it belongs on LIGHT surfaces only; a dark
    // one needs `logoLight` below, or it is blue on navy.
    // Resolved against the app base via asset() — works at "/" (localhost, any route
    // incl. /kyc/:token) AND under the coded-app base path (/<app>/stanbic-logo.png).
    logo: asset('stanbic-logo.png'),
    // Transparent-background variant for the navy nav rails (desk + ops), so the
    // logo blends in rather than showing its blue plate as a box. The plated
    // `logo` above still serves light surfaces (home launcher).
    logoLight: asset('stanbic-logo-light.png'),
    // Square shield mark for the browser tab and any compact spot — and it is what
    // the desk/ops nav rail shows, on the white plate `.dk-mark` paints. Without
    // this the tab falls back to an auto-generated initial. Refreshed 2026-08-20
    // from the supplied .ico (256px frame): flat Stanbic blue on transparent,
    // replacing the older gradient shield on a blue square.
    favicon: asset('stanbic-favicon.png'),
    primaryColor: '#0033A1',
    secondaryColor: '#0091DA',
    accentColor: '#0091DA',
    deepBlue: '#012169',
  },
};

export interface BuiltinPreset {
  id: string;
  name: string;
  config: TenantConfig;
}

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  { id: DEFAULT_PRESET_ID, name: 'Aura AI (Default)', config: defaultConfig },
  { id: STANBIC_PRESET_ID, name: 'Stanbic IBTC', config: stanbicConfig },
  { id: ZARA_PRESET_ID, name: 'Zara AI', config: zaraConfig },
];

/** Resolve a preset by id (or null if the id isn't a built-in preset). */
export function getPresetById(id: string | null): BuiltinPreset | null {
  if (!id) return null;
  // Legacy UiPath preset → the Aura AI default (identical look).
  if (id === UIPATH_PRESET_ID) return BUILTIN_PRESETS[0];
  return BUILTIN_PRESETS.find((p) => p.id === id) ?? null;
}
