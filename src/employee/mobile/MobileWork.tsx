// ─────────────────────────────────────────────────────────────────────────────
// The employee phone app — one home per role, everything else pushed, and the
// tab bar (Home · Aura · Explore · Alerts · Profile) around it.
//
// The role IS the app: a Relationship Manager opens on Today, a maker on the
// review queue, a verifier on what is ready to open, an analyst on incidents.
// Every tab shares the same live data and navigation, so an alert or an Aura
// answer can open the case it is about on the Home stack.
//
// The screens are new; the behaviour is not. They read the same store and run
// the same engines as /employee-web and /ops (bulk/engine, screens/useCaseDetail,
// bulk/bulkModel, ops/opsModel, deskItems).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Tab } from '../../components/BottomNav';
import type { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import { goToLauncher } from '../../skeleton/routes';
import { setActor } from '../actor';
import type { EmployeeRole } from '../../config';
import { store, syncProblems, retryPendingSync, SYNC_PROBLEM_EVENT, SYNC_OK_EVENT, type OnboardingCase } from '../../onboarding';
import { listBatches, subscribeBatches, type BatchMeta } from '../bulk/batches';
import { NavContext, DataContext, type Route, type WorkNav, type WorkData } from './nav';
import ScreenBoundary from './ScreenBoundary';
import RmHome from './screens/RmHome';
import Pipeline from './screens/Pipeline';
import CaseScreen from './screens/CaseScreen';
import Applicant from './screens/Applicant';
import Capture from './screens/Capture';
import Find from './screens/Find';
import NewBatch from './screens/NewBatch';
import BatchLive from './screens/BatchLive';
import Disposition from './screens/Disposition';
import Docs from './screens/Docs';
import MakerHome from './screens/MakerHome';
import ReviewFocus from './screens/ReviewFocus';
import VerifierHome from './screens/VerifierHome';
import Authorise from './screens/Authorise';
import OpsHome from './screens/OpsHome';
import OpsQueue from './screens/OpsQueue';
import OpsCase from './screens/OpsCase';
import Alerts from './screens/Alerts';
import Explore from './screens/Explore';
import Profile from './screens/Profile';
import Aura from './screens/Aura';
import LTabBar from './LTabBar';
import { NImmersive, NSheet, NButton } from './nkit';
import { buildAlerts, actionable, readIds } from './alertsModel';
import './mobile.css';

function useStoreCases(): OnboardingCase[] {
  const [list, setList] = useState<OnboardingCase[]>([]);
  useEffect(() => {
    let alive = true;
    // A burst of writes (opening an account is several) refreshes once.
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; void store.list().then((all) => { if (alive) setList(all); }); });
    };
    void store.list().then((all) => { if (alive) setList(all); });
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);
  return list;
}

function useBatchList(): BatchMeta[] {
  const [list, setList] = useState<BatchMeta[]>(() => listBatches());
  useEffect(() => subscribeBatches(() => setList(listBatches())), []);
  return list;
}

