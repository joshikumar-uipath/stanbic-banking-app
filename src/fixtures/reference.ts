// ─────────────────────────────────────────────────────────────────────────────
// Reference data — the rules the process runs on.
//
// Unlike the payloads, most of this IS derived from the client's own BRD, so it
// is marked `derived` rather than `demo`: the shape and the substance are
// theirs, only the unresolved identifiers are ours. What still needs their
// confirmation is called out per item.
//
// The user groups at the bottom are the one genuinely BLOCKING item. Every
// escalation recipient in the Maestro case plan is currently an unresolved
// sentinel, so no task can be assigned and no SLA can notify anyone until
// these five are mapped to real groups.
// ─────────────────────────────────────────────────────────────────────────────
import type { Provenance } from './types';

interface Ref<T> {
  value: T;
  provenance: Provenance;
  /** Empty when the client has confirmed it. */
  awaiting?: string;
}

// ── §9.1 decision table ──────────────────────────────────────────────────────

export interface DecisionRow {
  /** Evaluation order. First match wins — the table is not a set of filters. */
  order: number;
  when: string;
  outcome: string;
  routesTo: string;
  brdRef: string;
}

/**
 * Thirteen rows, in evaluation order. This mirrors what `decide()` in
 * src/employee/bulk/engine.ts actually implements — the two are meant to be
 * read side by side, and `auditFixtures()` checks they have not drifted.
 */
export const DECISION_TABLE: Ref<DecisionRow[]> = {
  provenance: 'derived',
  awaiting: 'Confirmation that this is the final version and the evaluation order is right. A row in the wrong position changes who handles an application. Email item 6.',
  value: [
    { order: 1, when: 'Confirmed internal watchlist match', outcome: 'terminate', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 2, when: 'Confirmed sanctions match', outcome: 'terminate', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 3, when: 'Possible sanctions or watchlist match', outcome: 'refer-compliance', routesTo: 'Compliance review', brdRef: '§9.1' },
    { order: 4, when: 'A verification service is unavailable past its retry window', outcome: 'parked', routesTo: 'Service recovery', brdRef: '§8.8' },
    { order: 5, when: 'BVN does not verify', outcome: 'auto-reject', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 6, when: 'NIN does not verify', outcome: 'auto-reject', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 7, when: 'TIN does not verify (business)', outcome: 'auto-reject', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 8, when: 'CAC registration does not verify (business)', outcome: 'auto-reject', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 9, when: 'Identification document fails authenticity', outcome: 'auto-reject', routesTo: 'Declined or withdrawn', brdRef: '§9.1' },
    { order: 10, when: 'Sources do not reconcile', outcome: 'refer-requester', routesTo: 'Referred to requester', brdRef: '§8.4' },
    { order: 11, when: 'Possible PEP match', outcome: 'refer-requester', routesTo: 'Referred to requester', brdRef: '§9.1' },
    { order: 12, when: 'Everything passed, data read by OCR', outcome: 'maker-review', routesTo: 'Extraction review', brdRef: 'BR-DOC-10' },
    { order: 13, when: 'Everything passed, data captured in a structured form', outcome: 'straight-through', routesTo: 'Authorisation and opening', brdRef: '§9.1' },
  ],
};

// ── §9.2 post-no-debit ───────────────────────────────────────────────────────

export interface PndRule { product: string; pnd: boolean; reason: string }

export const PND_RULES: Ref<PndRule[]> = {
  provenance: 'derived',
  awaiting: 'Confirmation of the full product list and which open restricted. We currently apply: savings and salary unrestricted, everything else on PND. Email item 6.',
  value: [
    { product: 'Savings', pnd: false, reason: 'Retail savings opens operative' },
    { product: 'Salary', pnd: false, reason: 'Salary account opens operative' },
    { product: 'Current', pnd: true, reason: 'Opens restricted until the deferral is cleared' },
    { product: 'Business Current', pnd: true, reason: 'Business account — restricted pending deferral' },
    { product: 'Domiciliary', pnd: true, reason: 'Restricted pending documentation' },
  ],
};

// ── §9.3 exception aging ─────────────────────────────────────────────────────

export interface AgingBucket { label: string; hours: number; then: string }

export const AGING_BUCKETS: Ref<AgingBucket[]> = {
  provenance: 'derived',
  awaiting: 'Confirmation of the buckets and what happens at each boundary. Email item 6.',
  value: [
    { label: '24 hours', hours: 24, then: 'Highlighted in the handler\'s queue' },
    { label: '48 hours', hours: 48, then: 'Escalated to the queue owner' },
    { label: '5 days', hours: 120, then: 'Escalated to the function head; an unanswered customer invitation is treated as withdrawn' },
  ],
};

// ── SLAs, as built into the Maestro case plan ────────────────────────────────

