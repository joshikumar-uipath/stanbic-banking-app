// ─────────────────────────────────────────────────────────────────────────────
// One customer's application, as a story.
//
//   Who        — a contact card: face, name, status in words, and the four
//                things you do with a person (call, message, email, details).
//   Where      — the five-step journey, live from Maestro when it is running.
//   What next  — the next best action in plain words, its button docked under
//                the thumb. Everything else is one "More" away.
//
// Behaviour is the desk's own case model (screens/useCaseDetail): the same
// Maestro polling, approvals, voice-agent call, KYC resend and delete.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { CHANNEL_META, MSG_CHANNELS, VALIDATION_KINDS, isCorporate, type OnboardingCase, type MsgChannel } from '../../../onboarding';
import { maestroReady, instanceUrl, STAGES as MAESTRO_STAGES } from '../../../onboarding/maestro';
import { loadPendingExtraction, corporateMaestroUrl } from '../../../onboarding/maestro-corporate';
import { ChannelIcon } from '../../../onboarding/ChannelIcon';
import { confirmPackageNow } from '../../../integrations/packageCase';
import PackageReview from '../../../customer/PackageReview';
import ExtractionReview, { type ReviewField } from '../../../customer/ExtractionReview';
import Kyc from '../../../customer/Kyc';
import CallPanel from '../../CallPanel';
import { useCaseDetail, TOPIC_META, type CaseModel } from '../../screens/useCaseDetail';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NStatus, NButton, NQuick, NNavButton, NSheet, NActions, NToggle, NToast, NEmpty, Glyph } from '../nkit';
import { nuban } from '../alertsModel';
import { telHref, mailHref } from '../links';
import { useNk, C, haptic } from '../nk';
import { storyOf, name, JOURNEY } from '../story';
import { ago } from '../../time';

export default function CaseScreen({ id }: { id: string }) {
  const nav = useNav();
  const c = useWorkData().byId(id);
  if (!c) {
    return (
      <NScreen title="Application" onBack={nav.pop} large={false}>
        <NEmpty icon="doc" title="This application is gone" color={C.gray}>It was deleted, or it belongs to another browser’s demo data.</NEmpty>
      </NScreen>
    );
  }
  return <Story c={c} />;
}

const CHECK_SHORT: Record<string, string> = { NIN: 'NIN', BVN: 'BVN', AML: 'AML', PEP: 'PEP', FRAUD: 'Fraud', LIVENESS: 'Selfie' };

