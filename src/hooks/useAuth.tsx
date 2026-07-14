import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { UiPath, UiPathError } from '@uipath/uipath-typescript/core';
import type { UiPathSDKConfig } from '@uipath/uipath-typescript/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';

// Module-level: deduplicates OAuth completion to handle React 18 StrictMode's
// double-invocation of effects during development (each effect fires twice).
// Without this, both invocations race to exchange the same one-time auth code.
let _oauthCompletion: Promise<boolean> | null = null;

interface UserProfile { firstName: string; email: string }

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  sdk: UiPath;
  login: () => Promise<void>;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  /** Populated when auth token can't be JWT-decoded (e.g. a PAT in demo mode).
   *  Null for the normal SSO path — callers should fall back to decoding sdk.getToken(). */
  profile: UserProfile | null;
  /** True when the current session is the bundled demo-token bypass
   *  (loginWithCredentials with username='demo'). Real SSO sessions are false.
   *  Consumers like the AuraConfig loader use this to skip per-tenant fetches
   *  in demo mode — demo always shows the bundled defaultConfig. */
  isDemoSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys must match the SDK's internal AuthService so that sdk.completeOAuth()
// can find what we wrote during the native-initiated flow.
const OAUTH_CONTEXT_KEY = 'uipath_sdk_oauth_context';
const CODE_VERIFIER_KEY = 'uipath_sdk_code_verifier';
// Set after a successful demo (username/password) login so a page refresh can
// rebuild the secret-auth SDK from the bundled VITE_UIPATH_DEMO_TOKEN instead of
// bouncing back to the login screen. Cleared on logout. (localStorage so it also
// survives closing/reopening the tab, not just a refresh.)
const DEMO_SESSION_KEY = 'aura_demo_session';