export interface SlaRule { scope: string; title: string; duration: string; atRisk: string; onBreach: string }

export const SLAS: Ref<SlaRule[]> = {
  provenance: 'derived',
  awaiting: 'Confirmation of the target per queue. The case-level 6 days is ours — it is the five-day customer wait plus a working day behind it, and it needs sign-off. Email item 6.',
  value: [
    { scope: 'case', title: 'Bulk Case SLA', duration: '6 d', atRisk: 'Notify Operations Group at 75%', onBreach: 'Notify Operations Lead' },
    { scope: 'Pending customer', title: 'Pending Customer SLA', duration: '5 d', atRisk: 'Chase the customer and notify the RM at 75%', onBreach: 'Treat as withdrawn — hand to Declined or withdrawn' },
    { scope: 'Extraction review', title: 'Extraction Review SLA', duration: '4 h', atRisk: 'Notify Operations Group at 75%', onBreach: 'Notify Operations Lead' },
    { scope: 'Authorisation and opening', title: 'Authorisation SLA', duration: '4 h', atRisk: '—', onBreach: 'Notify Operations Lead' },
    { scope: 'Referred to requester', title: 'Referral SLA', duration: '1 d', atRisk: '—', onBreach: 'Notify Relationship Managers' },
    { scope: 'Compliance review', title: 'Compliance SLA', duration: '1 d', atRisk: '—', onBreach: 'Notify Chief Compliance Officer' },
  ],
};

// ── Retry framework ──────────────────────────────────────────────────────────

export const RETRY_WINDOWS: Ref<number[]> = {
  provenance: 'derived',
  awaiting: 'Confirmation that 5/15/30/60 minutes is right, and what happens after the fourth attempt. Email item 6.',
  value: [5, 15, 30, 60],
};

// ── Entity types and products ────────────────────────────────────────────────

export const ENTITY_TYPES: Ref<string[]> = {
  provenance: 'derived',
  awaiting: 'Confirmation of the entity types in scope and which products each may open. Email item 4.',
  value: ['Sole Trader', 'Business Name', 'Retail EVB'],
};

export const PRODUCTS: Ref<string[]> = {
  provenance: 'demo',
  awaiting: 'The real product list with core banking product codes for the test environment. Email items 4 and 7.',
  value: ['Savings', 'Salary', 'Current', 'Business Current', 'Domiciliary'],
};

// ── The blocking item: user groups ───────────────────────────────────────────

export interface UserGroup {
  /** The name the Maestro case plan expects. */
  id: string;
  /** What they do in the process. */
  role: string;
  /** The client's actual group or AD name, once they tell us. */
  mapsTo: string | null;
}

/**
 * BLOCKING. Every escalation recipient in the bulk case plan is currently an
 * unresolved sentinel (`<UNRESOLVED: group id for …>`). Nothing can be assigned
 * and no SLA can notify anyone until `mapsTo` is filled in for all five.
 */
export const USER_GROUPS: Ref<UserGroup[]> = {
  provenance: 'demo',
  awaiting: 'BLOCKING — the actual group names or AD equivalents for all five. Email item 6.',
  value: [
    { id: 'Operations Group', role: 'Owns the maker queues; receives at-risk alerts', mapsTo: null },
    { id: 'Operations Lead', role: 'One tier up; receives breach alerts', mapsTo: null },
    { id: 'Relationship Managers', role: 'Submit bulk submissions and take back referred exceptions', mapsTo: null },
    { id: 'Compliance Officers', role: 'Disposition sanctions and watchlist matches; no one else may', mapsTo: null },
    { id: 'Chief Compliance Officer', role: 'Receives compliance breach escalations', mapsTo: null },
  ],
};

// ── Deferral ─────────────────────────────────────────────────────────────────

export const DEFERRAL_FORMAT: Ref<string> = {
  provenance: 'demo',
  awaiting: 'The real deferral reference format and who may issue one. Email item 6.',
  value: 'DEF-YYYY-NNNNNN',
};

// ── Submission limits ────────────────────────────────────────────────────────

export const SUBMISSION_LIMITS: Ref<{ maxRows: number; maxZipMb: number }> = {
  provenance: 'derived',
  awaiting: 'Confirmation of the maximum submission size. The BRD says up to 200 customers; the ZIP ceiling is ours. Email items 1 and 2.',
  value: { maxRows: 200, maxZipMb: 250 },
};

/** Everything above, for the readiness report. */
export const REFERENCE_ITEMS = {
  DECISION_TABLE, PND_RULES, AGING_BUCKETS, SLAS, RETRY_WINDOWS,
  ENTITY_TYPES, PRODUCTS, USER_GROUPS, DEFERRAL_FORMAT, SUBMISSION_LIMITS,
} as const;
