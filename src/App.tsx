import { useState, useMemo, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import './App.css';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ConfigProvider, useConfig, useConfigUpdater, useTenantConfigLoader, loadCachedConfig, loadLocalConfig, stanbicConfig, applyFavicon, LOGO_SIZES } from './config';
import type { TenantConnection } from './onboarding/tenantSelection';
import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import type { AgentGetResponse } from '@uipath/uipath-typescript/conversational-agent';
import DeskShell from './employee/DeskShell';
import MobileWork from './employee/mobile/MobileWork';
import MobileApprovals from './employee/mobile/screens/Approvals';
import MobileClients from './employee/mobile/screens/Clients';
import RoleSheet from './employee/mobile/RoleSheet';
import { useEmployeeRole } from './employee/mobile/role';
import ExploreTab from './components/ExploreTab';
import ChatHistoryTab from './components/ChatHistoryTab';
import { findPrimaryAgent } from './config/primaryAgent';
import ChatView from './components/ChatView';
import ProfileTab from './components/ProfileTab';
import AlertsTab, { getInitialUnreadCount } from './components/AlertsTab';
import type { Tab } from './components/BottomNav';
import LoopingVideo from './components/LoopingVideo';
import GuestChat from './components/GuestChat';
import WelcomeScreen from './components/WelcomeScreen';
import { useVideoBlob } from './utils/useVideoBlob';
import type { AgentRunContext } from './types';
import { setOperator } from './onboarding/operator';

const authConfig: UiPathSDKConfig = {
  clientId: import.meta.env.VITE_UIPATH_CLIENT_ID,
  orgName: import.meta.env.VITE_UIPATH_ORG_NAME,
  tenantName: import.meta.env.VITE_UIPATH_TENANT_NAME,
  baseUrl: import.meta.env.VITE_UIPATH_BASE_URL,
  redirectUri: (() => {
    if (Capacitor.isNativePlatform()) return 'zara-ai://callback';
    const { origin, pathname, hostname } = window.location;
    // On localhost, always use the current origin so OAuth returns to the dev
    // server — ignoring any staging/prod VITE_UIPATH_REDIRECT_URI in .env.
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    if (!isLocalhost && import.meta.env.VITE_UIPATH_REDIRECT_URI) return import.meta.env.VITE_UIPATH_REDIRECT_URI;
    // When accessed via the internal /apps_/default/.../ID.../public path,
    // read the cdn-base meta tag to find the app's system name, then look up
    // the routing name from the deployment list — or fall back to the first
    // segment of the pathname (e.g. /personal-assistant-v3 → personal-assistant-v3)
    if (pathname.startsWith('/apps_/default/')) {
      // Extract routing name from the document's <base href="/routingName/">
      const baseEl = document.querySelector('base');
      const baseHref = baseEl?.getAttribute('href') || '';
      const routingName = baseHref.replace(/^\/|\/$/g, '');
      if (routingName) return `${origin}/${routingName}`;
    }
    return (origin + pathname).replace(/\/$/, '');
  })(),
  scope: import.meta.env.VITE_UIPATH_SCOPES,
};

function LoadingOrb() {
  const { theme } = useTheme();
  const orbSrc = theme === 'light' ? './orb-light.mp4' : './orb.mp4';
  const blobSrc = useVideoBlob(orbSrc);
  return (
    <div className="flex items-center justify-center h-full" style={{ background: theme === 'light' ? '#e8ebed' : '#000' }}>
      {theme === 'light' ? (
        <div style={{ width: 56, height: 56 }}>
          <LoopingVideo src={orbSrc} style={{ objectFit: 'contain' }} />
        </div>
      ) : (
        <video
          src={blobSrc}
          key={blobSrc}
          autoPlay loop muted playsInline preload="auto"
          ref={(el) => {
            if (!el) return;
            el.play().catch(() => {});
            if (el.readyState >= 2) el.style.opacity = '1';
          }}
          style={{ width: 56, height: 56, objectFit: 'contain', opacity: 0, transition: 'opacity 0.3s ease' }}
          onCanPlay={(e) => {
            const v = e.target as HTMLVideoElement;
            v.style.opacity = '1';
            v.play().catch(() => {});
          }}
          onLoadedData={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
        />
      )}
    </div>
  );
}

function parseToken(token: string | undefined): { firstName: string; email: string } {
  if (!token) return { firstName: '', email: '' };
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const email = p.email || p.upn || '';
    const raw = p.FirstName || p.first_name || p.given_name || p.name?.split(' ')[0] || email.split('@')[0] || '';
    const firstName = raw.includes('@') ? raw.split('@')[0] : raw;
    return { firstName, email };
  } catch {
    return { firstName: '', email: '' };
  }
}

