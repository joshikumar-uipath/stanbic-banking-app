// ─────────────────────────────────────────────────────────────────────────────
// Bulk account opening — parse an uploaded row set and process it as a batch.
//
// Each row becomes a normal OnboardingCase (channel: 'bulk', a shared batchId),
// so bulk cases flow through the exact same store, Ops queues, Kafka stream and
// Finacle ledger as single captures. Most rows go straight through; a realistic
// fraction hit an exception — which then appears in Operations, at scale.
// ─────────────────────────────────────────────────────────────────────────────
import { store, mockCif, mockAccountNumber, type ValidationKind, type ValidationStatus } from '../onboarding';
import { getActiveCountry, kycLabel } from '../config/countries';

const CO = getActiveCountry();

export interface BulkRow {
  firstName: string; lastName: string; phone: string; email: string;
  bvn: string; nin: string; address: string;
}

/** Forgiving CSV parse: optional header, columns
 *  First name, Last name, Phone, Email, BVN, NIN, Address. */
export function parseCsv(text: string): BulkRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const looksLikeHeader = /\b(name|bvn|nin|phone|e-?mail)\b/i.test(lines[0]);
  const body = looksLikeHeader ? lines.slice(1) : lines;
  return body
    .map((line) => {
      const c = line.split(',').map((s) => s.trim());
      return { firstName: c[0] ?? '', lastName: c[1] ?? '', phone: c[2] ?? '', email: c[3] ?? '', bvn: c[4] ?? '', nin: c[5] ?? '', address: c[6] ?? '' };
    })
    .filter((r) => r.firstName || r.lastName);
}

const digits = (s: string) => s.replace(/\D/g, '');

async function setVals(id: string, patch: Partial<Record<ValidationKind, ValidationStatus>>) {
  const c = await store.get(id);
  if (!c) return;
  await store.update(id, {
    validations: c.validations.map((v) => (patch[v.kind] ? { ...v, status: patch[v.kind]!, attempts: v.attempts + 1, updatedAt: new Date().toISOString() } : v)),
  });
}

