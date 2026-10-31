// ProductLogo for this project's architecture relays — one product's mark by
// name, the same {name, cls} shape as the kit's reference-deps/productLogos.tsx.
//
// The five Microsoft marks are that file's own SVGs (target-state artwork,
// revision B). The rest of this stack — the Nigerian identity rails, the
// screening vendor, core banking and the bank's own back-office systems — has no
// artwork in the product set, so each gets a monogram tile in its own colour
// rather than borrowing a logo it does not have. The monogram is honest about
// being a stand-in; a real mark would be the wrong kind of precision for a mock.
//
// Anything not listed falls back to the UiPath mark, which is right for UiPath's
// own products and wrong for everything else — add a name here before using it.
import { UiPathMark } from './logos';

const PRODUCT_SVG: Record<string, string> = {
  "Outlook 365": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">\n              <rect x=\"9.4\" y=\"4.6\" width=\"12.6\" height=\"14.8\" rx=\"1.6\" fill=\"#0F6CBD\" opacity=\".38\"/>\n              <path d=\"M9.4 8.2h12.6v9.6a1.6 1.6 0 0 1-1.6 1.6h-9.4a1.6 1.6 0 0 1-1.6-1.6z\" fill=\"#0F6CBD\" opacity=\".55\"/>\n              <rect x=\"1.8\" y=\"3.4\" width=\"12.4\" height=\"17.2\" rx=\"2.2\" fill=\"#0F6CBD\"/>\n              <ellipse cx=\"8\" cy=\"12\" rx=\"3.5\" ry=\"4.1\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.1\"/>\n            </svg>",
  "Gmail": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"#4285F4\" d=\"M1.64 20.18h3.81V10.9L0 6.82v11.72c0 .9.73 1.64 1.64 1.64z\"/><path fill=\"#34A853\" d=\"M18.55 20.18h3.81c.9 0 1.64-.73 1.64-1.64V6.82l-5.45 4.09z\"/><path fill=\"#FBBC04\" d=\"M18.55 3.82v7.09L24 6.82V4.64c0-2.03-2.31-3.18-3.93-1.97z\"/><path fill=\"#EA4335\" d=\"M5.45 10.9V3.82L12 8.73l6.55-4.91v7.09L12 15.82z\"/><path fill=\"#C5221F\" d=\"M0 4.64v2.18l5.45 4.09V3.82L3.93 2.67C2.31 1.46 0 2.61 0 4.64z\"/></svg>",
  "Microsoft Fabric": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><defs><linearGradient id=\"fab1\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#34C0B4\"/><stop offset=\"1\" stop-color=\"#0B7C7A\"/></linearGradient></defs><path d=\"M12 2.6l4.3 4.3-4.3 4.3-4.3-4.3z\" fill=\"url(#fab1)\"/><path d=\"M12 12.8l4.3 4.3-4.3 4.3-4.3-4.3z\" fill=\"url(#fab1)\" opacity=\".62\"/><path d=\"M6.1 7.7l4.3 4.3-4.3 4.3-4.3-4.3z\" fill=\"url(#fab1)\" opacity=\".8\"/><path d=\"M17.9 7.7l4.3 4.3-4.3 4.3-4.3-4.3z\" fill=\"url(#fab1)\" opacity=\".8\"/></svg>",
  "Power BI": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3.4\" y=\"13.4\" width=\"4.6\" height=\"7.4\" rx=\"1.1\" fill=\"#D9A400\" opacity=\".65\"/><rect x=\"9.7\" y=\"8.4\" width=\"4.6\" height=\"12.4\" rx=\"1.1\" fill=\"#D9A400\" opacity=\".82\"/><rect x=\"16\" y=\"3.4\" width=\"4.6\" height=\"17.4\" rx=\"1.1\" fill=\"#D9A400\"/></svg>",
};

/** Monogram tiles: [letters, tile colour, ink colour]. */
const MONO: Record<string, [string, string, string]> = {
  'CAC': ['CAC', '#1B5E20', '#fff'],
  'FIRS': ['TIN', '#2E7D32', '#fff'],
  'SCUML': ['SC', '#33691E', '#fff'],
  'NICE Actimize': ['NICE', '#3B2A7A', '#fff'],
  'Omniflow': ['OF', '#475569', '#fff'],
  'DSX': ['DSX', '#334155', '#fff'],
  'Google Drive': ['GD', '#1FA463', '#fff'],
  'ID vendor': ['ID', '#64748B', '#fff'],
};

function monoSvg([t, bg, ink]: [string, string, string]): string {
  const fs = t.length >= 4 ? 6.4 : t.length === 3 ? 7.6 : t.length === 2 ? 10 : 13;
  return `<svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="5.5" fill="${bg}"/>`
    + `<text x="12" y="12.2" text-anchor="middle" dominant-baseline="central" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="${ink}">${t}</text></svg>`;
}

export function ProductLogo({ name, cls = 'h-4 w-4' }: { name: string; cls?: string }) {
  const svg = PRODUCT_SVG[name] ?? (MONO[name] ? monoSvg(MONO[name]) : undefined);
  if (svg) {
    return (
      <span className={`${cls} block shrink-0`} role="img" aria-label={name}
        style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />
    );
  }
  return <UiPathMark className={`${cls} block shrink-0 rounded-[4px]`} />;
}
