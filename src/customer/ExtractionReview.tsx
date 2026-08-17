import { useEffect, useMemo, useRef, useState } from 'react';
// Both modules expose the same extraction surface, each pinned to its own
// Orchestrator folder — reading a corporate instance through the individual
// helpers 404s, so the case type has to pick the set rather than one being a
// default. Namespace imports keep the two in step: a helper added to one and not
// the other fails to compile here.
import * as corp from '../onboarding/maestro-corporate';
import * as indiv from '../onboarding/maestro';
// The two ExtractionTask types differ in their one case-specific field
// (companyName vs applicantName), which this screen never reads. Narrow to what
// is common so either can drive it.
type ExtractionTask = Pick<
  corp.ExtractionTask,
  'taskId' | 'status' | 'extraction' | 'documentUri' | 'documentName' | 'attachmentId'
>;
import type { EntityInfo } from '../onboarding';
import { rememberedExtraction, rememberExtraction } from '../onboarding/extractionCache';
import { verifiedPack, verifiedRows } from '../onboarding/verifiedReads';

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

type Source = 'case' | 'ixp' | 'sample' | 'memory' | 'verified';

/** How long to keep saying "reading" before showing the illustrative sample.
 *  Deliberately generous: a large scanned pack can take well over a minute to
 *  extract, and a sample shown early is worse than a slow spinner — it puts a
 *  different applicant's details on screen as though they were read. */
const FAST_TRIES = 45;          // × 4s ≈ 3 minutes

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

  const push = (f: any, groupHint?: string, idx?: number, value?: any) => {
    const nm = f?.FieldName ?? f?.FieldId ?? '';
    if (!nm) return;
    const { group, label } = splitName(nm);
    const v = (value?.Value ?? value?.UnformattedValue ?? f?.Value ?? f?.UnformattedValue ?? '').toString();
    out.push({
      id: `${f?.FieldId ?? nm}${idx == null ? '' : `#${idx}`}`,
      name: label, value: v, confidence: pct(value?.Confidence ?? f?.Confidence),
      missing: Boolean(f?.IsMissing) || !v.trim(),
      group: groupHint ?? group,
    });
  };

  // A field's value sits in Values[], and a FieldGroup's real fields hang off
  // Values[].Components[] — reading Field.Value alone yields empty group rows.
  // A group repeated on the form (two directors) arrives as repeated Values, so
  // each occurrence is numbered to keep the two people apart.
  const walk = (fields: any[], groupHint?: string) => {
    (Array.isArray(fields) ? fields : []).forEach((f: any) => {
      const values = Array.isArray(f?.Values) ? f.Values : [];
      const componentsIn = values.filter((v: any) => Array.isArray(v?.Components) && v.Components.length);
      if (componentsIn.length) {
        const { label } = splitName(f?.FieldName ?? f?.FieldId ?? '');
        componentsIn.forEach((v: any, i: number) =>
          walk(v.Components, componentsIn.length > 1 ? `${label} ${i + 1}` : (groupHint ?? label)));
        return;
      }
      if (!values.length) { push(f, groupHint); return; }
      values.forEach((v: any, i: number) => push(f, groupHint, values.length > 1 ? i : undefined, v));
    });
  };

  walk(Array.isArray(doc?.Fields) ? doc.Fields : []);
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

/** Confirmed rows → the entity block a record stores. Shared so the desk and the
 *  wizard agree on what "confirmed" means, rather than each mapping field names
 *  its own way. */
