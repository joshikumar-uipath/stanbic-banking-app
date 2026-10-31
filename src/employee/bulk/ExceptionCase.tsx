// ─────────────────────────────────────────────────────────────────────────────
// Exception case — what a handler needs so they repeat no work.
//
// BR-EXC-02 is the load-bearing requirement: every case carries its full
// evidence package, so the person picking it up does not re-run a single check.
// BR-EXC-03 asks for the trigger stated with the data that caused it — "DOB does
// not reconcile: AOP 14/03/1988, NIMC 14/03/1983", not "reconciliation failure".
// BR-EXC-04 will not let a case be disposed of without a reason and a note.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { fullName, VERIFICATION_LABEL, DECISION_LABEL, store, type OnboardingCase } from '../../onboarding';
import { inException } from './engine';
import { EXCEPTION_REASONS as REASONS, ageBucket as bucket } from './bulkModel';
import { getActiveCountry } from '../../config/countries';
import { I, Tag } from '../ui';
import { ago } from '../time';

const CO = getActiveCountry();

export default function ExceptionCase({ cases, picked, onPick, onBack }: {
  cases: OnboardingCase[]; picked: string | null; onPick: (id: string) => void; onBack: () => void;
}) {
  const list = useMemo(() => inException(cases), [cases]);
  const c = list.find((x) => x.id === picked) ?? list[0] ?? null;
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!c) {
    return (
      <div className="bk-pane">
        <header className="bk-head"><div><h1>Exceptions</h1><p>Nothing needs a person on this batch.</p></div></header>
        <div className="bk-ok">Queue is clear.<button className="dk-btn" style={{ marginLeft: 12 }} onClick={onBack}>Back to the batch</button></div>
      </div>
    );
  }

  const age = bucket(c.createdAt);
  const compliance = c.state === 'COMPLIANCE_HOLD';
  const failedV = c.verifications?.filter((v) => v.status === 'failed') ?? [];

  const dispose = async (to: 'resume' | 'compliance' | 'customer') => {
    if (!reason || !note.trim()) return;
    setBusy(true);
    const trail = `${reason} — ${note.trim()} (${to === 'resume' ? 'resolved, case resumed' : to === 'compliance' ? 'sent to Compliance' : 'returned to the customer'})`;
    if (to === 'resume') await store.advance(c.id, 'VALIDATED', trail);
    else if (to === 'compliance') await store.advance(c.id, 'COMPLIANCE_HOLD', trail);
    else await store.advance(c.id, 'PENDING_CUSTOMER', trail);
    setBusy(false); setReason(''); setNote('');
  };

  return (
    <div className="bk-pane">
      <header className="bk-head">
        <div>
          <h1>{c.decision ? DECISION_LABEL[c.decision] : 'Exception'}</h1>
          <p>{fullName(c)} · <span className="mono">{c.id}</span> · {c.accountType ?? 'Account'} · {c.batchId}</p>
        </div>
        <div className="age">
          <span className={age.step ? 'bad' : 'mu'}>Aged {ago(c.createdAt)}</span>
          <span className="bars">{[0, 1, 2].map((i) => <i key={i} className={i < age.step ? 'on' : ''} />)}</span>
        </div>
      </header>

      {list.length > 1 && (
        <div className="bk-filters">
          {list.map((x) => (
            <button key={x.id} aria-pressed={x.id === c.id} className={x.id === c.id ? 'on' : ''} onClick={() => onPick(x.id)}>
              {fullName(x) || x.id}
            </button>
          ))}
        </div>
      )}

      <div className="bk-trigger">
        <span className="lb">What triggered this</span>
        <div className="body">
          {c.recon?.length ? (
            <>
              {c.recon.map((r) => (
                <div key={r.field}>
                  <b>{r.field}</b> does not reconcile: {r.sources.map((s) => <span key={s.name}>{s.name} reads <b className="mono">{s.value}</b></span>).reduce((a, b) => <>{a}, {b}</>)}
                </div>
              ))}
            </>
          ) : (
            <div>{c.decisionReason || 'Referred for manual review.'}</div>
          )}
          {failedV.length > 0 && <div>Failed verification: {failedV.map((v) => VERIFICATION_LABEL[v.kind]).join(', ')}.</div>}
        </div>
        <div className="route">
          Routed to <b>{compliance ? 'Compliance' : 'you, the requester'}</b> — {compliance
            ? 'sanctions and watchlist matters are theirs.'
            : 'reconciliation failures and PEP matters come back to the RM.'}
        </div>
      </div>

      <div className="bk-split">
        <div className="bk-table ev">
          <div className="hd"><span>Check</span><span>What came back</span><span>When</span><span>Evidence</span></div>
          {c.validations.map((v) => (
            <div className="rw" key={v.kind}>
              <span className={v.status === 'failed' ? 'bad' : 'ok'}>● {v.kind}</span>
              <span className="mu">{v.status === 'passed' ? 'Matched' : v.status === 'failed' ? (v.detail ?? 'No record returned') : v.status}</span>
              <span className="mu">{new Date(v.updatedAt).toLocaleTimeString()}</span>
              <span><button className="lnk">PDF</button></span>
            </div>
          ))}
          {(c.verifications ?? []).map((v) => (
            <div className="rw" key={v.kind}>
              <span className={v.status === 'failed' ? 'bad' : 'ok'}>● {VERIFICATION_LABEL[v.kind]}</span>
              <span className="mu">{v.detail ?? (v.status === 'passed' ? 'Verified' : 'No record returned')}</span>
              <span className="mu">{new Date(v.updatedAt).toLocaleTimeString()}</span>
              <span><button className="lnk">PDF</button></span>
            </div>
          ))}
          <div className="rw">
            <span className="mu">Documents</span>
            <span className="mu">AOP · ID · proof of address{CO.primaryId.label ? '' : ''}</span>
            <span className="mu">{new Date(c.createdAt).toLocaleTimeString()}</span>
            <span><button className="lnk">Open</button></span>
          </div>
          <div className="rw">
            <span className="mu">Decision trail</span>
            <span className="mu">{c.decisionReason ?? '—'}</span>
            <span className="mu">{new Date(c.updatedAt).toLocaleTimeString()}</span>
            <span><Tag tone="idle">rule set v4.2</Tag></span>
          </div>
        </div>

        <aside className="bk-aside">
          <div className="card">
            <span className="lb">Your disposition</span>
            <label className="fl">
              <span>Reason code <em className="bad">required</em></span>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason…</option>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="fl">
              <span>Supporting note <em className="bad">required</em></span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="What you established, and how." />
            </label>
            <button className="dk-btn dash"><I n="upload" s={13} />Attach evidence</button>
            <hr />
            <button className="dk-btn pri" disabled={!reason || !note.trim() || busy} onClick={() => void dispose('resume')}>Resolve and resume the case</button>
            {!compliance && <button className="dk-btn" disabled={!reason || !note.trim() || busy} onClick={() => void dispose('compliance')}>Send to Compliance</button>}
            <button className="dk-btn crit" disabled={!reason || !note.trim() || busy} onClick={() => void dispose('customer')}>Return to the customer</button>
            <p className="mu sm">A disposition without a reason and a note is not accepted — every decision has to be reconstructable.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
