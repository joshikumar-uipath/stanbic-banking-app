// ─────────────────────────────────────────────────────────────────────────────
// Bulk account opening — the process, as the BRD describes it.
//
// The old `bulk.ts` drove a batch with a chain of setTimeouts and decided who
// failed with `i % 6 === 5`. That was enough to show rows changing colour; it
// could not show the thing the BRD is actually about, which is WHY each
// application went where it went.
//
// This module replaces that decision-making. It keeps the same shape — rows are
// ordinary OnboardingCases on the shared store, so Ops, Kafka, the tower and the
// pipeline see them without changing — and adds the parts §8 and §9 require:
// intake completeness, the six business verifications, reconciliation across
// sources, the thirteen-row decision table, and the PND rules.
//
// Outcomes are DETERMINISTIC, seeded off the applicant's name, so a demo run
// twice tells the same story.
// ─────────────────────────────────────────────────────────────────────────────
import {
  store, mockCif, mockAccountNumber, VERIFICATION_KINDS,
  type BulkChannel, type BulkDecision, type ReconIssue, type Verification,
  type ValidationKind, type ValidationStatus, type OnboardingCase,
} from '../../onboarding';
import { maestroReady, startCase, linkInstance } from '../../onboarding/maestro';
import { getActiveCountry, kycLabel } from '../../config/countries';
import { extractFromZip, sampleZipApplicants, type ExtractedApplicant } from '../bulk';
import { readZip, type ZipEntry } from './zip';
import { saveBatch, type IntakeRejection } from './batches';
import { rememberDocs } from './docs';
import type { ViewerDoc } from './DocViewer';
import { findIdentity, type FixtureIdentity } from '../../fixtures';
import { analyseFile, billAgeDays, documentsFor, documentsOutcome, rememberFingerprint, type DocType } from '../../integrations/docChecks';
import { judge } from '../../integrations/docRules';

const CO = getActiveCountry();

/**
 * How many of a batch's rows get a REAL Maestro instance.
 *
 * The BRD sizes a submission at up to 200 customers, and starting 200 live
 * orchestrations against a shared demo tenant would take minutes and leave a
 * mess behind. So the front of the batch runs for real — enough that the stage
 * strip, the incident trail and the Action Center tasks are genuine — and the
 * tail is driven locally. The UI says which is which rather than implying all
 * of them are live.
 */
export const MAESTRO_CAP = 8;

const nowIso = () => new Date().toISOString();
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

// ── Intake completeness (BR-SUB-05) ──────────────────────────────────────────

/** One customer's documents as they arrived, before anything is trusted. */
export interface IntakeDoc {
  /** Folder or file name, shown back to the submitter verbatim. */
  source: string;
  customer: string;
  /** Document kinds found for this customer. */
  kinds: string[];
}

export interface IntakeResult {
  accepted: ExtractedApplicant[];
  rejections: IntakeRejection[];
}

/**
 * Check every customer in a bundle before the batch starts, and bounce the ones
 * that cannot be processed WITH A REASON. The BRD is explicit that an incomplete
 * submission is rejected rather than half-processed, and that the submitter is
 * told what to fix — a silent drop (which is what `parseCsv` did) leaves an RM
 * wondering why 52 documents became 47 applications.
 */