export function entityFromRows(rows: ReviewField[]): EntityInfo {
  const pick = (rs: ReviewField[], re: RegExp) => rs.find((r) => re.test(r.name))?.value?.trim() ?? '';
  // The entity's own fields only. "Company Details" is also the PREFIX of the
  // nested groups (Directors/Signatories, Beneficial Owners, Other Bank Accounts),
  // so an unanchored match would pull a beneficial owner's RC number in as the
  // applicant's.
  const co = rows.filter((r) => /^company details$/i.test(r.group));
  const dirGroups = [...new Set(rows.filter((r) => /director|signator/i.test(r.group)).map((r) => r.group))];
  return {
    // Both spellings, because the taxonomy was renamed to match the bank's form
    // ("Business Name") and older reads still carry the previous label.
    companyName: pick(co, /business name|company name/i),
    rcNumber: pick(co, /^rc\b|^registration number/i),
    tin: pick(co, /^tin$|tax identification/i),
    businessType: pick(co, /type\/nature of business|business type/i),
    sector: pick(co, /sector\/industry|industry/i),
    turnover: pick(co, /turnover/i),
    address: pick(co, /operating business address|registered address|^address$/i),
    email: pick(co, /^email/i),
    phone: pick(co, /^phone(\s*number\s*1)?$/i),
    directors: dirGroups.map((g) => {
      const d = rows.filter((r) => r.group === g);
      return {
        name: pick(d, /full name/i),
        bvn: pick(d, /bvn/i),
        idType: pick(d, /means|id type/i) || undefined,
        idNumber: pick(d, /id\/means|identification number/i),
        phone: pick(d, /^phone$/i),
        email: pick(d, /^email$/i),
        role: pick(d, /designation|role/i),
      };
    }),
  };
}

/** The sample read as review rows, used when the case payload can't be reached.
 *  Confidences mirror what the model actually returned on this form — the two
 *  BVNs really do read poorly, which is the point of having a review step. */
/** The individual counterpart. A personal application falling back to a company
 *  read — RC number, TIN, directors, SCUML — is worse than no fallback at all: it
 *  describes a different applicant entirely. */
export const INDIVIDUAL_SAMPLE_ROWS: ReviewField[] = [
  { id: 'i-first', name: 'First Name', value: 'Oluwaseun', confidence: 96, missing: false, group: 'Applicant details' },
  { id: 'i-other', name: 'Other Name(s)', value: 'Oluwafemi', confidence: 91, missing: false, group: 'Applicant details' },
  { id: 'i-sur', name: 'Surname', value: 'Dada', confidence: 97, missing: false, group: 'Applicant details' },
  { id: 'i-dob', name: 'Date of Birth', value: '1992-12-02', confidence: 88, missing: false, group: 'Applicant details' },
  { id: 'i-mother', name: "Mother's Maiden Name", value: 'Bakare', confidence: 84, missing: false, group: 'Applicant details' },
  { id: 'i-origin', name: 'State of Origin', value: 'Lagos', confidence: 93, missing: false, group: 'Applicant details' },
  { id: 'i-lga', name: 'LGA', value: 'Alimosho', confidence: 90, missing: false, group: 'Applicant details' },
  { id: 'i-bvn', name: 'BVN', value: '22310633412', confidence: 62, missing: false, group: 'Identification' },
  { id: 'i-nin', name: 'NIN', value: '57029948062', confidence: 59, missing: false, group: 'Identification' },
  { id: 'i-tin', name: 'Tax Identification Number (TIN)', value: '', confidence: 0, missing: true, group: 'Identification' },
  { id: 'i-acct', name: 'Purpose of Account', value: 'Savings', confidence: 92, missing: false, group: 'Account' },
  { id: 'i-branch', name: 'Branch', value: 'Alapere', confidence: 87, missing: false, group: 'Account' },
];

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

