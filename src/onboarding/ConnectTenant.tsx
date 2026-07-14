import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../config';
import LoopingVideo from '../components/LoopingVideo';
import { ORB_LIGHT, ORB_DARK } from '../brandAssets';
import {
  setTenantConnection,
  defaultRedirectUri,
  DEFAULT_BASE_URL,
  DEFAULT_SCOPE,
} from './tenantSelection';

interface Props {
  /** Called after the user successfully saves a tenant connection. */
  onConnected: () => void;
  /**
   * Optional pre-fill — when shown via "Reset tenant connection" from
   * Profile we want to start with the previous values so the user can
   * tweak rather than retype.
   */
  initial?: {
    orgName?: string;
    tenantName?: string;
    oauthClientId?: string;
    baseUrl?: string;
    redirectUri?: string;
    scope?: string;
  };
  /** When invoked from Profile (not the very first launch), allow cancel. */
  onCancel?: () => void;
}

/**
 * First-launch onboarding — capture the minimum identifying info so the
 * app knows which UiPath cloud org/tenant to talk to. After this saves,
 * the regular Sign-in-with-UiPath flow runs against the captured org.
 */
export default function ConnectTenant({ onConnected, initial, onCancel }: Props) {
  const { theme } = useTheme();
  const { branding } = useConfig();

  const [orgName, setOrgName] = useState(initial?.orgName ?? '');
  const [tenantName, setTenantName] = useState(initial?.tenantName ?? '');
  const [oauthClientId, setOauthClientId] = useState(initial?.oauthClientId ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_BASE_URL);
  const [redirectUri, setRedirectUri] = useState(initial?.redirectUri ?? defaultRedirectUri());
  const [scope, setScope] = useState(initial?.scope ?? DEFAULT_SCOPE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trim = (s: string) => s.trim();
    const o = trim(orgName);
    const t = trim(tenantName);
    const c = trim(oauthClientId);
    if (!o || !t || !c) {
      setError('Org name, tenant name, and OAuth Client ID are all required.');
      return;
    }
    setSubmitting(true);
    try {
      setTenantConnection({
        orgName: o,
        tenantName: t,
        oauthClientId: c,
        baseUrl: trim(baseUrl) || DEFAULT_BASE_URL,
        redirectUri: trim(redirectUri) || defaultRedirectUri(),
        scope: trim(scope) || DEFAULT_SCOPE,
      });
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tenant connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLight = theme === 'light';
  const orbSrc = isLight ? ORB_LIGHT : ORB_DARK;
  const labelStyle = {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 11,
    fontWeight: 600,
    color: isLight ? 'rgba(24,33,38,0.55)' : 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
    display: 'block',
  };
  const inputStyle = {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 15,
    width: '100%',
    paddingTop: 13,
    paddingBottom: 13,
    paddingInlineStart: 14,
    paddingInlineEnd: 14,
    borderRadius: 12,
    background: isLight ? '#ffffff' : '#0f171d',
    border: `1.5px solid ${isLight ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.08)'}`,
    color: isLight ? '#182126' : '#fff',
    outline: 'none' as const,
  };

  return (
    <div className="flex flex-col h-full" style={{ background: isLight ? '#e8ebed' : '#000', overflow: 'auto' }}>
      <style>{`
        .ct-input:focus { border-color: var(--brand-primary) !important; box-shadow: 0 0 0 4px rgba(var(--brand-primary-rgb),0.14) !important; }
        .ct-input::placeholder { color: ${isLight ? 'rgba(24,33,38,0.38)' : 'rgba(255,255,255,0.38)'}; }
      `}</style>
      <div className="flex-shrink-0 flex flex-col items-center pt-10 pb-2 px-6">
        <div style={{ width: 96, height: 96 }}>
          <LoopingVideo src={orbSrc} style={{ objectFit: 'contain' }} />
        </div>
        <span style={{
          fontFamily: "'Poppins', Arial, sans-serif",
          fontWeight: 600,
          fontSize: 32,
          color: isLight ? '#182126' : '#fff',
          letterSpacing: -1,
          lineHeight: 1,
          marginTop: 8,
        }}>
          {branding.appName}
        </span>
        <p className="text-sm text-center" style={{
          marginTop: 8,
          color: 'rgba(var(--brand-primary-rgb),0.85)',
          fontFamily: "'Inter', Arial, sans-serif",
        }}>
          Connect to your UiPath tenant to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 pt-4 pb-8 gap-4">
        <div>
          <label style={labelStyle} htmlFor="ct-org">Org name</label>
          <input
            id="ct-org"
            className="ct-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. acme-cloud"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="ct-tenant">Tenant name</label>
          <input
            id="ct-tenant"
            className="ct-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. DefaultTenant"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="ct-clientid">OAuth Client ID</label>
          <input
            id="ct-clientid"
            className="ct-input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="External Application client ID (UUID)"
            value={oauthClientId}
            onChange={(e) => setOauthClientId(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="self-start text-xs flex items-center gap-1.5 py-1"
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            color: isLight ? 'rgba(var(--brand-primary-rgb),0.85)' : 'rgba(var(--brand-primary-rgb),0.7)',
            fontWeight: 500,
          }}
        >
          {advancedOpen ? 'Hide advanced' : 'Advanced (base URL, redirect URI, scopes)'}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <div style={{ maxHeight: advancedOpen ? 480 : 0, opacity: advancedOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease' }}>
          <div className="flex flex-col gap-4">
            <div>
              <label style={labelStyle} htmlFor="ct-baseurl">Base URL</label>
              <input
                id="ct-baseurl"
                className="ct-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ct-redirect">Redirect URI</label>
              <input
                id="ct-redirect"
                className="ct-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="ct-scope">OAuth scope</label>
              <textarea
                id="ct-scope"
                className="ct-input"
                rows={3}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                style={{ ...inputStyle, fontSize: 13, resize: 'none' as const }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="w-full rounded-2xl p-3 text-sm text-center"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-shrink-0 rounded-2xl active:scale-95 transition-transform"
              style={{
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: 15,
                fontWeight: 500,
                paddingTop: 14,
                paddingBottom: 14,
                paddingLeft: 22,
                paddingRight: 22,
                background: isLight ? 'rgba(24,33,38,0.06)' : 'rgba(255,255,255,0.08)',
                color: isLight ? '#182126' : '#fff',
                border: 'none',
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-2xl text-white active:scale-95 transition-transform"
            style={{
              fontFamily: "'Poppins', Arial, sans-serif",
              fontSize: 16,
              fontWeight: 600,
              paddingTop: 16,
              paddingBottom: 16,
              background: branding.primaryColor,
              boxShadow: `0 0 30px ${branding.primaryColor}60`,
              border: 'none',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
