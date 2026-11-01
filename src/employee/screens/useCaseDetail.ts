// ─────────────────────────────────────────────────────────────────────────────
// The case as a working model — everything CaseDetail knows and can do about one
// application, with none of its markup.
//
// Lifted out of CaseDetail.tsx unchanged, so the phone's case screen
// (src/employee/mobile/screens/MCase.tsx) runs the SAME Maestro polling, the same
// in-flight approval guard, the same next-best-action rules and the same writes
// as the desk. Two renderings, one behaviour: a fix here lands on both.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { documentsFor, documentsOutcome } from '../../integrations/docChecks';
import { loadPackage } from '../../integrations/packageStore';
import type { PackageResult } from '../../integrations/packageDocs';
import { entityFromRows, personFromRows, type ReviewField } from '../../customer/ExtractionReview';
import { loadPendingExtraction, clearPendingExtraction, getCorporateState, getCachedCorporateState, approveCorporate } from '../../onboarding/maestro-corporate';
import { store, stateMeta, fullName, isCorporate, commsFor, CHANNEL_META, type OnboardingCase, type ValidationKind, type MsgChannel } from '../../onboarding';
import { startCase, getState, getCachedState, approve, isReviewStep, actionCenterUrl, getLinkedInstance, linkInstance, unlinkInstance, LINKS_EVENT, type LiveState, CALL_PURPOSE_LABEL } from '../../onboarding/maestro';
import { nextBestActions, type Nba } from '../nba';
import type { CallSubject } from '../CallPanel';
import type { Tone } from '../ui';
import { getActiveCountry, kycLabel, kycLabelAuthority } from '../../config/countries';

export const CO = getActiveCountry();
export const TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };

export const CHECK_LABEL: Record<ValidationKind, string> = {
  NIN: kycLabelAuthority('NIN', ' — ', CO), BVN: kycLabelAuthority('BVN', ' — ', CO), AML: 'AML screening',
  PEP: 'PEP screening', FRAUD: 'Fraud screening', LIVENESS: 'Selfie check',
};
export const CHECK_TONE: Record<string, Tone> = {
  passed: 'good', running: 'info', retrying: 'info', pending: 'idle', failed: 'crit', timeout: 'crit',
};

// Friendly label + colour per event topic, so the activity rail reads as a
// journey rather than a log of raw topic strings.
export const TOPIC_META: Record<string, { label: string; color: string }> = {
  'account-opening-requested': { label: 'Application', color: '#0091DA' },
  'nin-validation': { label: `${kycLabel('NIN', CO)} check`, color: '#7C6CF0' },
  'bvn-validation': { label: `${kycLabel('BVN', CO)} check`, color: '#2EA8C0' },
  'account-creation-requested': { label: 'Account requested', color: '#D97706' },
  'account-created': { label: 'Account created', color: '#16A34A' },
  'bulk-upload': { label: 'Bulk', color: '#C8A24A' },
  'exception-queue': { label: 'Exception', color: '#DC2626' },
  'customer-notification': { label: 'Customer notified', color: 'var(--brand-primary, #0033A1)' },
};

export type CaseTab = 'overview' | 'messages' | 'activity';


