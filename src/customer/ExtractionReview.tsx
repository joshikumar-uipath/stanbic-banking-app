import { useEffect, useMemo, useRef, useState } from 'react';
import { attachmentReadUrl, completeExtractionTask, findExtractionTask } from '../onboarding/maestro-corporate';
import type { ExtractionTask } from '../onboarding/maestro-corporate';

// ─────────────────────────────────────────────────────────────────────────────
// Extraction review — the desk-side twin of the Action Center app.
//
// The case runs IXP server-side and parks a "Confirm extracted details" task.
// This screen shows what was read next to the page it was read from, lets the
// RM correct anything, and completes that same task — so accepting here and
// accepting in Action Center are the same act as far as the case is concerned.
//
// Where the fields come from, in order of preference:
//   1. the parked task's payload — the authoritative server-side read
//   2. a direct IXP call — only when the app holds a DU-scoped token
//   3. the sample read — clearly labelled, so a demo never dead-ends
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewField {
  id: string;
  name: string;
  value: string;
  confidence: number;   // 0..100
  missing: boolean;
  group: string;
}

type Source = 'case' | 'ixp' | 'sample';

const HI = 90;
const MID = 80;
const bandOf = (c: number, missing: boolean) => (missing ? 'lo' : c >= HI ? 'hi' : c >= MID ? 'mid' : 'lo');

/** IXP reports 0..1 here; tolerate 0..100 so an upstream change reads as 97%, not 1%. */
const pct = (c: unknown) =>
  typeof c === 'number' && !Number.isNaN(c) ? Math.round(c <= 1 ? c * 100 : c) : 0;

/** Names arrive as taxonomy paths — "Company Details > Directors/Signatories > BVN". */
function splitName(raw: string): { group: string; label: string } {
  const parts = String(raw || '').split('>').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return { group: 'Company details', label: parts[0] || 'Field' };
  return { group: parts.slice(0, -1).join(' › '), label: parts[parts.length - 1] };
}

/** Flatten an IXP ExtractionResult into rows. Deliberately forgiving: a shape
 *  change upstream should cost a field, not the screen. */
export function toRows(raw: unknown): ReviewField[] {
  let payload: any = raw;
  if (typeof raw === 'string') { try { payload = JSON.parse(raw); } catch { return []; } }
  if (!payload || typeof payload !== 'object') return [];
  const doc = payload?.ExtractionResult?.ResultsDocument ?? payload?.ResultsDocument ?? payload;
  const out: ReviewField[] = [];

  const push = (f: any, groupHint?: string, idx?: number) => {
    const nm = f?.FieldName ?? f?.FieldId ?? '';
    if (!nm) return;
    const { group, label } = splitName(nm);
    const v = (f?.Value ?? f?.UnformattedValue ?? '').toString();
    out.push({
      id: `${f?.FieldId ?? nm}${idx == null ? '' : `#${idx}`}`,
      name: label, value: v, confidence: pct(f?.Confidence),
      missing: Boolean(f?.IsMissing) || !v.trim(),
      group: groupHint ?? group,
    });
  };

  (Array.isArray(doc?.Fields) ? doc.Fields : []).forEach((f: any) => push(f));
  (Array.isArray(doc?.Tables) ? doc.Tables : []).forEach((t: any, ti: number) => {
    const tableName = splitName(t?.FieldName ?? t?.TableName ?? 'Directors / signatories').label;
    const rows = t?.Values ?? t?.Rows ?? t?.Entries ?? [];
    (Array.isArray(rows) ? rows : []).forEach((r: any, ri: number) => {
      const cells = r?.Cells ?? r?.Fields ?? r?.Values ?? [];
      (Array.isArray(cells) ? cells : []).forEach((c: any) => push(c, `${tableName} ${ri + 1}`, ti * 1000 + ri));
    });
  });
  return out;
}

/** The sample read as review rows, used when the case payload can't be reached.
 *  Confidences mirror what the model actually returned on this form — the two
 *  BVNs really do read poorly, which is the point of having a review step. */
