// ─────────────────────────────────────────────────────────────────────────────
// Case detail — the desk's right pane for an existing application.
//
// Replaces the customer's own tracker, which was being shown to staff: an RM was
// reading "YOUR application" and "your account number is ready" about somebody
// else, with no indication of what to do. This is the same case in the banker's
// voice, led by the next best action.
//
// (The capture wizard still shows the customer-facing screens — during capture
// the screen is turned toward the customer, which is exactly who they're for.)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import ApplicationDetails from './ApplicationDetails';
import ExtractionReview, { entityFromRows, type ReviewField } from '../../customer/ExtractionReview';
import { loadPendingExtraction, clearPendingExtraction, getCorporateState, getCachedCorporateState, approveCorporate, corporateMaestroUrl } from '../../onboarding/maestro-corporate';
import { store, stateMeta, fullName, isCorporate, commsFor, CHANNEL_META, MSG_CHANNELS, VALIDATION_KINDS, type OnboardingCase, type ValidationKind, type MsgChannel } from '../../onboarding';
import { maestroReady, startCase, getState, getCachedState, approve, instanceUrl, actionCenterUrl, getLinkedInstance, linkInstance, unlinkInstance, LINKS_EVENT, STAGES as MAESTRO_STAGES, type LiveState } from '../../onboarding/maestro';
import { ChannelIcon } from '../../onboarding/ChannelIcon';
import Kyc from '../../customer/Kyc';
import { nextBestActions, type Nba } from '../nba';
import { I, Tag, type Tone } from '../ui';
import { ago } from '../time';
import { getActiveCountry, kycLabel, kycLabelAuthority } from '../../config/countries';

const CO = getActiveCountry();
const TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };

const CHECK_LABEL: Record<ValidationKind, string> = {
  NIN: kycLabelAuthority('NIN', ' — ', CO), BVN: kycLabelAuthority('BVN', ' — ', CO), AML: 'AML screening',
  PEP: 'PEP screening', FRAUD: 'Fraud screening', LIVENESS: 'Selfie check',
};
const CHECK_TONE: Record<string, Tone> = {
  passed: 'good', running: 'info', retrying: 'info', pending: 'idle', failed: 'crit', timeout: 'crit',
};

// Friendly label + colour per event topic, so the activity rail reads as a
// journey rather than a log of raw topic strings.
const TOPIC_META: Record<string, { label: string; color: string }> = {
  'account-opening-requested': { label: 'Application', color: '#0091DA' },
  'nin-validation': { label: `${kycLabel('NIN', CO)} check`, color: '#7C6CF0' },
  'bvn-validation': { label: `${kycLabel('BVN', CO)} check`, color: '#2EA8C0' },
  'account-creation-requested': { label: 'Account requested', color: '#D97706' },
  'account-created': { label: 'Account created', color: '#16A34A' },
  'bulk-upload': { label: 'Bulk', color: '#C8A24A' },
  'exception-queue': { label: 'Exception', color: '#DC2626' },
  'customer-notification': { label: 'Customer notified', color: '#0033A1' },
};

type CaseTab = 'overview' | 'messages' | 'activity';

