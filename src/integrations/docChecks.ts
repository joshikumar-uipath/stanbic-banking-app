// ─────────────────────────────────────────────────────────────────────────────
// Document checks — BR-DOC-01, 04, 05, 06, 07 and 08.
//
// Two halves:
//
//   analyseFile()  reads an uploaded file's BYTES once, at upload or bundle
//                  intake: what kind of document it is (from its content, not
//                  its name), whether an editor touched it, its passport MRZ,
//                  the dates printed on it, and a fingerprint for re-use
//                  detection. The result is a few compact FACTS stored on the
//                  record (`documentFacts`) — a record is serialised to a small
//                  JSON column, so the bytes and text never ride on it.
//
//   documentsFor() turns those facts, plus what the record itself says (ID
//                  type, expiry, RC number, field confidence), into one result
//                  per document — every check judged against the Document
//                  rules DMN (./docRules). Because the facts are judged on read,
//                  an edited rule applies to records already captured.
//
// Real: content classification, PDF/image tamper signals, MRZ check digits,
// expiry, bill age, file fingerprints. Simulated: the issuing-authority lookups
// (NIMC, NIS, FRSC, INEC, CAC) — shaped so a vendor drops in later.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase } from '../onboarding/types';
import { judge, strictest, ID_TYPES, type Facts, type Outcome } from './docRules';
import { findIdentity } from '../fixtures';

export type DocType =
  | 'passport' | 'national-id' | 'nin-slip' | 'drivers-licence' | 'voters-card'
  | 'utility-bill' | 'cac-certificate' | 'memart' | 'cac-form' | 'aof' | 'selfie' | 'unknown'
  // An account-opening package's other documents (src/integrations/packageDocs).
  | 'aof-page' | 'mandate' | 'board-resolution' | 'consent' | 'references' | 'tin-printout'
  | 'avr' | 'cdd' | 'bvn-portal' | 'bvn-api' | 'nin-api' | 'nin-lookup' | 'others-printout'
  | 'aof-signatory' | 'tin-certificate' | 'legal-search' | 'dud-cheque' | 'adverse-media' | 'sanctions'
  | 'watchlist' | 'checklist' | 'customer-letter';

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  passport: 'International passport', 'national-id': 'National ID card', 'nin-slip': 'NIN slip',
  'drivers-licence': "Driver's licence", 'voters-card': "Voter's card", 'utility-bill': 'Utility bill',
  'cac-certificate': 'Certificate of incorporation', memart: 'MEMART', 'cac-form': 'CAC status form (CO2/CO7)',
  aof: 'Account opening form', selfie: 'Selfie', unknown: 'Unidentified document',
  'aof-page': 'Account opening form — amended / additional page', mandate: 'Mandate card',
  'board-resolution': 'Board resolution', consent: 'Data-processing consent', references: 'References',
  'tin-printout': 'TIN validation', avr: 'Address verification report', cdd: 'Customer due diligence',
  'bvn-portal': 'BVN validation — portal screen', 'bvn-api': 'BVN validation — API data',
  'nin-api': 'NIN validation — NIMC API data', 'nin-lookup': 'ID card validation — NIMC lookup',
  'others-printout': 'Others — accounts-by-mobile check',
  'aof-signatory': 'Account opening form — signatory page', 'tin-certificate': 'TIN certificate',
  'legal-search': 'Legal search report', 'dud-cheque': 'Dud cheque search', 'adverse-media': 'Adverse media search',
  sanctions: 'Sanctions screening', watchlist: 'Internal watchlist search', checklist: 'Document checklist',
  'customer-letter': 'Customer letter / instruction',
};

/** What analyseFile() learned, stored on the record. Short keys: it is persisted. */
export interface DocFacts {
  t: DocType;          // type
  f?: string;          // file name
  c?: number;          // classification confidence 0..1
  b?: 'content' | 'name' | 'form';   // how the type was decided
  h?: string;          // fingerprint (first 20 hex of SHA-256)
  e?: boolean;         // saved by an editing tool
  m?: boolean;         // modified after creation
  p?: string;          // producer / creator, for the evidence line
  mrz?: boolean;       // MRZ found and all check digits verify (absent: no MRZ read)
  x?: string;          // expiry date read off the document, ISO
  d?: string;          // issue / bill date read off the document, ISO
  am?: number;         // address on the document vs the application, 0..1
  n?: string;          // document number read off it (passport MRZ)
  at: string;          // when it was analysed
  [k: string]: unknown;
}