// Resolve the demo user's display name from Orchestrator (PATs carry no JWT claims).
async function fetchDemoProfile(config: UiPathSDKConfig, demoToken: string): Promise<UserProfile> {
  try {
    const apiBase = import.meta.env.DEV
      ? `/${config.orgName}/${config.tenantName}/orchestrator_`
      : `https://staging.api.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
    const res = await fetch(`${apiBase}/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUserExtended()`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    if (res.ok) {
      const me = await res.json();
      const raw = me.Name || me.Surname || me.UserName || me.EmailAddress || '';
      const firstName = raw.includes('@') ? raw.split('@')[0] : (raw.split(' ')[0] || 'Demo');
      return { firstName, email: me.EmailAddress || '' };
    }
  } catch { /* fall through to default */ }
  return { firstName: 'Demo', email: '' };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function randomCodeVerifier(): string {
  const b = new Uint8Array(64);
  crypto.getRandomValues(b);
  return base64UrlEncode(b);
}

async function sha256Base64Url(str: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return base64UrlEncode(new Uint8Array(digest));
}

export const AuthProvider: React.FC<{ children: ReactNode; config: UiPathSDKConfig }> = ({ children, config }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<UiPath>(() => new UiPath(config));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isDemoSession, setIsDemoSession] = useState(false);
  // True once a demo session is active/restored — guards the init effect from
  // overriding it (and from rebuilding the SDK twice under StrictMode).
  const demoInitRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Restore a persisted demo session first — rebuild the secret-auth SDK
        // from the bundled token so a refresh keeps the user signed in.
        const demoToken = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;
        if (!demoInitRef.current && localStorage.getItem(DEMO_SESSION_KEY) === '1' && demoToken) {
          demoInitRef.current = true;
          const secretSdk = new UiPath({
            baseUrl: config.baseUrl, orgName: config.orgName, tenantName: config.tenantName,
            secret: demoToken, clientId: undefined, redirectUri: undefined, scope: undefined,
          } as ConstructorParameters<typeof UiPath>[0]);
          setSdk(secretSdk);
          setIsDemoSession(true);
          setIsAuthenticated(true);
          fetchDemoProfile(config, demoToken).then((p) => { if (mounted) setProfile(p); });
          return; // skip the OAuth path entirely
        }
        // Only treat this as an OAuth callback when the URL actually has a code.
        // Without this guard, a stale sessionStorage context from a prior failed
        // attempt causes completeOAuth() to throw "Authorization code missing".
        const urlHasCode = new URLSearchParams(window.location.search).has('code');
        if (urlHasCode && sdk.isInOAuthCallback()) {
          // Deduplicate concurrent calls — StrictMode fires this effect twice before
          // the first completeOAuth() network request finishes, causing "code already used".
          if (!_oauthCompletion) {
            _oauthCompletion = sdk.completeOAuth().finally(() => {
              _oauthCompletion = null;
            });
          }
          await _oauthCompletion;
        }
        if (mounted && !demoInitRef.current) setIsAuthenticated(sdk.isAuthenticated());
      } catch (err) {
        if (!mounted) return;
        console.error('Authentication initialization failed:', err);
        setError(err instanceof UiPathError ? err.message : err instanceof Error ? err.message : 'Authentication failed');
        setIsAuthenticated(false);
      } finally {
        if (mounted) {
          setIsLoading(false);
          // Always clean OAuth params from URL so the app never gets stuck on LoadingOrb
          // if the code was already consumed or the exchange failed
          if (new URLSearchParams(window.location.search).has('code')) {
            const clean = new URL(window.location.href);
            clean.searchParams.delete('code');
            clean.searchParams.delete('state');
            clean.searchParams.delete('iss');
            window.history.replaceState({}, '', clean.toString());
          }
        }
      }
    };
    initializeAuth();
    return () => { mounted = false; };
  }, [sdk]);

  // Native-only: listen for deep-link callbacks (aura://callback?code=...)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: Awaited<ReturnType<typeof CapacitorApp.addListener>> | null = null;
    (async () => {
      handle = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        try {
          if (!event.url.startsWith('aura://')) return;
          const u = new URL(event.url);
          const code = u.searchParams.get('code');
          const state = u.searchParams.get('state');
          if (!code) return;
          // Close the system browser (SFSafariViewController) that opened the login page
          Browser.close().catch(() => { /* already closed */ });
          // Inject code+state into window.location.search so sdk.completeOAuth() finds them.
          // The SDK reads these via URLSearchParams(window.location.search).
          const clean = new URL(window.location.href);
          clean.search = '';
          clean.searchParams.set('code', code);
          if (state) clean.searchParams.set('state', state);
          window.history.replaceState({}, '', clean.toString());
          setIsLoading(true);
          setError(null);
          try {
            if (!_oauthCompletion) {
              _oauthCompletion = sdk.completeOAuth().finally(() => { _oauthCompletion = null; });
            }
            await _oauthCompletion;
            setIsAuthenticated(sdk.isAuthenticated());
          } catch (err) {
            console.error('Native OAuth completion failed:', err);
            setError(err instanceof UiPathError ? err.message : err instanceof Error ? err.message : 'Authentication failed');
            setIsAuthenticated(false);
          } finally {
            setIsLoading(false);
            const cleared = new URL(window.location.href);
            cleared.search = '';
            window.history.replaceState({}, '', cleared.toString());
          }
        } catch (err) {
          console.error('appUrlOpen handler error:', err);
        }
      });
    })();
    return () => { handle?.remove(); };
  }, [sdk]);

  const login = async () => {
    setIsLoading(true);
    setError(null);
    // Clear any stale OAuth context from a previous failed attempt so the SDK
    // starts a fresh PKCE flow instead of trying to resume a dead one.
    sessionStorage.removeItem(OAUTH_CONTEXT_KEY);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
    try {
      if (Capacitor.isNativePlatform()) {
        // Native: replicate the SDK's PKCE flow, then open in SFSafariViewController.
        // The WebView cannot navigate cross-origin to UiPath identity and back.
        const clientId = (config as { clientId: string }).clientId;
        const scope = (config as { scope: string }).scope;
        const redirectUri = (config as { redirectUri: string }).redirectUri;
        const codeVerifier = randomCodeVerifier();
        const codeChallenge = await sha256Base64Url(codeVerifier);
        const state = codeVerifier.slice(0, 16);
        sessionStorage.setItem(OAUTH_CONTEXT_KEY, JSON.stringify({
          codeVerifier,
          clientId,
          redirectUri,
          baseUrl: config.baseUrl,
          orgName: config.orgName,
          tenantName: config.tenantName,
          scope,
        }));
        sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          scope: scope + ' offline_access',
          state,
        });
        const authUrl = `${config.baseUrl}/${config.orgName}/identity_/connect/authorize?${params.toString()}`;
        await Browser.open({ url: authUrl, presentationStyle: 'popover' });
        // Stay in loading state — resolution happens in the appUrlOpen handler.
        return;
      }
      // Web: initialize() starts the OAuth PKCE flow (redirects to UiPath login page).
      // The page navigates away so this promise typically never resolves.
      await sdk.initialize();
      if (sdk.isAuthenticated()) setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof UiPathError ? err.message : err instanceof Error ? err.message : 'Login failed');
      setIsAuthenticated(false);
    } finally {
      if (!Capacitor.isNativePlatform()) setIsLoading(false);
    }
  };

  const loginWithCredentials = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!username.trim() || !password) {
        throw new Error('Enter both username and password');
      }
      // Demo bypass: a small set of accepted credentials authenticate the SDK
      // with the owner's PAT from VITE_UIPATH_DEMO_TOKEN. Every downstream call
      // (sdk.getToken(), agents, REST fetches) then runs under that identity.
      //
      //   • demo / demo                       → public demo (shown on login hint card)
      //   • Apple App Store reviewer creds    → stored as SHA-256 hashes below so the
      //     plaintext credentials don't appear in the JS bundle. Reviewers receive
      //     the actual credentials via App Store Connect → App Review Information.
      //     UiPath admin can't whitelist custom URL schemes for the iOS SSO redirect,
      //     so reviewers use the username/password popup instead of OAuth.
      const _u = username.trim().toLowerCase();
      const _p = password;
      // Hashes for the reviewer credentials. Generated with:
      //   echo -n "<value>" | shasum -a 256
      const REVIEWER_USER_HASH = 'bf88b403d834c761175b08b5969222d1fa0ded14a644dca58e254928a963bcef';
      const REVIEWER_PASS_HASH = '8b52a45da40f52dc1451db232a01bdbe89d01508686c9620e433e4842b9c8ac2';
      const sha256Hex = async (s: string): Promise<string> => {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      };
      const isPublicDemo = _u === 'demo' && _p.toLowerCase() === 'demo';
      const isReviewerMatch =
        (await sha256Hex(_u)) === REVIEWER_USER_HASH &&
        (await sha256Hex(_p)) === REVIEWER_PASS_HASH;
      const isDemo = isPublicDemo || isReviewerMatch;
      if (isDemo) {
        const demoToken = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;
        if (!demoToken) {
          throw new Error('Demo mode is not configured. Set VITE_UIPATH_DEMO_TOKEN in .env.');
        }
        // Swap the SDK to secret-auth mode. The UiPath constructor auto-
        // authenticates when `secret` is provided (dist/core/index.mjs:5281).
        // All downstream callers (ConversationalAgent, REST fetches via
        // sdk.getToken(), etc.) then run under this token's identity.
        // Explicitly null OAuth fields so the SDK's XOR auth-config check
        // doesn't see both `secret` and meta-tag-injected OAuth creds (the
        // hosted /aura page injects uipath:client-id/redirect-uri/scope tags).
        const secretSdk = new UiPath({
          baseUrl: config.baseUrl,
          orgName: config.orgName,
          tenantName: config.tenantName,
          secret: demoToken,
          clientId: undefined,
          redirectUri: undefined,
          scope: undefined,
        } as ConstructorParameters<typeof UiPath>[0]);
        setSdk(secretSdk);
        // PATs are opaque — no embedded JWT claims. Ask the Orchestrator who
        // owns this token so the UI greets the user by name.
        try {
          const apiBase = import.meta.env.DEV
            ? `/${config.orgName}/${config.tenantName}/orchestrator_`
            : `https://staging.api.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
          const res = await fetch(`${apiBase}/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUserExtended()`, {
            headers: { Authorization: `Bearer ${demoToken}` },
          });
          if (res.ok) {
            const me = await res.json();
            const raw = me.Name || me.Surname || me.UserName || me.EmailAddress || '';
            const firstName = raw.includes('@') ? raw.split('@')[0] : (raw.split(' ')[0] || 'Demo');
            setProfile({ firstName, email: me.EmailAddress || '' });
          } else {
            setProfile({ firstName: 'Demo', email: '' });
          }
        } catch {
          setProfile({ firstName: 'Demo', email: '' });
        }
        setIsDemoSession(true);
        setIsAuthenticated(true);
        // Persist so a refresh restores this session instead of bouncing to login.
        localStorage.setItem(DEMO_SESSION_KEY, '1');
        demoInitRef.current = true;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 600));
      throw new Error('Username & password sign-in isn’t enabled for this tenant. Contact your admin or use SSO.');
    } catch (err) {
      setError(err instanceof UiPathError ? err.message : err instanceof Error ? err.message : 'Login failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(`uipath_sdk_user_token-${(config as { clientId?: string }).clientId}`);
    sessionStorage.removeItem(OAUTH_CONTEXT_KEY);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);
    demoInitRef.current = false;
    setIsAuthenticated(false);
    setIsDemoSession(false);
    setError(null);
    setProfile(null);
    // Reset SDK instance to clear any in-memory token state
    setSdk(new UiPath(config));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, sdk, login, loginWithCredentials, logout, error, profile, isDemoSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
