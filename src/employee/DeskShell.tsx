// ─────────────────────────────────────────────────────────────────────────────
// The desk — /employee-web.
//
// A desktop app in its own right, sharing the Operations Workbench's structure
// and typography so the bank's two employee tools read as one product. It is
// NOT a fork: the account-opening wizard, the approval sheet and Customer360 are
// the same components the phone renders. Only the chrome around them is new.
//
// The rail's colour derives from --brand-primary, so the admin console still
// drives this like every other surface.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useConfig, brandMark } from '../config';
import { store, type OnboardingCase } from '../onboarding';
import { approvalsPulse } from '../approvalsData';
import { I } from './ui';
import Find from './Find';
import RoleSwitch from './RoleSwitch';
import MyDesk from './screens/MyDesk';
import Opening from './screens/Opening';
import Approvals from './screens/Approvals';
import Clients from './screens/Clients';
import './desk.css';

export type Dest = 'desk' | 'open-account' | 'approvals' | 'customers' | 'chat' | 'explore' | 'alerts' | 'profile';

/** Everything the branch captured, newest first, live off the shared store. */
function useBranchCases(): OnboardingCase[] {
  const [list, setList] = useState<OnboardingCase[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void store.list().then((all) => {
        if (!alive) return;
        setList(all.filter((c) => c.source === 'rm' || c.source === 'branch')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      });
    };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);
  return list;
}

export interface DeskProps {
  userName?: string;
  userEmail?: string;
  unreadAlerts?: number;
  onLogout?: () => void;
  /** Aura's own surfaces — still the phone components, held in a column. */
  agentSurfaces: Partial<Record<'chat' | 'explore' | 'alerts' | 'profile', ReactNode>>;
  onAlertsSeen?: () => void;
}

export default function DeskShell({ userName, userEmail, unreadAlerts = 0, onLogout, agentSurfaces, onAlertsSeen }: DeskProps) {
  const { branding } = useConfig();
  const [dest, setDest] = useState<Dest>('desk');
  // null = nothing open; '' = start a new capture; an id = that application.
  const [flow, setFlow] = useState<string | null>(null);
  const cases = useBranchCases();

  const counts = useMemo(() => ({
    opening: cases.filter((c) => c.state !== 'FULLY_ACTIVATED').length,
    attention: cases.filter((c) => c.state === 'EXCEPTION' || c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length,
    approvals: approvalsPulse().pending,
  }), [cases]);

  const go = (d: Dest) => {
    setDest(d);
    if (d !== 'open-account') setFlow(null);
    if (d === 'alerts') onAlertsSeen?.();
  };
  const openCase = (id: string) => { setDest('open-account'); setFlow(id); };
  // "New application" from anywhere should land on the capture form itself —
  // switching tabs and making the banker press the same button again is a
  // dead-end click. `flow === ''` is the new-capture state Opening renders.
  //
  // The counter is the wizard's React key. Without it, pressing "New
  // application" while the wizard is already open is a no-op (flow is already
  // '') and the next customer inherits the previous one's screen — we landed on
  // someone else's liveness check that way.
  const [captureSeq, setCaptureSeq] = useState(0);
  const newApplication = () => { setDest('open-account'); setFlow(''); setCaptureSeq((n) => n + 1); };

  const initial = (userName || branding.appName || '?').trim().charAt(0).toUpperCase();
  // The compact square brand mark (favicon or auto-initial), used in this narrow
  // rail beside the wordmark — the wide logo stays for roomy surfaces.
  const mark = brandMark(branding);

  return (
    <div className="dk">
      <nav className="dk-side" aria-label="Main">
        <div className="dk-logo">
          <span className="dk-mark"><img src={mark} alt="" /></span>
          <span className="wm"><b>{branding.appName}</b><em>Employee</em></span>
        </div>

        {/* Who am I, and what else could I be? The desk and the Operations
            Workbench share a design language on purpose — this is what makes
            that read as one platform rather than as the same app twice. */}
        <RoleSwitch active="rm" />

        <div className="scroll">
          <h2>Your desk</h2>
          <Nav d="desk" on={dest} go={go} ic="desk" label="My desk" badge={counts.attention} hot={counts.attention > 0} />
          <Nav d="open-account" on={dest} go={go} ic="idcard" label="Open an account" badge={counts.opening} />
          <Nav d="approvals" on={dest} go={go} ic="check" label="Approvals" badge={counts.approvals} />
          <Nav d="customers" on={dest} go={go} ic="users" label="Clients" />

          <h2>Assistant</h2>
          <Nav d="chat" on={dest} go={go} ic="chat" label="Chat" />
          <Nav d="explore" on={dest} go={go} ic="explore" label="Explore agents" />
          <Nav d="alerts" on={dest} go={go} ic="bell" label="Alerts" badge={unreadAlerts} hot={unreadAlerts > 0} />
          <Nav d="profile" on={dest} go={go} ic="user" label="Profile" />
        </div>

        <div className="foot">
          <span className="av">{initial}</span>
          <span className="who">
            <b>{userName || 'Signed in'}</b>
            <span>{userEmail || 'Relationship Manager'}</span>
          </span>
          {onLogout && <button className="out" onClick={onLogout} title="Sign out" aria-label="Sign out"><I n="out" s={15} /></button>}
        </div>
      </nav>

      <div className="dk-main">
        <div className="dk-util">
          <Find cases={cases} onNavigate={go} onOpenCase={openCase} />
          <span className="dk-live"><i />Live</span>
        </div>

        {dest === 'desk' && <MyDesk cases={cases} onNavigate={go} onOpenCase={openCase} onNewApplication={newApplication} />}
        {dest === 'open-account' && <Opening cases={cases} flow={flow} setFlow={setFlow} onNewApplication={newApplication} captureSeq={captureSeq} />}
        {dest === 'approvals' && <Approvals />}
        {dest === 'customers' && <Clients />}
        {dest === 'chat' && <div className="dk-hold">{agentSurfaces.chat}</div>}
        {dest === 'explore' && <div className="dk-hold">{agentSurfaces.explore}</div>}
        {dest === 'alerts' && <div className="dk-hold">{agentSurfaces.alerts}</div>}
        {dest === 'profile' && <div className="dk-hold">{agentSurfaces.profile}</div>}
      </div>
    </div>
  );
}

function Nav({ d, on, go, ic, label, badge, hot }: { d: Dest; on: Dest; go: (d: Dest) => void; ic: string; label: string; badge?: number; hot?: boolean }) {
  return (
    <button className="dk-nav" aria-current={on === d} onClick={() => go(d)}>
      <span className="ic"><I n={ic} s={15} /></span>
      <span className="lb">{label}</span>
      {badge ? <span className={`badge${hot ? ' hot' : ''}`}>{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  );
}
