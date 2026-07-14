// Tenant-scoped runtime config loader.
//
// Phase 2 architecture:
//   - On boot, ConfigProvider seeds from localStorage cache (if present and
//     for the current tenant). UI renders immediately — zero fetch on boot.
//   - After SSO completes, useTenantConfigLoader() fetches the latest config
//     from Data Service in the background and applies it via setOverride().
//   - The fetched config is also written back to localStorage with a TTL.
//
// "Tenant" here = (orgName, tenantName) pair from the device's TenantConnection.
// Switching tenant clears the cache (Profile > Switch tenant calls clearCachedConfigs()).

import { useEffect, useRef } from 'react';
import type { UiPath } from '@uipath/uipath-typescript/core';
import type { TenantConfig } from './types';
import { migrate } from './migrate';
import { getPresetById } from './presets';
import type { TenantConnection } from '../onboarding/tenantSelection';

const CACHE_PREFIX = 'aura_tenant_config_v1:';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEnvelope {
  tenantId: string;
  config: TenantConfig;
  fetchedAt: string;
}

function tenantId(conn: TenantConnection): string {
  return `${conn.orgName}/${conn.tenantName}`;
}

function cacheKey(conn: TenantConnection): string {
  return `${CACHE_PREFIX}${tenantId(conn)}`;
}

/**
 * Build the Data Service base URL for the tenant. Mirrors the Orchestrator
 * URL convention used in ExploreTab — `dataservice_` instead of
 * `orchestrator_`.
 */
function dataServiceBase(conn: TenantConnection): string {
  if (import.meta.env.DEV) return `/${conn.orgName}/${conn.tenantName}/dataservice_`;
  // Data Service data APIs are authorized + CORS-enabled on the PORTAL host
  // (e.g. staging.uipath.com), but return 403 "not authorized" on the api host
  // (staging.api.uipath.com) in this tenant. Unlike orchestrator_ (which needs
  // the api host for CORS), the portal host sends CORS for dataservice_, so the
  // runtime reads the config straight from the portal host. See the matching
  // note in admin/lib/adminTenant.ts → apiBaseFor.
  const host = conn.baseUrl.replace(/\/$/, '');
  return `${host}/${conn.orgName}/${conn.tenantName}/dataservice_`;
}

/** Read cached config for this tenant. Returns null if missing or stale. */
export function loadCachedConfig(conn: TenantConnection): TenantConfig | null {
  try {
    const raw = localStorage.getItem(cacheKey(conn));
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope;
    if (env.tenantId !== tenantId(conn)) return null;
    const ageMs = Date.now() - new Date(env.fetchedAt).getTime();
    if (ageMs > CACHE_TTL_MS) return null;
    return migrate(env.config);
  } catch {
    return null;
  }
}

/** Persist a freshly-fetched config for this tenant. */
export function saveCachedConfig(conn: TenantConnection, config: TenantConfig): void {
  const env: CacheEnvelope = {
    tenantId: tenantId(conn),
    config,
    fetchedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(cacheKey(conn), JSON.stringify(env));
  } catch {
    // Quota exceeded or storage disabled — silently ignore. The next launch
    // will simply re-fetch.
  }
}

// ─── Local (no-backend) config profiles ──────────────────────────────────
// For localhost demos with no PAT / Data Service. The admin (same browser
// origin) saves NAMED configurations here so the user can keep one per customer
// and switch between them. The runtime reads the ACTIVE profile on boot and it
// wins over the bundled default. No TTL — persists until changed. Distinct from
// the per-tenant Data Service cache above.
const LOCAL_STORE_KEY = 'zara_local_profiles_v1';
const LEGACY_LOCAL_KEY = 'zara_local_config_v1'; // single-config format (pre-profiles)

export interface LocalProfile {
  id: string;
  name: string;
  config: TenantConfig;
  updatedAt: string;
}
interface LocalStore {
  activeId: string | null;
  profiles: LocalProfile[];
}

function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as LocalStore;
      if (s && Array.isArray(s.profiles)) return s;
    }
  } catch {
    // fall through to legacy migration / empty
  }
  // One-time migration of the old single-config key into a named profile.
  try {
    const legacy = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (legacy) {
      const config = migrate(JSON.parse(legacy));
      const prof: LocalProfile = { id: genId(), name: 'Saved configuration', config, updatedAt: new Date().toISOString() };
      const store: LocalStore = { activeId: prof.id, profiles: [prof] };
      writeStore(store);
      localStorage.removeItem(LEGACY_LOCAL_KEY);
      return store;
    }
  } catch {
    // ignore
  }
  return { activeId: null, profiles: [] };
}

function writeStore(s: LocalStore): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(s));
  } catch {
    // quota/disabled — ignore
  }
}

