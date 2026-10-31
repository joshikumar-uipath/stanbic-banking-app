// ─────────────────────────────────────────────────────────────────────────────
// Customer comms — derive the SMS/email a customer receives from their lifecycle.
//
// One source of truth for both the case-level view (the desk / Ops case detail,
// "what have we told this customer?") and the system-level Notification Service
// console (/comms). Purely derived from the case state, so it always reflects the
// live store without a second write path.
// ─────────────────────────────────────────────────────────────────────────────
import { fullName, type OnboardingCase } from './types';
import { activeBank } from '../config/bank';

export type MsgChannel = 'sms' | 'whatsapp' | 'email';
export type Delivery = 'delivered' | 'sent';

/** Display label + brand colour per channel — shared by every surface that shows
 *  comms, so the badge/avatar/logo colours never drift. */
export const CHANNEL_META: Record<MsgChannel, { label: string; color: string }> = {
  sms: { label: 'SMS', color: '#0091DA' },
  whatsapp: { label: 'WhatsApp', color: '#25D366' },
  email: { label: 'Email', color: 'var(--brand-primary, #0033A1)' },
};
export const MSG_CHANNELS: MsgChannel[] = ['sms', 'whatsapp', 'email'];
export interface Msg {
  id: string; caseId: string; name: string; to: string;
  channel: MsgChannel; body: string; at: string; delivery: Delivery; label: string;
}

const hasAccount = (c: OnboardingCase) => Boolean(c.accountNumber);
const pendingKyc = (c: OnboardingCase) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS';
const token = (c: OnboardingCase) => c.id.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();

/** Timestamp of the first stored event on a topic (optionally matching a phrase),
 *  so derived milestone messages sit on real lifecycle moments when we have them.
 *  Skips manual re-send events so a re-send never back-dates the original link. */
function evAt(c: OnboardingCase, topic: string, match?: string): string | undefined {
  const ev = c.timeline.find((e) =>
    e.topic === topic && !(e.payload as { resend?: boolean } | undefined)?.resend
    && (!match || e.message.toLowerCase().includes(match)));
  return ev?.at;
}

/** The customer-facing message thread for one case, in journey order. */
export function commsFor(c: OnboardingCase): Msg[] {
  const first = (c.firstName || '').trim() || 'there';
  const phone = c.phone || 'no number on file';
  const email = c.email || 'no email on file';
  const acct = c.accountNumber;
  const bank = activeBank();
  const link = `${bank.kycDomain}/${token(c)}`;
  const out: { order: number; channel: MsgChannel; to: string; at: string; label: string; body: string; delivery?: Delivery }[] = [];

  // 1 · Application received — always.
  out.push({
    order: 1, channel: 'sms', to: phone, at: evAt(c, 'account-opening-requested') ?? c.createdAt,
    label: 'Application received',
    body: `Hi ${first}, we've received your account opening request (ref ${c.id}). We'll text you as each step completes.`,
  });

  // 2 · Under review — an exception means the customer hears we're checking.
  if (c.state === 'EXCEPTION') {
    out.push({
      order: 2, channel: 'sms', to: phone, at: evAt(c, 'exception-queue') ?? c.updatedAt,
      label: 'Verification call', delivery: 'sent',
      body: `${first}, we need a quick moment to verify a detail on your application. Our team will call you shortly — no action needed from you.`,
    });
  }

  // 3 · Account opened — once a Finacle account exists.
  if (hasAccount(c)) {
    out.push({
      order: 3, channel: 'sms', to: phone, at: evAt(c, 'account-created') ?? c.updatedAt,
      label: 'Account opened',
      body: `Good news ${first}! Your ${bank.name} account ${acct} is now open. Complete a quick KYC check to unlock full access.`,
    });
    // 4 · KYC link — a rich link, so it goes by WhatsApp.
    out.push({
      order: 4, channel: 'whatsapp', to: phone, at: evAt(c, 'customer-notification', 'link') ?? evAt(c, 'account-created') ?? c.updatedAt,
      label: 'KYC link',
      body: `${first}, finish setting up your account with a 30-second selfie check: ${link}`,
    });
  }

  // 5 · Reminder — still waiting on KYC and the case has aged past ~an hour.
  if (pendingKyc(c) && Date.parse(c.updatedAt) - Date.parse(c.createdAt) > 60 * 60 * 1000) {
    out.push({
      order: 5, channel: 'whatsapp', to: phone, at: c.updatedAt, delivery: 'sent',
      label: 'Reminder',
      body: `Reminder: your ${bank.name} account is open but needs a quick selfie to finish. Tap to complete: ${link}`,
    });
  }

  // 6 · Welcome — fully activated, by email.
  if (c.state === 'FULLY_ACTIVATED') {
    out.push({
      order: 6, channel: 'email', to: email, at: c.updatedAt,
      label: 'Welcome',
      body: `Welcome to ${bank.name}, ${first}. Your account ${acct} is fully active and your debit card is on the way. Manage everything in the ${bank.name} app.`,
    });
  }

  // Order the milestones by their logical sequence, not raw timestamps: seeded
  // events are all published within the same second, so a timestamp sort scrambles
  // them.
  const name = fullName(c).trim() || 'Unnamed';
  const milestones = out
    .sort((a, b) => a.order - b.order)
    .map((m): Msg => ({
      id: `${c.id}-m${m.order}`, caseId: c.id, name,
      to: m.to, channel: m.channel, body: m.body, at: m.at,
      delivery: m.delivery ?? 'delivered', label: m.label,
    }));

  // Manual re-sends (from the desk's "Re-send the KYC link" dialog) are recorded
  // as customer-notification events tagged { resend, channel }. Surface each one
  // as its own message so a re-send shows up here, not only in the raw event log.
  const resends = c.timeline
    .filter((e): e is typeof e & { payload: { resend: true; channel: MsgChannel } } =>
      e.topic === 'customer-notification' && !!e.payload && (e.payload as { resend?: boolean }).resend === true)
    .slice()
    .reverse() // timeline is newest-first; re-read chronologically
    .map((e, i): Msg => ({
      id: `${c.id}-r${i}`, caseId: c.id, name,
      to: e.payload.channel === 'email' ? email : phone,
      channel: e.payload.channel, body: `KYC link re-sent — finish your 30-second selfie check: ${link}`,
      at: e.at, delivery: 'delivered', label: 'KYC link · re-sent',
    }));

  return [...milestones, ...resends];
}