/** Which chrome the app wears. Set by the route in main.tsx — nothing else. */
export type Shell = 'mobile' | 'web';

function MainApp({ shell = 'mobile' }: { shell?: Shell }) {
  const web = shell === 'web';
  const { sdk, isLoading, isAuthenticated, loginWithCredentials, logout, error, profile } = useAuth();
  const { isRtl, theme } = useTheme();
  const { branding } = useConfig();
  const orbSrc = theme === 'light' ? './orb-light.mp4' : './orb.mp4';
  const orbBlobSrc = useVideoBlob(orbSrc);
  const [signingIn, setSigningIn] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [credsUser, setCredsUser] = useState('');
  const [credsPass, setCredsPass] = useState('');
  const [credsShowPass, setCredsShowPass] = useState(false);
  const [credsSubmitting, setCredsSubmitting] = useState(false);
  // ── "Sign in with UiPath" popup ───────────────────────────────────
  // UiPath admin can't whitelist iOS custom URL schemes (aura://callback),
  // so the OAuth flow always errors out. Instead, the orange CTA opens a
  // popup with the App Store reviewer credentials baked in as a hint —
  // reviewers can sign in directly without ever hitting the SSO error.
  // The public demo flow ("Use username & password instead") below is
  // unchanged.
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoUser, setSsoUser] = useState('');
  const [ssoPass, setSsoPass] = useState('');
  const [ssoShowPass, setSsoShowPass] = useState(false);
  const [ssoSubmitting, setSsoSubmitting] = useState(false);
  // Three-stage flow for non-authenticated users:
  //   'welcome' (WelcomeScreen)  →  "Check out Aura's Magic"  →  'chat' (GuestChat)
  //   'chat' (GuestChat)         →  "Sign in"                  →  'login' (original screen)
  //   'login'                    →  back arrow                 →  'chat'
  // Resets to 'welcome' on every sign-out.
  const [stage, setStage] = useState<'welcome' | 'chat' | 'login'>('welcome');

  // Orange "Sign in with UiPath" CTA → opens the reviewer-creds popup instead
  // of triggering OAuth (which errors out — see comment by ssoOpen state).
  const handleSignIn = () => { setSsoOpen(true); };
  // If an auth error surfaces (stale context, invalid redirect, etc.), release
  // any "Signing in…" state so the user can retry.
  useEffect(() => {
    if (error) {
      setSigningIn(false);
      setSsoSubmitting(false);
    }
  }, [error]);
  const handleSsoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSsoSubmitting(true);
    try {
      await loginWithCredentials(ssoUser, ssoPass);
    } finally {
      setSsoSubmitting(false);
    }
  };
  // After logout, return to the default full-screen SSO layout — collapse the
  // password panel and clear the fields so the next viewer sees the clean
  // primary entry point rather than an already-expanded demo form.
  useEffect(() => {
    if (!isAuthenticated) {
      setCredsOpen(false);
      setCredsUser('');
      setCredsPass('');
      setCredsShowPass(false);
      setSsoOpen(false);
      setSsoUser('');
      setSsoPass('');
      setSsoShowPass(false);
      // After sign-out, return to the very first screen so the user sees the
      // welcome layer again (not the login screen).
      setStage('welcome');
    }
  }, [isAuthenticated]);
  const handleCredsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCredsSubmitting(true);
    try {
      await loginWithCredentials(credsUser, credsPass);
    } finally {
      setCredsSubmitting(false);
    }
  };
  const { firstName: userName, email: userEmail } = isAuthenticated
    ? (profile ?? parseToken(sdk.getToken()))
    : { firstName: '', email: '' };
  // Tell the record store who is capturing, so an application taken at a desk
  // carries the name of whoever took it. Unset on the customer's own app, which
  // is exactly how a self-service opening is told apart from an assisted one.
  useEffect(() => { setOperator(userName || null); }, [userName]);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [customersOpen, setCustomersOpen] = useState(false); // Option B: Customers flow as an overlay launched from Home
  const [approvalsOpen, setApprovalsOpen] = useState(false); // Mobile Approvals — overlay launched from Home
  // Whose job the phone is doing (Relationship Manager, maker, verifier, ops).
  const { role, setRole, config: roleCfg } = useEmployeeRole();
  const [roleSheet, setRoleSheet] = useState(false);
  const canSwitchRole = roleCfg.allowSwitch && roleCfg.roles.length > 1;
  const [exploreInitialCap] = useState<string | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(() => getInitialUnreadCount());
  const [chatAgent, setChatAgent] = useState<AgentGetResponse | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | undefined>(undefined);

  // iOS Low Power Mode blocks autoplay even for muted+playsInline videos.
  // First user gesture lifts the restriction — kick paused videos on the
  // initial pointerdown so orbs/looping videos recover without a visible
  // play button.
  useEffect(() => {
    const playAll = () => {
      // Videos that manage their own playback (data-managed) are left alone.
      document.querySelectorAll<HTMLVideoElement>('video:not([data-managed])').forEach(v => {
        if (v.paused) v.play().catch(() => {});
      });
    };
    document.addEventListener('pointerdown', playAll, { once: true, capture: true });
    return () => document.removeEventListener('pointerdown', playAll, { capture: true });
  }, []);

  const [chatContext, setChatContext] = useState<AgentRunContext | undefined>(undefined);

  const conversationalAgent = useMemo(() => new ConversationalAgent(sdk), [sdk]);

  // The phone's Aura tab hands off to the bank's agent (Ask Pulse) — from its
  // header, and with the banker's question when Aura can't answer it itself.
  const askPulse = useCallback(async (question?: string) => {
    const all = await conversationalAgent.getAll().catch(() => []);
    const agent = findPrimaryAgent(all) ?? all[0];
    if (!agent) return;
    setChatConversationId(undefined);
    setChatContext(question?.trim()
      ? { agentName: agent.name, summary: '', timeAgo: '', autoItems: [], reviewItems: [], prefill: question, prefillVoice: false }
      : undefined);
    setChatAgent(agent);
  }, [conversationalAgent]);

  // Keep showing loading orb during OAuth callback — prevents brief login screen flash
  // while the auth hook is exchanging the code for a token
  const isOAuthCallback = new URLSearchParams(window.location.search).has('code');
  if (isLoading || isOAuthCallback) return <LoadingOrb />;

  // ── Welcome layer (very first screen for non-authenticated users) ──
  if (!isAuthenticated && stage === 'welcome') {
    return <WelcomeScreen onContinue={() => setStage('chat')} />;
  }

  // ── Guest chat ("Ask Pulse") ──────────────────────────────────────
  // Apple guideline 5.1.1(i): non-account-based features (chat with the AI)
  // must be accessible without sign-in.
  if (!isAuthenticated && stage === 'chat') {
    return (
      <GuestChat
        onSignIn={() => setStage('login')}
        onDecline={() => setStage('welcome')}
      />
    );
  }

  // ── Login screen ──────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full relative" style={{ background: theme === 'light' ? '#e8ebed' : '#000' }}>
        {/* Back arrow — returns to GuestChat. Top-left, floating over the orb. */}
        <button
          type="button"
          onClick={() => setStage('chat')}
          aria-label="Back"
          className="absolute top-5 z-40 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{
            insetInlineStart: 20,
            background: theme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${theme === 'light' ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.12)'}`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme === 'light' ? '#182126' : '#fff'} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {/* Optional customer logo — same image driven from admin config
         *  (branding.logo) as the welcome/guest screen. Overlaid ABSOLUTELY at
         *  the top so it never reflows or moves any existing element. Hidden
         *  (faded out) while a username/password form is open — the inline creds
         *  form (credsOpen) and the "Sign in with UiPath" sheet (ssoOpen) both
         *  shrink/cover the orb, which would otherwise overlap the logo. It
         *  fades back in when the form is closed. No logo → nothing renders. */}
        {branding.logo && (
          <div
            className="absolute left-0 right-0 z-30 flex justify-center"
            style={{
              top: 'max(env(safe-area-inset-top), 48px)',
              pointerEvents: 'none',
              opacity: credsOpen || ssoOpen ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
          >
            <img
              src={branding.logo}
              alt={branding.appName}
              style={{ ...LOGO_SIZES[branding.logoSize === 'small' ? 'small' : 'medium'], objectFit: 'contain' }}
            />
          </div>
        )}
        {/* "Sign in with UiPath" popup — opens with reviewer creds baked in as
         * a hint. The real OAuth flow is bypassed because UiPath admin can't
         * whitelist the iOS aura://callback custom scheme. */}
        {ssoOpen && (
          <div
            className="absolute inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'auraFadeIn 0.2s ease' }}
            onClick={() => setSsoOpen(false)}
          >
            <style>{`@keyframes auraFadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes auraSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div
              className="w-full rounded-t-3xl px-5 pt-3 pb-7"
              style={{
                background: theme === 'light' ? '#ffffff' : 'linear-gradient(180deg, #1a242d 0%, #131b21 100%)',
                border: `1px solid ${theme === 'light' ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
                maxHeight: '85%',
                overflowY: 'auto',
                animation: 'auraSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* drag handle */}
              <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold" style={{ fontFamily: "'Poppins', Arial, sans-serif", fontSize: 17, color: theme === 'light' ? '#182126' : '#fff' }}>Sign in with SSO</p>
                <button
                  type="button"
                  onClick={() => setSsoOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme === 'light' ? 'rgba(24,33,38,0.6)' : 'rgba(255,255,255,0.6)'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="mb-3" style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: 12.5, color: theme === 'light' ? 'rgba(24,33,38,0.6)' : 'rgba(255,255,255,0.55)' }}>
                Enter your UiPath account credentials to continue.
              </p>
              <form onSubmit={handleSsoSubmit} className="flex flex-col gap-2.5">
                {/* Username field */}
                <div className="aura-field relative w-full">
                  <svg
                    className="aura-cred-icon absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                    style={{ insetInlineStart: 14, color: theme === 'light' ? 'rgba(24,33,38,0.4)' : 'rgba(255,255,255,0.4)' }}
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    type="email"
                    autoComplete="username"
                    placeholder="your.name@uipath.com"
                    value={ssoUser}
                    onChange={(e) => setSsoUser(e.target.value)}
                    className="aura-cred-input w-full text-sm outline-none"
                    style={{
                      fontFamily: "'Inter', Arial, sans-serif",
                      paddingTop: 13, paddingBottom: 13,
                      paddingInlineStart: 42, paddingInlineEnd: 14,
                      borderRadius: 12,
                      background: theme === 'light' ? '#ffffff' : '#0f171d',
                      border: `1.5px solid ${theme === 'light' ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.08)'}`,
                      color: theme === 'light' ? '#182126' : '#fff',
                    }}
                  />
                </div>
                {/* Password field */}
                <div className="aura-field relative w-full">
                  <svg
                    className="aura-cred-icon absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                    style={{ insetInlineStart: 14, color: theme === 'light' ? 'rgba(24,33,38,0.4)' : 'rgba(255,255,255,0.4)' }}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    type={ssoShowPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Password"
                    value={ssoPass}
                    onChange={(e) => setSsoPass(e.target.value)}
                    className="aura-cred-input w-full text-sm outline-none"
                    style={{
                      fontFamily: "'Inter', Arial, sans-serif",
                      paddingTop: 13, paddingBottom: 13,
                      paddingInlineStart: 42, paddingInlineEnd: 44,
                      borderRadius: 12,
                      background: theme === 'light' ? '#ffffff' : '#0f171d',
                      border: `1.5px solid ${theme === 'light' ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.08)'}`,
                      color: theme === 'light' ? '#182126' : '#fff',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setSsoShowPass(s => !s)}
                    aria-label={ssoShowPass ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                    style={{
                      insetInlineEnd: 8, width: 32, height: 32, borderRadius: 8,
                      color: theme === 'light' ? 'rgba(24,33,38,0.5)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {ssoShowPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {/* Submit */}
                <button
                  type="submit"
                  disabled={ssoSubmitting || !ssoUser || !ssoPass}
                  className="aura-cred-submit w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 mt-2"
                  style={{
                    fontFamily: "'Poppins', Arial, sans-serif",
                    fontWeight: 600,
                    letterSpacing: -0.2,
                    color: '#fff',
                    background: (ssoSubmitting || !ssoUser || !ssoPass)
                      ? (theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.35)' : 'rgba(var(--brand-primary-rgb),0.25)')
                      : 'var(--brand-primary)',
                    border: 'none',
                    boxShadow: (ssoSubmitting || !ssoUser || !ssoPass) ? 'none' : '0 1px 3px rgba(var(--brand-primary-rgb),0.18)',
                  }}
                >
                  {ssoSubmitting ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}>
                        <path d="M5 12h14M13 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
                {error && (
                  <div className="rounded-xl px-3 py-2 text-sm text-center mt-1" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626' }}>
                    {error}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
        {theme === 'light' && <div style={{ flex: 1, minHeight: 0 }} />}
        {/* Video — fills remaining space above the text/button block */}
        <div className={theme === 'light' ? 'flex-shrink-0' : 'flex-1 min-h-0'} style={theme === 'light' ? { height: credsOpen ? 240 : 320, transition: 'height 0.4s cubic-bezier(0.16,1,0.3,1)' } : undefined}>
          {theme === 'light' ? (
            <LoopingVideo
              src={orbSrc}
              style={{ objectFit: 'cover', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
            />
          ) : (
            <video
              src={orbBlobSrc}
              key={orbBlobSrc}
              autoPlay loop muted playsInline preload="auto"
              // Low Power Mode on iOS blocks autoplay even for muted+playsInline.
              // Trigger play() explicitly on every readiness event so the video
              // recovers as soon as the OS lets us — and so the next user tap
              // anywhere on the page kicks it off if LPM is still blocking.
              ref={(el) => {
                if (!el) return;
                el.play().catch(() => {});
                if (el.readyState >= 2) el.style.opacity = '1';
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0, transition: 'opacity 0.3s ease' }}
              onCanPlay={(e) => {
                const v = e.target as HTMLVideoElement;
                v.style.opacity = '1';
                v.play().catch(() => {});
              }}
              onLoadedData={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
            />
          )}
        </div>

        {/* Flex spacer between orb and the title — pushes the "Aura" + sign-in
         * block down toward the bottom of the viewport. */}
        {theme === 'light' && <div className="flex-1 min-h-0" />}
        {/* App title + sign-in block */}
        <div className="flex flex-col items-center px-6 gap-3 flex-shrink-0" style={{ paddingBottom: 28, paddingTop: 8 }}>
          {/* App name */}
          <div className="flex items-center gap-2 mb-1">
            <span style={{
              fontFamily: "'Poppins', Arial, sans-serif",
              fontWeight: 600,
              fontSize: 36,
              color: theme === 'light' ? '#182126' : '#ffffff',
              letterSpacing: -1,
              lineHeight: 1,
            }}>
              {branding.appName}
            </span>
          </div>
          <p className="text-sm text-center" style={{
            color: signingIn ? 'rgba(var(--brand-primary-rgb),0.5)' : 'rgba(var(--brand-primary-rgb),0.8)',
            fontFamily: "'Inter', Arial, sans-serif",
            transition: 'color 0.3s',
          }}>
            {signingIn ? 'Authenticating with UiPath...' : 'Your UiPath AI agents, at your fingertips'}
          </p>
          {error && (
            <div className="w-full rounded-2xl p-3 text-sm text-center"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              {error}
            </div>
          )}
          {/* UiPath Robotic Orange CTA button */}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full py-4 rounded-2xl text-white text-base flex items-center justify-center gap-2.5"
            style={{
              fontFamily: "'Poppins', Arial, sans-serif",
              fontWeight: 600,
              background: 'var(--brand-primary)',
              boxShadow: '0 0 30px rgba(var(--brand-primary-rgb),0.45)',
              letterSpacing: -0.3,
            }}
          >
            {signingIn ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                  <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Signing in...
              </>
            ) : 'Sign in with SSO'}
          </button>

          {/* Secondary path: expand inline to sign in with credentials */}
          <button
            type="button"
            onClick={() => setCredsOpen(o => !o)}
            className="text-sm flex items-center gap-2 py-1.5"
            style={{
              fontFamily: "'Inter', Arial, sans-serif",
              color: theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.9)' : 'rgba(var(--brand-primary-rgb),0.75)',
              fontWeight: 500,
            }}
          >
            {credsOpen ? 'Hide password sign-in' : 'Use username & password instead'}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: credsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Inline expanding credentials panel — premium card, no route change */}
          <div
            className="w-full overflow-hidden"
            style={{
              maxHeight: credsOpen ? 460 : 0,
              opacity: credsOpen ? 1 : 0,
              transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
            }}
          >
            <style>{`
              .aura-cred-input { transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.2s ease; }
              .aura-cred-input:focus { border-color: var(--brand-primary) !important; box-shadow: 0 0 0 4px rgba(var(--brand-primary-rgb),0.14) !important; }
              .aura-cred-input::placeholder { color: ${theme === 'light' ? 'rgba(24,33,38,0.38)' : 'rgba(255,255,255,0.38)'}; }
              /* Override Chrome's autofill yellow so saved demo/demo credentials keep the card styling. */
              .aura-cred-input:-webkit-autofill,
              .aura-cred-input:-webkit-autofill:hover,
              .aura-cred-input:-webkit-autofill:focus,
              .aura-cred-input:-webkit-autofill:active {
                -webkit-box-shadow: 0 0 0 1000px ${theme === 'light' ? '#ffffff' : '#0f171d'} inset !important;
                -webkit-text-fill-color: ${theme === 'light' ? '#182126' : '#ffffff'} !important;
                caret-color: ${theme === 'light' ? '#182126' : '#ffffff'};
                transition: background-color 600000s 0s, color 600000s 0s;
              }
              .aura-cred-icon { transition: color 0.2s ease; }
              .aura-field:focus-within .aura-cred-icon { color: var(--brand-primary); }
              .aura-cred-submit:not(:disabled):active { transform: scale(0.98); }
              .aura-cred-submit { transition: transform 0.12s ease, box-shadow 0.25s ease, opacity 0.2s ease; }
            `}</style>
            <div className="pt-3">
              <div
                className="rounded-2xl px-4 pt-4 pb-5 relative overflow-hidden"
                style={{
                  background: theme === 'light'
                    ? '#ffffff'
                    : 'linear-gradient(180deg, #1a242d 0%, #131b21 100%)',
                  border: `1px solid ${theme === 'light' ? 'rgba(24,33,38,0.06)' : 'rgba(255,255,255,0.09)'}`,
                  boxShadow: theme === 'light'
                    ? '0 4px 14px rgba(24,33,38,0.04)'
                    : '0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <form onSubmit={handleCredsSubmit} className="flex flex-col gap-2.5">
                  {/* "OR" pill divider */}
                  <div className="flex items-center gap-3 -mt-0.5 mb-1">
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent 0%, ${theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.22)' : 'rgba(255,255,255,0.14)'} 100%)` }} />
                    <span style={{
                      fontSize: 9.5,
                      letterSpacing: 1.8,
                      fontWeight: 700,
                      fontFamily: "'Inter', Arial, sans-serif",
                      color: 'var(--brand-primary)',
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.08)' : 'rgba(var(--brand-primary-rgb),0.14)',
                      border: `1px solid rgba(var(--brand-primary-rgb),${theme === 'light' ? 0.2 : 0.3})`,
                    }}>OR</span>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.22)' : 'rgba(255,255,255,0.14)'} 0%, transparent 100%)` }} />
                  </div>

                  {/* Demo credentials hint */}
                  <div
                    className="rounded-xl px-3 py-2.5 mb-1 flex items-start gap-2"
                    style={{
                      background: theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.07)' : 'rgba(var(--brand-primary-rgb),0.10)',
                      border: `1px solid rgba(var(--brand-primary-rgb),${theme === 'light' ? 0.18 : 0.25})`,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <div style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: 11.5, lineHeight: 1.4, color: theme === 'light' ? 'rgba(24,33,38,0.78)' : 'rgba(255,255,255,0.78)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>Try the demo</span>
                      <span> — username </span>
                      <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '1px 5px', borderRadius: 4, background: theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.12)' : 'rgba(var(--brand-primary-rgb),0.18)', color: theme === 'light' ? 'var(--brand-primary)' : '#5fd1de' }}>demo</code>
                      <span> / password </span>
                      <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '1px 5px', borderRadius: 4, background: theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.12)' : 'rgba(var(--brand-primary-rgb),0.18)', color: theme === 'light' ? 'var(--brand-primary)' : '#5fd1de' }}>demo</code>
                    </div>
                  </div>

                  {/* Username field */}
                  <div className="aura-field relative w-full">
                    <svg
                      className="aura-cred-icon absolute top-1/2 -translate-y-1/2 pointer-events-none"
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                      style={{ insetInlineStart: 14, color: theme === 'light' ? 'rgba(24,33,38,0.4)' : 'rgba(255,255,255,0.4)' }}
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="Username or email"
                      value={credsUser}
                      onChange={(e) => setCredsUser(e.target.value)}
                      className="aura-cred-input w-full text-sm outline-none"
                      style={{
                        fontFamily: "'Inter', Arial, sans-serif",
                        paddingTop: 13, paddingBottom: 13,
                        paddingInlineStart: 42, paddingInlineEnd: 14,
                        borderRadius: 12,
                        background: theme === 'light' ? '#ffffff' : '#0f171d',
                        border: `1.5px solid ${theme === 'light' ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.08)'}`,
                        color: theme === 'light' ? '#182126' : '#fff',
                      }}
                    />
                  </div>

                  {/* Password field */}
                  <div className="aura-field relative w-full">
                    <svg
                      className="aura-cred-icon absolute top-1/2 -translate-y-1/2 pointer-events-none"
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                      style={{ insetInlineStart: 14, color: theme === 'light' ? 'rgba(24,33,38,0.4)' : 'rgba(255,255,255,0.4)' }}
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input
                      type={credsShowPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Password"
                      value={credsPass}
                      onChange={(e) => setCredsPass(e.target.value)}
                      className="aura-cred-input w-full text-sm outline-none"
                      style={{
                        fontFamily: "'Inter', Arial, sans-serif",
                        paddingTop: 13, paddingBottom: 13,
                        paddingInlineStart: 42, paddingInlineEnd: 44,
                        borderRadius: 12,
                        background: theme === 'light' ? '#ffffff' : '#0f171d',
                        border: `1.5px solid ${theme === 'light' ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.08)'}`,
                        color: theme === 'light' ? '#182126' : '#fff',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCredsShowPass(s => !s)}
                      aria-label={credsShowPass ? 'Hide password' : 'Show password'}
                      className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                      style={{
                        insetInlineEnd: 8, width: 32, height: 32, borderRadius: 8,
                        color: theme === 'light' ? 'rgba(24,33,38,0.5)' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {credsShowPass ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>

                  {/* Submit — filled teal gradient */}
                  <button
                    type="submit"
                    disabled={credsSubmitting || !credsUser || !credsPass}
                    className="aura-cred-submit w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 mt-1"
                    style={{
                      fontFamily: "'Poppins', Arial, sans-serif",
                      fontWeight: 600,
                      letterSpacing: -0.2,
                      color: '#fff',
                      background: (credsSubmitting || !credsUser || !credsPass)
                        ? (theme === 'light' ? 'rgba(var(--brand-primary-rgb),0.35)' : 'rgba(var(--brand-primary-rgb),0.25)')
                        : 'linear-gradient(135deg, var(--brand-primary) 0%, #0A8A99 100%)',
                      border: 'none',
                      boxShadow: (credsSubmitting || !credsUser || !credsPass)
                        ? 'none'
                        : 'inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 3px rgba(var(--brand-primary-rgb),0.18)',
                    }}
                  >
                    {credsSubmitting ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}>
                          <path d="M5 12h14M13 5l7 7-7 7"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat view (full screen, no bottom nav) ────────────────────────
  if (chatAgent) {
    return (
      <ChatView
        key={chatAgent.id + (chatConversationId ?? '')}
        agent={chatAgent}
        conversationalAgent={conversationalAgent}
        onBack={() => { setChatAgent(null); setChatConversationId(undefined); setChatContext(undefined); }}
        onSwitchAgent={(a) => { setChatAgent(a); setChatConversationId(undefined); setChatContext(undefined); }}
        conversationId={chatConversationId}
        context={chatContext}
      />
    );
  }

  // ── The desk (/employee-web) ──────────────────────────────────────
  // A real desktop app, not the phone in a frame: its own chrome, density and
  // worklists, sharing the Operations Workbench's design language. It still
  // renders the *same* wizard, approval sheet and Customer360 the phone does,
  // so the two surfaces can't drift.
  if (web) {
    return (
      <DeskShell
        userName={userName}
        userEmail={userEmail}
        unreadAlerts={unreadAlerts}
        onLogout={logout}
        onAlertsSeen={() => setUnreadAlerts(0)}
        agentSurfaces={{
          chat: <ChatHistoryTab
            onExplore={() => undefined}
            conversationalAgent={conversationalAgent}
            onOpenChat={(agent, conversationId) => { setChatAgent(agent); setChatConversationId(conversationId); }}
          />,
          explore: <ExploreTab
            conversationalAgent={conversationalAgent}
            onSelectAgent={(agent) => { setChatAgent(agent); setChatConversationId(undefined); }}
            initialCapability={exploreInitialCap}
          />,
          alerts: <AlertsTab />,
          profile: <ProfileTab userName={userName} userEmail={userEmail} onLogout={logout} />,
        }}
      />
    );
  }

  // ── Tabbed app (the phone) ────────────────────────────────────────
  // The phone is its own app: the role's home and the tab bar around it
  // (src/employee/mobile). Approvals and clients open over its content.
  const overlay = (
    <>
      {customersOpen && (
        <div className="absolute inset-0 z-40">
          <MobileClients onClose={() => setCustomersOpen(false)} />
        </div>
      )}
      {approvalsOpen && (
        <div className="absolute inset-0 z-40">
          <MobileApprovals onClose={() => setApprovalsOpen(false)} />
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden relative" dir={isRtl ? 'rtl' : 'ltr'} style={{ background: theme === 'dark' ? '#0B0F14' : '#fff' }}>
      <div className="flex-1 overflow-hidden relative">
        <MobileWork
          key={role}
          role={role}
          onRole={setRole}
          onRoleSheet={() => { if (canSwitchRole) setRoleSheet(true); }}
          onApprovals={() => setApprovalsOpen(true)}
          onClients={() => setCustomersOpen(true)}
          onAssistant={() => setActiveTab('chat')}
          userName={userName}
          userEmail={userEmail}
          onLogout={logout}
          roles={roleCfg.roles}
          canSwitchRole={canSwitchRole}
          tab={activeTab}
          onTab={(tab) => {
            setCustomersOpen(false);
            setApprovalsOpen(false);
            setActiveTab(tab);
          }}
          onAskAgent={askPulse}
          conversationalAgent={conversationalAgent}
          overlay={overlay}
        />
      </div>
      {roleSheet && (
        <RoleSheet
          role={role}
          roles={roleCfg.roles}
          onPick={(r) => { setRole(r); setCustomersOpen(false); setApprovalsOpen(false); setActiveTab('home'); }}
          onClose={() => setRoleSheet(false)}
        />
      )}
    </div>
  );
}

// ── Tenant config wiring ─────────────────────────────────────────────────
// Build a TenantConnection from the env so the runtime knows which tenant's
// AuraConfig to read from Data Service. (No first-launch tenant picker yet —
// the app is single-tenant via .env.)
function envConnection(): TenantConnection {
  return {
    orgName: import.meta.env.VITE_UIPATH_ORG_NAME,
    tenantName: import.meta.env.VITE_UIPATH_TENANT_NAME,
    oauthClientId: import.meta.env.VITE_UIPATH_CLIENT_ID,
    baseUrl: import.meta.env.VITE_UIPATH_BASE_URL,
    redirectUri: '',
    scope: import.meta.env.VITE_UIPATH_SCOPES || '',
    setAt: '',
  };
}

/** Convert "#FF3333" → "255,51,51" for the --brand-primary-rgb CSS var. */
function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * Applies the tenant's branding to the live document: sets the --brand-primary
 * CSS variables (which the whole app reads) and the document title. Re-runs
 * whenever the effective config changes (e.g. after a Data Service load).
 */
function BrandColorBridge() {
  const { branding } = useConfig();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    const rgb = hexToRgbTriplet(branding.primaryColor);
    if (rgb) root.style.setProperty('--brand-primary-rgb', rgb);
    // Secondary — a subtler companion color used in less-prominent accents.
    const secondary = branding.secondaryColor || branding.primaryColor;
    root.style.setProperty('--brand-secondary', secondary);
    const srgb = hexToRgbTriplet(secondary);
    if (srgb) root.style.setProperty('--brand-secondary-rgb', srgb);
    if (branding.appName) document.title = branding.appName;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.appName, branding.favicon, branding.deepBlue]);
  return null;
}

/**
 * Fetches the AuraConfig record from Data Service after auth (demo or real SSO)
 * and pushes it into ConfigProvider, so admin-saved name/theme take effect.
 */
function ConfigLoaderBridge({ connection }: { connection: TenantConnection }) {
  const { sdk, isAuthenticated, isDemoSession } = useAuth();
  const setOverride = useConfigUpdater();
  const onLoaded = useCallback((cfg: Parameters<typeof setOverride>[0]) => setOverride(cfg), [setOverride]);
  useTenantConfigLoader({ sdk, connection, isAuthenticated, isDemoSession, onLoaded });
  return null;
}

export default function App({ shell = 'mobile' }: { shell?: Shell } = {}) {
  const connection = useMemo(envConnection, []);
  // Local (no-PAT) admin config wins; otherwise the per-tenant Data Service cache;
  // otherwise Stanbic — matching every other surface, so a fresh browser with no
  // saved profile shows Stanbic branding rather than the bundled Aura default.
  const local = useMemo(() => loadLocalConfig(), []);
  const cached = useMemo(() => local ?? loadCachedConfig(connection) ?? stanbicConfig, [local, connection]);
  return (
    <ConfigProvider initialOverride={cached}>
      <ThemeProvider>
        <AuthProvider config={authConfig}>
          {/* When a local demo config is present it takes precedence — don't let a
              Data Service fetch clobber it. Otherwise load from Data Service. */}
          {!local && <ConfigLoaderBridge connection={connection} />}
          <BrandColorBridge />
          <MainApp shell={shell} />
        </AuthProvider>
      </ThemeProvider>
    </ConfigProvider>
  );
}