export function validateIntake(found: ExtractedApplicant[]): IntakeResult {
  const accepted: ExtractedApplicant[] = [];
  const rejections: IntakeRejection[] = [];
  const seenBvn = new Set<string>();

  for (const a of found) {
    const who = `${a.firstName} ${a.lastName}`.trim();
    const source = who ? `${who.toLowerCase().replace(/\s+/g, '-')}/` : 'unidentified';

    // No name at all, or files that arrived with no customer folder to attribute
    // them to — either way the splitter cannot tell whose AOP this is, and the
    // submitter needs to hear that rather than a downstream "missing document".
    if (!who || who === 'Applicant' || a.unattributed) {
      rejections.push({ source, customer: '', fixable: true,
        reason: 'No unique reference on the document — naming convention not followed' });
      continue;
    }
    // The AOP itself is the one document that cannot be missing.
    if (!a.docs.some((d) => d.kind === 'id')) {
      rejections.push({ source, customer: who, fixable: true,
        reason: 'No identification document in the folder' });
      continue;
    }
    // Proof of address is required and has a currency window (BR-DOC-06).
    if (!a.docs.some((d) => d.kind === 'address')) {
      rejections.push({ source, customer: who, fixable: true,
        reason: 'No proof of address in the folder' });
      continue;
    }
    // A stale utility bill is a rejection, not an exception — it is the
    // submitter's to fix and nobody in the bank can resolve it for them. Its age
    // is read off the bill when the file had a date on it; the window is the
    // Document rules DMN's (BR-DOC-06), so changing it there changes this.
    const fx = findIdentity({ firstName: a.firstName, lastName: a.lastName, bvn: a.bvn, nin: a.nin });
    const bill = a.docs.find((d) => d.kind === 'address');
    const age = billAgeDays(who, bill?.facts, fx?.intakeDefect);
    const billVerdict = judge('utility-bill', 'age', { ageDays: age });
    if (billVerdict.outcome === 'Fail') {
      rejections.push({ source, customer: who, fixable: true,
        reason: `${billVerdict.reason} (${age} days old)` });
      continue;
    }
    // Same person twice in one submission, or already opened.
    if (a.bvn && seenBvn.has(a.bvn)) {
      rejections.push({ source, customer: who, fixable: false,
        reason: `Duplicate — the same ${kycLabel('BVN', CO)} appears earlier in this submission` });
      continue;
    }
    if (a.bvn) seenBvn.add(a.bvn);
    accepted.push(a);
  }
  return { accepted, rejections };
}

/**
 * Read a ZIP into candidate customers AND keep the archive's entries.
 *
 * The grouping only needs names, but the intake screen has to be able to show
 * an officer the actual document — so the bytes travel with the result rather
 * than being re-read (and re-inflated) later from a File that may be gone.
 */
export async function readBundle(buf: ArrayBuffer): Promise<{ found: ExtractedApplicant[]; entries: ZipEntry[] }> {
  const entries = await readZip(buf);
  const found = extractFromZip(entries.map((e) => e.path));
  if (!found.length) return { found: sampleZipApplicants(), entries: [] };
  // Read each file's CONTENT (BR-DOC-01): the type is what the document says it
  // is, not what it was named; the same pass picks up tamper signals, MRZ and
  // dates for the document checks. A file whose content says nothing keeps the
  // name-based type, at a lower confidence the rules send to a person.
  for (const a of found) {
    for (const d of a.docs) {
      const e = entryFor(entries, a, d.file);
      if (!e?.bytes) continue;
      try {
        const f = await analyseFile(d.file, e.bytes, { hint: d.kind === 'address' ? 'utility-bill' : d.kind === 'selfie' ? 'selfie' : undefined, address: a.address });
        d.facts = f;
        if (f.b === 'content') { d.kind = kindOf(f.t, d.kind); d.confidence = Math.round((f.c ?? 0.6) * 1000) / 10; }
      } catch { /* the name-based reading stands */ }
    }
    const kinds = new Set(a.docs.map((d) => d.kind));
    a.missing = (['id', 'address'] as const).filter((k) => !kinds.has(k));
    a.complete = a.missing.length === 0;
  }
  return { found, entries };
}

/** A bundle document type → the bulk desk's coarser kind. */
function kindOf(t: DocType, fallback: ExtractedApplicant['docs'][number]['kind']) {
  if (['passport', 'national-id', 'nin-slip', 'drivers-licence', 'voters-card'].includes(t)) return 'id' as const;
  if (t === 'utility-bill') return 'address' as const;
  if (t === 'selfie') return 'selfie' as const;
  if (t === 'unknown') return fallback;
  return 'other' as const;
}

/** The archive entry for one customer's file — matched within their own folder,
 *  because a bundle routinely holds ten files called national-id.jpg. */
function entryFor(entries: ZipEntry[], a: ExtractedApplicant, file: string): ZipEntry | undefined {
  const folder = `${a.firstName} ${a.lastName}`.trim().toLowerCase().replace(/\s+/g, '-');
  return entries.find((e) => e.name === file
    && (e.path.toLowerCase().includes(folder) || e.path.toLowerCase().includes(a.firstName.toLowerCase())));
}

