// ─────────────────────────────────────────────────────────────────────────────
// FaceID Verify Console (/faceid) — the ported admin console, native to Stanbic.
//
// Brought in from the standalone UiPath FaceID app and fully re-branded off the
// admin config: colours, logo, favicon and name all come from the active tenant.
// The login gate is kept (same screen) but the real UiPath OAuth is replaced by a
// one-click demo sign-in. Data is wired to the shared OnboardingStore (see data.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, stanbicConfig, applyFavicon } from '../config';
import { Console } from './Console';
import { LoginScreen } from './LoginScreen';
import './faceid.css';

function FaceIdInner() {
  const { branding } = useConfig();
  const [authed, setAuthed] = useState(false);
  // Remount the console when a kiosk scan lands in another tab, so the new
  // verification shows up live (Console loads its data on mount).
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'faceid_kiosk_vers') setRev((r) => r + 1); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Drive the console's brand vars (the ported UiPath orange/teal/deep) + tab.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fc-primary', branding.primaryColor);
    root.style.setProperty('--fc-secondary', branding.secondaryColor);
    root.style.setProperty('--fc-deep', branding.deepBlue || branding.primaryColor);
    document.title = `${branding.appName} — Verify Console`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.deepBlue, branding.appName, branding.favicon]);

  if (!authed) {
    return (
      <LoginScreen
        onSignIn={() => setAuthed(true)}
        brand={{
          appName: branding.appName,
          logo: branding.logoLight || branding.logo,
          favicon: branding.favicon,
          primary: branding.primaryColor,
          secondary: branding.secondaryColor,
        }}
      />
    );
  }
  return <Console key={rev} onLogout={() => setAuthed(false)} />;
}

export default function FaceIdConsole() {
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return (
    <ConfigProvider initialOverride={initial}>
      <FaceIdInner />
    </ConfigProvider>
  );
}
