// ─────────────────────────────────────────────────────────────────────────────
// The front door (route "/").
//
// Role-first, not app-first: you pick who you are, and it takes you to the tool
// that role uses. That mirrors how the workspace itself works — the desk and the
// Operations Workbench share a design language because they ARE one platform;
// the role is what changes. Same list of employee roles as the in-app switcher
// (see ../employee/roles), so the two can't disagree.
//
// Light, and branded from the tenant config like every other surface.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, stanbicConfig, applyFavicon } from '../config';
import { ROLES } from '../employee/roles';
import type { RouteKey } from './routes';
import './launcher.css';

const DEMO = '#7C5CF0';
const SLATE = '#64748B';

// The front door is a launchpad: every surface opens in its own tab, so the
// directory stays put behind whatever you opened. rel prevents the new tab from
// getting a handle back to this window.
const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

// When deployed as a UiPath coded app the whole thing sits under a base path
// (the host injects <base href="/<app>/">), so an absolute "/employee-web" link would
// escape the app entirely. Navigate by HASH instead: detectRoute already matches on
// hash.includes(name), and a hash keeps the URL at the always-served app root. Works
// identically on localhost. e.g. "/employee-web" -> "#employee-web".
const hashHref = (p: string) => '#' + p.replace(/^\/+/, '');

// ── Monoline icon set (Lucide-style) ─────────────────────────────────────────
type IconName = 'phone' | 'monitor' | 'dashboard' | 'user' | 'link' | 'sliders' | 'activity' | 'landmark' | 'briefcase' | 'message';
const PATHS: Record<IconName, string> = {
  message: 'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.6 9.6 0 0 1-4-.9L3 20l1.4-3.5A8.38 8.38 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5a8.38 8.38 0 0 1 9 8Z',
  phone: 'M15 2H9a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z M11 18h2',
  monitor: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  dashboard: 'M4 4h6v7H4z M14 4h6v4h-6z M14 12h6v8h-6z M4 15h6v5H4z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  landmark: 'M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M20 10v11 M9 14v3 M15 14v3',
  briefcase: 'M3 7h18v13H3z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 12h18',
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].split(' M').map((seg, i) => <path key={i} d={(i === 0 ? seg : 'M' + seg)} />)}
    </svg>
  );
}
const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ld-chev" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
);

/** One person you can be. `alts` are the same role on another surface. */
interface Persona {
  key: string; name: string; sub: string; blurb: string; href: string;
  icon: IconName; alts?: { label: string; href: string }[];
}

const [RM, OPS] = ROLES;

const PEOPLE: Persona[] = [
  {
    key: 'rm', name: RM.name, sub: RM.sub, blurb: RM.blurb, href: RM.href, icon: 'briefcase',
    alts: [{ label: 'On web', href: '/employee-web' }, { label: 'On mobile', href: '/employee-mobile' }],
  },
  {
    key: 'ops', name: OPS.name, sub: OPS.sub, blurb: OPS.blurb, href: OPS.href, icon: 'dashboard',
  },
  {
    key: 'customer', name: 'Customer', sub: 'Your own banking app', icon: 'user',
    blurb: 'Open an account yourself in minutes, then watch it happen — no branch, no waiting.',
    href: '/customer-mobile',
    alts: [
      { label: 'On web', href: '/customer-web' },
      { label: 'KYC link', href: '/kyc/DEMO01' },
    ],
  },
  // The Administrator (branding/config) card is intentionally NOT listed here — it's for
  // the demo owner only, not people we share the URL with. The surface itself stays
  // reachable directly at /admin (hash: #admin), just not advertised on the launcher.
];

interface Tool { key: string; name: string; url: string; desc: string; icon: IconName; accent: string; soon?: boolean }
// The bank's own systems, stood in for. Not roles — nobody "is" Kafka.
const TOOLS: Tool[] = [
  { key: 'kafka', name: 'Mock Kafka console', url: '/kafka', icon: 'activity', accent: DEMO, desc: 'The live event stream across the eight topics.' },
  { key: 'finacle', name: 'Mock Finacle UI', url: '/finacle', icon: 'landmark', accent: SLATE, desc: 'Core banking back office — CIFs and accounts.' },
  { key: 'comms', name: 'Notification service', url: '/comms', icon: 'message', accent: DEMO, desc: 'Every SMS and email the customer receives, per step.' },
  { key: 'tower', name: 'Control tower', url: '/tower', icon: 'dashboard', accent: SLATE, desc: 'Throughput, straight-through rate and what breaks.' },
  { key: 'cases', name: 'Case management', url: '/cases', icon: 'monitor', accent: DEMO, desc: 'The onboarding case as a Maestro-style stage & task flow.' },
  { key: 'faceid', name: 'FaceID Verify console', url: '/faceid', icon: 'user', accent: DEMO, desc: 'Liveness & identity — the board behind the selfie check.' },
  { key: 'faceid-kiosk', name: 'FaceID kiosk', url: '/faceid-kiosk', icon: 'phone', accent: SLATE, desc: 'The walk-up camera check — live liveness capture.' },
];

// index.css sets a global --brand-primary; the front door has no host app to
// override it, so push the active branding into the vars this page reads.
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
    document.title = `${branding.appName} — Account Opening`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.appName, branding.favicon, branding.deepBlue]);
}

