// ─────────────────────────────────────────────────────────────────────────────
// Apply — the self-service opening wizard (Channel: 'self').
// About you → Identity (+ live duplicate check) → Address → Review → submit.
// Writes through the shared OnboardingStore; no waiting on downstream systems.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { store, type OnboardingCase, type DuplicateOutcome } from '../onboarding';
import { useConfig } from '../config';
import { getActiveCountry } from '../config/countries';
import { Button, Field, Note, Rail, KV, Brand } from './ui';
import Icon from './icons';

const CO = getActiveCountry();
const P = CO.primaryId, Sc = CO.secondaryId;   // primary=BVN slot, secondary=NIN slot

type Vals = { firstName: string; lastName: string; phone: string; email: string; bvn: string; nin: string; address: string };
const EMPTY: Vals = { firstName: '', lastName: '', phone: '', email: '', bvn: '', nin: '', address: '' };
const STEPS = ['About you', 'Identity', 'Address', 'Review'];

// What a UiPath Document Understanding extract of the uploaded account-opening
// form yields. A corporate AOF carries its directors; the account opens under the
// signing director, so we map the primary signatory into the individual capture.
// (Demo stand-in for a live DU/IXP call — swap onUpload's body for the real one.)
const EXTRACTED: Vals = {
  firstName: 'Efe', lastName: 'Emore',
  phone: '08027317889', email: 'eemore@gmail.com',
  bvn: '22143511463', nin: '',
  address: '62 Ire Akari Street, Isolo, Lagos',
};
const EXTRACTED_ORG = 'George Emore Technical Enterprises Ltd';
const EXTRACTED_COUNT = Object.values(EXTRACTED).filter(Boolean).length;

const digits = (s: string) => s.replace(/\D/g, '');

// NOTE: field validation is deliberately OFF for now — every step advances freely
// so the flow can be clicked straight through in a demo. Rules (required fields,
// 11-digit BVN/NIN, email format) get added back later. Duplicate detection still
// runs and reports, but never blocks.

/** 'self' = the customer opening their own account. 'rm' = a staff member
 *  capturing on someone's behalf — same wizard, staff-facing copy. */
export type ApplyMode = 'self' | 'rm';

export default function Apply({ onBack, onDone, mode = 'self', onKind }: { onBack: () => void; onDone: (c: OnboardingCase) => void; mode?: ApplyMode; onKind?: (k: 'individual' | 'corporate') => void }) {
  const appName = useConfig().branding.appName;
  const rm = mode === 'rm';
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Vals>(EMPTY);
  const [dup, setDup] = useState<DuplicateOutcome | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Scanned-form upload → Document Understanding → pre-fill.
  const [doc, setDoc] = useState<{ name: string; phase: 'reading' | 'done' } | null>(null);

  const set = (k: keyof Vals) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setV((p) => ({ ...p, [k]: ev.target.value }));
  };

  const onUpload = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';                 // let the same file be re-picked
    if (!f) return;
    setDoc({ name: f.name, phase: 'reading' });
    // Stand-in for a UiPath Document Understanding / IXP extract: read the scan
    // and return the fields. Swap this timeout for the real DU call when wired.
    window.setTimeout(() => {
      setV((p) => ({ ...p, ...EXTRACTED }));
      setDoc({ name: f.name, phase: 'done' });
    }, 1700);
  };

  const clearUpload = () => { setV(EMPTY); setDoc(null); };

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
            {onKind && rm && (
              <div className="cx-seg" role="tablist" aria-label="Account type">
                <button role="tab" aria-selected={true}>Individual</button>
                <button role="tab" aria-selected={false} onClick={() => onKind('corporate')}>Corporate</button>
              </div>
            )}
            <h1 className="cx-h1">{rm ? 'Customer details' : 'Let’s start with you'}</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>{rm ? `Enter their name exactly as it appears on their ${Sc.label}.` : `Use your name exactly as it appears on your ${Sc.label}.`}</p>

            {/* Upload a completed form → Document Understanding reads it and pre-fills. */}
            {!doc && (
              <label className="cx-drop">
                <input type="file" accept="application/pdf,image/*" onChange={onUpload} hidden />
                <span className="cx-drop-ic"><Icon name="upload" size={18} /></span>
                <span className="cx-drop-t">
                  <b>{rm ? 'Have a completed form? Upload it' : 'Have a completed form? Upload it'}</b>
                  <em>Scan or photo of the account opening form — we’ll read it and fill this in.</em>
                </span>
              </label>
            )}
            {doc?.phase === 'reading' && (
              <div className="cx-drop reading">
                <span className="cx-spin" aria-hidden />
                <span className="cx-drop-t"><b>Reading {doc.name}…</b><em>Document Understanding is extracting the fields.</em></span>
              </div>
            )}
            {doc?.phase === 'done' && (
              <Note tone="good" icon="checkCircle">
                <b>{EXTRACTED_COUNT} fields read from the form.</b> From {EXTRACTED_ORG} — signing director. Please check each one before you continue.
                <button type="button" className="cx-clearbtn" onClick={clearUpload}>Clear</button>
              </Note>
            )}

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
            <p className="cx-p" style={{ marginBottom: 18 }}>{rm ? `Verified with ${P.authority} and ${Sc.authority} in the background — the account opens without waiting.` : `We verify these with ${P.authority} and ${Sc.authority} in the background. You won’t wait for it.`}</p>
            <Field label={P.label} name="bvn" value={v.bvn} onChange={set('bvn')} inputMode="numeric" placeholder={`${P.numPrefix}12345678`} hint={rm ? `Verified with ${P.authority}.` : `Your ${P.label}, issued by ${P.authority}.`} />
            <Field label={Sc.label} name="nin" value={v.nin} onChange={set('nin')} inputMode="numeric" placeholder={`${Sc.numPrefix}23456789`} hint={rm ? `Verified with ${Sc.authority}.` : `Your ${Sc.label}, issued by ${Sc.authority}.`} />
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
            <Field label="Residential address" name="address" value={v.address} onChange={set('address')} placeholder={`7 ${CO.streets[0]}, ${CO.cities[0]}`} autoComplete="street-address" />
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
              <KV k={P.label} v={digits(v.bvn)} />
              <KV k={Sc.label} v={digits(v.nin)} />
              <KV k="Address" v={v.address} />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: '#0033A1' }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--soft)' }}>
                {rm
                  ? `The customer confirms these details are theirs and consents to ${appName} verifying them with ${P.authority}, ${Sc.authority} and screening partners.`
                  : `I confirm these details are mine and consent to ${appName} verifying them with ${P.authority}, ${Sc.authority} and screening partners.`}
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
