// ─────────────────────────────────────────────────────────────────────────────
// Shared "Maestro stage" status — the live orchestration lane used across desk
// lists (Open an account, My desk). One poller fetches every linked record's state
// in two API calls; the cell renders a compact stage bar + word + "live" badge.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { maestroReady, getLinkedInstance, getStates, LINKS_EVENT, STAGES as MAESTRO_STAGES, type LiveStateLite } from '../onboarding/maestro';

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
    const tick = async () => {
      const byInstance = await getStates(instances);
      if (!alive) return;
      setMstates((prev) => {
        const next = { ...prev };
        for (const [rec, inst] of Object.entries(linkedByRecord)) if (byInstance[inst]) next[rec] = byInstance[inst];
        writeCache(next);
        return next;
      });
    };
    void tick();
    const iv = setInterval(() => void tick(), 8000);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey]);
  return mstates;
}

/**
 * The "Maestro stage" lane: the REAL orchestration position for a record linked to a
 * live Maestro case — a 5-segment stage bar + status word, with a "live" badge. Amber =
 * parked on a human approval (needs intervention), blue = running automated steps, green =
 * completed; an explicit "Not started" when there's no Maestro instance.
 */
export function MaestroCell({ m }: { m?: LiveStateLite }) {
  if (!m || (m.jobState === 'Unknown' && !m.done)) return <span className="dk-mcell empty">Not started</span>;
  if (m.jobState === 'Loading') return (
    <span className="dk-mcell loading" title="Checking Maestro…">
      <span className="dk-mbar" aria-hidden>{MAESTRO_STAGES.map((s) => <i key={s} className="seg" />)}</span>
      <span className="dk-mlabel">Checking…</span>
    </span>
  );
  const idx = m.stage ? MAESTRO_STAGES.indexOf(m.stage as (typeof MAESTRO_STAGES)[number]) : -1;
  const kind = m.done ? 'done' : m.awaiting ? 'await' : 'run';
  const label = m.done ? 'Completed' : m.awaiting ? 'Awaiting approval' : m.stage ? `${m.stage} · running` : 'Running';
  const title = m.done ? 'Maestro case completed' : m.awaiting ? `Parked for approval at ${m.stage}` : `Running the ${m.stage ?? 'case'} stage`;
  return (
    <span className={`dk-mcell ${kind}`} title={title}>
      <span className="dk-mbar" aria-hidden>
        {MAESTRO_STAGES.map((s, i) => {
          const st = m.done || (idx >= 0 && i < idx) ? 'done' : i === idx ? 'on' : 'off';
          return <i key={s} className={`seg ${st}`} />;
        })}
        {!m.done && <span className="dk-mlive"><i />live</span>}
      </span>
      <span className="dk-mlabel">{label}</span>
    </span>
  );
}
