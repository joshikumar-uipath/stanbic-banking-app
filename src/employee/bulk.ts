// ─────────────────────────────────────────────────────────────────────────────
// Bulk account opening — parse an uploaded row set and process it as a batch.
//
// Each row becomes a normal OnboardingCase (channel: 'bulk', a shared batchId),
// so bulk cases flow through the exact same store, Ops queues, Kafka stream and
// Finacle ledger as single captures. Most rows go straight through; a realistic
// fraction hit an exception — which then appears in Operations, at scale.
// ─────────────────────────────────────────────────────────────────────────────
import { store, mockCif, mockAccountNumber, type ValidationKind, type ValidationStatus } from '../onboarding';

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
  at(700, () => { void store.advance(id, 'VALIDATION_IN_PROGRESS', 'Validation started — NIN, BVN and screening running'); void setVals(id, { NIN: 'running', BVN: 'running' }); });
  if (fail) {
    at(2600, () => {
      void setVals(id, { NIN: 'passed', BVN: 'failed' });
      void store.advance(id, 'EXCEPTION', 'BVN did not verify with NIBSS — routed to Operations');
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

/** A realistic sample payroll so a demo needs no file to hand. */
export const SAMPLE_CSV = `First name,Last name,Phone,Email,BVN,NIN,Address
Ibrahim,Musa,08030001001,ibrahim.musa@ashaka.com,22200010001,10100010001,12 Ring Rd, Gombe
Amina,Sule,08030001002,amina.sule@ashaka.com,22200010002,10100010002,4 Biu Rd, Gombe
Emeka,Obi,08030001003,emeka.obi@ashaka.com,22200010003,10100010003,7 Ashaka Ave, Gombe
Ngozi,Umeh,08030001004,ngozi.umeh@ashaka.com,22200010004,10100010004,9 Cement Rd, Gombe
Yakubu,Bello,08030001005,yakubu.bello@ashaka.com,22200010005,10100010005,2 Plant Rd, Gombe
Funke,Ade,08030001006,funke.ade@ashaka.com,22200010006,10100010006,15 Staff Qtrs, Gombe
Sadiq,Idris,08030001007,sadiq.idris@ashaka.com,22200010007,10100010007,3 Kiln St, Gombe
Chioma,Nwankwo,08030001008,chioma.nwankwo@ashaka.com,22200010008,10100010008,6 Quarry Rd, Gombe
Tunde,Balogun,08030001009,tunde.balogun@ashaka.com,22200010009,10100010009,1 Loader Ave, Gombe
Halima,Yusuf,08030001010,halima.yusuf@ashaka.com,22200010010,10100010010,8 Depot Rd, Gombe
Peter,Okon,08030001011,peter.okon@ashaka.com,22200010011,10100010011,5 Mill Rd, Gombe
Grace,Effiong,08030001012,grace.effiong@ashaka.com,22200010012,10100010012,10 Silo St, Gombe`;
