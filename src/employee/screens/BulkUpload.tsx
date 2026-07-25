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
import { parseCsv, runBulk, SAMPLE_CSV, type BulkRow } from '../bulk';
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

export default function BulkUpload({ onExit }: { onExit: () => void }) {
  const [employer, setEmployer] = useState('');
  const [csv, setCsv] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo<BulkRow[]>(() => parseCsv(csv), [csv]);
  const batchCases = useBatch(batchId);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result));
    reader.onerror = () => alert('Could not read that file. Use a .csv.');
    reader.readAsText(file);
  };

  const submit = () => {
    if (!rows.length) return;
    const id = `BATCH-${String(Date.now()).slice(-6)}`;
    void runBulk(rows, employer, id);
    setBatchId(id);
  };

  if (batchId) return <BatchProgress cases={batchCases} employer={employer} batchId={batchId} onExit={onExit} />;

  return (
    <div className="dk-bulk">
      <div className="dk-bulk-head">
        <div>
          <h2>Bulk upload</h2>
          <div className="sub">Open many accounts from one file — each row is verified in the background.</div>
        </div>
        <button className="dk-btn" onClick={onExit}>Cancel</button>
      </div>

      <div className="dk-bulk-body">
        <label className="dk-field">
          <span>Employer / batch name</span>
          <input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder={`e.g. ${CO.companies[3] ?? CO.companies[0]} payroll`} />
        </label>

        <label className="dk-field">
          <span>Rows (CSV: first name, last name, phone, email, {kycLabel('BVN', CO)}, {kycLabel('NIN', CO)}, address)</span>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Paste rows here, upload a .csv, or load the sample…" spellCheck={false} />
        </label>

        <div className="dk-bulk-tools">
          <button className="dk-btn" onClick={() => fileRef.current?.click()}><I n="upload" s={14} />Upload .csv</button>
          <button className="dk-btn" onClick={() => setCsv(SAMPLE_CSV)}>Load sample payroll</button>
          {csv && <button className="dk-btn" onClick={() => setCsv('')}>Clear</button>}
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
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
      </div>

      <div className="dk-bulk-foot">
        <button className="dk-btn pri lg" disabled={!rows.length} onClick={submit}>
          <I n="layers" s={15} />Open {rows.length || ''} account{rows.length === 1 ? '' : 's'}
        </button>
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
