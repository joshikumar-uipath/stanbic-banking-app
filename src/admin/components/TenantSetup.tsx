import { useState } from 'react';
import type { FormEvent } from 'react';
import AdminShell, { fieldLabel, fieldInput, primaryButton, secondaryButton, errorBanner } from './AdminShell';
import {
  saveAdminTenant,
  verifyAdminTenant,
  DEFAULT_BASE_URL,
  type AdminTenantCredentials,
} from '../lib/adminTenant';
import { setTenantConnection, defaultRedirectUri, DEFAULT_SCOPE } from '../../onboarding/tenantSelection';

interface Props {
  onConnected: (creds: AdminTenantCredentials, profile: { name: string; email: string }) => void;
  initial?: AdminTenantCredentials | null;
  /** Error from a prior connect attempt (e.g. Data Service 403) to show on mount. */
  initialError?: string | null;
  onCancel?: () => void;
  /** Skip UiPath entirely and edit/save the config to this browser (no PAT). */
  onSkipLocal?: () => void;
}

export default function TenantSetup({ onConnected, initial, initialError, onCancel, onSkipLocal }: Props) {
  const [orgName, setOrgName] = useState(initial?.orgName ?? '');
  const [tenantName, setTenantName] = useState(initial?.tenantName ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_BASE_URL);
  const [pat, setPat] = useState(initial?.pat ?? '');
  const [oauthClientId, setOauthClientId] = useState<string>(
    () => (import.meta.env.VITE_UIPATH_CLIENT_ID as string | undefined) ?? ''
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trim = (s: string) => s.trim();
    const o = trim(orgName);
    const t = trim(tenantName);
    const b = trim(baseUrl) || DEFAULT_BASE_URL;
    const p = trim(pat);
    const c = trim(oauthClientId);
    if (!o || !t || !p) {
      setError('Org name, tenant name, and PAT are all required.');
      return;
    }
    setSubmitting(true);
    const creds: AdminTenantCredentials = {
      orgName: o,
      tenantName: t,
      baseUrl: b,
      pat: p,
    };
    const profile = await verifyAdminTenant(creds);
    if (!profile) {
      setSubmitting(false);
      setError('Could not verify tenant. Check the org/tenant names and that the PAT has OR.Users scope.');
      return;
    }
    saveAdminTenant({ ...creds, verifiedAt: new Date().toISOString() });
    // Also seed the runtime's tenant connection so the user-facing app's SSO
    // points at the same tenant the admin is editing. The OAuth client ID
    // captured here is what the runtime sends to UiPath identity at login —
    // it must be the App ID of an External Application registered in *this*
    // org. (The PAT above is for Data Service; OAuth client ID is for SSO.)
    const envScope = (import.meta.env.VITE_UIPATH_SCOPES as string | undefined) || DEFAULT_SCOPE;
    setTenantConnection({
      orgName: o,
      tenantName: t,
      oauthClientId: c,
      baseUrl: b,
      redirectUri: defaultRedirectUri(),
      scope: envScope,
    });
    setSubmitting(false);
    onConnected({ ...creds, verifiedAt: new Date().toISOString() }, profile);
  };

  return (
    <AdminShell
      title="Connect to a UiPath tenant"
      subtitle="Provide a Personal Access Token with OR.Users + DataService.Data + DataService.Schema scopes."
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel} htmlFor="ts-org">Org name</label>
            <input
              id="ts-org"
              className="admin-input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. acme-cloud"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              style={fieldInput}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel} htmlFor="ts-tenant">Tenant name</label>
            <input
              id="ts-tenant"
              className="admin-input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="DefaultTenant"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              style={fieldInput}
            />
          </div>
        </div>
        <div>
          <label style={fieldLabel} htmlFor="ts-base">Base URL</label>
          <input
            id="ts-base"
            className="admin-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            style={fieldInput}
          />
        </div>
        <div>
          <label style={fieldLabel} htmlFor="ts-pat">Personal Access Token (PAT)</label>
          <input
            id="ts-pat"
            className="admin-input"
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="rt_…"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            style={fieldInput}
          />
          <p style={{ fontSize: 11, color: 'rgba(24,33,38,0.5)', marginTop: 6 }}>
            Stored locally in this browser. Generate one in UiPath under your profile → Personal Access Tokens.
          </p>
        </div>
        <div>
          <label style={fieldLabel} htmlFor="ts-oauth-client">OAuth Client ID (for end-user SSO)</label>
          <input
            id="ts-oauth-client"
            className="admin-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="00000000-0000-0000-0000-000000000000"
            value={oauthClientId}
            onChange={(e) => setOauthClientId(e.target.value)}
            style={fieldInput}
          />
          <OAuthRegistrationHelper
            orgName={orgName.trim()}
            baseUrl={baseUrl.trim() || DEFAULT_BASE_URL}
          />
        </div>
        {error && <div style={errorBanner}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {onCancel && (
            <button type="button" onClick={onCancel} style={secondaryButton}>Cancel</button>
          )}
          <button type="submit" disabled={submitting} style={{ ...primaryButton, flex: 1, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Verifying…' : 'Connect'}
          </button>
        </div>
      </form>

      {onSkipLocal && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(24,33,38,0.10)' }}>
          <button type="button" onClick={onSkipLocal} style={{ ...secondaryButton, width: '100%' }}>
            Skip — edit name &amp; theme locally (no UiPath / no PAT)
          </button>
          <p style={{ fontSize: 11, color: 'rgba(24,33,38,0.5)', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
            Saves to this browser only. Perfect for a localhost demo — change the name &amp; colors,
            Save, then reload the app tab. No tenant connection required.
          </p>
        </div>
      )}
    </AdminShell>
  );
}

/**
 * Explains the manual UiPath registration step the demoer has to perform once
 * per tenant. Pre-computes everything they'd otherwise have to figure out:
 * the deep link to the right portal page, the exact name/scopes/redirect URI
 * to enter, and a copy button per value. They click into UiPath, paste, save,
 * come back. Auto-creating the app via the Identity Server API would skip
 * even this — but UiPath's app-creation REST endpoint isn't in the public
 * docs, so doing it reliably needs portal-API capture work first.
 */
function OAuthRegistrationHelper({ orgName, baseUrl }: { orgName: string; baseUrl: string }) {
  const trimmedBase = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const portalUrl = orgName
    ? `${trimmedBase}/${orgName}/portal_/externalApps`
    : null;
  const redirectUri = `${window.location.origin}/`;
  const requiredScopes = [
    'OR.Default', 'OR.Folders', 'OR.Users', 'OR.Tasks', 'OR.Execution',
    'IdentityServerApi', 'DataService.Schema', 'DataService.Data',
    'OR.ConversationalAgents', 'offline_access',
  ].join(' ');

  return (
    <div style={{
      marginTop: 10,
      padding: '12px 14px',
      background: 'rgba(255,51,51,0.06)',
      border: '1px solid rgba(255,51,51,0.2)',
      borderRadius: 10,
      fontSize: 12,
      lineHeight: 1.55,
      color: '#0a3a3f',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#FF3333' }}>
        Don’t have an OAuth client yet? One-time setup ↓
      </div>
      <ol style={{ margin: '4px 0 8px 18px', padding: 0 }}>
        <li>
          {portalUrl ? (
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#FF3333', fontWeight: 500 }}
            >Open this org’s External Applications page ↗</a>
          ) : (
            <em style={{ color: 'rgba(24,33,38,0.55)' }}>Enter Org name above to enable the deep link.</em>
          )}
          {' '}→ click <strong>Add Application</strong>.
        </li>
        <li>Name: <Copyable value="Aura Runtime" /> · Type: <strong>Non-Confidential application</strong> (the runtime is a browser SPA, so no client secret).</li>
        <li>Add a redirect URL: <Copyable value={redirectUri} mono /> (trailing slash matters — must match exactly).</li>
        <li>Under <em>User scopes</em>, add: <Copyable value={requiredScopes} mono /></li>
        <li>Confirm <em>Authorization Code + PKCE</em> is enabled (it’s the default for Non-Confidential apps).</li>
        <li>Save → copy the <strong>App ID</strong> → paste into the field above.</li>
      </ol>
      <div style={{ fontSize: 11, color: 'rgba(24,33,38,0.55)' }}>
        Tip: requires you to be a tenant admin in this org. The PAT above is for Data Service writes;
        this OAuth client is what the runtime app uses for end-user SSO.
      </div>
    </div>
  );
}

function Copyable({ value, mono = false }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: select-all in a temp textarea — skipped for brevity
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to copy"
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: '1px dashed rgba(255,51,51,0.35)',
        borderRadius: 6,
        padding: '1px 6px',
        cursor: 'pointer',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
        fontSize: mono ? 11 : 12,
        color: copied ? '#FF3333' : '#0a3a3f',
        margin: '0 1px',
      }}
    >
      {copied ? 'Copied!' : value}
    </button>
  );
}
