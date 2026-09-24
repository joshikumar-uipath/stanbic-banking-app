// ─────────────────────────────────────────────────────────────────────────────
// Next best action — what should this banker do about this case, right now?
//
// One place decides it for every lifecycle state, so the desk never shows a case
// without telling the RM what to do about it (or, just as important, that there
// is nothing to do and why). Each action carries a `why`: an RM asked to press a
// button deserves to know the reason, and it's what makes the recommendation
// auditable rather than magic.
//
// Actions write through the shared OnboardingStore, so anything done here shows
// up on the customer's own tracker and in the event log immediately.
// ─────────────────────────────────────────────────────────────────────────────
import { store, mockCif, mockAccountNumber, type OnboardingCase, type ValidationKind, type ValidationStatus } from '../onboarding';
import { getActiveCountry, kycLabel } from '../config/countries';

const CO = getActiveCountry();

export type NbaKind = 'do' | 'wait' | 'done';

export interface Nba {
  id: string;
  title: string;
  /** Why this is the right next step — shown under the title, never hidden. */
  why: string;
  kind: NbaKind;
  /** Rendered as the filled button. Exactly one per case. */
  primary?: boolean;
  /** Absent for 'wait'/'done' — there is deliberately nothing to press. */
  run?: () => Promise<string>;   // resolves with the toast to show
  /** Opens a screen or dialog instead of mutating (handled by the caller). */
  opens?: 'kyc' | 'channels' | 'call';
  /** A mailto: link rather than an action. Calls are not links — they open
   *  the call panel via `opens`, so the desk keeps the transcript. */
  href?: string;
  /** Another door to the *same* action — rendered beside the primary button, not
   *  under "if that doesn't work". Opening a task in Action Center is not a
   *  fallback; it is the same approval somewhere else. */
  alt?: { label: string; href: string };
}

const MANDATORY: ValidationKind[] = ['NIN', 'BVN', 'AML', 'PEP', 'FRAUD'];
const label = (k: ValidationKind) => (k === 'NIN' ? kycLabel('NIN', CO) : k === 'BVN' ? kycLabel('BVN', CO) : k === 'AML' ? 'AML screening' : k === 'PEP' ? 'PEP screening' : k === 'FRAUD' ? 'fraud screening' : 'selfie check');
const bureau = (k: ValidationKind) => (k === 'NIN' ? CO.secondaryId.authority : k === 'BVN' ? CO.primaryId.authority : 'the screening partner');

async function setVal(id: string, kind: ValidationKind, status: ValidationStatus, bumpAttempt = false) {
  const c = await store.get(id);
  if (!c) return;
  await store.update(id, {
    validations: c.validations.map((v) => (v.kind === kind
      ? { ...v, status, attempts: bumpAttempt ? v.attempts + 1 : v.attempts, updatedAt: new Date().toISOString() }
      : v)),
  });
}

/** Re-run one failed check. Success rolls the case forward exactly as the robot would. */
async function retry(c: OnboardingCase, kind: ValidationKind): Promise<string> {
  await setVal(c.id, kind, 'retrying', true);
  await store.publish(c.id, kind === 'BVN' ? 'bvn-validation' : kind === 'NIN' ? 'nin-validation' : 'exception-queue',
    `${label(kind)} retried manually by the RM`);

  window.setTimeout(() => { void setVal(c.id, kind, 'running'); }, 500);
  window.setTimeout(() => { void (async () => {
    await setVal(c.id, kind, 'passed');
    const fresh = await store.get(c.id);
    if (!fresh) return;
    const allPassed = MANDATORY.every((k) => fresh.validations.find((v) => v.kind === k)?.status === 'passed');
    if (!allPassed) return;
    await store.advance(fresh.id, 'VALIDATED', `${label(kind)} cleared on retry — all mandatory validations passed`);
    // Nothing else was blocking, so the account can be created as normal.
    window.setTimeout(() => { void (async () => {
      const c2 = await store.get(fresh.id);
      if (!c2 || c2.state !== 'VALIDATED') return;
      await store.update(c2.id, { cif: c2.cif ?? mockCif(), accountNumber: c2.accountNumber ?? mockAccountNumber() });
      await store.advance(c2.id, 'ACCOUNT_CREATED', 'Finacle CIF and account created');
      window.setTimeout(() => { void store.advance(c2.id, 'PENDING_LIVENESS', 'Account open — liveness outstanding. KYC link sent by SMS.'); }, 1600);
    })(); }, 1400);
  })(); }, 2200);

  return `Retrying ${label(kind)}…`;
}