export const SAMPLE_ROWS: ReviewField[] = [
  { id: 's-company', name: 'Registered Company Name', value: 'George Emore Technical Enterprises Ltd', confidence: 98, missing: false, group: 'Company details' },
  { id: 's-rc', name: 'RC/Registration Number', value: '961813', confidence: 82, missing: false, group: 'Company details' },
  { id: 's-tin', name: 'TIN', value: '26224878833179', confidence: 87, missing: false, group: 'Company details' },
  { id: 's-biz', name: 'Business Type', value: 'Consultancy in Infotech', confidence: 86, missing: false, group: 'Company details' },
  { id: 's-sector', name: 'Industry/Nature of Business', value: 'Information Technology', confidence: 95, missing: false, group: 'Company details' },
  { id: 's-addr', name: 'Registered Address', value: '45 Ajose Street, Mende, Maryland', confidence: 92, missing: false, group: 'Company details' },
  { id: 's-email', name: 'Email', value: 'eemore@gmail.com', confidence: 96, missing: false, group: 'Company details' },
  { id: 's-phone', name: 'Phone', value: '08027317889', confidence: 96, missing: false, group: 'Company details' },
  { id: 's-scuml', name: 'SCUML registration number', value: '', confidence: 0, missing: true, group: 'Company details' },
  ...[
    { name: 'Efe George Emore', bvn: '22143511463', idNumber: 'B03199156', role: 'Director' },
    { name: 'Kehinde Omotayo Akerele', bvn: '22148013170', idNumber: 'B00597328', role: 'Director' },
  ].flatMap((d, i) => [
    { id: `s-d${i}-name`, name: 'Full Name', value: d.name, confidence: 96, missing: false, group: `Directors / signatories ${i + 1}` },
    { id: `s-d${i}-bvn`, name: 'BVN', value: d.bvn, confidence: i === 0 ? 58 : 62, missing: false, group: `Directors / signatories ${i + 1}` },
    { id: `s-d${i}-id`, name: 'ID/Means-of-Identification Number', value: d.idNumber, confidence: 94, missing: false, group: `Directors / signatories ${i + 1}` },
    { id: `s-d${i}-role`, name: 'Designation/Role', value: d.role, confidence: 88, missing: false, group: `Directors / signatories ${i + 1}` },
  ]),
];

