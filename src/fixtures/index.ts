// ─────────────────────────────────────────────────────────────────────────────
// The fixture registry.
//
// One import for everything, plus the two things that keep this layer honest:
//
//   readiness()      — what is still demo data and what we are waiting for.
//                      This is what generates the table in FIXTURES.md, so the
//                      document can never drift from the code.
//
//   auditFixtures()  — re-runs every persona through the REAL decision logic
//                      and reports any whose outcome no longer matches what
//                      they claim to test. A persona that has silently stopped
//                      exercising its branch is worse than no persona at all.
// ─────────────────────────────────────────────────────────────────────────────
export * from './types';
export * from './identities';
export * from './payloads';
export * from './reference';

import { IDENTITIES } from './identities';
import { SERVICES } from './payloads';
import { REFERENCE_ITEMS } from './reference';
import type { Provenance } from './types';

export interface ReadinessRow {
  area: string;
  item: string;
  provenance: Provenance;
  awaiting: string | null;
  /** Which numbered item of the request email covers it. */
  emailRef: string | null;
}

const EMAIL_REF: Record<string, string> = {
  bvn: '5', nin: '5', cac: '5', tin: '5', idDoc: '5', liveness: '3, 5',
  screening: '5', coreBanking: '5, 7', omniflow: '5', dsx: '5', ixp: '3',
};

/**
 * What is real and what is standing in. Sorted so the blocking items surface
 * first: anything still `demo` with an `awaiting` note is a thing we have asked
 * for and not yet received.
 */
export function readiness(): ReadinessRow[] {
  const rows: ReadinessRow[] = [];

  for (const s of SERVICES) {
    rows.push({
      area: 'Integration', item: `${s.label} (${s.authority})`,
      provenance: s.provenance, awaiting: s.awaiting ?? null,
      emailRef: EMAIL_REF[s.id] ?? '5',
    });
  }

  for (const [key, ref] of Object.entries(REFERENCE_ITEMS)) {
    rows.push({
      area: 'Reference data', item: key.toLowerCase().replace(/_/g, ' '),
      provenance: ref.provenance, awaiting: ref.awaiting ?? null,
      emailRef: '6',
    });
  }

  const clientIdentities = IDENTITIES.filter((i) => i.provenance === 'client').length;
  rows.push({
    area: 'Test identities',
    item: `${IDENTITIES.length} personas, one per decision branch`,
    provenance: clientIdentities === IDENTITIES.length ? 'client' : 'demo',
    awaiting: clientIdentities === IDENTITIES.length
      ? null
      : `Safe test identities that resolve in the client's environment — ${IDENTITIES.length - clientIdentities} of ${IDENTITIES.length} are still invented.`,
    emailRef: '7',
  });

  // Unresolved first, then by area.
  return rows.sort((a, b) =>
    (a.awaiting ? 0 : 1) - (b.awaiting ? 0 : 1) || a.area.localeCompare(b.area));
}

/** A one-line summary for the UI banner. */
export function readinessSummary(): { total: number; awaiting: number; ready: number } {
  const rows = readiness();
  const awaiting = rows.filter((r) => r.awaiting).length;
  return { total: rows.length, awaiting, ready: rows.length - awaiting };
}

export interface AuditFinding { ref: string; expected: string; actual: string; note: string }

/**
 * Check every persona still tests the branch it claims.
 *
 * Takes `decide` as an argument rather than importing it, so the fixture layer
 * stays free of a dependency on the engine — the engine depends on fixtures,
 * not the other way round. Call it from a test or the console:
 *
 *   import { decide } from './employee/bulk/engine';
 *   auditFixtures((o) => decide(o).decision);
 */
export function auditFixtures(
  run: (o: {
    channel: 'manifest' | 'bundle';
    failedVerifications: string[];
    failedValidations: string[];
    recon: { field: string; sources: { name: string; value: string }[] }[];
    pepHit: boolean; sanctionsHit: boolean; watchlistHit: boolean; serviceDown: boolean;
  }) => string,
): AuditFinding[] {
  const out: AuditFinding[] = [];

  for (const p of IDENTITIES) {
    // `decide()` is the BULK decision table. A persona that only exists on the
    // individual journey — a liveness failure, say, which a bulk submission
    // cannot produce because it has no selfie — would report a false mismatch
    // here, so it is not run against it.
    if (!p.flows.includes('bulk')) continue;
    // A broken package is bounced by `validateIntake` before the decision table
    // is ever consulted, so there is no decision to compare against.
    if (p.intakeDefect) continue;
    const s = p.script;
    const failedVerifications: string[] = [];
    if (s.tin === 'fail') failedVerifications.push('TIN');
    if (s.cac === 'fail') failedVerifications.push('CAC');
    if (s.idDoc === 'fail') failedVerifications.push('ID_DOC');

    const failedValidations: string[] = [];
    if (s.bvn === 'fail') failedValidations.push('BVN');
    if (s.nin === 'fail') failedValidations.push('NIN');
    if (s.liveness === 'fail') failedValidations.push('LIVENESS');

    const serviceDown = [s.bvn, s.nin, s.tin, s.cac, s.idDoc, s.liveness]
      .some((o) => o === 'unavailable');

    // A persona is scripted against the channel its branch needs: the maker
    // review only exists on the bundle path.
    const channel = p.expect === 'maker-review' ? 'bundle' : 'manifest';

    const actual = run({
      channel,
      failedVerifications,
      failedValidations,
      recon: s.recon ?? [],
      pepHit: s.pep === 'possible',
      sanctionsHit: s.sanctions === 'possible' || s.sanctions === 'confirmed',
      watchlistHit: s.watchlist === 'confirmed',
      serviceDown,
    });

    if (actual !== p.expect) {
      out.push({
        ref: p.ref, expected: p.expect, actual,
        note: `${p.firstName} ${p.lastName} — ${p.note}`,
      });
    }
  }
  return out;
}