/** The ranked list. First entry is what the RM should do; the rest are fallbacks. */
export function nextBestActions(c: OnboardingCase): Nba[] {
  const failed = c.validations.filter((v) => v.status === 'failed' || v.status === 'timeout');
  const out: Nba[] = [];

  // ── Exception: something needs a person ──
  if (c.state === 'EXCEPTION') {
    const f = failed[0];
    // The guide's retry framework (5/15/30/60) exists because these calls are
    // flaky. Past four attempts, stop pretending a retry will fix it.
    if (f && f.attempts < 4) {
      out.push({
        id: 'retry',
        title: `Retry the ${label(f.kind)}`,
        why: `${label(f.kind)} came back ${f.status === 'timeout' ? 'as a timeout' : 'failed'} on attempt ${f.attempts}. ${bureau(f.kind)} outages are the usual cause and clear on their own, which is why the retry schedule exists — try it before involving anyone.`,
        kind: 'do',
        primary: true,
        run: () => retry(c, f.kind),
      });
    }
    if (f) {
      out.push({
        id: 'call',
        title: `Call ${c.firstName || 'the customer'} to re-check their ${label(f.kind)}`,
        why: f.attempts >= 4
          ? `${f.attempts} attempts have failed. At this point the number itself is usually wrong, not the service.`
          : `If the retry fails too, a mistyped ${label(f.kind)} is the next most likely cause.`,
        kind: 'do',
        primary: f.attempts >= 4,
        opens: c.phone ? 'call' : undefined,
      });
    }
    out.push({
      id: 'ops',
      title: 'Hand to Operations',
      why: 'Ops can override with documentary evidence — you cannot. Send it only once a retry and a call have failed, or it will come straight back to you.',
      kind: 'do',
      run: async () => {
        await store.publish(c.id, 'exception-queue', 'Escalated to Operations by the RM for manual review');
        return 'Sent to Operations';
      },
    });
    return out;
  }

  // ── Account open, KYC outstanding ──
  if (c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS') {
    const isSelfie = c.state === 'PENDING_LIVENESS';
    const thing = isSelfie ? 'the selfie check is' : 'their documents are';
    out.push({
      id: 'resend',
      title: 'Re-send the KYC link',
      why: `The account is already open and working — only ${thing} outstanding, and that limits what they can do until it's done. They can finish it on their own phone; they don't need to come in.`,
      kind: 'do',
      primary: true,
      opens: 'channels',
    });
    if (isSelfie) {
      out.push({
        id: 'kyc-now',
        title: 'Do the selfie check here',
        why: 'Only worth it if the customer is still in front of you — otherwise the SMS link is faster for both of you.',
        kind: 'do',
        opens: 'kyc',
      });
    }
    return out;
  }

  // ── Nothing to do: say so, and say why ──
  if (c.state === 'PRE_REGISTERED' || c.state === 'VALIDATION_IN_PROGRESS') {
    const running = c.validations.filter((v) => v.status === 'running' || v.status === 'retrying').map((v) => v.kind);
    return [{
      id: 'wait',
      title: 'Nothing for you to do',
      why: running.length
        ? `${running.join(', ')} ${running.length === 1 ? 'is' : 'are'} running now. You'll only hear about it if a check needs a person — you can start the next customer.`
        : 'The checks are queued and will run on their own. The customer does not need to wait, and neither do you.',
      kind: 'wait',
    }];
  }

  if (c.state === 'VALIDATED') {
    return [{
      id: 'wait-finacle',
      title: 'Nothing for you to do',
      why: 'Every check passed. The account is queued for creation in Finacle and the number usually lands within a minute.',
      kind: 'wait',
    }];
  }

  if (c.state === 'ACCOUNT_CREATED') {
    out.push({
      id: 'give-number',
      title: `Give ${c.firstName || 'the customer'} their account number`,
      why: 'The account is live and can receive funds today. They can start using it before KYC is finished.',
      kind: 'do',
      primary: true,
      run: async () => {
        await navigator.clipboard?.writeText(c.accountNumber ?? '').catch(() => {});
        return 'Account number copied';
      },
    });
    out.push({
      id: 'kyc-now',
      title: 'Finish KYC while they are here',
      why: 'Doing it now lifts the limits on the account immediately, and saves chasing the SMS link later.',
      kind: 'do',
      opens: 'kyc',
    });
    return out;
  }

  // ── Branch stages ────────────────────────────────────────────────────────
  // These used to fall through to the "complete" card below, so a case sitting on
  // a compliance hold told the RM there was nothing to do. Each owns a person and
  // a next step; say who, and what.
  if (c.state === 'COMPLIANCE_HOLD') {
    const hit = c.validations.find((v) => (v.kind === 'PEP' || v.kind === 'AML') && v.status === 'failed');
    return [{
      id: 'compliance',
      title: 'With Compliance — screening hit to clear',
      why: `${hit ? `${label(hit.kind)} came back a hit` : 'A screening check came back a hit'}, so the case is with Compliance escalations. They clear or confirm it and the case returns to Verification. A screening hit cannot be overridden from the desk.`,
      kind: 'wait',
    }, {
      id: 'compliance-call',
      title: `Call ${c.firstName || 'the customer'} while it sits`,
      why: 'A hit is often a name collision. Anything the customer can tell you shortens the review.',
      opens: c.phone ? 'call' : undefined,
      kind: 'do',
    }];
  }

  if (c.state === 'EDD_REVIEW') {
    return [{
      id: 'edd',
      title: 'Enhanced due diligence in progress',
      why: 'The risk rating pushed this case into EDD. Source of funds and the customer profile are being established before a decision — it returns to Decision when that completes.',
      kind: 'wait',
    }];
  }

  if (c.state === 'PENDING_CUSTOMER') {
    return [{
      id: 'rfi-chase',
      title: `Chase ${c.firstName || 'the customer'} for what was requested`,
      why: 'The case is paused waiting on the customer and will sit there until someone asks. A call moves it; waiting does not.',
      opens: c.phone ? 'call' : undefined,
      kind: 'do',
      primary: true,
    }, {
      id: 'rfi-link',
      title: 'Re-send the KYC link',
      why: 'If what is outstanding is a document or a selfie, the link is the fastest route.',
      opens: 'channels',
      kind: 'do',
    }];
  }

  if (c.state === 'DECLINED') {
    return [{
      id: 'declined',
      title: 'Declined — nothing further',
      why: 'The application was declined or withdrawn and the reason is on the record. Reopening means a new application, not a change to this one.',
      kind: 'done',
    }];
  }

  if (c.state === 'AWAITING_EXTRACTION') {
    return [{
      id: 'await-extraction',
      title: 'Review what was read from the form',
      why: 'The uploaded form has been read and the case is holding at its review gate. Nothing else moves until someone confirms the values.',
      kind: 'do',
      primary: true,
    }];
  }

  // FULLY_ACTIVATED
  return [{
    id: 'done',
    title: 'Complete — nothing outstanding',
    why: 'Identity verified, account open, KYC done. Nothing on this case needs you.',
    kind: 'done',
  }];
}
