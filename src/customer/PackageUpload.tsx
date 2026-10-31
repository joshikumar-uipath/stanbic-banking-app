// ─────────────────────────────────────────────────────────────────────────────
// "Upload a package" — the whole account-opening file at once.
//
// Sits beside the single-form upload and shares nothing with it: the single form
// goes to the Maestro case's IXP; a package is classified and read here, in the
// browser (src/integrations/packageDocs). What comes out is the same confirmed
// rows the single-form review produces, handed to the wizard by `onApply` — from
// there the application is captured, submitted and its case started exactly as a
// typed one is.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import Icon from './icons';
import PackageReview from './PackageReview';
import {
  readPackage, viewUrls, inReadingOrder, PACKAGE_TYPE, PRODUCER_LABEL,
  type PackageFile, type PackageResult, type Producer,
} from '../integrations/packageDocs';

const ORDER: Producer[] = ['customer', 'third-party', 'bank'];

function Viewer({ f, onClose }: { f: PackageFile; onClose: () => void }) {
  // Cached per file by packageDocs, which owns the URLs.
  const urls = useMemo(() => viewUrls(f), [f]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pk-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pk-viewer" role="dialog" aria-label={f.name}>
        <div className="pk-vh">
          <div>
            <b>{PACKAGE_TYPE[f.type].label}</b>
            <span>{f.name} · {f.pages} page{f.pages === 1 ? '' : 's'}</span>
          </div>
          <button className="cx-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="pk-vbody">
          <div className="pk-pages">
            {f.mime === 'application/pdf' && urls[0]
              ? <iframe title={f.name} src={`${urls[0]}#view=FitH`} />
              : urls.length ? urls.map((u, i) => <img key={i} src={u} alt={`${f.name} page ${i + 1}`} />)
              : <div className="pk-none">This file cannot be shown in the browser.</div>}
          </div>
          <aside className="pk-read">
            <div className="pk-eyebrow">What was read</div>
            {f.summary && <p className="pk-sum">{f.summary}</p>}
            {f.fields.length ? (
              <dl>
                {f.fields.map((x) => <div key={x.name}><dt>{x.name}</dt><dd>{x.value}</dd></div>)}
              </dl>
            ) : <p className="pk-sum">No fields read from this file.</p>}
            <p className="pk-src">
              {f.readBy === 'text' ? 'Read from the file’s text layer.'
                : f.readBy === 'transcription' ? 'From the checked transcription of this document (identifiers masked).'
                : 'Classified only — nothing on it could be read in the browser.'}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function PackageUpload({ kind, onApply }: {
  /** Which wizard this sits in — a package of the other kind is flagged, not refused. */
  kind: 'individual' | 'business';
  onApply: (r: PackageResult) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'reading' | 'ready' | 'applied'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0, name: '' });
  const [res, setRes] = useState<PackageResult | null>(null);
  const [open, setOpen] = useState<PackageFile | null>(null);
  /** The tabbed, document-by-document read — opens as soon as the files are read. */
  const [reviewing, setReviewing] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setPhase('reading');
    const r = await readPackage(files, (done, total, name) => setProgress({ done, total, name }));
    setRes(r);
    setPhase('ready');
    setReviewing(true);
  };
  const apply = () => { if (!res) return; onApply(res); setPhase('applied'); setReviewing(false); };

  if (phase === 'idle') {
    return (
      <label className="cx-drop pk-drop">
        <input type="file" multiple accept=".pdf,.tif,.tiff,.zip,image/*,application/pdf,application/zip" onChange={(e) => void onPick(e)} hidden />
        <span className="cx-drop-ic"><Icon name="doc" size={18} /></span>
        <span className="cx-drop-t">
          <b>Have the whole account-opening package? Upload it</b>
          <em>Select every file at once (PDF, TIFF or a ZIP) — each one is identified, sorted by who produced it, and read to fill this in.</em>
        </span>
      </label>
    );
  }
  if (phase === 'reading') {
    return (
      <div className="cx-drop reading">
        <span className="cx-spin" aria-hidden />
        <span className="cx-drop-t">
          <b>Reading the package — {Math.min(progress.done + 1, progress.total)} of {progress.total || '…'}</b>
          <em>{progress.name || 'Opening the files'}</em>
        </span>
      </div>
    );
  }
  if (!res) return null;

  const filled = res.rows.filter((r) => r.value).length;
  const wrongKind = res.kind !== 'unknown' && res.kind !== kind;
  const sorted = inReadingOrder(res.files);
  const byProducer = ORDER.map((p) => [p, sorted.filter((f) => PACKAGE_TYPE[f.type].producer === p)] as const).filter(([, fs]) => fs.length);
  const unknown = res.files.filter((f) => f.type === 'unknown').length;

  return (
    <div className="pk">
      <div className="pk-head">
        <div>
          <b>{res.files.length} document{res.files.length === 1 ? '' : 's'} · {filled} fields read</b>
          <span>
            {phase === 'applied' ? 'Applied to this application — review each step before submitting.'
              : 'Each file was identified and read. Apply the details, then review each step.'}
            {unknown ? ` ${unknown} file${unknown === 1 ? '' : 's'} could not be identified.` : ''}
          </span>
          {wrongKind && (
            <span className="pk-warn">
              This looks like {res.kind === 'business' ? 'a business' : 'an individual'} package — switch to the {res.kind === 'business' ? 'Corporate' : 'Individual'} tab to apply it.
            </span>
          )}
        </div>
        <div className="pk-acts">
          <button className="cx-btn ghost" onClick={() => { setRes(null); setPhase('idle'); }}>Remove</button>
          <button className="cx-btn ghost" onClick={() => setReviewing(true)}>Open the review</button>
          {phase !== 'applied' && (
            <button className="cx-btn" disabled={!filled || wrongKind} onClick={apply}>Use these details</button>
          )}
        </div>
      </div>

      {byProducer.map(([p, fs]) => (
        <div className="pk-group" key={p}>
          <div className="pk-eyebrow">{PRODUCER_LABEL[p]} <em>{fs.length}</em></div>
          {fs.map((f) => (
            <button key={f.sha + f.name} className="pk-row" onClick={() => setOpen(f)} title="Open the document and what was read">
              <span className={`pk-type ${f.type === 'unknown' ? 'unk' : ''}`}>{PACKAGE_TYPE[f.type].label}</span>
              <span className="pk-file">{f.name}</span>
              <span className="pk-meta">{f.pages}p · {f.mime === 'image/tiff' ? 'TIFF' : f.mime === 'application/pdf' ? 'PDF' : 'Image'}</span>
              <span className={`pk-read-tag ${f.readBy}`}>
                {f.readBy === 'text' ? `${f.fields.length} read` : f.readBy === 'transcription' ? `${f.fields.length} read` : 'Classified'}
              </span>
            </button>
          ))}
        </div>
      ))}
      {open && <Viewer f={open} onClose={() => setOpen(null)} />}
      {reviewing && !wrongKind && <PackageReview res={res} onApply={apply} onClose={() => setReviewing(false)} />}
    </div>
  );
}
