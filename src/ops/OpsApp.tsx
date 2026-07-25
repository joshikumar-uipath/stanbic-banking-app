// ─────────────────────────────────────────────────────────────────────────────
// Operations Workbench (/ops) — Stanbic Account Opening console.
// The console is a self-contained page (public/ops-console.html): triage bar,
// health strip, root-cause cards, rule-promotion, review cockpit, the 47-decision
// evidence explorer, rules view, bulk failures and keyboard shortcuts. We mount
// it full-screen here so the /ops route serves it exactly as authored.
//
// Like every other standalone route, we drive the tab title and favicon from the
// active admin config — otherwise this bare iframe wrapper would keep whatever
// stale icon the browser had cached for /ops.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, stanbicConfig, applyFavicon } from '../config';
import { getCountry } from '../config/countries';
import './ops.css';

function OpsInner() {
  const { branding } = useConfig();
  const frame = useRef<HTMLIFrameElement>(null);
  // The rail paints a white plate behind the mark, so send the standard logo —
  // a white-on-transparent variant would vanish against it (same rule as the desk).
  const logo = branding.logo || '';
  const { appName } = branding;
  const country = getCountry(branding.country);

  useEffect(() => {
    document.title = `${appName} — Operations`;
    applyFavicon(branding.favicon, appName, branding.deepBlue || branding.primaryColor);
  }, [appName, branding.favicon, branding.deepBlue, branding.primaryColor]);

  // The console is its own document, so it can't read the config directly. Hand it
  // the tenant logo and the active market instead of letting it ship hard-coded
  // values — so an admin logo/country change lands on this rail exactly as it does
  // on the desk. Country carries the KYC document labels + authorities (internal
  // BVN slot = primary, NIN slot = secondary) so the console reads in local terms.
  const pushBrand = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.postMessage({ type: 'aof-brand', logo, appName }, window.location.origin);
    w.postMessage({
      type: 'aof-country', code: country.code,
      pLabel: country.primaryId.label, pAuth: country.primaryId.authority,
      sLabel: country.secondaryId.label, sAuth: country.secondaryId.authority,
    }, window.location.origin);
  }, [logo, appName, country]);
  useEffect(() => { pushBrand(); }, [pushBrand]);

  return (
    <iframe
      ref={frame}
      className="ops-frame"
      src="/ops-console.html"
      title="Operations Workbench — Account Opening"
      onLoad={pushBrand}
    />
  );
}

export default function OpsApp() {
  // Admin's profile wins; Stanbic is the fallback when nothing is configured.
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return <ConfigProvider initialOverride={initial}><OpsInner /></ConfigProvider>;
}