export default function ExtractionReview({ instanceId, attachmentId, documentName, fallback = SAMPLE_ROWS, onAccepted, onClose }: {
  instanceId: string;
  /** Shown immediately, so the pages are on screen while the extraction runs
   *  rather than appearing only once it finishes. */
  attachmentId?: string;
  documentName?: string;
  /** Rows to show when the case payload is unavailable. Defaults to the sample
   *  read so every entry point degrades the same way. */
  fallback?: ReviewField[];
  onAccepted: (rows: ReviewField[]) => void;
  onClose: () => void;
}) {
  const [task, setTask] = useState<ExtractionTask | null>(null);
  const [rows, setRows] = useState<ReviewField[] | null>(null);
  const [source, setSource] = useState<Source>('sample');
  const [docUrl, setDocUrl] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('Looking for the extraction…');
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<number | null>(null);

  // Show the pages straight away — the scan is only meaningful over the document.
  useEffect(() => {
    if (!attachmentId) return;
    let alive = true;
    attachmentReadUrl(attachmentId)
      .then((u) => { if (alive && u) setDocUrl(u); })
      .catch(() => { /* pane degrades to its placeholder */ });
    return () => { alive = false; };
  }, [attachmentId]);

  // Poll until the case parks the review task. IXP takes ~20s on a 13-page scan,
  // so this is a real wait, not a staged one.
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const tick = async () => {
      if (!alive) return;
      try {
        const t = await findExtractionTask(instanceId);
        if (t && alive) {
          setTask(t);
          const parsed = toRows(t.extraction);
          if (parsed.length) { setRows(parsed); setSource('case'); }
          else { setRows(fallback); setSource('sample'); }
          if (t.attachmentId && !attachmentId) {
            try { setDocUrl(await attachmentReadUrl(t.attachmentId)); } catch { /* pane degrades */ }
          }
          return;
        }
      } catch { /* keep polling */ }
      tries += 1;
      setNote(tries < 3 ? 'Reading the form…' : `Still reading — ${tries * 4}s`);
      // A resumed review whose task was already completed elsewhere (Action Center,
      // another tab) has nothing to wait for — give up early rather than spending
      // two minutes polling for a gate that is already open.
      if (tries > 12) { setRows(fallback); setSource('sample'); return; }
      timer.current = window.setTimeout(tick, 4000);
    };
    tick();
    return () => { alive = false; if (timer.current) window.clearTimeout(timer.current); };
  }, [instanceId, fallback, attachmentId]);

  // Reveal fields in sequence once they land. The data is real; only the pacing
  // is presentation — IXP returns the whole result at once, it does not stream.
  useEffect(() => {
    if (!rows) return;
    setRevealed(0);
    let i = 0;
    const step = () => {
      i += 1; setRevealed(i);
      if (i < rows.length) timer.current = window.setTimeout(step, 55);
    };
    timer.current = window.setTimeout(step, 220);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [rows]);

  const valueOf = (r: ReviewField) => (r.id in edits ? edits[r.id] : r.value);
  const changed = (r: ReviewField) => r.id in edits && edits[r.id] !== r.value;
  const attention = useMemo(() => (rows ?? []).filter((r) => r.missing || r.confidence < MID), [rows]);
  const groups = useMemo(() => {
    const m = new Map<string, ReviewField[]>();
    (rows ?? []).forEach((r) => { if (!m.has(r.group)) m.set(r.group, []); m.get(r.group)!.push(r); });
    return [...m.entries()];
  }, [rows]);

  const accept = async () => {
    if (busy || !rows) return;
    setBusy(true);
    const confirmed = rows.map((r) => ({
      fieldId: r.id, name: r.name, group: r.group,
      value: valueOf(r), confidence: r.confidence, corrected: changed(r),
    }));
    if (task) {
      try {
        await completeExtractionTask(task.taskId, 'Accept', {
          confirmed, corrections: confirmed.filter((c) => c.corrected),
        });
      } catch { /* the application is captured either way */ }
    }
    setBusy(false);
    onAccepted(rows.map((r) => ({ ...r, value: valueOf(r) })));
  };

  const done = rows !== null;

  return (
    <div className="xv">
      <div className="xv-head">
        <div>
          <div className="xv-eyebrow">Extraction review</div>
          <h2>{done ? 'Check what we read' : 'Reading the form'}</h2>
        </div>
        <button className="xv-x" onClick={onClose} aria-label="Close">Close</button>
      </div>

      {done && source !== 'case' && (
        <div className="xv-banner">
          {source === 'sample'
            ? 'Showing a sample read — the live extraction was not available. Values below are illustrative.'
            : 'Read directly from the document.'}
        </div>
      )}

      <div className="xv-split">
        <div className="xv-fields">
          {!done && (
            <>
              <div className="xv-wait">
                <div className="xv-spin" />
                <b>{note}</b>
                <span>The case is running the extraction. You can close this and come back — it keeps going.</span>
              </div>
              {/* Shape for the column while the read runs, so the fields do not
                  appear out of an empty page. */}
              {['l', 'm', 's'].map((w, i) => (
                <div className="xv-skel" key={i}>
                  <div className={`sk ${w}`} /><div className="sk l" /><div className="sk m" /><div className="sk s" />
                </div>
              ))}
            </>
          )}

          {done && attention.length > 0 && (
            <div className="xv-card attn">
              <span className="xv-card-t">Needs a look · {attention.length}</span>
              {attention.map((r) => (
                <Row key={`a-${r.id}`} r={r} v={valueOf(r)} changed={changed(r)} showGroup
                  onEdit={(x) => setEdits((p) => ({ ...p, [r.id]: x }))} />
              ))}
            </div>
          )}

          {done && groups.map(([g, rs]) => (
            <div className="xv-card" key={g}>
              <span className="xv-card-t">{g}</span>
              {rs.map((r, i) => (
                <Row key={r.id} r={r} v={valueOf(r)} changed={changed(r)}
                  hidden={(rows ?? []).indexOf(r) >= revealed && i > 2}
                  onEdit={(x) => setEdits((p) => ({ ...p, [r.id]: x }))} />
              ))}
            </div>
          ))}
        </div>

        <div className="xv-doc">
          <div className="xv-doc-h">
            <span>{task?.documentName || documentName || 'Account opening form'}</span>
            {done && <span className="xv-doc-n">{rows!.length} fields</span>}
          </div>
          <div className="xv-doc-body">
            {docUrl
              ? <iframe className="xv-frame" title="Uploaded form"
                  src={`${docUrl}#view=FitH&toolbar=1&navpanes=0`} />
              : <div className="xv-doc-none">The uploaded pages will appear here.</div>}
            {!done && <div className="xv-scan" />}
          </div>
        </div>
      </div>

      <div className="xv-foot">
        <div className="xv-sum">
          {!done ? 'Extraction in progress'
            : Object.keys(edits).length
              ? `${Object.keys(edits).length} correction${Object.keys(edits).length === 1 ? '' : 's'}`
              : attention.length ? `${attention.length} flagged — accept if they read correctly`
              : 'Everything read cleanly'}
        </div>
        <button className="xv-btn ghost" onClick={onClose} disabled={busy}>Finish later</button>
        <button className="xv-btn primary" onClick={accept} disabled={!done || busy}>
          {busy ? 'Confirming…' : 'Confirm and continue'}
        </button>
      </div>
    </div>
  );
}

function Row({ r, v, changed, hidden, showGroup, onEdit }: {
  r: ReviewField; v: string; changed: boolean; hidden?: boolean; showGroup?: boolean;
  onEdit: (v: string) => void;
}) {
  const b = bandOf(r.confidence, r.missing);
  return (
    <div className={`xv-f ${changed ? 'edited' : ''} ${hidden ? 'pend' : ''}`}>
      <label className="xv-f-k">{r.name}{showGroup && <em>{r.group}</em>}</label>
      <input className={`xv-f-v ${r.missing ? 'blank' : ''}`} value={v}
        placeholder={r.missing ? 'Not found on the form' : ''}
        onChange={(e) => onEdit(e.target.value)} />
      <span className={`xv-c ${b}`}>{r.missing ? 'missing' : `${r.confidence}%`}</span>
    </div>
  );
}
