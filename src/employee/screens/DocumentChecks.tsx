// ─────────────────────────────────────────────────────────────────────────────
// The Documents tab — every document on the application, checked.
//
// One card per document: its type and how that was decided, each check with the
// outcome the Document rules DMN gave it and the row that decided it, the
// issuing-authority call, and what was read off the file. A document the rules
// referred or failed asks a person to decide (BR-DOC-07: refer, never block).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase } from '../../onboarding';
import { getOperator } from '../../onboarding/operator';
import { documentsFor, documentsOutcome, type DocResult } from '../../integrations/docChecks';
import { rulesEdited, DOC_RULES_KEY, type Outcome } from '../../integrations/docRules';

const TONE: Record<Outcome | 'n/a', string> = { Pass: 'good', 'Quick review': 'info', Refer: 'warn', Fail: 'crit', 'n/a': 'idle' };
const WORD: Record<Outcome | 'n/a', string> = { Pass: 'Pass', 'Quick review': 'Quick review', Refer: 'Refer', Fail: 'Fail', 'n/a': 'n/a' };

/** Re-render when the rules are saved in the Ops console (another document). */
function useRulesVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === DOC_RULES_KEY) setV((x) => x + 1); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  return v;
}

function Card({ d }: { d: DocResult }) {
  return (
    <div className="dc-card">
      <div className="dc-head">
        <div className="dc-name">
          <b>{d.label}</b>
          <span>
            {d.from && <b className="dc-from">{d.from === 'third-party' ? 'Third party' : d.from === 'bank' ? 'Bank' : 'Customer'} · </b>}
            {d.file ?? (d.source === 'application' ? 'Details from the application — no file analysed' : '')}
          </span>
        </div>
        <span className={`dc-badge ${TONE[d.outcome]}`}>{WORD[d.outcome]}</span>
      </div>
      <table className="dc-lines">
        <tbody>
          {d.lines.map((l) => (
            <tr key={l.check}>
              <td className="k">{l.label}</td>
              <td><span className={`dc-chip ${TONE[l.outcome]}`}>{WORD[l.outcome]}</span></td>
              <td className="d">
                {l.detail}
                {l.rule && <span className="dc-rule">Rule {l.rule}{l.ref ? ` · ${l.ref}` : ''}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.issuer && (
        <details className="kx-raw">
          <summary>{d.issuer.authority} — request and response</summary>
          <div className="kx-line num" style={{ marginTop: 6 }}>
            <span className="kx-m">{d.issuer.method}</span><span className="kx-p">{d.issuer.path}</span>
            <span className={`kx-http ${d.issuer.http === 200 ? 'ok' : 'bad'}`}>{d.issuer.http}</span>
            <span className="kx-ms">{d.issuer.latencyMs} ms</span>
          </div>
          <pre className="kx-json">{JSON.stringify({ request: d.issuer.request, response: d.issuer.response }, null, 2)}</pre>
        </details>
      )}
      {(d.analysedAt || d.producer) && d.source === 'file' && (
        <p className="dc-ev">Read {d.analysedAt ? new Date(d.analysedAt).toLocaleString() : ''}{d.producer ? ` · produced by ${d.producer}` : ''}</p>
      )}
    </div>
  );
}

export default function DocumentChecks({ c }: { c: OnboardingCase }) {
  const version = useRulesVersion();
  // Every record, for spotting the same RC number on another application (BR-DOC-08).
  const [all, setAll] = useState<OnboardingCase[] | undefined>(undefined);
  useEffect(() => { let alive = true; void store.list().then((x) => { if (alive) setAll(x); }); return () => { alive = false; }; }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const docs = useMemo(() => documentsFor(c, all), [c, all, version]);
  const overall = documentsOutcome(docs);
  const review = c.documentReview;
  const [busy, setBusy] = useState(false);

  const decide = async (decision: 'accepted' | 'new-document-requested') => {
    setBusy(true);
    const by = getOperator() || 'Operations analyst';
    try {
      await store.update(c.id, { documentReview: { by, at: new Date().toISOString(), decision } });
      await store.publish(c.id, decision === 'accepted' ? 'exception-queue' : 'customer-notification',
        decision === 'accepted'
          ? `Document checks referred by the rules were accepted by ${by}`
          : `A new document was requested from ${c.firstName ?? 'the customer'} — KYC link sent`);
    } finally { setBusy(false); }
  };

  if (!docs.length) {
    return <div className="ad-none">No documents to check on this application — it was captured without one.</div>;
  }
  const needsPerson = (overall === 'Refer' || overall === 'Fail') && !review;
  return (
    <div className="dc">
      <div className={`dc-top ${TONE[overall]}`}>
        <div>
          <b>{overall === 'Pass' ? 'Every document passed its checks'
            : overall === 'Quick review' ? 'A document needs a quick look'
            : overall === 'Refer' ? 'A person needs to look at a document'
            : 'A document failed its checks'}</b>
          <span>
            Judged against the Document rules DMN{rulesEdited() ? ' (edited in this browser)' : ''} — Ops console → Rules → Document rules.
          </span>
          {review && (
            <span className="dc-done">
              {review.decision === 'accepted' ? 'Accepted' : 'New document requested'} by {review.by} · {new Date(review.at).toLocaleString()}
            </span>
          )}
        </div>
        {needsPerson && (
          <div className="dc-act">
            <button className="cx-btn ghost" disabled={busy} onClick={() => void decide('new-document-requested')}>Request a new document</button>
            <button className="cx-btn" disabled={busy} onClick={() => void decide('accepted')}>Accept the documents</button>
          </div>
        )}
      </div>
      <div className="dc-grid">{docs.map((d) => <Card key={d.type + (d.file ?? '')} d={d} />)}</div>
    </div>
  );
}
