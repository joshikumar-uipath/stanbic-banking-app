import { useState } from 'react';
import { useTheme, LANGUAGES } from '../contexts/ThemeContext';
import { useConfig, clearCachedConfigs } from '../config';
import { clearTenantConnection } from '../onboarding/tenantSelection';
import { LOGO_LIGHT, LOGO_WHITE } from '../brandAssets';

interface Props {
  userName: string;
  userEmail: string;
  onLogout: () => void;
  /**
   * Wipes the tenant connection from localStorage and bounces the user
   * back to ConnectTenant. Wired by App.tsx so it can also re-run
   * resolveTenantConnection() and rerender the auth tree.
   */
  onResetTenant?: () => void;
  /** The employee app's current role, shown with a way to switch it. */
  roleName?: string;
  roleSub?: string;
  onSwitchRole?: () => void;
}

export default function ProfileTab({ userName, userEmail, onLogout, onResetTenant, roleName, roleSub, onSwitchRole }: Props) {
  const { theme, t, tr, toggleTheme, lang, setLang, currentLanguage } = useTheme();
  const { branding } = useConfig();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleResetTenant = () => {
    // Wipe the connection plus every cached AuraConfig — different tenants
    // have different Data Service entities, and we don't want last tenant's
    // branding flashing on first paint of the next.
    clearTenantConnection();
    clearCachedConfigs();
    setShowResetConfirm(false);
    // Logout first so the SDK doesn't retain a token from the old tenant.
    onLogout();
    onResetTenant?.();
  };

  // Account deletion — required by Apple App Store Guideline 5.1.1(v).
  // The app authenticates against UiPath as an external identity provider, so
  // we can't actually delete a UiPath account from here. What we CAN do, and
  // what Apple wants, is to remove every trace of the user from this device:
  // clear the auth tokens, the tenant connection, all cached config and
  // preferences. The UiPath account itself must be deleted via the upstream
  // admin portal — we surface that in the confirmation copy.
  const handleDeleteAccount = () => {
    try {
      // Selectively clear keys this app writes (avoid nuking unrelated
      // localStorage that might belong to other apps in shared web contexts).
      const lsKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('aura_') || k.startsWith('uipath_') || k.startsWith('tenant_'))) {
          lsKeys.push(k);
        }
      }
      lsKeys.forEach((k) => localStorage.removeItem(k));
      // Auth tokens and OAuth context live in sessionStorage — wipe everything.
      sessionStorage.clear();
    } catch {
      // Storage APIs can throw in private-browsing / quota-exceeded edge cases.
      // Swallow — the subsequent logout and tenant reset still happen below.
    }
    clearTenantConnection();
    clearCachedConfigs();
    setShowDeleteConfirm(false);
    onLogout();
    onResetTenant?.();
  };
  const initials = userName ? userName.slice(0, 2).toUpperCase() : '?';

  return (
    <div className="flex flex-col h-full relative" style={{ background: t.bgPrimary }}>

      {/* Language picker overlay */}
      {showLangPicker && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-t-3xl overflow-hidden" style={{ background: t.bgPrimary, border: `1px solid ${t.border}` }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="font-bold text-base" style={{ color: t.textPrimary }}>{tr.selectLanguage}</p>
              <button onClick={() => setShowLangPicker(false)} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: t.bgCard }}>
                <svg className="w-4 h-4" style={{ color: t.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto pb-8" style={{ maxHeight: 420 }}>
              {LANGUAGES.map((lng, idx) => (
                <button
                  key={lng.code}
                  onClick={() => { setLang(lng.code); setShowLangPicker(false); }}
                  className="w-full flex items-center justify-between px-5 py-3.5 transition-colors active:opacity-70"
                  style={{ borderTop: idx > 0 ? `1px solid ${t.divider}` : 'none' }}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold" style={{ color: t.textPrimary }}>{lng.nativeName}</span>
                    <span className="text-xs" style={{ color: t.textMuted }}>{lng.name}</span>
                  </div>
                  {lang === lng.code && (
                    <svg className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtle glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 30% at 50% 20%, rgba(20,90,140,0.15) 0%, transparent 70%)',
      }} />

      <div className="flex flex-col h-full no-scrollbar overflow-y-auto relative z-10">
        {/* Header */}
        <div className="pt-3 pb-6 flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #182126 0%, #1E6482 50%, #182126 100%)', border: '2px solid rgba(var(--brand-primary-rgb),0.4)', boxShadow: '0 0 24px rgba(var(--brand-primary-rgb),0.25)' }}>
              {initials}
            </div>
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2" style={{ background: 'var(--brand-primary)', borderColor: t.bgPrimary }} />
          </div>
          <h2 className="font-bold text-xl" style={{ color: t.textPrimary }}>{userName || 'User'}</h2>
          <p className="text-sm mt-0.5" style={{ color: t.textSecondary }}>{userEmail}</p>
          <div className="mt-3 px-3 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(var(--brand-primary-rgb),0.1)', border: '1px solid rgba(var(--brand-primary-rgb),0.25)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(var(--brand-primary-rgb),0.85)' }}>{tr.uipathAccount}</span>
          </div>
        </div>

        {/* Settings */}
        <div className="px-4 flex flex-col gap-5 pb-6">

          {/* Work role — which job this app is doing. Switchable when the admin allows it. */}
          {roleName && (
            <div>
              <p className="text-xs font-semibold tracking-widest mb-2 px-1" style={{ color: t.textLabel }}>WORK ROLE</p>
              <button
                type="button" onClick={onSwitchRole} disabled={!onSwitchRole}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-colors active:opacity-70"
                style={{ background: t.bgCard, border: `1px solid ${t.border}`, cursor: onSwitchRole ? 'pointer' : 'default' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: t.bgIconBox }}>
                  <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-12 0h16a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: t.textBody }}>{roleName}</div>
                  {roleSub && <div className="text-xs mt-0.5" style={{ color: t.textMuted }}>{roleSub}</div>}
                </div>
                {onSwitchRole ? (
                  <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>Switch</span>
                ) : (
                  <span className="text-xs" style={{ color: t.textMuted }}>Set by admin</span>
                )}
              </button>
            </div>
          )}

          {/* Preferences */}
          <div>
            <p className="text-xs font-semibold tracking-widest mb-2 px-1" style={{ color: t.textLabel }}>{tr.sectionPreferences}</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>

              {/* Notifications */}
              <div className="w-full flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${t.divider}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: t.bgIconBox }}>
                  <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <span className="flex-1 text-sm" style={{ color: t.textBody }}>{tr.notifications}</span>
                <span className="text-xs" style={{ color: t.textMuted }}>{tr.notifOn}</span>
              </div>

              {/* Appearance toggle */}
              <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70" style={{ borderBottom: `1px solid ${t.divider}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: t.bgIconBox }}>
                  <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
                <span className="flex-1 text-sm text-left" style={{ color: t.textBody }}>{tr.appearance}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: t.textMuted }}>{theme === 'dark' ? tr.dark : tr.light}</span>
                  <div className="relative rounded-full transition-all duration-300" style={{ width: 44, height: 26, background: theme === 'light' ? 'var(--brand-primary)' : 'rgba(255,255,255,0.15)' }}>
                    <div className="absolute top-1 rounded-full bg-white transition-all duration-300" style={{ width: 18, height: 18, left: theme === 'light' ? 22 : 4, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </div>
                </div>
              </button>

              {/* Language picker */}
              <button onClick={() => setShowLangPicker(true)} className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: t.bgIconBox }}>
                  <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </div>
                <span className="flex-1 text-sm text-left" style={{ color: t.textBody }}>{tr.language}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: t.textMuted }}>{currentLanguage.nativeName}</span>
                  <svg className="w-4 h-4" style={{ color: t.chevron }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* About */}
          <div>
            <p className="text-xs font-semibold tracking-widest mb-2 px-1" style={{ color: t.textLabel }}>{tr.sectionAbout}</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
              {[
                { label: tr.privacyPolicy, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', value: '' },
                { label: tr.termsOfService, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', value: '' },
                { label: tr.appVersion, icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', value: '1.0.0' },
              ].map((item, idx, arr) => (
                <div key={item.label} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: t.bgIconBox }}>
                    <svg className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                    </svg>
                  </div>
                  <span className="flex-1 text-sm" style={{ color: t.textBody }}>{item.label}</span>
                  {item.value ? (
                    <span className="text-xs" style={{ color: t.textMuted }}>{item.value}</span>
                  ) : (
                    <svg className="w-4 h-4" style={{ color: t.chevron }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reset tenant connection */}
          {onResetTenant && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-colors active:opacity-80"
              style={{ background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.1)' : 'rgba(var(--brand-primary-rgb),0.15)' }}>
                <svg className="w-4 h-4" style={{ color: branding.accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className="flex-1 text-sm font-medium text-left" style={{ color: t.textPrimary }}>Switch tenant</span>
              <svg className="w-4 h-4" style={{ color: t.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Sign out */}
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-colors active:opacity-80" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <svg className="w-4 h-4" style={{ color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="flex-1 text-sm font-medium text-left" style={{ color: '#f87171' }}>{tr.signOut}</span>
          </button>

          {/* Delete account — required by App Store guideline 5.1.1(v) for any
           * app that supports account creation/sign-in. */}
          <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-colors active:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(220,38,38,0.18)' }}>
              <svg className="w-4 h-4" style={{ color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3" />
              </svg>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: '#dc2626' }}>Delete account</p>
              <p className="leading-tight mt-0.5" style={{ fontSize: 11, color: theme === 'light' ? 'rgba(220,38,38,0.65)' : 'rgba(248,113,113,0.65)' }}>
                Permanently remove your account and data
              </p>
            </div>
          </button>

          {/* Delete account confirmation overlay */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <div className="rounded-t-3xl overflow-hidden" style={{ background: t.bgPrimary, border: `1px solid ${t.border}`, padding: '28px 24px 32px' }}>
                {/* iOS-style drag handle */}
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
                <p className="font-bold mb-3" style={{ fontSize: 19, color: t.textPrimary, letterSpacing: -0.3 }}>Delete account?</p>
                <p className="mb-4" style={{ fontSize: 14, color: t.textBody, lineHeight: 1.55 }}>
                  This permanently deletes your account from {branding.appName}. The following will be erased and cannot be recovered:
                </p>
                <ul className="mb-4 pl-5" style={{ fontSize: 13.5, color: t.textBody, lineHeight: 1.75, listStyleType: 'disc' }}>
                  <li>Your profile and authentication credentials</li>
                  <li>All cached conversations, agents, and preferences</li>
                  <li>Your tenant connection and personalized settings</li>
                </ul>
                <p className="mb-6" style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55 }}>
                  This action is permanent and cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-2xl text-sm font-medium"
                    style={{ padding: '14px 0', background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: t.textPrimary, border: 'none' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 rounded-2xl text-sm font-semibold text-white"
                    style={{ padding: '14px 0', background: '#dc2626', border: 'none', boxShadow: '0 1px 3px rgba(220,38,38,0.25)' }}
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset-tenant confirmation overlay */}
          {showResetConfirm && (
            <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <div className="rounded-t-3xl overflow-hidden p-6" style={{ background: t.bgPrimary, border: `1px solid ${t.border}` }}>
                <p className="font-bold text-base mb-2" style={{ color: t.textPrimary }}>Switch tenant?</p>
                <p className="text-sm mb-5" style={{ color: t.textMuted }}>
                  You'll be signed out and asked to enter a different UiPath org, tenant, and OAuth client ID.
                  Cached settings for the current tenant will be cleared.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium"
                    style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: t.textPrimary, border: 'none' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetTenant}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white"
                    style={{ background: branding.primaryColor, border: 'none' }}
                  >
                    Switch tenant
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Brand footer */}
          <div className="flex flex-col items-center gap-1.5 pt-8 pb-4">
            <img src={theme === 'light' ? LOGO_LIGHT : LOGO_WHITE} alt={branding.appName} style={{ height: 28, objectFit: 'contain', opacity: 0.7 }} />
            <p style={{ fontSize: 12, color: theme === 'light' ? 'rgba(24,33,38,0.5)' : 'rgba(255,255,255,0.4)' }}>Agentic AI · Built for the enterprise</p>
          </div>

        </div>
      </div>
    </div>
  );
}
