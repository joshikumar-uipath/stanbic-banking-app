// ─────────────────────────────────────────────────────────────────────────────
// Apply — the self-service opening wizard (Channel: 'self').
// About you → Identity (+ live duplicate check) → Address → Review → submit.
// Writes through the shared OnboardingStore; no waiting on downstream systems.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { store, type OnboardingCase, type DuplicateOutcome } from '../onboarding';
import { useConfig } from '../config';
import { Button, Field, Note, Rail, KV, Brand } from './ui';
import Icon from './icons';

type Vals = { firstName: string; lastName: string; phone: string; email: string; bvn: string; nin: string; address: string };
const EMPTY: Vals = { firstName: '', lastName: '', phone: '', email: '', bvn: '', nin: '', address: '' };
const STEPS = ['About you', 'Identity', 'Address', 'Review'];

const digits = (s: string) => s.replace(/\D/g, '');

// NOTE: field validation is deliberately OFF for now — every step advances freely
// so the flow can be clicked straight through in a demo. Rules (required fields,
// 11-digit BVN/NIN, email format) get added back later. Duplicate detection still
// runs and reports, but never blocks.

/** 'self' = the customer opening their own account. 'rm' = a staff member
 *  capturing on someone's behalf — same wizard, staff-facing copy. */
export type ApplyMode = 'self' | 'rm';

export default function Apply({ onBack, onDone, mode = 'self' }: { onBack: () => void; onDone: (c: OnboardingCase) => void; mode?: ApplyMode }) {
  const appName = useConfig().branding.appName;
  const rm = mode === 'rm';
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Vals>(EMPTY);
  const [dup, setDup] = useState<DuplicateOutcome | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Vals) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setV((p) => ({ ...p, [k]: ev.target.value }));
  };

  const next = async () => {
    if (step === 1 && (v.bvn || v.nin || v.phone)) {
      // Duplicate detection (Step 2 of the guide) — informational for now.
      setDup(await store.checkDuplicate({ bvn: digits(v.bvn), nin: digits(v.nin), phone: digits(v.phone) }));
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    setBusy(true);
    const c = await store.create({
      firstName: v.firstName.trim(), lastName: v.lastName.trim(),
      phone: digits(v.phone), email: v.email.trim(),
      bvn: digits(v.bvn), nin: digits(v.nin), address: v.address.trim(),
      // Staff-assisted openings are the bank's Phase 1; self-service is the customer's.
      channel: rm ? 'single' : 'self', source: rm ? 'rm' : 'customer',
    });
    onDone(c);
  };

  const back = () => (step === 0 ? onBack() : setStep((s) => s - 1));

  return (
    <>
      <div className="cx-head">
        <div className="cx-topline">
          <button className="cx-back" onClick={back} aria-label="Back"><Icon name="arrowLeft" /></button>
          <Brand sub={STEPS[step]} />
        </div>
        <Rail step={step} total={STEPS.length} />
      </div>

      <div className="cx-body">
        {step === 0 && (
          <>
            <h1 className="cx-h1">{rm ? 'Customer details' : 'Let’s start with you'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>{rm ? 'Enter their name exactly as it appears on their NIN.' : 'Use your name exactly as it appears on your NIN.'}</p>
            <div className="cx-row">
              <Field label="First name" name="firstName" value={v.firstName} onChange={set('firstName')} autoComplete="given-name" />
              <Field label="Last name" name="lastName" value={v.lastName} onChange={set('lastName')} autoComplete="family-name" />
            </div>
            <Field label="Phone number" name="phone" value={v.phone} onChange={set('phone')} inputMode="numeric" placeholder="0803 000 0000" autoComplete="tel" />
            <Field label="Email address" name="email" value={v.email} onChange={set('email')} inputMode="email" placeholder="you@example.com" autoComplete="email" />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="cx-h1">{rm ? 'Identity' : 'Your identity'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>{rm ? 'Verified with NIBSS and NIMC in the background — the account opens without waiting.' : 'We verify these with NIBSS and NIMC in the background. You won’t wait for it.'}</p>
            <Field label="BVN" name="bvn" value={v.bvn} onChange={set('bvn')} inputMode="numeric" placeholder="22212345678" hint={rm ? 'Bank Verification Number — 11 digits.' : 'Dial *565*0# on your registered line to get your BVN.'} />
            <Field label="NIN" name="nin" value={v.nin} onChange={set('nin')} inputMode="numeric" placeholder="10123456789" hint={rm ? 'National Identity Number — 11 digits.' : 'Your 11-digit National Identity Number.'} />
            {dup === 'existing' && (
              <Note tone="warn" icon="alert">
                <b>These details match an existing customer.</b> In production this stops here — we never open a duplicate account.
              </Note>
            )}
            {dup === 'potential-duplicate' && (
              <Note tone="info" icon="info">
                Some of these details look familiar. We&rsquo;ll continue, and someone will confirm before your account opens.
              </Note>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="cx-h1">{rm ? 'Address' : 'Where do you live?'}</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>{rm ? 'Proof of address can follow later — it won’t hold up the account.' : 'You can send proof of address later — it won’t hold up your account.'}</p>
            <Field label="Residential address" name="address" value={v.address} onChange={set('address')} placeholder="7 Sultan Rd, Sokoto" autoComplete="street-address" />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="cx-h1">{rm ? 'Check the details' : 'Check your details'}</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>{rm ? 'Confirm this matches the customer’s ID before you submit.' : 'Make sure this matches your ID.'}</p>
            <div className="cx-card">
              <KV k="Name" v={`${v.firstName} ${v.lastName}`} />
              <KV k="Phone" v={digits(v.phone)} />
              <KV k="Email" v={v.email} />
              <KV k="BVN" v={digits(v.bvn)} />
              <KV k="NIN" v={digits(v.nin)} />
              <KV k="Address" v={v.address} />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: '#0033A1' }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--soft)' }}>
                {rm
                  ? `The customer confirms these details are theirs and consents to ${appName} verifying them with NIBSS, NIMC and screening partners.`
                  : `I confirm these details are mine and consent to ${appName} verifying them with NIBSS, NIMC and screening partners.`}
              </span>
            </label>
          </>
        )}
      </div>

      <div className="cx-foot">
        {step < 3 ? (
          <Button onClick={next}>Continue<Icon name="arrowRight" size={17} /></Button>
        ) : (
          <Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
        )}
      </div>
    </>
  );
}