export default function CaseDetail({ c, onClose }: { c: OnboardingCase; onClose: () => void }) {
  const [kyc, setKyc] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<CaseTab>('overview');
  const [picker, setPicker] = useState(false);
  // The captured record itself opens as a popup; the pane stays the operational view.
  const [details, setDetails] = useState(false);
  // A record parked at its extraction gate can be reopened from here — the review
  // is the same task the Action Center app serves, reachable from the record too.
  const [reviewing, setReviewing] = useState(false);
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

  if (kyc) return <div className="dk-flow"><Kyc c={c} onExit={() => setKyc(false)} /></div>;

  const m = stateMeta(c.state);
  // The recommendation shown on every record. When the live case is parked on a
  // human task, that approval IS the next best action, so it leads here with the
  // stage as its reason — rather than competing from the status card below.
  const stageNow = mstate?.activeStage ?? null;
  // Only once the live case has actually answered — otherwise the panel would
  // flip from seeded data to live data a second after opening.
  const liveChecks = linked && mAsked && mstate?.checks?.length ? mstate.checks : null;
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
    href: c.phone ? `tel:${c.phone}` : undefined,
    kind: 'do',
  }];

  const actions: Nba[] = (() => {
    // An approval is in flight. Hold the card exactly as it was until the case
    // reports its next stage — the alternative is a dip through "Nothing for you
    // to do" while Maestro closes one stage and opens the next.
    if (linked && advancing) return approvalCards(advancing.stage, advancing.title, advancing.taskId);

    const base = nextBestActions(c);
    const live: Nba[] = [];
    if (linked && mstate?.pendingTaskId && !mstate.done) {
      live.push(...approvalCards(stageNow, mstate.pendingTitle, mstate.pendingTaskId));
    }
    if (awaiting && linked) {
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

  const fire = async (a: Nba) => {
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
    setToast(`KYC link sent by ${labels}`);
    window.setTimeout(() => setToast(null), 2600);
  };

  return (
    <div className="dk-case">
      <div className="dk-case-head">
        <button className="x" onClick={onClose} aria-label="Close" title="Close (Esc)"><I n="x" s={17} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">{name}</div>
          <div className="rf num">{c.id} · opened {ago(c.createdAt)}</div>
        </div>
        <button className="dk-case-details" onClick={() => setDetails(true)}
          title="Everything captured on this application">Details</button>
        <Tag tone={TONE[m.tone] ?? 'idle'}>{m.label}</Tag>
      </div>
      {details && (
        <ApplicationDetails
          c={c}
          instanceId={linked}
          onReviewExtraction={awaiting && linked
            ? () => { setReviewFromDetails(true); setDetails(false); setReviewing(true); }
            : undefined}
          onClose={() => setDetails(false)}
        />
      )}
      {reviewing && linked && (
        <div className="dk-capture-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) closeReview(); }}>
          <div className="dk-capture cx" role="dialog" aria-modal="true" aria-label="Extraction review">
            {/* Scoped to this record: the slot holds one parked review at a time,
                and an entry belonging to another record must not lend its document
                to this one. */}
            <ExtractionReview
              instanceId={loadPendingExtraction(c.id)?.instanceId ?? linked}
              // The record's own document outlives the parked slot, which is
              // cleared the moment the review is confirmed.
              attachmentId={loadPendingExtraction(c.id)?.attachmentId ?? c.documentId}
              documentName={loadPendingExtraction(c.id)?.documentName ?? c.documentName}
              // Accepting finishes the job the popup sent them to do, so it lands
              // back on the pane; closing without accepting returns to the popup.
              onAccepted={(rows) => { void acceptExtraction(rows); }}
              onClose={closeReview}
            />
          </div>
        </div>
      )}

      <div className="dk-case-body">
        {/* The point of the pane: what to do, and why — always in view, above the tabs.
            When the record is linked to a real Maestro case, the action becomes the
            live stage approval that advances the real instance. */}
        {/* The recommendation, on every record — never conditional on whether the
            case happens to be linked to Maestro. The live case sits below it as
            status, having handed its approve button up here. */}
        <Action actions={actions} busy={mbusy ? 'maestro-approve' : busy} onFire={fire} />
        {maestroReady() && linked && (
          <MaestroAction instanceId={linked} corporate={corporate} state={mstate} />
        )}
        {/* Only offered for individuals: startCase runs the individual case plan,
            which would be the wrong process for a business opening. */}
        {maestroReady() && !linked && !corporate && (
          <button className="dk-run-maestro" disabled={mbusy} onClick={runMaestro}>{mbusy ? 'Starting…' : '▶ Run this case in Maestro'}</button>
        )}

        <div className="dk-tabs" role="tablist">
          {(['overview', 'messages', 'activity'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'messages' ? 'Messages' : 'Activity'}
              {t === 'messages' && msgs.length > 0 && <span className="c">{msgs.length}</span>}
              {t === 'activity' && c.timeline.length > 0 && <span className="c">{c.timeline.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="dk-tabpanel">
            {c.accountNumber && (
              <div className="dk-acct">
                <div>
                  <span className="k">Account number</span>
                  <span className="v num">{c.accountNumber}</span>
                  {c.cif && <span className="c num">CIF {c.cif}</span>}
                </div>
                <span className="dk-tag green">Live</span>
              </div>
            )}

            {/* Live case → the checks IT ran. A linked record otherwise shows its own
                seeded validations, all "Pending", beside a case that cleared
                Verification twenty minutes ago. Same rule as the action card: while
                Maestro is running this record, Maestro is the source of truth. */}
            <div className="dk-eyebrow" style={{ marginTop: c.accountNumber ? 18 : 2 }}>
              Checks{liveChecks ? <span className="n">from the live case</span> : null}
            </div>
            <div className="dk-checks">
              {(liveChecks ? liveChecks.map((v) => v.kind) : VALIDATION_KINDS).map((k) => {
                const v = (liveChecks ?? c.validations).find((x) => x.kind === k);
                const st = v?.status ?? 'pending';
                const t = CHECK_TONE[st] ?? 'idle';
                return (
                  <div className="dk-check" key={k}>
                    <span className={`dk-dot ${t}${st === 'running' || st === 'retrying' ? ' live' : ''}`} />
                    <span className="l">{CHECK_LABEL[k]}</span>
                    <span className={`s ${t}`}>
                      {st === 'passed' ? 'Verified' : st === 'failed' ? 'Failed' : st === 'timeout' ? 'Timed out' : st === 'retrying' ? 'Retrying' : st === 'running' ? 'Running' : 'Pending'}
                      {v && v.attempts > 1 && (st === 'failed' || st === 'timeout') ? ` · ${v.attempts} attempts` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="dk-eyebrow" style={{ marginTop: 18 }}>Contact</div>
            <div className="dk-kv">
              {c.phone && <div><span>Phone</span><a className="num" href={`tel:${c.phone}`}>{c.phone}</a></div>}
              {c.email && <div><span>Email</span><a href={`mailto:${c.email}`}>{c.email}</a></div>}
              {c.bvn && <div><span>{kycLabel('BVN', CO)}</span><b className="num">{c.bvn}</b></div>}
              {c.nin && <div><span>{kycLabel('NIN', CO)}</span><b className="num">{c.nin}</b></div>}
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div className="dk-tabpanel">
            <div className="dk-msgs">
              {/* Newest first, like the Activity feed (the /comms console keeps
                  chat order — newest at the bottom — which is correct there). */}
              {msgs.slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map((msg) => (
                <div className="dk-msg" key={msg.id}>
                  <span className={`dk-msg-ch ${msg.channel}`}><ChannelIcon ch={msg.channel} size={13} />{CHANNEL_META[msg.channel].label}</span>
                  <span className="dk-msg-b">
                    <span className="l">{msg.label}<em className="num">{ago(msg.at)}</em></span>
                    <span className="body">{msg.body}</span>
                    <span className={`del ${msg.delivery}`}>{msg.delivery === 'delivered' ? '✓✓ Delivered' : '✓ Sent'} · to {msg.to}</span>
                  </span>
                </div>
              ))}
              {!msgs.length && <div className="dk-empty" style={{ padding: '24px 14px' }}><b>No messages yet</b><span>The customer hasn&rsquo;t been contacted on this application.</span></div>}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="dk-tabpanel">
            {c.timeline.length ? (
              <div className="dk-tl2">
                {c.timeline.map((e) => {
                  const tm = TOPIC_META[e.topic] ?? { label: e.topic, color: 'var(--d-ink-4)' };
                  return (
                    <div className="dk-tl2-i" key={e.id}>
                      <span className="rail"><span className="dot" style={{ background: tm.color }} /></span>
                      <div className="ct">
                        <div className="msg">{e.message}</div>
                        <div className="meta">
                          <span className="tp" style={{ color: tm.color, background: `color-mix(in srgb, ${tm.color} 12%, #fff)` }}>{tm.label}</span>
                          <span className="at num">{ago(e.at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dk-empty" style={{ padding: '24px 14px' }}><b>Nothing recorded yet</b><span>Events appear here as the application moves.</span></div>
            )}
          </div>
        )}

        {/* Last thing in the pane, and visually apart from the workflow actions —
            it is not a step in the process, it is the way out of one. */}
        <div className="dk-danger">
          <div>
            <b>Delete this record</b>
            <span>Removes it from the desk. Nothing it has already started is undone.</span>
          </div>
          <button className="dk-btn danger" onClick={() => setConfirmDel(true)}>Delete</button>
        </div>
      </div>

      {confirmDel && (
        <DeleteRecord
          c={c}
          liveInstance={linked && !mstate?.done ? linked : null}
          instanceHref={linked ? (corporate ? corporateMaestroUrl : instanceUrl)(linked) : null}
          parkedReview={Boolean(loadPendingExtraction(c.id))}
          busy={deleting}
          onCancel={() => setConfirmDel(false)}
          onConfirm={deleteRecord}
        />
      )}
      {picker && <ChannelPicker c={c} onCancel={() => setPicker(false)} onSend={sendKyc} />}
      {toast && <div className="dk-toast">{toast}</div>}
    </div>
  );
}

/**
 * Delete confirmation.
 *
 * Deleting is local: it removes the row and its events, and nothing else. The
 * warnings are therefore not decoration — they are the difference between what
 * a banker assumes "delete" does and what it does. Only consequences this record
 * actually carries are listed, so the dialog stays worth reading.
 */
function DeleteRecord({ c, liveInstance, instanceHref, parkedReview, busy, onCancel, onConfirm }: {
  c: OnboardingCase;
  liveInstance: string | null;
  instanceHref: string | null;
  parkedReview: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  const who = fullName(c).trim() || c.entity?.companyName || c.id;
  const warnings: { key: string; text: React.ReactNode }[] = [];
  if (liveInstance) {
    warnings.push({
      key: 'maestro',
      text: <>The Maestro case <b>keeps running</b>. Deleting the record here does not stop or cancel it{instanceHref
        ? <> — <a href={instanceHref} target="_blank" rel="noreferrer">open it in Maestro</a> if you want to cancel it there</>
        : null}.</>,
    });
  }
  if (parkedReview) {
    warnings.push({ key: 'review', text: <>The parked extraction review is discarded. The task itself stays open in Action Center.</> });
  }
  if (c.accountNumber) {
    warnings.push({
      key: 'acct',
      text: <>Account <b className="num">{c.accountNumber}</b> already exists in the core banking system. Deleting this record does not close it.</>,
    });
  }
  if (c.cif && !c.accountNumber) {
    warnings.push({ key: 'cif', text: <>A CIF (<b className="num">{c.cif}</b>) already exists for this customer and is not removed.</> });
  }

  return (
    <div className="dk-modal-back" onClick={() => !busy && onCancel()}>
      <div className="dk-modal" role="alertdialog" aria-label="Delete this record" onClick={(e) => e.stopPropagation()}>
        <h3>Delete {who}?</h3>
        <div className="sub">{c.id} · this cannot be undone.</div>

        {warnings.length > 0 && (
          <ul className="dk-warns">
            {warnings.map((w) => (
              <li key={w.key}><span className="ic"><I n="alert" s={13} w={2.2} /></span><span>{w.text}</span></li>
            ))}
          </ul>
        )}

        <div className="dk-modal-acts">
          <button className="dk-btn" disabled={busy} onClick={onCancel}>Keep it</button>
          <button className="dk-btn danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Deleting…' : 'Delete record'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelPicker({ c, onCancel, onSend }: { c: OnboardingCase; onCancel: () => void; onSend: (chosen: MsgChannel[]) => void }) {
  const target = (ch: MsgChannel) => (ch === 'email' ? c.email : c.phone) || '';
  // Default to the two mobile channels the customer can tap on their phone.
  const [sel, setSel] = useState<Set<MsgChannel>>(() => new Set(MSG_CHANNELS.filter((k) => k !== 'email' && target(k))));
  const toggle = (k: MsgChannel) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const chosen = MSG_CHANNELS.filter((k) => sel.has(k));

  return (
    <div className="dk-modal-back" onClick={onCancel}>
      <div className="dk-modal" role="dialog" aria-label="Send the KYC link" onClick={(e) => e.stopPropagation()}>
        <h3>Send the KYC link</h3>
        <div className="sub">Choose how to reach {c.firstName || 'the customer'}. You can pick more than one.</div>

        <div className="dk-ch-opts">
          {MSG_CHANNELS.map((k) => {
            const to = target(k);
            const on = sel.has(k);
            return (
              <button key={k} type="button" className="dk-ch-opt" aria-pressed={on} disabled={!to} onClick={() => toggle(k)}>
                <span className={`ic ${k}`}><ChannelIcon ch={k} size={17} /></span>
                <span className="t">
                  <b>{CHANNEL_META[k].label}</b>
                  <span className="num">{to || 'not on file'}</span>
                </span>
                <span className="chk"><I n="check" s={13} w={3} /></span>
              </button>
            );
          })}
        </div>

        <div className="dk-modal-acts">
          <button className="dk-btn" onClick={onCancel}>Cancel</button>
          <button className="dk-btn pri" disabled={!chosen.length} onClick={() => onSend(chosen)}>
            Send link{chosen.length > 1 ? ` · ${chosen.length} channels` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function Action({ actions, busy, onFire }: { actions: Nba[]; busy: string | null; onFire: (a: Nba) => void }) {
  const [first, ...rest] = actions;
  if (!first) return null;
  const quiet = first.kind !== 'do';

  return (
    <div className={`dk-nba ${first.kind}`}>
      <div className="hd">
        <span className="ic">
          <I n={first.kind === 'do' ? 'zap' : first.kind === 'done' ? 'check' : 'clock'} s={14} w={2.2} />
        </span>
        {/* Always name the box. Relabelling it "Status" in the quiet state left a
            card that said "Nothing for you to do" with nothing to say what it was
            about — the reader had to infer both the subject and the verdict. The
            heading stays constant; the icon, tone and title carry the state. */}
        <span>Next best action</span>
      </div>

      <div className="ttl">{first.title}</div>
      <p className="why">{first.why}</p>

      {!quiet && (
        <div className="acts">
          <button className="dk-btn pri lg" disabled={busy === first.id} onClick={() => onFire(first)}>
            {busy === first.id ? 'Working…' : first.title}
          </button>
          {first.alt && (
            <a className="dk-nba-alt" href={first.alt.href} target="_blank" rel="noreferrer">{first.alt.label}</a>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="alt">
          <div className="alt-h">If that doesn&rsquo;t work</div>
          {rest.map((a) => (
            <button key={a.id} className="alt-i" disabled={busy === a.id} onClick={() => onFire(a)}>
              <span className="t">
                <b>{busy === a.id ? 'Working…' : a.title}</b>
                <span>{a.why}</span>
              </span>
              <I n="chevron" s={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// When the record is linked to a real Maestro case, the action panel becomes the
// live stage approval — completing it advances the actual instance in Maestro.
/** The live case, as status. Its approve button moved into the action card above —
 *  two cards each with a filled button made the pane argue with itself about what
 *  to press. This says where the case is; that says what to do about it. */
function MaestroAction({ instanceId, corporate, state }: { instanceId: string; corporate: boolean; state: LiveState | null }) {
  const done = Boolean(state?.done);
  const stage = state?.activeStage ?? null;
  const awaiting = Boolean(state?.pendingTaskId);   // human approval pending at this stage
  return (
    <div className={`dk-nba ${done ? 'done' : 'do'} dk-nba-maestro`}>
      <div className="hd">
        <span className="ic"><I n={done ? 'check' : 'zap'} s={14} w={2.2} /></span>
        <span>Live in Maestro</span>
        <span className={`dk-nba-live ${done ? 'ok' : ''}`}>{done ? 'Completed' : state?.jobState ?? 'starting…'}</span>
      </div>

      <div className="ttl">
        {done ? 'Onboarding case completed' : stage ? `${stage} · ${awaiting ? 'awaiting approval' : 'in progress'}` : 'Case running in Maestro'}
      </div>
      <p className="why">
        {done
          ? 'The real UiPath Maestro case ran through all five stages to completion.'
          : !stage
            ? 'A real Maestro instance is starting — its live stage will appear here.'
            : awaiting
              ? `The real Maestro case is parked at ${stage}. Approving here completes the stage in Maestro and advances the case.`
              : `The real Maestro case is running the ${stage} stage — automated checks are in flight. The next approval will surface here.`}
      </p>

      <div className="dk-mstrip">
        {MAESTRO_STAGES.map((s) => {
          const st = done || state?.completedStages.includes(s) ? 'done' : stage === s ? 'active' : 'pend';
          return <span key={s} className={`dk-mstage ${st}`}>{st === 'done' ? '✓ ' : st === 'active' ? '● ' : ''}{s}</span>;
        })}
      </div>

      {/* The stage bar says where the case is; this says what it is actually doing
          inside that stage, and whether the thing it is waiting on needs a person.
          Without it "Intake · in progress" can mean anything for an hour. */}
      {!done && (state?.stageTasks?.length ?? 0) > 0 && (
        <div className="dk-steps">
          <div className="dk-steps-h">In {stage}</div>
          {state!.stageTasks!.map((t, i) => {
            const st = t.status === 'Completed' ? 'done'
              : t.status === 'InProgress' ? 'now'
              : t.status === 'Faulted' ? 'bad' : 'next';
            return (
              <div className={`dk-step ${st}`} key={`${t.name}-${i}`}>
                <span className="pip" />
                <span className="nm">{t.name}</span>
                {t.kind === 'human' && st === 'now' && <span className="who">needs a person</span>}
                {st === 'now' && t.link && (
                  <a href={t.link} target="_blank" rel="noreferrer" className="go">Open ↗</a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="acts">
        <a className="dk-mlink" href={(corporate ? corporateMaestroUrl : instanceUrl)(instanceId)} target="_blank" rel="noreferrer">Open in Maestro ↗</a>
      </div>
    </div>
  );
}
