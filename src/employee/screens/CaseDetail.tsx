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
import { store, stateMeta, fullName, commsFor, CHANNEL_META, MSG_CHANNELS, VALIDATION_KINDS, type OnboardingCase, type ValidationKind, type MsgChannel } from '../../onboarding';
import { maestroReady, startCase, getState, getCachedState, approve, instanceUrl, actionCenterUrl, getLinkedInstance, linkInstance, LINKS_EVENT, STAGES as MAESTRO_STAGES, type LiveState } from '../../onboarding/maestro';
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
  // Live link to the real Maestro case for this record.
  const [linked, setLinked] = useState<string | null>(() => getLinkedInstance(c.id));
  // Seed from the per-instance cache so a reopened case shows its last-known stage at once.
  const [mstate, setMstate] = useState<LiveState | null>(() => { const i = getLinkedInstance(c.id); return i ? getCachedState(i) : null; });
  const [mbusy, setMbusy] = useState(false);

  useEffect(() => { const i = getLinkedInstance(c.id); setLinked(i); setMstate(i ? getCachedState(i) : null); }, [c.id]);
  // Esc closes the detail pane.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
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
    const tick = () => void getState(linked).then((s) => { if (alive) setMstate(s); }).catch(() => {});
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
  const approveMaestro = async () => {
    if (!linked || !mstate?.pendingTaskId) return;
    setMbusy(true);
    try { await approve(mstate.pendingTaskId); await new Promise((r) => setTimeout(r, 1600)); setMstate(await getState(linked)); }
    catch (e) { setToast('Approve failed: ' + (e as Error).message); window.setTimeout(() => setToast(null), 4000); }
    finally { setMbusy(false); }
  };

  if (kyc) return <div className="dk-flow"><Kyc c={c} onExit={() => setKyc(false)} /></div>;

  const m = stateMeta(c.state);
  const actions = nextBestActions(c);
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
      {details && <ApplicationDetails c={c} onClose={() => setDetails(false)} />}

      <div className="dk-case-body">
        {/* The point of the pane: what to do, and why — always in view, above the tabs.
            When the record is linked to a real Maestro case, the action becomes the
            live stage approval that advances the real instance. */}
        {maestroReady() && linked
          ? <MaestroAction instanceId={linked} state={mstate} busy={mbusy} onApprove={approveMaestro} />
          : <>
              <Action actions={actions} busy={busy} onFire={fire} />
              {maestroReady() && <button className="dk-run-maestro" disabled={mbusy} onClick={runMaestro}>{mbusy ? 'Starting…' : '▶ Run this case in Maestro'}</button>}
            </>}

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

            <div className="dk-eyebrow" style={{ marginTop: c.accountNumber ? 18 : 2 }}>Checks</div>
            <div className="dk-checks">
              {VALIDATION_KINDS.map((k) => {
                const v = c.validations.find((x) => x.kind === k);
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
      </div>

      {picker && <ChannelPicker c={c} onCancel={() => setPicker(false)} onSend={sendKyc} />}
      {toast && <div className="dk-toast">{toast}</div>}
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
        <span>{quiet ? 'Status' : 'Next best action'}</span>
      </div>

      <div className="ttl">{first.title}</div>
      <p className="why">{first.why}</p>

      {!quiet && (
        <div className="acts">
          <button className="dk-btn pri lg" disabled={busy === first.id} onClick={() => onFire(first)}>
            {busy === first.id ? 'Working…' : first.title}
          </button>
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
function MaestroAction({ instanceId, state, busy, onApprove }: { instanceId: string; state: LiveState | null; busy: boolean; onApprove: () => void }) {
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

      {!done && state?.pendingTaskId && (
        <div className="dk-actask">
          <span className="dk-actask-ic"><I n="idcard" s={15} w={2} /></span>
          <div className="dk-actask-t">
            <b>{state.pendingTitle ?? 'Human task'}</b>
            <span>Action Center · app task · Unassigned</span>
          </div>
          <a className="dk-actask-open" href={actionCenterUrl(state.pendingTaskId)} target="_blank" rel="noreferrer">Open in Action Center ↗</a>
        </div>
      )}

      <div className="acts">
        {!done && state?.pendingTaskId && (
          <button className="dk-btn pri lg" disabled={busy} onClick={onApprove}>{busy ? 'Working…' : `Approve ${stage ?? 'stage'} & advance`}</button>
        )}
        <a className="dk-mlink" href={instanceUrl(instanceId)} target="_blank" rel="noreferrer">Open in Maestro ↗</a>
      </div>
    </div>
  );
}
