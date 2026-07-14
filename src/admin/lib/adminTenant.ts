// Persists the UiPath tenant credentials the admin uses to read/write the
// AuraConfig entity. These are device-local (just like the Aura mobile
// app's TenantConnection in onboarding/tenantSelection.ts) — every admin
// device entering this panel needs to provide a PAT and tenant once.
//
// Stored shape:
//   {
//     orgName, tenantName: scopes the Data Service URL
//     baseUrl:             which UiPath cloud (defaults to cloud.uipath.com)
//     pat:                 Personal Access Token (Bearer)
//     verifiedAt:          ISO timestamp from the last successful tenant
//                          handshake (GetCurrentUser); used to display
//                          "verified at …" in the UI and to bounce the
//                          user back to TenantSetup if missing.
//   }

const STORAGE_KEY = 'aura_admin_tenant';

export interface AdminTenantCredentials {
  orgName: string;
  tenantName: string;
  baseUrl: string;
  pat: string;
  verifiedAt?: string;
}

export const DEFAULT_BASE_URL = 'https://cloud.uipath.com';

export function getAdminTenant(): AdminTenantCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminTenantCredentials>;
    if (!parsed.orgName || !parsed.tenantName || !parsed.pat) return null;
    return {
      orgName: parsed.orgName,
      tenantName: parsed.tenantName,
      baseUrl: parsed.baseUrl || DEFAULT_BASE_URL,
      pat: parsed.pat,
      verifiedAt: parsed.verifiedAt,
    };
  } catch {
    return null;
  }
}

export function saveAdminTenant(creds: AdminTenantCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function clearAdminTenant(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Build the API base for a given tenant. In dev we route through Vite's proxy
 * so the browser doesn't hit a CORS wall.
 *
 * In prod the admin runs on the app-hosting domain (e.g. mea.staging.uipath.host)
 * which is a DIFFERENT origin than the portal host (staging.uipath.com). CORS
 * and authorization differ PER NAMESPACE, verified against staging (Jun 2026):
 *
 *   • orchestrator_ : portal host sends NO CORS header → must use the api host
 *     (staging.api.uipath.com), which is CORS-enabled and authorized.
 *   • dataservice_  : the api host returns 403 "This API endpoint is not
 *     authorized" for the Data Service data/entity APIs in this tenant, while
 *     the PORTAL host both sends CORS (`*`) AND authorizes the call. So Data
 *     Service MUST go to the portal host, not the api host. (This is why the
 *     config loaded on localhost — dev-proxied to the portal host — but 403'd
 *     on the deployed app, which had been pointed at the api host.)
 */
export function apiBaseFor(creds: AdminTenantCredentials, namespace: 'orchestrator_' | 'dataservice_' | 'identity_'): string {
  if (import.meta.env.DEV) {
    return `/${creds.orgName}/${creds.tenantName}/${namespace}`;
  }
  const host = creds.baseUrl.replace(/\/$/, '');
  // Data Service data APIs are authorized + CORS-enabled only on the portal host.
  if (namespace === 'dataservice_') {
    return `${host}/${creds.orgName}/${creds.tenantName}/${namespace}`;
  }
  let apiHost = host;
  try {
    const u = new URL(host);
    if (u.hostname === 'cloud.uipath.com') {
      apiHost = `${u.protocol}//api.uipath.com`;
    } else {
      // staging.uipath.com → staging.api.uipath.com, alpha.uipath.com → alpha.api.uipath.com
      const parts = u.hostname.split('.');
      if (parts.length >= 2 && parts[1] !== 'api') parts.splice(1, 0, 'api');
      apiHost = `${u.protocol}//${parts.join('.')}`;
    }
  } catch {
    apiHost = host;
  }
  return `${apiHost}/${creds.orgName}/${creds.tenantName}/${namespace}`;
}

/**
 * Validates the tenant + PAT by calling Identity GetCurrentUser. Returns
 * the parsed user info on success so the admin UI can display "Connected
 * as <name>", or null on failure.
 */
export async function verifyAdminTenant(creds: AdminTenantCredentials): Promise<{ name: string; email: string } | null> {
  try {
    const url = `${apiBaseFor(creds, 'orchestrator_')}/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUser`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.pat}` } });
    if (!res.ok) return null;
    const data = await res.json() as { Name?: string; Surname?: string; UserName?: string; EmailAddress?: string };
    const name = [data.Name, data.Surname].filter(Boolean).join(' ').trim() || data.UserName || data.EmailAddress || 'Unknown';
    const email = data.EmailAddress || '';
    return { name, email };
  } catch {
    return null;
  }
}
