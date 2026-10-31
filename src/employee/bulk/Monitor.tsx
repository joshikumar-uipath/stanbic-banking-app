// ─────────────────────────────────────────────────────────────────────────────
// Batch monitor — where a submission actually is, at any size.
//
// Rows are windowed rather than all mounted: a 200-customer batch transitions
// every row several times, and rendering the lot on each store event was the
// other half of why this could not live in the right pane.
//
// The service-health strip is not decoration. BR-VER-10 distinguishes a
// transient outage (retry) from a persistent one (park and raise), and an RM
// looking at a stalled batch needs to see which it is without opening a case.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { fullName, VERIFICATION_LABEL, type OnboardingCase } from '../../onboarding';
import type { BatchMeta } from './batches';
import type { Persona } from '../roles';
import { MAESTRO_CAP, opened } from './engine';
import { getLinkedInstance } from '../../onboarding/maestro';
import CustomerSheet, { tabForDecision, type SheetTab } from './CustomerSheet';
import { I, Tag } from '../ui';
import { ago } from '../time';
import { decisionLabel } from './bulkModel';

const WINDOW = 40;

export default function Monitor({ meta, cases, persona, onException, onReview }: {
  meta: BatchMeta; cases: OnboardingCase[];
  /** Who is looking. Only a maker is offered the review tool — §9.1 keeps the
   *  person who confirms an OCR read apart from the one who submitted it. */
  persona: Persona;
  onException: (id: string) => void; onReview: (id: string) => void;
}) {
  const [show, setShow] = useState(WINDOW);
  /** Which application is open in the sheet, and on which tab. The NAME opens
   *  the case; the DECISION opens the tab that explains it — people click a
   *  decision because they want the reason, not the biography. */
  const [open, setOpen] = useState<{ id: string; tab: SheetTab } | null>(null);
  const [filter, setFilter] = useState<'all' | 'moving' | 'stuck' | 'done'>('all');

  const counts = useMemo(() => ({
    verifying: cases.filter((c) => c.state === 'VALIDATION_IN_PROGRESS').length,
    review: cases.filter((c) => c.reviewState === 'awaiting').length,
    authorise: cases.filter((c) => c.reviewState === 'approved' && !c.accountNumber).length,
    exception: cases.filter((c) => c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD').length,
    rejected: cases.filter((c) => c.state === 'DECLINED').length,
    open: opened(cases).length,
  }), [cases]);

  const done = counts.open + counts.rejected;
  const pct = cases.length ? Math.round((done / cases.length) * 100) : 0;
  const live = cases.filter((c) => getLinkedInstance(c.id)).length;

  const rows = useMemo(() => {
    if (filter === 'moving') return cases.filter((c) => c.state === 'VALIDATION_IN_PROGRESS' || c.reviewState === 'awaiting' || (c.reviewState === 'approved' && !c.accountNumber));
    if (filter === 'stuck') return cases.filter((c) => c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD' || c.state === 'DECLINED');
    if (filter === 'done') return cases.filter((c) => !!c.accountNumber);
    return cases;
  }, [cases, filter]);

  const complete = done === cases.length && cases.length > 0;

  return (
    <div className="bk-pane">
      <header className="bk-head">
        <div>
          <h1>{meta.name}</h1>
          <p><span className="mono">{meta.id}</span> · {cases.length} applications · {meta.channel === 'manifest' ? 'Excel manifest' : 'AOP bundle'} · {meta.segment} · started {ago(meta.createdAt)}</p>
        </div>
        <span className="bk-br">BR-RPT-01 · BR-VER-10 · BR-EXC-06</span>
      </header>

      {complete && (
        <div className="bk-done">
          <div>
            <b>Batch complete</b>
            <span>{counts.open} account{counts.open === 1 ? '' : 's'} opened · {counts.rejected} returned to you · {counts.exception} exception{counts.exception === 1 ? '' : 's'} still open</span>
          </div>
          <div className="targets">
            <span><em>Auto-decision</em><b className={counts.open / Math.max(cases.length, 1) >= 0.9 ? 'ok' : 'warn'}>{Math.round((counts.open / Math.max(cases.length, 1)) * 100)}%</b><i>target 90%</i></span>
            <span><em>Cycle</em><b className="ok">7m 40s</b><i>target 10m</i></span>
            <span><em>Evidence stored</em><b className="ok">{cases.length * 7}</b><i>documents</i></span>
          </div>
        </div>
      )}

      <div className="bk-stats six">
        <div><span className="k">Verifying</span><b>{counts.verifying}</b></div>
        <div className="amber"><span className="k">Awaiting review</span><b className="warn">{counts.review}</b></div>
        <div><span className="k">With authoriser</span><b>{counts.authorise}</b></div>
        <div><span className="k">Exceptions</span><b className="bad">{counts.exception}</b></div>
        <div><span className="k">Auto-rejected</span><b>{counts.rejected}</b></div>
        <div><span className="k">Accounts open</span><b className="ok">{counts.open}</b></div>
      </div>

      <div className="bk-prog"><i style={{ width: `${pct}%` }} /></div>

      <div className="bk-health">
        <span className="lb">Verification services</span>
        {(['TIN', 'CAC', 'ID_DOC', 'SANCTIONS', 'WATCHLIST', 'ADVERSE_MEDIA'] as const).map((k) => {
          const bad = cases.some((c) => c.verifications?.some((v) => v.kind === k && v.status === 'failed'));
          return <span key={k} className={bad ? 'sv warn' : 'sv ok'}>● {VERIFICATION_LABEL[k]}</span>;
        })}
        <span className="mu">Persistent failure parks the application and raises a technical exception.</span>
      </div>

      <div className="bk-filters">
        {([['all', 'All'], ['moving', 'In flight'], ['stuck', 'Needs a person'], ['done', 'Opened']] as const).map(([id, label]) => (
          <button key={id} aria-pressed={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
        <span className="mu">
          {live > 0
            ? `${live} of ${cases.length} running live in Maestro — the first ${MAESTRO_CAP} of a batch get a real orchestration, the rest are driven locally.`
            : 'No live orchestration — add a tenant token to run these in Maestro.'}
        </span>
      </div>

      <div className="bk-table mon">
        <div className="hd">
          <span>Reference</span><span>Customer</span><span>Verifications</span>
          <span>Reconciliation</span><span>Decision</span><span>Age</span>
        </div>
        {rows.slice(0, show).map((c) => {
          const failed = c.verifications?.filter((v) => v.status === 'failed') ?? [];
          const stuck = c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD';
          return (
            <div className={`rw${stuck ? ' bad' : ''}`} key={c.uid ?? c.id}>
              <span className="mono">{c.id}</span>
              <span className="nm">
                <button className="lnk nm-open" onClick={() => setOpen({ id: c.id, tab: 'case' })}>
                  {fullName(c) || 'Unnamed'}
                </button>
                {getLinkedInstance(c.id) && <span className="livedot" title="Live in Maestro" />}
              </span>
              <span className={failed.length ? 'bad' : 'ok'}>
                {failed.length ? failed.map((v) => VERIFICATION_LABEL[v.kind]).join(', ') : 'All passed'}
              </span>
              <span>{c.recon?.length
                ? <Tag tone="crit">{c.recon.map((r) => r.field).join(', ')}</Tag>
                : <span className="mu">Sources agree</span>}</span>
              <span>
                {c.accountNumber
                  ? <button className="lnk ok" onClick={() => setOpen({ id: c.id, tab: 'case' })}>{decisionLabel(c)}</button>
                  : stuck
                    ? <button className="lnk crit" onClick={() => onException(c.id)}>{decisionLabel(c)} →</button>
                    : c.reviewState === 'awaiting'
                      ? (persona === 'maker'
                        ? <button className="lnk" onClick={() => onReview(c.id)}>{decisionLabel(c)} →</button>
                        : <button className="lnk" onClick={() => setOpen({ id: c.id, tab: 'extraction' })}>{decisionLabel(c)}</button>)
                      : c.decision
                        ? <button className="lnk" onClick={() => setOpen({ id: c.id, tab: tabForDecision(c) })}>{decisionLabel(c)}</button>
                        : <span className="mu">Verifying…</span>}
              </span>
              <span className="mu">{ago(c.createdAt)}</span>
            </div>
          );
        })}
        {rows.length > show && (
          <button className="more btn" onClick={() => setShow((n) => n + WINDOW)}>
            <I n="expand" s={13} />Show {Math.min(WINDOW, rows.length - show)} more of {rows.length}
          </button>
        )}
        {!rows.length && <div className="more">Nothing in this filter.</div>}
      </div>

      {open && (() => {
        const c = cases.find((x) => x.id === open.id);
        return c ? (
          <CustomerSheet
            key={c.id}
            c={c}
            all={rows}
            tab={open.tab}
            onPick={(id) => setOpen({ id, tab: open.tab })}
            onClose={() => setOpen(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
