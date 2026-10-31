// ─────────────────────────────────────────────────────────────────────────────
// Intake — pick a channel, submit, and see what was rejected before it ran.
//
// The two channels are genuinely different acts, not two file pickers:
//
//   Manifest  A control list naming who may be onboarded. It carries a handful
//             of identifying columns and NO application data — the BRD is
//             explicit that it is "a manifest, not a data substitute". Each
//             named person is emailed a link and fills the form themselves, so
//             nothing is OCR'd and no one has to confirm it afterwards.
//
//   Bundle    Filled account opening packages. The splitter separates one
//             customer per AOP, IXP reads them, and because a machine did the
//             reading a person must confirm it before any account is created.
//
// Whichever it is, intake refuses what it cannot process and says why — a
// silent drop leaves the submitter wondering where their customers went.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import { getActiveCountry } from '../../config/countries';
import type { BulkChannel } from '../../onboarding';
import { sampleZipApplicants, type ExtractedApplicant } from '../bulk';
import { newBatchId, type IntakeRejection } from './batches';
import DocViewer, { type ViewerDoc } from './DocViewer';
import type { ZipEntry } from './zip';
import { readBundle, runBatch, validateIntake } from './engine';
import { SEGMENTS, MANIFEST_COLUMNS, sampleManifest, parseManifest } from './bulkModel';
import { I, Tag } from '../ui';

const CO = getActiveCountry();

type Phase = 'compose' | 'checked';