function Story({ c }: { c: OnboardingCase }) {
  const nav = useNav();
  const nk = useNk();
  const m = useCaseDetail(c, nav.pop);
  const s = storyOf(c);
  const [more, setMore] = useState(false);
  const [why, setWhy] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [messages, setMessages] = useState(false);
  const corporate = isCorporate(c);

  // The desk opens the applicant record as a popup; here it is a pushed screen.
  useEffect(() => {
    if (!m.details) return;
    nav.push({ k: 'applicant', id: c.id, tab: m.detailsTab === 'docs' ? 'documents' : m.detailsTab ? 'identity' : 'profile' });
    m.setDetails(false);
    m.setDetailsTab(undefined);
  }, [m.details, m.detailsTab, c.id, nav, m]);

  const [first, ...rest] = m.actions;
  const doing = first?.kind === 'do';
  const busy = (a?: { id: string }) => !!a && (m.busy === a.id || (m.mbusy && a.id === 'maestro-approve'));

  // Journey: Maestro's own five stages when the case is live, else the record's.
  const live = Boolean(m.linked && m.mstate);
  const stages: readonly string[] = live ? MAESTRO_STAGES : JOURNEY;
  const done = live ? Boolean(m.mstate?.done) : c.state === 'FULLY_ACTIVATED';
  const at = live
    ? Math.max(0, MAESTRO_STAGES.indexOf((m.mstate?.activeStage ?? 'Intake') as (typeof MAESTRO_STAGES)[number]))
    : s.step;
  const waiting = live ? Boolean(m.mstate?.pendingTaskId) : s.lane === 'you';

  const call = () => {
    if (m.linked && !corporate) m.setCalling('call');
    else if (telHref(c.phone)) window.location.href = telHref(c.phone)!;
  };

  const moreActions = [
    ...rest.filter((a) => a.kind === 'do').map((a) => ({ label: a.title, icon: 'zap', run: () => void m.fire(a) })),
    ...(first?.alt ? [{ label: first.alt.label.replace(/\s*↗$/, ''), icon: 'open', run: () => window.open(first.alt!.href, '_blank', 'noreferrer') }] : []),
    { label: 'Send the KYC link', icon: 'sms', run: () => m.setPicker(true) },
    ...(m.linked ? [{ label: 'Open in Maestro', icon: 'open', run: () => window.open((corporate ? corporateMaestroUrl : instanceUrl)(m.linked!), '_blank', 'noreferrer') }] : []),
    ...(nav.role === 'rm' && maestroReady() && !m.linked && !corporate ? [{ label: 'Run this case in Maestro', icon: 'zap', run: () => void m.runMaestro() }] : []),
    ...(m.linked && !corporate ? [{ label: 'Voice-agent call history', icon: 'history', run: () => m.setCalling('calls') }] : []),
    { label: 'Everything captured', icon: 'user', run: () => nav.push({ k: 'applicant', id: c.id }) },
    // Only the person who captured it (the RM) can delete an application.
    ...(nav.role === 'rm' ? [{ label: 'Delete this record', icon: 'trash', danger: true, run: () => m.setConfirmDel(true) }] : []),
  ];

  const onCall = !m.mstate?.done && m.mstate?.callWait?.kind === 'agent';

  const checks = VALIDATION_KINDS.map((k) => {
    const v = (m.liveChecks ?? c.validations).find((x) => x.kind === k);
    const st = v?.status ?? 'pending';
    const col = st === 'passed' ? C.green : st === 'failed' || st === 'timeout' ? C.red : st === 'running' || st === 'retrying' ? C.blue : nk.ink3;
    const label = st === 'passed' ? 'Passed' : st === 'failed' ? `Failed${v && v.attempts > 1 ? ` · ${v.attempts}` : ''}` : st === 'timeout' ? 'Timed out' : st === 'running' || st === 'retrying' ? 'Running' : 'Pending';
    return { k, st, col, label };
  });
  const passed = checks.filter((x) => x.st === 'passed').length;
  const docCol = c.documentReview || m.docOutcome === 'Pass' ? C.green : m.docOutcome === 'Quick review' ? C.blue : m.docOutcome === 'Refer' ? C.orange : C.red;
  const nowColor = waiting ? C.red : C.blue;
  // When Maestro is running the case, say what Maestro is waiting on — the
  // record's own checks can lag behind the live case.
  const humanTask = live && !m.mstate?.done ? m.mstate?.stageTasks?.find((t) => t.kind === 'human' && t.status === 'InProgress') : undefined;
  const statement = humanTask
    ? `Waiting on “${humanTask.name}” at ${m.mstate?.activeStage ?? 'this stage'} — a person has to act.`
    : live && m.mstate?.done ? 'The live case has finished.'
    : s.sentence;

  return (
    <>
      <NScreen title={name(c)} onBack={nav.pop}
        actions={<NNavButton icon="more" label="More actions" onClick={() => setMore(true)} />}
        footer={doing && first ? (
          <>
            {first.why && <p className="nk-footer-why" style={{ color: nk.ink2 }}><b style={{ color: nk.ink }}>Why this first.</b> {first.why.length > 140 ? `${first.why.slice(0, 137).trimEnd()}…` : first.why}</p>}
            <NButton icon={/^(retry|re-run|rerun)/i.test(first.title) ? 'refresh' : undefined} disabled={busy(first)} onClick={() => void m.fire(first)}>{busy(first) ? 'Working…' : first.title}</NButton>
          </>
        ) : undefined}>

        {/* Who */}
        <div className="mw-meta" style={{ color: nk.ink2 }}>
          <span><span className="mono" style={{ fontSize: 13, color: nk.ink }}>{c.id}</span> · {c.accountType ?? (corporate ? 'Business' : 'Individual')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <NStatus color={s.color}>{s.label}</NStatus>
            <span>· opened {ago(c.createdAt)}</span>
            {c.phone && <span className="mono" style={{ fontSize: 13 }}>· {c.phone}</span>}
          </span>
        </div>
        <div className="mw-quicks" style={{ borderColor: nk.sep }}>
          <NQuick icon="phone" label={onCall ? 'Listen in' : 'Call'} onClick={call} disabled={!c.phone && !(m.linked && !corporate)} />
          <NQuick icon="sms" label="Send link" onClick={() => m.setPicker(true)} />
          <NQuick icon="mail" label="Email" href={mailHref(c.email)} disabled={!mailHref(c.email)} />
          <NQuick icon="doc" label="Documents" onClick={() => nav.push({ k: 'applicant', id: c.id, tab: 'documents' })} />
        </div>

        {/* Where */}
        <NSection title={live ? 'Live in Maestro' : 'Journey'}
          aside={live
            ? <span className="mw-live" style={{ color: C.green }}><i style={{ background: C.green }} />{m.mstate?.done ? 'Completed' : m.mstate?.jobState ?? 'Starting'}</span>
            : <span className="mono">Step {Math.min(stages.length, at + 1)} of {stages.length}</span>}>
          <div className="mw-ruler" aria-label={`Step ${at + 1} of ${stages.length}: ${stages[at]}`}>
            <span className="mw-ruler-track" style={{ background: nk.sep }} />
            <span className="mw-ruler-fill" style={{ width: done ? '100%' : `${(at / stages.length) * 100 + 100 / stages.length / 2}%`, background: nk.brandFill }} />
            {stages.map((st, i) => {
              const isDone = done || i < at || (live && m.mstate?.completedStages.includes(st));
              const now = !done && i === at;
              const left = `${((i + 0.5) / stages.length) * 100}%`;
              return now
                ? <span key={st} className="mw-ruler-now" style={{ left, background: nowColor }} />
                : <span key={st} className="mw-ruler-tick" style={{ left, background: isDone ? nk.brandFill : nk.ink3 }} />;
            })}
          </div>
          <div className="mw-ruler-labels" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
            {stages.map((st, i) => {
              const isDone = done || i < at || (live && !!m.mstate?.completedStages.includes(st));
              const now = !done && i === at;
              return (
                <span key={st} style={{ color: now ? nowColor : isDone ? nk.accent : nk.ink3, fontWeight: now ? 600 : isDone ? 500 : 400 }}>
{st}
                </span>
              );
            })}
          </div>
          {live && !m.mstate?.done && (m.mstate?.stageTasks?.length ?? 0) > 0 && (
            <div className="mw-tasks">
              {m.mstate!.stageTasks!.map((t, i) => {
                const st = t.status === 'Completed' ? C.green : t.status === 'InProgress' ? (t.kind === 'human' ? C.red : C.blue) : t.status === 'Faulted' ? C.red : nk.ink3;
                return (
                  <div key={`${t.name}-${i}`} className="mw-task" style={{ color: t.status === 'Completed' ? nk.ink2 : nk.ink }}>
                    <Glyph color={st} />{t.name}
                    {t.kind === 'human' && t.status === 'InProgress' && <b style={{ color: C.red }}>needs a person</b>}
                  </div>
                );
              })}
            </div>
          )}
        </NSection>

        <p className="mw-statement">{statement}</p>

        {/* What next, when it isn't yours to do (while the live case is still
            being read, a quiet line — not a placeholder posing as the answer). */}
        {first?.id === 'checking' ? (
          <div className="mw-reading" style={{ color: nk.ink2, marginTop: -14 }}><span className="mw-spin" />Looking up the live Maestro case…</div>
        ) : first && !doing && (
          <NSection title={first.kind === 'done' ? 'Done' : 'Next step'}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{first.title}</div>
            <p className={`mw-next-w${why ? ' open' : ''}`} style={{ color: nk.ink2 }} onClick={() => setWhy((v) => !v)}>{first.why}</p>
            {first.alt && <div><NButton kind="secondary" small full={false} icon="open" href={first.alt.href}>{first.alt.label.replace(/\s*↗$/, '')}</NButton></div>}
          </NSection>
        )}
        {rest.some((a) => a.kind === 'do') && (
          <NSection title="If that doesn’t work">
            <NGroup>
              {rest.filter((a) => a.kind === 'do').map((a) => (
                <NRow key={a.id} icon={{ name: a.opens === 'call' ? 'phone' : 'zap', color: nk.accent }}
                  title={busy(a) ? 'Working…' : a.title} subtitle={a.why} onClick={() => void m.fire(a)} />
              ))}
            </NGroup>
          </NSection>
        )}

        {c.accountNumber && (
          <NSection title="Account">
            <div className="mw-acct" style={{ borderColor: nk.sep }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mw-acct-n mono">{nuban(c.accountNumber)}</div>
                <div style={{ fontSize: 13, color: nk.ink2 }}>{c.accountType ?? 'Account'}{c.cif ? <> · CIF <span className="mono">{c.cif}</span></> : null}</div>
              </div>
              <NButton small kind="secondary" full={false} icon="copy" onClick={() => { void navigator.clipboard?.writeText(c.accountNumber ?? '').catch(() => {}); haptic('success'); }}>Copy</NButton>
            </div>
          </NSection>
        )}

        {/* Checks — a glance, then the detail one tap away */}
        <NSection title="Checks" aside={<span className="mono">{passed} of {checks.length} passed</span>} footer={m.liveChecks ? 'From the live Maestro case.' : undefined}>
          <div className="mw-checks" style={{ ['--sep' as string]: nk.sep }}>
            {checks.map(({ k, col, label }) => {
              const tap = k === 'NIN' || k === 'BVN';
              return (
                <button key={k} type="button" className="mw-check tap" disabled={!tap} style={{ color: nk.ink, borderColor: nk.sep }}
                  onClick={tap ? () => { haptic(); nav.push({ k: 'applicant', id: c.id, tab: 'identity' }); } : undefined}>
                  <span>{CHECK_SHORT[k]}</span>
                  <span style={{ color: col, fontWeight: col === C.red ? 600 : 400 }}>{label}</span>
                </button>
              );
            })}
            <button type="button" className="mw-check tap" style={{ color: nk.ink, borderColor: nk.sep }} onClick={() => { haptic(); nav.push({ k: 'applicant', id: c.id, tab: 'documents' }); }}>
              <span>Documents</span>
              <span style={{ color: docCol }}>{c.documentReview ? 'Accepted' : m.docOutcome === 'Pass' ? 'Passed' : m.docOutcome}</span>
            </button>
          </div>
        </NSection>

        {/* History */}
        <NSection title="Recent activity" action={c.timeline.length > 4 ? { label: 'See all', onClick: () => setTimeline(true) } : undefined}>
          <NGroup>
            {c.timeline.slice(0, 4).map((e) => {
              const tm = TOPIC_META[e.topic] ?? { label: e.topic, color: C.gray };
              return <NRow key={e.id} title={e.message} subtitle={tm.label} value={<span className="mono" style={{ fontSize: 12, color: nk.ink3 }}>{ago(e.at)}</span>} />;
            })}
            {!c.timeline.length && <NRow title="Nothing recorded yet" subtitle="Events appear as the application moves." />}
            {m.msgs.length > 0 && (
              <NRow icon={{ name: 'chat', color: nk.accent }} title="Messages to the customer" value={<span className="mono">{m.msgs.length}</span>} onClick={() => setMessages(true)} />
            )}
          </NGroup>
        </NSection>
      </NScreen>

      {more && <NActions title={name(c)} actions={moreActions} onClose={() => setMore(false)} />}
      {timeline && (
        <NSheet title="Activity" subtitle={`${c.timeline.length} events, newest first`} onClose={() => setTimeline(false)}>
          <NGroup>
            {c.timeline.map((e) => {
              const tm = TOPIC_META[e.topic] ?? { label: e.topic, color: C.gray };
              return <NRow key={e.id} title={e.message} subtitle={`${tm.label} · ${ago(e.at)}`} />;
            })}
          </NGroup>
        </NSheet>
      )}
      {messages && (
        <NSheet title="Messages" subtitle="Everything sent to the customer on this application" onClose={() => setMessages(false)}>
          <NGroup>
            {m.msgs.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).map((msg) => (
              <NRow key={msg.id} title={msg.label} subtitle={msg.body}
                detail={`${CHANNEL_META[msg.channel].label} · ${msg.delivery === 'delivered' ? 'Delivered' : 'Sent'} · ${ago(msg.at)}`} />
            ))}
          </NGroup>
        </NSheet>
      )}
      <CaseOverlays c={c} m={m} />
    </>
  );
}

/** What a case can open over itself: KYC, the extraction review, the
 *  voice-agent call, the channel picker, delete — and the toast. */
export function CaseOverlays({ c, m }: { c: OnboardingCase; m: CaseModel }) {
  const nk = useNk();
  return (
    <>
      {m.kyc && <div className="mw-full"><Kyc c={c} onExit={() => m.setKyc(false)} /></div>}
      {m.reviewing && m.linked && m.pkg && (
        <PackageReview res={m.pkg} mode="confirm" busy={m.pkgBusy} error={m.pkgErr}
          onClose={m.closeReview}
          onApply={async () => {
            m.setPkgBusy(true); m.setPkgErr(null);
            const err = await confirmPackageNow(m.linked!, m.pkg!.rows, m.corporate);
            m.setPkgBusy(false);
            if (err) { m.setPkgErr(err); return; }
            await m.acceptExtraction(m.pkg!.rows as unknown as ReviewField[]);
          }} />
      )}
      {m.reviewing && m.linked && !m.pkg && (
        <div className="mw-full">
          <ExtractionReview
            corporate={m.corporate}
            instanceId={loadPendingExtraction(c.id)?.instanceId ?? m.linked}
            attachmentId={loadPendingExtraction(c.id)?.attachmentId ?? c.documentId}
            documentName={loadPendingExtraction(c.id)?.documentName ?? c.documentName}
            onAccepted={(rows) => { void m.acceptExtraction(rows); }}
            onClose={m.closeReview}
          />
        </div>
      )}
      {m.calling && <CallPanel subject={m.callSubject()} tab={m.calling} onClose={() => m.setCalling(false)} />}
      {m.picker && <ChannelSheet c={c} onCancel={() => m.setPicker(false)} onSend={m.sendKyc} />}
      {m.confirmDel && (
        <NSheet title={`Delete ${name(c)}?`} subtitle={`${c.id} · this cannot be undone`} onClose={() => !m.deleting && m.setConfirmDel(false)}
          footer={<>
            <NButton kind="secondary" disabled={m.deleting} onClick={() => m.setConfirmDel(false)}>Keep it</NButton>
            <NButton kind="destructive" disabled={m.deleting} onClick={() => void m.deleteRecord()}>{m.deleting ? 'Deleting…' : 'Delete'}</NButton>
          </>}>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: nk.ink }}>
            Removes it from your pipeline. Nothing it has already started is undone
            {m.linked && !m.mstate?.done ? ' — the Maestro case keeps running' : ''}
            {c.accountNumber ? `, and account ${c.accountNumber} stays open in core banking` : ''}.
          </div>
        </NSheet>
      )}
      <NToast text={m.toast} />
    </>
  );
}

