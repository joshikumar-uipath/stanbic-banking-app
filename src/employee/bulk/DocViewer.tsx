// ─────────────────────────────────────────────────────────────────────────────
// The document reader — one customer's bundle, a tab per document.
//
// Opened from a row on the intake screen, so an officer can see what actually
// arrived before a single case is created. That matters at intake more than
// anywhere else: this is the last point where a bad bundle can be sent back
// without an application existing to carry the problem forward.
//
// Two kinds of entry end up here and they must not look alike:
//
//   A REAL file, out of an uploaded archive, is rendered from its own bytes —
//   the image, or the PDF in the browser's viewer.
//
//   A SAMPLE-BUNDLE entry has no bytes at all; the demo bundle is synthesised
//   from names. It gets a clearly-marked placeholder that says so. Painting a
//   stock photo there would make the demo look like it had read a document it
//   has never seen, which is exactly the claim this screen must not make.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { DOC_LABEL, type DocKind } from '../bulk';
import { asText, blobUrl, humanSize, mediaFor, type ZipEntry } from './zip';
import { I, Tag } from '../ui';
import { useBank } from '../../config';

export interface ViewerDoc {
  name: string;
  kind: DocKind;
  confidence: number;
  /** Absent for the sample bundle, which has no file behind it. */
  entry?: ZipEntry;
}

export default function DocViewer({ customer, docs, missing, onClose }: {
  customer: string;
  docs: ViewerDoc[];
  missing: DocKind[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!docs.length && !missing.length) return null;

  return (
    <div className="dv-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dv" role="dialog" aria-modal="true" aria-label={`Documents for ${customer}`}>
        <header className="dv-head">
          <div className="who">
            <b>{customer}</b>
            <span>{docs.length} document{docs.length === 1 ? '' : 's'}{missing.length ? ` · missing ${missing.map((k) => DOC_LABEL[k].toLowerCase()).join(' and ')}` : ''}</span>
          </div>
          {missing.length > 0 && <Tag tone="warn">Incomplete</Tag>}
          <button className="dk-btn sm" onClick={onClose} aria-label="Close">Close</button>
        </header>
        <DocPane docs={docs} missing={missing} />
      </div>
    </div>
  );
}

/**
 * The reader itself: a tab per document, and the document. No scrim, no close —
 * so it serves both the standalone viewer and the customer sheet's Documents
 * tab without either having to reimplement rendering.
 */
export function DocPane({ docs, missing, compact = false, start = 0 }: {
  docs: ViewerDoc[]; missing: DocKind[]; compact?: boolean;
  /** Which document to open on. Clicking a named file elsewhere should land on
   *  THAT file, not on whatever happens to be first. */
  start?: number;
}) {
  const [i, setI] = useState(start);
  useEffect(() => { setI(Math.max(0, Math.min(start, docs.length - 1))); }, [start, docs.length]);
  const doc = docs[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, docs.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docs.length]);

  // One URL per document, created AND revoked inside the same effect.
  //
  // Minting it in a useMemo and revoking it in an effect cleanup looks
  // equivalent and is not: StrictMode runs every effect twice in development,
  // so the first cleanup revoked a URL the memo would not recreate, and the
  // image loaded against a dead blob (ERR_FILE_NOT_FOUND). Owning both halves
  // here means the second run gets a fresh URL.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc?.entry) { setUrl(null); return; }
    const u = blobUrl(doc.entry);
    setUrl(u);
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [doc]);

  if (!doc) {
    return (
      <div className="dv-body">
        <div className="dv-stage"><div className="dv-error"><b>No documents on this application</b>
          <p>{missing.length ? `The bundle was missing ${missing.map((k) => DOC_LABEL[k].toLowerCase()).join(' and ')}.` : 'Nothing was attached at intake.'}</p></div></div>
      </div>
    );
  }

  return (
    <>
      <div className={`dv-body${compact ? ' compact' : ''}`}>
        <nav className="dv-tabs" aria-label="Documents">
          {docs.map((d, n) => (
            <button key={d.name + n} className={n === i ? 'on' : ''} aria-current={n === i} onClick={() => setI(n)}>
              <DocThumb doc={d} />
              <span className="t">
                <span className="k">{DOC_LABEL[d.kind]}</span>
                <span className="f">{d.name}</span>
                <span className="m">
                  {d.entry?.bytes ? humanSize(d.entry.size) : d.entry?.error ? 'unreadable' : 'no file'}
                  {d.confidence ? ` · ${d.confidence.toFixed(0)}%` : ''}
                </span>
              </span>
            </button>
          ))}
          {missing.map((k) => (
            <div className="miss" key={k}>
              <span className="dv-thumb none" aria-hidden="true"><I n="alert" s={13} /></span>
              <span className="t">
                <span className="k">{DOC_LABEL[k]}</span>
                <span className="f">Not in the bundle</span>
              </span>
            </div>
          ))}
        </nav>
        <div className="dv-stage">
          <Render doc={doc} url={url} />
        </div>
      </div>

      <footer className="dv-foot">
        <span className="mu">{doc.entry?.path ?? doc.name}</span>
        <span className="nav">
          <button className="dk-btn sm" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
          <button className="dk-btn sm" disabled={i === docs.length - 1} onClick={() => setI(i + 1)}>Next →</button>
        </span>
        {url && <a className="dk-btn sm" href={url} download={doc.name}>Download</a>}
      </footer>
    </>
  );
}


