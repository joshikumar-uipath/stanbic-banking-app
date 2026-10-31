// ─────────────────────────────────────────────────────────────────────────────
// Batches — the full-width destination for bulk account opening.
//
// Bulk used to live in the right-hand pane of Open an account, which is about
// half the window. That capped the intake preview at eight rows, rendered every
// batch row unvirtualised, and could not hold a side-by-side document review at
// all — the same reason the capture wizard was pulled out into an overlay.
//
// So bulk gets its own rail item and the whole width. Open an account keeps the
// batches in its pipeline (they still group there by `batchId`); this is the
// WORKING view: one batch at a time, with the queues that only exist for bulk.
//
// The journey crosses three people — §9.1 has a maker confirm what OCR read and
// a separate verifier open the accounts. All three jobs are on this desk, so
// they are personas rather than separate tools, and the screens a persona does
// not own are not offered to it.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase } from '../../onboarding';
import type { Persona } from '../roles';
import { listBatches, subscribeBatches, getBatch, type BatchMeta } from './batches';
import { awaitingReview, awaitingAuthorisation, inException, opened } from './engine';
import Intake from './Intake';
import Monitor from './Monitor';
import Worklist from './Worklist';
import Review from './Review';
import Authorise from './Authorise';
import ExceptionCase from './ExceptionCase';
import Invites from './Invites';
import { I } from '../ui';
import './bulk.css';

export type BulkScreen =
  | 'intake' | 'monitor' | 'worklist' | 'review' | 'authorise' | 'exception' | 'invites';

/** Live view of one batch's cases. */
function useBatchCases(batchId: string | null): OnboardingCase[] {
  const [list, setList] = useState<OnboardingCase[]>([]);
  useEffect(() => {
    if (!batchId) { setList([]); return; }
    let alive = true;
    const refresh = () => { void store.list({ batchId }).then((cs) => { if (alive) setList(cs.sort((a, b) => a.id.localeCompare(b.id))); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, [batchId]);
  return list;
}

function useBatches(): BatchMeta[] {
  const [list, setList] = useState<BatchMeta[]>(() => listBatches());
  useEffect(() => subscribeBatches(() => setList(listBatches())), []);
  return list;
}

export default function BulkOpening({ persona, onPersona }: { persona: Persona; onPersona: (p: Persona) => void }) {
  const batches = useBatches();
  const [batchId, setBatchId] = useState<string | null>(() => listBatches()[0]?.id ?? null);
  const [screen, setScreen] = useState<BulkScreen>(() => (listBatches().length ? 'monitor' : 'intake'));
  const [picked, setPicked] = useState<string | null>(null);

  const cases = useBatchCases(batchId);
  const meta = useMemo(() => (batchId ? getBatch(batchId) : null), [batchId, batches]);

  const queues = useMemo(() => ({
    review: awaitingReview(cases).length,
    authorise: awaitingAuthorisation(cases).length,
    exception: inException(cases).length,
    opened: opened(cases).length,
  }), [cases]);

  // A persona only ever lands on a screen it owns. Switching to the maker while
  // looking at the authorisation queue should show the maker's work, not an
  // empty screen with someone else's title on it.
  useEffect(() => {
    if (persona === 'maker' && screen !== 'worklist' && screen !== 'review') setScreen('worklist');
    if (persona === 'verifier' && screen !== 'authorise') setScreen('authorise');
    if (persona === 'rm' && (screen === 'worklist' || screen === 'review' || screen === 'authorise')) setScreen('monitor');
  }, [persona, screen]);

  const openBatch = (id: string) => { setBatchId(id); setScreen('monitor'); setPicked(null); };
  const review = (id: string) => { setPicked(id); setScreen('review'); };
  const exception = (id: string) => { setPicked(id); setScreen('exception'); };

  const rm = persona === 'rm';
  const tabs: { id: BulkScreen; label: string; badge?: number; show: boolean }[] = [
    { id: 'intake', label: 'New submission', show: rm },
    { id: 'monitor', label: 'Batch', show: rm && !!batchId },
    { id: 'invites', label: 'Invitations', badge: undefined, show: rm && meta?.channel === 'manifest' },
    { id: 'worklist', label: 'Review queue', badge: queues.review, show: persona === 'maker' },
    { id: 'authorise', label: 'To authorise', badge: queues.authorise, show: persona === 'verifier' },
    { id: 'exception', label: 'Exceptions', badge: queues.exception, show: rm && queues.exception > 0 },
  ];

  return (
    <div className="bk">
      <div className="bk-bar">
        <div className="bk-batches">
          <label htmlFor="bk-pick" className="lb">Batch</label>
          <select id="bk-pick" value={batchId ?? ''} onChange={(e) => openBatch(e.target.value)} disabled={!batches.length}>
            {!batches.length && <option value="">No batches yet</option>}
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.id}</option>)}
          </select>
        </div>

        <div className="bk-tabs" role="tablist">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.id} role="tab" aria-selected={screen === t.id}
              className={screen === t.id ? 'on' : ''} onClick={() => setScreen(t.id)}>
              {t.label}{t.badge ? <span className="n">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* The maker-checker crossing, in the open. §9.1 keeps these apart; the
            demo makes that visible rather than describing it in a caption. */}
        <div className="bk-persona">
          <span className="lb">Acting as</span>
          <div className="seg" role="group" aria-label="Persona">
            <button aria-pressed={persona === 'rm'} onClick={() => onPersona('rm')}>Relationship Manager</button>
            <button aria-pressed={persona === 'maker'} onClick={() => onPersona('maker')}>
              Maker{queues.review ? <span className="n">{queues.review}</span> : null}
            </button>
            <button aria-pressed={persona === 'verifier'} onClick={() => onPersona('verifier')}>
              Verifier{queues.authorise ? <span className="n">{queues.authorise}</span> : null}
            </button>
          </div>
        </div>
      </div>

      <div className="bk-body">
        {screen === 'intake' && <Intake onStarted={openBatch} />}
        {screen === 'monitor' && (meta
          ? <Monitor meta={meta} cases={cases} persona={persona} onException={exception} onReview={review} />
          : <Empty onNew={() => setScreen('intake')} />)}
        {screen === 'invites' && meta && <Invites meta={meta} cases={cases} />}
        {screen === 'worklist' && <Worklist cases={cases} meta={meta} onReview={review} />}
        {/* Keyed by the application: approving one moves straight to the next,
            and without a remount the previous reviewer's in-progress edits and
            its `busy` flag would carry over onto a different customer. The
            capture wizard learned the same lesson — see `captureSeq`. */}
        {screen === 'review' && picked && (
          <Review key={picked} id={picked} cases={cases} onDone={() => setScreen('worklist')} onNext={review} />
        )}
        {screen === 'authorise' && <Authorise cases={cases} meta={meta} />}
        {screen === 'exception' && (
          <ExceptionCase cases={cases} picked={picked} onPick={setPicked} onBack={() => setScreen('monitor')} />
        )}
      </div>
    </div>
  );
}

function Empty({ onNew }: { onNew: () => void }) {
  return (
    <div className="bk-empty">
      <div className="ic"><I n="layers" s={26} /></div>
      <b>No batch open</b>
      <p>Submit a manifest or a bundle of account opening packages, and the whole batch is processed here.</p>
      <button className="dk-btn pri" onClick={onNew}><I n="upload" s={14} />New submission</button>
    </div>
  );
}
