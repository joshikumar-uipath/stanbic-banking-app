// ─────────────────────────────────────────────────────────────────────────────
// Review worklist — the maker's queue.
//
// Sorted by lowest confidence first, because the point of a review queue is to
// put the doubtful work in front of the person, not to make them read 21
// applications in upload order to find the three that need them.
//
// BR-DOC-13 targets an average handle time under five minutes. That is a
// property of the QUEUE, not of one screen: it needs a running count, a next
// action that does not go via a list, and a visible sense of what is left.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { confidenceThresholdPct } from '../../integrations/docRules';
import { averageHandleMs, HANDLE_TARGET_MS, mmss } from './handleTime';
import { fullName, type OnboardingCase } from '../../onboarding';
import type { BatchMeta } from './batches';
import { awaitingReview } from './engine';
import { Tag } from '../ui';
import { ago } from '../time';

type Lens = 'all' | 'low' | 'recon' | 'aged';

export default function Worklist({ cases, meta, onReview }: {
  cases: OnboardingCase[]; meta: BatchMeta | null; onReview: (id: string) => void;
}) {
  const [lens, setLens] = useState<Lens>('all');
  const queue = useMemo(
    () => awaitingReview(cases).sort((a, b) => (a.extractionConfidence ?? 100) - (b.extractionConfidence ?? 100)),
    [cases],
  );

  const low = queue.filter((c) => (c.extractionConfidence ?? 100) < confidenceThresholdPct());
  const recon = queue.filter((c) => (c.recon?.length ?? 0) > 0);
  const aged = queue.filter((c) => Date.now() - Date.parse(c.createdAt) > 24 * 3600_000);

  const shown = lens === 'low' ? low : lens === 'recon' ? recon : lens === 'aged' ? aged : queue;

  if (meta?.channel === 'manifest') {
    return (
      <div className="bk-pane">
        <header className="bk-head">
          <div><h1>Extraction review</h1><p>Nothing to review on this batch.</p></div>
        </header>
        <div className="bk-ok">
          This is a <b>manifest</b> batch — every customer typed their own details into a structured form, so
          nothing was read by a machine and there is nothing for a maker to confirm. The review checkpoint
          exists only for the AOP bundle channel.
        </div>
      </div>
    );
  }

  return (
    <div className="bk-pane">
      <header className="bk-head">
        <div>
          <h1>Extraction review <span className="n">{queue.length} waiting</span></h1>
          <p>Because the data was read by OCR, a person confirms it against the form before any account is created.</p>
        </div>
        <span className="bk-br">BR-DOC-10 · BR-DOC-13 · §9.1 maker</span>
      </header>

      <div className="bk-filters">
        {([['all', `All ${queue.length}`], ['low', `Low confidence ${low.length}`], ['recon', `Reconciliation ${recon.length}`], ['aged', `Aged over 24h ${aged.length}`]] as const).map(([id, label]) => (
          <button key={id} aria-pressed={lens === id} className={lens === id ? 'on' : ''} onClick={() => setLens(id as Lens)}>{label}</button>
        ))}
        <span className="mu">Sorted by lowest confidence first</span>
        {(() => {
          const { avg, n } = averageHandleMs();
          return n ? (
            <span className={`bk-handle${avg > HANDLE_TARGET_MS ? ' over' : ''}`} title="Average maker handle time across reviews at this desk (BR-DOC-13)">
              Avg handle time <b>{mmss(avg)}</b> · target 5:00 · {n} review{n === 1 ? '' : 's'}
            </span>
          ) : <span className="bk-handle">Handle time is measured from the first review</span>;
        })()}
      </div>

      {shown.length ? (
        <>
          <div className="bk-table wl">
            <div className="hd">
              <span>Reference</span><span>Customer</span><span>Confidence</span>
              <span>Needs your eye on</span><span>Age</span><span />
            </div>
            {shown.map((c) => {
              const conf = c.extractionConfidence ?? 100;
              const weak = Object.entries(c.fieldConfidence ?? {}).filter(([, v]) => v < confidenceThresholdPct()).length;
              const old = Date.now() - Date.parse(c.createdAt) > 24 * 3600_000;
              return (
                <div className={`rw${conf < confidenceThresholdPct() ? ' amber' : ''}`} key={c.uid ?? c.id}>
                  <span className="mono">{c.id}</span>
                  <span className="nm">{fullName(c) || 'Unnamed'}</span>
                  <span className="conf">
                    <i className={conf < confidenceThresholdPct() ? 'warn' : 'ok'}><b style={{ width: `${conf}%` }} /></i>
                    <em className={conf < confidenceThresholdPct() ? 'warn' : 'ok'}>{conf}%</em>
                  </span>
                  <span className="mu">
                    {c.recon?.length
                      ? <span className="bad">{c.recon.map((r) => r.field).join(' and ')} does not reconcile</span>
                      : weak ? `${weak} field${weak === 1 ? '' : 's'} below threshold`
                      : 'Nothing flagged — confirm and move on'}
                  </span>
                  <span className={old ? 'bad' : 'mu'}>{ago(c.createdAt)}</span>
                  <span><button className="dk-btn sm pri" onClick={() => onReview(c.id)}>Review</button></span>
                </div>
              );
            })}
          </div>

          <footer className="bk-foot">
            <span className="mu">
              Any field read below <b>{confidenceThresholdPct()}%</b> is ringed for a quick correction — the threshold is rule 1 of the Document rules DMN, editable in Ops → Rules.
            </span>
            <button className="dk-btn pri lg" onClick={() => onReview(shown[0].id)}>Review next →</button>
          </footer>
        </>
      ) : (
        <div className="bk-ok">
          {queue.length
            ? 'Nothing in this filter — try another.'
            : <>Queue is clear. Everything on this batch has been confirmed and is with the verifier. <Tag tone="good">0 waiting</Tag></>}
        </div>
      )}
    </div>
  );
}
