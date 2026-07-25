// ─────────────────────────────────────────────────────────────────────────────
// Case management (/cases) — the account-onboarding case as a Maestro-style flow.
//
// A first-pass rendering of what the onboarding journey looks like as a UiPath
// Maestro case: ordered stages (Intake → Verification → Decision → Activation →
// Closure), each holding typed tasks — agent, robot, human (*) and app — split
// into sequential vs event-triggered groups, with gateways (◇) for routing.
//
// Tasks are dummy for now (structure first, firm up later), but the flow is LIVE:
// pick a real case from the shared store and its state lights the stages up, with
// the Verification tasks reflecting that case's actual validation results.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, fullName, stateMeta, type OnboardingCase, type OnboardingState, type ValidationKind } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';
import { maestroReady, startCase, getState, approve, instanceUrl, STAGES as MAESTRO_STAGES, type LiveState } from '../onboarding/maestro';
import './cases.css';

// ── Task + stage model ───────────────────────────────────────────────────────
type TaskKind = 'agent' | 'robot' | 'human' | 'app' | 'gateway';
type Trigger = 'sequential' | 'event';
type TaskState = 'done' | 'active' | 'pending' | 'attention' | 'waiting';

interface TaskDef {
  name: string;
  kind: TaskKind;
  trigger: Trigger;
  human?: boolean;     // renders the * marker + a person action
  gateway?: boolean;   // renders the ◇ marker
  vk?: ValidationKind; // if set, this task mirrors that validation's live status
}
interface StageDef {
  key: string;
  name: string;
  blurb: string;
  duration: string;    // dummy per-stage duration, sample-style
  tasks: TaskDef[];
}

const STAGES: StageDef[] = [
  {
    key: 'intake', name: 'Intake', blurb: 'Capture & enrich', duration: '12s',
    tasks: [
      { name: 'Extract application & ID documents', kind: 'agent', trigger: 'event' },
      { name: 'Lookup customer & KYC profile', kind: 'robot', trigger: 'event' },
      { name: 'Pull existing relationships & CIF', kind: 'robot', trigger: 'event' },
      { name: 'Duplicate & risk pre-screen', kind: 'agent', trigger: 'event', human: true },
    ],
  },
  {
    key: 'verification', name: 'Verification', blurb: 'KYC & identity', duration: '28s',
    tasks: [
      { name: 'Assemble verification package', kind: 'robot', trigger: 'sequential' },
      { name: 'Analyst review & exceptions', kind: 'human', trigger: 'sequential', human: true },
      { name: 'NIN validation', kind: 'robot', trigger: 'event', vk: 'NIN' },
      { name: 'BVN validation', kind: 'robot', trigger: 'event', vk: 'BVN' },
      { name: 'Liveness & face match', kind: 'app', trigger: 'event', vk: 'LIVENESS' },
      { name: 'Sanctions & PEP screening', kind: 'robot', trigger: 'event', vk: 'PEP' },
      { name: 'Address & document authenticity', kind: 'agent', trigger: 'event', vk: 'FRAUD' },
    ],
  },
  {
    key: 'decision', name: 'Decision', blurb: 'Approve or refer', duration: '1h 4m',
    tasks: [
      { name: 'Onboarding officer decision', kind: 'human', trigger: 'event', human: true },
      { name: 'Apply routing rules', kind: 'gateway', trigger: 'event', gateway: true },
      { name: 'Risk-based EDD trigger', kind: 'gateway', trigger: 'event', gateway: true },
      { name: 'Notify referral outcome', kind: 'robot', trigger: 'event' },
    ],
  },
  {
    key: 'activation', name: 'Activation', blurb: 'Open the account', duration: '18s',
    tasks: [
      { name: 'Create CIF & account (Finacle)', kind: 'robot', trigger: 'sequential' },
      { name: 'Provision channels & card', kind: 'robot', trigger: 'sequential' },
      { name: 'Mandate & funding setup', kind: 'robot', trigger: 'event' },
      { name: 'Customer & RM comms', kind: 'agent', trigger: 'event' },
    ],
  },
  {
    key: 'closure', name: 'Closure', blurb: 'Wrap & assure', duration: '9s',
    tasks: [
      { name: 'Case packet assembly', kind: 'robot', trigger: 'event' },
      { name: 'Generate audit report', kind: 'agent', trigger: 'event', human: true },
      { name: 'Schedule periodic KYC review', kind: 'robot', trigger: 'event' },
    ],
  },
];