// ── Verification (§8.2) ──────────────────────────────────────────────────────

/**
 * What a fixture persona's script says about one verification kind, or
 * `undefined` when the script is silent and the caller should fall back.
 *
 * Kept next to `verificationsFor` rather than in the fixture module because it
 * is the translation between the two vocabularies — the fixtures speak in
 * service outcomes, the case speaks in verification statuses.
 */
function scriptedVerification(
  p: FixtureIdentity, kind: string,
): { status: ValidationStatus; attempts: number; detail?: string } | undefined {
  const s = p.script;
  const map: Record<string, typeof s.bvn | undefined> = {
    TIN: s.tin, CAC: s.cac, ID_DOC: s.idDoc,
    SANCTIONS: s.sanctions === 'clear' ? 'pass' : 'fail',
    WATCHLIST: s.watchlist === 'clear' ? 'pass' : 'fail',
    ADVERSE_MEDIA: s.adverseMedia === 'clear' ? 'pass' : 'fail',
  };
  const o = map[kind];
  if (!o) return undefined;
  switch (o) {
    case 'pass': return { status: 'passed', attempts: 1 };
    case 'fail': return { status: 'failed', attempts: 3, detail: 'No record returned' };
    case 'timeout': return { status: 'timeout', attempts: 3, detail: 'No response within the window' };
    case 'unavailable': return { status: 'timeout', attempts: 4, detail: 'Service unavailable past the retry window' };
    case 'not-applicable': return { status: 'passed', attempts: 0, detail: 'Not applicable' };
    default: return undefined;
  }
}

function verificationsFor(who: string, corporate: boolean, p?: FixtureIdentity): { list: Verification[]; failed: string[] } {
  const n = hash(who);
  const failed: string[] = [];
  const list = VERIFICATION_KINDS.map((kind, i) => {
    // CAC only applies to a registered business.
    if (kind === 'CAC' && !corporate) {
      return { kind, status: 'passed' as ValidationStatus, attempts: 0, detail: 'Not applicable — sole trader', updatedAt: nowIso() };
    }
    // A fixture persona's script wins. Anyone not in the fixture set — which is
    // every real customer once client data arrives — falls through to the
    // deterministic hash below, so the flow never depends on being recognised.
    const scripted = p ? scriptedVerification(p, kind) : undefined;
    if (scripted) {
      if (scripted.status === 'failed') failed.push(kind);
      return { kind, ...scripted, updatedAt: nowIso() };
    }
    const bad = (n >>> (i * 3)) % 23 === 1;
    if (bad) failed.push(kind);
    return {
      kind,
      status: (bad ? 'failed' : 'passed') as ValidationStatus,
      attempts: bad ? 3 : 1,
      detail: bad ? 'No record returned' : undefined,
      updatedAt: nowIso(),
    };
  });
  return { list, failed };
}

// ── Reconciliation (§8.4) ────────────────────────────────────────────────────

/**
 * Compare what the form said against what each authority returned. This is the
 * step that makes a review screen worth opening: without it, a reviewer is just
 * re-typing a form, and the BRD's four Musts here are the difference between
 * "the OCR read it" and "the bank believes it".
 */
function reconcile(a: ExtractedApplicant, corporate: boolean, p?: FixtureIdentity): ReconIssue[] {
  const who = `${a.firstName} ${a.lastName}`.trim();
  const n = hash(who);
  const out: ReconIssue[] = [];

  // A fixture persona states its mismatches outright, naming the source pair,
  // so the referral screen shows the real disagreement rather than a generated
  // one. An empty `recon` on a persona means "these sources agree" — which is
  // a claim, so it short-circuits rather than falling through.
  if (p) return p.script.recon ?? [];

  // Date of birth is the classic one — a transposed digit on a handwritten form.
  if (n % 11 === 4) {
    const yr = 1980 + (n % 15);
    out.push({
      field: 'Date of birth',
      sources: [
        { name: 'AOP', value: `14/03/${yr}` },
        { name: `${CO.secondaryId.authority} response`, value: `14/03/${yr - 5}` },
      ],
    });
  }
  // A middle name present on one source and not the other.
  if (n % 13 === 7) {
    out.push({
      field: 'Name',
      sources: [
        { name: 'AOP', value: who },
        { name: `${CO.primaryId.authority} response`, value: `${a.firstName} O. ${a.lastName}` },
      ],
    });
  }
  // The declared registration number not matching the registry.
  if (corporate && n % 19 === 2) {
    out.push({
      field: 'Registration number',
      sources: [
        { name: 'Declared', value: String(3100000 + (n % 900000)) },
        { name: 'CAC registry', value: String(3100000 + (n % 900000) + 1) },
      ],
    });
  }
  return out;
}

