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
import { asset } from '../config/presets';
import { maestroConfig } from '../onboarding/maestro';
import './ops.css';

/** "#003B65" → "0, 59, 101" for the console's --brand-primary-rgb (used in the
 *  few rgba() overlays that can't take a hex). Null on a malformed value. */
function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * The console in its frame. `/ops` mounts it full-screen; the employee phone
 * mounts it as the operations analyst's Home with `mobile`, which loads the
 * console's phone layout and routes its role switcher back to the app.
 */
export function OpsFrame({ mobile = false, onRoleRequest }: { mobile?: boolean; onRoleRequest?: () => void } = {}) {
  const { branding } = useConfig();
  const frame = useRef<HTMLIFrameElement>(null);
  // The rail paints a white plate behind the mark, so send the standard logo —
  // a white-on-transparent variant would vanish against it (same rule as the desk).
  const logo = branding.logo || '';
  const { appName } = branding;
  const country = getCountry(branding.country);

  useEffect(() => {
    // On the phone the frame is one tab of a larger app — leave its title alone.
    if (mobile) return;
    document.title = `${appName} — Operations`;
    applyFavicon(branding.favicon, appName, branding.deepBlue || branding.primaryColor);
  }, [mobile, appName, branding.favicon, branding.deepBlue, branding.primaryColor]);

  // The console's role button can't navigate a phone app it doesn't own, so in
  // mobile mode it asks the app to open its role sheet instead.
  useEffect(() => {
    if (!onRoleRequest) return;
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data && e.data.type === 'aof-role-open') onRoleRequest();
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [onRoleRequest]);

  // The console is its own document, so it can't read the config directly. Hand it
  // the tenant logo and the active market instead of letting it ship hard-coded
  // values — so an admin logo/country change lands on this rail exactly as it does
  // on the desk. Country carries the KYC document labels + authorities (internal
  // BVN slot = primary, NIN slot = secondary) so the console reads in local terms.
  const pushBrand = useCallback(() => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    // Hand the console the tenant's brand colours too — its navy/blue palette
    // derives from --brand-primary/--brand-secondary (same color-mix scheme as
    // the desk), so an admin theme change re-paints /ops, not just its logo.
    w.postMessage({
      type: 'aof-brand', logo, appName,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor || branding.primaryColor,
      primaryRgb: hexToRgbTriplet(branding.primaryColor),
    }, window.location.origin);
    w.postMessage({
      type: 'aof-country', code: country.code,
      pLabel: country.primaryId.label, pAuth: country.primaryId.authority,
      sLabel: country.secondaryId.label, sAuth: country.secondaryId.authority,
    }, window.location.origin);
    // Hand the console the Maestro bridge config so it can start/drive the real
    // onboarding case per record — the token stays in the app bundle, not the HTML.
    w.postMessage({ type: 'aof-maestro', ...maestroConfig() }, window.location.origin);
  }, [logo, appName, country, branding.primaryColor, branding.secondaryColor]);
  useEffect(() => { pushBrand(); }, [pushBrand]);

  return (
    <iframe
      ref={frame}
      className={mobile ? 'ops-frame ops-frame-m' : 'ops-frame'}
      // Against the app's <base href>: a leading "/" leaves the app under the coded-app host.
      src={asset('ops-console.html') + (mobile ? '?m=1' : '')}
      title="Operations Workbench — Account Opening"
      onLoad={pushBrand}
    />
  );
}

export default function OpsApp() {
  // Admin's profile wins; Stanbic is the fallback when nothing is configured.
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return <ConfigProvider initialOverride={initial}><OpsFrame /></ConfigProvider>;
}
