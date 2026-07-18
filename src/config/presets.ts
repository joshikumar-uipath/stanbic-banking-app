// Built-in, non-deletable configuration presets shown at the top of the admin
// picker. Loading one makes it the live config (no profile created); editing +
// saving creates a new named profile copy. The bundled `defaultConfig` IS the
// "Aura AI (Default)" preset (Robotic Orange + Agentic Teal + Deep Blue); the
// Zara one is the red alternative.

import type { TenantConfig } from './types';
import { defaultConfig } from './default';

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
    // NB: the artwork is white on a solid blue plate — the blue is #0032A1,
    // i.e. primaryColor. Surfaces that place it on a dark background paint the
    // area primaryColor so the plate disappears rather than reading as a box.
    // Root-absolute, NOT './': a relative path resolves against the current
    // route, so on /kyc/:token it asked for /kyc/stanbic-logo.png — which the SPA
    // server answers with index.html (200 text/html, not a 404), so the <img>
    // silently got HTML and fell back to the wordmark.
    logo: '/stanbic-logo.png',
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