// Which stage a case's state currently sits in.
const STATE_STAGE: Record<OnboardingState, number> = {
  PRE_REGISTERED: 0,
  VALIDATION_IN_PROGRESS: 1,
  PENDING_DOCUMENTS: 1,
  PENDING_LIVENESS: 1,
  EXCEPTION: 1,
  VALIDATED: 2,
  ACCOUNT_CREATED: 3,
  FULLY_ACTIVATED: 4,
};

// ── Icons ────────────────────────────────────────────────────────────────────
const KIND_PATH: Record<TaskKind, string> = {
  agent: 'M12 3a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h1V6a3 3 0 0 1 3-3Z M9 13h.01 M15 13h.01 M12 3V1',
  robot: 'M5 8h14v11H5z M9 12h.01 M15 12h.01 M12 4v4 M12 3h.01 M2 12h3 M19 12h3',
  human: 'M16 19a4 4 0 0 0-8 0 M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  app: 'M3 4h18v16H3z M3 9h18 M7 6.5h.01',
  gateway: 'M12 2 22 12 12 22 2 12Z',
};
function KIcon({ k, s = 15 }: { k: TaskKind; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {KIND_PATH[k].split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
    </svg>
  );
}
const KIND_LABEL: Record<TaskKind, string> = { agent: 'Agent', robot: 'Robot', human: 'Human', app: 'App', gateway: 'Gateway' };

// ── Status of a single task, given the selected case ─────────────────────────
function vkState(c: OnboardingCase, vk: ValidationKind): TaskState {
  const v = c.validations.find((x) => x.kind === vk);
  if (!v) return 'pending';
  if (v.status === 'passed') return 'done';
  if (v.status === 'failed' || v.status === 'timeout') return 'attention';
  if (v.status === 'running' || v.status === 'retrying') return 'active';
  return 'pending';
}
function taskState(t: TaskDef, stageIdx: number, activeIdx: number, c?: OnboardingCase): TaskState {
  if (!c) return 'pending';
  if (stageIdx < activeIdx) return 'done';
  if (stageIdx > activeIdx) return 'pending';
  // active stage
  if (t.vk) return vkState(c, t.vk);
  if (c.state === 'EXCEPTION' && t.human) return 'attention';
  if (t.gateway) return 'waiting';
  return 'active';
}
function stageState(tasks: TaskState[]): TaskState {
  if (tasks.every((s) => s === 'done')) return 'done';
  if (tasks.some((s) => s === 'attention')) return 'attention';
  if (tasks.some((s) => s === 'active' || s === 'waiting')) return 'active';
  return 'pending';
}

// ── Status glyph ─────────────────────────────────────────────────────────────
function Status({ s }: { s: TaskState }) {
  if (s === 'done') return <span className="cm-st done" title="Complete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>;
  if (s === 'active') return <span className="cm-st active" title="Running"><i className="cm-spin" /></span>;
  if (s === 'attention') return <span className="cm-st att" title="Needs attention"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6" /><path d="M12 17h.01" /></svg></span>;
  if (s === 'waiting') return <span className="cm-st wait" title="Gateway"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 22 12 12 22 2 12Z" /></svg></span>;
  return <span className="cm-st pend" title="Not started" />;
}

function CasesInner() {
  useBrandVars('Case Management');
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  // Live bridge to the REAL Maestro case deployed on the tenant.
  const [run, setRun] = useState<{ id: string; state: LiveState } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => void store.list().then((all) => { if (alive) setCases(all); });
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  // Poll the real Maestro instance while a run is active and not yet done.
  useEffect(() => {
    if (!run || run.state.done) return;
    let alive = true;
    const iv = setInterval(() => {
      void getState(run.id).then((s) => { if (alive) setRun((r) => (r && r.id === run.id ? { id: r.id, state: s } : r)); }).catch(() => {});
    }, 4000);
    return () => { alive = false; clearInterval(iv); };
    // deliberately keyed on id + done only — polling restarts on a new run or when it finishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.state.done]);

  // Default selection: the most recently touched case that's still in motion.
  const current = useMemo(() => {
    if (!cases.length) return undefined;
    if (sel) { const c = cases.find((x) => x.id === sel); if (c) return c; }
    const live = [...cases].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return live.find((c) => c.state !== 'FULLY_ACTIVATED') ?? live[0];
  }, [cases, sel]);

  const activeIdx = current ? STATE_STAGE[current.state] : -1;

  // Precompute each stage's task states + header state for the selected case.
  const computed = useMemo(() => STAGES.map((stg, i) => {
    const tasks = stg.tasks.map((t) => ({ t, s: taskState(t, i, activeIdx, current) }));
    return { stg, i, tasks, head: stageState(tasks.map((x) => x.s)) };
  }), [activeIdx, current]);

  const launch = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const id = await startCase({ applicantId: current.id, firstName: current.firstName, lastName: current.lastName, bvn: current.bvn, nin: current.nin, channel: current.channel });
      setRun({ id, state: await getState(id) });
    } catch (e) { alert('Could not start the Maestro case:\n' + (e as Error).message); }
    finally { setBusy(false); }
  };
  const doApprove = async () => {
    if (!run?.state.pendingTaskId) return;
    setBusy(true);
    try {
      await approve(run.state.pendingTaskId);
      await new Promise((r) => setTimeout(r, 1600));
      setRun({ id: run.id, state: await getState(run.id) });
    } catch (e) { alert('Approve failed:\n' + (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="inst cm">
      <TopBar system="Case Management" sub="Account opening" />

      <div className="cm-ctrl">
        <div className="cm-ctrl-l">
          <span className="cm-eyebrow">Onboarding case</span>
          <select className="cm-pick" value={current?.id ?? ''} onChange={(e) => setSel(e.target.value || null)}>
            {!cases.length && <option value="">No cases yet — open one on the desk</option>}
            {cases.length > 0 && !current && <option value="">Select a case…</option>}
            {[...cases].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map((c) => (
              <option key={c.id} value={c.id}>{c.id} · {fullName(c)} · {stateMeta(c.state).label}</option>
            ))}
          </select>
          {current && (
            <span className={`cm-badge ${stateMeta(current.state).tone}`}>{stateMeta(current.state).label}</span>
          )}
          {maestroReady() && current && !run && (
            <button className="cm-run" disabled={busy} onClick={launch} title="Start a live instance of the real UiPath Maestro case">
              {busy ? 'Starting…' : '▶ Run in Maestro'}
            </button>
          )}
        </div>
        <div className="cm-legend">
          {(['agent', 'robot', 'human', 'app', 'gateway'] as TaskKind[]).map((k) => (
            <span key={k} className="cm-leg"><span className={`cm-ti ${k}`}><KIcon k={k} s={12} /></span>{KIND_LABEL[k]}</span>
          ))}
        </div>
      </div>

      {run && (
        <div className={`cm-live ${run.state.done ? 'done' : ''}`}>
          <div className="cm-live-head">
            <span className="cm-live-dot" />
            <b>Live in Maestro</b>
            <span className="cm-live-id">instance {run.id.slice(0, 8)}…</span>
            <span className={`cm-live-state ${run.state.done ? 'ok' : ''}`}>{run.state.done ? 'Completed' : run.state.jobState}</span>
          </div>
          <div className="cm-live-stages">
            {MAESTRO_STAGES.map((s) => {
              const st = run.state.done || run.state.completedStages.includes(s) ? 'done' : run.state.activeStage === s ? 'active' : 'pend';
              return <span key={s} className={`cm-live-stage ${st}`}>{st === 'done' ? '✓ ' : st === 'active' ? '● ' : ''}{s}</span>;
            })}
          </div>
          <div className="cm-live-actions">
            {!run.state.done && run.state.pendingTaskId && (
              <button className="cm-run" disabled={busy} onClick={doApprove}>{busy ? '…' : `Approve ${run.state.activeStage ?? ''}`}</button>
            )}
            <a className="cm-live-link" href={instanceUrl(run.id)} target="_blank" rel="noreferrer">Open in Maestro ↗</a>
          </div>
        </div>
      )}

      <div className="cm-canvas">
        <div className="cm-flow">
          {/* Start node */}
          <div className="cm-start">
            <div className={`cm-start-node ${activeIdx >= 0 ? 'on' : ''}`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>
            </div>
            <span className="cm-start-l">Start onboarding</span>
          </div>
          <div className="cm-arrow" aria-hidden />

          {computed.map(({ stg, i, tasks, head }, idx) => {
            const seq = tasks.filter((x) => x.t.trigger === 'sequential');
            const evt = tasks.filter((x) => x.t.trigger === 'event');
            const isActive = i === activeIdx;
            return (
              <div className="cm-stagewrap" key={stg.key}>
                <div className={`cm-stage ${head}`}>
                  <div className="cm-stage-head">
                    <div className="cm-stage-title">
                      <b>{stg.name}</b>
                      <span>{stg.blurb}</span>
                    </div>
                    <Status s={head} />
                  </div>
                  <div className="cm-stage-meta">
                    <span>SLA: {isActive ? '4h' : 'None'}</span>
                    <span>{head === 'pending' ? 'Not started' : `Duration: ${stg.duration}`}</span>
                  </div>

                  {seq.length > 0 && (
                    <div className="cm-group">
                      <span className="cm-group-l">Sequential tasks</span>
                      <div className="cm-tasks seq">
                        {seq.map(({ t, s }) => <TaskRow key={t.name} t={t} s={s} />)}
                      </div>
                    </div>
                  )}
                  {evt.length > 0 && (
                    <div className="cm-group">
                      <span className="cm-group-l">Event-triggered tasks</span>
                      <div className="cm-tasks">
                        {evt.map(({ t, s }) => <TaskRow key={t.name} t={t} s={s} />)}
                      </div>
                    </div>
                  )}
                </div>
                {idx < computed.length - 1 && <div className="cm-arrow" aria-hidden />}
              </div>
            );
          })}
        </div>

        {/* The orchestrating agent, watching over the case */}
        <div className="cm-agent">
          <span className="cm-agent-mark"><KIcon k="agent" s={16} /></span>
          <span className="cm-agent-t"><b>Case manager</b><em>AI Orchestrator</em></span>
        </div>
      </div>

      <p className="cm-note">
        First pass · structure only. Tasks are placeholders; the flow is live off the shared store —
        the selected case's state lights the stages, and Verification mirrors its real validation results.
      </p>
    </div>
  );
}

function TaskRow({ t, s }: { t: TaskDef; s: TaskState }) {
  return (
    <div className={`cm-task ${s} ${t.gateway ? 'gw' : ''}`}>
      <span className={`cm-ti ${t.kind}`}><KIcon k={t.kind} /></span>
      <span className="cm-task-n">{t.name}{t.human && <em className="cm-star">*</em>}</span>
      <Status s={s} />
    </div>
  );
}

export default function CasesConsole() {
  return <InstrumentProvider><CasesInner /></InstrumentProvider>;
}