/** One check's line on a document card. */
export interface CheckLine {
  check: string;
  label: string;
  outcome: Outcome | 'n/a';
  detail: string;
  /** DMN row that decided it, for "Rule 5 · BR-DOC-06". */
  rule?: number;
  ref?: string;
}

export interface IssuerCall {
  authority: string;
  method: 'POST';
  path: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  http: number;
  latencyMs: number;
}

export interface DocResult {
  type: DocType;
  label: string;
  file?: string;
  /** Where the facts came from: an analysed file, or only the application. */
  source: 'file' | 'application';
  lines: CheckLine[];
  outcome: Outcome;
  issuer?: IssuerCall;
  analysedAt?: string;
  producer?: string;
  /** Who produced the document, for a package's files: customer, bank, third party. */
  from?: string;
}

// ── Reading a file ───────────────────────────────────────────────────────────
const latin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return s; };

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) return null;
  try {
    const s = new Blob([data as BlobPart]).stream().pipeThrough(new DS('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  } catch { return null; }
}

/** The text a PDF draws: literal strings inside its (de-compressed) content streams. */
async function pdfText(raw: string, bytes: Uint8Array): Promise<string> {
  // The raw bytes carry text only in an uncompressed (small, generated) PDF; a
  // multi-megabyte scan is image data, and scanning it as text is wasted work.
  const parts: string[] = [raw.length < 300_000 ? raw : raw.slice(0, 4_000)];
  // Sliced to the dictionary's /Length — the browser's inflater rejects the
  // trailing bytes before `endstream`.
  const re = /<<([^<>]*\/FlateDecode[^<>]*)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(raw)) && n < 40) {
    const start = m.index + m[0].length;
    const len = Number(m[1].match(/\/Length\s+(\d+)/)?.[1] ?? 0);
    const end = len ? start + len : raw.indexOf('endstream', start);
    if (end < 0) break;
    const out = await inflate(bytes.subarray(start, end));
    if (out) parts.push(latin1(out));
    n++;
  }
  const all = parts.join('\n');
  // Text-showing operators carry the words in (…); joining them recovers lines.
  const shown = [...all.matchAll(/\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")/g)].map((x) => x[1]);
  // `[^\]()]` — not `[^\]]`: a "(" must only be matchable one way, or a long
  // binary run backtracks exponentially.
  const arrays = [...all.matchAll(/\[((?:\([^)]*\)|[^\]()])*)\]\s*TJ/g)].map((x) => [...x[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((y) => y[1]).join(''));
  return [...shown, ...arrays].join('\n').replace(/\\([()\\])/g, '$1') + '\n' + all;
}

// Tools that can change what a document SAYS. Compressors and exporters (iLovePDF,
// Smallpdf, iText) are deliberately absent: re-compressing a scan is not tampering.
/** Compressors and scan/document-system exporters — they rewrite files wholesale. */
const COMPRESSORS = /ilovepdf|smallpdf|itext|newgen|ghostscript|pdf ?compressor|adobe pdf library|scansnap|canon|epson|hp scan|kofax|abbyy/i;
const EDITORS = /photoshop|gimp|canva|microsoft[\s®]*word|word for|libreoffice|openoffice|pdfescape|sejda|pdf-xchange|nitro|foxit phantom|inkscape|paint\.net|pixelmator|snapseed|picsart|affinity|preview|pdfelement|acrobat pro/i;

/** "D:20260814093012+01'00'" → Date. */
function pdfDate(s?: string): Date | null {
  const m = s?.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))) : null;
}

// ── Passport MRZ (ICAO 9303, TD3) ────────────────────────────────────────────
const mrzVal = (ch: string) => (ch === '<' ? 0 : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 55);
export function mrzCheckDigit(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzVal(s[i]) * w[i % 3];
  return sum % 10;
}
/** Verify line 2 of a TD3 passport MRZ: document number, birth, expiry, optional, composite. */
export function verifyMrzLine2(l: string): { valid: boolean; expiry: string | null } {
  if (l.length !== 44) return { valid: false, expiry: null };
  const ok = (field: string, cd: string) => mrzCheckDigit(field) === +cd;
  const doc = ok(l.slice(0, 9), l[9]);
  const dob = ok(l.slice(13, 19), l[19]);
  const exp = ok(l.slice(21, 27), l[27]);
  const opt = l[42] === '<' || ok(l.slice(28, 42), l[42]);
  const composite = ok(l.slice(0, 10) + l.slice(13, 20) + l.slice(21, 43), l[43]);
  const yy = +l.slice(21, 23);
  const expiry = `${2000 + yy}-${l.slice(23, 25)}-${l.slice(25, 27)}`;
  return { valid: doc && dob && exp && opt && composite, expiry };
}

