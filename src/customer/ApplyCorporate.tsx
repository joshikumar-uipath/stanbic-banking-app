// ─────────────────────────────────────────────────────────────────────────────
// ApplyCorporate — the business/entity opening wizard.
// Business details → Directors & signatories → Review → submit.
// A corporate account opens under its signing director, so the case carries the
// primary signatory's identity (for validations/pipeline) plus the full entity
// metadata (see EntityInfo). Same shared OnboardingStore as the individual flow.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { store, type OnboardingCase } from '../onboarding';
import { getActiveCountry } from '../config/countries';
import { useConfig } from '../config';
import { Button, Field, Note, Rail, KV, Brand } from './ui';
import Icon from './icons';
import type { ApplyMode } from './Apply';
import { extractAof } from './ixp';
import { attachmentReadUrl, clearPendingExtraction, corporateMaestroReady, loadPendingExtraction, savePendingExtraction, startCorporateCase, uploadCaseAttachment, type JobAttachmentRef, type PendingExtraction } from '../onboarding/maestro-corporate';
import { fingerprint } from '../onboarding/extractionCache';
import ExtractionReview, { type ReviewField } from './ExtractionReview';
import { linkInstance } from '../onboarding/maestro';

const CO = getActiveCountry();
const CUR = CO.currency.symbol;
const digits = (s: string) => s.replace(/\D/g, '');

/** Snap a free-text extracted value onto one of the wizard's dropdown options.
 *  OCR of a handwritten form rarely matches an option verbatim, so match on the
 *  first significant word (e.g. "DEVELOPER CEO" → Director stays, "Partnership" hits). */
function matchOption(raw: string, options: string[]): string | null {
  const s = (raw || '').toLowerCase();
  if (!s) return null;
  return options.find((o) => s.includes(o.toLowerCase()) || o.toLowerCase().includes(s)) ?? null;
}

/** IXP reads the street line and the city/state boxes separately, but on this form the
 *  street line usually already spells out the city and state — so only append the parts
 *  the address doesn't already contain, instead of repeating them. */
function joinAddress(address: string, city: string, state: string): string {
  const base = (address || '').trim();
  const seen = base.toLowerCase();
  const extra = [city, state]
    .map((p) => (p || '').trim())
    .filter((p) => p && !seen.includes(p.toLowerCase()));
  return [base, ...extra].filter(Boolean).join(', ');
}

type Dir = { name: string; bvn: string; idType: string; idNumber: string; phone: string; email: string; role: string };
type Corp = { company: string; rc: string; bizType: string; sector: string; tin: string; turnover: string; address: string; email: string; phone: string };

const BIZ_TYPES = ['Limited Liability Company', 'Partnership', 'Sole Proprietor', 'Schools', 'Other'];
const ROLES = ['Director', 'Shareholder', 'Signatory'];
const TURNOVERS = [`Less than ${CUR}400m`, `${CUR}400m – ${CUR}1bn`, `${CUR}1bn – ${CUR}4bn`, `Greater than ${CUR}4bn`];

/** Stands in on the desk between "form uploaded" and "we know the company name".
 *  Never the file name — a record is the business, not the scan it arrived on. */
const PLACEHOLDER_NAME = 'Business application';

const EMPTY_DIR: Dir = { name: '', bvn: '', idType: 'International Passport', idNumber: '', phone: '', email: '', role: 'Director' };
const EMPTY_CORP: Corp = { company: '', rc: '', bizType: BIZ_TYPES[0], sector: '', tin: '', turnover: TURNOVERS[0], address: '', email: '', phone: '' };

// Demo Document Understanding result for the corporate AOF — company + directors.
const EXTRACTED_CORP: Corp = {
  company: 'George Emore Technical Enterprises Ltd', rc: '961813',
  bizType: 'Limited Liability Company', sector: 'Information Technology',
  tin: '26224878833179', turnover: TURNOVERS[0],
  address: '45 Ajose Street, Mende, Maryland', email: 'eemore@gmail.com', phone: '08027317889',
};
const EXTRACTED_DIRS: Dir[] = [
  { name: 'Efe George Emore', bvn: '22143511463', idType: 'International Passport', idNumber: 'B03199156', phone: '08027317889', email: 'eemore@gmail.com', role: 'Director' },
  { name: 'Kehinde Omotayo Akerele', bvn: '22148013170', idType: 'International Passport', idNumber: 'B00597328', phone: '08066526627', email: 'meetsweetkenny@yahoo.com', role: 'Director' },
];


