// ─────────────────────────────────────────────────────────────────────────────
// Confirm extracted details — the checkpoint BR-DOC-10 makes mandatory.
//
// The source document sits beside what was read off it, low-confidence fields
// are editable, and the reconciliation band names the exact source-pair that
// disagrees. That band is what makes this screen worth opening: without it a
// reviewer is re-typing a form; with it they are adjudicating between the form
// and the registry.
//
// Every edit is recorded with who, when, before and after (BR-DOC-11), and the
// corrected value is what the account is opened on.
//
// Where a row is genuinely live in Maestro, the real server-side extraction task
// is one click away — that is the same `ExtractionReview` the single-capture
// flow uses, talking to IXP. It is NOT inlined here, because it knows nothing
// about reconciliation or the business verifications, which are the two panels
// this screen exists for.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { finishReview, HANDLE_TARGET_MS, mmss } from './handleTime';
import { confidenceThresholdPct } from '../../integrations/docRules';
import { fullName, VERIFICATION_LABEL, type OnboardingCase } from '../../onboarding';
import { getLinkedInstance, instanceUrl } from '../../onboarding/maestro';
import { approveExtraction, flagExtraction, awaitingReview } from './engine';
import { REVIEW_FIELDS as FIELDS, REVIEWER } from './bulkModel';
import { getActiveCountry } from '../../config/countries';
import { I } from '../ui';
import { useBank } from '../../config';

