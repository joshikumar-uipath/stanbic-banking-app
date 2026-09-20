// ─────────────────────────────────────────────────────────────────────────────
// Shared "Maestro stage" status — the live orchestration lane used across desk
// lists (Open an account, My desk). One poller fetches every linked record's state
// in two API calls; the cell renders a compact stage bar + word + "live" badge.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { maestroReady, getLinkedInstance, getStates, backfillStages, LINKS_EVENT, STAGES as MAESTRO_STAGES, type LiveStateLite } from '../onboarding/maestro';

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
    return () => window.removeEventListener(LINKS_EVENT, bump);
  }, []);
  const linkedByRecord = useMemo(() => {
    const m: Record<string, string> = {};
    for (const id of recordIds) { const inst = getLinkedInstance(id); if (inst) m[id] = inst; }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, linkVersion]);
  const linkKey = Object.keys(linkedByRecord).sort().join(',');

  const [mstates, setMstates] = useState<Record<string, LiveStateLite>>(() => readCache(recordIds));
  useEffect(() => {
    const instances = Object.values(linkedByRecord);
    // Reduce to just the currently-linked rows: keep a cached/loaded state if we have one,
    // otherwise "Checking…". Unlinked rows drop out entirely (→ "Not started" in the cell).
    setMstates((prev) => Object.fromEntries(Object.keys(linkedByRecord).map((rec) => [rec, prev[rec] ?? LOADING])));
    if (!maestroReady() || instances.length === 0) return;
    let alive = true;
    // The cheap two-call path can only name a stage when an open Orchestrator task
    // is titled after a caseplan step, so most live rows arrived stage-less and read
    // as a bare "Running" until someone opened the case. `refreshAll` re-asks for
    // every in-flight row (a stage advances without any task changing); otherwise we
    // only ask about the rows that came back unnamed.
    const tick = async (refreshAll = false) => {
      const byInstance = await getStates(instances);
      if (!alive) return;
      const live = instances.filter((i) => byInstance[i] && !byInstance[i].done);
      const targets = refreshAll ? live : live.filter((i) => !byInstance[i].stage);
      const stages = targets.length ? await backfillStages(targets) : {};
      if (!alive) return;
      setMstates((prev) => {
        const next = { ...prev };
        for (const [rec, inst] of Object.entries(linkedByRecord)) {
          const s = byInstance[inst];
          if (!s) continue;
          const b = stages[inst];
          // When the backfill answered, it read the case's own elements and is the
          // better source in BOTH directions — an approval it cannot see is one that
          // has been completed. Without a backfill this tick, `s.awaiting` already
          // carries the last authoritative answer via the cache.
          next[rec] = b ? { ...s, stage: b.stage ?? s.stage, awaiting: b.awaiting } : s;
        }
        writeCache(next);
        return next;
      });
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
  // Activation. The stage leads as a chip; the status follows as words, so the
  // running case no longer needs to repeat the stage in "Intake · running".
  const status = m.done ? 'Completed' : m.awaiting ? 'Awaiting approval' : 'Running';
  const title = m.done ? 'Maestro case completed'
    : m.awaiting ? `Parked for approval at ${m.stage ?? 'this stage'}`
    : `Running the ${m.stage ?? 'case'} stage`;
  return (
    <span className={`dk-mcell ${kind}`} title={title}>
      {/* Stage chip rides on the bar's line — that row was mostly empty, while the
          status underneath was losing its last word to an ellipsis as soon as the
          side panel opened. */}
      <span className="dk-mtop">
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
        {!m.done && <span className="dk-mlive"><i />live</span>}
      </span>
    </span>
  );
}
