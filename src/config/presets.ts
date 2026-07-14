// Built-in, non-deletable configuration presets shown at the top of the admin
// picker. Loading one makes it the live config (no profile created); editing +
// saving creates a new named profile copy. The bundled `defaultConfig` IS the
// "Aura AI (Default)" preset (Robotic Orange + Agentic Teal + Deep Blue); the
// Zara one is the red alternative.

import type { TenantConfig } from './types';
import { defaultConfig } from './default';

export const DEFAULT_PRESET_ID = '__default__';
export const ZARA_PRESET_ID = '__preset_zara__';
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

export interface BuiltinPreset {
  id: string;
  name: string;
  config: TenantConfig;
}

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  { id: DEFAULT_PRESET_ID, name: 'Aura AI (Default)', config: defaultConfig },
  { id: ZARA_PRESET_ID, name: 'Zara AI', config: zaraConfig },
];

/** Resolve a preset by id (or null if the id isn't a built-in preset). */
export function getPresetById(id: string | null): BuiltinPreset | null {
  if (!id) return null;
  // Legacy UiPath preset → the Aura AI default (identical look).
  if (id === UIPATH_PRESET_ID) return BUILTIN_PRESETS[0];
  return BUILTIN_PRESETS.find((p) => p.id === id) ?? null;
}
