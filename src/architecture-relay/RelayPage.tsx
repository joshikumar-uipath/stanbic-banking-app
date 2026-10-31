// ─────────────────────────────────────────────────────────────────────────────
// The architecture relay pages — #relay-individual, #relay-corporate, #relay-bulk.
//
// One component, three architectures: each route hands ArchitectureRelay its
// journey's model (./journeys). The page itself is the kit's /architecture mount —
// light relay theme, the page's own scroll container (the relay's sticky controls
// and side panels stick to it), a 2000px cap, Consolidated view only — plus a
// switcher between the three journeys, since a presenter usually wants to show
// them side by side.
//
// The legend's second party is the BANK, from the admin theme — resolved exactly
// as the desk resolves it (App.tsx): the active local profile, else the config the
// desk cached from Data Service, else the Stanbic preset. Switching theme in
// /admin renames and recolours it, and the tab icon, on the next load.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, loadCachedConfig, stanbicConfig, brandMark, applyFavicon } from '../config';
import type { TenantConnection } from '../onboarding/tenantSelection';
import { ArchitectureRelay, type RelayBank } from './ArchitectureRelay';
import { setRelayView } from './relayView';
import { individual } from './journeys/individual';
import { corporate } from './journeys/corporate';
import { bulk } from './journeys/bulk';
import type { RelayModel } from './model';

type Journey = 'individual' | 'corporate' | 'bulk';
const MODELS: Record<Journey, RelayModel> = { individual, corporate, bulk };
const ORDER: Journey[] = ['individual', 'corporate', 'bulk'];
const UIP = '#fa4616';

// The Consolidated/Stacked toggle is not offered on these pages, so pin the view:
// it persists per browser, and one last left on 'stacked' would otherwise open
// stuck in it with no way back.
setRelayView('consolidated');

// Same tenant connection the desk derives from env, so the relay reads the theme
// the desk cached from Data Service. Duplicated (as ConsumerApp does) rather than
// imported from App.tsx, to keep this chunk isolated.
function envConnection(): TenantConnection {
  return {
    orgName: import.meta.env.VITE_UIPATH_ORG_NAME,
    tenantName: import.meta.env.VITE_UIPATH_TENANT_NAME,
    oauthClientId: import.meta.env.VITE_UIPATH_CLIENT_ID,
    baseUrl: import.meta.env.VITE_UIPATH_BASE_URL,
    redirectUri: '',
    scope: import.meta.env.VITE_UIPATH_SCOPES || '',
    setAt: '',
  };
}

export default function RelayPage({ journey }: { journey: Journey }) {
  const initial = useMemo(() => loadLocalConfig() ?? loadCachedConfig(envConnection()) ?? stanbicConfig, []);
  return (
    <ConfigProvider initialOverride={initial}>
      <Page journey={journey} />
    </ConfigProvider>
  );
}

function Page({ journey }: { journey: Journey }) {
  const model = MODELS[journey];
  const { branding } = useConfig();
  const bank: RelayBank = {
    name: branding.appName,
    mark: brandMark(branding),
    color: branding.primaryColor,
    deep: branding.deepBlue || branding.primaryColor,
  };
  useEffect(() => {
    document.title = `${model.title} — ${branding.appName}`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [model.title, branding.appName, branding.favicon, branding.deepBlue, branding.primaryColor]);
  return (
    <div data-relay-theme="light" style={{ height: '100dvh', overflowY: 'auto', overflowX: 'hidden', background: '#F6F6F6' }}>
      <div style={{ maxWidth: 2000, margin: '0 auto', padding: '0 24px 24px' }}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-1 pt-6">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Architecture relay</div>
            <h1 className="mt-0.5 text-[22px] font-bold leading-tight text-slate-50">{model.title}</h1>
            <p className="mt-1 max-w-[760px] text-[14px] leading-snug text-slate-400">{model.blurb}</p>
          </div>
          <nav className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1" aria-label="Journey">
            {ORDER.map((j) => {
              const on = j === journey;
              return (
                // Same tab, a different hash: main.tsx picks the route on load, so
                // this is a navigation rather than a state change.
                <a key={j} href={`#relay-${j}`} aria-current={on ? 'page' : undefined}
                   onClick={(e) => { e.preventDefault(); if (!on) { window.location.hash = `relay-${j}`; window.location.reload(); } }}
                   className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${on ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                   style={on ? { background: UIP } : undefined}>
                  {MODELS[j].title.replace(' account opening', '')}
                </a>
              );
            })}
          </nav>
        </header>
        {/* Keyed so switching journey starts the relay from a clean cursor. */}
        <ArchitectureRelay key={model.key} model={model} sdk={{}} bank={bank} />
      </div>
    </div>
  );
}
