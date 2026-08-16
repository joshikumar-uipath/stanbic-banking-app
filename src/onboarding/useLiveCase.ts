// ─────────────────────────────────────────────────────────────────────────────
// useLiveCase — the live Maestro state for a record, for any surface that wants
// to show what the case has ACTUALLY done rather than what the seeded record says.
//
// The desk pane grew this logic first; the applicant's status screen needs the
// same answer, so it lives here instead of being copied. Records with no linked
// instance return `live: false` and the caller keeps its demo data — that is the
// deliberate split: unrun cases still tell the story, live cases tell the truth.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import {
  getLinkedInstance, getState, getCachedState, LINKS_EVENT, type LiveState,
} from './maestro';
import { getCorporateState, getCachedCorporateState } from './maestro-corporate';
import { isCorporate, type OnboardingCase } from './types';

export interface LiveCase {
  /** The linked Maestro instance, or null when this record has never been run. */
  instanceId: string | null;
  state: LiveState | null;
  /** The live case has answered this session. Until then, callers must not treat
   *  a missing value as "nothing happened" — that is how a screen paints an empty
   *  state and then reverses itself a beat later. */
  asked: boolean;
  /** Safe to drive UI from `state`: linked, answered, and something came back. */
  live: boolean;
}

export function useLiveCase(c: Pick<OnboardingCase, 'id' | 'entity' | 'state'>): LiveCase {
  const corporate = isCorporate(c);
  const fetchState = (id: string) => (corporate ? getCorporateState(id) : getState(id));
  const seed = (i: string | null) => (!i ? null : corporate ? getCachedCorporateState(i) : getCachedState(i));

  const [instanceId, setInstanceId] = useState<string | null>(() => getLinkedInstance(c.id));
  const [state, setState] = useState<LiveState | null>(() => seed(getLinkedInstance(c.id)));
  const [asked, setAsked] = useState(false);

  // Reset during render, not in an effect: an effect runs after paint, so a new
  // record would get one frame carrying the previous record's case state.
  const [stateFor, setStateFor] = useState(c.id);
  if (stateFor !== c.id) {
    const i = getLinkedInstance(c.id);
    setStateFor(c.id);
    setInstanceId(i);
    setState(seed(i));
    setAsked(false);
  }

  // The link can arrive after mount — Data Fabric hydrate, or a colleague linking
  // this record elsewhere.
  useEffect(() => {
    const onLinks = () => setInstanceId(getLinkedInstance(c.id));
    window.addEventListener(LINKS_EVENT, onLinks);
    return () => window.removeEventListener(LINKS_EVENT, onLinks);
  }, [c.id]);

  useEffect(() => {
    if (!instanceId) return;
    let alive = true;
    const tick = () => void fetchState(instanceId)
      .then((s) => { if (alive) { setState(s); setAsked(true); } })
      .catch(() => { if (alive) setAsked(true); });
    tick();
    const iv = setInterval(() => { if (!state?.done) tick(); }, 4000);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  return { instanceId, state, asked, live: Boolean(instanceId && asked && state) };
}

/** Both caseplans use the same five stages, and the applicant's five progress
 *  steps line up with them one-for-one. */
const STEP_BY_STAGE: Record<string, number> = {
  Intake: 0, Verification: 1, Decision: 2, Activation: 3, Closure: 4,
};

/** How far the applicant-facing progress list has actually got, from the case.
 *  Returns null when there is no live case to read. */
export function liveProgressIndex(s: LiveState | null): number | null {
  if (!s) return null;
  if (s.done) return 4;
  const active = s.activeStage ? STEP_BY_STAGE[s.activeStage] : undefined;
  if (active !== undefined) return active;
  // No active stage named yet — fall back to the furthest completed one.
  const completed = (s.completedStages ?? [])
    .map((n) => STEP_BY_STAGE[n]).filter((n) => n !== undefined) as number[];
  return completed.length ? Math.min(4, Math.max(...completed) + 1) : 0;
}
