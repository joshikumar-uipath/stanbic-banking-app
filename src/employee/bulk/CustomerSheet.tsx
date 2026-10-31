// ─────────────────────────────────────────────────────────────────────────────
// One customer in a batch, in full.
//
// An overlay rather than a drawer beside the table: the batch table already has
// six columns, and squeezing it to make room recreated the problem that pushed
// bulk out of the right pane in the first place. Here the table keeps its width
// and the sheet gets the room a document actually needs.
//
// THREE tabs, not four. The Case tab is the existing `CaseDetail` — whole, not
// reimplemented — because a bulk row is an ordinary OnboardingCase and that
// component already knows how to show its Maestro stage, its next best action,
// its checks and its timeline. Writing a second one would mean two views of a
// customer that drift apart. Its own Activity tab is why there is no separate
// Timeline tab here.
//
// Documents and Extraction are the bulk-only additions: neither has any meaning
// for a walk-in capture, which is typed straight into the form.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { confidenceThresholdPct } from '../../integrations/docRules';
import { fullName, DECISION_LABEL, VERIFICATION_LABEL, type OnboardingCase } from '../../onboarding';
import { DOC_LABEL } from '../bulk';
import CaseDetail from '../screens/CaseDetail';
import { DocPane, DocStage, DocThumb, type ViewerDoc } from './DocViewer';
import { docsFor } from './docs';
import { I, Tag } from '../ui';

export type SheetTab = 'case' | 'documents' | 'extraction';

/** Which tab explains a given outcome. Clicking a decision in the table should
 *  land on the answer, not on the biography. */
export function tabForDecision(c: OnboardingCase): SheetTab {
  if (c.recon?.length) return 'extraction';          // the disagreement is in the read
  if (c.reviewState === 'awaiting') return 'extraction';
  return 'case';                                      // verifications, screening, Maestro
}

const FIELDS: { key: string; label: string; of: (c: OnboardingCase) => string }[] = [
  { key: 'firstName', label: 'First name', of: (c) => c.firstName },
  { key: 'lastName', label: 'Last name', of: (c) => c.lastName },
  { key: 'dob', label: 'Date of birth', of: (c) => c.dob ?? '14/03/1988' },
  { key: 'bvn', label: 'BVN', of: (c) => c.bvn },
  { key: 'nin', label: 'NIN', of: (c) => c.nin },
  { key: 'tin', label: 'Tax ID (TIN)', of: (c) => c.tin ?? '—' },
  { key: 'address', label: 'Address', of: (c) => c.address },
];

/** What the rail shows under "What was captured" — the identifiers someone
 *  actually checks, not the whole form. */
const CAPTURED: { key: string; label: string; of: (c: OnboardingCase) => string }[] = [
  { key: 'bvn', label: 'BVN', of: (c) => c.bvn },
  { key: 'nin', label: 'NIN', of: (c) => c.nin },
  { key: 'dob', label: 'Date of birth', of: (c) => c.dob ?? '' },
  { key: 'phone', label: 'Phone', of: (c) => c.phone },
  { key: 'email', label: 'Email', of: (c) => c.email },
  { key: 'address', label: 'Address', of: (c) => c.address },
];

