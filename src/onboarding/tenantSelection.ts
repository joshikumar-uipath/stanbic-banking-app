// Local-device tenant connection — what the app needs in order to even
// reach the SSO screen. Persisted in localStorage so the user only fills
// it in on first launch (and any time they "Reset tenant connection"
// from Profile).
//
// Phase 1: this is the data the ConnectTenant screen captures. Phase 2
// will, after SSO succeeds, fetch the rest of the runtime config (branding,
// agents, demo content, etc.) from the tenant's Data Service AuraConfig
// entity using these connection details.

import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'aura_tenant_connection';

export interface TenantConnection {
  orgName: string;
  tenantName: string;
  oauthClientId: string;
  baseUrl: string;
  redirectUri: string;
  scope: string;
  setAt: string; // ISO timestamp
}

/**
 * Auto-detect a sensible redirect URI for the current platform.
 * - Native iOS/Android: a custom scheme registered in Info.plist /
 *   AndroidManifest. The OAuth provider must allow it explicitly.
 * - Web: the current origin + pathname so the same SPA receives the
 *   callback with ?code in the URL. We strip a trailing slash for
 *   match-stability with what's registered on the OAuth client.
 */
export function defaultRedirectUri(): string {
  if (Capacitor.isNativePlatform()) return 'aura://callback';
  const { origin, pathname, hostname } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  if (!isLocalhost && import.meta.env.VITE_UIPATH_REDIRECT_URI) {
    return import.meta.env.VITE_UIPATH_REDIRECT_URI as string;
  }
  if (pathname.startsWith('/apps_/default/')) {
    const baseEl = document.querySelector('base');
    const baseHref = baseEl?.getAttribute('href') || '';
    const routingName = baseHref.replace(/^\/|\/$/g, '');
    if (routingName) return `${origin}/${routingName}`;
  }
  return (origin + pathname).replace(/\/$/, '');
}

export const DEFAULT_BASE_URL = 'https://cloud.uipath.com';
export const DEFAULT_SCOPE =
  'OR.Default OR.Folders OR.Users OR.Tasks OR.Execution OR.Robots ' +
  'IdentityServerApi DataService.Schema DataService.Data offline_access ' +
  'OR.ConversationalAgents';

/** Returns the stored tenant connection, or null if the user hasn't picked one yet. */
export function getTenantConnection(): TenantConnection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TenantConnection>;
    if (!parsed.orgName || !parsed.tenantName || !parsed.oauthClientId) return null;
    return {
      orgName: parsed.orgName,
      tenantName: parsed.tenantName,
      oauthClientId: parsed.oauthClientId,
      baseUrl: parsed.baseUrl || DEFAULT_BASE_URL,
      redirectUri: parsed.redirectUri || defaultRedirectUri(),
      scope: parsed.scope || DEFAULT_SCOPE,
      setAt: parsed.setAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Persists the tenant connection. Throws on quota errors. */
export function setTenantConnection(conn: Omit<TenantConnection, 'setAt'>): TenantConnection {
  const stored: TenantConnection = { ...conn, setAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

/** Removes the tenant connection. Used by "Reset tenant connection". */
export function clearTenantConnection(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Build a fully-populated connection from local storage (preferred) or fall
 * back to env vars (so the dev experience and any pre-existing builds keep
 * working until the user runs through ConnectTenant once).
 *
 * Returns null only when neither source has the three required fields.
 */
export function resolveTenantConnection(): TenantConnection | null {
  const stored = getTenantConnection();
  if (stored) return stored;

  const envOrg = import.meta.env.VITE_UIPATH_ORG_NAME as string | undefined;
  const envTenant = import.meta.env.VITE_UIPATH_TENANT_NAME as string | undefined;
  const envClientId = import.meta.env.VITE_UIPATH_CLIENT_ID as string | undefined;
  if (!envOrg || !envTenant || !envClientId) return null;

  return {
    orgName: envOrg,
    tenantName: envTenant,
    oauthClientId: envClientId,
    baseUrl: (import.meta.env.VITE_UIPATH_BASE_URL as string | undefined) || DEFAULT_BASE_URL,
    redirectUri: defaultRedirectUri(),
    scope: (import.meta.env.VITE_UIPATH_SCOPES as string | undefined) || DEFAULT_SCOPE,
    setAt: new Date(0).toISOString(), // sentinel: came from env, not user input
  };
}