// ── Content classification (BR-DOC-01) ───────────────────────────────────────
const SIGNS: [DocType, RegExp, number][] = [
  ['passport', /P<[A-Z<]{3}[A-Z<]{10,}|PASSPORT\s*(NO|NUMBER)|FEDERAL REPUBLIC OF NIGERIA[\s\S]{0,80}PASSPORT/i, 0.95],
  ['nin-slip', /NATIONAL IDENTIFICATION NUMBER|NIN\s*SLIP|NIMC/i, 0.9],
  ['national-id', /NATIONAL IDENTITY CARD|GENERAL MULTI-?PURPOSE CARD/i, 0.9],
  ['drivers-licence', /DRIVER'?S?\s*LICEN[CS]E|FRSC|FEDERAL ROAD SAFETY/i, 0.9],
  ['voters-card', /VOTER'?S?\s*CARD|INEC|INDEPENDENT NATIONAL ELECTORAL/i, 0.9],
  ['utility-bill', /ELECTRICITY|DISTRIBUTION COMPANY|IKEDC|EKEDC|AEDC|PHED|ENERGY BILL|WATER (BOARD|CORPORATION)|AMOUNT DUE|BILL(ING)? (DATE|PERIOD)|METER (NO|NUMBER)/i, 0.88],
  ['cac-certificate', /CERTIFICATE OF INCORPORATION|CORPORATE AFFAIRS COMMISSION[\s\S]{0,200}CERTIF/i, 0.92],
  ['memart', /MEMORANDUM AND ARTICLES|ARTICLES OF ASSOCIATION/i, 0.9],
  ['cac-form', /FORM\s*CO\s*[27]|STATUS REPORT|PARTICULARS OF DIRECTORS/i, 0.85],
  ['aof', /ACCOUNT OPENING FORM|ACCOUNT OPENING|NEXT OF KIN/i, 0.85],
];
function classifyText(text: string): { type: DocType; confidence: number } | null {
  for (const [type, re, conf] of SIGNS) if (re.test(text)) return { type, confidence: conf };
  return null;
}
function classifyName(name: string): DocType {
  const n = name.toLowerCase();
  if (/passport/.test(n)) return 'passport';
  if (/nin|slip/.test(n)) return 'nin-slip';
  if (/driver|licen/.test(n)) return 'drivers-licence';
  if (/voter|pvc/.test(n)) return 'voters-card';
  if (/national|id[-_ .]?card|\bid\b/.test(n)) return 'national-id';
  if (/utility|bill|electric|water|poa|address/.test(n)) return 'utility-bill';
  if (/cac|incorporat|certificate/.test(n)) return 'cac-certificate';
  if (/memart|memorandum/.test(n)) return 'memart';
  if (/co2|co7|status/.test(n)) return 'cac-form';
  if (/aof|application|account[-_ ]?opening/.test(n)) return 'aof';
  if (/selfie|photo|face|portrait/.test(n)) return 'selfie';
  return 'unknown';
}

/** "Bill date: 14/07/2026", "Date of issue 2026-07-14", "July 2026" → ISO. */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function findDate(text: string, near: RegExp): string | null {
  const m = text.match(new RegExp(near.source + String.raw`[^\d\w]{0,12}(\d{1,2})[/\-. ](\d{1,2}|[A-Za-z]{3,9})[/\-. ](\d{4})`, 'i'));
  // The last three groups: `near` brings capture groups of its own.
  if (m) {
    const [dd, mm, yyyy] = m.slice(-3);
    const mon = /\d/.test(mm) ? +mm : MONTHS.indexOf(mm.slice(0, 3).toLowerCase()) + 1;
    if (mon >= 1) return `${yyyy}-${String(mon).padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const iso = text.match(new RegExp(near.source + String.raw`[^\d]{0,12}(\d{4})-(\d{2})-(\d{2})`, 'i'));
  if (!iso) return null;
  const [y, mo, d] = iso.slice(-3);
  return `${y}-${mo}-${d}`;
}

const sha = async (b: Uint8Array) => {
  try {
    const d = await crypto.subtle.digest('SHA-256', b as BufferSource);
    return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 20);
  } catch { return undefined; }
};

/** Similarity of two addresses (shared words), 0..1. */
function addressMatch(text: string, address?: string): number | undefined {
  const words = (address ?? '').toLowerCase().match(/[a-z0-9]{3,}/g);
  if (!words?.length) return undefined;
  const hay = text.toLowerCase();
  return words.filter((w) => hay.includes(w)).length / words.length;
}

/**
 * Read a file once. `hint` is the type the caller already believes (the slot it
 * was uploaded into) — used only when the content says nothing.
 */
export async function analyseFile(name: string, bytes: Uint8Array, opts: { hint?: DocType; address?: string } = {}): Promise<DocFacts> {
  const raw = latin1(bytes.subarray(0, Math.min(bytes.length, 6_000_000)));
  const isPdf = raw.startsWith('%PDF');
  const text = isPdf ? await pdfText(raw, bytes) : raw;
  const out: DocFacts = { t: 'unknown', f: name, at: new Date().toISOString(), h: await sha(bytes) };

  const byContent = classifyText(text);
  if (byContent) { out.t = byContent.type; out.c = byContent.confidence; out.b = 'content'; }
  else {
    const byName = opts.hint ?? classifyName(name);
    out.t = byName; out.c = byName === 'unknown' ? 0.3 : 0.6; out.b = 'name';
  }

  // Tamper signals.
  if (isPdf) {
    const producer = raw.match(/\/Producer\s*\(([^)]*)\)/)?.[1] ?? raw.match(/<pdf:Producer>([^<]*)</)?.[1];
    const creator = raw.match(/\/Creator\s*\(([^)]*)\)/)?.[1] ?? raw.match(/<xmp:CreatorTool>([^<]*)</)?.[1];
    out.p = [creator, producer].filter(Boolean).join(' · ').slice(0, 80) || undefined;
    out.e = EDITORS.test(`${creator ?? ''} ${producer ?? ''}`);
    const created = pdfDate(raw.match(/\/CreationDate\s*\(([^)]*)\)/)?.[1]);
    const modified = pdfDate(raw.match(/\/ModDate\s*\(([^)]*)\)/)?.[1]);
    const saves = (raw.match(/%%EOF/g) ?? []).length;
    // A compressor or a scanner/document-system export rewrites the whole file, so
    // "re-saved after creation" says nothing about its content there. Only an
    // editor's re-save (caught above) is evidence.
    const exporter = COMPRESSORS.test(`${creator ?? ''} ${producer ?? ''}`) && !out.e;
    out.m = !exporter && (saves > 1 || Boolean(created && modified && modified.getTime() - created.getTime() > 60_000));
  } else {
    // Images: editing software stamps EXIF "Software" or XMP "CreatorTool".
    const sw = raw.match(/(Adobe Photoshop[^\0<]{0,30}|GIMP[^\0<]{0,12}|Canva|Snapseed|PicsArt|Pixelmator[^\0<]{0,12}|Affinity Photo)/i)?.[1];
    out.e = Boolean(sw);
    if (sw) out.p = sw.trim().slice(0, 60);
    const c = raw.match(/<xmp:CreateDate>([^<]*)</)?.[1], md = raw.match(/<xmp:ModifyDate>([^<]*)</)?.[1];
    out.m = Boolean(c && md && new Date(md).getTime() - new Date(c).getTime() > 60_000);
  }

  // Passport MRZ.
  const l2 = text.match(/[A-Z0-9<]{9}\d[A-Z<]{3}\d{6}\d[MF<]\d{6}\d[A-Z0-9<]{14}[0-9<]\d/)?.[0];
  if (l2) {
    const v = verifyMrzLine2(l2);
    out.mrz = v.valid;
    out.n = l2.slice(0, 9).replace(/</g, '');
    if (v.expiry) out.x = v.expiry;
  }
  out.x = out.x ?? findDate(text, /(date of expiry|expiry date|expires|valid until|exp\.?)/) ?? undefined;
  out.d = findDate(text, /(bill(ing)? date|date of issue|issue date|statement date|invoice date|date)/) ?? undefined;
  if (out.t === 'utility-bill') out.am = addressMatch(text, opts.address);
  return out;
}

// ── Re-use registry (BR-DOC-08) ──────────────────────────────────────────────
// Every analysed certificate's fingerprint and RC number, by application, kept in
// this browser. A certificate seen on another application — in any batch — is a
// re-use.
const REUSE_KEY = 'aof_doc_fingerprints';
type Seen = Record<string, string[]>;
const readSeen = (): Seen => { try { return JSON.parse(localStorage.getItem(REUSE_KEY) || '{}'); } catch { return {}; } };

export function rememberFingerprint(key: string | undefined, appId: string): void {
  if (!key) return;
  const s = readSeen();
  s[key] = [...new Set([...(s[key] ?? []), appId])];
  try { localStorage.setItem(REUSE_KEY, JSON.stringify(s)); } catch { /* storage full */ }
}
function otherApps(key: string | undefined, appId: string): string[] {
  if (!key) return [];
  return (readSeen()[key] ?? []).filter((x) => x !== appId);
}

// ── Simulated issuing-authority lookups ──────────────────────────────────────
const ISSUER: Partial<Record<DocType, { authority: string; path: string }>> = {
  passport: { authority: 'Nigeria Immigration Service', path: '/api/v1/passport/verify' },
  'national-id': { authority: 'NIMC', path: '/api/v1/nin/verify' },
  'nin-slip': { authority: 'NIMC', path: '/api/v1/nin/verify' },
  'drivers-licence': { authority: 'FRSC', path: '/api/v1/drivers-licence/verify' },
  'voters-card': { authority: 'INEC', path: '/api/v1/vin/verify' },
  'cac-certificate': { authority: 'Corporate Affairs Commission', path: '/api/v1/company/search' },
};
const h32 = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

function issuerCall(type: DocType, c: OnboardingCase, f?: DocFacts): { call: IssuerCall; found: boolean; nameMatch: number } | 'no-number' | null {
  const iss = ISSUER[type];
  if (!iss) return null;
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ');
  const p = findIdentity({ firstName: c.firstName, lastName: c.lastName, bvn: c.bvn, nin: c.nin });
  const idFailed = c.verifications?.some((v) => v.kind === 'ID_DOC' && v.status === 'failed');
  const latencyMs = 300 + (h32(c.id + type) % 900);
  if (type === 'cac-certificate') {
    const rc = c.entity?.rcNumber ?? '';
    const found = Boolean(rc) && !(p && p.script.cac === 'fail') && !c.verifications?.some((v) => v.kind === 'CAC' && v.status === 'failed');
    return {
      found, nameMatch: 1,
      call: {
        authority: iss.authority, method: 'POST', path: iss.path, request: { rcNumber: rc }, http: 200, latencyMs,
        response: found
          ? { status: '00', rcNumber: rc, companyName: c.entity?.companyName ?? '', companyStatus: 'ACTIVE', registrationDate: '2016-03-11' }
          : { status: '01', message: 'No company found for the RC number supplied' },
      },
    };
  }
  // The number read off the document itself first; the application's otherwise.
  const number = f?.n ?? (type === 'nin-slip' || type === 'national-id' ? c.nin : type === idTypeOf(c) ? c.idNumber : undefined);
  // Nothing to look up is not the same as "the issuer has no record".
  if (!number) return 'no-number';
  const found = !(p && p.script.idDoc === 'fail') && !idFailed;
  const nameMatch = p?.script.recon?.some((r) => /name/i.test(r.field)) ? 0.78 : 1;
  return {
    found, nameMatch,
    call: {
      authority: iss.authority, method: 'POST', path: iss.path,
      request: { documentNumber: number ?? '', lastName: c.lastName ?? '', dateOfBirth: c.dob ?? '' },
      http: 200, latencyMs,
      response: found
        ? { status: '00', documentNumber: number, holderName: nameMatch < 1 ? `${c.firstName} ${(c.lastName ?? '').slice(0, -1)}` : name, documentStatus: 'VALID', expiryDate: c.idExpiry ?? '' }
        : { status: '01', message: 'No record found for the document number supplied' },
    },
  };
}

// ── The record's documents ───────────────────────────────────────────────────
const DAY = 86_400_000;

/** How old a bundle's utility bill is. Read off the bill when it was analysed;
 *  otherwise the deterministic stand-in the bulk intake has always used. */
export function billAgeDays(who: string, facts?: DocFacts, defect?: string): number {
  if (facts?.d) return Math.max(0, Math.round((Date.now() - new Date(facts.d).getTime()) / DAY));
  if (defect === 'expired-address') return 120;
  const n = h32(who);
  return n % 29 === 3 ? 104 : 8 + (n % 70);
}

function idTypeOf(c: OnboardingCase): DocType | null {
  const t = (c.idType ?? '').toLowerCase();
  if (/passport/.test(t)) return 'passport';
  if (/driver/.test(t)) return 'drivers-licence';
  if (/voter/.test(t)) return 'voters-card';
  if (/slip/.test(t)) return 'nin-slip';
  if (/national/.test(t)) return 'national-id';
  return c.nin || c.idNumber ? 'nin-slip' : null;
}

const CHECK_LABEL: Record<string, string> = {
  type: 'Document type', confidence: 'Extraction confidence', expiry: 'Expiry', mrz: 'Passport MRZ',
  tamper: 'File integrity', issuer: 'Issuing authority', age: 'Bill date', address: 'Address on the bill', reuse: 'Re-use',
};

function line(type: DocType, check: string, facts: Facts, detail: string, na?: string): CheckLine {
  if (na) return { check, label: CHECK_LABEL[check], outcome: 'n/a', detail: na };
  const v = judge(type, check, facts);
  if (v.undecided) return { check, label: CHECK_LABEL[check], outcome: 'n/a', detail: 'No rule could be decided with the facts available' };
  return {
    check, label: CHECK_LABEL[check], outcome: v.outcome,
    detail: v.outcome === 'Pass' ? detail : `${v.reason}. ${detail}`,
    rule: v.rule?.row, ref: v.rule?.ref,
  };
}

function judgeDoc(type: DocType, c: OnboardingCase, f: DocFacts | undefined, all?: OnboardingCase[]): DocResult {
  const lines: CheckLine[] = [];
  const fromFile = Boolean(f?.f);
  const isId = ID_TYPES.includes(type);

  // Type
  const conf = f?.c ?? 1;
  lines.push(line(type, 'type', { 'classification.confidence': conf },
    f?.b === 'content' ? `Identified from the document's content (${Math.round(conf * 100)}%)`
      : f?.b === 'name' && conf >= 0.9 ? `Identified from the bank's document-type file name (${Math.round(conf * 100)}%)`
      : f?.b === 'name' ? `Identified from the file name only (${Math.round(conf * 100)}%) — the content gave no signal`
      : 'Declared on the application'));

  // Extraction confidence — the form the fields were read from.
  if (type === 'aof') {
    const fc = Object.values(c.fieldConfidence ?? {});
    const lowest = fc.length ? Math.min(...fc) : c.extractionConfidence;
    lines.push(lowest === undefined
      ? line(type, 'confidence', {}, '', 'The fields were typed, not read from a document')
      : line(type, 'confidence', { 'field.confidence': lowest / 100 }, `Lowest field confidence ${Math.round(lowest)}%`));
  }

  // Expiry
  if (isId) {
    const exp = f?.x ?? (type === idTypeOf(c) ? c.idExpiry : undefined);
    if (!exp) lines.push(line(type, 'expiry', {}, '', 'No expiry date on the document or the application'));
    else {
      const days = Math.floor((new Date(exp).getTime() - Date.now()) / DAY);
      lines.push(line(type, 'expiry', { daysToExpiry: days }, days < 0 ? `Expired ${exp}` : `Valid until ${exp} (${days} days)`));
    }
  }

  // MRZ
  if (type === 'passport') {
    lines.push(f?.mrz === undefined
      ? line(type, 'mrz', {}, '', fromFile ? 'No machine-readable zone could be read from this file' : 'No passport image was analysed')
      : line(type, 'mrz', { 'mrz.valid': f.mrz }, f.mrz ? 'Document number, birth date, expiry and composite check digits all verify' : 'The machine-readable zone was read, but its check digits do not add up'));
  }

  // Tamper
  if (fromFile && f) {
    const facts: Facts = { 'file.editedWithEditor': Boolean(f.e), 'file.modifiedAfterCreated': Boolean(f.m) };
    lines.push(line(type, 'tamper', facts, f.p ? `Produced by ${f.p}` : 'No editing-tool signature; not re-saved'));
  } else {
    lines.push(line(type, 'tamper', {}, '', 'No file was analysed for this document — the details came from the application'));
  }

  // Issuer
  let issuer: IssuerCall | undefined;
  const ic = isId || type === 'cac-certificate' ? issuerCall(type, c, f) : null;
  if (ic === 'no-number') {
    lines.push(line(type, 'issuer', {}, '', 'No document number was read or captured, so the issuer could not be asked'));
  } else if (ic) {
    issuer = ic.call;
    lines.push(line(type, 'issuer', { 'issuer.found': ic.found, 'issuer.nameMatch': ic.nameMatch },
      ic.found ? `${ic.call.authority} holds a matching record` : `${ic.call.authority} returned no record`));
  } else if (type !== 'aof' && type !== 'selfie') {
    lines.push(line(type, 'issuer', {}, '', type === 'utility-bill' ? 'Utility companies offer no verification service' : 'No issuing authority to ask for this document'));
  }

  // Utility bill
  if (type === 'utility-bill') {
    const p = findIdentity({ firstName: c.firstName, lastName: c.lastName, bvn: c.bvn, nin: c.nin });
    const age = billAgeDays(`${c.firstName} ${c.lastName}`.trim(), f, p?.intakeDefect);
    lines.push(line(type, 'age', { ageDays: age }, f?.d ? `Dated ${f.d} — ${age} days ago` : `${age} days old`));
    lines.push(f?.am === undefined
      ? line(type, 'address', {}, '', 'No address could be read from the bill')
      : line(type, 'address', { 'address.match': f.am }, `${Math.round(f.am * 100)}% of the application's address appears on the bill`));
  }

  // Re-use — the certificate's fingerprint, and its RC number on any other record.
  if (type === 'cac-certificate') {
    const byFile = otherApps(f?.h, c.id);
    const rc = c.entity?.rcNumber;
    const byRc = rc && all ? all.filter((o) => o.id !== c.id && o.entity?.rcNumber === rc).map((o) => o.id) : [];
    const others = [...new Set([...byFile, ...byRc])];
    lines.push(line(type, 'reuse', { 'cert.seenElsewhere': others.length },
      others.length ? `Also submitted on ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more` : ''}` : 'Not seen on any other application'));
  }

  const outcome = lines.reduce<Outcome>((o, l) => (l.outcome === 'n/a' ? o : strictest(o, l.outcome)), 'Pass');
  return {
    type, label: DOC_TYPE_LABEL[type], file: f?.f, source: fromFile ? 'file' : 'application',
    lines, outcome, issuer, analysedAt: f?.at, producer: f?.p,
    from: typeof f?.pr === 'string' ? f.pr : undefined,
  };
}

/**
 * One result per document on the application. Analysed files come first; the
 * documents the application only describes (its ID type and number, a company's
 * RC number, a bundle's proof of address) are judged from the record.
 */
export function documentsFor(c: OnboardingCase, all?: OnboardingCase[]): DocResult[] {
  const stored = (c.documentFacts ?? []) as DocFacts[];
  const types = new Set<DocType>();
  const out: DocResult[] = [];
  for (const f of stored) {
    if (f.t === 'selfie') continue;
    out.push(judgeDoc(f.t, c, f, all));
    types.add(f.t);
  }
  const idt = idTypeOf(c);
  if (idt && !types.has(idt) && ![...types].some((t) => ID_TYPES.includes(t))) out.push(judgeDoc(idt, c, undefined, all));
  if (c.entity?.rcNumber && !types.has('cac-certificate')) out.push(judgeDoc('cac-certificate', c, undefined, all));
  if (c.channel === 'bulk' && c.bulkChannel === 'bundle' && !types.has('utility-bill')) out.push(judgeDoc('utility-bill', c, undefined, all));
  if ((c.fieldConfidence || c.documentName) && !types.has('aof')) out.push(judgeDoc('aof', c, c.documentName ? { t: 'aof', at: c.createdAt, b: 'form' } : undefined, all));
  return out;
}

/** The strictest outcome across the application's documents. */
export function documentsOutcome(docs: DocResult[]): Outcome {
  return docs.reduce<Outcome>((o, d) => strictest(o, d.outcome), 'Pass');
}
