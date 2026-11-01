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
import { useEffect, useState } from 'react';
import ApplicationDetails from './ApplicationDetails';
import PackageReview from '../../customer/PackageReview';
import { confirmPackageNow } from '../../integrations/packageCase';
import ExtractionReview, { type ReviewField } from '../../customer/ExtractionReview';
import { loadPendingExtraction, corporateMaestroUrl } from '../../onboarding/maestro-corporate';
import { fullName, CHANNEL_META, MSG_CHANNELS, VALIDATION_KINDS, type OnboardingCase, type MsgChannel } from '../../onboarding';
import { maestroReady, isReviewStep, instanceUrl, STAGES as MAESTRO_STAGES, type LiveState, CALL_PURPOSE_LABEL } from '../../onboarding/maestro';
import { ChannelIcon } from '../../onboarding/ChannelIcon';
import { CallIcon } from '../maestroStatus';
import Kyc from '../../customer/Kyc';
import type { Nba } from '../nba';
import CallPanel from '../CallPanel';
import { I, Tag } from '../ui';
import { ago } from '../time';
import { kycLabel } from '../../config/countries';
import { useCaseDetail, CO, TONE, CHECK_LABEL, CHECK_TONE, TOPIC_META } from './useCaseDetail';

export default function CaseDetail({ c, onClose }: { c: OnboardingCase; onClose: () => void }) {
  const { name, m, details, setDetails, setDetailsTab, detailsTab, liveChecks, linked, awaiting, reviewParked, setReviewFromDetails, setReviewing, reviewing, pkg, pkgBusy, pkgErr, closeReview, setPkgBusy, setPkgErr, corporate, acceptExtraction, actions, mbusy, busy, fire, mstate, runMaestro, callsMade, setCalling, calling, tab, setTab, msgs, docOutcome, setConfirmDel, confirmDel, deleting, deleteRecord, picker, setPicker, sendKyc, callSubject, toast, kyc, setKyc } = useCaseDetail(c, onClose);

  if (kyc) return <div className="dk-flow"><Kyc c={c} onExit={() => setKyc(false)} /></div>;

  return (
    <div className="dk-case">
      <div className="dk-case-head">
        <button className="x" onClick={onClose} aria-label="Close" title="Close (Esc)"><I n="x" s={17} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">{name}</div>
          <div className="rf num">{c.id} · opened {ago(c.createdAt)}</div>
        </div>
        <button className="dk-case-details" onClick={() => { setDetailsTab(undefined); setDetails(true); }}
          title="Everything captured on this application">Details</button>
        <Tag tone={TONE[m.tone] ?? 'idle'}>{m.label}</Tag>
      </div>
      {details && (
        <ApplicationDetails
          c={c}
          initialTab={detailsTab}
          checkStatus={Object.fromEntries((liveChecks ?? c.validations).map((x) => [x.kind, x.status]))}
          instanceId={linked}
          onReviewExtraction={(awaiting || reviewParked) && linked
            ? () => { setReviewFromDetails(true); setDetails(false); setReviewing(true); }
            : undefined}
          onClose={() => { setDetails(false); setDetailsTab(undefined); }}
        />
      )}
      {reviewing && linked && pkg && (
        <PackageReview res={pkg} mode="confirm" busy={pkgBusy} error={pkgErr}
          onClose={closeReview}
          onApply={async () => {
            setPkgBusy(true); setPkgErr(null);
            const err = await confirmPackageNow(linked, pkg.rows, corporate);
            setPkgBusy(false);
            if (err) { setPkgErr(err); return; }
            // The local half, exactly as a confirmed single-form review does it.
            await acceptExtraction(pkg.rows as unknown as ReviewField[]);
          }} />
      )}
      {reviewing && linked && !pkg && (
        <div className="dk-capture-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) closeReview(); }}>
          <div className="dk-capture cx" role="dialog" aria-modal="true" aria-label="Extraction review">
            {/* Scoped to this record: the slot holds one parked review at a time,
                and an entry belonging to another record must not lend its document
                to this one. */}
            <ExtractionReview
              // This pane serves both case types, and the extraction helpers are
              // folder-pinned — the default would send an individual instance to
              // the corporate folder and 404 on every read.
              corporate={corporate}
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

        {/* The record's calls. Once a case has moved past the stage that placed
            a call there is no next-best-action for it, so this is the standing
            way into the call history — the recording and transcript of every
            call the voice agent made on this application. */}
        {linked && !corporate && (() => {
          // While the voice agent is on the line the card turns red and glows,
          // and its button joins the call rather than opening the history.
          const onCall = !mstate?.done && mstate?.callWait?.kind === 'agent';
          return (
            <div className={`dk-nba dk-calls-card${onCall ? ' live' : ''}`}>
              <div className="hd"><span className="ic"><CallIcon kind={onCall ? 'agent' : 'done'} /></span><span>Voice agent</span>{onCall && <span className="dk-calls-live">On a call now</span>}</div>
              <div className="ttl">{onCall
                ? `Calling ${c.firstName || 'the customer'} — ${CALL_PURPOSE_LABEL[mstate!.callWait!.purpose].toLowerCase()}`
                : callsMade === 0 ? 'No calls on this case yet' : callsMade === 1 ? '1 call on this case' : `${callsMade} calls on this case`}</div>
              <p className="why">{onCall
                ? `The voice agent is speaking to the customer now. ${callsMade > 1 ? `${callsMade - 1} earlier call${callsMade > 2 ? 's' : ''} on this case are in the history.` : 'The recording lands in the call history when it ends.'}`
                : callsMade ? 'Every call the voice agent has placed for this application, with its recording and transcript.' : 'The case has not reached a stage that places a call.'}</p>
              <button className="dk-btn" onClick={() => setCalling(onCall ? 'call' : 'calls')}>{onCall ? 'Listen in' : 'Open call history'}</button>
            </div>
          );
        })()}

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
              {/* Always the full set, in a fixed order. The live case only reports
                  the checks it has REACHED — at Intake that is the duplicate/risk
                  pre-screen alone — so keying the list off it made the panel
                  collapse from six rows to one as soon as the case answered. The
                  set of checks a customer must pass doesn't change; only their
                  status does. A check the case hasn't run yet reads Pending rather
                  than borrowing the seeded record's answer, which would be the
                  contradiction this sync exists to remove. */}
              {VALIDATION_KINDS.map((k) => {
                const v = (liveChecks ?? c.validations).find((x) => x.kind === k);
                const st = v?.status ?? 'pending';
                const t = CHECK_TONE[st] ?? 'idle';
                // NIN and BVN carry a call worth seeing — what went to NIBSS/NIMC
                // and what came back. It lives on its own tab in Details, so the
                // pane stays a list of statuses.
                const tabFor = k === 'BVN' ? 'bvn' : k === 'NIN' ? 'nin' : undefined;
                return (
                  <div className="dk-check" key={k}>
                    <span className={`dk-dot ${t}${st === 'running' || st === 'retrying' ? ' live' : ''}`} />
                    <span className="l">{CHECK_LABEL[k]}</span>
                    <span className={`s ${t}`}>
                      {st === 'passed' ? 'Verified' : st === 'failed' ? 'Failed' : st === 'timeout' ? 'Timed out' : st === 'retrying' ? 'Retrying' : st === 'running' ? 'Running' : 'Pending'}
                      {v && v.attempts > 1 && (st === 'failed' || st === 'timeout') ? ` · ${v.attempts} attempts` : ''}
                    </span>
                    {tabFor && (
                      <button type="button" className="dk-check-open"
                              title={`See the ${k} request and response`}
                              onClick={() => { setDetailsTab(tabFor); setDetails(true); }}>
                        View
                      </button>
                    )}
                  </div>
                );
              })}
              {/* The documents themselves (BR-DOC-01…08) — judged against the
                  Document rules DMN, opened on its own tab in Details. */}
              {(() => {
                const t = docOutcome === 'Pass' ? 'good' : docOutcome === 'Quick review' ? 'info' : docOutcome === 'Refer' ? 'warn' : 'crit';
                const word = c.documentReview
                  ? (c.documentReview.decision === 'accepted' ? 'Accepted' : 'New document requested')
                  : docOutcome === 'Pass' ? 'Verified' : docOutcome;
                return (
                  <div className="dk-check">
                    <span className={`dk-dot ${c.documentReview ? 'good' : t}`} />
                    <span className="l">Document checks</span>
                    <span className={`s ${c.documentReview ? 'good' : t}`}>{word}</span>
                    <button type="button" className="dk-check-open" title="See every document check"
                            onClick={() => { setDetailsTab('docs'); setDetails(true); }}>View</button>
                  </div>
                );
              })()}
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
      {calling && <CallPanel subject={callSubject()} tab={calling} onClose={() => setCalling(false)} />}
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
  /** …and that human step is the extraction review, answered with the review screen. */
  const reviewing = awaiting && isReviewStep(state?.pendingTitle);
  return (
    <div className={`dk-nba ${done ? 'done' : 'do'} dk-nba-maestro`}>
      <div className="hd">
        <span className="ic"><I n={done ? 'check' : 'zap'} s={14} w={2.2} /></span>
        <span>Live in Maestro</span>
        {!done && state?.callWait && (
          <span className={`dk-mcall-card ${state.callWait.kind}`}>
            <CallIcon kind={state.callWait.kind} />
            {state.callWait.kind === 'agent' ? 'Voice agent calling'
              : state.callWait.kind === 'done' ? 'Voice agent · answered'
              : state.callWait.kind === 'missed' ? 'Voice agent · no answer'
              : state.callWait.kind === 'failed' ? 'Voice agent · call failed'
              : 'Your call is due'}
          </span>
        )}
        {/* The job read can be throttled while the case service still answers;
            a case with a known stage is running, whatever the job read said. */}
        <span className={`dk-nba-live ${done ? 'ok' : ''}`}>{done ? 'Completed' : state?.jobState && state.jobState !== 'Unknown' ? state.jobState : stage ? 'Running' : 'starting…'}</span>
      </div>

      <div className="ttl">
        {done ? 'Onboarding case completed'
          : state?.callWait?.kind === 'agent' ? `${stage ?? 'Case'} · voice agent calling`
          : state?.callWait?.kind === 'due' ? `${stage ?? 'Case'} · your call is due`
          : state?.callWait?.kind === 'done' ? `${stage ?? 'Case'} · voice agent reached the customer`
          : state?.callWait?.kind === 'missed' ? `${stage ?? 'Case'} · voice agent got no answer`
          : state?.callWait?.kind === 'failed' ? `${stage ?? 'Case'} · voice agent could not place the call`
          : stage ? `${stage} · ${reviewing ? 'awaiting review' : awaiting ? 'awaiting approval' : 'in progress'}` : 'Case running in Maestro'}
      </div>
      <p className="why">
        {done
          ? 'The real UiPath Maestro case ran through all five stages to completion.'
          : !stage
            ? 'A real Maestro instance is starting — its live stage will appear here.'
            : reviewing
              ? `The real Maestro case is holding at ${stage} for someone to confirm what was read from the form. Confirming the review advances the case.`
            : awaiting
              ? `The real Maestro case is parked at ${stage}. Approving here completes the stage in Maestro and advances the case.`
              : `The real Maestro case is running the ${stage} stage — automated checks are in flight. The next approval will surface here.`}
      </p>

      {/* Five columns, one per primary stage. A secondary stage the case is in
          sits UNDER the primary it left from, in its own colour, so "Pending
          customer" reads as a detour off Intake and "Voice Agent" as a detour
          off whichever stage sent it. It shows only while the case is inside it. */}
      <div className="dk-mstrip">
        {MAESTRO_STAGES.map((s) => {
          // While the case is inside a secondary, the primary it left from keeps
          // the dot — the case is still "in" Intake while it waits in Pending
          // customer — and the secondary sits under it with a dot of its own.
          // Only a secondary the case is INSIDE right now: where it has been is
          // history the row is not for, so a completed detour drops off when the
          // case returns to the main flow.
          const inside = (state?.secondaries ?? []).find((x) => x.status === 'active');
          const primaryNow = stage && (MAESTRO_STAGES as readonly string[]).includes(stage) ? stage : (inside?.origin ?? stage);
          const st = done || state?.completedStages.includes(s) ? 'done' : primaryNow === s ? 'active' : 'pend';
          const under = (state?.secondaries ?? []).filter((x) => x.status === 'active' && (x.origin ?? primaryNow) === s);
          return (
            <div className="dk-mcol" key={s}>
              <span className={`dk-mstage ${st}`}>{st === 'done' ? '✓ ' : st === 'active' ? '● ' : ''}{s}</span>
              {under.map((x, i) => (
                <span key={`${x.name}-${i}`} className={`dk-mstage sec ${done ? 'done' : x.status}`} title={`${x.name} — entered from ${s}`}>
                  {done || x.status === 'done' ? '✓ ' : '● '}{x.name}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* The stage bar says where the case is; this says what it is actually doing
          inside that stage, and whether the thing it is waiting on needs a person.
          Without it "Intake · in progress" can mean anything for an hour. */}
      {!done && (state?.stageTasks?.length ?? 0) > 0 && (
        <div className="dk-steps">
          <div className="dk-steps-h">In {state?.stageTasksStage ?? stage}</div>
          {state!.stageTasks!.map((t, i) => {
            const st = t.status === 'Completed' ? 'done'
              : t.status === 'InProgress' ? 'now'
              // The case service says 'Failed' for a step with an open incident.
              : t.status === 'Faulted' || t.status === 'Failed' ? 'bad' : 'next';
            return (
              <div className={`dk-step ${st}`} key={`${t.name}-${i}`}>
                <span className="pip" />
                <span className="nm">{t.name}</span>
                {t.kind === 'human' && st === 'now' && <span className="who">needs a person</span>}
                {st === 'bad' && <span className="who bad">failed · incident open</span>}
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
