import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, Radio, Check,
  MonitorSmartphone, MessagesSquare, Mail, Bot, Workflow as WorkflowIcon,
  Network, FlaskConical, Sparkles, BarChart3, Database, RadioTower,
  UserCheck, Fingerprint, ScanText, Landmark, Upload,
} from 'lucide-react';
import type { OnboardingCase, UiPath } from './liveData';
import { findCaseTaskId, actionCenterTaskUrl, useLabelOverrides, useLiveCases } from './liveData';
import {
  VENDOR_COLOR, labelLines, layerLabel, layerSub, VENDOR_DEEP,
  CANVAS_W, BOX_X, BOX_W, BOX_PAD_Y,
  type RelayModel,
} from './model';
import { Logo, LogoHtml, UiPathMark, LARGE_MARKS } from './logos';
import { useRelayView } from './relayView';

// One icon per layer, named in relay.ts so the model stays free of React imports.
const ICONS: Record<string, typeof MonitorSmartphone> = {
  MonitorSmartphone, MessagesSquare, Mail, Bot, Workflow: WorkflowIcon,
  Network, FlaskConical, Sparkles, BarChart3, Database, RadioTower,
  UserCheck, Fingerprint, ScanText, Landmark, Upload,
};
const UIP = VENDOR_COLOR.uipath;   // #fa4616 — UiPath brand orange

/** The bank the relay is dressed as — its short name, square mark and colours,
    from the admin theme. It takes the legend slot the kit gave Microsoft. */
export interface RelayBank { name: string; mark: string; color: string; deep: string }
const DEFAULT_BANK: RelayBank = { name: 'Bank', mark: '', color: VENDOR_COLOR.bank, deep: VENDOR_DEEP.bank };

function BankMark({ bank, className = 'h-4 w-4' }: { bank: RelayBank; className?: string }) {
  return bank.mark
    ? <img src={bank.mark} className={`${className} block shrink-0`} alt="" role="img" aria-label={bank.name} style={{ objectFit: 'contain' }} />
    : <i className={`${className} block shrink-0 rounded-sm`} style={{ background: bank.color }} />;
}
// The lifecycle rail runs on brand colour, not Tailwind's stock ramp: UiPath
// orange for the stage in progress, green for everything already done. These are
// fixed hexes on purpose — they are brand, so they do not follow the light/dark
// theme tokens the rest of the canvas uses.
// Emerald reads on the dark canvas but washes out on the light one, so the LIVE
// wording uses a deeper green while the dot beside it keeps the bright emerald.
const LIVE_INK = '#0B7A52';
const DONE = '#16A34A', DONE_SOFT = 'rgba(22,163,74,.10)', DONE_LINE = 'rgba(22,163,74,.38)';
const NOW_SOFT = 'rgba(250,70,22,.09)', NOW_LINE = 'rgba(250,70,22,.42)';

// Canvas geometry. The stack's height is derived by the model's layout pass, so
// adding a product re-sizes the canvas instead of running off the bottom of it.
const VB_TOP = 52;