export default function ExtractionReview({ instanceId, corporate = true, attachmentId, documentName, fallback, docKey, onAccepted, onClose }: {
  instanceId: string;
  /** Which case this instance belongs to. Defaults true so the existing corporate
   *  call sites keep their behaviour without being touched. */
  corporate?: boolean;
  /** Shown immediately, so the pages are on screen while the extraction runs
   *  rather than appearing only once it finishes. */
  attachmentId?: string;
  documentName?: string;
  /** Rows to show when the case payload is unavailable. Defaults to the sample
   *  read so every entry point degrades the same way. */
  fallback?: ReviewField[];
  /** Fingerprint of the uploaded file. When this document has been read before,
   *  its last real result paints at once instead of waiting on IXP. */
  docKey?: string;
  onAccepted: (rows: ReviewField[]) => void;
  onClose: () => void;
}) {
  // Pinned per render from the case type — every call below goes through this.
  const api = corporate ? corp : indiv;
  // The sample has to match the KIND of application, not just exist.
  const sample = fallback ?? (corporate ? SAMPLE_ROWS : INDIVIDUAL_SAMPLE_ROWS);
  const maestroUrl = corporate ? corp.corporateMaestroUrl : indiv.instanceUrl;

  // A document seen before renders straight away. The live poll below still runs
  // and overwrites this the moment the case answers, so a stale memory corrects
  // itself rather than sticking.
  const remembered = useMemo(
    () => (docKey ? toRows(rememberedExtraction(docKey, corporate ? 'corporate' : 'individual')) : []),
    [docKey, corporate],
  );

  // A form that has been read by a person and checked against the page. The model
  // still mis-reads characters on these handwritten scans, so where a checked
  // answer exists it is what gets shown — announced as such, and it holds: a
  // later live read does not put LACTOS back on screen mid-review.
  const taxonomy = corporate ? 'corporate' : 'individual';
  const docName = documentName ?? docKey?.split('::')[0];
  const pack = useMemo(() => verifiedPack(docName, taxonomy), [docName, taxonomy]);
  const verified = useMemo(() => verifiedRows(docName, taxonomy), [docName, taxonomy]);

  const [task, setTask] = useState<ExtractionTask | null>(null);
  const [rows, setRows] = useState<ReviewField[] | null>(
    verified.length ? verified : remembered.length ? remembered : null,
  );
  const [source, setSource] = useState<Source>(
    verified.length ? 'verified' : remembered.length ? 'memory' : 'sample',
  );
  const [docUrl, setDocUrl] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Shown values came from a case whose review task is already gone — confirmed
  // here, in Action Center, or in another tab. There is nothing left to complete.
  const [settled, setSettled] = useState(false);
  /** A confirmation that did not reach Maestro. Surfaced, never swallowed. */
  const [err, setErr] = useState<string | null>(null);
  // The fast poll has run its course and dropped to the sample. The case may still
  // park the task later, so this only changes what we say, not whether we keep asking.
  const [gaveUp, setGaveUp] = useState(false);
  const [note, setNote] = useState('Looking for the extraction…');
  const [revealed, setRevealed] = useState(0);
  const timer = useRef<number | null>(null);

  // This screen owns Escape while it is open — the surfaces it opens over stand
  // down, so without this the key would do nothing here. Same as "Finish later":
  // the task stays parked, nothing is confirmed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // Show the pages straight away — the scan is only meaningful over the document.
  // A confirmed review has no parked task and no pending slot left to name the
  // attachment, so fall back to asking the case which document it read.
  useEffect(() => {
    let alive = true;
    (async () => {
      let id = attachmentId;
      if (!id) id = (await api.findCaseDocument(instanceId))?.attachmentId;
      if (!id || !alive) return;
      try {
        const u = await api.attachmentReadUrl(id);
        if (alive && u) setDocUrl(u);
      } catch { /* pane degrades to its placeholder */ }
    })();
    return () => { alive = false; };
  }, [attachmentId, instanceId]);

  // Poll until the case parks the review task. IXP takes ~20s on a 13-page scan,
  // so this is a real wait, not a staged one.
  useEffect(() => {
    let alive = true;
    let tries = 0;
    let dropped = false;
    const tick = async () => {
      if (!alive) return;
      try {
        // Both at once. Asked in sequence, an already-confirmed review spends a
        // whole round trip on "is a task parked?" before it can discover the answer
        // is already sitting in the case — which is the spinner you see for nothing.
        const [t, caseExtraction, reviewState] = await Promise.all([
          api.findExtractionTask(instanceId),
          api.fetchCaseExtraction(instanceId),
          api.reviewTaskState(instanceId),
        ]);
        if (!alive) return;
        if (t) {
          setTask(t);
          // The task input first — that is where the result is meant to arrive.
          // When it is empty, the same result is still in the case's own element
          // outputs, so read it there rather than dropping to the sample.
          const parsed = toRows(t.extraction);
          const rows = parsed.length ? parsed : toRows(caseExtraction);
          if (rows.length) {
            // Remember the live read either way — it is what the case actually
            // returned — but leave a checked pack on screen rather than replacing
            // it with the read it was written to correct.
            if (docKey) rememberExtraction(docKey, parsed.length ? t.extraction : caseExtraction, corporate ? 'corporate' : 'individual');
            if (!verified.length) { setRows(rows); setSource('case'); }
          }
          else if (!verified.length) { setRows(sample); setSource('sample'); }
          if (t.attachmentId && !attachmentId) {
            try { setDocUrl(await api.attachmentReadUrl(t.attachmentId)); } catch { /* pane degrades */ }
          }
          return;
        }
        // Settled only when the review task itself says it was completed. The
        // extraction landing before the task is created is the normal order of
        // events on a brand-new case, not evidence that anyone reviewed it.
        const already = toRows(caseExtraction);
        if (reviewState === 'done' && already.length) {
          if (!verified.length) { setRows(already); setSource('case'); }
          setSettled(true); return;
        }
      } catch { /* keep polling */ }
      tries += 1;
      setNote(tries < 3 ? 'Reading the form…' : `Still reading — ${tries * 4}s`);
      // Nothing parked and nothing extracted after ~48s. Show the sample so the
      // column is not empty, but keep asking on a slower beat: the confirm button
      // is gated on the task existing, so if we stopped here the gate could never
      // open and there would be no way through. Clicking used to be the retry.
      if (tries > FAST_TRIES) {
        // Local flag, not the state: this closure captures the first render's
        // `gaveUp` forever, so reading the state here would re-drop to the sample
        // on every slow tick and wipe any corrections already typed.
        if (!dropped) {
          dropped = true; setGaveUp(true);
          if (!verified.length) { setRows(sample); setSource('sample'); }
        }
        timer.current = window.setTimeout(tick, 10000);
        return;
      }
      timer.current = window.setTimeout(tick, 4000);
    };
    tick();
    return () => { alive = false; if (timer.current) window.clearTimeout(timer.current); };
  }, [instanceId, sample, attachmentId, verified]);

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
    setErr(null);
    const confirmed = rows.map((r) => ({
      fieldId: r.id, name: r.name, group: r.group,
      value: valueOf(r), confidence: r.confidence, corrected: changed(r),
    }));

    // The task can appear after this screen settled — the poll gives up at ~48s,
    // and a reopened review starts with nothing. Look once more before deciding
    // there is nothing to complete.
    let t = task;
    if (!t && !settled) {
      try { t = await api.findExtractionTask(instanceId); } catch { t = null; }
    }

    if (t) {
      try {
        await api.completeExtractionTask(t.taskId, 'Accept', {
          confirmed, corrections: confirmed.filter((c) => c.corrected),
        });
      } catch (e) {
        // Never report success for a case that is still sitting on the gate. This
        // used to be swallowed, so the reviewer walked away believing it was done.
        setBusy(false);
        setErr(`Maestro did not accept the confirmation: ${(e as Error).message}. The case is still waiting — try again.`);
        return;
      }
    } else if (!settled) {
      setBusy(false);
      setErr('The case has not parked the review task yet, so there is nothing to confirm. Give it a moment and try again.');
      return;
    }
    setBusy(false);
    onAccepted(rows.map((r) => ({ ...r, value: valueOf(r) })));
  };

  const done = rows !== null;

  // Confirming needs a task to complete. `done` only means there is something to
  // look at — after the fast poll gives up those rows are the sample, and pressing
  // Confirm then produced "the case has not parked the review task yet". Gate the
  // button on the thing that actually has to be true, and say so on hover.
  const gateOpen = Boolean(task) || settled;
  const blocked = done && !gateOpen;
  const gateTip = !done
    ? 'Still reading the form — the case has not finished the extraction yet.'
    : gaveUp
      ? 'The case has not parked the review task yet. Still checking every 10s — this enables itself the moment it appears.'
      : 'Still reading — the case has not parked the review task yet.';

  return (
    <div className="xv">
      <div className="xv-head">
        <div>
          <div className="xv-eyebrow">Extraction review</div>
          <h2>{!done ? 'Reading the form' : settled ? 'What the case recorded' : 'Check what we read'}</h2>
        </div>
        <div className="xv-head-r">
          {/* The case is running while this pane is open — a way through to the
              instance itself, for when the read looks wrong and the question is
              what the case actually did. */}
          <a className="xv-mlink" href={maestroUrl(instanceId)} target="_blank" rel="noreferrer">
            Open in Maestro ↗
          </a>
          <button className="xv-x" onClick={onClose} aria-label="Close">Close</button>
        </div>
      </div>

      {done && settled && (
        <div className="xv-banner ok">
          This review is already confirmed — these are the values the case recorded. Confirming again only
          refreshes the record on this desk.
        </div>
      )}
      {done && !settled && source !== 'case' && (
        <div className="xv-banner">
          {source === 'sample'
            ? 'Showing a sample read — the live extraction was not available. Values below are illustrative.'
            : source === 'memory'
              ? 'Showing the last read of this same file. The case is reading it again now, and these values are replaced the moment it answers.'
              : source === 'verified'
                ? `Checked read — ${pack?.label ?? 'this form'} has been read against the page and corrected. The case is extracting the same document alongside; these are the values that will be confirmed.`
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

          {done && !settled && attention.length > 0 && (
            <div className="xv-card attn">
              {/* Says what to do, not just that something is wrong — the rest of the
                  column is confirmed-by-default, this is the part with work in it. */}
              <div className="xv-attn-h">
                <b>{attention.length} {attention.length === 1 ? 'field needs' : 'fields need'} checking</b>
                <em>Read poorly or missing. Compare each with the form and correct it, or leave it if it is right.</em>
              </div>
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
        <div className={`xv-sum${err ? ' bad' : ''}`}>
          {err ? err
            : !done ? 'Extraction in progress'
            : blocked ? 'Waiting for the case to park the review task'
            : Object.keys(edits).length
              ? `${Object.keys(edits).length} correction${Object.keys(edits).length === 1 ? '' : 's'}`
              // The instruction lives on the flagged block itself now; beside the
              // button, a count is what is useful.
              : settled ? `${rows!.length} fields recorded`
              : attention.length ? `${attention.length} of ${rows!.length} fields flagged`
              : 'Everything read cleanly'}
        </div>
        {/* Finish later stays live on purpose: it never touches Maestro, and it is
            the way out while the gate is shut. Disabling it would trap the reviewer. */}
        <button className="xv-btn ghost" onClick={onClose} disabled={busy}>Finish later</button>
        {/* The tip hangs on the wrapper, not the button — a disabled button gets no
            hover events, so a title on it would never show. */}
        <span className="xv-tipw" data-tip={!gateOpen && !busy ? gateTip : undefined}>
          <button className="xv-btn primary" onClick={accept} disabled={!gateOpen || busy}>
            {busy ? 'Saving…' : settled ? 'Update this record' : 'Confirm and continue'}
          </button>
        </span>
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
