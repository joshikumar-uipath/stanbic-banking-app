// ─────────────────────────────────────────────────────────────────────────────
// FaceID kiosk (/faceid-kiosk) — the walk-up liveness/identity capture, native.
//
// Ported from the standalone public kiosk (face-id-public). The live-camera
// pre-screen is real (getUserMedia works on localhost); the AWS liveness engine +
// backend identify are replaced by a simulated identify against a real enrolled
// person from the shared store. No login — a kiosk is a public surface. Branding
// (colours, favicon, name) comes from the admin config, like the console.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, stanbicConfig, applyFavicon } from '../config';
import { KioskWidget } from './KioskWidget';
import { configureAmplify } from './amplifyConfig';
import './faceid.css';

// Configure Amplify (Cognito guest pool) once, so the AWS FaceLivenessDetector can
// get temporary credentials to stream the liveness video to Rekognition.
configureAmplify();

function KioskInner() {
  const { branding } = useConfig();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fc-primary', branding.primaryColor);
    root.style.setProperty('--fc-secondary', branding.secondaryColor);
    root.style.setProperty('--fc-deep', branding.deepBlue || branding.primaryColor);
    document.title = `${branding.appName} — Verify Kiosk`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
    // The kiosk is a dark, phone-centred surface — paint the page root navy so the
    // app's light body colour never peeks around the phone at any window size.
    const prevBg = document.body.style.background;
    document.body.style.background = branding.deepBlue || branding.primaryColor;
    return () => { document.body.style.background = prevBg; };
  }, [branding.primaryColor, branding.secondaryColor, branding.deepBlue, branding.appName, branding.favicon]);

  return <KioskWidget />;
}

export default function FaceIdKiosk() {
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return (
    <ConfigProvider initialOverride={initial}>
      <KioskInner />
    </ConfigProvider>
  );
}
