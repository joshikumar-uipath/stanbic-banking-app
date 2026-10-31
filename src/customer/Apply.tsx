// ─────────────────────────────────────────────────────────────────────────────
// Apply — the self-service opening wizard (Channel: 'self').
// About you → Identity (+ live duplicate check) → Address → Review → submit.
// Writes through the shared OnboardingStore; no waiting on downstream systems.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { store, type OnboardingCase, type DuplicateOutcome, type NewCaseInput } from '../onboarding';
import {
  clearPendingExtraction, linkInstance, maestroReady,
  startCase, type JobAttachmentRef,
} from '../onboarding/maestro';
import { useConfig } from '../config';
import { getActiveCountry } from '../config/countries';
import { Button, Field, Note, Rail, KV, Brand } from './ui';
import { fingerprint } from '../onboarding/extractionCache';
import { analyseFile, type DocFacts } from '../integrations/docChecks';
import PackageUpload from './PackageUpload';
import { useFormRead, startWithRetry } from './useFormRead';
import { packageFacts, type PackageResult, type Row as PackageRow } from '../integrations/packageDocs';
import { confirmPackageReview } from '../integrations/packageCase';
import { savePackage } from '../integrations/packageStore';
import ExtractionReview, { type ReviewField, personFromRows } from './ExtractionReview';
import Icon from './icons';

const CO = getActiveCountry();
const P = CO.primaryId, Sc = CO.secondaryId;   // primary=BVN slot, secondary=NIN slot

type Vals = {
  // What the form has always collected.
  firstName: string; lastName: string; phone: string; email: string;
  bvn: string; nin: string; address: string;
  // The rest of a real retail account opening form.
  title: string; middleName: string; dob: string; gender: string; maritalStatus: string;
  motherMaidenName: string; nationality: string; stateOfOrigin: string;
  idType: string; idNumber: string; idExpiry: string; tin: string;
  altPhone: string; city: string; stateOfResidence: string; lga: string; yearsAtAddress: string;
  employmentStatus: string; occupation: string; employer: string; incomeBand: string; sourceOfFunds: string;
  accountType: string; accountPurpose: string; branch: string;
  nokName: string; nokRelationship: string; nokPhone: string; nokAddress: string;
};