function Front() {
  useBrandVars();
  const { branding } = useConfig();

  return (
    <div className="ld">
      <div className="ld-inner">
        <div className="ld-brand">
          {branding.logo
            ? <img className="ld-logo" src={branding.logo} alt={branding.appName} />
            : <><span className="ld-mark"><Icon name="dashboard" size={17} /></span><span className="ld-brandname">{branding.appName}</span></>}
        </div>

        <h1 className="ld-title">Account Opening</h1>
        <p className="ld-sub">
          One workspace. <b>Pick who you are</b> and it opens the tool that role uses — the same system, doing a different job.
        </p>

        <div className="ld-group-h" style={{ marginTop: 34 }}><span className="l">Who are you?</span></div>
        <div className="ld-people">
          {PEOPLE.map((p) => (
            <div className="ld-person" key={p.key}>
              <a className="ld-person-a" href={hashHref(p.href)} {...NEW_TAB}>
                <span className="ld-ic"><Icon name={p.icon} /></span>
                <span className="ld-main">
                  <span className="ld-name">{p.name}</span>
                  <span className="ld-role-sub">{p.sub}</span>
                  <span className="ld-desc">{p.blurb}</span>
                </span>
                <Chevron />
              </a>
              {p.alts && (
                <div className="ld-alts">
                  {p.alts.map((a) => <a key={a.href} className="ld-alt" href={hashHref(a.href)} {...NEW_TAB}>{a.label}</a>)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ld-group-h" style={{ marginTop: 34 }}><span className="l">Behind the scenes</span><span className="n">for the demo</span></div>
        <div className="ld-panel">
          {TOOLS.map((t) => (
            <a className="ld-row" key={t.key} href={hashHref(t.url)} {...NEW_TAB} style={{ ['--a' as string]: t.accent } as CSSProperties}>
              <span className="ld-ic sm"><Icon name={t.icon} size={19} /></span>
              <span className="ld-main">
                <span className="ld-name">{t.name}</span>
                <span className="ld-desc">{t.desc}</span>
              </span>
              <span className="ld-meta">
                {t.soon && <span className="ld-status soon"><span className="dot" />not built yet</span>}
                <code className="ld-url">{t.url}</code>
                <Chevron />
              </span>
            </a>
          ))}
        </div>

        <div className="ld-footer">Mock data throughout — nothing here is connected to a production system. Every surface also has a direct URL.</div>
        <ResetDemo />
      </div>
    </div>
  );
}

// Restart the demo: clear the shared pipeline data so the next surface reseeds
// fresh (exceptions back, ages current). Branding is deliberate setup — a
// different key — so it's left alone. Two-click confirm; no accidental resets.
function ResetDemo() {
  const [armed, setArmed] = useState(false);
  const reset = () => {
    ['aof_cases', 'aof_events', 'aof_seed_v', 'aof_seed_at', 'aof_my_apps'].forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
    window.location.reload();   // next store construction reseeds from scratch
  };
  return (
    <div className="ld-reset">
      {armed ? (
        <>
          <span>Reset the pipeline to its starting state? Captured, resolved and KYC&rsquo;d cases are cleared. Branding is kept.</span>
          <button type="button" className="go" onClick={reset}>Yes, reset</button>
          <button type="button" className="cancel" onClick={() => setArmed(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="trigger" onClick={() => setArmed(true)} title="Restart the demo from a clean state">↺ Reset demo data</button>
      )}
    </div>
  );
}

function Launcher() {
  // Admin's profile wins; Stanbic is the fallback when nothing is configured.
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return (
    <ConfigProvider initialOverride={initial}>
      <Front />
    </ConfigProvider>
  );
}

// Placeholder for a surface whose screens aren't built yet.
function Shell({ route }: { route: RouteKey }) {
  const meta: Record<string, { name: string; role: string; url: string; phase: string; icon: IconName }> = {
    kafka: { name: 'Mock Kafka Console', role: 'Presenter · demo', url: '/kafka', phase: 'Phase 1', icon: 'activity' },
    finacle: { name: 'Mock Finacle UI', role: 'Presenter · demo', url: '/finacle', phase: 'Phase 1', icon: 'landmark' },
    comms: { name: 'Notification Service', role: 'Presenter · demo', url: '/comms', phase: 'Phase 1', icon: 'message' },
    tower: { name: 'Control Tower', role: 'Presenter · demo', url: '/tower', phase: 'Phase 1', icon: 'dashboard' },
  };
  const m = meta[route] ?? { name: route, role: '—', url: `/${route}`, phase: 'Phase 1', icon: 'dashboard' as IconName };
  return (
    <div className="ld ld-shell">
      <div className="ld-shell-card" style={{ ['--a' as string]: DEMO } as CSSProperties}>
        <div className="ld-shell-ic"><Icon name={m.icon} size={28} /></div>
        <h1 className="ld-shell-name">{m.name}</h1>
        <div className="ld-shell-role">{m.role}</div>
        <div className="ld-shell-chip"><span className="dot" />Not built yet · {m.phase}</div>
        <div className="ld-shell-url">{m.url}</div>
        <a className="ld-shell-back" href="./"><span aria-hidden="true">←</span> Back to the front door</a>
      </div>
    </div>
  );
}

export function SkeletonRouter({ route }: { route: RouteKey }) {
  if (route === 'launcher') return <Launcher />;
  return <Shell route={route} />;
}