// ── Decisioning (§9.1) ───────────────────────────────────────────────────────

export interface Decided {
  decision: BulkDecision;
  reason: string;
}

/**
 * The thirteen-row table, in the order the BRD states it — the first condition
 * that matches wins, which is what makes the outcome reproducible and what
 * BR-DEC-02 means by "configurable without code changes": this function is the
 * one place a rule change lands.
 */
export function decide(opts: {
  channel: BulkChannel;
  failedVerifications: string[];
  failedValidations: ValidationKind[];
  recon: ReconIssue[];
  pepHit: boolean;
  sanctionsHit: boolean;
  watchlistHit: boolean;
  serviceDown: boolean;
}): Decided {
  const { channel, failedVerifications, failedValidations, recon } = opts;

  if (opts.watchlistHit) return { decision: 'terminate', reason: 'Internal watchlist match — application terminated' };
  if (opts.sanctionsHit) return { decision: 'refer-compliance', reason: 'Sanctions screening match — Compliance review required' };
  if (opts.serviceDown) return { decision: 'parked', reason: 'A verification service is persistently unavailable — parked for technical investigation' };

  const idFail = failedValidations.filter((k) => k === 'BVN' || k === 'NIN');
  if (idFail.length) {
    return { decision: 'auto-reject', reason: `${idFail.map((k) => kycLabel(k, CO)).join(' and ')} did not verify — returned to you with the reason` };
  }
  const regFail = failedVerifications.filter((k) => k === 'TIN' || k === 'CAC' || k === 'ID_DOC');
  if (regFail.length) {
    const said = regFail.map((k) => (k === 'TIN' ? 'Tax registration' : k === 'CAC' ? 'Business registration' : 'The identification document')).join(' and ');
    return { decision: 'auto-reject', reason: `${said} did not verify — returned to you with the reason` };
  }
  if (recon.length) {
    return { decision: 'refer-requester', reason: `${recon.map((r) => r.field).join(' and ')} did not reconcile across sources` };
  }
  if (opts.pepHit) {
    return { decision: 'refer-requester', reason: 'PEP screening returned a possible match — confirm or attach approval' };
  }
  // Everything passed. The channel decides whether a person still has to look.
  return channel === 'bundle'
    ? { decision: 'maker-review', reason: 'Data was read by OCR — a maker confirms it before the account is created' }
    : { decision: 'straight-through', reason: 'Captured in a structured form and fully verified — no review needed' };
}

// ── PND (§9.2) ───────────────────────────────────────────────────────────────

/** Business accounts open restricted; savings and salary open operative. The
 *  authorizer may still override, but only against a deferral reference. */
export function pndByProduct(product: string): boolean {
  const p = product.toLowerCase();
  if (p.includes('savings') || p.includes('salary')) return false;
  return true;
}

export const PRODUCT_FOR = (corporate: boolean, who: string): string =>
  corporate ? 'Current — Business' : hash(who) % 3 === 0 ? 'Salary — EVB' : 'Savings — Everyday';

// ── Running a batch ──────────────────────────────────────────────────────────

async function setVals(id: string, patch: Partial<Record<ValidationKind, ValidationStatus>>) {
  const c = await store.get(id);
  if (!c) return;
  await store.update(id, {
    validations: c.validations.map((v) => (patch[v.kind]
      ? { ...v, status: patch[v.kind]!, attempts: v.attempts + 1, updatedAt: nowIso() }
      : v)),
  });
}

