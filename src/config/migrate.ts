// Schema migrations for cached / fetched TenantConfig.
//
// When SCHEMA_VERSION bumps, add a migration here keyed by the OLD version.
// Each migration is a pure function: (oldConfig) => nextConfig. They run
// in sequence until oldConfig.schemaVersion === SCHEMA_VERSION.

import { defaultConfig } from './default';
import type { TenantConfig } from './types';
import { SCHEMA_VERSION } from './types';

type Migration = (config: unknown) => unknown;

// Empty for v1 — first version, nothing to migrate from.
const migrations: Record<number, Migration> = {};

export function migrate(raw: unknown): TenantConfig {
  if (!raw || typeof raw !== 'object') return defaultConfig;
  let current = raw as { schemaVersion?: number };
  let version = current.schemaVersion ?? 0;

  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) {
      // Unknown / unhandled version — fall back to defaults rather than
      // shipping a half-migrated config to the rest of the app.
      return defaultConfig;
    }
    current = step(current) as { schemaVersion?: number };
    version = current.schemaVersion ?? version + 1;
  }

  // Backfill any branding fields added after a config was saved (e.g.
  // secondaryColor), pulling defaults for whatever's missing. Keeps older
  // saved/local configs working without a schema bump.
  const cfg = current as unknown as TenantConfig;
  if (cfg && cfg.branding) {
    cfg.branding = { ...defaultConfig.branding, ...cfg.branding };
  }

  // We don't validate the shape at runtime in Phase 0; once Zod arrives in
  // Phase 2 (Data Service loader), this is where parse() goes.
  return cfg;
}
