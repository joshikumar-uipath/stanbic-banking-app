// ─────────────────────────────────────────────────────────────────────────────
// Account-opening PACKAGES — many files for one application, read in the browser.
//
// A bank account-opening file is not one form: it is the AOF plus a mandate card,
// CAC papers, references, the bank's own address visit, BVN/NIMC lookups and a
// checklist — nine to fifteen files, mostly image-only scans and TIFFs. This
// module takes the whole set and, for each file:
//
//   1. classifies it — by the bank's document-type naming convention ("AOF",
//      "MANDATE CARD", "BVN VALIDATION(PhotoFromIDCARD…)", "CAC CERTIFICATE", …),
//      which is how the bank's document system exports them and the only reliable
//      signal on a scan with no text layer; then by content where there IS text
//      (the BVN/NIMC API printouts);
//   2. says who produced it — the customer, the bank, or a third party;
//   3. reads it — the API printouts are parsed from their text layer for real; a
//      file this POC has a checked, MASKED transcription of (matched by SHA-256)
//      supplies the handwritten form's fields (src/fixtures/packageReads.ts).
//
// The output is the same `ReviewField` rows a confirmed IXP read produces, so the
// wizards fill themselves exactly as they do after the single-form review. No
// IXP, and nothing here touches the single-form upload flow.
// ─────────────────────────────────────────────────────────────────────────────
import UTIF from 'utif';
import { readZip } from '../employee/bulk/zip';
import { analyseFile, type DocFacts } from './docChecks';
import { PACKAGE_READS } from '../fixtures/packageReads';
import { readKey } from '../fixtures/redactedCopies';

export type PackageDocType =
  | 'aof' | 'aof-signatory' | 'aof-page' | 'mandate' | 'board-resolution' | 'consent'
  | 'cac-certificate' | 'cac-status' | 'tin-certificate' | 'references' | 'legal-search' | 'dud-cheque'
  | 'tin-printout' | 'avr' | 'cdd'
  | 'bvn-portal' | 'bvn-api' | 'nin-api' | 'nin-lookup' | 'others-printout'
  | 'adverse-media' | 'sanctions' | 'watchlist' | 'checklist'
  | 'id-document' | 'utility-bill' | 'customer-letter' | 'unknown';

export type Producer = 'customer' | 'bank' | 'third-party';

// In reading order (see inReadingOrder): within each producer, the form first, then
// what supports it, then the checks made on it.
export const PACKAGE_TYPE: Record<PackageDocType, { label: string; producer: Producer; group: string }> = {
  aof: { label: 'Account opening form', producer: 'customer', group: 'Application' },
  'aof-signatory': { label: 'Account opening form — signatory page', producer: 'customer', group: 'Application' },
  mandate: { label: 'Mandate card (specimen signature)', producer: 'customer', group: 'Mandate & consent' },
  'board-resolution': { label: 'Board resolution', producer: 'customer', group: 'Mandate & consent' },
  consent: { label: 'Data-processing consent', producer: 'customer', group: 'Mandate & consent' },
  'id-document': { label: 'Identification document', producer: 'customer', group: 'Identity' },
  'utility-bill': { label: 'Utility bill', producer: 'customer', group: 'Identity' },
  'customer-letter': { label: 'Customer letter / instruction', producer: 'customer', group: 'Correspondence' },
  'cac-certificate': { label: 'CAC certificate', producer: 'third-party', group: 'Business registration' },
  'cac-status': { label: 'CAC status report', producer: 'third-party', group: 'Business registration' },
  'tin-certificate': { label: 'TIN certificate', producer: 'third-party', group: 'Business registration' },
  references: { label: 'References', producer: 'third-party', group: 'Business registration' },
  'legal-search': { label: 'Legal search report', producer: 'third-party', group: 'Bank evidence' },
  'dud-cheque': { label: 'Dud cheque search (credit bureau)', producer: 'third-party', group: 'Bank evidence' },
  'aof-page': { label: 'Account opening form — amended / additional page', producer: 'bank', group: 'Application' },
  'tin-printout': { label: 'TIN validation', producer: 'bank', group: 'Business registration' },
  'bvn-portal': { label: 'BVN validation — portal screen', producer: 'bank', group: 'Identity' },
  'bvn-api': { label: 'BVN validation — API data', producer: 'bank', group: 'Identity' },
  'nin-api': { label: 'NIN validation — NIMC API data', producer: 'bank', group: 'Identity' },
  'nin-lookup': { label: 'ID card validation — NIMC lookup', producer: 'bank', group: 'Identity' },
  avr: { label: 'Address verification report (AVR)', producer: 'bank', group: 'Bank evidence' },
  'adverse-media': { label: 'Adverse media search', producer: 'bank', group: 'Bank evidence' },
  sanctions: { label: 'Sanctions screening', producer: 'bank', group: 'Bank evidence' },
  watchlist: { label: 'Internal watchlist search', producer: 'bank', group: 'Bank evidence' },
  cdd: { label: 'Customer due diligence (CDD / EDD)', producer: 'bank', group: 'Bank evidence' },
  'others-printout': { label: 'Others — accounts-by-mobile check', producer: 'bank', group: 'Bank evidence' },
  checklist: { label: 'Document checklist', producer: 'bank', group: 'Bank evidence' },
  unknown: { label: 'Unidentified document', producer: 'customer', group: 'Other' },
};

