// ─────────────────────────────────────────────────────────────────────────────
// Browser-tab icon, driven by branding.
//
// A tenant can upload a favicon in the admin (branding.favicon). When they
// haven't, we AUTO-GENERATE one from the app name's initial on the brand colour —
// so every tenant gets a matching tab icon with zero assets, and nothing ever
// falls back to another brand's logo.
// ─────────────────────────────────────────────────────────────────────────────

/** The tenant's square brand mark for compact in-app spots (rails, top bars) and
 *  the browser tab: the uploaded favicon, or the auto-generated initial mark. One
 *  source, so the tab icon and the in-app mark always match. */
export function brandMark(b: { favicon?: string; appName?: string; primaryColor: string; deepBlue?: string }): string {
  return b.favicon && b.favicon.trim() ? b.favicon.trim() : generatedFavicon(b.appName, b.deepBlue || b.primaryColor);
}

/** A rounded-square SVG with the app's initial, as a data URI. Pure white-label. */
export function generatedFavicon(appName: string | undefined, color: string): string {
  const initial = (appName || '?').trim().charAt(0).toUpperCase() || '?';
  const fill = /^#?[0-9a-f]{3,8}$/i.test(color.trim()) ? color.trim() : '#012169';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${fill}"/>` +
    `<text x="16" y="22.5" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="#fff" text-anchor="middle">${initial}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Point the document's <link rel="icon"> at the tenant favicon (or the generated one). */
export function applyFavicon(favicon: string | undefined, appName: string, color: string): void {
  if (typeof document === 'undefined') return;
  const href = favicon && favicon.trim() ? favicon.trim() : generatedFavicon(appName, color);

  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  // Match the type so PNG/SVG data URIs render in the tab.
  if (href.startsWith('data:')) {
    const m = /^data:([^;,]+)/.exec(href);
    if (m) link.type = m[1]; else link.removeAttribute('type');
  } else if (/\.svg($|\?)/i.test(href)) {
    link.type = 'image/svg+xml';
  } else if (/\.png($|\?)/i.test(href)) {
    link.type = 'image/png';
  } else {
    link.removeAttribute('type');
  }
  link.href = href;
}