/** All saved local configuration profiles (newest activity first). */
export function listLocalProfiles(): LocalProfile[] {
  return [...readStore().profiles].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** The id of the profile the app currently renders, or null for bundled default. */
export function getActiveLocalProfileId(): string | null {
  return readStore().activeId;
}

/** The active profile object, or null when none is selected. */
export function getActiveLocalProfile(): LocalProfile | null {
  const s = readStore();
  return s.profiles.find((p) => p.id === s.activeId) ?? null;
}

/** Select which profile the app loads. null → revert to the bundled default. */
export function setActiveLocalProfile(id: string | null): void {
  const s = readStore();
  s.activeId = id;
  writeStore(s);
}

/** Create or update a profile (by id) and make it active. Returns the profile. */
export function upsertLocalProfile(id: string | null, name: string, config: TenantConfig): LocalProfile {
  const s = readStore();
  const existing = id ? s.profiles.find((p) => p.id === id) : null;
  let prof: LocalProfile;
  if (existing) {
    existing.name = name;
    existing.config = config;
    existing.updatedAt = new Date().toISOString();
    prof = existing;
  } else {
    prof = { id: genId(), name, config, updatedAt: new Date().toISOString() };
    s.profiles.push(prof);
  }
  s.activeId = prof.id;
  writeStore(s);
  return prof;
}

/** Rename a profile in place (does NOT change which profile is active/live). */
export function renameLocalProfile(id: string, name: string): void {
  const s = readStore();
  const p = s.profiles.find((x) => x.id === id);
  if (!p) return;
  p.name = name;
  p.updatedAt = new Date().toISOString();
  writeStore(s);
}

/** Delete a profile. If it was active, the app reverts to the bundled default. */
export function deleteLocalProfile(id: string): void {
  const s = readStore();
  s.profiles = s.profiles.filter((p) => p.id !== id);
  if (s.activeId === id) s.activeId = null;
  writeStore(s);
}

/** Read the ACTIVE config for the runtime — a built-in preset, a saved profile,
 *  or null (bundled default). */
export function loadLocalConfig(): TenantConfig | null {
  const preset = getPresetById(getActiveLocalProfileId());
  if (preset) return migrate(preset.config);
  const p = getActiveLocalProfile();
  return p ? migrate(p.config) : null;
}

/** Save into the active profile (creating one if none is active). Back-compat shim. */
export function saveLocalConfig(config: TenantConfig): void {
  const active = getActiveLocalProfile();
  upsertLocalProfile(active?.id ?? null, active?.name ?? 'My configuration', config);
}

/** Revert the app to the bundled default (deselect the active profile). */
export function clearLocalConfig(): void {
  setActiveLocalProfile(null);
}

/** Wipe every tenant's cached config (e.g. on "Switch tenant"). */
export function clearCachedConfigs(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * GET the AuraConfig singleton record from the tenant's Data Service.
 * Returns null when the entity doesn't exist (404), the user lacks scope,
 * or the response shape is unexpected — caller is responsible for falling
 * back to the bundled default.
 */
export async function fetchTenantConfig(
  sdk: UiPath,
  conn: TenantConnection
): Promise<TenantConfig | null> {
  const token = sdk.getToken();
  if (!token) {
    console.warn('[AuraConfig] No SDK token — runtime is not authenticated, skipping fetch.');
    return null;
  }

  const url = `${dataServiceBase(conn)}/api/EntityService/AuraConfig/read?$top=100`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[AuraConfig] Fetch failed: HTTP ${res.status} from ${url}`, body.slice(0, 300));
      return null;
    }
    const data = (await res.json()) as {
      value?: Array<{ Key?: string; ConfigJson?: string; ChunkIndex?: number }>;
    };
    const chunks = (data.value ?? [])
      .filter((r) => r.Key === 'current' && typeof r.ConfigJson === 'string')
      .sort((a, b) => (a.ChunkIndex ?? 0) - (b.ChunkIndex ?? 0));
    if (chunks.length === 0) {
      console.warn('[AuraConfig] Fetch OK but no chunks with Key="current" found — admin save may not have landed in this tenant.');
      return null;
    }
    const fullJson = chunks.map((c) => c.ConfigJson ?? '').join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(fullJson);
    } catch (e) {
      console.warn('[AuraConfig] Reassembled JSON failed to parse', e);
      return null;
    }
    console.info(`[AuraConfig] Loaded config from Data Service (${chunks.length} chunk${chunks.length === 1 ? '' : 's'}).`);
    return migrate(parsed);
  } catch (e) {
    console.warn('[AuraConfig] Network/parse error fetching config', e);
    return null;
  }
}

interface LoaderArgs {
  sdk: UiPath;
  connection: TenantConnection | null;
  isAuthenticated: boolean;
  /** When true, the user is on the bundled demo-token bypass path. The
   *  loader skips the Data Service fetch — demo always shows defaultConfig. */
  isDemoSession: boolean;
  onLoaded: (config: TenantConfig) => void;
}

/**
 * Effect-style loader. Once authenticated, fetch the AuraConfig entity and
 * call onLoaded with the result. Updates the localStorage cache as a side
 * effect. Skips the network call if a fresh cache hit already covers the
 * current tenant (loader of caches read happens earlier in ConfigProvider).
 *
 * Idempotent — safe to mount in StrictMode (re-fetch on second invoke is
 * no harm; fetched data is identical and writes are coalesced by the cache
 * envelope's `fetchedAt`).
 */
export function useTenantConfigLoader({ sdk, connection, isAuthenticated, isDemoSession, onLoaded }: LoaderArgs): void {
  const lastTenantRef = useRef<string | null>(null);
  useEffect(() => {
    // Note: demo sessions DO fetch (so admin-saved branding shows during demos).
    // The demo token must have Data Service read scope; if not, fetch fails
    // gracefully and the bundled default config is used. `isDemoSession` is
    // kept in the signature for callers/telemetry but no longer skips.
    void isDemoSession;
    if (!isAuthenticated || !connection) return;
    const tid = tenantId(connection);
    if (lastTenantRef.current === tid) return;
    lastTenantRef.current = tid;

    let cancelled = false;
    fetchTenantConfig(sdk, connection).then((cfg) => {
      if (cancelled || !cfg) return;
      saveCachedConfig(connection, cfg);
      onLoaded(cfg);
    });
    return () => { cancelled = true; };
  }, [sdk, connection, isAuthenticated, isDemoSession, onLoaded]);
}