// One task inside a stage: the product that performs it, its name, and whether
// it is done, running or not reached. `gate` marks the app-bound Action Center
// approval that closes the stage, which is drawn a shade heavier than the rest.
function TaskRow({ model, bankMark, label, by, state, gate, ov, onClick }: {
  model: RelayModel; bankMark: string;
  label: string; by: string; state: 'done' | 'now' | 'todo'; gate?: boolean;
  ov: Record<string, string>; onClick?: () => void;
}) {
  const { NODE_BY_ID, nodeLabel } = model;
  const done = state === 'done', now = state === 'now';
  const node = NODE_BY_ID[by];
  return (
    <button onClick={onClick}
         className="flex w-full items-center gap-2 rounded-md px-1.5 py-[3px] text-left"
         style={{
           background: now ? 'rgba(250,70,22,.14)' : gate && done ? 'rgba(22,163,74,.09)' : 'transparent',
           borderLeft: now ? `2.5px solid ${UIP}` : '2.5px solid transparent',
           borderRadius: now ? '0 6px 6px 0' : '6px',
         }}
         title={node ? `${nodeLabel(by, ov)} — ${node.plain}` : undefined}>
      <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center">
        {node ? <LogoHtml name={node.logo} bankMark={bankMark} className="h-[15px] w-[15px]" /> : null}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[11.5px] ${gate || now ? 'font-semibold' : ''}`}
            style={{ color: done ? 'rgb(var(--c-slate-200))' : now ? UIP : 'rgb(var(--c-slate-500))' }}>
        {label}
      </span>
      {done ? (
        <span className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full" style={{ background: DONE }}>
          <Check size={9} strokeWidth={4} color="#fff" />
        </span>
      ) : now ? (
        <span className="relay-dot h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: UIP }} />
      ) : (
        <span className="h-[11px] w-[11px] shrink-0 rounded-full border" style={{ borderColor: 'rgb(var(--c-slate-700))' }} />
      )}
    </button>
  );
}

export function ArchitectureRelay({ model, cases: seed, sdk, bank = DEFAULT_BANK }: {
  model: RelayModel; cases?: OnboardingCase[]; sdk: UiPath; bank?: RelayBank;
}) {
  // Which architecture this is. Unpacked under the names the kit's module-level
  // imports used, so the body below reads exactly as it did with one relay.ts.
  const {
    LAYERS, NODES, NODE_BY_ID, STAGES, ACTIONS, WHY, statusToStage, nodeLabel, nodeSub,
    MAESTRO_CASE, FOLDER_KEY, TIMELINE, STAGE_START, STACK_BOTTOM, thisApp,
  } = model;
  const VB_H = STACK_BOTTOM + 26 - VB_TOP;
  // Vendor colours with the bank's own filled in from the theme.
  const VCOLOR = { ...VENDOR_COLOR, bank: bank.color };
  const VDEEP = { ...VENDOR_DEEP, bank: bank.deep };
  // The vendor tag in each layer's gutter — what makes each party's footprint
  // readable top to bottom.
  const VEND_TEXT: Record<string, string> = { bank: bank.name.toUpperCase(), uip: 'UIPATH', both: 'MIXED', threep: '3RD PARTY' };
  const VEND_COLOR: Record<string, string> = { bank: bank.color, uip: UIP, both: '#6b7c8f', threep: '#2dd4bf' };
  const VENDOR_KEYS = [['uipath', 'UiPath'], ['bank', bank.name], ['threep', '3rd party']] as const;
  const maestroLink = (inst?: string) =>
    inst ? `${MAESTRO_CASE}/instances/${inst}?folderKey=${FOLDER_KEY}` : `${MAESTRO_CASE}?folderKey=${FOLDER_KEY}`;
  // Real desk records where they resolve; the passed-in set is the fallback for
  // dev and for a browser with nothing on it yet. See liveData.ts.
  const { cases, live: liveData } = useLiveCases(seed ?? model.cases);
  const refs = cases.map((c) => c.CaseRef);
  const [selectedRef, setSelectedRef] = useState<string>(refs[0] || '');
  // The cursor walks the TASK timeline, not the stage list; `step` is just which
  // stage that task belongs to, so everything downstream reads the same as before.
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Playback pace: how many times slower than the 1.7 s base step. A presenter
  // narrating over the relay needs the beats further apart than someone
  // clicking through alone; remembered so a demo rig keeps its setting.
  const [pace, setPace] = useState<1 | 2 | 4>(() => {
    try { const v = Number(localStorage.getItem('relay_pace')); return v === 2 || v === 4 ? v : 1; } catch { return 1; }
  });
  const choosePace = (v: 1 | 2 | 4) => { setPace(v); try { localStorage.setItem('relay_pace', String(v)); } catch { /* ignore */ } };
  const [hovered, setHovered] = useState<string | null>(null);
  const [acTaskUrl, setAcTaskUrl] = useState<string | null>(null);
  // The card performing the current task, so the view can follow the simulation
  // down the stack instead of leaving the action off-screen.
  const activeRef = useRef<SVGGElement | null>(null);
  const hoverOff = useRef<number | null>(null);
  const holdHover = (id: string) => { if (hoverOff.current) window.clearTimeout(hoverOff.current); setHovered(id); };
  const releaseHover = () => {
    if (hoverOff.current) window.clearTimeout(hoverOff.current);
    hoverOff.current = window.setTimeout(() => setHovered(null), 260);
  };
  useEffect(() => () => { if (hoverOff.current) window.clearTimeout(hoverOff.current); }, []);
  // Stacked view starts EMPTY (skeleton only) until the user engages (Play / step) -
  // so the architecture builds up from a blank canvas on their click, not on load.
  const [started, setStarted] = useState(false);
  // Stages the user has opened by hand. The running stage is always open; these are
  // the extra ones, and they close again on the next step so the rail does not
  // silently accumulate into the wall of tasks it started as.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  // Legend as a filter: pick a vendor and everything else fades back, so you can
  // read one company's footprint through the whole stack at once.
  const [vendorFilter, setVendorFilter] = useState<'uipath' | 'bank' | 'threep' | null>(null);
  const inFilter = (v: string) =>
    !vendorFilter || (vendorFilter === 'threep' ? v === 'threep' || v === 'data' : v === vendorFilter);
  const timer = useRef<number | null>(null);
  const { relayView } = useRelayView();
  const stacked = relayView === 'stacked';
  const ov = useLabelOverrides();

  const selected = useMemo(() => cases.find((c) => c.CaseRef === selectedRef), [cases, selectedRef]);
  // The seed's refs vanish when the live list arrives, which would leave the
  // picker pointing at nothing.
  useEffect(() => {
    if (refs.length && !refs.includes(selectedRef)) setSelectedRef(refs[0]);
  }, [refs, selectedRef]);
  const targetStage = selected ? statusToStage(selected) : 0;
  const target = STAGE_START[targetStage];
  const cur = TIMELINE[Math.min(cursor, TIMELINE.length - 1)];
  const step = cur.stage;
  const setStep = (i: number) => setCursor(STAGE_START[i]);

  // When the selected case changes, snap to its live stage.
  useEffect(() => { setCursor(target); setPlaying(false); /* eslint-disable-next-line */ }, [selectedRef, target]);
  // Reset the stacked-view build-up whenever the case changes (back to a blank canvas).
  useEffect(() => { setStarted(false); }, [selectedRef]);
  useEffect(() => { setOpenKeys(new Set()); }, [step]);

  // Resolve the case's exact Action Center task (pending or completed) so the
  // Action Center card deep-links straight to it instead of the generic inbox.
  useEffect(() => {
    let live = true;
    setAcTaskUrl(null);
    const inst = selected?.MaestroInstanceId;
    if (inst) {
      findCaseTaskId(sdk, inst, selected?.CaseRef)
        .then((taskId) => { if (live && taskId) setAcTaskUrl(actionCenterTaskUrl(sdk, taskId)); })
        .catch(() => {});
    }
    return () => { live = false; };
  }, [sdk, selected?.MaestroInstanceId, selected?.CaseRef]);

  // Playback loop (full end-to-end relay).
  useEffect(() => {
    if (!playing) { if (timer.current) window.clearInterval(timer.current); return; }
    timer.current = window.setInterval(() => {
      setCursor((c) => { if (c >= TIMELINE.length - 1) { setPlaying(false); return c; } return c + 1; });
    }, 1700 * pace);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, pace, TIMELINE.length]);

  /** The pace segment: 1×, 2× and 4× slower. Rendered in both control bars. */
  const paceControl = (
    <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-400" role="group" aria-label="Simulation pace">
      <span className="whitespace-nowrap">Pace</span>
      <div className="flex overflow-hidden rounded-lg border border-slate-700">
        {([1, 2, 4] as const).map((v) => {
          const on = pace === v;
          return (
            <button key={v} aria-pressed={on} onClick={() => choosePace(v)}
                    title={v === 1 ? 'Normal pace' : `${v} times slower`}
                    className={`px-2.5 py-1 text-[12px] font-semibold ${on ? 'text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                    style={on ? { background: UIP } : undefined}>
              {v}×
            </button>
          );
        })}
      </div>
    </div>
  );

  const stage = STAGES[step];
  const liveView = step === targetStage;   // showing the case's ACTUAL current stage
  // Whatever has already had its turn on the timeline counts as done.
  const visited = useMemo(() => new Set(TIMELINE.slice(0, cursor).map((t) => t.by)), [TIMELINE, cursor]);

  // Stacked view: a component is "revealed" once the simulation has reached it -
  // i.e. it was active in any stage from 0..current step - and then it stays.
  const revealedIds = useMemo(() => {
    const s = new Set<string>();
    if (stacked && !started) return s; // blank canvas until the user clicks Play / a step
    STAGES.slice(0, step + 1).forEach((st) => st.active.forEach((id) => s.add(id)));
    return s;
  }, [STAGES, step, stacked, started]);
  const hidden = stacked && !started;
  const dispStep = hidden ? -1 : step;

  // Bring the working card into view whenever the cursor moves — but only when it
  // is not already comfortably visible, so stepping between two cards in the same
  // layer does not jog the page for no reason.
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const id = window.setTimeout(() => {
      let sc: HTMLElement | null = el.parentElement as unknown as HTMLElement | null;
      while (sc && sc.scrollHeight <= sc.clientHeight + 4) sc = sc.parentElement;
      const box = el.getBoundingClientRect();
      const view = sc
        ? sc.getBoundingClientRect()
        : ({ top: 0, bottom: window.innerHeight, height: window.innerHeight } as DOMRect);
      const pad = 120;   // clear the sticky controls, and leave the card some air
      if (box.top >= view.top + pad && box.bottom <= view.bottom - 24) return;
      const delta = (box.top + box.height / 2) - (view.top + pad + (view.height - pad) / 2);
      (sc ?? window).scrollBy({ top: delta, behavior: 'smooth' });
    }, 60);   // let the new layout settle before measuring
    return () => window.clearTimeout(id);
  }, [cursor, hidden]);

  /** Where a given task sits relative to the cursor. */
  const taskState = (stageIdx: number, taskIdx: number): 'done' | 'now' | 'todo' => {
    if (hidden) return 'todo';
    if (stageIdx < step) return 'done';
    if (stageIdx > step) return 'todo';
    if (taskIdx < cur.task) return 'done';
    return taskIdx === cur.task ? 'now' : 'todo';
  };

  const nodeState = (id: string): 'active' | 'engaged' | 'done' | 'idle' => {
    if (hidden) return 'idle';
    if (id === cur.by) return 'active';                 // performing the current task
    if (stage.active.includes(id)) return 'engaged';    // part of this stage's work
    if (visited.has(id)) return 'done';
    return 'idle';
  };

  return (
    <div className={`space-y-4 ${stacked ? 'mx-auto max-w-[1740px]' : ''}`}>
      <style>{`
        @keyframes relayRail { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes relayFlow { to { stroke-dashoffset: -26; } }
        @keyframes relayDot { 0%,100%{opacity:1} 50%{opacity:.35} }
        .relay-rail { animation: relayRail 2.2s ease-in-out infinite; }
        .relay-node { transition: opacity .22s ease; }
        .relay-flow { stroke-dasharray: 6 8; animation: relayFlow .7s linear infinite; }
        .relay-dot { animation: relayDot 1.2s ease-in-out infinite; }
        @keyframes relayPop { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }
        .relay-pop { animation: relayPop .34s cubic-bezier(.2,.7,.3,1) both; transform-box: fill-box; transform-origin: center; }
        @keyframes relayHeartbeat { 0%,28%,70%,100%{transform:scale(1)} 14%{transform:scale(1.28)} 42%{transform:scale(1.18)} }
        .relay-heartbeat { display: inline-block; transform-origin: center; animation: relayHeartbeat 1.4s ease-in-out infinite; }
      `}</style>

      {stacked ? (
      /* Stacked: horizontal lifecycle strip (top), controls in the left column */
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center gap-0 overflow-x-auto">
        {STAGES.map((s, i) => {
          const done = i < dispStep;
          const active = i === dispStep;
          return (
            <div key={s.key} className="flex shrink-0 items-center">
              <button onClick={() => { setStarted(true); setStep(i); setPlaying(false); }} className="flex items-center gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition
                  ${active ? (liveView ? 'bg-emerald-600 text-white' : 'bg-orange-600 text-white')
                    : done ? 'bg-orange-500/80 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {done ? <Check size={18} /> : i + 1}
                </span>
                <span className={`whitespace-nowrap text-sm ${active ? 'font-semibold' : done ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                      style={active ? { color: liveView ? LIVE_INK : UIP } : undefined}>{s.label}</span>
              </button>
              {i < STAGES.length - 1 && <span className="mx-2 h-px w-5 shrink-0 bg-slate-700" />}
            </div>
          );
        })}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 pl-2 text-xs font-medium text-slate-300">
          <span className="inline-flex items-center gap-1.5"><UiPathMark className="h-5 w-5" />UiPath</span>
          <span className="inline-flex items-center gap-1.5"><BankMark bank={bank} className="h-4 w-4" />{bank.name}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded-sm" style={{ background: VENDOR_COLOR.threep }} />3rd party</span>
        </div>
      </div>
      ) : (
      /* Consolidated: controls row on top, vertical lifecycle stepper on the left */
      <div className="sticky top-0 z-30 pb-2 pt-4" style={{ background: 'rgb(var(--c-slate-950))' }}>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-sm">
        <select value={selectedRef} onChange={(e) => setSelectedRef(e.target.value)} className="max-w-[260px] truncate rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-3 pr-8 text-sm text-slate-200">
          {[...cases]
            .sort((a, b) => (b.MaestroInstanceId ? 1 : 0) - (a.MaestroInstanceId ? 1 : 0))
            .map((c) => (
              <option key={c.Id} value={c.CaseRef}>
                {c.CaseRef} · {c.ApplicantName.length > 16 ? c.ApplicantName.slice(0, 15).trimEnd() + '…' : c.ApplicantName}
              </option>
            ))}
        </select>
        {!liveData && (
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(250,70,22,.10)', color: UIP }}
                title="No desk records or Maestro links resolved — showing the built-in demo cases">
            demo cases
          </span>
        )}
        <div className="flex items-center gap-1">
          <button title="Previous task" onClick={() => { setPlaying(false); setCursor(hidden ? 0 : Math.max(0, cursor - 1)); setStarted(true); }} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"><ChevronLeft size={16} /></button>
          <button onClick={() => { setStarted(true); if (playing) { setPlaying(false); } else { setCursor(0); setPlaying(true); } }} style={{ background: UIP }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Walk the case'}
          </button>
          <button title="Next task" onClick={() => { setPlaying(false); setCursor(hidden ? 0 : Math.min(TIMELINE.length - 1, cursor + 1)); setStarted(true); }} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"><ChevronRight size={16} /></button>
          <button title="Reset simulation" onClick={() => { setPlaying(false); setCursor(0); setStarted(false); }} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"><RotateCcw size={16} /></button>
        </div>
        <button onClick={() => { setStarted(true); setCursor(target); setPlaying(false); }} style={{ borderColor: 'rgba(16,185,129,.45)', background: 'rgba(16,185,129,.10)', color: LIVE_INK }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold hover:brightness-95">
          <Radio size={14} /> Live (where it is now)
        </button>
        <div className="ml-auto flex items-center gap-4">
        {paceControl}
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
          {VENDOR_KEYS.map(([v, label]) => {
            const on = vendorFilter === v;
            const c = VCOLOR[v];
            return (
              <button key={v} aria-pressed={on}
                      title={on ? 'Show every product again' : `Show only ${label} products`}
                      onClick={() => setVendorFilter(on ? null : v)}
                      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition hover:bg-slate-800"
                      style={on ? { background: `${c}1c`, boxShadow: `inset 0 0 0 1.4px ${c}`, color: c } : undefined}>
                {v === 'uipath' ? <UiPathMark className="h-6 w-6" />
                  : v === 'bank' ? <BankMark bank={bank} className="h-5 w-5" />
                  : <i className="h-4 w-4 rounded-sm" style={{ background: VENDOR_COLOR.threep }} />}
                {label}
              </button>
            );
          })}
        </div>
        </div>
      </div>
      </div>
      )}

      <div className="flex gap-4">
        {stacked ? (
        <div className="w-[280px] shrink-0 self-start space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <select value={selectedRef} onChange={(e) => setSelectedRef(e.target.value)} className="w-full truncate rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-3 pr-8 text-sm text-slate-200">
            {[...cases]
              .sort((a, b) => (b.MaestroInstanceId ? 1 : 0) - (a.MaestroInstanceId ? 1 : 0))
              .map((c) => (
                <option key={c.Id} value={c.CaseRef}>
                  {c.CaseRef} · {c.ApplicantName.length > 16 ? c.ApplicantName.slice(0, 15).trimEnd() + '…' : c.ApplicantName}
                </option>
              ))}
          </select>
          <div className="flex items-center gap-1">
            <button title="Previous task" onClick={() => { setPlaying(false); setCursor(hidden ? 0 : Math.max(0, cursor - 1)); setStarted(true); }} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"><ChevronLeft size={16} /></button>
            <button onClick={() => { setStarted(true); if (playing) { setPlaying(false); } else { setCursor(0); setPlaying(true); } }} style={{ background: UIP }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
              {playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Walk the case'}
            </button>
            <button title="Next task" onClick={() => { setPlaying(false); setCursor(hidden ? 0 : Math.min(TIMELINE.length - 1, cursor + 1)); setStarted(true); }} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"><ChevronRight size={16} /></button>
            <button title="Reset simulation" onClick={() => { setPlaying(false); setCursor(0); setStarted(false); }} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"><RotateCcw size={16} /></button>
          </div>
          <button onClick={() => { setStarted(true); setCursor(target); setPlaying(false); }} style={{ borderColor: 'rgba(16,185,129,.45)', background: 'rgba(16,185,129,.10)', color: LIVE_INK }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold hover:brightness-95">
            <Radio size={14} /> Live (where it is now)
          </button>
          <div className="flex justify-end">{paceControl}</div>
        </div>
        ) : (
        /* Consolidated: the lifecycle, nested — every stage with the tasks that
           run inside it, the way the case plan itself is shaped. A flat list of
           five names said where the case was but nothing about what that stage
           actually does; each task now carries the product that performs it. */
        <div className="sticky w-[20.5rem] shrink-0 self-start overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4"
             style={{ top: 92, maxHeight: 'calc(100dvh - 116px)' }}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Lifecycle</span>
            <a href={maestroLink(selected?.MaestroInstanceId)} target="_blank" rel="noopener noreferrer"
               title={selected?.MaestroInstanceId
                 ? `Open ${selectedRef} in Maestro`
                 : 'Open the case deployment in Maestro — this case has no live instance'}
               className="shrink-0 whitespace-nowrap text-[11.5px] font-semibold hover:underline"
               style={{ color: UIP }}>
              Open in Maestro ↗
            </a>
          </div>
          <div className="space-y-2">
            {STAGES.map((st, i) => {
              const done = i < dispStep;
              const now = i === dispStep;
              const accent = done ? DONE : now ? UIP : 'rgb(var(--c-slate-700))';
              const open = now || openKeys.has(st.key);
              return (
                <div key={st.key}
                     className="overflow-hidden rounded-xl border"
                     style={{
                       borderColor: done ? DONE_LINE : now ? NOW_LINE : 'rgb(var(--c-slate-800))',
                       background: done ? DONE_SOFT : now ? NOW_SOFT : 'transparent',
                     }}>
                  <div className="flex w-full items-center gap-2.5 px-2.5 py-2">
                    <button onClick={() => { setStarted(true); setStep(i); setPlaying(false); }}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: done || now ? accent : 'rgb(var(--c-slate-700))' }}>
                        {done ? <Check size={13} strokeWidth={3.4} /> : i + 1}
                      </span>
                      <span className="truncate text-[14px] font-semibold"
                            style={{ color: done ? DONE : now ? UIP : 'rgb(var(--c-slate-500))' }}>{st.label}</span>
                    </button>
                    {now && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                            style={liveView
                              ? { background: 'rgba(16,185,129,.16)', color: '#10b981' }
                              : { background: 'rgba(250,70,22,.14)', color: UIP }}>
                        {liveView ? 'LIVE' : 'RUNNING'}
                      </span>
                    )}
                    {/* The running stage is always open; every other one folds, and
                        this is how you peek into it without moving the simulation. */}
                    {!now && (
                      <button
                        aria-label={`${open ? 'Collapse' : 'Expand'} ${st.label} tasks`}
                        aria-expanded={open}
                        onClick={() => setOpenKeys((k) => {
                          const next = new Set(k);
                          if (next.has(st.key)) next.delete(st.key); else next.add(st.key);
                          return next;
                        })}
                        className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>

                  {open ? (
                    /* The tasks, indented under a rail that carries the stage's colour. */
                    <div className="relative ml-[22px] border-l pb-2 pl-3 pr-2.5"
                         style={{ borderColor: done ? DONE_LINE : now ? NOW_LINE : 'rgb(var(--c-slate-800))' }}>
                      <div className="pb-1 pt-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Sequential tasks</div>
                      <div className="space-y-1">
                        {st.tasks.map((t, ti) => (
                          <TaskRow model={model} bankMark={bank.mark} key={t.label} label={t.label} by={t.by} ov={ov}
                                   state={taskState(i, ti)}
                                   onClick={() => { setStarted(true); setCursor(STAGE_START[i] + ti); setPlaying(false); }} />
                        ))}
                      </div>
                      {st.gate && st.gateBy && (<>
                      <div className="pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Event-triggered tasks</div>
                      <TaskRow model={model} bankMark={bank.mark} label={st.gate} by={st.gateBy} gate ov={ov}
                               state={taskState(i, st.tasks.length)}
                               onClick={() => { setStarted(true); setCursor(STAGE_START[i] + st.tasks.length); setPlaying(false); }} />
                      </>)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pb-2 pl-[46px] pr-2.5 text-[10.5px] text-slate-500">
                      {done && <Check size={11} strokeWidth={3} style={{ color: DONE }} />}
                      {st.tasks.length} tasks{st.gate ? ' · 1 gate' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* right column */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Stage banner (neutral "ready" state before the stacked build-up begins) */}
      {hidden ? (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">▶</div>
        <div>
          <div className="text-sm font-semibold text-slate-100">Stacked view</div>
          <div className="text-[15px] leading-snug text-slate-400">Press <span className="font-semibold" style={{ color: UIP }}>Walk the case</span> to build the architecture step by step.</div>
        </div>
      </div>
      ) : (
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${liveView ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-orange-500/30 bg-orange-500/5'}`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${liveView ? 'bg-emerald-600' : 'bg-orange-600'}`}>{step + 1}</div>
        <div>
          <div className="text-sm font-semibold text-slate-50">
            {stage.label}
            {liveView
              ? <span className="ml-2 rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(16,185,129,.16)', color: LIVE_INK }}>● LIVE — {selectedRef} IS HERE NOW</span>
              : <span className="ml-2 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(250,70,22,.12)', color: UIP }}>demo playback</span>}
          </div>
          <div className="text-[15px] leading-snug text-slate-200">{stage.plain}</div>
          {/* The stage's own work and the app-bound approval that closes it — the
              case plan's real step and task titles, not a paraphrase. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-400">
            {stage.tasks.map((t) => (
              <span key={t.label} className="rounded-md border border-slate-700 px-1.5 py-0.5">{t.label}</span>
            ))}
            {stage.gate && stage.gateBy && NODE_BY_ID[stage.gateBy] && (() => {
              // The gate wears the product it is taken in — the bank's own approval
              // app, in this project — not a fixed UiPath mark.
              const gn = NODE_BY_ID[stage.gateBy], gc = VCOLOR[gn.vendor];
              return (
                <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold"
                      style={{ borderColor: `${gc}6b`, background: `${gc}1a`, color: VDEEP[gn.vendor] }}>
                  <LogoHtml name={gn.logo} bankMark={bank.mark} className="h-3.5 w-3.5" />Gate · {stage.gate}
                </span>
              );
            })()}
          </div>
        </div>
      </div>
      )}

      {/* The architecture relay + explanation panel */}
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 self-start overflow-x-auto">
        <svg viewBox={`0 ${VB_TOP} ${CANVAS_W} ${VB_H}`} className="w-full min-w-[900px]">
          <defs>
            {/* A soft neutral lift, not a coloured halo. A blurred copy of the card
                merged behind it (the old #glow) bloomed past its own edges and read
                as a smudge; a real shadow raises the card off the panel instead. */}
            <filter id="lift" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.16" />
            </filter>
            <filter id="card" x="-12%" y="-12%" width="124%" height="124%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#0f172a" floodOpacity="0.07" />
            </filter>
          </defs>

          {/* ── The ten layers ──────────────────────────────────────────────────
              Each layer is its own dashed container with a gutter beside it —
              name, description and vendor tag. UiPath layers are tinted, so
              reading down the orange shows how much of the stack is UiPath's, and
              Orchestration leads on weight rather than on an outline. */}
          {LAYERS.map((L) => {
            if (stacked && !NODES.some((n) => n.layer === L.key && revealedIds.has(n.id))) return null;
            const Icon = ICONS[L.icon] ?? Database;
            const isUip = L.vend === 'uip';
            const subL = labelLines(layerSub(L.key, L.sub, ov), 24);
            const vt = VEND_TEXT[L.vend], vc = VEND_COLOR[L.vend];
            const blockH = 14 + subL.length * 11 + 6 + 14;
            const gy = L.y + (L.h - blockH) / 2;
            return (
              <g key={L.key}>
                {/* A quiet filled panel, not a dotted outline. Ten dashed rectangles
                    stacked up read as scaffolding; a tone the white cards sit on
                    groups the layer without drawing attention to the container. */}
                <rect x={BOX_X} y={L.y - BOX_PAD_Y} width={BOX_W} height={L.h + BOX_PAD_Y * 2} rx="14"
                      fill={isUip ? UIP : 'rgb(var(--c-slate-500))'} opacity={isUip ? (L.hero ? 0.075 : 0.05) : 0.05} />
                <rect x={BOX_X} y={L.y - BOX_PAD_Y} width={BOX_W} height={L.h + BOX_PAD_Y * 2} rx="14"
                      fill="none" stroke={isUip ? UIP : 'rgb(var(--c-slate-500))'} strokeWidth="1" opacity={isUip ? 0.28 : 0.16} />
                <g transform={`translate(14,${gy - 2})`}>
                  <Icon size={17} color={isUip ? UIP : 'rgb(var(--c-slate-500))'} strokeWidth={1.7} />
                </g>
                <text x="38" y={gy + 12} fontSize={L.hero ? 14.5 : 13} fontWeight="700"
                      fill="rgb(var(--c-slate-50))" letterSpacing="-0.25">{layerLabel(L.key, L.label, ov)}</text>
                {subL.map((ln, i) => (
                  <text key={i} x="38" y={gy + 25 + i * 11} fontSize="9.5" fill="rgb(var(--c-slate-500))">{ln}</text>
                ))}
                <rect x="38" y={gy + 18 + subL.length * 11} width={vt.length * 5.4 + 11} height="13" rx="2"
                      fill={vc} opacity={L.hero ? 0.2 : 0.12} />
                <text x="43.5" y={gy + 27.5 + subL.length * 11} fontSize="7.8" fontWeight="700" letterSpacing="1" fill={vc}>{vt}</text>
              </g>
            );
          })}

          {/* ── Product cards ───────────────────────────────────────────────────
              Logo left, text right. Colour means VENDOR — the bank's own colour, orange
              UiPath, teal third-party — live or idle; painting every live card
              emerald turned seven of them mint at once and threw the ownership
              signal away. "Where the case is" gets one LIVE chip instead. */}
          {NODES.map((n) => {
            if (stacked && !revealedIds.has(n.id)) return null;
            const layer = LAYERS.find((L) => L.key === n.layer)!;
            const st = nodeState(n.id);
            const color = VCOLOR[n.vendor];
            const isActive = st === 'active';        // doing the current task, right now
            const isEngaged = st === 'engaged';      // part of this stage, not this task
            const isDone = st === 'done';
            const isLiveHere = liveView && n.id === stage.primary;   // the one card the case is really in
            const isBar = n.w > 400;
            // The UiPath footprint: an orange card inside a layer UiPath does not lead.
            const oddOneOut = !isBar && n.vendor === 'uipath' && layer.vend !== 'uip';
            const faded = !inFilter(n.vendor);        // filtered out by the legend
            const isThisApp = n.id === thisApp;   // the surface you opened this from
            // ONLY the card performing the current task speaks. Engaged cards used to
            // carry their stage-standing action too, which meant a robot doing "BVN
            // validation" was surrounded by a dozen products each claiming to be
            // doing something — WhatsApp "asking for the missing document" while
            // nothing had been asked. Stage membership is already legible from the
            // tint, and the parts in play are listed in the panel on the right; the
            // caption is reserved for what is actually happening now.
            const act = isActive ? cur.label : undefined;
            // A working card goes SOLID. A tint plus a border plus a neutral shadow
            // was too polite to find among thirty white cards; inverting it is the
            // one change that makes "these are the parts running right now" read at
            // a glance, and it needs no glow to do it.
            const deep = VDEEP[n.vendor];
            const solid = isActive && !isBar;
            const fill = solid ? deep : isEngaged ? `${color}16` : oddOneOut ? `${color}14` : 'rgb(var(--c-slate-900))';
            const stroke = solid ? deep : isEngaged ? `${color}9e` : oddOneOut ? `${color}6b` : 'rgb(var(--c-slate-800))';
            const url = isThisApp
              ? undefined
              : n.id === 'maestro' && selected?.MaestroInstanceId
              ? `${MAESTRO_CASE}/instances/${selected.MaestroInstanceId}?folderKey=${FOLDER_KEY}`
              : n.id === 'actionCenter'
              // Only ever deep-link to THIS case's task. Falling back to the generic
              // inbox is worse than no link: Action Center auto-opens whatever task
              // happens to be first in the user's pending list.
              ? acTaskUrl ?? undefined
              : n.url;

            const label = nodeLabel(n.id, ov);
            const sub = nodeSub(n.id, ov);
            // How many characters fit is a property of THIS card's width now that
            // cards trade width within a row — a fixed count re-wrapped the very
            // names the extra width was bought for.
            const lines = isBar ? [label] : labelLines(label, Math.max(10, Math.floor((n.w - 56) / 6.7)));
            const two = lines.length === 2;
            const tx = isBar ? n.x + 50 : n.x + 44;
            const textCol = isBar || solid ? '#fff' : isDone ? 'rgb(var(--c-slate-200))' : 'rgb(var(--c-slate-100))';

            return (
              <g key={n.id} ref={isActive ? activeRef : undefined}
                 filter={isActive ? 'url(#lift)' : isBar ? undefined : 'url(#card)'}
                 className={`relay-node${stacked ? ' relay-pop' : ''}`}
                 opacity={faded ? 0.16 : 1}
                 style={{ cursor: faded ? 'default' : url ? 'pointer' : 'default' }}
                 onMouseEnter={() => !faded && holdHover(n.id)} onMouseLeave={releaseHover}
                 onClick={() => !faded && url && window.open(url, '_blank', 'noopener')}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="9"
                      fill={isBar ? UIP : fill} stroke={isBar ? UIP : stroke} strokeWidth={isEngaged ? 1.4 : 1} />
                {/* Vendor colour rides the LEFT edge, the way the target-state page
                    marks a cell. A coloured bar across the top of all 38 cards was
                    38 repetitions of the same decoration. */}
                {/* The brand marks are full-colour and mostly dark; on a solid card
                    they need their own ground to stay legible. */}
                {solid && <rect x={n.x + 10} y={n.y + (n.h - 30) / 2} width="30" height="30" rx="8" fill="#fff" opacity="0.94" />}

                {(() => {
                  // A large mark (NIMC, NIBSS) takes 32px, reaching into the card's
                  // left margin; it still ends before the text at n.x + 44.
                  const sz = !isBar && LARGE_MARKS.has(n.logo) ? 32 : 22;
                  return <Logo name={n.logo} bankMark={bank.mark} x={isBar ? n.x + 18 : n.x + 14 - (sz - 22) / 2 - 1} y={n.y + (n.h - sz) / 2} size={sz} />;
                })()}
                {url && hovered === n.id && (
                  <text x={n.x + n.w - 9} y={n.y + 16} textAnchor="end" fontSize="11" fontWeight="700"
                        fill={isBar || solid ? 'rgba(255,255,255,.85)' : 'rgb(var(--c-slate-500))'}>↗</text>
                )}

                <text x={tx} y={isBar ? n.y + 22 : n.y + (two ? 25 : 30)}
                      fontSize={isBar ? 18 : two ? 12.5 : 13.5} fontWeight="700" fill={textCol} letterSpacing="-0.2">
                  {lines.map((ln, i) => <tspan key={i} x={tx} dy={i === 0 ? 0 : 13}>{ln}</tspan>)}
                </text>

                {act && (
                  <foreignObject x={isBar ? n.x + n.w - 250 : tx} y={isBar ? n.y + 15 : n.y + (two ? 41 : 35)}
                                 width={isBar ? 232 : n.w - 56} height={isBar ? 20 : 17} style={{ pointerEvents: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px', boxSizing: 'border-box', height: '100%',
                      borderRadius: '6px', background: '#fff',
                      border: solid ? 'none' : '1px solid rgb(var(--c-slate-800))', padding: '0 6px',
                    }}>
                      <span className="relay-dot" style={{ width: '4.5px', height: '4.5px', borderRadius: '50%', background: isBar ? UIP : deep, flexShrink: 0 }} />
                      <span style={{ color: '#182126', fontSize: isBar ? '11px' : '9.8px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isBar ? ACTIONS[stage.key]?.[n.id] : act}</span>
                    </div>
                  </foreignObject>
                )}
                {sub && (isBar || !act) && (
                  <text x={tx} y={isBar ? n.y + 38 : n.y + (two ? 50 : 44)} fontSize={isBar ? 11 : 9.8}
                        fill={isBar ? '#ffe2d7' : solid ? 'rgba(255,255,255,.86)' : 'rgb(var(--c-slate-500))'}>{sub}</text>
                )}

                {isThisApp && (
                  <g>
                    <rect x={n.x + n.w - 84} y={n.y + 8} width="74" height="13" rx="6.5" fill={solid ? '#fff' : UIP} opacity={solid ? 0.92 : 0.11} />
                    <circle cx={n.x + n.w - 75} cy={n.y + 14.5} r="2.1" fill={solid ? deep : UIP} />
                    <text x={n.x + n.w - 47} y={n.y + 17.5} textAnchor="middle" fontSize="7.2" fontWeight="700" fill={solid ? '#182126' : UIP} letterSpacing="0.4">YOU ARE HERE</text>
                  </g>
                )}
                {isLiveHere && !isBar && (
                  <g>
                    <rect x={n.x + n.w - 54} y={n.y + 8} width="44" height="13" rx="6.5" fill={solid ? '#fff' : '#10b981'} opacity={solid ? 0.94 : 0.15} />
                    <circle cx={n.x + n.w - 45} cy={n.y + 14.5} r="2.1" fill="#10b981" className="relay-dot" />
                    <text x={n.x + n.w - 31} y={n.y + 17.5} textAnchor="middle" fontSize="7.2" fontWeight="700" fill="#10b981" letterSpacing="0.5">LIVE</text>
                  </g>
                )}
                {isDone && !isBar && (
                  <g transform={`translate(${n.x + n.w - 15},${n.y + n.h - 14})`}>
                    <circle r="7" fill="#10b981" /><g transform="translate(-4.5,-4.5)"><Check size={9} color="#fff" strokeWidth={3.4} /></g>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── The stage hand-off ──────────────────────────────────────────────
              Drawn last, so it passes straight over the cards between its two
              ends rather than detouring through the gaps between them — the
              detour was technically tidy but read as plumbing. A casing stroke in
              the surface colour sits under the line so it stays legible crossing a
              card without hiding what is written there. */}
          {!hidden && (() => {
            const prev = cursor > 0 ? TIMELINE[cursor - 1] : undefined;
            const A = NODE_BY_ID[prev?.by ?? stage.from], B = NODE_BY_ID[cur.by];
            if (!A || !B || A.id === B.id) return null;
            const down = B.y > A.y;
            const ax = A.x + A.w / 2, ay = down ? A.y + A.h : A.y;
            const bx = B.x + B.w / 2, by = down ? B.y : B.y + B.h;
            const k = Math.abs(by - ay) * 0.42;
            const d = `M ${ax} ${ay} C ${ax} ${down ? ay + k : ay - k}, ${bx} ${down ? by - k : by + k}, ${bx} ${by}`;
            const color = VDEEP[B.vendor];
            return (
              <g style={{ pointerEvents: 'none' }}>
                <path d={d} fill="none" stroke="rgb(var(--c-slate-900))" strokeWidth="4.6" strokeLinecap="round" opacity="0.72" />
                <path d={d} fill="none" stroke={color} strokeWidth="2.2" opacity="0.28" strokeLinecap="round" />
                <path d={d} fill="none" stroke={color} strokeWidth="2.2" className="relay-flow" strokeLinecap="round" />
                <circle cx={ax} cy={ay} r="3" fill={color} opacity="0.55" />
                <circle cx={bx} cy={by} r="3.8" fill={color} />
                <circle r="3.8" fill={color}>
                  <animateMotion dur="1.5s" repeatCount="indefinite" path={d} />
                </circle>
              </g>
            );
          })()}

          {/* hover tooltip — point at any component to learn what it is & what it's doing */}
          {hovered && NODE_BY_ID[hovered] && (() => {
            const node = NODE_BY_ID[hovered];
            const onActive = !hidden && stage.active.includes(hovered);
            const c = VCOLOR[node.vendor];
            const isThisApp = node.id === thisApp;
            const act = onActive ? ACTIONS[stage.key]?.[hovered] : undefined;
            const tw = 258;
            const th = 88 + (act ? 22 : 0) + (isThisApp ? 32 : node.url ? 18 : 0);
            const cx = node.x + node.w / 2;
            const tx = Math.max(6, Math.min(CANVAS_W - tw - 6, cx - tw / 2));
            const below = node.y - th - 6 < VB_TOP;
            const ty = below ? node.y + node.h + 6 : node.y - th - 6;
            const tipUrl = isThisApp ? undefined
              : node.id === 'maestro' && selected?.MaestroInstanceId
              ? `${MAESTRO_CASE}/instances/${selected.MaestroInstanceId}?folderKey=${FOLDER_KEY}`
              : node.id === 'actionCenter' ? acTaskUrl ?? undefined : node.url;
            return (
              <foreignObject x={tx} y={ty} width={tw} height={th} style={{ overflow: 'visible' }}
                             onMouseEnter={() => holdHover(node.id)} onMouseLeave={releaseHover}>
                <div onClick={() => tipUrl && window.open(tipUrl, '_blank', 'noopener')}
                     style={{
                  boxSizing: 'border-box', borderRadius: '10px', background: 'rgb(var(--c-slate-900))',
                  border: `1.4px solid ${c}`, padding: '9px 11px', boxShadow: '0 10px 28px rgba(0,0,0,.22)',
                  cursor: tipUrl ? 'pointer' : 'default',
                }}>
                  <div style={{ fontWeight: 700, color: 'rgb(var(--c-slate-50))', fontSize: '13.5px' }}>{nodeLabel(node.id, ov)}</div>
                  <div style={{ color: 'rgb(var(--c-slate-400))', fontSize: '11.5px', marginTop: '3px', lineHeight: 1.35 }}>{node.plain}</div>
                  {act && <div style={{ color: '#10b981', fontSize: '11.5px', marginTop: '5px', fontWeight: 600 }}>▸ Doing now: {act}</div>}
                  {isThisApp
                    ? <div style={{ color: UIP, fontSize: '10.5px', marginTop: '5px', fontWeight: 600 }}>● You are here — this is the app you're using</div>
                    : tipUrl && <div style={{ color: c, fontSize: '10.5px', marginTop: '5px', fontWeight: 600 }}>click to open ↗</div>}
                </div>
              </foreignObject>
            );
          })()}
        </svg>
        </div>
        {/* Pinned, like the controls: the view scrolls to follow the action, so a panel
            that says what the action IS has to travel with it. `self-start` is what
            gives it room to stick — a stretched flex child has none. Capped and
            scrollable in case a stage puts a lot of products in play. */}
        <div className="sticky w-72 shrink-0 self-start overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4"
             style={{ top: 92, maxHeight: 'calc(100dvh - 116px)' }}>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Radio size={13} className="relay-heartbeat text-orange-400" /> What each part is doing
          </div>
          {hidden ? (
            <div className="text-sm leading-snug text-slate-500">Each component’s role appears here as the simulation reaches it.</div>
          ) : (
          <>
            {/* The task in hand, and the one product performing it. Listing every
                product in the stage meant reading eight paragraphs to find the one
                that had just lit up. */}
            <div className="rounded-lg border p-2.5" style={{ borderColor: NOW_LINE, background: NOW_SOFT }}>
              <div className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: UIP }}>
                {cur.gate ? 'Event-triggered task' : `Task ${cur.task + 1} of ${stage.tasks.length}`} · {stage.label}
              </div>
              <div className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-50">{cur.label}</div>
              {NODE_BY_ID[cur.by] && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <LogoHtml name={NODE_BY_ID[cur.by].logo} bankMark={bank.mark} className="h-5 w-5" />
                    <span className="text-[14px] font-semibold text-slate-100">{nodeLabel(cur.by, ov)}</span>
                  </div>
                  <div className="mt-1 text-[13px] leading-snug text-slate-300">{WHY[cur.by]}</div>
                </>
              )}
            </div>

            {/* Everything else the stage has in play, named but not explained. */}
            <div className="mt-3 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Also in play this stage</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {stage.active.filter((id) => id !== cur.by && NODE_BY_ID[id]).map((id) => (
                <span key={id} title={WHY[id]}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-1.5 py-1 text-[11px] text-slate-300">
                  <LogoHtml name={NODE_BY_ID[id].logo} bankMark={bank.mark} className="h-3.5 w-3.5" />{nodeLabel(id, ov)}
                </span>
              ))}
            </div>
          </>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
