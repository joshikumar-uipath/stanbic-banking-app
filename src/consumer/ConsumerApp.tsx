// ─────────────────────────────────────────────────────────────────────────────
// ConsumerApp — root of the consumer-facing banking app (/Aura-consumer).
//
// Fully isolated from the enterprise app + admin. No login. Reuses ONLY the
// config (for white-label branding) and the phone-frame CSS in index.css.
// Navigation is an internal tab + push/pop stack (see nav.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, loadCachedConfig, stanbicConfig, applyFavicon } from '../config';
import type { TenantConnection } from '../onboarding/tenantSelection';
import { NavContext, useNav, type TabId, type ScreenRoute } from './nav';
import TopNav from './TopNav';
import { C, FONT_HEAD, FONT_BODY, SHADOW, PAGE_BG } from './theme';
import Icon from './icons';
import { customer, notifications } from './data';
import HomeScreen from './screens/Home';
import PayTransferScreen from './screens/PayTransfer';
import TransferFlow, { ScanPay } from './screens/TransferFlow';
import WealthScreen from './screens/Wealth';
import MoreScreen from './screens/More';
import TransactionHistory from './screens/TransactionHistory';
import Digibot from './screens/Digibot';
import OpenAccountScreen from './screens/OpenAccount';
import AccountOpeningFlow from '../customer/flow';
import CallConfirm from './CallConfirm';

const badgeDot: CSSProperties = { position: 'absolute', top: -3, right: -3, background: C.warn, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: `2px solid ${C.card}` };

// Placeholder used for tabs/screens not yet built (or demo-only detail screens).
function Placeholder({ title, phase, note }: { title: string; phase?: string; note?: string }) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center', color: C.textSoft }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon name="grid" size={26} />
      </div>
      <h2 style={{ fontFamily: FONT_HEAD, fontSize: 18, color: C.text, margin: '0 0 6px' }}>{title}</h2>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{note ?? `Coming up in ${phase}.`}</p>
    </div>
  );
}

// ── Brand bridge: push config colours into CSS vars + force light desktop bg ──
function ConsumerBrandBridge() {
  const { branding } = useConfig();
  useEffect(() => {
    const root = document.documentElement;
    const hexToRgb = (hex: string) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
      return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : null;
    };
    root.style.setProperty('--brand-primary', branding.primaryColor);
    const rgb = hexToRgb(branding.primaryColor); if (rgb) root.style.setProperty('--brand-primary-rgb', rgb);
    const sec = branding.secondaryColor || branding.primaryColor;
    root.style.setProperty('--brand-secondary', sec);
    const srgb = hexToRgb(sec); if (srgb) root.style.setProperty('--brand-secondary-rgb', srgb);
    root.setAttribute('data-theme', 'light');
    if (branding.appName) document.title = `${branding.appName} — Banking`;
    applyFavicon(branding.favicon, branding.appName, branding.deepBlue || branding.primaryColor);
  }, [branding.primaryColor, branding.secondaryColor, branding.appName, branding.favicon, branding.deepBlue]);
  return null;
}

// Brand logo with graceful fallback to the app name if the image fails to load.
function BrandMark() {
  const { branding } = useConfig();
  const [failed, setFailed] = useState(false);
  if (branding.logo && !failed) {
    return <img src={branding.logo} alt={branding.appName} onError={() => setFailed(true)} style={{ height: 24, maxWidth: 140, objectFit: 'contain' }} />;
  }
  return <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, color: C.text }}>{branding.appName}</span>;
}

