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

/** A realistic sample payroll for the active market, so a demo needs no file to hand. */
function buildSampleCsv(): string {
  const co = CO;
  const header = `First name,Last name,Phone,Email,${co.primaryId.label},${co.secondaryId.label},Address`;
  const lines = Array.from({ length: 12 }, (_, i) => {
    const f = co.firstNames[i % co.firstNames.length];
    const l = co.lastNames[(i * 7 + 3) % co.lastNames.length];
    const phone = `${co.phoneTrunk}${String(3000001 + i).slice(-7)}`;
    const email = `${f.toLowerCase()}.${l.toLowerCase()}@payroll.example`;
    const pid = `${co.primaryId.numPrefix}${String(10000001 + i).slice(-8)}`;
    const sid = `${co.secondaryId.numPrefix}${String(20000001 + i).slice(-8)}`;
    const addr = `${i + 1} ${co.streets[i % co.streets.length]}, ${co.cities[i % co.cities.length]}`;
    return `${f},${l},${phone},${email},${pid},${sid},${addr}`;
  });
  return [header, ...lines].join('\n');
}
export const SAMPLE_CSV = buildSampleCsv();