export interface RunOptions {
  batchId: string;
  /** The archive's files, so each application keeps the documents it arrived
   *  with. Empty for a manifest batch and for the sample bundle. */
  entries?: ZipEntry[];
  name: string;
  channel: BulkChannel;
  segment: string;
  branch: string;
  corporate: boolean;
  /** Everything that arrived, including what intake will reject. */
  submitted: number;
  rejections: IntakeRejection[];
}

/**
 * Create a case per accepted applicant and drive it to its decision. The first
 * MAESTRO_CAP rows get a real orchestration; the rest are local. Returns the
 * new case ids in the order they were created.
 */
export async function runBatch(accepted: ExtractedApplicant[], o: RunOptions): Promise<string[]> {
  const ids: string[] = [];
  const live = maestroReady();

  for (let i = 0; i < accepted.length; i++) {
    const a = accepted[i];
    const who = `${a.firstName} ${a.lastName}`.trim();
    const corporate = o.corporate;

    // Is this one of our scripted personas? If so their script decides
    // everything below; if not — the normal case for real client data — the
    // deterministic hash does, exactly as before. Nothing breaks on a miss.
    const p = findIdentity({ firstName: a.firstName, lastName: a.lastName, bvn: a.bvn, nin: a.nin });

    const { list: verifications, failed: failedVerifications } = verificationsFor(who, corporate, p);
    const recon = reconcile(a, corporate, p);
    const n = hash(who);
    const pepHit = p ? p.script.pep !== 'clear' : n % 29 === 5;
    const sanctionsHit = p ? p.script.sanctions !== 'clear' : n % 61 === 11;
    const watchlistHit = p ? p.script.watchlist === 'confirmed' : n % 97 === 13;
    const serviceDown = p
      ? [p.script.bvn, p.script.nin, p.script.tin, p.script.cac, p.script.idDoc, p.script.liveness]
          .some((x) => x === 'unavailable')
      : n % 53 === 9;
    const failedValidations: ValidationKind[] = p
      ? ([
          p.script.bvn === 'fail' ? 'BVN' : null,
          p.script.nin === 'fail' ? 'NIN' : null,
          p.script.liveness === 'fail' ? 'LIVENESS' : null,
        ].filter(Boolean) as ValidationKind[])
      : n % 31 === 6 ? ['BVN'] : [];

    let { decision, reason } = decide({
      channel: o.channel, failedVerifications, failedValidations, recon,
      pepHit, sanctionsHit, watchlistHit, serviceDown,
    });
    // The document checks (BR-DOC-05/06/07/08), judged against the Document
    // rules DMN. A failed document is returned with the reason; one the rules
    // refer goes back to the requester. Neither overrides a harder outcome above.
    const documentFacts = a.docs.map((d) => d.facts).filter((f): f is NonNullable<typeof f> => Boolean(f));
    const docs = documentsFor({
      id: 'pending', firstName: a.firstName, lastName: a.lastName, bvn: a.bvn, nin: a.nin, address: a.address,
      channel: 'bulk', bulkChannel: o.channel, documentFacts, verifications,
    } as unknown as OnboardingCase);
    const docOutcome = documentsOutcome(docs);
    const docReason = docs.flatMap((d) => d.lines.filter((l) => l.outcome === docOutcome).map((l) => `${d.label}: ${l.detail.split('. ')[0]}`))[0];
    if (docOutcome === 'Fail' && (decision === 'maker-review' || decision === 'straight-through' || decision === 'refer-requester')) {
      decision = 'auto-reject'; reason = `${docReason ?? 'A document failed its checks'} — returned to you with the reason`;
    } else if (docOutcome === 'Refer' && (decision === 'maker-review' || decision === 'straight-through')) {
      decision = 'refer-requester'; reason = docReason ?? 'A document needs a person to look at it';
    }

    const product = p?.productType ?? PRODUCT_FOR(corporate, who);
    const confidence = o.channel === 'bundle' ? 62 + (n % 38) : 100;

    const c = await store.create({
      firstName: a.firstName.trim(), lastName: a.lastName.trim(),
      phone: a.phone, email: a.email, bvn: a.bvn, nin: a.nin, address: a.address,
      employer: o.name.trim() || undefined,
      channel: 'bulk', source: 'rm', batchId: o.batchId,
      accountType: product,
      bulkChannel: o.channel,
      reviewState: decision === 'maker-review' ? 'awaiting' : undefined,
      extractionConfidence: confidence,
      fieldConfidence: o.channel === 'bundle' ? fieldConfidence(who) : undefined,
      verifications, recon, decision, decisionReason: reason,
      documentFacts: documentFacts.length ? documentFacts : undefined,
      pnd: pndByProduct(product),
      state: 'VALIDATION_IN_PROGRESS',
    });
    ids.push(c.id);
    for (const f of documentFacts) if (f.t === 'cac-certificate') rememberFingerprint(f.h, c.id);

    // Tie this applicant's files to the case it just became, so the monitor and
    // the customer sheet can show the actual document rather than a description
    // of one. Matched within the customer's own folder: a bundle routinely holds
    // ten files called national-id.jpg.
    if (o.entries?.length) {
      const folder = `${a.firstName} ${a.lastName}`.trim().toLowerCase().replace(/\s+/g, '-');
      rememberDocs(c.id, a.docs.map<ViewerDoc>((d) => ({
        name: d.file, kind: d.kind, confidence: d.confidence,
        entry: o.entries!.find((e) => e.name === d.file
          && (e.path.toLowerCase().includes(folder) || e.path.toLowerCase().includes(a.firstName.toLowerCase()))),
      })));
    }

    // Real orchestration for the front of the batch.
    if (live && i < MAESTRO_CAP) {
      try {
        const inst = await startCase({
          applicantId: c.id, firstName: c.firstName, lastName: c.lastName,
          bvn: c.bvn, nin: c.nin, channel: 'bulk',
        });
        linkInstance(c.id, inst);
      } catch { /* the row still processes; it just is not live */ }
    }
  }

  saveBatch({
    id: o.batchId, name: o.name, channel: o.channel, segment: o.segment, branch: o.branch,
    createdAt: nowIso(), submitted: o.submitted, accepted: accepted.length,
    rejections: o.rejections,
  });

  // Settle each row into the state its decision implies, as a wave so the batch
  // reads as work being done rather than a table appearing fully formed.
  ids.forEach((id, i) => window.setTimeout(() => void settle(id), 500 + i * 180));
  return ids;
}