const TITLES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Chief', 'Prof'];
const GENDERS = ['Male', 'Female'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const ID_TYPES = ['International Passport', 'National ID card', "Driver's licence", "Voter's card", 'NIN slip'];
const EMPLOYMENT = ['Employed', 'Self-employed', 'Business owner', 'Student', 'Retired', 'Unemployed'];
const INCOME = [`Under ${CO.currency.symbol}1m`, `${CO.currency.symbol}1m – ${CO.currency.symbol}5m`,
  `${CO.currency.symbol}5m – ${CO.currency.symbol}20m`, `Above ${CO.currency.symbol}20m`];
const FUNDS = ['Salary', 'Business income', 'Investments', 'Pension', 'Gift / inheritance', 'Other'];
const ACCOUNT_TYPES = ['Savings', 'Current', 'Domiciliary'];
const PURPOSES = ['Everyday banking', 'Salary account', 'Savings', 'Business banking', 'Investment'];
const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Other relative', 'Friend'];

const EMPTY: Vals = {
  firstName: '', lastName: '', phone: '', email: '', bvn: '', nin: '', address: '',
  title: TITLES[0], middleName: '', dob: '', gender: '', maritalStatus: '',
  motherMaidenName: '', nationality: CO.name, stateOfOrigin: '',
  idType: ID_TYPES[0], idNumber: '', idExpiry: '', tin: '',
  altPhone: '', city: '', stateOfResidence: '', lga: '', yearsAtAddress: '',
  employmentStatus: EMPLOYMENT[0], occupation: '', employer: '', incomeBand: INCOME[1], sourceOfFunds: FUNDS[0],
  accountType: ACCOUNT_TYPES[0], accountPurpose: PURPOSES[0], branch: '',
  nokName: '', nokRelationship: RELATIONSHIPS[0], nokPhone: '', nokAddress: '',
};
const STEPS = ['About you', 'Identity', 'Address', 'Employment', 'Account', 'Review'];
const LAST = STEPS.length - 1;

// ── Demo fill ────────────────────────────────────────────────────────────────
// A presenter clicking through an empty form should still arrive at a review
// screen that reads like a real application. On Continue, any field on the step
// being left AND the step being entered that is still blank takes a value from
// one consistent sample applicant, drawn from the active market's own names,
// streets and identity formats. Anything the presenter typed is kept.
const SAMPLE: Vals = (() => {
  const co = CO;
  const first = co.firstNames[0] ?? 'Adaeze', last = co.lastNames[0] ?? 'Okafor';
  const street = co.streets[4] ?? co.streets[0] ?? 'Adeola Odeku St';
  const city = co.cities[0] ?? 'Lagos', state = co.states[0] ?? city;
  const trunk = co.phoneTrunk ?? '080';
  const addr = `14 ${street}, ${city}`;
  return {
    title: 'Mrs', firstName: first, middleName: 'Chinwe', lastName: last,
    dob: '1991-04-17', gender: 'Female', maritalStatus: 'Married', motherMaidenName: co.lastNames[3] ?? 'Nwosu',
    nationality: co.name, stateOfOrigin: co.states[5] ?? state,
    phone: `${trunk}1234567`, altPhone: `${trunk}9876543`, email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    bvn: `${P.numPrefix}4550018`, nin: `${Sc.numPrefix}6780042`,
    idType: ID_TYPES[0], idNumber: 'A01234567', idExpiry: '2029-06-30', tin: '12345678-0001',
    address: addr, city, stateOfResidence: state, lga: 'Eti-Osa', yearsAtAddress: '4',
    employmentStatus: EMPLOYMENT[0], occupation: 'Product manager', employer: co.companies[4] ?? 'MTN Nigeria', incomeBand: INCOME[2], sourceOfFunds: FUNDS[0],
    accountType: ACCOUNT_TYPES[0], accountPurpose: PURPOSES[0], branch: `${city} main branch`,
    nokName: `Chukwuemeka ${last}`, nokRelationship: RELATIONSHIPS[0], nokPhone: `${trunk}5512345`, nokAddress: addr,
  };
})();
/** Which fields each step shows, so the fill touches only what the presenter has
 *  seen or is about to see, never the whole form at once. */
const STEP_FIELDS: (keyof Vals)[][] = [
  ['title', 'firstName', 'middleName', 'lastName', 'dob', 'gender', 'maritalStatus', 'motherMaidenName', 'nationality', 'stateOfOrigin', 'phone', 'email'],
  ['bvn', 'nin', 'idType', 'idNumber', 'idExpiry', 'tin'],
  ['address', 'altPhone', 'city', 'stateOfResidence', 'lga', 'yearsAtAddress'],
  ['employmentStatus', 'occupation', 'employer', 'incomeBand', 'sourceOfFunds'],
  ['accountType', 'accountPurpose', 'branch', 'nokName', 'nokRelationship', 'nokPhone', 'nokAddress'],
];
function fillBlanks(vals: Vals, ...steps: number[]): Vals {
  let out = vals;
  for (const st of steps) for (const k of STEP_FIELDS[st] ?? []) {
    if (!out[k].trim()) { if (out === vals) out = { ...vals }; out[k] = SAMPLE[k]; }
  }
  return out;
}

const digits = (s: string) => s.replace(/\D/g, '');

/** Drop empty strings so an untouched field stays absent on the record — the
 *  details popup distinguishes "not captured" from a deliberate blank. */
function trimmed(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.trim()]).filter(([, x]) => x));
}

/** Same shape as the corporate wizard's — a labelled native select, so the long
 *  tail of coded fields (title, gender, income band) stays keyboard-friendly. */
function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="cx-field">
      <label>{label}</label>
      <select className="cx-input cx-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// NOTE: field validation is deliberately OFF for now — every step advances freely
// so the flow can be clicked straight through in a demo. Rules (required fields,
// 11-digit BVN/NIN, email format) get added back later. Duplicate detection still
// runs and reports, but never blocks.

/** 'self' = the customer opening their own account. 'rm' = a staff member
 *  capturing on someone's behalf — same wizard, staff-facing copy. */
export type ApplyMode = 'self' | 'rm';