const STEPS = ['Business', 'Directors', 'Review'];

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="cx-field">
      <label>{label}</label>
      <select className="cx-input cx-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function ApplyCorporate({ onBack, onDone, mode = 'rm', onKind }: {
  onBack: () => void; onDone: (c: OnboardingCase) => void; mode?: ApplyMode; onKind?: (k: 'individual' | 'corporate') => void;
}) {
  const appName = useConfig().branding.appName;
  const rm = mode === 'rm';
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Corp>(EMPTY_CORP);
  const [dirs, setDirs] = useState<Dir[]>([{ ...EMPTY_DIR }]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<
    { name: string; phase: 'reading'; note?: string } | { name: string; phase: 'done'; source: 'ixp' | 'sample' } | null
  >(null);
  // The uploaded form, parked as an Orchestrator attachment so the case can read it.
  // The screen fills itself from IXP for immediate review; the case re-reads the same
  // document server-side in its Intake stage.
  const [attachment, setAttachment] = useState<JobAttachmentRef | null>(null);
  // The case instance started at upload time. The review screen polls it for the
  // parked "Confirm extracted details" task and completes it on accept, so the
  // desk and Action Center are two doors onto the same task.
  const [extractionInstance, setExtractionInstance] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  /** Fingerprint of the uploaded file, so a document seen before paints at once. */
  const [docKey, setDocKey] = useState<string | null>(null);
  // Whether the reviewer has actually confirmed. "Finish later" leaves this false,
  // so the banner keeps saying the gate is open and the way back stays visible.
  const [reviewDone, setReviewDone] = useState(false);
  // A review parked with "Finish later" survives closing the wizard entirely, so
  // offer it back rather than stranding a case that is already running.
  // Only offered once the record behind it is confirmed to still exist. A parked
  // review whose record is gone (discarded, or cleared by a demo reseed) is an
  // orphan — offering it would invite the RM to resume a stranger's document.
  const [resume, setResume] = useState<PendingExtraction | null>(null);
  useEffect(() => {
    const p = loadPendingExtraction();
    if (!p) return;
    void store.get(p.recordId).then((rec) => {
      if (rec) setResume(p);
      else clearPendingExtraction();
    });
  }, []);
  // The record opened at upload. Submit fills it in rather than creating a second one.
  const [draftId, setDraftId] = useState<string | null>(null);

  const set = (k: keyof Corp) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const setDir = (i: number, k: keyof Dir, val: string) => setDirs((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: val } : d)));
  const addDir = () => setDirs((ds) => [...ds, { ...EMPTY_DIR }]);
  const removeDir = (i: number) => setDirs((ds) => (ds.length > 1 ? ds.filter((_, j) => j !== i) : ds));

  /** Put the read company name onto the parked record, so the desk stops showing a
   *  placeholder as soon as we know who this is. Best-effort: a failure here must
   *  not cost the RM the upload. */
  const nameDraft = async (id: string | null, company: string | undefined) => {
    const name = (company ?? '').trim();
    if (!id || !name) return;
    try { await store.update(id, { firstName: name, lastName: '' }); } catch { /* keeps the placeholder */ }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setDocKey(fingerprint(f));
    setDoc({ name: f.name, phase: 'reading', note: 'Uploading the form…' });
    setAttachment(null);
    // Held locally as well as in state: the read finishes in the same call, before
    // a state update from this handler would be readable.
    let createdDraftId: string | null = null;
    // Also held locally: `extractionInstance` is state, so this handler cannot read
    // back what it just set, and whether a case started decides whether the review
    // can open ahead of the read.
    let startedInstance: string | null = null;
    // Park the document in Orchestrator first, then start the case immediately so
    // the server-side extraction is already running while the RM is still on this
    // screen. The review step opens against that same instance.
    if (corporateMaestroReady()) {
      try {
        const att = await uploadCaseAttachment(f);
        setAttachment(att);
        try {
          const uri = await attachmentReadUrl(att.ID);
          const id = await startCorporateCase({
            applicantId: 'pending', companyName: 'Corporate applicant',
            document: att, documentUri: uri,
          });
          setExtractionInstance(id);
          startedInstance = id;
          // Open the record now so the running case is visible on the desk. A record
          // is named for its business, never for the file it arrived on — the document
          // name belongs to the extraction (and shows in the details popup). This
          // placeholder stands for the few seconds until the read returns a name.
          const draft = await store.create({
            firstName: PLACEHOLDER_NAME, lastName: '',
            phone: '', email: '', bvn: '', nin: '', address: '',
            channel: 'single', source: 'rm', state: 'AWAITING_EXTRACTION',
            documentId: att.ID, documentName: att.FullName,
          });
          createdDraftId = draft.id;
          setDraftId(draft.id);
          linkInstance(draft.id, id);
          savePendingExtraction({ recordId: draft.id, instanceId: id, attachmentId: att.ID, documentName: att.FullName });
        } catch { /* review falls back to the local read */ }
      } catch { /* case starts without it */ }
    }
    // Open the review NOW, not after the read. The screen already renders the
    // uploaded page with a scan running over it and a skeleton column, and holding
    // it back until extraction finished meant nobody ever saw the document being
    // read — the wizard showed a one-line spinner instead. The read carries on
    // underneath and fills the wizard's own fields for the steps that follow.
    const started = Boolean(startedInstance);
    if (started) setReviewing(true);

    const runRead = async () => {
    try {
      // Real UiPath IXP (Document Understanding) read of the scanned AOF.
      const x = await extractAof(f, (note) => setDoc({ name: f.name, phase: 'reading', note }));
      setV((p) => ({
        ...p,
        company: x.company.companyName || p.company,
        rc: x.company.rcNumber || p.rc,
        tin: x.company.tin || p.tin,
        sector: x.company.industry || x.company.businessType || p.sector,
        bizType: matchOption(x.company.businessType, BIZ_TYPES) ?? p.bizType,
        address: joinAddress(x.company.address, x.company.city, x.company.state) || p.address,
        email: x.company.email || p.email,
        phone: x.company.phone || p.phone,
      }));
      if (x.directors.length) {
        setDirs(x.directors.map((d) => ({
          name: d.fullName, bvn: digits(d.bvn),
          idType: EMPTY_DIR.idType, idNumber: d.idNumber,
          phone: digits(d.phone), email: d.email,
          role: matchOption(d.role, ROLES) ?? 'Director',
        })));
      }
      setDoc({ name: f.name, phase: 'done', source: 'ixp' });
      await nameDraft(createdDraftId, x.company.companyName);
    } catch {
      // IXP unreachable (in production the app token still lacks the Du.* scopes) —
      // fall back to the sample read so the walkthrough never dead-ends.
      setV(EXTRACTED_CORP);
      setDirs(EXTRACTED_DIRS.map((d) => ({ ...d })));
      setDoc({ name: f.name, phase: 'done', source: 'sample' });
      await nameDraft(createdDraftId, EXTRACTED_CORP.company);
    }
    };

    // With a live case the review is already up and owns the wait, so the read runs
    // underneath it. Without one there is nothing to watch, so keep the old order:
    // finish the read, then open the review against whatever it produced.
    if (started) { void runRead(); } else { await runRead(); setReviewing(true); }
  };

  /** Fold confirmed values back into the form so the rest of the wizard starts
   *  from what the reviewer accepted, not from the raw read. */
  const applyConfirmed = (rows: ReviewField[]) => {
    // Scope to the company's own section first. The form carries a TIN under the
    // beneficial owners, a Company Name under them too, and an address for every
    // officer — searching by field name across all of them lets a director's
    // details land on the business.
    const own = rows.filter((r) => /company details/i.test(r.group) && !/›|>/.test(r.group));
    const pick = (re: RegExp) => (own.length ? own : rows).find((r) => re.test(r.name))?.value?.trim() ?? '';
    // "Registered Company Name" was renamed to "Business Name" to match the words
    // on both banks' forms — accept either, or the record loses its name.
    const name = pick(/business name|company name/i);
    // The reviewer may have corrected the company name — the record should carry
    // what they confirmed, not what was first read.
    void nameDraft(draftId, name);
    setV((p) => ({
      ...p,
      company: name || p.company,
      rc: pick(/^rc|registration number/i) || p.rc,
      tin: pick(/^tin$/i) || p.tin,
      sector: pick(/sector|industry/i) || pick(/nature of business/i) || p.sector,
      address: pick(/operating business address|registered office address|^address/i) || p.address,
      email: pick(/^email$/i) || p.email,
      phone: pick(/^phone$|phone number 1/i) || p.phone,
      // Both are <select>. An extracted value that is not one of the options has
      // to be snapped or dropped — written raw it shows as nothing at all.
      bizType: matchOption(pick(/business category|type\/nature of business/i), BIZ_TYPES) ?? p.bizType,
      turnover: matchOption(pick(/annual turnover|turnover/i), TURNOVERS) ?? p.turnover,
    }));
    const byDir = new Map<string, ReviewField[]>();
    // The taxonomy writes this group without spaces around the slash; a live read
    // has been seen both ways. Tolerate either rather than silently finding none.
    rows.filter((r) => /directors?\s*\/\s*signator/i.test(r.group))
      .forEach((r) => { if (!byDir.has(r.group)) byDir.set(r.group, []); byDir.get(r.group)!.push(r); });
    if (byDir.size) {
      setDirs([...byDir.values()].map((fs) => {
        const g = (re: RegExp) => fs.find((r) => re.test(r.name))?.value?.trim() ?? '';
        return {
          name: g(/full name/i), bvn: digits(g(/bvn/i)),
          idType: matchOption(g(/means of identification|id type/i), ['International Passport', 'National ID card', "Driver's licence", "Voter's card"]) ?? EMPTY_DIR.idType,
          idNumber: g(/id\b|identification/i),
          phone: digits(g(/phone/i)), email: g(/email/i),
          role: matchOption(g(/designation|role/i), ROLES) ?? 'Director',
        };
      }));
    }
    setReviewDone(true);
    setReviewing(false);
    clearPendingExtraction();
    setResume(null);
  };
  const clearUpload = () => {
    setV(EMPTY_CORP); setDirs([{ ...EMPTY_DIR }]); setDoc(null); setAttachment(null);
    setExtractionInstance(null); setReviewDone(false);
    clearPendingExtraction(); setResume(null);
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => (step === 0 ? onBack() : setStep((s) => s - 1));

  const submit = async () => {
    setBusy(true);
    const primary = dirs[0] ?? EMPTY_DIR;
    const fields = {
      firstName: v.company.trim() || 'Unnamed business', lastName: '',
      entity: {
        companyName: v.company.trim(), rcNumber: v.rc.trim(), businessType: v.bizType, sector: v.sector.trim(),
        tin: v.tin.trim(), turnover: v.turnover, address: v.address.trim(), email: v.email.trim(), phone: digits(v.phone),
        directors: dirs.map((d) => ({ name: d.name.trim(), bvn: digits(d.bvn), idType: d.idType, idNumber: d.idNumber.trim(), phone: digits(d.phone), email: d.email.trim(), role: d.role })),
      },
      phone: digits(v.phone || primary.phone), email: (v.email || primary.email).trim(),
      bvn: digits(primary.bvn), nin: '', address: v.address.trim(),
      channel: 'single' as const, source: 'rm' as const,
    };
    // An upload already opened a draft record — fill that one in rather than
    // leaving it orphaned beside a second, near-identical row.
    const c = draftId
      ? await store.update(draftId, { ...fields, state: 'PRE_REGISTERED' })
      : await store.create(fields);
    // Start the REAL corporate Maestro case and link it to this record, so the
    // desk shows its live stage exactly like an individual one. Best-effort: a
    // Maestro hiccup must not lose an application the RM just captured.
    // An upload already started the case so the extraction could run while the RM
    // was still capturing — reuse it rather than starting a second one. Only the
    // fill-the-form path starts a case here.
    if (extractionInstance) {
      linkInstance(c.id, extractionInstance);   // no-op when the draft already linked it
      clearPendingExtraction();
    } else if (corporateMaestroReady()) {
      try {
        const instanceId = await startCorporateCase({
          applicantId: c.id,
          companyName: v.company.trim() || 'Unnamed business',
          rcNumber: v.rc.trim(),
          tin: v.tin.trim(),
          directors: dirs.length,
          document: attachment ?? undefined,
        });
        linkInstance(c.id, instanceId);
      } catch { /* case still captured; it just isn't live in Maestro */ }
    }
    onDone(c);
  };

  if (reviewing) {
    return (
      <ExtractionReview
        instanceId={extractionInstance ?? ''}
        docKey={docKey ?? undefined}
        attachmentId={attachment?.ID}
        documentName={attachment?.FullName}
        onAccepted={applyConfirmed}
        onClose={() => setReviewing(false)}
      />
    );
  }

  return (
    <>
      <div className="cx-head">
        <div className="cx-topline">
          <button className="cx-back" onClick={back} aria-label="Back"><Icon name="arrowLeft" /></button>
          <Brand sub={STEPS[step]} />
        </div>
        <Rail step={step} total={STEPS.length} />
      </div>

      <div className="cx-body">
        {step === 0 && (
          <>
            {onKind && rm && (
              <div className="cx-seg" role="tablist" aria-label="Account type">
                <button role="tab" aria-selected={false} onClick={() => onKind('individual')}>Individual</button>
                <button role="tab" aria-selected={true}>Corporate</button>
              </div>
            )}
            <h1 className="cx-h1">Business details</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>The registered company, exactly as it appears on the certificate of incorporation.</p>

            {!doc && resume && (
              <Note tone="warn" icon="clock">
                <b>An extraction is waiting for your review.</b>{' '}
                {resume.documentName} — started {new Date(resume.startedAt).toLocaleTimeString()}.
                <button type="button" className="cx-clearbtn" onClick={() => {
                  setExtractionInstance(resume.instanceId);
                  setAttachment({ ID: resume.attachmentId, FullName: resume.documentName, MimeType: 'application/pdf', Metadata: {} });
                  setDoc({ name: resume.documentName, phase: 'done', source: 'sample' });
                  setReviewing(true);
                }}>Resume review</button>
                <button type="button" className="cx-clearbtn" onClick={() => { clearPendingExtraction(); setResume(null); }}>Discard</button>
              </Note>
            )}
            {!doc && (
              <label className="cx-drop">
                <input type="file" accept="application/pdf,image/*" onChange={onUpload} hidden />
                <span className="cx-drop-ic"><Icon name="upload" size={18} /></span>
                <span className="cx-drop-t"><b>Have a completed form? Upload it</b><em>Scan or photo of the account opening form — we’ll read the company and directors.</em></span>
              </label>
            )}
            {/* No inline "Reading…" card any more: the review screen opens on the
                upload and shows the page being scanned, so the wait belongs there.
                This is only reached if the review could not open — no live case —
                in which case the wizard is genuinely the only thing on screen. */}
            {doc?.phase === 'reading' && !extractionInstance && (
              <div className="cx-drop reading"><span className="cx-spin" aria-hidden /><span className="cx-drop-t"><b>Reading {doc.name}…</b><em>{doc.note ?? 'Document Understanding is extracting the form.'}</em></span></div>
            )}
            {doc?.phase === 'done' && (
              <Note tone="good" icon="checkCircle">
                <b>Company and {dirs.length} {dirs.length === 1 ? 'director' : 'directors'} read from the form.</b>{' '}
                {doc.source === 'sample' && <>(Sample read — live extraction unavailable.) </>}
                {reviewDone
                  ? 'Please check each field before you continue.'
                  : 'The extraction is still waiting on your review.'}
                {/* The review is a gate on the case, so it has to be reachable again
                    after "Finish later" — otherwise the case sits parked with no way in. */}
                {extractionInstance && (
                  <button type="button" className="cx-clearbtn" onClick={() => setReviewing(true)}>
                    {reviewDone ? 'Reopen extraction' : 'Review extraction'}
                  </button>
                )}
                <button type="button" className="cx-clearbtn" onClick={clearUpload}>Clear</button>
              </Note>
            )}

            <Field label="Company / business name" name="company" value={v.company} onChange={set('company')} placeholder="ACME Trading Ltd" />
            <div className="cx-row">
              <Field label="RC / registration number" name="rc" value={v.rc} onChange={set('rc')} placeholder="1234567" />
              <Field label="Tax ID (TIN)" name="tin" value={v.tin} onChange={set('tin')} placeholder="01234567-0001" />
            </div>
            <div className="cx-row">
              <Select label="Category of business" value={v.bizType} onChange={(x) => setV((p) => ({ ...p, bizType: x }))} options={BIZ_TYPES} />
              <Field label="Sector / industry" name="sector" value={v.sector} onChange={set('sector')} placeholder="Information Technology" />
            </div>
            <Select label="Annual turnover" value={v.turnover} onChange={(x) => setV((p) => ({ ...p, turnover: x }))} options={TURNOVERS} />
            <Field label="Operating business address" name="address" value={v.address} onChange={set('address')} placeholder={`45 ${CO.streets[0]}, ${CO.cities[0]}`} />
            <div className="cx-row">
              <Field label="Business email" name="email" value={v.email} onChange={set('email')} inputMode="email" placeholder="accounts@company.com" />
              <Field label="Business phone" name="phone" value={v.phone} onChange={set('phone')} inputMode="numeric" placeholder="0803 000 0000" />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="cx-h1">Directors &amp; signatories</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>Everyone who signs on the account. Each is verified with {CO.primaryId.authority} in the background.</p>
            {dirs.map((d, i) => (
              <div className="cx-dir" key={i}>
                <div className="cx-dir-hd">
                  <span className="cx-dir-n">{i + 1}</span>
                  <b>{d.name.trim() || `Director ${i + 1}`}</b>
                  {dirs.length > 1 && <button type="button" className="cx-dir-x" onClick={() => removeDir(i)} aria-label="Remove"><Icon name="x" size={14} /></button>}
                </div>
                <Field label="Full name" name={`d-name-${i}`} value={d.name} onChange={(e) => setDir(i, 'name', e.target.value)} placeholder="Surname First Other" />
                <div className="cx-row">
                  <Field label={CO.primaryId.label} name={`d-bvn-${i}`} value={d.bvn} onChange={(e) => setDir(i, 'bvn', e.target.value)} inputMode="numeric" placeholder={`${CO.primaryId.numPrefix}12345678`} />
                  <Field label="ID number" name={`d-id-${i}`} value={d.idNumber} onChange={(e) => setDir(i, 'idNumber', e.target.value)} placeholder="Passport / ID no." />
                </div>
                <div className="cx-row">
                  <Field label="Phone" name={`d-ph-${i}`} value={d.phone} onChange={(e) => setDir(i, 'phone', e.target.value)} inputMode="numeric" placeholder="0803 000 0000" />
                  <Select label="Role" value={d.role} onChange={(x) => setDir(i, 'role', x)} options={ROLES} />
                </div>
                <Field label="Email" name={`d-em-${i}`} value={d.email} onChange={(e) => setDir(i, 'email', e.target.value)} inputMode="email" placeholder="name@company.com" />
              </div>
            ))}
            <Button variant="ghost" onClick={addDir}><Icon name="user" size={15} />Add another director</Button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="cx-h1">Check the details</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>Confirm this matches the form before you submit.</p>
            <div className="cx-card">
              <KV k="Company" v={v.company} />
              <KV k="RC number" v={v.rc} />
              <KV k="Category" v={v.bizType} />
              <KV k="Sector" v={v.sector} />
              <KV k="TIN" v={v.tin} />
              <KV k="Turnover" v={v.turnover} />
              <KV k="Address" v={v.address} />
              <KV k="Contact" v={`${v.email}${v.email && v.phone ? ' · ' : ''}${digits(v.phone)}`} />
            </div>
            {/* `auto` on the inline axis, not 0: this is a direct child of .cx-body,
                which centres its children in the content column. An inline margin
                beats the stylesheet, so a literal 0 here parks the label at the far
                left while the cards it labels stay centred. */}
            <div className="cx-label" style={{ margin: '14px auto 8px' }}>{dirs.length} director{dirs.length === 1 ? '' : 's'} / signatories</div>
            <div className="cx-card">
              {dirs.map((d, i) => (
                <KV key={i} k={d.name.trim() || `Director ${i + 1}`} v={`${d.role} · ${CO.primaryId.label} ${digits(d.bvn) || '—'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="cx-foot">
        {/* The consent sits with the button it belongs to, not at the end of the
            scroll. As the last row of the body it fell below the fold on a short
            window — the reviewer saw a half-sentence cut off by the footer and had
            to scroll a card list to find the tick box. The foot is already a
            column with a gap, so it stacks here by design. */}
        {step === 2 && (
          <label className="cx-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              The signatories confirm these details are correct and consent to {appName} verifying the company and each director with {CO.primaryId.authority}, {CO.secondaryId.authority} and screening partners.
            </span>
          </label>
        )}
        {step < 2 ? (
          // A business account has to have a business name. It normally arrives from
          // the read, so this only bites when the read found nothing — which is
          // exactly when someone has to type it.
          <Button onClick={next} disabled={step === 0 && !v.company.trim()}>
            Continue<Icon name="arrowRight" size={17} />
          </Button>
        ) : (
          <Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
        )}
      </div>
    </>
  );
}
