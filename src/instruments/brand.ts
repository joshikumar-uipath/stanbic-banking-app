// Brand bridge for the standalone instrument routes — kept out of shell.tsx so
// that file only exports components (react-refresh rule).
import { useEffect } from 'react';
import { useConfig, applyFavicon } from '../config';

function toRgb(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : null;
}

/** Push the active tenant's colours into the vars instruments.css reads, and set
 *  the tab title. Standalone routes have no host app to do this for them. */
export function useBrandVars(titleSuffix: string) {
  const { branding } = useConfig();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    const rgb = toRgb(branding.primaryColor); if (rgb) root.style.setProperty('--brand-primary-rgb', rgb);
    const sec = branding.secondaryColor || branding.primaryColor;
    root.style.setProperty('--brand-secondary', sec);
    const srgb = toRgb(sec); if (srgb) root.style.setProperty('--brand-secondary-rgb', srgb);
    document.title = `${branding.appName} — ${titleSuffix}`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.appName, branding.favicon, branding.deepBlue, titleSuffix]);
}