export default function Apply({ onBack, onDone, mode = 'self', onKind }: { onBack: () => void; onDone: (c: OnboardingCase) => void; mode?: ApplyMode; onKind?: (k: 'individual' | 'corporate') => void }) {
  const appName = useConfig().branding.appName;
  const rm = mode === 'rm';
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Vals>(EMPTY);
  const [dup, setDup] = useState<DuplicateOutcome | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Scanned-form upload → Document Understanding → pre-fill.
  const [doc, setDoc] = useState<{ name: string; phase: 'reading' | 'done' | 'deferred' | 'failed'; fields?: number; error?: string } | null>(null);
  /** The last file picked, so a failed upload can be retried without picking it again. */
  const lastFile = useRef<File | null>(null);
  /** The uploaded form, parked as an Orchestrator attachment for the case to read. */
  const [attachment, setAttachment] = useState<JobAttachmentRef | null>(null);
  /** The case started by the upload. Linked to the record at submit. */
  const [extractionInstance, setExtractionInstance] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  /** Fingerprint of the uploaded file, so a document seen before paints at once. */
  const [docKey, setDocKey] = useState<string | null>(null);
  /** The record opened by the upload, filled in at submit rather than replaced. */
  const [draftId] = useState<string | null>(null);
  /** What the document checks read off the uploaded file (BR-DOC-01, 07). */
  const [docFacts, setDocFacts] = useState<DocFacts | null>(null);
  /** The documents of an uploaded package (the package flow — separate from the form upload). */
  const [pkgFacts, setPkgFacts] = useState<DocFacts[]>([]);
  /** The package's confirmed rows — they answer the case's own extraction review. */
  const [pkgRows, setPkgRows] = useState<PackageRow[]>([]);
  const [pkgRes, setPkgRes] = useState<PackageResult | null>(null);

  const set = (k: keyof Vals) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setV((p) => ({ ...p, [k]: ev.target.value }));
  };

  /** The single form, read in the browser. Confirming fills the wizard exactly as
   *  a package does, and marks the upload as read. */
  // Through a ref: applyPackage is declared further down, and only runs on confirm.
  const applyRef = useRef<(r: PackageResult) => void>(() => {});
  const formRead = useFormRead('individual', (r, name) => {
    applyRef.current(r);
    setDoc({ name, phase: 'done', fields: r.rows.filter((x) => x.value).length });
  });

  const onUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';                 // let the same file be re-picked
    if (!f) return;
    await uploadFile(f);
  };

  const uploadFile = async (f: File) => {
    lastFile.current = f;
    setDocKey(fingerprint(f));
    // Read in the browser and show it being scanned (useFormRead → PackageReview).
    // The case starts at Submit like any application; nothing here waits on IXP
    // or on the network.
    const facts = await f.arrayBuffer()
      .then((b) => analyseFile(f.name, new Uint8Array(b), { hint: 'aof', address: v.address }))
      .catch(() => null);
    if (facts) setDocFacts(facts);
    await formRead.read(f);
  };

  /** Confirmed review rows → the wizard's fields. Names come from the IXP taxonomy,
   *  so this matches on what the field is called rather than on a field id. */
  /** A date box on a form is written the way the form asks — 02/12/1992 on the
   *  Nigerian AOFs — and <input type="date"> accepts only yyyy-mm-dd. Anything
   *  else is silently dropped by the browser, so the field just stays empty and
   *  the extraction looks like it missed. Normalise before it gets there. */
  const asDate = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{4})$/);   // dd/mm/yyyy
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = t.match(/^(\d{2})(\d{2})(\d{4})$/);                          // ddmmyyyy, boxed
    if (d) return `${d[3]}-${d[2]}-${d[1]}`;
    return '';
  };

  /** Every one of these wizard fields is a <select>. Writing a value that is not
   *  one of its options leaves the control showing nothing, so an extracted
   *  "National ID Card" or "Sister" would read as "the model missed it" when in
   *  fact it read it correctly. Snap onto the closest option, or keep what was
   *  there — never write a value the control cannot show. */
  const snap = (raw: string, options: string[], synonyms: Record<string, string> = {}): string => {
    const t = raw.trim().toLowerCase();
    if (!t) return '';
    const exact = options.find((o) => o.toLowerCase() === t);
    if (exact) return exact;
    for (const [k, v] of Object.entries(synonyms)) if (new RegExp(k, 'i').test(t)) return v;
    return options.find((o) => {
      const l = o.toLowerCase();
      return l.includes(t) || t.includes(l);
    }) ?? '';
  };
  const KIN_OF: Record<string, string> = {
    'sister|brother|sibling': 'Sibling', 'mother|father|parent': 'Parent',
    'son|daughter': 'Child', 'wife|husband|spouse': 'Spouse',
    'cousin|uncle|aunt|niece|nephew': 'Other relative',
  };

  const applyRows = (rows: ReviewField[]) => {
    // Scope every lookup to a GROUP first. The taxonomy repeats field names across
    // sections — Surname, First Name, Date of Birth and Gender all appear under
    // both Personal Details and Next of Kin — so a search by name alone returns
    // whichever section happens to come first, and the applicant's identity gets
    // filled in with their next of kin's.
    const inGroup = (re: RegExp) => rows.filter((r) => re.test(r.group));
    const APPLICANT = inGroup(/applicant|personal/i);
    const KIN = inGroup(/next of kin|kin/i);
    const CONTACT = inGroup(/contact/i);
    const WORK = inGroup(/employ/i);
    const ID = inGroup(/identification|account setup/i);
    // Branch, account type and purpose are on the form and were being read
    // and then thrown away — nothing applied them to the wizard.
    const ACCOUNT = inGroup(/account setup/i);

    const val = (rs: ReviewField[], re: RegExp) => rs.find((r) => re.test(r.name))?.value?.trim() ?? '';
    const set = (k: keyof Vals, rs: ReviewField[], re: RegExp, via?: (v: string) => string) => {
      const x = val(rs, re);
      if (!x) return {};
      const out = via ? via(x) : x;
      // A transform that cannot place the value (an unparseable date, an option
      // this select does not carry) returns empty — leave the field alone rather
      // than blanking what the applicant already typed.
      return out ? { [k]: out } : {};
    };

    // Names decide what the record is CALLED on the desk — the shared mapper, so
    // the wizard and the desk read a name out of the same rows the same way.
    const person = personFromRows(rows);
    const names = { firstName: person.firstName ?? '', lastName: person.lastName ?? '' };

    // The draft record was opened at upload under a placeholder name. Write the
    // confirmed read onto it now — not at Submit — so the desk shows who this is
    // the moment the read is confirmed, even if the applicant stops here ("Finish
    // later") and the case runs on without them. Best-effort, as for corporate.
    if (draftId && names.firstName) {
      void store.update(draftId, person).catch(() => { /* keeps the placeholder until Submit */ });
    }

    setV((p) => ({
      ...p,
      ...(names.firstName ? { firstName: names.firstName } : {}),
      ...(names.lastName ? { lastName: names.lastName } : {}),
      ...set('middleName', APPLICANT, /other name|middle name/i),
      ...set('title', APPLICANT, /^title$/i, (x) => snap(x, TITLES)),
      ...set('dob', APPLICANT, /date of birth/i, asDate),
      ...set('gender', APPLICANT, /^gender$/i, (x) => snap(x, GENDERS)),
      ...set('maritalStatus', APPLICANT, /marital/i, (x) => snap(x, MARITAL)),
      ...set('motherMaidenName', APPLICANT, /maiden/i),
      ...set('nationality', APPLICANT, /nationality/i),
      ...set('stateOfOrigin', APPLICANT, /state of origin/i),
      ...set('tin', APPLICANT, /\bTIN\b/i),
      ...set('bvn', ID, /\bBVN\b/i),
      ...set('nin', ID, /\bNIN\b/i),
      ...set('idType', ID, /id type|means of identification/i,
        (x) => snap(x, ID_TYPES, { 'national id|nimc': 'National ID card', 'nin': 'NIN slip', 'passport': 'International Passport' })),
      ...set('idNumber', ID, /id number/i),
      ...set('idExpiry', ID, /expiry/i, asDate),
      ...set('phone', CONTACT, /phone number 1|^phone/i),
      ...set('altPhone', CONTACT, /phone number 2|alternate/i),
      ...set('email', CONTACT, /^email/i),
      // House Number and Street Name are separate boxes on the form. Reading only
      // one of them puts "Tinubu" in the address line instead of "4 Tinubu".
      ...(() => {
        const line = [val(CONTACT, /house number|house no/i), val(CONTACT, /street name/i)]
          .filter(Boolean).join(' ') || val(CONTACT, /address/i);
        return line ? { address: line } : {};
      })(),
      ...set('city', CONTACT, /city|town/i),
      ...set('stateOfResidence', CONTACT, /^state$/i),
      ...set('lga', CONTACT, /\bLGA\b|local govt/i),
      ...set('employmentStatus', WORK, /employment status/i, (x) => snap(x, EMPLOYMENT, { 'civil servant|salaried': 'Employed' })),
      ...set('occupation', WORK, /occupation/i),
      ...set('employer', WORK, /employer name/i),
      // The form's own band ("NGN 51,000 – NGN 250,000") is not one of ours, so
      // this usually declines to write rather than inventing a bracket.
      ...set('incomeBand', WORK, /salary|income/i, (x) => snap(x, INCOME)),
      ...set('branch', ACCOUNT, /^branch$/i),
      ...set('accountType', ACCOUNT, /account type/i, (x) => snap(x, ACCOUNT_TYPES)),
      ...set('accountPurpose', ACCOUNT, /purpose/i, (x) => snap(x, PURPOSES)),
      // Next of kin is a DIFFERENT PERSON — only ever read from the kin group.
      // The kin's name is three boxes, same as the applicant's. Matching on
      // /surname/ alone put a lone "Dada" on the record.
      ...(() => {
        const full = [val(KIN, /first name/i), val(KIN, /other name/i), val(KIN, /surname|last name/i)]
          .filter(Boolean).join(' ') || val(KIN, /full name|^name$/i);
        return full ? { nokName: full } : {};
      })(),
      ...set('nokRelationship', KIN, /relationship/i, (x) => snap(x, RELATIONSHIPS, KIN_OF)),
      ...set('nokPhone', KIN, /mobile|phone/i),
      // The kin's address is on the form even where the model has no field for
      // it — same house-number-plus-street shape as the applicant's.
      ...(() => {
        const line = [val(KIN, /house number/i), val(KIN, /street name/i)]
          .filter(Boolean).join(' ') || val(KIN, /address/i);
        return line ? { nokAddress: line } : {};
      })(),
    }));
    setDoc({ name: attachment?.FullName ?? 'the form', phase: 'done', fields: rows.length });
    setReviewing(false);
  };


  /** A package's confirmed rows fill the wizard the way a confirmed review does;
   *  its documents ride on the record for the document checks. The single-form
   *  status card is cleared — a package is not "the form". */
  const applyPackage = (r: PackageResult) => {
    applyRows(r.rows as ReviewField[]);
    setDoc(null);
    setPkgFacts(packageFacts(r));
    setPkgRows(r.rows);
    setPkgRes(r);
  };
  useEffect(() => { applyRef.current = applyPackage; });

  const clearUpload = () => { setV(EMPTY); setDoc(null); setAttachment(null); setExtractionInstance(null); };

  const next = async () => {
    // Demo fill: blanks on the step being left and the one being entered.
    const filled = fillBlanks(v, step, step + 1);
    if (filled !== v) setV(filled);
    if (step === 1 && (filled.bvn || filled.nin || filled.phone)) {
      // Duplicate detection (Step 2 of the guide) — informational for now.
      setDup(await store.checkDuplicate({ bvn: digits(filled.bvn), nin: digits(filled.nin), phone: digits(filled.phone) }));
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    setBusy(true);
    const fields: NewCaseInput = {
      firstName: v.firstName.trim(), lastName: v.lastName.trim(),
      phone: digits(v.phone), email: v.email.trim(),
      bvn: digits(v.bvn), nin: digits(v.nin), address: v.address.trim(),
      // Staff-assisted openings are the bank's Phase 1; self-service is the customer's.
      channel: rm ? 'single' : 'self', source: rm ? 'rm' : 'customer',
      // The rest of the form. Blanks are dropped rather than stored as '' so the
      // details popup can tell "not captured" from "captured as empty".
      ...trimmed({
        title: v.title, middleName: v.middleName, dob: v.dob, gender: v.gender,
        maritalStatus: v.maritalStatus, motherMaidenName: v.motherMaidenName,
        nationality: v.nationality, stateOfOrigin: v.stateOfOrigin,
        idType: v.idType, idNumber: v.idNumber, idExpiry: v.idExpiry, tin: v.tin,
        altPhone: digits(v.altPhone), city: v.city, stateOfResidence: v.stateOfResidence,
        lga: v.lga, yearsAtAddress: v.yearsAtAddress,
        employmentStatus: v.employmentStatus, occupation: v.occupation, employer: v.employer,
        incomeBand: v.incomeBand, sourceOfFunds: v.sourceOfFunds,
        accountType: v.accountType, accountPurpose: v.accountPurpose, branch: v.branch,
      }),
      ...(docFacts || pkgFacts.length ? { documentFacts: [...(docFacts ? [docFacts] : []), ...pkgFacts] } : {}),
      nextOfKin: v.nokName.trim()
        ? { name: v.nokName.trim(), relationship: v.nokRelationship, phone: digits(v.nokPhone), address: v.nokAddress.trim() || undefined }
        : undefined,
    };
    // An upload already opened a record for this application — fill that one in
    // rather than leaving it orphaned beside a second, near-identical row.
    const c = draftId ? await store.update(draftId, fields) : await store.create(fields);
    // The package's files and rows, kept against the record for the desk's review.
    if (pkgRes) void savePackage(c.id, pkgRes);
    // An upload already started the case so the extraction could run while the
    // applicant was still typing — tie it to the record now rather than starting
    // a second one. A no-op when the draft already carried the link.
    if (extractionInstance) {
      linkInstance(c.id, extractionInstance);
    } else if (maestroReady()) {
      // Nothing was uploaded, so nothing has started yet. Submitting the form IS
      // the trigger — open the case here, the way the corporate wizard does, so
      // the desk shows a live stage without anyone pressing "Run this case in
      // Maestro". Best-effort: a Maestro hiccup must not lose the application.
      try {
        const id = await startWithRetry(() => startCase({
          applicantId: c.id,
          firstName: c.firstName, lastName: c.lastName,
          bvn: c.bvn, nin: c.nin, channel: c.channel,
        }));
        linkInstance(c.id, id);
        // A package was confirmed in the package review: answer the case's own
        // "Confirm extracted details" with it, so nobody is asked twice.
        if (pkgRows.length) void confirmPackageReview(id, pkgRows, false);
      } catch { /* captured all the same; it just isn't live in Maestro */ }
    }
    clearPendingExtraction();
    onDone(c);
  };

  const back = () => (step === 0 ? onBack() : setStep((s) => s - 1));

  // The review takes over the whole surface while it is open — the same treatment
  // the corporate wizard gives it, so the applicant reads the form against the
  // pages it came from rather than in a corner of the wizard.
  if (reviewing && extractionInstance) {
    return (
      <ExtractionReview
        corporate={false}
        instanceId={extractionInstance}
        docKey={docKey ?? undefined}
        attachmentId={attachment?.ID}
        documentName={attachment?.FullName}
        onAccepted={applyRows}
        // Closing without confirming keeps the case running and the upload parked;
        // the applicant can carry on typing and the review stays reachable.
        // Finish later ≠ finished. The case keeps reading and the review stays
        // parked, so say that and keep a way back in — otherwise the only route
        // to a review you stepped away from is to upload the form again.
        onClose={() => { setReviewing(false); setDoc({ name: attachment?.FullName ?? 'the form', phase: 'deferred' }); }}
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
                <button role="tab" aria-selected={true}>Individual</button>
                <button role="tab" aria-selected={false} onClick={() => onKind('corporate')}>Corporate</button>
              </div>
            )}
            <h1 className="cx-h1">{rm ? 'Customer details' : 'Let’s start with you'}</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>{rm ? `Enter their name exactly as it appears on their ${Sc.label}.` : `Use your name exactly as it appears on your ${Sc.label}.`}</p>

            {/* Upload a completed form → Document Understanding reads it and pre-fills. */}
            {/* The two ways in, side by side: one completed form (read by the
                case's IXP), or the whole package (read here, in the browser). */}
            <div className={rm && !doc ? 'cx-drop-row' : undefined}>
              {!doc && (
                <label className="cx-drop">
                  <input type="file" accept="application/pdf,image/*" onChange={onUpload} hidden />
                  <span className="cx-drop-ic"><Icon name="upload" size={18} /></span>
                  <span className="cx-drop-t">
                    <b>{rm ? 'Have a completed form? Upload it' : 'Have a completed form? Upload it'}</b>
                    <em>Scan or photo of the account opening form — we’ll read it and fill this in.</em>
                  </span>
                </label>
              )}
              {rm && !doc && !formRead.reading && <PackageUpload kind="individual" onApply={applyPackage} />}
            </div>
            {formRead.reading && (
              <div className="cx-drop reading">
                <span className="cx-spin" aria-hidden />
                <span className="cx-drop-t"><b>Opening {formRead.name}…</b><em>Reading the form in the browser.</em></span>
              </div>
            )}
            {formRead.wrongKind && (
              <Note tone="warn" icon="clock">
                <b>{formRead.name} is a company account form.</b> Switch to the Corporate tab and upload it there.
              </Note>
            )}
            {formRead.review}
            {doc?.phase === 'reading' && (
              <div className="cx-drop reading">
                <span className="cx-spin" aria-hidden />
                <span className="cx-drop-t"><b>Reading {doc.name}…</b><em>Document Understanding is extracting the fields.</em></span>
              </div>
            )}
            {doc?.phase === 'deferred' && (
              <Note tone="warn" icon="clock">
                <b>{doc.name} is uploaded and the case is still reading it.</b> Nothing has been
                filled in yet — finish the review to bring the values across, or carry on typing
                and come back to it.
                {extractionInstance && (
                  <button type="button" className="cx-clearbtn" onClick={() => setReviewing(true)}>
                    Resume review
                  </button>
                )}
                <button type="button" className="cx-clearbtn" onClick={clearUpload}>Clear</button>
              </Note>
            )}
            {doc?.phase === 'failed' && (
              <Note tone="warn" icon="clock">
                <b>{doc.name} could not be sent to the case.</b> {/failed to fetch|network|ENOTFOUND|ECONN|load failed/i.test(doc.error ?? '')
                  ? 'The connection to UiPath dropped — check the network (or VPN) and try again.'
                  : `UiPath answered: ${doc.error}`}
                <button type="button" className="cx-clearbtn" onClick={() => { if (lastFile.current) void uploadFile(lastFile.current); }}>Try again</button>
                <button type="button" className="cx-clearbtn" onClick={clearUpload}>Clear</button>
              </Note>
            )}
            {doc?.phase === 'done' && (
              <Note tone="good" icon="checkCircle">
                {/* What THIS upload produced. The old copy named a hardcoded company
                    and a "signing director" — leftovers from the stub read, shown
                    verbatim on every individual application. */}
                <b>{doc.fields ?? 0} field{doc.fields === 1 ? '' : 's'} read from {doc.name}.</b> Please check each one before you continue.
                <button type="button" className="cx-clearbtn" onClick={clearUpload}>Clear</button>
              </Note>
            )}

            <div className="cx-row">
              <Select label="Title" value={v.title} onChange={(x) => setV((p) => ({ ...p, title: x }))} options={TITLES} />
              <Field label="First name" name="firstName" value={v.firstName} onChange={set('firstName')} autoComplete="given-name" />
            </div>
            <div className="cx-row">
              <Field label="Middle name" name="middleName" value={v.middleName} onChange={set('middleName')} autoComplete="additional-name" />
              <Field label="Last name" name="lastName" value={v.lastName} onChange={set('lastName')} autoComplete="family-name" />
            </div>
            <div className="cx-row">
              <Field label="Date of birth" name="dob" type="date" value={v.dob} onChange={set('dob')} />
              <Select label="Gender" value={v.gender} onChange={(x) => setV((p) => ({ ...p, gender: x }))} options={['', ...GENDERS]} />
            </div>
            <div className="cx-row">
              <Select label="Marital status" value={v.maritalStatus} onChange={(x) => setV((p) => ({ ...p, maritalStatus: x }))} options={['', ...MARITAL]} />
              <Field label="Mother's maiden name" name="motherMaidenName" value={v.motherMaidenName} onChange={set('motherMaidenName')} hint="Used to verify you when you call the bank." />
            </div>
            <div className="cx-row">
              <Field label="Nationality" name="nationality" value={v.nationality} onChange={set('nationality')} />
              <Field label="State of origin" name="stateOfOrigin" value={v.stateOfOrigin} onChange={set('stateOfOrigin')} placeholder={`e.g. ${CO.cities[0]}`} />
            </div>
            <Field label="Phone number" name="phone" value={v.phone} onChange={set('phone')} inputMode="numeric" placeholder="0803 000 0000" autoComplete="tel" />
            <Field label="Email address" name="email" value={v.email} onChange={set('email')} inputMode="email" placeholder="you@example.com" autoComplete="email" />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="cx-h1">{rm ? 'Identity' : 'Your identity'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>{rm ? `Verified with ${P.authority} and ${Sc.authority} in the background — the account opens without waiting.` : `We verify these with ${P.authority} and ${Sc.authority} in the background. You won’t wait for it.`}</p>
            <Field label={P.label} name="bvn" value={v.bvn} onChange={set('bvn')} inputMode="numeric" placeholder={`${P.numPrefix}12345678`} hint={rm ? `Verified with ${P.authority}.` : `Your ${P.label}, issued by ${P.authority}.`} />
            <Field label={Sc.label} name="nin" value={v.nin} onChange={set('nin')} inputMode="numeric" placeholder={`${Sc.numPrefix}23456789`} hint={rm ? `Verified with ${Sc.authority}.` : `Your ${Sc.label}, issued by ${Sc.authority}.`} />
            <div className="cx-row">
              <Select label="Means of identification" value={v.idType} onChange={(x) => setV((p) => ({ ...p, idType: x }))} options={ID_TYPES} />
              <Field label="ID number" name="idNumber" value={v.idNumber} onChange={set('idNumber')} placeholder="A50293912" />
            </div>
            <div className="cx-row">
              <Field label="ID expiry date" name="idExpiry" type="date" value={v.idExpiry} onChange={set('idExpiry')} />
              <Field label="Tax ID (TIN)" name="tin" value={v.tin} onChange={set('tin')} inputMode="numeric" hint="Optional for a personal account." />
            </div>
            {dup === 'existing' && (
              <Note tone="warn" icon="alert">
                <b>These details match an existing customer.</b> In production this stops here — we never open a duplicate account.
              </Note>
            )}
            {dup === 'potential-duplicate' && (
              <Note tone="info" icon="info">
                Some of these details look familiar. We&rsquo;ll continue, and someone will confirm before your account opens.
              </Note>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="cx-h1">{rm ? 'Address' : 'Where do you live?'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>{rm ? 'Proof of address can follow later — it won’t hold up the account.' : 'You can send proof of address later — it won’t hold up your account.'}</p>
            <Field label="Residential address" name="address" value={v.address} onChange={set('address')} placeholder={`7 ${CO.streets[0]}`} autoComplete="street-address" />
            <div className="cx-row">
              <Field label="City / town" name="city" value={v.city} onChange={set('city')} placeholder={`e.g. ${CO.cities[0]}`} autoComplete="address-level2" />
              <Field label="State" name="stateOfResidence" value={v.stateOfResidence} onChange={set('stateOfResidence')} placeholder={`e.g. ${CO.cities[1]}`} autoComplete="address-level1" />
            </div>
            <div className="cx-row">
              <Field label="LGA / district" name="lga" value={v.lga} onChange={set('lga')} />
              <Field label="Years at this address" name="yearsAtAddress" value={v.yearsAtAddress} onChange={set('yearsAtAddress')} inputMode="numeric" placeholder="3" />
            </div>
            <Field label="Alternate phone" name="altPhone" value={v.altPhone} onChange={set('altPhone')} inputMode="numeric" placeholder="0703 000 0000" hint="Optional — used if we cannot reach the main number." />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="cx-h1">{rm ? 'Employment and income' : 'What do you do?'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>
              {rm
                ? 'Required for the risk rating and transaction limits on the account.'
                : 'This sets the limits on your account, and we are required to ask.'}
            </p>
            <div className="cx-row">
              <Select label="Employment status" value={v.employmentStatus} onChange={(x) => setV((p) => ({ ...p, employmentStatus: x }))} options={EMPLOYMENT} />
              <Field label="Occupation" name="occupation" value={v.occupation} onChange={set('occupation')} placeholder="Teacher" />
            </div>
            <Field label="Employer" name="employer" value={v.employer} onChange={set('employer')} placeholder={`e.g. ${CO.companies[0]}`} hint="Leave blank if self-employed or not working." />
            <div className="cx-row">
              <Select label="Annual income" value={v.incomeBand} onChange={(x) => setV((p) => ({ ...p, incomeBand: x }))} options={INCOME} />
              <Select label="Source of funds" value={v.sourceOfFunds} onChange={(x) => setV((p) => ({ ...p, sourceOfFunds: x }))} options={FUNDS} />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="cx-h1">{rm ? 'The account' : 'Your new account'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>
              {rm ? 'What is being opened, and who to contact if the customer cannot be reached.' : 'What you are opening, and who we can contact if we cannot reach you.'}
            </p>
            <div className="cx-row">
              <Select label="Account type" value={v.accountType} onChange={(x) => setV((p) => ({ ...p, accountType: x }))} options={ACCOUNT_TYPES} />
              <Select label="Purpose" value={v.accountPurpose} onChange={(x) => setV((p) => ({ ...p, accountPurpose: x }))} options={PURPOSES} />
            </div>
            <Field label="Preferred branch" name="branch" value={v.branch} onChange={set('branch')} placeholder={`${CO.cities[0]} main branch`} />

            <div className="cx-nok-h">Next of kin</div>
            <div className="cx-row">
              <Field label="Full name" name="nokName" value={v.nokName} onChange={set('nokName')} />
              <Select label="Relationship" value={v.nokRelationship} onChange={(x) => setV((p) => ({ ...p, nokRelationship: x }))} options={RELATIONSHIPS} />
            </div>
            <div className="cx-row">
              <Field label="Phone" name="nokPhone" value={v.nokPhone} onChange={set('nokPhone')} inputMode="numeric" placeholder="0803 000 0000" />
              <Field label="Address" name="nokAddress" value={v.nokAddress} onChange={set('nokAddress')} />
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="cx-h1">{rm ? 'Check the details' : 'Check your details'}</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>{rm ? 'Confirm this matches the customer’s ID before you submit.' : 'Make sure this matches your ID.'}</p>
            <div className="cx-card">
              <KV k="Name" v={`${v.firstName} ${v.lastName}`} />
              <KV k="Phone" v={digits(v.phone)} />
              <KV k="Email" v={v.email} />
              <KV k={P.label} v={digits(v.bvn)} />
              <KV k={Sc.label} v={digits(v.nin)} />
              <KV k="Address" v={[v.address, v.city, v.stateOfResidence].filter(Boolean).join(', ')} />
              <KV k="Date of birth" v={v.dob} />
              <KV k="Identification" v={[v.idType, v.idNumber].filter(Boolean).join(' · ')} />
              <KV k="Employment" v={[v.employmentStatus, v.occupation].filter(Boolean).join(' · ')} />
              <KV k="Account" v={[v.accountType, v.accountPurpose].filter(Boolean).join(' · ')} />
              <KV k="Next of kin" v={[v.nokName, v.nokRelationship].filter(Boolean).join(' · ')} />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: '#0033A1' }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--soft)' }}>
                {rm
                  ? `The customer confirms these details are theirs and consents to ${appName} verifying them with ${P.authority}, ${Sc.authority} and screening partners.`
                  : `I confirm these details are mine and consent to ${appName} verifying them with ${P.authority}, ${Sc.authority} and screening partners.`}
              </span>
            </label>
          </>
        )}
      </div>

      <div className="cx-foot">
        {step < LAST ? (
          <Button onClick={next}>Continue<Icon name="arrowRight" size={17} /></Button>
        ) : (
          <Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
        )}
      </div>
    </>
  );
}
