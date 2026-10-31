import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { TenantConfig } from './types';
import { defaultConfig } from './default';
import { setActiveBank } from './bank';

// ConfigContext exposes the *currently effective* config — bundled default
// merged with any tenant override (cached or freshly-fetched). Components
// read it via useConfig().
const ConfigContext = createContext<TenantConfig>(defaultConfig);

// Separate context for updates so reading useConfig() doesn't re-render
// just because someone re-set the same value. Components that need to
// hydrate the override (the Data Service loader in Phase 2) call
// useConfigUpdater() to get a stable setter.
const ConfigUpdaterContext = createContext<(next: TenantConfig | null) => void>(() => {});

/**
 * Picks the effective config given an override. Today this is full-replace
 * (admin form ships a complete TenantConfig). If we later want partial
 * overrides, this is the spot to deep-merge against defaultConfig.
 */
function effective(override: TenantConfig | null): TenantConfig {
  return override ?? defaultConfig;
}

interface Props {
  children: ReactNode;
  /**
   * Cached or pre-resolved tenant config to seed the provider with. Used
   * by App.tsx to hand in localStorage-cached config so first paint already
   * uses the tenant's branding. Pass null/undefined to start with the
   * bundled default.
   */
  initialOverride?: TenantConfig | null;
}

export function ConfigProvider({ children, initialOverride }: Props) {
  const [override, setOverride] = useState<TenantConfig | null>(initialOverride ?? null);
  const updater = useCallback((next: TenantConfig | null) => setOverride(next), []);
  const config = effective(override);
  // Keep the non-React bank identity (comms, references) on the theme in view.
  setActiveBank(config.branding);
  return (
    <ConfigUpdaterContext.Provider value={updater}>
      <ConfigContext.Provider value={config}>
        {children}
      </ConfigContext.Provider>
    </ConfigUpdaterContext.Provider>
  );
}

export function useConfig(): TenantConfig {
  return useContext(ConfigContext);
}

/**
 * Returns a stable setter to replace the active override. Pass null to
 * revert to the bundled default. Most callers should use this only via
 * the Data Service loader effect (post-SSO fetch) or admin app preview.
 */
export function useConfigUpdater(): (next: TenantConfig | null) => void {
  return useContext(ConfigUpdaterContext);
}
