/**
 * Resolve a public asset path against the UiPath Coded App mount prefix.
 * The platform injects <meta name="uipath:app-base" content="/face-id-verify">
 * at runtime; deployed apps mount at a non-root prefix, so "/x.jpg" would 404.
 */
export function assetUrl(rel: string): string {
  if (/^(https?:|data:|blob:)/.test(rel)) return rel;
  const base = (document.querySelector('meta[name="uipath:app-base"]')?.getAttribute('content') || '').replace(/\/+$/, '');
  return `${base}/${rel.replace(/^\/+/, '')}`;
}