export default function CustomerSheet({ c, all, tab: initial = 'case', onTab, onPick, onClose }: {
  c: OnboardingCase;
  /** The rest of the batch, so prev/next can walk it without closing. */
  all: OnboardingCase[];
  tab?: SheetTab;
  onTab?: (t: SheetTab) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SheetTab>(initial);
  /** Which document the Documents tab should open on, set when one is named. */
  const [startDoc, setStartDoc] = useState(0);
  useEffect(() => setTab(initial), [initial, c.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const docs = docsFor(c.id);
  const pos = all.findIndex((x) => x.id === c.id);
  const prev = pos > 0 ? all[pos - 1] : null;
  const next = pos >= 0 && pos < all.length - 1 ? all[pos + 1] : null;

  const go = (t: SheetTab, doc = 0) => { setTab(t); setStartDoc(doc); onTab?.(t); };

  return (
    <div className="cs-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cs" role="dialog" aria-modal="true" aria-label={`${fullName(c)} — application detail`}>

        <header className="cs-head">
          <div className="who">
            <b>{fullName(c) || 'Unnamed'}</b>
            <span><span className="mono">{c.id}</span> · {c.accountType ?? 'Account'}{c.batchId ? ` · ${c.batchId}` : ''}</span>
          </div>
          {c.decision && <Tag tone={c.state === 'EXCEPTION' || c.state === 'DECLINED' || c.state === 'COMPLIANCE_HOLD' ? 'crit' : c.accountNumber ? 'good' : 'warn'}>{DECISION_LABEL[c.decision]}</Tag>}
          {pos >= 0 && <span className="pos">{pos + 1} of {all.length}</span>}
          <button className="dk-btn sm" disabled={!prev} onClick={() => prev && onPick(prev.id)}>← Prev</button>
          <button className="dk-btn sm" disabled={!next} onClick={() => next && onPick(next.id)}>Next →</button>
          <button className="dk-btn sm" onClick={onClose}>Close</button>
        </header>

        <div className="cs-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'case'} className={tab === 'case' ? 'on' : ''} onClick={() => go('case')}>Case</button>
          <button role="tab" aria-selected={tab === 'documents'} className={tab === 'documents' ? 'on' : ''} onClick={() => go('documents')}>
            Documents{docs.length ? <span className="c">{docs.length}</span> : null}
          </button>
          <button role="tab" aria-selected={tab === 'extraction'} className={tab === 'extraction' ? 'on' : ''} onClick={() => go('extraction')}>
            Extraction{c.recon?.length ? <span className="c crit">{c.recon.length}</span> : null}
          </button>
        </div>

        <div className="cs-body">
          {/* CaseDetail was built for a ~440px right pane. Handed 1240px it
              stretched — a next-best-action button a metre wide. So it keeps a
              column of the width it was drawn for, and the space that buys goes
              to the bulk context it knows nothing about. Its own header is
              hidden in CSS: the sheet's header already says who this is, and
              says more (decision, position in the batch, prev/next). */}
          {tab === 'case' && (
            <div className="cs-case">
              <div className="pane"><CaseDetail key={c.id} c={c} onClose={onClose} /></div>
              <aside className="rail">
                {c.recon?.length ? (
                  <section className="flag">
                    <h4>Does not reconcile</h4>
                    {c.recon.map((r) => (
                      <button className="recon" key={r.field} onClick={() => go('extraction')}>
                        <b>{r.field}</b>
                        {r.sources.map((x) => <span key={x.name}><em>{x.name}</em>{x.value}</span>)}
                      </button>
                    ))}
                  </section>
                ) : null}

                <section>
                  <h4>Documents {docs.length ? <em>{docs.length}</em> : null}</h4>
                  {docs.length ? (
                    <div className="docs">
                      {docs.map((d, n) => (
                        <button key={d.name + n} onClick={() => go('documents', n)}>
                          <DocThumb doc={d} size={54} />
                          <span className="t"><b>{DOC_LABEL[d.kind]}</b><em>{d.name}</em></span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="none">Nothing held for this application in this session. A manifest
                    customer fills the form themselves, so there is no scan to read.</p>
                  )}
                </section>

                <section>
                  <h4>What was captured</h4>
                  <dl className="kv">
                    {CAPTURED.map((f) => {
                      const v = f.of(c);
                      // A confidence belongs to a VALUE. "Not captured · 96%"
                      // reads as though the model were sure of nothing.
                      const conf = v ? c.fieldConfidence?.[f.key] : undefined;
                      return (
                        <div key={f.key} className={conf !== undefined && conf < confidenceThresholdPct() ? 'weak' : ''}>
                          <dt>{f.label}</dt>
                          <dd>{v || <span className="mu">Not captured</span>}
                            {conf !== undefined && <i>{conf}%</i>}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>

                {c.verifications?.length ? (
                  <section>
                    <h4>Verifications</h4>
                    <div className="vers">
                      {c.verifications.map((v) => (
                        <span key={v.kind} className={v.status === 'failed' ? 'bad' : 'ok'}>● {VERIFICATION_LABEL[v.kind]}</span>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          )}

          {tab === 'documents' && (docs.length
            ? <DocPane docs={docs} missing={[]} compact start={startDoc} />
            : <Missing />)}

          {tab === 'extraction' && <Extraction c={c} docs={docs} />}
        </div>

      </div>
    </div>
  );
}

/** The scan beside what was read off it — the one layout that makes a
 *  reconciliation argument settleable, because you can see both sides at once. */
function Extraction({ c, docs }: { c: OnboardingCase; docs: ViewerDoc[] }) {
  const conf = c.fieldConfidence ?? {};
  const scan = docs.find((d) => d.kind === 'id') ?? docs[0] ?? null;

  return (
    <div className="cs-split">
      <div className="doc">
        {scan ? <DocStage doc={scan} /> : <Missing small />}
      </div>

      <div className="fields">
        {c.recon?.length ? (
          <div className="recon bad">
            <div className="t">Does not reconcile</div>
            {c.recon.map((r) => (
              <div className="iss" key={r.field}>
                <b>{r.field}</b>
                <div className="src">
                  {r.sources.map((s) => <span key={s.name}><em>{s.name}</em>{s.value}</span>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="recon ok">
            <div className="t">Every source agrees</div>
            <p>Name and date of birth match across the form and the authorities that returned them.</p>
          </div>
        )}

        <div className="tbl">
          <div className="hd"><span>Field</span><span>Read from the form</span><span>Conf.</span></div>
          {FIELDS.map((f) => {
            const v = conf[f.key] ?? 100;
            return (
              <div className={`rw${v < confidenceThresholdPct() ? ' weak' : ''}`} key={f.key}>
                <span className="l">{f.label}</span>
                <span className="v">{f.of(c) || '—'}</span>
                <span className={`c ${v < confidenceThresholdPct() ? 'warn' : 'ok'}`}>{v}%</span>
              </div>
            );
          })}
        </div>

        <div className="vers">
          <div className="t">Verifications</div>
          <div className="grid">
            {(c.verifications ?? []).map((v) => (
              <span key={v.kind} className={v.status === 'failed' ? 'bad' : 'ok'}>● {VERIFICATION_LABEL[v.kind]}</span>
            ))}
            {!c.verifications?.length && <span className="mu">Not yet run.</span>}
          </div>
        </div>

        {c.edits?.length ? (
          <div className="edits">
            <div className="t">Corrected at review by {c.reviewedBy}</div>
            {c.edits.map((e) => (
              <div className="e" key={e.field}><b>{e.field}</b><span><s>{e.before || '(blank)'}</s> → {e.after}</span></div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Missing({ small = false }: { small?: boolean }) {
  return (
    <div className={`cs-missing${small ? ' sm' : ''}`}>
      <I n="alert" s={small ? 18 : 22} />
      <b>No documents held for this application</b>
      <p>
        A bundle's files are kept for the session only — reloading the page lets them go. Re-upload the
        bundle to read them again. Applications that came in through a manifest never had documents at
        intake: the customer filled the form themselves.
      </p>
    </div>
  );
}