/** Per-field confidence for the review screen — the low ones are what it flags. */
function fieldConfidence(who: string): Record<string, number> {
  const n = hash(who);
  const pick = (i: number) => 58 + ((n >>> (i * 4)) % 42);
  return {
    firstName: 95 + (n % 5), lastName: 95 + ((n >>> 2) % 5),
    dob: pick(1), bvn: 96 + ((n >>> 3) % 4), nin: 95 + ((n >>> 5) % 5),
    address: pick(2), tin: pick(3),
  };
}

/** Move one row to where its decision says it belongs. */
async function settle(id: string): Promise<void> {
  const c = await store.get(id);
  if (!c) return;
  const d = c.decision;
  const why = c.decisionReason ?? '';

  await setVals(id, { NIN: 'passed', BVN: 'passed', AML: 'passed', PEP: 'passed', FRAUD: 'passed' });

  if (d === 'auto-reject') {
    await setVals(id, { BVN: 'failed' });
    await store.advance(id, 'DECLINED', why);
    await store.publish(id, 'exception-queue', why);
    return;
  }
  if (d === 'terminate') {
    await store.advance(id, 'DECLINED', why);
    await store.publish(id, 'exception-queue', why);
    return;
  }
  if (d === 'refer-compliance') {
    await store.advance(id, 'COMPLIANCE_HOLD', why);
    await store.publish(id, 'exception-queue', why);
    return;
  }
  if (d === 'refer-requester' || d === 'parked') {
    await store.advance(id, 'EXCEPTION', why);
    await store.publish(id, 'exception-queue', why);
    return;
  }
  if (d === 'maker-review') {
    await store.advance(id, 'VALIDATED', 'Verified — waiting on the extraction review');
    return;
  }
  // straight-through: the manifest channel opens without a person.
  await store.advance(id, 'VALIDATED', 'All verifications and reconciliations passed');
  // No `by`: nobody authorised this one, the rules did. A row that moved on in
  // the meantime (removed, routed elsewhere) simply is not opened.
  await openAccount(id).catch(() => undefined);
}

