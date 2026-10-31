// ─────────────────────────────────────────────────────────────────────────────
// Fixture types — the shapes the demo data speaks.
//
// Every fixture carries its own PROVENANCE. That is the whole point of this
// layer: when the client sends the real thing, you replace the fixture and flip
// one field, and the readiness report in `FIXTURES.md` stops saying "awaiting".
// Nothing else in the app has to know which it got.
// ─────────────────────────────────────────────────────────────────────────────

/** Where a fixture's content came from. */
export type Provenance =
  | 'demo'        // invented by us, stands in until the client sends theirs
  | 'client'      // supplied by Stanbic — real shape, real values
  | 'derived';    // shaped from a client document (e.g. the BRD) but values are ours

/** How a deterministic identity check came back. */
export type CheckOutcome =
  | 'pass'
  | 'fail'            // the authority returned no match, or a contradicting one
  | 'timeout'         // no answer inside the window — retryable
  | 'unavailable'     // the service is down past its retry window
  | 'not-applicable'; // e.g. CAC against a sole trader

/** How a screening check came back. Three states, not two — a POSSIBLE match
 *  goes to a different person than a confirmed one, and that distinction is
 *  most of §9.1. */
export type ScreenOutcome = 'clear' | 'possible' | 'confirmed';

/** The nine services the case plan reaches for. */
export type ServiceId =
  | 'bvn'           // NIBSS
  | 'nin'           // NIMC
  | 'cac'           // Corporate Affairs Commission registry
  | 'tin'           // FIRS
  | 'idDoc'         // identification document authenticity
  | 'liveness'      // selfie / liveness capture
  | 'screening'     // NICE Actimize — sanctions, watchlist, PEP, adverse media
  | 'coreBanking'   // account creation
  | 'omniflow'      // post-KYC case
  | 'dsx'           // evidence store
  | 'ixp';          // document extraction

/** One recorded request/response pair for a service, in the shape the real
 *  integration is expected to use. Replace `response` with the client's sample
 *  and the adapter keeps working. */
export interface PayloadSample {
  /** Which branch this sample represents. */
  variant: 'ok' | 'noMatch' | 'timeout' | 'unavailable' | 'possible' | 'confirmed';
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  /** HTTP status the real service is expected to return, where it is an API. */
  status?: number;
  /** Milliseconds before the response arrives, so retry behaviour is testable. */
  latencyMs?: number;
  provenance: Provenance;
  /** What we still need from the client to make this real. */
  awaiting?: string;
}

export interface ServiceFixture {
  id: ServiceId;
  /** How the bank refers to it, for the readiness report and the UI. */
  label: string;
  /** The authority or vendor behind it. */
  authority: string;
  samples: PayloadSample[];
  provenance: Provenance;
  awaiting?: string;
}

/** A registered business, for the corporate and business-name paths. */
export interface BusinessDetails {
  name: string;
  rcNumber: string;
  tin: string;
  natureOfBusiness: string;
  dateOfRegistration: string;
  registeredAddress: string;
}

/** What every service is scripted to say about one person. This is what makes a
 *  demo run twice tell the same story — and what makes each persona a test for
 *  exactly one branch of the decision table. */
export interface IdentityScript {
  bvn: CheckOutcome;
  nin: CheckOutcome;
  tin?: CheckOutcome;
  cac?: CheckOutcome;
  idDoc: CheckOutcome;
  liveness?: CheckOutcome;
  sanctions: ScreenOutcome;
  watchlist: ScreenOutcome;
  pep: ScreenOutcome;
  adverseMedia: ScreenOutcome;
  /** Fields that disagree across sources, named source-by-source per §8.4. */
  recon?: { field: string; sources: { name: string; value: string }[] }[];
}

export type EntityType = 'Sole Trader' | 'Business Name' | 'Retail EVB';

/** Which of the three journeys a persona is valid for. Not every branch exists
 *  on every flow — a bulk submission has no selfie, so a liveness failure is
 *  unreachable there, and running such a persona through the bulk decision
 *  table would report a false mismatch. */
export type Flow = 'individual' | 'corporate' | 'bulk';

/** One person or business we can put through any of the three flows and know in
 *  advance where they should come out. */
export interface FixtureIdentity {
  /** The manifest reference. Also the fixture's key. */
  ref: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  bvn: string;
  nin: string;
  entityType: EntityType;
  productType: string;
  business?: BusinessDetails;
  /** The journeys this persona can be put through. `expect` describes the
   *  outcome on these flows only. */
  flows: Flow[];
  script: IdentityScript;
  /** What the decision table SHOULD produce for this persona. Doubles as the
   *  test oracle — `auditFixtures()` runs every persona through `decide()` and
   *  reports any that no longer land here. */
  expect: string;
  /** Why this persona exists — which branch it is holding open. */
  note: string;
  /** A deliberately broken document package. These personas never reach the
   *  decision table — they are bounced at intake with a reason, which is the
   *  §8.1 completeness check. Declared rather than derived from a hash so the
   *  rejection is reproducible and the tester knows which folder to look at. */
  intakeDefect?: 'no-id' | 'no-address' | 'expired-address' | 'duplicate';
  provenance: Provenance;
}

/** A document that ships inside the sample package, including the ones that are
 *  deliberately wrong. */
export interface FixtureDocument {
  /** Path inside the ZIP, following the naming convention. */
  path: string;
  kind: 'aof' | 'id' | 'address' | 'signature' | 'cac' | 'memart' | 'resolution' | 'tin' | 'selfie';
  /** Which persona it belongs to. */
  ref: string;
  /** Deliberately broken, and why — these drive the intake rejection tests. */
  defect?: string;
  provenance: Provenance;
}