const PRODUCER_ORDER: Producer[] = ['customer', 'third-party', 'bank'];
const TYPE_ORDER = Object.keys(PACKAGE_TYPE) as PackageDocType[];
/**
 * The order a person reads a package in, whatever order the files came in: what the
 * customer brought (the form first), then third parties, then the bank's own checks —
 * each producer in PACKAGE_TYPE's order — and anything unidentified last.
 */
export function inReadingOrder(files: PackageFile[]): PackageFile[] {
  const rank = (f: PackageFile) => (f.type === 'unknown' ? 1e6 : PRODUCER_ORDER.indexOf(PACKAGE_TYPE[f.type].producer) * 100 + TYPE_ORDER.indexOf(f.type));
  return files.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map(({ f }) => f);
}

export const PRODUCER_LABEL: Record<Producer, string> = { customer: 'Customer', bank: 'Bank', 'third-party': 'Third party' };

/**
 * How legible a document's fields are, by how the document was produced — the
 * band the package analysis put each type in. Printouts with a text layer are
 * exact; typed pages read cleanly; handwriting, stamps and photocopies less so.
 */
const LEGIBILITY: Record<PackageDocType, number> = {
  'bvn-api': 99, 'nin-api': 99,
  'board-resolution': 95, references: 94, 'tin-printout': 93, 'bvn-portal': 95, 'nin-lookup': 94,
  'others-printout': 92, cdd: 93, consent: 90,
  'cac-certificate': 86, avr: 84, mandate: 84, 'aof-page': 85, aof: 88,
  'id-document': 88, 'utility-bill': 88, unknown: 70,
  'aof-signatory': 86, 'cac-status': 92, 'tin-certificate': 88, 'legal-search': 92, 'dud-cheque': 95,
  'adverse-media': 92, sanctions: 94, watchlist: 92, checklist: 82, 'customer-letter': 85,
};
const HANDWRITTEN = /signature|signed|annotation|officer|staff|authori[sz]ed|witness|description|landmark|remark|comment/i;
const h32 = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** An estimated confidence for one field of one document, stable across reads. */
export function fieldConfidence(type: PackageDocType, readBy: PackageFile['readBy'], name: string, value: string): number {
  if (readBy === 'text') return 99;
  let c = LEGIBILITY[type] + (h32(type + name) % 7) - 3;
  if (HANDWRITTEN.test(name)) c -= 9;
  if (value.length > 60) c -= 3;                 // long free text: more to misread
  return Math.max(55, Math.min(99, c));
}

/** One row of extracted data, in the shape a confirmed review produces. */
export interface Row { id: string; group: string; name: string; value: string; confidence: number; missing: boolean }

export interface PackageFile {
  name: string;
  bytes: Uint8Array;
  mime: string;
  type: PackageDocType;
  /** How the type was decided, and how sure. */
  by: 'name' | 'content' | 'none';
  confidence: number;
  pages: number;
  sha: string;
  /** Fields read off this file, with where they came from. */
  fields: { name: string; value: string }[];
  readBy: 'text' | 'transcription' | 'none';
  summary?: string;
  /** The document checks' facts for this file (tamper signals, dates…). */
  facts?: DocFacts;
}

