// ─────────────────────────────────────────────────────────────────────────────
// Who is capturing, for the record's provenance.
//
// A record needs to say who opened it — Operations triages across the whole bank
// and "which RM captured this, at which branch" is the difference between chasing
// a person and chasing a queue. The desk knows its signed-in user, but the
// capture wizard is mounted from three places (desk list, open-account tab, and
// the customer's own app) and `useAuth` throws outside its provider, so threading
// the identity as a prop would mean touching every mount and would still leave
// the consumer app without one.
//
// A module-level value the shell sets instead. Deliberately NOT persisted: it
// describes the person at the keyboard right now, not the browser. Unset means
// self-service, which is the honest reading — nobody was at a desk.
// ─────────────────────────────────────────────────────────────────────────────

let operator: string | null = null;
let branch: string | null = null;

/** Called by the employee shell once the signed-in user is known. */
export function setOperator(name: string | null, atBranch?: string | null): void {
  operator = name?.trim() || null;
  if (atBranch !== undefined) branch = atBranch?.trim() || null;
}

/** The person capturing, or null on a self-service surface. */
export const getOperator = (): string | null => operator;

/** The branch they are capturing at, when the deployment knows one. */
export const getOperatorBranch = (): string | null => branch;
