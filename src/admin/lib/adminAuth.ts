// Phase 3 admin auth model — two layers:
//
//   1. admin/admin gate (this file)
//      Hardcoded credentials gate the admin app from casual snoopers.
//      Session lives in localStorage with an 8h expiry. NOT a security
//      boundary — anyone with the build can bypass it. The real security
//      boundary is the tenant PAT (see adminTenant.ts) which gates every
//      mutation against UiPath.
//
//   2. Tenant PAT (adminTenant.ts)
//      Per-tenant credentials needed to actually read/write the
//      AuraConfig entity in Data Service.

const SESSION_KEY = 'aura_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

interface AdminSession {
  startedAt: string;
}

const VALID_USERNAME = 'admin';
const VALID_PASSWORD = 'admin';

export function isAdminLoggedIn(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw) as AdminSession;
    const ageMs = Date.now() - new Date(session.startedAt).getTime();
    return ageMs <= SESSION_TTL_MS;
  } catch {
    return false;
  }
}

export function adminLogin(username: string, password: string): boolean {
  if (username.trim() !== VALID_USERNAME || password !== VALID_PASSWORD) return false;
  const session: AdminSession = { startedAt: new Date().toISOString() };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function adminLogout(): void {
  localStorage.removeItem(SESSION_KEY);
}