export interface PackageResult {
  files: PackageFile[];
  /** The application's fields, merged across the package. */
  rows: Row[];
  kind: 'individual' | 'business' | 'unknown';
}

// ── Classification by the bank's naming convention ───────────────────────────
// The leading words of the file name ARE the document type; anything in brackets
// is the original upload name. "BVN VALIDATION(PhotoFromIDCARD.pdf).pdf" is the
// API printout; "BVN VALIDATION.PDF" is the portal screen.
const NAME_RULES: [RegExp, PackageDocType][] = [
  [/^amended[ _-]*aof/i, 'aof-page'],
  [/^aof\b|^account[ _-]*opening/i, 'aof'],
  [/^mandate/i, 'mandate'],
  [/^board[ _-]*resolution/i, 'board-resolution'],
  [/^consent/i, 'consent'],
  [/^cac\b.*status/i, 'cac-status'],
  [/^cac\b|^certificate[ _-]*of[ _-]*(incorporation|registration)/i, 'cac-certificate'],
  [/^references?\b/i, 'references'],
  [/^tin[ _-]*certificate/i, 'tin-certificate'],
  [/^tin\b/i, 'tin-printout'],
  [/^avr\b|^address[ _-]*verification/i, 'avr'],
  [/^(edd|cdd)\b|due[ _-]*diligence/i, 'cdd'],
  [/^bvn[ _-]*validation.*photofrom/i, 'bvn-api'],
  [/^bvn/i, 'bvn-portal'],
  [/^nin[ _-]*validation/i, 'nin-api'],
  [/^id[ _-]*card[ _-]*validation/i, 'nin-lookup'],
  [/^others?\b/i, 'others-printout'],
  [/passport|driver|voter|national[ _-]*id/i, 'id-document'],
  [/utility|electric|water[ _-]*bill/i, 'utility-bill'],
];

// Files that were named by a person rather than exported: the document type is somewhere
// in the name, often after a number they sorted by ("06 NIN slip (p47).pdf"). Tried only
// when the export convention does not match, and never on the bracketed part, which is
// another file's name.
const KEYWORD_RULES: [RegExp, PackageDocType][] = [
  [/signatory|director'?s?[ _-]*details/i, 'aof-signatory'],
  [/account[ _-]*opening|\ba[oe]p\b|\baof\b/i, 'aof'],
  [/mandate[ _-]*card/i, 'mandate'],
  [/board[ _-]*resolution/i, 'board-resolution'],
  [/status[ _-]*report/i, 'cac-status'],
  [/certificate[ _-]*of[ _-]*(incorporation|registration)|\bcac[ _-]*certificate/i, 'cac-certificate'],
  [/tin[ _-]*certificate|\bjtb\b/i, 'tin-certificate'],
  [/tin[ _-]*(verification|validation)/i, 'tin-printout'],
  [/legal[ _-]*search/i, 'legal-search'],
  [/reference/i, 'references'],
  [/address[ _-]*verification|\bavr\b/i, 'avr'],
  [/adverse[ _-]*media|google[ _-]*search/i, 'adverse-media'],
  [/dud[ _-]*cheque|credit[ _-]*bureau/i, 'dud-cheque'],
  [/sanction|eastnets/i, 'sanctions'],
  [/watch[ _-]*list/i, 'watchlist'],
  [/checklist/i, 'checklist'],
  [/\bbvn\b/i, 'bvn-portal'],
  [/\bnin[ _-]*(verification|lookup)|\bnimc\b/i, 'nin-lookup'],
  [/nin[ _-]*slip|passport|driver|voter|national[ _-]*id|id[ _-]*card/i, 'id-document'],
  [/utility|electric|water[ _-]*bill/i, 'utility-bill'],
  [/indemnity|request[ _-]*for|change[ _-]*of[ _-]*(e-?mail|address|name|signator)/i, 'customer-letter'],
];

function byName(name: string): PackageDocType | null {
  const base = (name.split('/').pop() ?? name).replace(/^\s*\d{1,3}(\s*[.)]\s*|[\s_-]+)/, '');
  for (const [re, t] of NAME_RULES) if (re.test(base)) return t;
  const own = base.replace(/\([^)]*\)/g, ' ');
  for (const [re, t] of KEYWORD_RULES) if (re.test(own)) return t;
  return null;
}

