// ─────────────────────────────────────────────────────────────────────────────
// The package, read document by document — one tab per file.
//
// Opens the moment a package is picked. Each tab shows its document's pages with
// the same scanning sweep the single-form review uses (.xv-scan), then lays the
// fields read off it in, one by one. The tabs run in order on their own — the
// customer's documents first, then third-party, then the bank's — and any tab
// can be opened early. "Use these details" fills the wizard from the package.
//
// The pacing is presentation: the package was already read, in about a second,
// before this opened. What it shows is real — the pages are the uploaded files,
// the fields are what was read from each one.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './icons';
import { viewUrls, prefetchViews, fieldConfidence, inReadingOrder, PACKAGE_TYPE, PRODUCER_LABEL, type PackageFile, type PackageResult } from '../integrations/packageDocs';

/** The whole package is scanned in about this long — a single form gets all of
 *  it, a 14-file package shares it out, longer documents taking a larger share. */
const TOTAL_SCAN_MS = 17_000;
/** No document flashes past: each gets at least this. */
const MIN_SCAN_MS = 1_800;
/** The gap between one field appearing and the next. */
const FIELD_MS = 60;

type Status = 'pending' | 'scanning' | 'revealing' | 'done';

function Pages({ f, scanning, hidden, onExpand }: { f: PackageFile; scanning: boolean; hidden: boolean; onExpand: () => void }) {
  // Cached per file (packageDocs owns the URLs) — no decode, no viewer reload.
  const urls = useMemo(() => viewUrls(f), [f]);
  return (
    <div className="xv-doc prv-doc" hidden={hidden}>
      <div className="xv-doc-h">
        <span>{f.name}</span>
        <span className="xv-doc-n">{f.pages} page{f.pages === 1 ? '' : 's'} · {f.mime === 'image/tiff' ? 'TIFF' : f.mime === 'application/pdf' ? 'PDF' : 'Image'}</span>
        {urls.length > 0 && (
          <button type="button" className="prv-expand" onClick={onExpand} aria-label={`View ${f.name} full screen`} title="Full screen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
        )}
      </div>
      <div className="xv-doc-body">
        {f.mime === 'application/pdf' && urls[0]
          ? <iframe className="xv-frame" title={f.name} src={`${urls[0]}#view=FitH&toolbar=0&navpanes=0`} />
          : urls.length
            ? <div className="prv-imgs">{urls.map((u, i) => <img key={i} src={u} alt={`${f.name} page ${i + 1}`} />)}</div>
            : <div className="xv-doc-none">This file cannot be shown in the browser.</div>}
        {scanning && <div className="xv-scan" />}
        {/* On a phone the preview is too small to read and the embedded viewer
            swallows taps — so the whole preview is one "view it properly" target. */}
        {urls.length > 0 && <button type="button" className="prv-zoom" onClick={onExpand} aria-label={`View ${f.name} full screen`} />}
      </div>
    </div>
  );
}

/** One document, full screen — every page at a readable size. */
function FullView({ f, onClose }: { f: PackageFile; onClose: () => void }) {
  const urls = useMemo(() => viewUrls(f), [f]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);
  const pdf = f.mime === 'application/pdf' && !!urls[0];
  return (
    <div className="prv-full" role="dialog" aria-modal="true" aria-label={f.name}>
      <div className="prv-full-h">
        <div className="prv-full-t">
          <b>{f.name}</b>
          <span>{f.pages} page{f.pages === 1 ? '' : 's'}{pdf ? ' · pinch or scroll to read' : ''}</span>
        </div>
        {pdf && <a className="prv-full-open" href={urls[0]} target="_blank" rel="noreferrer">Open</a>}
        <button type="button" className="prv-full-x" onClick={onClose} aria-label="Close full screen"><Icon name="x" /></button>
      </div>
      <div className="prv-full-body">
        {pdf
          ? <iframe title={f.name} src={`${urls[0]}#view=FitH&navpanes=0`} />
          : <div className="prv-full-imgs">{urls.map((u, i) => <img key={i} src={u} alt={`${f.name} page ${i + 1}`} />)}</div>}
      </div>
    </div>
  );
}

