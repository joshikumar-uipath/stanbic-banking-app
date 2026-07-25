// ─────────────────────────────────────────────────────────────────────────────
// Bulk upload — staff open many accounts from one file (Channel: 'bulk').
//
// Paste or upload a CSV of employees, preview it, and open them all as a batch.
// Each row becomes a normal case on the shared store, so the batch flows through
// Ops, Kafka and Finacle like any other — most straight through, a few landing
// in Operations. Lives in the desk's Open-an-account right pane.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { store, stateMeta, fullName, type OnboardingCase } from '../../onboarding';
import {
  parseCsv, runBulk, SAMPLE_CSV, type BulkRow,
  readZipEntries, extractFromZip, sampleZipApplicants, runZipBatch, DOC_LABEL,
  type ExtractedApplicant, type DocKind,
} from '../bulk';
import { I, Tag, Dot, Stat, type Tone } from '../ui';
import { getActiveCountry, kycLabel } from '../../config/countries';

const CO = getActiveCountry();

const TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };

/** Live view of one batch's cases, off the shared store. */
function useBatch(batchId: string | null): OnboardingCase[] {
  const [list, setList] = useState<OnboardingCase[]>([]);
  useEffect(() => {
    if (!batchId) return;   // batchId only ever goes null → id here; list starts []
    let alive = true;
    const refresh = () => { void store.list({ batchId }).then((cs) => { if (alive) setList(cs.sort((a, b) => a.id.localeCompare(b.id))); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, [batchId]);
  return list;
}

type Mode = 'csv' | 'zip';

export default function BulkUpload({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<Mode>('csv');
  const [employer, setEmployer] = useState('');
  const [csv, setCsv] = useState('');
  const [applicants, setApplicants] = useState<ExtractedApplicant[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [zipName, setZipName] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<BulkRow[]>(() => parseCsv(csv), [csv]);
  const batchCases = useBatch(batchId);

  const onCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result));
    reader.onerror = () => alert('Could not read that file. Use a .csv.');
    reader.readAsText(file);
  };

  // Read the ZIP's file list, then run the mock IXP extraction (with a beat so the
  // "reading documents" step is visible).
  const onZipFile = (file: File) => {
    setZipName(file.name);
    setExtracting(true);
    setApplicants([]);
    const reader = new FileReader();
    reader.onload = () => {
      const entries = readZipEntries(reader.result as ArrayBuffer);
      const found = extractFromZip(entries);
      window.setTimeout(() => {
        setApplicants(found.length ? found : sampleZipApplicants());
        if (!found.length) setZipName(`${file.name} · unreadable — showing a sample bundle`);
        setExtracting(false);
      }, 900);
    };
    reader.onerror = () => { setExtracting(false); alert('Could not read that file. Use a .zip.'); };
    reader.readAsArrayBuffer(file);
  };
  const loadSampleZip = () => { setZipName('sample-documents.zip'); setExtracting(true); window.setTimeout(() => { setApplicants(sampleZipApplicants()); setExtracting(false); }, 900); };

  const submitCsv = () => { if (!rows.length) return; const id = `BATCH-${String(Date.now()).slice(-6)}`; void runBulk(rows, employer, id); setBatchId(id); };
  const submitZip = () => { if (!applicants.length) return; const id = `BATCH-${String(Date.now()).slice(-6)}`; void runZipBatch(applicants, employer, id); setBatchId(id); };

  if (batchId) return <BatchProgress cases={batchCases} employer={employer} batchId={batchId} onExit={onExit} />;

  const completeN = applicants.filter((a) => a.complete).length;

  return (
    <div className="dk-bulk">
      <div className="dk-bulk-head">
        <div>
          <h2>Bulk upload</h2>
          <div className="sub">Open many accounts at once — each is verified in the background.</div>
        </div>
        <button className="dk-btn" onClick={onExit}>Cancel</button>
      </div>

      <div className="dk-bulk-body">
        <div className="dk-bseg" role="tablist">
          <button role="tab" aria-selected={mode === 'csv'} className={mode === 'csv' ? 'on' : ''} onClick={() => setMode('csv')}><I n="layers" s={14} />Payroll · CSV</button>
          <button role="tab" aria-selected={mode === 'zip'} className={mode === 'zip' ? 'on' : ''} onClick={() => setMode('zip')}><I n="upload" s={14} />Documents · ZIP</button>
        </div>

        <label className="dk-field">
          <span>Employer / batch name</span>
          <input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder={`e.g. ${CO.companies[3] ?? CO.companies[0]} payroll`} />
        </label>

        {mode === 'csv' ? (
          <>
            <label className="dk-field">
              <span>Rows (CSV: first name, last name, phone, email, {kycLabel('BVN', CO)}, {kycLabel('NIN', CO)}, address)</span>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Paste rows here, upload a .csv, or load the sample…" spellCheck={false} />
            </label>
            <div className="dk-bulk-tools">
              <button className="dk-btn" onClick={() => csvRef.current?.click()}><I n="upload" s={14} />Upload .csv</button>
              <button className="dk-btn" onClick={() => setCsv(SAMPLE_CSV)}>Load sample payroll</button>
              {csv && <button className="dk-btn" onClick={() => setCsv('')}>Clear</button>}
              <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.target.value = ''; }} />
              <span className="dk-bulk-count">{rows.length ? `${rows.length} row${rows.length === 1 ? '' : 's'} ready` : 'No rows yet'}</span>
            </div>
            {rows.length > 0 && (
              <div className="dk-rows" style={{ marginTop: 4 }}>
                <div className="dk-cols" style={GRID}><span>Applicant</span><span>Phone</span><span>{kycLabel('BVN', CO)}</span><span>{kycLabel('NIN', CO)}</span></div>
                {rows.slice(0, 8).map((r, i) => (
                  <div key={i} className="dk-row" style={{ ...GRID, cursor: 'default' }}>
                    <span className="nm">{`${r.firstName} ${r.lastName}`.trim() || '—'}</span>
                    <span className="rf num">{r.phone || '—'}</span>
                    <span className="rf num">{r.bvn || '—'}</span>
                    <span className="rf num">{r.nin || '—'}</span>
                  </div>
                ))}
                {rows.length > 8 && <div className="dk-bulk-more">+ {rows.length - 8} more</div>}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="dk-bulk-tools">
              <button className="dk-btn" onClick={() => zipRef.current?.click()}><I n="upload" s={14} />Upload .zip</button>
              <button className="dk-btn" onClick={loadSampleZip}>Load sample bundle</button>
              {applicants.length > 0 && <button className="dk-btn" onClick={() => { setApplicants([]); setZipName(''); }}>Clear</button>}
              <input ref={zipRef} type="file" accept=".zip,application/zip" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onZipFile(f); e.target.value = ''; }} />
              <span className="dk-bulk-count">{zipName || 'One folder of documents per applicant'}</span>
            </div>

            {extracting && (
              <div className="dk-ixp-scan"><span className="spin" /> Reading documents · classifying with IXP…</div>
            )}

            {applicants.length > 0 && !extracting && (
              <>
                <div className="dk-ixp-note">IXP extracted <b>{applicants.length}</b> applicant{applicants.length === 1 ? '' : 's'} — <b>{completeN}</b> complete{completeN < applicants.length ? `, ${applicants.length - completeN} missing a document` : ''}.</div>
                <div className="dk-rows" style={{ marginTop: 4 }}>
                  <div className="dk-cols" style={ZGRID}><span>Applicant</span><span>Documents extracted</span><span>Completeness</span></div>
                  {applicants.map((a, i) => (
                    <div key={i} className="dk-row" style={{ ...ZGRID, cursor: 'default' }}>
                      <span className="nm">{`${a.firstName} ${a.lastName}`.trim() || '—'}</span>
                      <span className="dk-docchips">
                        {(['id', 'address', 'selfie'] as DocKind[]).map((k) => {
                          const has = a.docs.some((d) => d.kind === k);
                          return <span key={k} className={`dk-docchip ${has ? 'ok' : 'miss'}`}>{has ? '✓' : '✗'} {DOC_LABEL[k]}</span>;
                        })}
                      </span>
                      <span>{a.complete ? <Tag tone="good">Complete</Tag> : <Tag tone="warn">Needs {a.missing.map((k) => DOC_LABEL[k]).join(' + ')}</Tag>}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="dk-bulk-foot">
        {mode === 'csv' ? (
          <button className="dk-btn pri lg" disabled={!rows.length} onClick={submitCsv}>
            <I n="layers" s={15} />Open {rows.length || ''} account{rows.length === 1 ? '' : 's'}
          </button>
        ) : (
          <button className="dk-btn pri lg" disabled={!applicants.length} onClick={submitZip}>
            <I n="layers" s={15} />Process {applicants.length || ''} applicant{applicants.length === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </div>
  );
}

function BatchProgress({ cases, employer, batchId, onExit }: { cases: OnboardingCase[]; employer: string; batchId: string; onExit: () => void }) {
  const total = cases.length;
  const settled = cases.filter((c) => c.state === 'ACCOUNT_CREATED' || c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS' || c.state === 'FULLY_ACTIVATED').length;
  const exceptions = cases.filter((c) => c.state === 'EXCEPTION').length;
  const done = settled + exceptions;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const running = done < total;

  return (
    <div className="dk-bulk">
      <div className="dk-bulk-head">
        <div>
          <h2>{employer || 'Bulk batch'}</h2>
          <div className="sub num">{batchId} · {total} applications</div>
        </div>
        <button className="dk-btn" onClick={onExit}>Back to pipeline</button>
      </div>

      <div className="dk-bulk-body">
        <div className="dk-health" style={{ padding: 0, border: 'none', marginBottom: 8 }}>
          <Stat k="Opened" v={settled} tone={settled ? '#16a34a' : undefined} />
          <Stat k="Exceptions" v={exceptions} tone={exceptions ? '#dc2626' : undefined} />
          <Stat k="Processing" v={total - done} />
        </div>

        <div className="dk-bulk-bar"><i style={{ width: `${pct}%`, background: running ? 'var(--d-accent)' : 'var(--d-green)' }} /></div>
        <div className="dk-bulk-status">{running ? `Processing… ${done} of ${total} complete` : `Done — ${settled} account${settled === 1 ? '' : 's'} open${exceptions ? `, ${exceptions} in Operations` : ''}`}</div>

        <div className="dk-rows" style={{ marginTop: 10 }}>
          <div className="dk-cols" style={GRID2}><span>Applicant</span><span>Reference</span><span>Status</span></div>
          {cases.map((c) => {
            const m = stateMeta(c.state);
            const tone = TONE[m.tone] ?? 'idle';
            return (
              <div key={c.id} className="dk-row" style={{ ...GRID2, cursor: 'default' }}>
                <span className="who"><Dot tone={tone} live={tone === 'info'} /><span className="nm">{fullName(c).trim() || 'Unnamed'}</span></span>
                <span className="rf num">{c.accountNumber ? `Acct ${c.accountNumber}` : c.id}</span>
                <span><Tag tone={tone}>{m.label}</Tag></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dk-bulk-foot">
        <button className="dk-btn pri lg" onClick={onExit}>Done</button>
      </div>
    </div>
  );
}

const GRID = { gridTemplateColumns: 'minmax(0,1.3fr) 130px 130px 130px' };
const GRID2 = { gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 130px' };
const ZGRID = { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.8fr) minmax(0,200px)' };