// ── Top header (airy, floats over the page) ──────────────────────────────────
function softCircle(): CSSProperties {
  return { width: 40, height: 40, borderRadius: 999, background: C.card, boxShadow: SHADOW.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', position: 'relative' };
}
function AppHeader() {
  const nav = useNav();
  const unread = notifications.filter((n) => n.unread).length;
  return (
    <div style={{ padding: '0 16px', paddingTop: 'max(env(safe-area-inset-top), 12px)', flexShrink: 0 }}>
      <div style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" aria-label="Profile" onClick={() => nav.resetTo('more')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 55%, #000))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, boxShadow: SHADOW.sm }}>{customer.initials}</span>
        </button>
        <div style={{ position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <BrandMark />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" aria-label="Notifications" onClick={() => nav.push({ name: 'notifications', title: 'Notifications' })} style={softCircle()}>
            <Icon name="bell" size={20} color={C.text} />
            {unread > 0 && <span style={badgeDot}>{unread}</span>}
          </button>
          <button type="button" aria-label="Assistant" onClick={nav.openDigibot} style={softCircle()}>
            <Icon name="chat" size={20} color={C.text} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bottom navigation ────────────────────────────────────────────────────────
// 'open' sits in the centre as a raised brand action — the account-opening
// entry point — with the four banking tabs either side of it.
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'pay', label: 'Pay', icon: 'pay' },
  { id: 'open', label: 'Open', icon: 'plus' },
  { id: 'wealth', label: 'Wealth', icon: 'wealth' },
  { id: 'more', label: 'More', icon: 'more' },
];
function BottomNav() {
  const nav = useNav();
  return (
    <div style={{ flexShrink: 0, padding: '8px 14px max(env(safe-area-inset-bottom), 12px)' }}>
      <div style={{ background: C.card, borderRadius: 24, boxShadow: SHADOW.lg, display: 'flex', padding: 6, alignItems: 'center' }}>
        {TABS.map((t) => {
          const on = nav.tab === t.id;
          if (t.id === 'open') {
            // Raised centre action.
            return (
              <button key={t.id} type="button" onClick={() => nav.resetTo(t.id)} aria-label="Open an account" style={{
                flex: '0 0 auto', width: 58, background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0,
              }}>
                <span style={{
                  width: 46, height: 46, borderRadius: 999, marginTop: -22,
                  background: on ? `linear-gradient(140deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 60%, #000))` : C.brand,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: SHADOW.brand, border: `3px solid ${C.card}`, transition: 'transform 0.18s',
                  transform: on ? 'scale(1.06)' : 'none',
                }}>
                  <Icon name="plus" size={22} strokeWidth={2.6} />
                </span>
                <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, fontFamily: FONT_BODY, color: on ? C.brand : C.textFaint, marginBottom: 4 }}>{t.label}</span>
              </button>
            );
          }
          return (
            <button key={t.id} type="button" onClick={() => nav.resetTo(t.id)} style={{
              flex: 1, background: on ? `rgba(${C.brandRgb},0.10)` : 'transparent', border: 'none', cursor: 'pointer',
              padding: '9px 2px', borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: on ? C.brand : C.textFaint, transition: 'all 0.18s',
            }}>
              <Icon name={t.icon} size={21} strokeWidth={on ? 2.1 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, fontFamily: FONT_BODY }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Pushed sub-screen chrome (back + title), no bottom nav ────────────────────
// Some routes render full-screen with their own header/footer (multi-step flows).
function SubScreen({ route }: { route: ScreenRoute }) {
  const nav = useNav();
  if (route.name === 'transfer') return <TransferFlow route={route} />;
  if (route.name === 'scan') return <ScanPay />;
  // Account opening owns its own chrome (wizard header, progress rail, footer).
  if (route.name === 'open-account') return <AccountOpeningFlow onExit={nav.pop} startCaseId={route.params?.id as string | undefined} />;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: PAGE_BG }}>
      <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', flexShrink: 0 }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
          <button type="button" aria-label="Back" onClick={nav.pop} style={softCircle()}><Icon name="back" size={21} /></button>
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 19, color: C.text, letterSpacing: -0.3 }}>{route.title}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <SubScreenBody route={route} />
      </div>
    </div>
  );
}

function SubScreenBody({ route }: { route: ScreenRoute }) {
  switch (route.name) {
    case 'notifications':
      return <NotificationsScreen />;
    case 'transactions':
      return <TransactionHistory />;
    default:
      return <Placeholder title={route.title ?? 'Screen'} note="This is a demo screen in the prototype." />;
  }
}

// Simple notifications list (data-driven) — a quick win for Phase 1.
function NotificationsScreen() {
  const [cat, setCat] = useState<'banking' | 'deals'>('banking');
  const list = notifications.filter((n) => n.cat === cat);
  return (
    <div>
      <div style={{ display: 'flex', background: C.card, borderBottom: `1px solid ${C.border}` }}>
        {(['banking', 'deals'] as const).map((c) => {
          const on = c === cat;
          const count = notifications.filter((n) => n.cat === c && n.unread).length;
          return (
            <button key={c} type="button" onClick={() => setCat(c)} style={{
              flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 4px',
              fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14.5, color: on ? C.text : C.textSoft,
              borderBottom: `2px solid ${on ? C.brand : 'transparent'}`, marginBottom: -1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {c === 'banking' ? 'Banking' : 'Tips & Deals'}
              {count > 0 && <span style={{ background: C.brand, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{count}</span>}
            </button>
          );
        })}
      </div>
      <div>
        {list.map((n) => (
          <div key={n.id} style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: n.unread ? C.brand : 'transparent', marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{n.title}</div>
              <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5, marginTop: 3 }}>{n.body}</div>
              <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 6 }}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Active tab screen ────────────────────────────────────────────────────────
function TabScreen({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'home': return <HomeScreen />;
    case 'pay': return <PayTransferScreen />;
    case 'open': return <OpenAccountScreen />;
    case 'wealth': return <WealthScreen />;
    case 'more': return <MoreScreen />;
  }
}

// ── Shell ────────────────────────────────────────────────────────────────────
function Shell() {
  const nav = useNav();
  const top = nav.stack[nav.stack.length - 1];

  // Internet banking: nav across the top, content given the width it has. The
  // phone's header + bottom bar are thumb furniture and don't belong on a laptop.
  if (nav.web) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: PAGE_BG, fontFamily: FONT_BODY, color: C.text, position: 'relative' }}>
        <TopNav />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 8px' }}>
            {top ? <SubScreen route={top} /> : <TabScreen tab={nav.tab} />}
          </div>
        </div>
        {nav.digibotOpen && <Digibot />}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: PAGE_BG, fontFamily: FONT_BODY, color: C.text, position: 'relative' }}>
      {top ? (
        <SubScreen route={top} />
      ) : (
        <>
          <AppHeader />
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <TabScreen tab={nav.tab} />
          </div>
          <BottomNav />
        </>
      )}
      {nav.digibotOpen && <Digibot />}
      {/* The bank-is-calling-you card. Shows itself only while the voice agent
          has a confirmation pending for this customer. See CallConfirm.tsx. */}
      <CallConfirm />
    </div>
  );
}

// Same tenant connection the enterprise app derives from env — lets the consumer
// app read the config the enterprise app cached from Data Fabric. Duplicated
// (rather than imported from App.tsx) to keep this chunk isolated.
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

// ── Root ─────────────────────────────────────────────────────────────────────
export default function ConsumerApp({ shell = 'mobile' }: { shell?: 'mobile' | 'web' } = {}) {
  // Resolve branding exactly like the enterprise app: the active local profile
  // first, then the Data-Fabric config it cached. Where the enterprise app falls
  // back to the bundled Aura default, this one falls back to Stanbic — the data
  // and the account-opening journey are Stanbic/Nigeria. An admin profile still
  // wins, so white-labelling is intact.
  const initial = useMemo(
    () => loadLocalConfig() ?? loadCachedConfig(envConnection()) ?? stanbicConfig,
    [],
  );
  const [tab, setTab] = useState<TabId>('home');
  const [stack, setStack] = useState<ScreenRoute[]>([]);
  const [digibotOpen, setDigibotOpen] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);

  const web = shell === 'web';
  const api = useMemo(() => ({
    tab, stack, digibotOpen, hideBalances, web,
    setTab,
    push: (s: ScreenRoute) => setStack((st) => [...st, s]),
    pop: () => setStack((st) => st.slice(0, -1)),
    resetTo: (t: TabId) => { setStack([]); setTab(t); },
    openDigibot: () => setDigibotOpen(true),
    closeDigibot: () => setDigibotOpen(false),
    toggleBalances: () => setHideBalances((v) => !v),
  }), [tab, stack, digibotOpen, hideBalances, web]);

  // Greeting persona available app-wide via data.customer; nothing else needed.
  void customer;

  return (
    <ConfigProvider initialOverride={initial}>
      <ConsumerBrandBridge />
      <NavContext.Provider value={api}>
        <Shell />
      </NavContext.Provider>
    </ConfigProvider>
  );
}