function ChannelSheet({ c, onCancel, onSend }: { c: OnboardingCase; onCancel: () => void; onSend: (chosen: MsgChannel[]) => void }) {
  const nk = useNk();
  const target = (ch: MsgChannel) => (ch === 'email' ? c.email : c.phone) || '';
  const [sel, setSel] = useState(() => new Set(MSG_CHANNELS.filter((k) => k !== 'email' && target(k))));
  const chosen = MSG_CHANNELS.filter((k) => sel.has(k));
  return (
    <NSheet title="Send the KYC link" subtitle={`${c.firstName || 'The customer'} finishes on their own phone — no need to come in.`} onClose={onCancel}
      footer={<NButton disabled={!chosen.length} onClick={() => onSend(chosen)}>Send{chosen.length > 1 ? ` by ${chosen.length} channels` : ''}</NButton>}>
      <NGroup>
        {MSG_CHANNELS.map((k) => {
          const to = target(k);
          return (
            <div key={k} style={{ borderTop: `1px solid ${nk.sep}` }}>
              <NToggle on={sel.has(k)} disabled={!to}
                onChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(k); else n.delete(k); return n; })}
                label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ChannelIcon ch={k} size={17} />{CHANNEL_META[k].label}</span>}
                sub={to || 'Not on file'} />
            </div>
          );
        })}
      </NGroup>
    </NSheet>
  );
}