export function useCaseDetail(c: OnboardingCase, onClose: () => void) {
  /** Which hold the call should chase. The agent's script changes with it, so this
   *  must come from the case rather than default to documents. */
  const [kyc, setKyc] = useState(false);
  // false, or which tab of the call popup to open on: the outbound-call form,
  // or the record's call history.
  const [calling, setCalling] = useState<false | 'call' | 'calls'>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<CaseTab>('overview');
  const [picker, setPicker] = useState(false);
  // The captured record itself opens as a popup; the pane stays the operational view.
  const [details, setDetails] = useState(false);
  /** The tab Details opens on — set by the BVN/NIN buttons in Checks. */
  const [detailsTab, setDetailsTab] = useState<'bvn' | 'nin' | 'docs' | undefined>(undefined);
  // A record parked at its extraction gate can be reopened from here — the review
  // is the same task the Action Center app serves, reachable from the record too.
  const [reviewing, setReviewing] = useState(false);
  /** The package this record was captured from, when this browser kept it — its
   *  review is the package's own, not the single-form screen. */
  const [pkg, setPkg] = useState<PackageResult | null>(null);
  const [pkgBusy, setPkgBusy] = useState(false);
  const [pkgErr, setPkgErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPackage(c.id).then((p) => { if (alive) setPkg(p); });
    return () => { alive = false; };
  }, [c.id]);
  // Where the review was opened from, so closing it goes back there rather than
  // dismissing the details popup the reviewer was reading a moment ago.
  const [reviewFromDetails, setReviewFromDetails] = useState(false);
  // Declared up here with the other overlay flags: the Escape handler below reads
  // them all, and a state declared after it would be in the temporal dead zone.
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const awaiting = c.state === 'AWAITING_EXTRACTION';
  // Live link to the real Maestro case for this record.
  const [linked, setLinked] = useState<string | null>(() => getLinkedInstance(c.id));

  // Individual and corporate openings are two different Maestro cases in two
  // different Orchestrator folders, and every helper pins its own folder header.
  // Reading a corporate instance through the individual helpers returns 404s and
  // builds a deep link Maestro cannot resolve, so the record's type picks the set.
  const corporate = isCorporate(c);
  const fetchState = (id: string): Promise<LiveState> =>
    corporate ? getCorporateState(id) : getState(id);
  // Seed from the per-instance cache so a reopened case shows its last-known stage
  // at once. The cache is written by the individual poller, so it is only valid here.
  const seed = (i: string | null) => (!i ? null : corporate ? getCachedCorporateState(i) : getCachedState(i));
  const [mstate, setMstate] = useState<LiveState | null>(() => seed(getLinkedInstance(c.id)));
  const [mbusy, setMbusy] = useState(false);
  /** The approval currently in flight, held so the card can stay put while the
   *  case closes one stage and opens the next. Null whenever nothing is advancing. */
  const [advancing, setAdvancing] = useState<{ stage: string | null; title: string | null; taskId: number } | null>(null);
  // Whether the live case has answered *this session* for this record. Never
  // seeded from the cache: a cached state can predate a fix (or simply be stale),
  // and treating it as an answer is what let "nothing to do" paint first and then
  // reverse itself. A cache that already holds an approval still paints instantly,
  // because that arrives through `mstate`, not through this flag.
  const [mAsked, setMAsked] = useState(false);

  // Reset during render, not in an effect. An effect runs after paint, so the new
  // record got one frame carrying the PREVIOUS record's live state — long enough to
  // show someone else's "Approve Decision & advance" on the pane you just opened.
  const [stateFor, setStateFor] = useState(c.id);
  if (stateFor !== c.id) {
    const i = getLinkedInstance(c.id);
    setStateFor(c.id);
    setLinked(i);
    setMstate(seed(i));
    setMAsked(false);
    // Never carry an in-flight approval onto a different record.
    setAdvancing(null);
  }
  // Esc closes the detail pane — but only when the pane is the top layer. Each
  // overlay owns Escape while it is open, otherwise one press collapses the whole
  // stack and the reviewer loses the pane they were working in, not just the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (details || reviewing || picker || confirmDel) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, details, reviewing, picker, confirmDel]);
  // Data Fabric hydrate can land after mount (or a colleague may link this record on
  // another machine) — re-read the shared link when it changes so we flip to live.
  useEffect(() => {
    const onLinks = () => setLinked(getLinkedInstance(c.id));
    window.addEventListener(LINKS_EVENT, onLinks);
    return () => window.removeEventListener(LINKS_EVENT, onLinks);
  }, [c.id]);
  useEffect(() => {
    if (!linked) return;
    let alive = true;
    const tick = () => void fetchState(linked)
      .then((s) => { if (alive) { setMstate(s); setMAsked(true); } })
      .catch(() => { if (alive) setMAsked(true); });
    tick();
    const iv = setInterval(() => { if (!mstate?.done) tick(); }, 4000);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);

  const runMaestro = async () => {
    setMbusy(true);
    try {
      const id = await startCase({ applicantId: c.id, firstName: c.firstName, lastName: c.lastName, bvn: c.bvn, nin: c.nin, channel: c.channel });
      linkInstance(c.id, id); setLinked(id); setMstate(await getState(id));
    } catch (e) { setToast('Maestro: ' + (e as Error).message); window.setTimeout(() => setToast(null), 4000); }
    finally { setMbusy(false); }
  };
  const closeReview = () => {
    setReviewing(false);
    if (reviewFromDetails) { setDetails(true); setReviewFromDetails(false); }
  };

  /**
   * Confirming from the desk has to move the record, not just close the screen.
   * The Maestro task is completed by the review itself; this is the local half —
   * without it the record sits at AWAITING_EXTRACTION forever, still offering a
   * review whose task is already gone.
   */
  const acceptExtraction = async (rows: ReviewField[]) => {
    if (!corporate) {
      // An individual read. Mapping it as a company found no business name and
      // wrote the placeholder ("Individual application") straight back — so the
      // record stayed nameless with every field "Not captured".
      try {
        await store.update(c.id, { ...personFromRows(rows), state: 'PRE_REGISTERED' });
      } catch (e) {
        setToast('Saved in Maestro, but the record did not update: ' + (e as Error).message);
        window.setTimeout(() => setToast(null), 5000);
      }
      clearPendingExtraction();
      setReviewing(false);
      setReviewFromDetails(false);
      return;
    }
    const entity = entityFromRows(rows);
    const primary = entity.directors[0];
    try {
      await store.update(c.id, {
        entity,
        firstName: entity.companyName || c.firstName,
        lastName: '',
        phone: entity.phone || primary?.phone || c.phone,
        email: entity.email || primary?.email || c.email,
        bvn: primary?.bvn || c.bvn,
        address: entity.address || c.address,
        state: 'PRE_REGISTERED',
      });
    } catch (e) {
      setToast('Saved in Maestro, but the record did not update: ' + (e as Error).message);
      window.setTimeout(() => setToast(null), 5000);
    }
    clearPendingExtraction();
    setReviewing(false);
    setReviewFromDetails(false);
  };

  /** Local only. The Maestro case, any Action Center task and anything already
   *  created in Finacle are untouched — the dialog says so before this runs. */
  const deleteRecord = async () => {
    setDeleting(true);
    try {
      if (loadPendingExtraction(c.id)) clearPendingExtraction();
      unlinkInstance(c.id);
      await store.remove(c.id);
      onClose();
    } catch (e) {
      setToast('Could not delete: ' + (e as Error).message);
      window.setTimeout(() => setToast(null), 4000);
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  const approveMaestro = async () => {
    if (!linked || !mstate?.pendingTaskId) return;
    const doneId = mstate.pendingTaskId;
    setMbusy(true);
    // Snapshot what the card is showing right now. The optimistic clear below
    // empties the live actions, and without this the builder falls through to
    // "Nothing for you to do" until the next poll lands — a ~2s dip to the quiet
    // card between two "Working…" states. Holding the snapshot keeps the card
    // byte-identical while the case advances; only the button changes.
    setAdvancing({ stage: stageNow, title: mstate.pendingTitle, taskId: doneId });
    try {
      await (corporate ? approveCorporate(doneId) : approve(doneId));
      // Drop it from the card the moment the task is completed. Leaving the
      // approval on screen while the case catches up invites a second click on a
      // task that no longer exists — and reads as though nothing happened.
      setMstate((s) => (s ? { ...s, pendingTaskId: null, pendingTitle: null } : s));
      // Then chase the real answer in place rather than making anyone reload. The
      // case takes a few seconds to close the stage and open the next one.
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const fresh = await fetchState(linked);
        setMstate(fresh);
        setMAsked(true);
        if (fresh.pendingTaskId !== doneId) break;
      }
    }
    catch (e) { setToast('Approve failed: ' + (e as Error).message); window.setTimeout(() => setToast(null), 4000); }
    // Released together: the card must not drop the snapshot while the button is
    // still busy, or the dip reappears in the gap between the two.
    finally { setMbusy(false); setAdvancing(null); }
  };


  const m = stateMeta(c.state);
  // The recommendation shown on every record. When the live case is parked on a
  // human task, that approval IS the next best action, so it leads here with the
  // stage as its reason — rather than competing from the status card below.
  const stageNow = mstate?.activeStage ?? null;
  // Only once the live case has actually answered — otherwise the panel would
  // flip from seeded data to live data a second after opening.
  const liveChecks = linked && mAsked && mstate?.checks?.length ? mstate.checks : null;
  /** The live case is parked on its extraction review ("Confirm extracted
   *  details"). Individual records never reach AWAITING_EXTRACTION — that state is
   *  a corporate marker — so the case's own pending step is what says so. */
  /** The application's documents, judged against the Document rules DMN. */
  const docOutcome = documentsOutcome(documentsFor(c));
  const docsNeedPerson = (docOutcome === 'Refer' || docOutcome === 'Fail') && !c.documentReview;
  const reviewParked = Boolean(linked && !mstate?.done && mstate?.pendingTaskId && isReviewStep(mstate?.pendingTitle));
  // Built from either the live state or the in-flight snapshot, so the card is
  // identical in both — an approval mid-flight must not redraw the pane.
  const approvalCards = (stage: string | null, pendingTitle: string | null, taskId: number): Nba[] => [{
    id: 'maestro-approve',
    title: `Approve ${stage ?? 'the stage'} & advance`,
    why: `The case is parked at ${stage ?? 'this stage'} on "${pendingTitle ?? 'a human task'}". Approving here completes that task in Maestro and the case moves on.`,
    kind: 'do',
    primary: true,
    run: async () => { await approveMaestro(); return `${stage ?? 'Stage'} approved — the case is moving.`; },
    // Same approval, different queue — a route, not a fallback.
    alt: { label: 'Open in Action Center ↗', href: actionCenterUrl(taskId) },
  }, {
    // An actual fallback: what to do when you cannot approve it.
    id: 'maestro-blocked',
    title: `Call ${c.firstName || 'the customer'} before approving`,
    why: 'Approve only what you can stand behind. If the reviewer is waiting on something only the customer has, get it first — an approval you have to reverse costs more than the call.',
    // Was a tel: link, which handed the RM to their phone and lost the outcome.
    // Now it opens the voice agent in a panel beside the case, so the transcript
    // and what was agreed come back to the record.
    opens: 'call',
    kind: 'do',
  }];

  const actions: Nba[] = (() => {
    // An approval is in flight. Hold the card exactly as it was until the case
    // reports its next stage — the alternative is a dip through "Nothing for you
    // to do" while Maestro closes one stage and opens the next.
    if (linked && advancing) return approvalCards(advancing.stage, advancing.title, advancing.taskId);

    const base = nextBestActions(c);
    const live: Nba[] = [];
    // The case is on a call — or waiting for one. Both come straight off the
    // wait task the case is parked on, so the desk says so before anything else.
    const callWait = linked && !mstate?.done ? mstate?.callWait ?? null : null;
    if (callWait?.kind === 'due') {
      live.push({
        id: 'call-due',
        title: `Call ${c.firstName || 'the customer'} about the missing documents`,
        why: 'Your call is due. The case is parked at Pending customer on "Agent Conversation": the reviewer found documents missing and the customer needs to hear it from a person. The voice agent will verify them, explain what is missing and offer the secure upload link; the case carries on from what is agreed.',
        kind: 'do',
        primary: true,
        opens: 'call',
      });
    } else if (callWait?.kind === 'done') {
      live.push({
        id: 'agent-called',
        title: `Review the call — voice agent reached ${c.firstName || 'the customer'}`,
        why: `The voice agent called ${c.firstName || 'the customer'} when the case left ${callWait.stage ?? 'its stage'} (${CALL_PURPOSE_LABEL[callWait.purpose].toLowerCase()}), and they answered. The recording, transcript and notes are under Previous calls; the case has carried on.`,
        kind: 'do',
        primary: true,
        opens: 'call',
      });
    } else if (callWait?.kind === 'missed') {
      live.push({
        id: 'agent-missed',
        // The title is also the button, so it has to be the thing you do.
        title: `Call ${c.firstName || 'the customer'} — the voice agent got no answer`,
        why: `The voice agent called ${c.firstName || 'the customer'} when the case left ${callWait.stage ?? 'its stage'} (${CALL_PURPOSE_LABEL[callWait.purpose].toLowerCase()}), and the call rang out. Call them yourself, or let the agent retry; the case waits until someone gets through.`,
        kind: 'do',
        primary: true,
        opens: 'call',
      });
    } else if (callWait?.kind === 'failed') {
      live.push({
        id: 'agent-failed',
        title: `Call ${c.firstName || 'the customer'} — the voice agent's call failed`,
        why: `The case is parked at Pending customer. It tried to place the call itself and the connector refused it, so Maestro has an open incident on the step. Call ${c.firstName || 'the customer'} from here about the missing documents; the case carries on from what is agreed.`,
        kind: 'do',
        primary: true,
        opens: 'call',
      });
    } else if (callWait?.kind === 'agent') {
      live.push({
        id: 'agent-calling',
        title: `Listen in — voice agent calling ${c.firstName || 'the customer'}`,
        why: `Placed by the voice agent when the case left ${callWait.stage ?? 'its stage'} (${CALL_PURPOSE_LABEL[callWait.purpose].toLowerCase()}). Nothing for you to do: the case continues when the call ends, and the recording lands under Previous calls on this record.`,
        kind: 'do',
        primary: true,
        opens: 'call',
      });
    }
    // The extraction review is answered by the review screen (Accept + the
    // confirmed fields), never by a stage Approve — that completed the task with
    // no data, so the case moved on and the record stayed nameless.
    if (linked && mstate?.pendingTaskId && !mstate.done && !reviewParked) {
      live.push(...approvalCards(stageNow, mstate.pendingTitle, mstate.pendingTaskId));
    }
    // A document the rules referred or failed (BR-DOC-07) — a person decides.
    if (docsNeedPerson) {
      live.push({
        id: 'doc-review',
        title: docOutcome === 'Fail' ? 'A document failed its checks — review it' : 'Review the document checks',
        why: 'The Document rules referred this application to a person. Open the checks, then accept the documents or ask the customer for a new one.',
        kind: 'do',
        primary: !live.length,
        run: async () => { setDetailsTab('docs'); setDetails(true); return ''; },
      });
    }
    if ((awaiting || reviewParked) && linked) {
      live.push({
        id: 'open-review',
        title: 'Review what was read from the form',
        why: 'The case is holding at its extraction gate until someone confirms the values.',
        kind: 'do',
        primary: !live.length,
        run: async () => { setReviewing(true); return ''; },
      });
    }
    // ── One source of truth per case ──────────────────────────────────────
    // While a Maestro case is running this record, ONLY Maestro decides what to
    // do next. The state-based actions below it are driven by the record's own
    // validations, which the live case does not know about — so "Retry the NIN"
    // would sit under "Approve Decision", and take over the moment the approval
    // was granted. Two systems recommending different next steps for the same
    // case is worse than either one alone.
    if (linked && !mstate?.done) {
      if (live.length) return live;
      if (!mAsked) {
        return [{
          id: 'checking',
          title: 'Checking the live case…',
          why: 'Reading where the Maestro case is and whether it is waiting on anyone.',
          kind: 'wait',
        }];
      }
      return [{
        id: 'maestro-running',
        title: 'Nothing for you to do',
        why: stageNow
          ? `The case is running the ${stageNow} stage — automated steps are in flight. The next approval will surface here.`
          : 'The case is running. The next approval will surface here.',
        kind: 'wait',
      }];
    }
    // No live case (or it has finished): the record's own state is the guide.
    return base;
  })();
  const msgs = commsFor(c);
  const name = fullName(c).trim() || 'Unnamed applicant';

  /** Which hold the call should chase. The agent's script changes with it, so this
   *  comes off the case rather than defaulting to documents. */
  // How many calls the case has placed: each visit to Voice Agent (the
  // automated calls) or Pending customer (the RM's call) is one.
  const callsMade = (mstate?.secondaries ?? []).filter((x) => x.name === 'Voice Agent' || x.name === 'Pending customer').length;

  const callSubject = (): CallSubject => {
    // Straight off the case state, which is what the desk badge shows too.
    // A case parked on one of its own calls opens the popup on THAT call, so the
    // brief, the steps and the history all match the handset on the row.
    const cw = mstate?.callWait;
    const hold: CallSubject['hold'] = cw && cw.kind !== 'due' && cw.purpose !== 'documents' ? cw.purpose
      : cw?.kind === 'due' ? 'documents'
      : c.state === 'PENDING_LIVENESS'
      ? 'liveness'
      : (c.state === 'EDD_REVIEW' || c.state === 'AWAITING_EXTRACTION' ? 'review' : 'documents');
    return {
      reference: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'the customer',
      dob: c.dob || undefined,
      phone: c.phone || undefined,
      hold,
    };
  };

  const fire = async (a: Nba) => {
    if (a.opens === 'call') { setCalling('call'); return; }
    if (a.opens === 'kyc') { setKyc(true); return; }
    if (a.opens === 'channels') { setPicker(true); return; }
    if (a.href) { window.location.href = a.href; return; }
    if (!a.run) return;
    setBusy(a.id);
    try {
      const msg = await a.run();
      setToast(msg);
      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setBusy(null);
    }
  };

  // Re-send the KYC link on the chosen channels (multi-select from the dialog).
  // One tagged event per channel, so each lands in both the Activity log and the
  // Messages thread with its own channel logo.
  const sendKyc = async (chosen: MsgChannel[]) => {
    const labels = chosen.map((k) => CHANNEL_META[k].label).join(' & ');
    for (const ch of chosen) {
      const to = ch === 'email' ? c.email : c.phone;
      await store.publish(
        c.id, 'customer-notification',
        `KYC link re-sent by ${CHANNEL_META[ch].label}${to ? ` to ${to}` : ''}`,
        { resend: true, channel: ch },
      );
    }
    setPicker(false);
    setToast(`KYC link logged (${labels}) — not sent in this demo`);
    window.setTimeout(() => setToast(null), 2600);
  };

  return {
    c, onClose, name, m, details, setDetails, setDetailsTab, detailsTab, liveChecks, linked, awaiting, reviewParked, setReviewFromDetails, setReviewing, reviewing, pkg, pkgBusy, pkgErr, closeReview, setPkgBusy, setPkgErr, corporate, acceptExtraction, actions, mbusy, busy, fire, mstate, runMaestro, callsMade, setCalling, calling, tab, setTab, msgs, docOutcome, setConfirmDel, confirmDel, deleting, deleteRecord, picker, setPicker, sendKyc, callSubject, toast, setToast, kyc, setKyc, docsNeedPerson, stageNow, mAsked,
  };
}

export type CaseModel = ReturnType<typeof useCaseDetail>;