export default function Intake({ onStarted }: { onStarted: (batchId: string) => void }) {
  const [channel, setChannel] = useState<BulkChannel>('bundle');
  const [name, setName] = useState('');
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [branch, setBranch] = useState(`${CO.cities[0]} — 0042`);
  const [manifest, setManifest] = useState('');
  const [bundle, setBundle] = useState<ExtractedApplicant[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [reading, setReading] = useState(false);
  /** The archive's files, kept so the viewer can render the real document
   *  rather than a drawing of one. Empty for the sample bundle. */
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [viewing, setViewing] = useState<ExtractedApplicant | null>(null);
  const [phase, setPhase] = useState<Phase>('compose');
  const [accepted, setAccepted] = useState<ExtractedApplicant[]>([]);
  const [rejections, setRejections] = useState<IntakeRejection[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitted = channel === 'manifest'
    ? manifest.split(/\r?\n/).filter((l) => l.trim()).length - (/reference|name|bvn/i.test(manifest.split(/\r?\n/)[0] ?? '') ? 1 : 0)
    : bundle.length;
  const ready = channel === 'manifest' ? manifest.trim().length > 0 : bundle.length > 0;

  const onFile = (f: File) => {
    if (channel === 'manifest') {
      const r = new FileReader();
      r.onload = () => setManifest(String(r.result));
      r.readAsText(f);
      return;
    }
    setBundleName(f.name); setReading(true); setBundle([]); setEntries([]);
    const r = new FileReader();
    r.onload = () => {
      void readBundle(r.result as ArrayBuffer).then(({ found, entries: es }) => {
        setBundle(found); setEntries(es); setReading(false);
      }).catch(() => { setReading(false); alert('Could not read that archive.'); });
    };
    r.onerror = () => { setReading(false); alert('Could not read that file. Use a .zip.'); };
    r.readAsArrayBuffer(f);
  };

  const check = () => {
    if (channel === 'manifest') {
      const { rows, bad } = parseManifest(manifest);
      setAccepted(rows); setRejections(bad);
    } else {
      const r = validateIntake(bundle);
      setAccepted(r.accepted); setRejections(r.rejections);
    }
    setPhase('checked');
  };

  const start = async () => {
    setBusy(true);
    const id = newBatchId();
    await runBatch(accepted, {
      batchId: id,
      name: name.trim() || (channel === 'manifest' ? 'Manifest batch' : 'AOP batch'),
      channel, segment, branch,
      corporate: !segment.startsWith('Retail'),
      submitted, rejections, entries,
    });
    onStarted(id);
  };

  if (phase === 'checked') {
    return (
      <div className="bk-pane">
        <header className="bk-head">
          <div>
            <h1>Intake validation</h1>
            <p>Completeness is checked before anything is processed. Nothing incomplete enters the pipeline.</p>
          </div>
          <span className="bk-br">BR-SUB-05 · BR-SUB-08 · BR-SUB-10</span>
        </header>

        <div className="bk-stats four">
          <div><span className="k">Submitted</span><b>{submitted}</b></div>
          <div><span className="k">Identified</span><b>{accepted.length + rejections.length}</b></div>
          <div><span className="k">Accepted</span><b className="ok">{accepted.length}</b></div>
          <div><span className="k">Rejected at intake</span><b className="bad">{rejections.length}</b></div>
        </div>

        {rejections.length > 0 ? (
          <>
            <div className="bk-sub">Rejected — returned to you with a reason, not silently dropped</div>
            <div className="bk-table rej">
              <div className="hd"><span>Source</span><span>Customer</span><span>Why it was rejected</span><span>Action</span></div>
              {rejections.map((r, i) => (
                <div className="rw" key={i}>
                  <span className="mono">{r.source}</span>
                  <span>{r.customer || <em className="mu">Not identified</em>}</span>
                  <span className="bad">{r.reason}</span>
                  <span>{r.fixable
                    ? <button className="dk-btn sm">Re-upload</button>
                    : <button className="dk-btn sm">Review</button>}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bk-ok">Every row passed intake. Nothing to send back.</div>
        )}

        <footer className="bk-foot">
          <button className="dk-btn" onClick={() => setPhase('compose')}>Back</button>
          <span className="mu">
            {rejections.length > 0
              ? `The ${rejections.length} rejected row${rejections.length === 1 ? '' : 's'} stay here until replaced — they are not counted against the batch.`
              : 'All clear.'}
          </span>
          <button className="dk-btn pri lg" disabled={!accepted.length || busy} onClick={() => void start()}>
            {busy ? 'Starting…' : `Process ${accepted.length} application${accepted.length === 1 ? '' : 's'} →`}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="bk-pane">
      <header className="bk-head">
        <div>
          <h1>New submission</h1>
          <p>One submission, many customers. Both channels feed the same downstream process.</p>
        </div>
        <span className="bk-br">BR-SUB-01 · BR-SUB-02 · BR-SUB-04</span>
      </header>

      <div className="bk-channels">
        <button className={`ch${channel === 'manifest' ? ' on' : ''}`} onClick={() => setChannel('manifest')} aria-pressed={channel === 'manifest'}>
          <span className="rd" />
          <span className="t">
            <b>Excel manifest</b>
            <span>A control list of who may be onboarded — a reference and the identifiers that pin each person down. Everyone named is emailed a link and fills the form themselves.</span>
            <span className="tags"><Tag tone="idle">Structured at intake</Tag><Tag tone="good">No review needed</Tag></span>
          </span>
        </button>
        <button className={`ch${channel === 'bundle' ? ' on' : ''}`} onClick={() => setChannel('bundle')} aria-pressed={channel === 'bundle'}>
          <span className="rd" />
          <span className="t">
            <b>AOP bundle</b>
            <span>Filled account opening packages and their supporting documents. The splitter separates one customer per AOP and IXP reads them.</span>
            <span className="tags"><Tag tone="idle">OCR extraction</Tag><Tag tone="warn">Ops review before creation</Tag></span>
          </span>
        </button>
      </div>

      <div className="bk-fields">
        <label><span>Batch name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${CO.companies[3] ?? CO.companies[0]} — Sept drive`} />
        </label>
        <label><span>Segment</span>
          <select value={segment} onChange={(e) => setSegment(e.target.value)}>
            {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label><span>Booking branch</span>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            {CO.cities.slice(0, 3).map((c, i) => <option key={c}>{c} — {String(42 + i * 11).padStart(4, '0')}</option>)}
          </select>
        </label>
      </div>

      {channel === 'manifest' ? (
        <>
          <label className="bk-area">
            <span>Manifest rows — {MANIFEST_COLUMNS.join(', ')}</span>
            <textarea value={manifest} onChange={(e) => setManifest(e.target.value)} spellCheck={false}
              placeholder="Paste the manifest, upload a .csv, or load the sample…" />
          </label>
          <div className="bk-tools">
            <button className="dk-btn" onClick={() => fileRef.current?.click()}><I n="upload" s={14} />Upload .csv</button>
            <button className="dk-btn" onClick={() => setManifest(sampleManifest())}>Load a sample manifest</button>
            {manifest && <button className="dk-btn" onClick={() => setManifest('')}>Clear</button>}
            <span className="mu">{submitted > 0 ? `${submitted} row${submitted === 1 ? '' : 's'}` : 'No rows yet'}</span>
          </div>
        </>
      ) : (
        <>
          <div className="bk-drop">
            <span className="ic"><I n="upload" s={20} /></span>
            <div className="t">
              <b>{bundleName || 'No bundle chosen'}</b>
              <span>{reading ? 'Reading documents · classifying with IXP…' : bundle.length ? `${bundle.length} customers found — one folder of documents each` : 'One folder of documents per customer, or a flat bundle the splitter will separate'}</span>
            </div>
            <button className="dk-btn" onClick={() => fileRef.current?.click()}>Choose .zip</button>
            <button className="dk-btn" onClick={() => { setBundleName('sample-documents.zip'); setReading(true); window.setTimeout(() => { setBundle(sampleZipApplicants()); setEntries([]); setReading(false); }, 700); }}>Load a sample bundle</button>
          </div>
          {bundle.length > 0 && !reading && (
            <div className="bk-table prev">
              <div className="hd"><span>Customer</span><span>Documents found</span><span>Completeness</span></div>
              {bundle.slice(0, 10).map((a, i) => (
                <button className="rw click" key={i} onClick={() => setViewing(a)}
                  title={`Open ${`${a.firstName} ${a.lastName}`.trim()}'s documents`}>
                  <span>{`${a.firstName} ${a.lastName}`.trim()}</span>
                  <span className="mu">{a.docs.map((d) => d.file).join(' · ') || '—'}</span>
                  <span>
                    {a.complete ? <Tag tone="good">Complete</Tag> : <Tag tone="warn">Missing {a.missing.join(' + ')}</Tag>}
                    <span className="open"><I n="search" s={13} />View</span>
                  </span>
                </button>
              ))}
              {bundle.length > 10 && <div className="more">+ {bundle.length - 10} more</div>}
            </div>
          )}
        </>
      )}

      <input ref={fileRef} type="file" accept={channel === 'manifest' ? '.csv,text/csv' : '.zip,application/zip'}
        style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

      <div className="bk-note">
        Up to <b>200</b> customers per submission · <b>50</b> per session · every application gets a reference that follows it to the evidence store.
      </div>

      {viewing && (
        <DocViewer
          customer={`${viewing.firstName} ${viewing.lastName}`.trim() || 'Unnamed'}
          missing={viewing.missing}
          docs={viewing.docs.map<ViewerDoc>((d) => ({
            name: d.file, kind: d.kind, confidence: d.confidence,
            // Match on the file name within this customer's folder: a bundle
            // can hold ten `national-id.jpg`, one per person.
            entry: entries.find((e) => e.name === d.file
              && e.path.toLowerCase().includes(viewing.firstName.toLowerCase())),
          }))}
          onClose={() => setViewing(null)}
        />
      )}

      <footer className="bk-foot">
        <span className="mu">Nothing is created until intake has checked the submission.</span>
        <button className="dk-btn pri lg" disabled={!ready} onClick={check}>
          Validate {submitted > 0 ? submitted : ''} {channel === 'manifest' ? 'row' : 'customer'}{submitted === 1 ? '' : 's'} →
        </button>
      </footer>
    </div>
  );
}
