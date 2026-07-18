// ─────────────────────────────────────────────────────────────────────────────
// /kyc/:token — the tokenised completion link a customer opens from an SMS.
// Standalone by design: no tabs, no login. The token is the key.
//
// The *initiate* journey lives inside the banking app instead — see the raised
// centre tab in ../consumer (screens/OpenAccount.tsx → ./flow.tsx).
//
// Branding comes from the active tenant config (admin profile first), exactly
// like every other surface — nothing here is hardcoded to one bank.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store } from '../onboarding';
import { ConfigProvider, useConfig, loadLocalConfig, stanbicConfig, applyFavicon } from '../config';
import Status, { useCase } from './Status';
import Kyc from './Kyc';
import './customer.css';

export default function CustomerApp() {
  // Admin's profile wins; Stanbic is only the fallback when nothing is configured.
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return (
    <ConfigProvider initialOverride={initial}>
      <KycLink />
    </ConfigProvider>
  );
}

// index.css defines a global --brand-primary (the bundled Aura orange). This link
// has no host app to set the vars, so push the active branding into them here.
function useBrandVars() {
  const { branding } = useConfig();
  useEffect(() => {
    const root = document.documentElement;
    const toRgb = (hex: string) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
      return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : null;
    };
    root.style.setProperty('--brand-primary', branding.primaryColor);
    const rgb = toRgb(branding.primaryColor); if (rgb) root.style.setProperty('--brand-primary-rgb', rgb);
    const sec = branding.secondaryColor || branding.primaryColor;
    root.style.setProperty('--brand-secondary', sec);
    const srgb = toRgb(sec); if (srgb) root.style.setProperty('--brand-secondary-rgb', srgb);
    document.title = `${branding.appName} — Finish your account`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.appName, branding.favicon, branding.deepBlue]);
}

function KycLink() {
  useBrandVars();
  const [id, setId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'kyc' | 'status'>('kyc');

  const token = useMemo(() => window.location.pathname.split('/').filter(Boolean).pop() ?? '', []);

  // Resolve by token. The launcher's demo link (/kyc/DEMO01) falls back to a case
  // that is actually awaiting KYC, so the link always lands somewhere real.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const byToken = await store.getByKycToken(token);
      if (byToken) { if (alive) setId(byToken.id); return; }
      const all = await store.list();
      const fallback = all.find((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS') ?? all[0];
      if (alive && fallback) setId(fallback.id);
    })();
    return () => { alive = false; };
  }, [token]);

  const c = useCase(id);

  return (
    <div className="cx">
      {!c && <div className="cx-body" style={{ display: 'grid', placeItems: 'center' }}><span className="cx-spin" style={{ width: 22, height: 22 }} /></div>}
      {c && screen === 'kyc' && <Kyc c={c} onExit={() => setScreen('status')} />}
      {c && screen === 'status' && <Status c={c} onBack={() => setScreen('kyc')} onKyc={() => setScreen('kyc')} />}
    </div>
  );
}