/** A small live preview of a document. Same blob discipline as the stage: the
 *  URL is created and revoked in one effect, so StrictMode's double-invoke
 *  cannot leave a dead reference behind. */
export function DocThumb({ doc, size = 34 }: { doc: ViewerDoc; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc.entry || mediaFor(doc.entry) !== 'image') { setUrl(null); return; }
    const u = blobUrl(doc.entry);
    setUrl(u);
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [doc]);

  const box = { width: size, height: Math.round(size * 1.24) };
  if (url) return <img className="dv-thumb" src={url} alt="" style={box} />;
  return (
    <span className="dv-thumb none" style={box} aria-hidden="true">
      {doc.entry ? <I n="layers" s={13} /> : <I n="alert" s={13} />}
    </span>
  );
}

/** One document, rendered. Exported so the extraction split can show the scan
 *  beside the fields without duplicating the image/PDF/text handling. */
export function DocStage({ doc }: { doc: ViewerDoc }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!doc?.entry) { setUrl(null); return; }
    const u = blobUrl(doc.entry);
    setUrl(u);
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [doc]);
  return <div className="dv-stage"><Render doc={doc} url={url} /></div>;
}

function Render({ doc, url }: { doc: ViewerDoc; url: string | null }) {
  const bank = useBank();
  // No bytes: the sample bundle. Say so plainly rather than drawing something
  // that could be mistaken for a document the system has actually read.
  if (!doc.entry) {
    return (
      <div className="dv-placeholder">
        <div className="page">
          <div className="ph">
            <span>{bank.legalName}</span>
            <b>{DOC_LABEL[doc.kind]}</b>
          </div>
          <div className="lines">
            {Array.from({ length: 9 }, (_, n) => <i key={n} style={{ width: `${88 - (n % 4) * 16}%` }} />)}
          </div>
          <div className="stamp">
            <I n="alert" s={14} />
            <span><b>Sample bundle — no file behind this entry.</b> The demo bundle is generated from file names, so there is nothing to render. Upload a real .zip to read the actual documents here.</span>
          </div>
        </div>
      </div>
    );
  }

  if (doc.entry.error) {
    return (
      <div className="dv-error">
        <I n="alert" s={22} />
        <b>{doc.entry.error}</b>
        <p>This entry is in the archive but could not be decoded. The bundle may be encrypted, or built with a compression method the browser does not support.</p>
      </div>
    );
  }

  if (!url) return <div className="dv-error"><b>Nothing to show</b></div>;

  const media = mediaFor(doc.entry);
  if (media === 'image') return <img className="dv-img" src={url} alt={doc.name} />;
  if (media === 'pdf') return <iframe className="dv-frame" src={url} title={doc.name} />;
  if (media === 'text') return <pre className="dv-text">{asText(doc.entry)}</pre>;

  return (
    <div className="dv-error">
      <I n="alert" s={22} />
      <b>No preview for this file type</b>
      <p>{doc.name} is in the bundle and will be stored against the application. It just cannot be shown in the browser — download it to open it.</p>
    </div>
  );
}