/**
 * Create the account. Idempotent: a row that already has one is left alone
 * (BR-PROV-04 — never a second account).
 *
 * `by` is the checker. When given, the four-eyes rule is enforced HERE, in the
 * write path, not only in the screen: the maker who confirmed the extraction
 * cannot open it. Straight-through rows (no maker) carry no `reviewedBy`, so any
 * checker may open them; the settle step opens them with no `by` at all.
 *
 * Throws when the case is unknown, when it is not awaiting authorisation (the
 * same test awaitingAuthorisation() applies), or on a four-eyes breach.
 */
export async function openAccount(id: string, by?: string): Promise<void> {
  const c = await store.get(id);
  if (!c) throw new Error(`Case ${id} not found — it may have been removed.`);
  if (c.accountNumber) return;                // BR-PROV-04 — never a second account
  if (!isAwaitingAuthorisation(c)) {
    throw new Error(`${id} is not awaiting authorisation (it is ${c.state.replace(/_/g, ' ').toLowerCase()}) — the account was not opened.`);
  }
  if (by && c.reviewedBy && c.reviewedBy === by) {
    throw new Error('Four-eyes rule: the maker cannot open the account they confirmed.');
  }
  // One write carries the account, the verifier and the state together, so no
  // subscriber (or the shared table) ever sees an account number on a record
  // that is still VALIDATED.
  await store.update(id, {
    cif: mockCif(), accountNumber: mockAccountNumber(), state: 'ACCOUNT_CREATED',
    ...(by ? { openedBy: by, openedAt: nowIso() } : {}),
  });
  // The two events advance() + the explicit publish produced before.
  await store.publish(id, 'account-created',
    c.pnd ? 'Account created on post-no-debit' : 'Account created and operative');
  await store.publish(id, 'account-created',
    by ? `Account opened for ${c.firstName} ${c.lastName} — authorised by ${by}` : `Account opened for ${c.firstName} ${c.lastName}`);
}

// ── The maker checkpoint (BR-DOC-10, BR-DOC-11, BR-DOC-12) ───────────────────

export async function approveExtraction(id: string, by: string, edits: OnboardingCase['edits'] = []): Promise<void> {
  await store.update(id, {
    reviewState: 'approved', reviewedBy: by, reviewedAt: nowIso(),
    edits: edits && edits.length ? edits : undefined,
  });
  const n = edits?.length ?? 0;
  await store.advance(id, 'VALIDATED',
    n ? `Extraction confirmed by ${by} — ${n} field${n === 1 ? '' : 's'} corrected` : `Extraction confirmed by ${by}`);
}

export async function flagExtraction(id: string, by: string, concern: string): Promise<void> {
  await store.update(id, {
    reviewState: 'flagged', reviewedBy: by, reviewedAt: nowIso(),
    decision: 'refer-requester', decisionReason: concern,
  });
  await store.advance(id, 'EXCEPTION', `Flagged at review by ${by} — ${concern}`);
  await store.publish(id, 'exception-queue', concern);
}

// ── Selectors the screens share ──────────────────────────────────────────────

export const awaitingReview = (cs: OnboardingCase[]) =>
  cs.filter((c) => c.reviewState === 'awaiting');

/** A row the rules opened without a maker: decided straight-through and never
 *  confirmed by anyone. The authorise screens label these "Straight-through —
 *  no maker review" so the checker knows there is no first pair of eyes. */
export const isStraightThrough = (c: OnboardingCase): boolean =>
  c.decision === 'straight-through' && !c.reviewedBy;

/** One row of awaitingAuthorisation(): maker-confirmed, or straight-through. */
export const isAwaitingAuthorisation = (c: OnboardingCase): boolean =>
  (c.reviewState === 'approved' || c.decision === 'straight-through') && !c.accountNumber
    && c.state !== 'DECLINED' && c.state !== 'EXCEPTION' && c.state !== 'COMPLIANCE_HOLD';

export const awaitingAuthorisation = (cs: OnboardingCase[]) => cs.filter(isAwaitingAuthorisation);

export const inException = (cs: OnboardingCase[]) =>
  cs.filter((c) => c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD');

export const opened = (cs: OnboardingCase[]) => cs.filter((c) => !!c.accountNumber);
