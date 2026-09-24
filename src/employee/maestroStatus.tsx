// ─────────────────────────────────────────────────────────────────────────────
// Shared "Maestro stage" status — the live orchestration lane used across desk
// lists (Open an account, My desk). One poller fetches every linked record's state
// in two API calls; the cell renders a compact stage bar + word + "live" badge.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { maestroReady, getLinkedInstance, getStates, backfillStages, LINKS_EVENT, STAGES as MAESTRO_STAGES, CALL_PURPOSE_LABEL, type LiveStateLite, type CallWait } from '../onboarding/maestro';
import { getCorporateState } from '../onboarding/maestro-corporate';
import { store, isCorporate } from '../onboarding';

// A linked row whose state hasn't loaded yet — shown as "Checking…", NOT "Not started",
// so a row never displays a wrong status while the network fetch is in flight.
const LOADING: LiveStateLite = { jobState: 'Loading', done: false, awaiting: false, stage: null };

// Last-known states cached per record for instant paint on refresh (per-tab; the network
// refresh corrects it a moment later). Removes the "flash of Not started" on reload.
const MSTATE_KEY = 'aof_mstates';
function readCache(ids: string[]): Record<string, LiveStateLite> {
  try {
    const all = JSON.parse(sessionStorage.getItem(MSTATE_KEY) || '{}') as Record<string, LiveStateLite>;
    const set = new Set(ids);
    return Object.fromEntries(Object.entries(all).filter(([k]) => set.has(k)));
  } catch { return {}; }
}
function writeCache(m: Record<string, LiveStateLite>): void {
  try { sessionStorage.setItem(MSTATE_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

/** Move a record to its terminal state once its Maestro case has completed.
 *  Idempotent and quiet: a record already there, declined, or not found is left
 *  alone, so the 8s poll does not rewrite the same row for ever. The other half
 *  of the guard in store.update(): nothing used to move a record to
 *  FULLY_ACTIVATED when its case actually FINISHED, because the writers that set
 *  it fired early instead. Now that those are blocked, this is what produces the
 *  state — the case completing Closure. */
async function settle(recordId: string): Promise<void> {
  try {
    const c = await store.get(recordId);
    if (!c || c.state === 'FULLY_ACTIVATED' || c.state === 'DECLINED') return;
    await store.advance(recordId, 'FULLY_ACTIVATED', 'Maestro case completed — Closure signed off');
  } catch { /* the desk keeps polling; a failed settle retries next tick */ }
}

/**
 * Live Maestro state for a set of desk records, keyed by record id. Regardless of how
 * many rows are linked, each refresh is just two calls (all job states + all open tasks);
 * refreshes every 8s and immediately when links change (a case run on any machine). Paints
 * instantly from a per-tab cache on reload, and shows "Checking…" (never "Not started") for
 * linked rows still loading.
 */
export function useMaestroStates(recordIds: string[]): Record<string, LiveStateLite> {
  const idsKey = recordIds.join(',');
  // Recompute the record→instance map when the record set OR the shared links change.
  const [linkVersion, setLinkVersion] = useState(0);
  useEffect(() => {
    const bump = () => setLinkVersion((v) => v + 1);
    window.addEventListener(LINKS_EVENT, bump);
    // Re-read once the listener is up. The map is read during render, but the
    // Data Fabric hydrate that fills it resolves on its own microtask — so a
    // screen can render against an empty map and have LINKS_EVENT fire in the gap
    // before this listener exists. The hydrate only announces when something
    // CHANGED, so that one missed event is never repeated and the screen would
    // stay on the empty map for good. One extra memo pass per mount closes it.
    bump();
    return () => window.removeEventListener(LINKS_EVENT, bump);
  }, []);
  const linkedByRecord = useMemo(() => {
    const m: Record<string, string> = {};
    for (const id of recordIds) { const inst = getLinkedInstance(id); if (inst) m[id] = inst; }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, linkVersion]);
  // The poller's dependency key carries the INSTANCE ids, not just the record ids.
  // Keyed on the record set alone, re-linking a record to a different instance
  // left the key unchanged, the effect never re-ran, and its closure went on
  // polling the OLD instance ids for the life of the screen.
  const linkKey = Object.entries(linkedByRecord)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([rec, inst]) => `${rec}:${inst}`)
    .join(',');

  const [mstates, setMstates] = useState<Record<string, LiveStateLite>>(() => readCache(recordIds));
  useEffect(() => {
    const instances = Object.values(linkedByRecord);
    // Reduce to just the currently-linked rows: keep a cached/loaded state if we have one,
    // otherwise "Checking…". Unlinked rows drop out entirely (→ "Not started" in the cell).
    //
    // The per-tab cache is read again here, not only at mount. My desk is the
    // landing screen and mounts before the rows have loaded, so its mount-time
    // read was for an empty record set and found nothing; the rows then arrived
    // and every linked one painted "Checking…" while Open an account, mounting
    // later with the rows already there, painted its last-known stage at once.
    const cached = readCache(Object.keys(linkedByRecord));
    setMstates((prev) => Object.fromEntries(Object.keys(linkedByRecord).map((rec) => [rec, prev[rec] ?? cached[rec] ?? LOADING])));
    if (!maestroReady() || instances.length === 0) return;
    let alive = true;
    // The cheap two-call path can only name a stage when an open Orchestrator task
    // is titled after a caseplan step, so most live rows arrived stage-less and read
    // as a bare "Running" until someone opened the case. `refreshAll` re-asks for
    // every in-flight row (a stage advances without any task changing); otherwise we
    // only ask about the rows that came back unnamed.
    const tick = async (refreshAll = false) => {
      // Corporate and individual cases live in DIFFERENT Orchestrator folders, and
      // each module only ever asks its own. Sending every instance to the
      // individual reader meant a corporate case — running, parked at Intake, and
      // saying so in the detail panel one pane away — came back unknown and the
      // column read "Not started".
      const cases = await store.list().catch(() => []);
      if (!alive) return;
      const corporateRecords = new Set(cases.filter(isCorporate).map((c) => c.id));
      const entries = Object.entries(linkedByRecord);
      const corporate = entries.filter(([rec]) => corporateRecords.has(rec));
      const individual = entries.filter(([rec]) => !corporateRecords.has(rec));
      const individualInstances = individual.map(([, inst]) => inst);

      const [byInstance, corpStates] = await Promise.all([
        individualInstances.length ? getStates(individualInstances)
          : Promise.resolve({} as Record<string, LiveStateLite>),
        // One call each: there are only ever a handful of corporate rows on a desk,
        // and the corporate reader has no bulk form.
        Promise.all(corporate.map(async ([rec, inst]) => {
          try {
            const st = await getCorporateState(inst);
            const lite: LiveStateLite = {
              jobState: st.jobState,
              done: st.done,
              awaiting: st.pendingTaskId != null,
              stage: st.activeStage,
            };
            return [rec, lite] as const;
          } catch { return null; }
        })),
      ]);
      if (!alive) return;
      const live = individualInstances.filter((i) => byInstance[i] && !byInstance[i].done);
      const targets = refreshAll ? live : live.filter((i) => !byInstance[i].stage);
      const stages = targets.length ? await backfillStages(targets) : {};
      if (!alive) return;
      setMstates((prev) => {
        const next = { ...prev };
        for (const [rec, inst] of individual) {
          const s = byInstance[inst];
          if (!s) continue;
          const b = stages[inst];
          // When the backfill answered, it read the case's own elements and is the
          // better source in BOTH directions — an approval it cannot see is one that
          // has been completed. Without a backfill this tick, `s.awaiting` already
          // carries the last authoritative answer via the cache.
          next[rec] = b ? { ...s, stage: b.stage ?? s.stage, awaiting: b.awaiting, callWait: b.callWait } : s;
        }
        for (const hit of corpStates) if (hit) next[hit[0]] = hit[1];
        writeCache(next);
        return next;
      });
      for (const [rec, inst] of individual) {
        if (byInstance[inst]?.done) void settle(rec);
      }
      for (const hit of corpStates) {
        if (hit?.[1].done) void settle(hit[0]);
      }
    };
    void tick(true);
    // Every 5th pass (~40s) re-reads all in-flight rows so an advancing stage shows
    // up on its own; the passes in between only chase rows still lacking a stage.
    let n = 0;
    const iv = setInterval(() => { n += 1; void tick(n % 5 === 0); }, 8000);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey]);
  return mstates;
}

/** A colour per stage, not per status.
 *
 *  Colouring the chip by status made every parked row the same amber — which is
 *  the state most rows are in most of the time, so the column went back to
 *  looking uniform, which is the thing the chip was added to fix. The bar and the
 *  status word already carry status; the chip's job is to say WHICH stage, and
 *  colour is what makes that legible down a long list.
 *
 *  Ordered cool → warm → green so the five read as a journey rather than five
 *  arbitrary labels. Anything unrecognised (a secondary stage such as "EDD
 *  review") falls back to neutral rather than borrowing another stage's colour. */
function stageClass(stage: string): string {
  const slug = stage.toLowerCase().replace(/[^a-z]+/g, '-');
  return (['intake', 'verification', 'decision', 'activation', 'closure'].includes(slug))
    ? `s-${slug}` : 's-other';
}

/**
 * The active-call mark: a green handset, pulsing while the voice agent is on the
 * line, still while the case is waiting for the RM to pick up. Green in both
 * states because both are the case working as designed — nothing is stuck.
 * Shared by the list cell and the record's Live-in-Maestro card so the two
 * read as the same thing.
 */
export function CallIcon({ kind, title }: { kind: CallWait['kind']; title?: string }) {
  return (
    <span className={`dk-mcall ${kind}`} title={title} aria-label={title}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
      </svg>
    </span>
  );
}

/**
 * The "Maestro stage" lane: the REAL orchestration position for a record linked to a
 * live Maestro case — a stage chip + 5-segment bar + status word, with a "live" badge.
 * Amber = parked on a human approval (needs intervention), blue = running automated
 * steps, green = completed; an explicit "Not started" when there's no Maestro instance.
 */
export function MaestroCell({ m }: { m?: LiveStateLite }) {
  if (!m) return <span className="dk-mcell empty">Not started</span>;
  // An Unknown job state is NOT the same as "no case". The case's own element
  // executions can name the stage and say a person is holding it while the
  // Orchestrator Jobs lookup fails to resolve the instance — and this cell used to
  // return on `jobState` alone, before reading either. Rows that were live and
  // parked at Intake therefore read "Not started", which is exactly the thing the
  // column exists to stop. Only claim nothing started when nothing at all is known.
  if (m.jobState === 'Unknown' && !m.done && !m.stage && !m.awaiting) {
    return <span className="dk-mcell empty">Not started</span>;
  }
  if (m.jobState === 'Loading') return (
    <span className="dk-mcell loading" title="Checking Maestro…">
      <span className="dk-mbar" aria-hidden>{MAESTRO_STAGES.map((s) => <i key={s} className="seg" />)}</span>
      <span className="dk-mlabel">Checking…</span>
    </span>
  );
  const idx = m.stage ? MAESTRO_STAGES.indexOf(m.stage as (typeof MAESTRO_STAGES)[number]) : -1;
  const kind = m.done ? 'done' : m.awaiting ? 'await' : 'run';
  // The column is headed "Maestro stage", so the stage is the thing it must
  // actually say. "Awaiting approval" on its own answered a question nobody
  // asked — every parked row read identically whether it sat at Intake or at
  // Activation. The stage leads as a chip; the status follows as words.
  // A call outranks the generic status: "Running" is true but not the news.
  const call = m.done ? null : m.callWait ?? null;
  const status = m.done ? 'Completed'
    // Name who is on the line every time. "On a call" read as a person on the
    // phone; these are placed by the voice agent — the stage in the case plan
    // is called that — and the one a person makes says so.
    : call?.kind === 'agent' ? 'Voice agent · calling'
    : call?.kind === 'due' ? 'Your call · due'
    : call?.kind === 'done' ? 'Voice agent · answered'
    : call?.kind === 'missed' ? 'Voice agent · no answer'
    : m.awaiting ? 'Awaiting approval' : 'Running';
  const title = m.done ? 'Maestro case completed'
    : call?.kind === 'agent' ? `The voice agent is calling the customer now — ${CALL_PURPOSE_LABEL[call.purpose]}`
    : call?.kind === 'due' ? `Waiting for you to call the customer — ${CALL_PURPOSE_LABEL[call.purpose]}`
    : call?.kind === 'done' ? `The voice agent reached the customer — ${CALL_PURPOSE_LABEL[call.purpose]}`
    : call?.kind === 'missed' ? `The voice agent got no answer — ${CALL_PURPOSE_LABEL[call.purpose]}`
    : m.awaiting ? `Parked for approval at ${m.stage ?? 'this stage'}`
    : `Running the ${m.stage ?? 'case'} stage`;
  return (
    <span className={`dk-mcell ${kind}`} title={title}>
      {/* Stage chip rides on the bar's line — that row was mostly empty, while the
          status underneath was losing its last word to an ellipsis as soon as the
          side panel opened. */}
      <span className="dk-mtop">
        {call && <CallIcon kind={call.kind} title={title} />}
        {m.stage && <span className={`dk-mchip ${stageClass(m.stage)}`}>{m.stage}</span>}
        <span className="dk-mbar" aria-hidden>
          {MAESTRO_STAGES.map((s, i) => {
            const st = m.done || (idx >= 0 && i < idx) ? 'done' : i === idx ? 'on' : 'off';
            return <i key={s} className={`seg ${st}`} />;
          })}
        </span>
      </span>
      {/* `live` sits with the status, not the bar: chip + bar + badge together
          overflowed the lane and spilled into the outcome column. */}
      <span className="dk-mlabel">
        <span className="dk-mstatus">{status}</span>
        {!m.done && !call && <span className="dk-mlive"><i />live</span>}
      </span>
    </span>
  );
}