// ── Reading files ────────────────────────────────────────────────────────────
const latin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return s; };

async function sha256(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', b as BufferSource);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const isTiff = (b: Uint8Array) => (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a);
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

function mimeOf(name: string, b: Uint8Array): string {
  if (isPdf(b)) return 'application/pdf';
  if (isTiff(b)) return 'image/tiff';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  return /\.pdf$/i.test(name) ? 'application/pdf' : 'application/octet-stream';
}

async function pageCount(b: Uint8Array): Promise<number> {
  if (isPdf(b)) {
    // The page tree's /Count — read off the file, or out of its compressed object
    // streams (PDF 1.5+ writers, iText among them, keep the tree in there).
    // The root /Pages node holds the largest /Count (outline /Counts are smaller).
    const counts = (s: string) => [...s.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
    const raw = latin1(b);
    let found = counts(raw);
    if (!found.length) {
      const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
      // The stream's own dictionary, so the slice is exactly /Length bytes — the
      // browser's inflater rejects trailing bytes that zlib elsewhere tolerates.
      const re = /<<([^<>]*\/Type\s*\/ObjStm[^<>]*)>>\s*stream\r?\n/g;
      let m: RegExpExecArray | null;
      while (DS && !found.length && (m = re.exec(raw))) {
        const start = m.index + m[0].length;
        const len = Number(m[1].match(/\/Length\s+(\d+)/)?.[1] ?? 0);
        const end = len ? start + len : raw.indexOf('endstream', start);
        try {
          const st = new Blob([b.subarray(start, end) as BlobPart]).stream().pipeThrough(new DS('deflate'));
          found = counts(latin1(new Uint8Array(await new Response(st).arrayBuffer())));
        } catch { /* next stream */ }
      }
    }
    const pages = found.length ? Math.max(...found) : (raw.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    return Math.max(1, pages);
  }
  if (isTiff(b)) {
    try { return Math.max(1, UTIF.decode(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer).length); } catch { return 1; }
  }
  return 1;
}

/** Text the PDF draws — its (de-compressed) content streams' literal strings. */
async function pdfText(b: Uint8Array): Promise<string> {
  const raw = latin1(b);
  const parts: string[] = [];
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  // Each Flate stream, sliced to its dictionary's /Length — the browser's
  // inflater rejects the trailing bytes before `endstream`.
  const re = /<<([^<>]*\/FlateDecode[^<>]*)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null; let n = 0;
  while (DS && (m = re.exec(raw)) && n < 30) {
    const start = m.index + m[0].length;
    const len = Number(m[1].match(/\/Length\s+(\d+)/)?.[1] ?? 0);
    const end = len ? start + len : raw.indexOf('endstream', start);
    if (end < 0) break;
    try {
      const s = new Blob([b.subarray(start, end) as BlobPart]).stream().pipeThrough(new DS('deflate'));
      parts.push(latin1(new Uint8Array(await new Response(s).arrayBuffer())));
    } catch { /* not a text stream */ }
    n++;
  }
  const all = parts.join('\n');
  // Text-showing operators: (…) Tj and [(…) …] TJ, one line per operator.
  const lines: string[] = [];
  // `[^\]()]` keeps a "(" matchable one way only — otherwise binary runs backtrack exponentially.
  for (const x of all.matchAll(/\[((?:\([^)]*\)|[^\]()])*)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    const t = x[1] !== undefined ? [...x[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((y) => y[1]).join('') : x[2];
    if (t?.trim()) lines.push(t.replace(/\\([()\\])/g, '$1').trim());
  }
  return lines.join('\n');
}

/** "This data is recieved from BVN API." — the printouts are label/value pairs. */
function parsePrintout(text: string): { name: string; value: string }[] {
  const LABELS = ['BVN Number', 'National ID No', 'First Name', 'Last Name', 'Middle Name', 'Date of Birth',
    'Mobile', 'Gender', 'Marital Status', 'BVN Watchlisted', 'Nin Blacklisted'];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: { name: string; value: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lab = LABELS.find((l) => lines[i].toLowerCase() === l.toLowerCase() || lines[i].toLowerCase().startsWith(l.toLowerCase() + ' '));
    if (!lab) continue;
    const inline = lines[i].slice(lab.length).trim();
    const value = inline || (lines[i + 1] && !LABELS.some((l) => lines[i + 1].toLowerCase().startsWith(l.toLowerCase())) ? lines[i + 1] : '');
    if (value) out.push({ name: lab, value });
  }
  return out;
}

/** Printout fields → the application's rows. */
function rowsFromPrintout(fields: { name: string; value: string }[], source: 'bvn' | 'nin'): Row[] {
  const get = (n: string) => fields.find((f) => f.name === n)?.value ?? '';
  const dob = (() => {
    const v = get('Date of Birth');
    const m = v.match(/^(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})$/);
    if (!m) return v;
    const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mm = /\d/.test(m[2]) ? m[2].padStart(2, '0') : String(MON.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0');
    return `${m[1].padStart(2, '0')}/${mm}/${m[3]}`;
  })();
  const phone = get('Mobile').replace(/^234/, '0');
  const r = (group: string, name: string, value: string): Row | null =>
    value ? { id: `${source}-${group}-${name}`, group, name, value, confidence: 99, missing: false } : null;
  return [
    r('Personal Details', 'Surname', titleCase(get('Last Name'))),
    r('Personal Details', 'First Name', titleCase(get('First Name'))),
    r('Personal Details', 'Other Names', titleCase(get('Middle Name'))),
    r('Personal Details', 'Date of Birth', dob),
    r('Personal Details', 'Gender', titleCase(get('Gender'))),
    r('Personal Details', 'Marital Status', titleCase(get('Marital Status'))),
    r('Contact Details', 'Phone Number 1', phone),
    source === 'bvn' ? r('Identification', 'BVN', get('BVN Number')) : r('Identification', 'NIN', get('National ID No')),
  ].filter((x): x is Row => Boolean(x));
}
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Every file the user picked, with ZIPs opened and their folders flattened. */
async function expand(files: File[]): Promise<{ name: string; bytes: Uint8Array }[]> {
  const out: { name: string; bytes: Uint8Array }[] = [];
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (isZip(bytes)) {
      for (const e of await readZip(bytes.buffer as ArrayBuffer)) if (e.bytes && !e.name.startsWith('.')) out.push({ name: e.name, bytes: e.bytes });
    } else if (!f.name.startsWith('.')) out.push({ name: f.name, bytes });   // .DS_Store and friends are not documents
  }
  return out;
}

/** Read a whole package. `onProgress` reports each file as it is read. */
export async function readPackage(files: File[], onProgress?: (done: number, total: number, name: string) => void): Promise<PackageResult> {
  const items = await expand(files);
  const out: PackageFile[] = [];
  let i = 0;
  for (const it of items) {
    onProgress?.(i, items.length, it.name);
    const sha = await sha256(it.bytes);
    const known = PACKAGE_READS.files[readKey(sha)];
    let type = byName(it.name);
    let by: PackageFile['by'] = type ? 'name' : 'none';
    let fields: { name: string; value: string }[] = [];
    let readBy: PackageFile['readBy'] = 'none';
    let summary: string | undefined;

    const pdf = isPdf(it.bytes);
    const text = pdf ? await pdfText(it.bytes) : '';
    // Content beats a name when the content is unambiguous.
    if (/received from BVN API|recieved from BVN API/i.test(text)) { type = 'bvn-api'; by = 'content'; }
    else if (/received from NIMC API|recieved from NIMC API/i.test(text)) { type = 'nin-api'; by = 'content'; }
    if (known) {
      // A file this POC has a checked transcription of: its type and fields come
      // from there, and its text layer is NOT read — the transcription is masked,
      // and mixing real identifiers off a printout with masked ones off the form
      // would make every cross-check disagree.
      type = known.type;
      fields = known.fields; readBy = 'transcription';
      summary = known.summary;
    } else if ((type === 'bvn-api' || type === 'nin-api') && text) {
      fields = parsePrintout(text); readBy = fields.length ? 'text' : 'none';
    }
    const facts = await analyseFile(it.name, it.bytes).catch(() => undefined);
    out.push({
      name: it.name, bytes: it.bytes, mime: mimeOf(it.name, it.bytes),
      type: type ?? 'unknown', by, confidence: by === 'name' ? 0.97 : by === 'content' ? 0.99 : 0.3,
      pages: await pageCount(it.bytes), sha, fields, readBy, summary, facts,
    });
    i++;
  }
  onProgress?.(items.length, items.length, '');

  // The application's fields: the form's transcription first (it is the most
  // complete), then the BVN/NIMC data fills anything the form left blank.
  const rows: Row[] = [];
  const add = (r: Row) => { if (!rows.some((x) => x.group === r.group && x.name === r.name)) rows.push(r); };
  const pkgId = out.map((f) => PACKAGE_READS.files[readKey(f.sha)]?.package).find(Boolean);
  const pkg = pkgId ? PACKAGE_READS.packages[pkgId] : undefined;
  pkg?.formRows.forEach((r, n) => add({ id: `form-${n}`, group: r.group, name: r.name, value: r.value, confidence: r.confidence, missing: !r.value }));
  for (const f of out) {
    if (f.readBy !== 'text') continue;
    rowsFromPrintout(f.fields, f.type === 'bvn-api' ? 'bvn' : 'nin').forEach(add);
  }
  const kind = pkg?.kind ?? (out.some((f) => f.type === 'cac-certificate' || f.type === 'board-resolution') ? 'business' : out.some((f) => f.type === 'aof') ? 'individual' : 'unknown');
  return { files: out, rows, kind };
}

// ── Showing a file ───────────────────────────────────────────────────────────
/**
 * Something an <img>/<iframe> can show. PDFs and browser images pass through as
 * blob URLs; TIFFs (which Chrome and Edge cannot render) are decoded here, one
 * PNG per page. The caller revokes the URLs.
 */
// Decoded once per file for the session: decoding a TIFF to PNGs blocks the page
// for a noticeable moment, and a fresh blob URL makes a PDF viewer reload. The
// cache owns the URLs, so callers must NOT revoke them.
const viewCache = new Map<string, string[]>();

export function viewUrls(f: PackageFile): string[] {
  const key = f.sha + f.name;
  const hit = viewCache.get(key);
  if (hit) return hit;
  const urls = decodeView(f);
  viewCache.set(key, urls);
  return urls;
}

/** Decode every file's view ahead of time, one per idle slot, so opening a tab
 *  never waits on a decode. */
export function prefetchViews(files: PackageFile[]): () => void {
  let i = 0; let stopped = false;
  const idle = (cb: () => void) => ((window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 30)))(cb);
  const step = () => { if (stopped || i >= files.length) return; viewUrls(files[i++]); idle(step); };
  idle(step);
  return () => { stopped = true; };
}

function decodeView(f: PackageFile): string[] {
  if (f.mime === 'image/tiff') {
    try {
      const buf = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer;
      const ifds = UTIF.decode(buf);
      return ifds.map((ifd) => {
        UTIF.decodeImage(buf, ifd);
        const rgba = UTIF.toRGBA8(ifd);
        const c = document.createElement('canvas');
        c.width = ifd.width; c.height = ifd.height;
        const ctx = c.getContext('2d')!;
        const img = ctx.createImageData(ifd.width, ifd.height);
        img.data.set(rgba);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png');
      });
    } catch { return []; }
  }
  return [URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.mime }))];
}

/** The document-checks facts for each file, typed for the record. */
export function packageFacts(r: PackageResult): DocFacts[] {
  // Same names in both modules, bar the two the checks know by a more specific type.
  const MAP: Partial<Record<PackageDocType, DocFacts['t']>> = { 'id-document': 'national-id', 'cac-status': 'cac-form' };
  return r.files.map((f) => ({
    ...(f.facts ?? { at: new Date().toISOString() }),
    t: MAP[f.type] ?? (f.type as DocFacts['t']),
    f: f.name, c: f.confidence, b: f.by === 'none' ? 'name' : f.by,
    pr: PACKAGE_TYPE[f.type].producer,
    pg: f.pages,
  } as DocFacts));
}