const CO = getActiveCountry();
export default function Review({ id, cases, onDone, onNext }: {
  id: string; cases: OnboardingCase[]; onDone: () => void; onNext: (id: string) => void;
}) {
  const bank = useBank();
  const c = cases.find((x) => x.id === id) ?? null;
  const queue = useMemo(() => awaitingReview(cases).sort((a, b) => (a.extractionConfidence ?? 100) - (b.extractionConfidence ?? 100)), [cases]);
  const pos = queue.findIndex((x) => x.id === id);
  const next = queue[pos + 1] ?? queue.find((x) => x.id !== id) ?? null;

  const [vals, setVals] = useState<Record<string, string>>({});
  // Handle time (BR-DOC-13): the clock starts when this application opens here.
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    started.current = Date.now();
    const iv = window.setInterval(() => setElapsed(Date.now() - started.current), 1000);
    return () => window.clearInterval(iv);
  }, [id]);
  const stopClock = (outcome: 'approved' | 'flagged') => finishReview(id, started.current, REVIEWER, outcome);
  const [flagging, setFlagging] = useState(false);
  const [concern, setConcern] = useState('');
  const [busy, setBusy] = useState(false);

  if (!c) return <div className="bk-ok">That application is no longer in the review queue.<button className="dk-btn" style={{ marginLeft: 12 }} onClick={onDone}>Back to the queue</button></div>;

  const conf = c.fieldConfidence ?? {};
  const valueOf = (f: typeof FIELDS[number]) => vals[f.key] ?? f.of(c) ?? '';
  const edited = FIELDS.filter((f) => vals[f.key] !== undefined && vals[f.key] !== (f.of(c) ?? ''));
  const instance = getLinkedInstance(c.id);

  const approve = async () => {
    setBusy(true);
    stopClock('approved');
    await approveExtraction(c.id, REVIEWER, edited.map((f) => ({
      field: f.label, before: f.of(c) ?? '', after: vals[f.key], at: new Date().toISOString(), by: REVIEWER,
    })));
    if (next) onNext(next.id); else onDone();
  };

  const flag = async () => {
    if (!concern.trim()) return;
    setBusy(true);
    stopClock('flagged');
    await flagExtraction(c.id, REVIEWER, concern.trim());
    if (next) onNext(next.id); else onDone();
  };

  return (
    <div className="bk-review">
      <header className="rv-bar">
        <button className="dk-btn sm" onClick={onDone}>← Queue</button>
        <div className="who">
          <b>{fullName(c) || 'Unnamed'}</b>
          <span><span className="mono">{c.id}</span> · {c.accountType ?? 'Account'} · confidence {c.extractionConfidence ?? 100}%</span>
        </div>
        <span className={`rv-clock${elapsed > HANDLE_TARGET_MS ? ' over' : ''}`} title="Time on this application — target under 5 minutes (BR-DOC-13)">{mmss(elapsed)}</span>
        <span className="pos">{pos >= 0 ? `${pos + 1} of ${queue.length}` : ''}</span>
        {next && <button className="dk-btn sm" onClick={() => { setVals({}); onNext(next.id); }}>Skip →</button>}
      </header>

      <div className="rv-body">
        <div className="rv-doc">
          <div className="hd">
            <b>Account opening package</b>
            <span className="mu">page 2 of 4</span>
            {instance && <a className="lnk" href={instanceUrl(instance)} target="_blank" rel="noreferrer">Open the live extraction task ↗</a>}
          </div>
          <div className="pg">
            <div className="ph">
              <span className="bank">{bank.legalName}</span>
              <b>Account Opening Form</b>
            </div>
            {FIELDS.map((f) => {
              const weak = (conf[f.key] ?? 100) < confidenceThresholdPct();
              return (
                <div className={`fr${weak ? ' weak' : ''}`} key={f.key}>
                  <span className="l">{f.label}</span>
                  <span className={`v${weak ? ' hand' : ''}`}>{f.of(c) || '—'}</span>
                </div>
              );
            })}
            <div className="stamp">Fields the model was unsure of are ringed</div>
          </div>
        </div>

        <div className="rv-side">
          {c.recon?.length ? (
            <div className="rv-recon">
              <div className="t"><b>Reconciliation</b><span className="bk-br">BR-REC-01 · BR-REC-02 · BR-REC-03</span></div>
              {c.recon.map((r) => (
                <div className="iss" key={r.field}>
                  <b>{r.field} does not reconcile</b>
                  <div className="src">
                    {r.sources.map((s) => <span key={s.name}><em>{s.name}</em>{s.value}</span>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rv-recon ok">
              <div className="t"><b>Reconciliation</b><span className="bk-br">BR-REC-01…04</span></div>
              <div className="iss"><b>Every source agrees</b><span className="mu">Name and date of birth match across the form, {CO.primaryId.authority} and {CO.secondaryId.authority}.</span></div>
            </div>
          )}

          <div className="rv-fields">
            <div className="t"><b>What was read off the form</b><span className="mu">Correct anything the model got wrong</span></div>
            {FIELDS.map((f) => {
              const cf = conf[f.key] ?? 100;
              const weak = cf < confidenceThresholdPct();
              return (
                <label className={`fl${weak ? ' weak' : ''}`} key={f.key}>
                  <span className="l">{f.label}</span>
                  <input value={valueOf(f)} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
                  <span className={`c${weak ? ' warn' : ' ok'}`}>{cf}%</span>
                </label>
              );
            })}
          </div>

          <div className="rv-ver">
            <div className="t"><b>Verification outcomes</b><span className="mu">Already run in parallel — you are not waiting on these</span></div>
            <div className="grid">
              {(c.verifications ?? []).map((v) => (
                <span key={v.kind} className={v.status === 'failed' ? 'bad' : 'ok'}>● {VERIFICATION_LABEL[v.kind]}{v.detail ? ` — ${v.detail}` : ''}</span>
              ))}
              {c.validations.filter((v) => v.kind === 'BVN' || v.kind === 'NIN' || v.kind === 'PEP').map((v) => (
                <span key={v.kind} className={v.status === 'failed' ? 'bad' : 'ok'}>● {v.kind} — {v.status}</span>
              ))}
            </div>
          </div>

          <div className="rv-audit">
            <I n="check" s={13} />
            Every field you change is logged with your name, the time, and the value before and after. The corrected value is what the account is opened on.
            <span className="bk-br">BR-DOC-11 · BR-AUD-01</span>
          </div>
        </div>
      </div>

      {flagging ? (
        <footer className="rv-foot flag">
          <label className="grow">
            <span>What is the concern? It travels with the case.</span>
            <input autoFocus value={concern} onChange={(e) => setConcern(e.target.value)} placeholder="e.g. the ID document appears altered" />
          </label>
          <button className="dk-btn" onClick={() => setFlagging(false)}>Cancel</button>
          <button className="dk-btn crit" disabled={!concern.trim() || busy} onClick={() => void flag()}>Raise the exception</button>
        </footer>
      ) : (
        <footer className="rv-foot">
          <button className="dk-btn crit" onClick={() => setFlagging(true)}>Flag as exception</button>
          <span className="mu">
            {edited.length
              ? `${edited.length} field${edited.length === 1 ? '' : 's'} corrected — ${edited.map((f) => f.label).join(', ')}`
              : 'Nothing changed yet.'}
          </span>
          <button className="dk-btn pri lg" disabled={busy} onClick={() => void approve()}>
            {busy ? 'Saving…' : next ? 'Approve and take the next →' : 'Approve extraction →'}
          </button>
        </footer>
      )}
    </div>
  );
}
