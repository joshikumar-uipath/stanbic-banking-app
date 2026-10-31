// Deciding an exception. The problem leads — stated with the data that caused
// it — then the evidence, then the decision: pick a reason, say what you
// established, choose where it goes. A decision without both a reason and a
// note is not accepted; every one has to be reconstructable. When it is done,
// the next exception in the batch comes up.
import { useEffect, useMemo, useRef, useState } from 'react';
import { fullName, VERIFICATION_LABEL, DECISION_LABEL, store } from '../../../onboarding';
import { inException } from '../../bulk/engine';
import { EXCEPTION_REASONS, ageBucket } from '../../bulk/bulkModel';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NButton, NField, NEmpty, NSuccess, Glyph } from '../nkit';
import { useNk, C, haptic } from '../nk';
import { ago } from '../../time';

export default function Disposition({ id }: { id: string }) {
  const nav = useNav();
  const nk = useNk();
  const { batched, byId } = useWorkData();
  const c = byId(id);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const rest = useMemo(() => (c ? inException(batched.filter((x) => x.batchId === c.batchId && x.id !== c.id)) : []), [batched, c]);

  if (!c || !(c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD')) {
    return <NScreen title="Exception" onBack={nav.pop} large={false}><NEmpty title="Already decided" action={<NButton kind="secondary" onClick={nav.pop}>Back</NButton>}>This application is no longer an exception.</NEmpty></NScreen>;
  }
  const compliance = c.state === 'COMPLIANCE_HOLD';
  // A screening hold is Compliance's decision — this phone shows it, it doesn't clear it.
  if (compliance) {
    return (
      <NScreen title={fullName(c) || 'Exception'} eyebrow="With Compliance" onBack={nav.pop}>
        <p className="mw-statement">A screening match is with Compliance. They will clear or decline it — nothing to do here until they do.</p>
        <NSection title="Evidence">
          <NGroup>
            {(c.verifications ?? []).map((v) => <NRow key={v.kind} tone={v.status === 'failed' ? C.red : C.green} title={VERIFICATION_LABEL[v.kind]} subtitle={v.detail ?? (v.status === 'passed' ? 'Verified' : 'No record returned')} />)}
            <NRow icon={{ name: 'doc', color: nk.accent }} title="Documents" subtitle="Form, ID and proof of address" onClick={() => nav.push({ k: 'docs', id: c.id })} />
          </NGroup>
        </NSection>
      </NScreen>
    );
  }
  const failed = c.verifications?.filter((v) => v.status === 'failed') ?? [];
  const ready = Boolean(reason && note.trim());
  const age = ageBucket(c.createdAt);

  const dispose = async (to: 'resume' | 'compliance' | 'customer') => {
    if (!ready) return;
    setBusy(true);
    const trail = `${reason} — ${note.trim()} (${to === 'resume' ? 'resolved, case resumed' : to === 'compliance' ? 'sent to Compliance' : 'returned to the customer'})`;
    try {
      await store.advance(c.id, to === 'resume' ? 'VALIDATED' : to === 'compliance' ? 'COMPLIANCE_HOLD' : 'PENDING_CUSTOMER', trail);
    } catch (e) {
      setBusy(false); haptic('warn'); setFail((e as Error).message || 'Could not save — nothing was changed.'); return;
    }
    haptic('success');
    setDone(to === 'resume' ? 'Resolved — the case is moving again' : to === 'compliance' ? 'Sent to Compliance' : 'Returned to the customer');
    leaveTimer.current = window.setTimeout(() => (rest[0] ? nav.replace({ k: 'disposition', id: rest[0].id }) : nav.pop()), 900);
  };

  return (
    <>
      <NScreen title={fullName(c) || c.id} onBack={nav.pop} large={false}
        footer={<>
          {fail && <div role="alert" style={{ fontSize: 13, color: C.red }}>{fail}</div>}
          <NButton disabled={!ready || busy} onClick={() => void dispose('resume')}>Resolve and resume</NButton>
          <div className="nk-footer-row">
            {!compliance && <NButton kind="secondary" small disabled={!ready || busy} onClick={() => void dispose('compliance')}>To Compliance</NButton>}
            <NButton kind="destructive" small disabled={!ready || busy} onClick={() => void dispose('customer')}>Back to customer</NButton>
          </div>
        </>}>
        <div className="mw-meta" style={{ color: nk.ink2, marginTop: -6 }}>
          <span><span className="mono" style={{ fontSize: 13, color: nk.ink }}>{c.id}</span> · <span className="mono" style={{ fontSize: 13 }}>{c.batchId}</span> · {ago(c.createdAt)}{age.step ? ` · ${age.label}` : ''}</span>
        </div>

        <NSection title={c.decision ? DECISION_LABEL[c.decision] : 'Exception'} aside={`Routed to ${compliance ? 'Compliance' : 'you'}`}>
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.35, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Glyph color={C.red} size={10} />
            <span>{c.recon?.length ? c.recon.map((r) => `${r.field} does not reconcile`).join(' · ') : c.decisionReason || 'Referred for manual review'}</span>
          </div>
          {c.recon?.map((r) => (
            <div key={r.field} className="mw-srcs">
              {r.sources.map((src) => <div key={src.name}><span style={{ color: nk.ink2 }}>{src.name}</span><b style={{ color: nk.ink }}>{src.value}</b></div>)}
            </div>
          ))}
          {failed.length > 0 && <p style={{ fontSize: 14, color: nk.ink2, margin: 0 }}>Failed: {failed.map((v) => VERIFICATION_LABEL[v.kind]).join(', ')}</p>}
        </NSection>

        <NSection title="Evidence" footer="Already gathered — nothing needs re-running.">
          <NGroup>
            {c.validations.map((v) => <NRow key={v.kind} tone={v.status === 'failed' ? C.red : v.status === 'passed' ? C.green : C.gray} title={v.kind} subtitle={v.status === 'passed' ? 'Matched' : v.status === 'failed' ? (v.detail ?? 'No record returned') : v.status} />)}
            {(c.verifications ?? []).map((v) => <NRow key={v.kind} tone={v.status === 'failed' ? C.red : C.green} title={VERIFICATION_LABEL[v.kind]} subtitle={v.detail ?? (v.status === 'passed' ? 'Verified' : 'No record returned')} />)}
            <NRow icon={{ name: 'doc', color: nk.accent }} title="Documents" subtitle="Form, ID and proof of address" onClick={() => nav.push({ k: 'docs', id: c.id })} />
          </NGroup>
        </NSection>

        <NSection title="Your decision">
          <NGroup>
            {EXCEPTION_REASONS.map((r) => (
              <button key={r} type="button" className="mw-radiorow tap" style={{ borderColor: nk.sep, color: nk.ink }} onClick={() => { haptic(); setReason(r); }} aria-pressed={reason === r}>
                <span className="mw-radio" style={{ borderColor: reason === r ? 'var(--nk-accent)' : nk.ink3 }}>{reason === r && <i />}</span>
                <span>{r}</span>
              </button>
            ))}
          </NGroup>
          <NField label="What you established" required>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="What you checked, and how." />
          </NField>
          {rest.length > 0 && <p style={{ fontSize: 13, color: nk.ink2, margin: 0, padding: '0 4px' }}>{rest.length} more in this batch — the next comes up when you finish.</p>}
        </NSection>
      </NScreen>
      {done && <NSuccess title={done} sub={rest.length ? 'Next exception…' : 'All exceptions decided'} />}
    </>
  );
}