export default function PackageReview({ res, onApply, onClose, mode = 'read', busy = false, error = null }: {
  res: PackageResult;
  onApply: () => void;
  onClose: () => void;
  /** 'read' animates the reading; 'confirm' (the desk) opens with every document
   *  already read — the package was scanned once, at capture. */
  mode?: 'read' | 'confirm';
  busy?: boolean;
  error?: string | null;
}) {
  // Tabs in reading order: what the customer brought, then third parties, then the bank.
  const files = useMemo(() => inReadingOrder(res.files), [res]);
  // Each document's share of the overall scan, by length.
  const scanFor = useMemo(() => {
    const w = files.map((f) => 1 + 0.15 * Math.max(0, f.pages - 1));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    return w.map((x) => Math.max(MIN_SCAN_MS, Math.round((TOTAL_SCAN_MS * x) / sum)));
  }, [files]);
  const [active, setActive] = useState(0);
  const [full, setFull] = useState<PackageFile | null>(null);
  const confirm = mode === 'confirm';
  const [status, setStatus] = useState<Status[]>(() => files.map(() => (confirm ? 'done' : 'pending')));
  const [shown, setShown] = useState<number[]>(() => files.map(() => (confirm ? Number.MAX_SAFE_INTEGER : 0)));
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  // Every tab's pages decoded in the background as soon as this opens.
  useEffect(() => prefetchViews(files), [files]);
  // Tabs already opened stay mounted (just hidden), so going back is instant.
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  useEffect(() => { setVisited((v) => (v.has(active) ? v : new Set([...v, active]))); }, [active]);

  // The tab strip scrolls sideways when there are more documents than fit: an arrow at
  // either end shows only while there is more that way, and the open tab stays in view.
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = () => {
    const el = strip.current;
    if (el) setMore({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [files]);
  useEffect(() => {
    strip.current?.querySelectorAll<HTMLElement>('.prv-tab')[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active]);
  const page = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const setAt = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));

  /** Read one tab: sweep its pages, then lay its fields in. */
  const read = (i: number) => {
    if (status[i] !== 'pending') return;
    setStatus((s) => setAt(s, i, 'scanning'));
    later(() => {
      setStatus((s) => setAt(s, i, 'revealing'));
      const n = fieldsOf(files[i]).length;
      for (let k = 1; k <= n; k++) later(() => setShown((x) => setAt(x, i, k)), k * FIELD_MS);
      later(() => setStatus((s) => setAt(s, i, 'done')), n * FIELD_MS + 120);
    }, scanFor[i]);
  };

  // The account-opening form shows the application's own fields (with their
  // confidence); every other document shows what was read off it.
  const fieldsOf = (f: PackageFile): { name: string; value: string; group?: string; confidence?: number }[] =>
    f.type === 'aof' && res.rows.length
      ? res.rows.filter((r) => r.value).map((r) => ({ name: r.name, value: r.value, group: r.group, confidence: r.confidence }))
      // Every other document: the field's estimated legibility for that kind of
      // document (packageDocs.fieldConfidence) — exact for a text layer.
      : f.fields.map((x) => ({ ...x, confidence: fieldConfidence(f.type, f.readBy, x.name, x.value) }));

  // Start on the first tab, and move on by itself once a tab is done.
  useEffect(() => {
    read(active);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    if (status[active] !== 'done') return;
    const next = status.findIndex((s, i) => i > active && s === 'pending');
    if (next >= 0) later(() => setActive((a) => (a === active ? next : a)), 700);
  }, [status, active]);

  /** Skip the pacing: every tab read now. */
  const finishAll = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setStatus(files.map(() => 'done'));
    setShown(files.map((f) => fieldsOf(f).length));
  };

  const doneCount = status.filter((s) => s === 'done').length;
  const allDone = doneCount === files.length;
  const f = files[active];
  const fields = fieldsOf(f);
  const st = status[active];

  // Rendered at the page root: inside the wizard, a transformed ancestor turns
  // `position: fixed` into "fixed to the wizard", and the dialog sat off-centre
  // and cut off. On a phone surface the root is the phone itself (#root, which
  // is the bezel in the desktop preview), so the review takes the phone's whole
  // screen instead of spreading a desktop dialog across the browser.
  const phone = document.documentElement.getAttribute('data-shell') !== 'web';
  const host = (phone && document.getElementById('root')) || document.body;
  return createPortal(
    // `cx` carries the wizard's colour and type tokens, which a portal leaves behind.
    <div className="cx prv-scrim" role="dialog" aria-modal="true" aria-label="Account-opening package">
      {full && <FullView f={full} onClose={() => setFull(null)} />}
      <div className="prv">
        <div className="prv-h">
          <div>
            <b>{files.length === 1
              ? (confirm ? 'Confirm what was read from the form' : `Reading ${PACKAGE_TYPE[files[0].type].label.toLowerCase()}`)
              : (confirm ? 'Confirm what was read from the package' : 'Reading the account-opening package')}</b>
            <span>{files.length === 1 ? files[0].name : `${doneCount} of ${files.length} documents read`} · {res.rows.filter((r) => r.value).length} application fields</span>
          </div>
          <button className="cx-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>

        <div className={`prv-tabbar${more.left ? ' l' : ''}${more.right ? ' r' : ''}`}>
        {more.left && <button type="button" className="prv-arrow l" onClick={() => page(-1)} aria-label="Earlier documents"><Icon name="arrowLeft" size={16} /></button>}
        <div className="prv-tabs" role="tablist" ref={strip} onScroll={measure}>
          {files.map((x, i) => (
            <button key={x.sha + x.name} role="tab" aria-selected={i === active}
                    className={`prv-tab ${status[i]}${i === active ? ' on' : ''}`}
                    onClick={() => setActive(i)} title={x.name}>
              <span className="prv-dot" aria-hidden>{status[i] === 'done' ? '✓' : status[i] === 'pending' ? '' : '•'}</span>
              <span className="prv-tt">{PACKAGE_TYPE[x.type].label}</span>
              <em>{PRODUCER_LABEL[PACKAGE_TYPE[x.type].producer]}</em>
            </button>
          ))}
        </div>
        {more.right && <button type="button" className="prv-arrow r" onClick={() => page(1)} aria-label="More documents"><Icon name="arrowRight" size={16} /></button>}
        </div>

        <div className="prv-body">
          <div className="prv-pages">
            {files.map((x, i) => (visited.has(i) || i === active) && (
              <Pages key={x.sha + x.name} f={x} scanning={status[i] === 'scanning'} hidden={i !== active} onExpand={() => setFull(x)} />
            ))}
          </div>
          <div className="prv-fields">
            <div className="prv-fh">
              <b>{PACKAGE_TYPE[f.type].label}</b>
              <span>
                {st === 'scanning' ? 'Reading the document…'
                  : f.readBy === 'text' ? 'Read from the file’s text layer'
                  : f.readBy === 'transcription' ? 'Read from the document (identifiers masked)'
                  : f.type === 'unknown' ? 'Not identified — nothing on it could be read in the browser'
                  : 'Identified — nothing on it could be read in the browser'}
              </span>
              {f.summary && st !== 'scanning' && <p>{f.summary}</p>}
            </div>
            {st === 'scanning' && ['l', 'm', 's', 'm'].map((w, i) => (
              <div className="xv-skel" key={i}><div className={`sk ${w}`} /><div className="sk l" /><div className="sk m" /></div>
            ))}
            {st !== 'scanning' && st !== 'pending' && (
              <dl className="prv-dl">
                {fields.slice(0, shown[active]).map((x, i) => (
                  <div key={x.name + i} className="prv-f">
                    <dt>{x.group ? `${x.group} · ${x.name}` : x.name}</dt>
                    <dd>
                      <span className="prv-v">{x.value}</span>
                      {x.confidence !== undefined && (
                        <span className={`xv-c ${x.confidence >= 90 ? 'hi' : x.confidence >= 80 ? 'mid' : 'lo'}`}>{x.confidence}%</span>
                      )}
                    </dd>
                  </div>
                ))}
                {!fields.length && st === 'done' && <p className="prv-none">No fields — this document is evidence, kept on the record.</p>}
              </dl>
            )}
          </div>
        </div>

        <div className="prv-foot">
          <span className="prv-sum">
            {error ? <b className="prv-err">{error}</b>
              : confirm ? 'Read from the package at capture. Confirming answers the case’s “Confirm extracted details” and the case moves on.'
              : allDone ? 'Every document has been read. Apply the details, then review each step before submitting.'
              : `Reading ${PACKAGE_TYPE[f.type].label.toLowerCase()}…`}
          </span>
          {!allDone && <button className="xv-btn ghost" onClick={finishAll}>Read the rest now</button>}
          <button className="xv-btn primary" disabled={!allDone || busy} onClick={onApply}>
            {confirm ? (busy ? 'Confirming…' : 'Confirm and continue') : 'Use these details'}
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
