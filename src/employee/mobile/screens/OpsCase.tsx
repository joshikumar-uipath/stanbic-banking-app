// Triage one case. The problem leads — the root cause and what it means — then
// the checks, with a re-run on the one that failed, and the agent trail. The
// decision is docked under the thumb: the fix this cause calls for first, then
// escalate or reject.
import { useEffect, useRef, useState } from 'react';
import type { ValidationKind } from '../../../onboarding';
import { slaOf, riskOf } from '../../../ops/derive';
import { CAUSES, deriveCause, assignee, claim, escalate, rejectCase, resolveCase, chase, ME } from '../../../ops/opsModel';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NStatus, NButton, NSheet, NChips, NField, NEmpty, NSuccess, NToast, Glyph } from '../nkit';
import { rerunAll, sayTally } from '../actions';
import { name } from '../story';
import { useNk, C, haptic } from '../nk';
import { TOPIC_META } from '../../screens/useCaseDetail';
import { useOwners } from '../useOwners';
import { ago } from '../../time';

const SEV: Record<string, string> = { red: C.red, orange: C.orange, gray: C.gray };
const REJECT = ['Identity could not be verified', 'Fraud indicators', 'Customer withdrew', 'Duplicate of an existing customer'];

export default function OpsCase({ id }: { id: string }) {
  const nav = useNav();
  const nk = useNk();
  const c = useWorkData().byId(id);
  useOwners();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  if (!c) return <NScreen title="Case" onBack={nav.pop} large={false}><NEmpty title="Not found" color={C.gray} /></NScreen>;
  if (c.state !== 'EXCEPTION' && !done) {
    return <NScreen title="Case" onBack={nav.pop} large={false}><NEmpty title="Already cleared" action={<NButton kind="secondary" onClick={nav.pop}>Back</NButton>}>This case is no longer in the queue.</NEmpty></NScreen>;
  }
  const cause = deriveCause(c);
  const meta = CAUSES[cause];
  const sla = slaOf(c);
  const risk = riskOf(c);
  const who = assignee(c);
  const nm = name(c);
  const failed = c.validations.filter((v) => v.status === 'failed' || v.status === 'timeout');

  // Each action reports what really happened; a failure is shown, not swallowed.
  const act = async (key: string, fn: () => Promise<string | void>, msg: string, leave = true) => {
    setBusy(key);
    try {
      const said = await fn();
      haptic('success');
      if (leave) { setDone(said || msg); leaveTimer.current = window.setTimeout(nav.pop, 1100); }
      else { setNote(said || msg); window.setTimeout(() => setNote(null), 3200); }
    } catch (e) {
      haptic('warn');
      setErr((e as Error).message || 'That didn’t work — nothing was changed.');
      window.setTimeout(() => setErr(null), 4500);
    } finally { setBusy(null); }
  };
  const rerun = async (kind: ValidationKind) => {
    const t = await rerunAll([c.id], kind);
    if (t.failed || t.skipped) throw new Error(t.note || 'Nothing was changed.');
    return sayTally(t, `${kind === 'LIVENESS' ? 'Selfie' : kind} check`);
  };
  const primary = meta.bulk?.check
    ? { label: meta.bulk.check === 'LIVENESS' ? 'Ask for a new selfie' : `Re-run the ${meta.bulk.check} check`, run: () => act('primary', () => rerun(meta.bulk!.check as ValidationKind), '') }
    : cause === 'doc_stale'
      ? { label: 'Log a chaser', run: () => act('primary', async () => { await chase(c.id); return 'Chaser logged — not sent in this demo'; }, '') }
      : { label: 'Accept and resolve', run: () => act('primary', () => resolveCase(c.id, 'accepted on review'), 'Resolved — the account is open') };

  return (
    <>
      <NScreen title={nm} onBack={nav.pop}
        footer={<>
          <NButton disabled={!!busy} onClick={() => void primary.run()}>{busy === 'primary' ? 'Working…' : primary.label}</NButton>
          <div className="nk-footer-row">
            <NButton small kind="secondary" disabled={!!busy} onClick={() => void act('esc', () => escalate(c.id), 'Escalated to a supervisor')}>Escalate</NButton>
            <NButton small kind="destructive" disabled={!!busy} onClick={() => setRejecting(true)}>Reject</NButton>
          </div>
        </>}>
        <div className="mw-meta" style={{ color: nk.ink2, marginTop: -6 }}>
          <span><span className="mono" style={{ fontSize: 13, color: nk.ink }}>{c.id}</span> · open {ago(c.createdAt)}</span>
          <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <NStatus color={sla.tone === 'breach' ? C.red : sla.tone === 'warn' ? C.orange : C.gray}>SLA {sla.label}</NStatus>
            <NStatus color={risk.level === 'high' ? C.red : risk.level === 'medium' ? C.orange : C.green}>Risk {risk.score}</NStatus>
            <NStatus color={who ? C.blue : C.gray}>{who ? (who === ME ? 'Yours' : who) : 'Unowned'}</NStatus>
          </span>
        </div>
        {who !== ME && <div style={{ marginTop: -14 }}><NButton small kind="secondary" full={false} icon="hand" onClick={() => { claim(c.id, ME); haptic('success'); }}>Take this case</NButton></div>}

        <NSection title={meta.tag}>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 8 }}><Glyph color={SEV[meta.severity]} size={10} />{meta.title}</div>
          <p className="mw-next-w open" style={{ color: nk.ink2, margin: 0 }}>{meta.detail}</p>
        </NSection>

        <NSection title="Checks">
          <NGroup>
            {c.validations.map((v) => {
              const bad = v.status === 'failed' || v.status === 'timeout';
              return (
                <NRow key={v.kind} tone={bad ? C.red : v.status === 'passed' ? C.green : C.gray} title={v.kind}
                  subtitle={bad ? `${v.status === 'timeout' ? 'Timed out' : 'Failed'}${v.attempts > 1 ? ` · ${v.attempts} attempts` : ''}${v.detail ? ` · ${v.detail}` : ''}` : v.status === 'passed' ? 'Passed' : v.status}
                  value={bad ? <NButton small kind="tinted" full={false} disabled={!!busy} onClick={() => void act(v.kind, () => rerun(v.kind), '', false)}>{busy === v.kind ? '…' : 'Re-run'}</NButton> : undefined} />
              );
            })}
          </NGroup>
          {!failed.length && <p className="nk-section-f" style={{ color: nk.ink2 }}>No check failed — this one is waiting on a person’s judgement.</p>}
        </NSection>

        <NSection title="What happened">
          <NGroup>
            {c.timeline.slice(0, 6).map((e) => {
              const tm = TOPIC_META[e.topic] ?? { label: e.topic, color: C.gray };
              return <NRow key={e.id} tone={tm.color} title={e.message} subtitle={`${tm.label} · ${ago(e.at)}`} />;
            })}
          </NGroup>
        </NSection>
      </NScreen>

      {rejecting && (
        <NSheet title="Reject this application" subtitle="The customer is told, and the decision is logged with your reason." onClose={() => setRejecting(false)}
          footer={<NButton kind="destructive" disabled={!reason.trim() || !!busy} onClick={() => { setRejecting(false); void act('rej', () => rejectCase(c.id, reason.trim()), 'Rejected'); }}>Reject</NButton>}>
          <NChips value={reason} onChange={setReason} options={REJECT.map((r) => ({ id: r, label: r }))} />
          <NField label="Or in your words"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /></NField>
        </NSheet>
      )}
      {done && <NSuccess title={done} />}
      <NToast text={err ?? note} tone={err ? 'error' : undefined} />
    </>
  );
}