// Drive one row's lifecycle, offset by `base` ms so the batch processes as a wave.
function processRow(id: string, fail: boolean, base: number) {
  const at = (ms: number, fn: () => void) => window.setTimeout(fn, base + ms);
  at(700, () => { void store.advance(id, 'VALIDATION_IN_PROGRESS', `Validation started — ${kycLabel('NIN', CO)}, ${kycLabel('BVN', CO)} and screening running`); void setVals(id, { NIN: 'running', BVN: 'running' }); });
  if (fail) {
    at(2600, () => {
      void setVals(id, { NIN: 'passed', BVN: 'failed' });
      void store.advance(id, 'EXCEPTION', `${CO.primaryId.label} did not verify with ${CO.primaryId.authority} — routed to Operations`);
      void store.publish(id, 'exception-queue', 'Bulk row routed to Operations for review');
    });
  } else {
    at(2600, () => void setVals(id, { NIN: 'passed', BVN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed' }));
    at(3500, () => void store.advance(id, 'VALIDATED', 'All mandatory validations passed'));
    at(4400, () => { void store.update(id, { cif: mockCif(), accountNumber: mockAccountNumber() }); void store.advance(id, 'ACCOUNT_CREATED', 'Finacle CIF and account created'); });
    at(5400, () => void store.advance(id, 'PENDING_LIVENESS', 'Account open — liveness outstanding. KYC link sent by SMS.'));
  }
}

/**
 * Create a case per row and process the batch. Returns the batchId and the new
 * case ids. Deterministic failures (roughly 1 in 6) so the demo is repeatable and
 * the "N succeed, a few land in Operations" story always shows.
 */
export async function runBulk(rows: BulkRow[], employer: string, batchId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const c = await store.create({
      firstName: r.firstName.trim(), lastName: r.lastName.trim(),
      phone: digits(r.phone), email: r.email.trim(),
      bvn: digits(r.bvn), nin: digits(r.nin), address: r.address.trim(),
      employer: employer.trim() || undefined,
      channel: 'bulk', source: 'rm', batchId,
    });
    ids.push(c.id);
  }
  // Kick off processing as a staggered wave once all rows are captured.
  ids.forEach((id, i) => processRow(id, i % 6 === 5, 400 + i * 220));
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZIP + IXP path — a document bundle instead of a payroll CSV.
//
// A ZIP holds each applicant's documents (an ID, proof of address, a selfie).
// We read the archive's file list natively (the central directory stores names
// uncompressed — no library, no unzip), then a mock IXP step classifies each
// document, extracts the applicant's fields, and checks completeness. Complete
// applicants flow straight through like a payroll row; anyone missing a document
// lands in PENDING_DOCUMENTS with a KYC-link chase — the real Phase-5 behaviour.
// ─────────────────────────────────────────────────────────────────────────────
export type DocKind = 'id' | 'address' | 'selfie' | 'other';
export const DOC_LABEL: Record<DocKind, string> = { id: 'ID document', address: 'Proof of address', selfie: 'Selfie', other: 'Other' };
export interface ExtractedDoc { file: string; kind: DocKind; confidence: number }
export interface ExtractedApplicant extends BulkRow {
  docs: ExtractedDoc[];
  complete: boolean;
  missing: DocKind[];
}

/** File names out of a ZIP's central directory — no decompression, no deps.
 *  Standard (non-zip64) archives only, which is all a demo bundle will be. */
export function readZipEntries(buf: ArrayBuffer): string[] {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) return [];
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const names: string[] = [];
  for (let i = 0; i < count && off + 46 <= u8.length; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    names.push(dec.decode(u8.subarray(off + 46, off + 46 + nameLen)));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function classifyDoc(name: string): DocKind {
  const n = name.toLowerCase();
  if (/\b(id|passport|nin|bvn|national|card|licen[cs]e|iqama|emirates|ghana.?card|kra|ssn|dl)\b|passport|nationalid|idcard/.test(n)) return 'id';
  if (/address|utility|bill|statement|poa|residence|lease|tenancy|water|power|electric/.test(n)) return 'address';
  if (/selfie|photo|face|portrait|liveness|headshot/.test(n)) return 'selfie';
  return 'other';
}

const hashName = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Country-aware fields the IXP "reads off" the documents (deterministic per name). */
function fieldsFor(first: string, last: string): BulkRow {
  const n = hashName(first + last);
  return {
    firstName: first, lastName: last,
    phone: `${CO.phoneTrunk}${String(4000000 + (n % 900000)).slice(-7)}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@docs.example`,
    bvn: `${CO.primaryId.numPrefix}${String(5000000 + (n % 9000000)).slice(-7)}`,
    nin: `${CO.secondaryId.numPrefix}${String(6000000 + (n % 9000000)).slice(-7)}`,
    address: `${(n % 80) + 1} ${CO.streets[n % CO.streets.length]}, ${CO.cities[n % CO.cities.length]}`,
  };
}

/** Mock IXP: group a ZIP's files by applicant, classify each, check completeness. */
export function extractFromZip(entries: string[]): ExtractedApplicant[] {
  const groups = new Map<string, string[]>();
  for (const path of entries) {
    if (path.endsWith('/') || /__MACOSX|\.DS_Store|thumbs\.db/i.test(path)) continue;
    const parts = path.split('/').filter(Boolean);
    // Applicant = the containing folder, else the file name with doc-type words stripped.
    const key = parts.length >= 2
      ? parts[0]
      : parts[0].replace(/\.[^.]+$/, '').replace(/[-_ ]*(id|passport|nin|bvn|national|card|address|utility|bill|statement|poa|selfie|photo|face|portrait)s?\b/gi, '').replace(/[-_]+/g, ' ').trim();
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(parts[parts.length - 1]);
  }
  const out: ExtractedApplicant[] = [];
  for (const [key, files] of groups) {
    const words = key.replace(/[-_]+/g, ' ').trim().split(/\s+/).map(titleCase);
    const first = words[0] || 'Applicant';
    const last = words.slice(1).join(' ') || '';
    const docs: ExtractedDoc[] = files.map((f) => ({ file: f, kind: classifyDoc(f), confidence: 90 + (hashName(f) % 100) / 10 }));
    const kinds = new Set(docs.map((d) => d.kind));
    const missing = (['id', 'address'] as DocKind[]).filter((k) => !kinds.has(k));
    out.push({ ...fieldsFor(first, last), docs, complete: missing.length === 0, missing });
  }
  return out.sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/** A sample document bundle for the active market, so a demo needs no ZIP to hand. */
export function sampleZipApplicants(): ExtractedApplicant[] {
  return Array.from({ length: 9 }, (_, i) => {
    const first = CO.firstNames[(i * 5 + 2) % CO.firstNames.length];
    const last = CO.lastNames[(i * 3 + 1) % CO.lastNames.length];
    // Two applicants come in missing a document — the ones IXP flags.
    const miss: DocKind | null = i === 3 ? 'address' : i === 7 ? 'id' : null;
    const files: [string, DocKind][] = [
      ['national-id.jpg', 'id'], ['utility-bill.pdf', 'address'], ['selfie.jpg', 'selfie'],
    ].filter(([, k]) => k !== miss) as [string, DocKind][];
    const docs: ExtractedDoc[] = files.map(([file, kind]) => ({ file, kind, confidence: 91 + ((hashName(first + file)) % 90) / 10 }));
    const missing = miss ? [miss] : [];
    return { ...fieldsFor(first, last), docs, complete: missing.length === 0, missing };
  });
}

/** Create a case per extracted applicant. Complete bundles flow through validation
 *  like a payroll row; incomplete ones stop in PENDING_DOCUMENTS with a chase. */
export async function runZipBatch(applicants: ExtractedApplicant[], employer: string, batchId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const a of applicants) {
    const c = await store.create({
      firstName: a.firstName.trim(), lastName: a.lastName.trim(),
      phone: digits(a.phone), email: a.email.trim(),
      bvn: digits(a.bvn), nin: digits(a.nin), address: a.address.trim(),
      employer: employer.trim() || undefined,
      channel: 'bulk', source: 'rm', batchId,
    });
    ids.push(c.id);
  }
  applicants.forEach((a, i) => {
    const base = 400 + i * 220;
    void store.publish(ids[i], 'bulk-upload', `Documents extracted — ${a.docs.length} classified${a.complete ? '' : `, ${a.missing.map((k) => DOC_LABEL[k]).join(' + ')} missing`}`);
    if (!a.complete) {
      window.setTimeout(() => {
        void store.advance(ids[i], 'PENDING_DOCUMENTS', `Awaiting ${a.missing.map((k) => DOC_LABEL[k]).join(' + ')} — KYC link sent by SMS.`);
      }, base + 700);
    } else {
      processRow(ids[i], i % 6 === 5, base);
    }
  });
  return ids;
}

/** A realistic sample payroll for the active market, so a demo needs no file to hand. */
function buildSampleCsv(): string {
  const co = CO;
  const header = `First name,Last name,Phone,Email,${co.primaryId.label},${co.secondaryId.label},Address`;
  const lines = Array.from({ length: 12 }, (_, i) => {
    const f = co.firstNames[i % co.firstNames.length];
    const l = co.lastNames[(i * 7 + 3) % co.lastNames.length];
    const phone = `${co.phoneTrunk}${String(3000001 + i).slice(-7)}`;
    const email = `${f.toLowerCase()}.${l.toLowerCase()}@payroll.example`;
    const pid = `${co.primaryId.numPrefix}${String(1000001 + i).slice(-7)}`;
    const sid = `${co.secondaryId.numPrefix}${String(2000001 + i).slice(-7)}`;
    const addr = `${i + 1} ${co.streets[i % co.streets.length]}, ${co.cities[i % co.cities.length]}`;
    return `${f},${l},${phone},${email},${pid},${sid},${addr}`;
  });
  return [header, ...lines].join('\n');
}
export const SAMPLE_CSV = buildSampleCsv();