export default function MobileWork({ role, onRole, onRoleSheet, onApprovals, onClients, onAssistant, userName, userEmail, onLogout, roles, canSwitchRole, tab, onTab, agents, onAskAgent, conversationalAgent, overlay }: {
  role: EmployeeRole;
  onRole: (r: EmployeeRole) => void;
  onRoleSheet: () => void;
  onApprovals: () => void;
  onClients: () => void;
  onAssistant: () => void;
  userName: string;
  userEmail?: string;
  onLogout?: () => void;
  roles: EmployeeRole[];
  canSwitchRole: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  /** The full agent conversations, reachable from Aura's header. */
  agents?: ReactNode;
  /** Opens the bank's agent (Ask Pulse), optionally with a question. Wins over `agents`. */
  onAskAgent?: (question?: string) => void;
  /** Lets Aura put questions it can't answer to Ask Pulse and answer in place. */
  conversationalAgent?: ConversationalAgent;
  /** Sheets the app opens over the content (approvals, clients). */
  overlay?: ReactNode;
}) {
  // Who is doing the work — recorded on every confirmation and authorisation,
  // and the basis of the four-eyes check (the same person can't do both).
  useEffect(() => { setActor(userName && userName !== 'User' ? userName : null); }, [userName]);
  // Changes that didn't reach the shared record are said out loud, not hidden.
  const [unsynced, setUnsynced] = useState(() => syncProblems().length);
  useEffect(() => {
    const on = () => setUnsynced(syncProblems().length);
    window.addEventListener(SYNC_PROBLEM_EVENT, on);
    window.addEventListener(SYNC_OK_EVENT, on);
    return () => { window.removeEventListener(SYNC_PROBLEM_EVENT, on); window.removeEventListener(SYNC_OK_EVENT, on); };
  }, []);
  // Tabs that have been opened stay mounted (hidden) after you leave them.
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set([tab]));
  if (!seen.has(tab)) setSeen(new Set([...seen, tab]));
  // A role change starts that role's app afresh (keyed in the caller).
  const [stack, setStack] = useState<Route[]>([]);

  const all = useStoreCases();
  const batches = useBatchList();
  const data = useMemo<Omit<WorkData, 'alerts'>>(() => {
    const branch = all.filter((c) => c.source === 'rm' || c.source === 'branch')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const batched = all.filter((c) => !!c.batchId).sort((a, b) => a.id.localeCompare(b.id));
    const index = new Map(all.map((c) => [c.id, c]));
    // Batches submitted here carry metadata; seeded ones exist only as rows with a
    // batchId — give those a card too, built from their rows.
    const known = new Set(batches.map((b) => b.id));
    const rows = new Map<string, OnboardingCase[]>();
    for (const c of batched) if (!known.has(c.batchId!)) rows.set(c.batchId!, [...(rows.get(c.batchId!) ?? []), c]);
    const derived: BatchMeta[] = [...rows.entries()].map(([id, rs]) => ({
      id,
      name: rs.find((c) => c.employer)?.employer || 'Bulk batch',
      channel: rs.some((c) => c.bulkChannel === 'manifest') ? 'manifest' : 'bundle',
      segment: rs[0].accountType ?? 'Bulk opening',
      branch: rs[0].branch ?? '',
      createdAt: rs.reduce((m, c) => (c.createdAt < m ? c.createdAt : m), rs[0].createdAt),
      submitted: rs.length, accepted: rs.length, rejections: [],
    }));
    const allBatches = [...batches, ...derived].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { all, branch, batched, batches: allBatches, byId: (id) => index.get(id) };
  }, [all, batches]);

  // The stack mirrors into browser history, so a phone's Back (or the browser's)
  // steps back one screen instead of leaving the app.
  const pop = useCallback(() => {
    if ((window.history.state as { mw?: boolean } | null)?.mw) window.history.back();
    else setStack((s) => s.slice(0, -1));
  }, []);
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const pushRoute = useCallback((r: Route) => {
    setStack((s) => {
      const top = s[s.length - 1];
      if (top && sameRoute(top, r)) return s;          // already there — don't stack a copy
      window.history.pushState({ mw: true }, '');
      return [...s, r];
    });
  }, []);
  const goHome = useCallback(() => {
    setStack((s) => {
      if (s.length && (window.history.state as { mw?: boolean } | null)?.mw) window.history.go(-s.length);
      return [];
    });
  }, []);
  // A question asked from a home's ask bar, handed to Aura (a new key per ask).
  const [ask, setAsk] = useState<{ q?: string; n: number }>({ n: 0 });
  // Leaving a half-finished flow (a batch, an authorisation) asks first.
  const [leaving, setLeaving] = useState(false);
  const nav = useMemo<WorkNav>(() => ({
    push: pushRoute,
    pop,
    replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
    home: goHome,
    role,
    setRole: onRole,
    openRoleSheet: onRoleSheet,
    openApprovals: onApprovals,
    openClients: onClients,
    openAssistant: onAssistant,
    userName,
    userEmail,
    onLogout,
    roles,
    canSwitchRole,
    tab,
    setTab: onTab,
    open: (r) => { onTab('home'); pushRoute(r); },
    askAura: (q) => { setAsk((a) => ({ q: q?.trim() || undefined, n: a.n + 1 })); onTab('chat'); },
    toLauncher: goToLauncher,
  }), [pop, pushRoute, goHome, role, onRole, onRoleSheet, onApprovals, onClients, onAssistant, userName, userEmail, onLogout, roles, canSwitchRole, tab, onTab]);

  // Alerts, worked out once for the badge and the Alerts tab.
  const [readTick, setReadTick] = useState(0);
  useEffect(() => {
    const on = () => setReadTick((n) => n + 1);
    window.addEventListener('aof-alerts-read', on);
    return () => window.removeEventListener('aof-alerts-read', on);
  }, []);
  const alerts = useMemo(() => buildAlerts(data.all, data.batches, role), [data, role]);
  const badge = useMemo(() => {
    void readTick;
    const read = readIds();
    return alerts.filter((a) => actionable(a) && !read.has(a.id)).length;
  }, [alerts, readTick]);
  const shared = useMemo(() => ({ ...data, alerts }), [data, alerts]);
  const inFlow = stack.some((r) => GUARDED.has(r.k));

  const root = role === 'maker' ? <MakerHome /> : role === 'verifier' ? <VerifierHome /> : role === 'ops' ? <OpsHome /> : <RmHome />;

  return (
    <NavContext.Provider value={nav}>
      <DataContext.Provider value={shared}>
        <div className="mw-app">
          <div className="mw-host">
            {/* Home stays mounted behind the other tabs, and earlier screens stay
                mounted (hidden) so Back returns to exactly where you were —
                scroll position, a half-filled form, a filter. */}
            <div className="mw-layer" style={{ display: tab === 'home' && !stack.length ? 'block' : 'none' }}><ScreenBoundary onBack={nav.home}>{root}</ScreenBoundary></div>
            {stack.map((r, i) => (
              // Keyed by the record too: replacing a review with the next one must
              // not carry the previous reviewer's edits onto a different customer.
              <div className="mw-layer" key={`${i}-${JSON.stringify(r)}`} style={{ display: tab === 'home' && i === stack.length - 1 ? 'block' : 'none' }}>
                <ScreenBoundary onBack={pop}><Screen route={r} /></ScreenBoundary>
              </div>
            ))}
            {/* The other tabs stay mounted too once visited, so a conversation, a
                filter or an open film survives a trip to another tab. */}
            {seen.has('chat') && <div className="mw-layer" style={{ display: tab === 'chat' ? 'block' : 'none' }}><ScreenBoundary onBack={() => onTab('home')}><Aura key={ask.n} agents={agents} onAskAgent={onAskAgent} conversationalAgent={conversationalAgent} initial={ask.q} /></ScreenBoundary></div>}
            {seen.has('explore') && <div className="mw-layer" style={{ display: tab === 'explore' ? 'block' : 'none' }}><ScreenBoundary onBack={() => onTab('home')}><Explore /></ScreenBoundary></div>}
            {seen.has('alerts') && <div className="mw-layer" style={{ display: tab === 'alerts' ? 'block' : 'none' }}><ScreenBoundary onBack={() => onTab('home')}><Alerts /></ScreenBoundary></div>}
            {seen.has('profile') && <div className="mw-layer" style={{ display: tab === 'profile' ? 'block' : 'none' }}><ScreenBoundary onBack={() => onTab('home')}><Profile /></ScreenBoundary></div>}
            {overlay}
            {unsynced > 0 && (
              <div className="mw-sync" role="status">
                <span>{unsynced} change{unsynced === 1 ? '' : 's'} saved on this phone only — not synced yet.</span>
                <button type="button" onClick={() => { void retryPendingSync(); }}>Retry</button>
              </div>
            )}
          </div>
          <LTabBar active={tab} alerts={badge} onChange={(t) => {
            // Tapping Home while on Home goes back to the role's home screen —
            // unless that would drop a half-finished batch or authorisation.
            if (t === 'home' && tab === 'home') { if (inFlow) setLeaving(true); else goHome(); }
            onTab(t);
          }} />
          {leaving && (
            <NSheet title="Leave what you're doing?" subtitle="Anything you haven't submitted on this screen will be lost." onClose={() => setLeaving(false)}
              footer={<>
                <NButton kind="secondary" onClick={() => setLeaving(false)}>Stay</NButton>
                <NButton onClick={() => { setLeaving(false); goHome(); }}>Leave</NButton>
              </>}>
              <span />
            </NSheet>
          )}
        </div>
      </DataContext.Provider>
    </NavContext.Provider>
  );
}

/** Routes where tapping Home again would throw work away. */
const GUARDED = new Set<Route['k']>(['newBatch', 'authorise', 'disposition', 'focus']);

function sameRoute(a: Route, b: Route): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Screen({ route }: { route: Route }) {
  switch (route.k) {
    case 'pipeline': return <Pipeline lane={route.lane} />;
    case 'case': return <CaseScreen id={route.id} />;
    case 'applicant': return <Applicant id={route.id} tab={route.tab} />;
    case 'capture': return <Capture />;
    case 'find': return <Find />;
    // The batch wizard covers the tab bar, so a stray tap can't abandon it.
    case 'newBatch': return <NImmersive label="New batch"><div className="mw-full" style={{ background: 'transparent' }}><NewBatch /></div></NImmersive>;
    case 'batch': return <BatchLive id={route.id} />;
    case 'disposition': return <Disposition id={route.id} />;
    case 'docs': return <Docs id={route.id} start={route.start} />;
    case 'focus': return <ReviewFocus batchId={route.batchId} startId={route.startId} />;
    case 'authorise': return <Authorise batchId={route.batchId} />;
    case 'opsQueue': return <OpsQueue cause={route.cause} />;
    case 'opsCase': return <OpsCase id={route.id} />;
  }
}
