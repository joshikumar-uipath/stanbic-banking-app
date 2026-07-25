// ─────────────────────────────────────────────────────────────────────────────
// Account-opening flow — Apply → Received → Status.
// Mounts full-screen from the consumer app's centre tab (same escape hatch the
// TransferFlow uses), and drives the shared OnboardingStore.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { store, mockCif, mockAccountNumber, type OnboardingCase, type ValidationKind, type ValidationStatus } from '../onboarding';
import { getActiveCountry, kycLabel } from '../config/countries';
import Apply, { type ApplyMode } from './Apply';
import Status, { useCase } from './Status';
import Kyc from './Kyc';
import { rememberMyApp } from './mine';
import { Button, Note, Brand } from './ui';
import Icon from './icons';
import './customer.css';

const CO = getActiveCountry();

// ── Demo lifecycle simulator ────────────────────────────────────────────────
// Stands in for the validation robots + Finacle creation so the Progress-First
// story plays out in front of the applicant. Replaced by real events later.
async function setVals(id: string, patch: Partial<Record<ValidationKind, ValidationStatus>>) {
  const c = await store.get(id); if (!c) return;
  await store.update(id, {
    validations: c.validations.map((v) => (patch[v.kind] ? { ...v, status: patch[v.kind]!, attempts: v.attempts + 1, updatedAt: new Date().toISOString() } : v)),
  });
}
export function simulate(id: string) {
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  at(1200, () => { void store.advance(id, 'VALIDATION_IN_PROGRESS', `Validation started — ${kycLabel('NIN', CO)}, ${kycLabel('BVN', CO)} and screening running`); void setVals(id, { NIN: 'running', BVN: 'running' }); });
  at(3400, () => { void setVals(id, { BVN: 'passed', NIN: 'passed', AML: 'running', PEP: 'running', FRAUD: 'running' }); });
  at(5200, () => { void setVals(id, { AML: 'passed', PEP: 'passed', FRAUD: 'passed' }); void store.advance(id, 'VALIDATED', 'All mandatory validations passed'); });
  at(7000, () => { void store.update(id, { cif: mockCif(), accountNumber: mockAccountNumber() }); void store.advance(id, 'ACCOUNT_CREATED', 'Finacle CIF and account created'); });
  at(8600, () => { void store.advance(id, 'PENDING_LIVENESS', 'Account open — liveness outstanding. KYC link sent by SMS.'); });
  return () => timers.forEach(clearTimeout);
}

type Screen = 'apply' | 'received' | 'status' | 'kyc';

/** Full-screen account-opening journey, shared by both surfaces.
 *  mode 'self' → the customer's own app.  mode 'rm' → staff-assisted capture. */
export default function AccountOpeningFlow({ onExit, startCaseId, mode = 'self' }: { onExit: () => void; startCaseId?: string; mode?: ApplyMode }) {
  const [screen, setScreen] = useState<Screen>(startCaseId ? 'status' : 'apply');
  const [id, setId] = useState<string | null>(startCaseId ?? null);
  const c = useCase(id);

  return (
    <div className="cx">
      {screen === 'apply' && (
        <Apply mode={mode} onBack={onExit} onDone={(created: OnboardingCase) => {
          // Only the customer's own device keeps a "mine" list — staff see the branch pipeline.
          if (mode === 'self') rememberMyApp(created.id);
          setId(created.id); setScreen('received'); simulate(created.id);
        }} />
      )}
      {screen === 'received' && c && <Received c={c} mode={mode} onTrack={() => setScreen('status')} onKyc={() => setScreen('kyc')} />}
      {screen === 'status' && c && <Status c={c} onBack={onExit} onKyc={() => setScreen('kyc')} />}
      {screen === 'kyc' && c && <Kyc c={c} onExit={() => setScreen('status')} />}
    </div>
  );
}

// ── Application received — the Progress-First moment ──
export function Received({ c, onTrack, onKyc, mode = 'self' }: { c: OnboardingCase; onTrack: () => void; onKyc: () => void; mode?: ApplyMode }) {
  const rm = mode === 'rm';
  const who = c.firstName || 'the customer';
  return (
    <>
      <div className="cx-head plain"><div className="cx-topline"><Brand sub="Application received" /></div></div>
      <div className="cx-body" style={{ textAlign: 'center' }}>
        <div className="cx-tick"><Icon name="check" size={38} strokeWidth={2.6} /></div>
        <h1 className="cx-h1" style={{ textAlign: 'center' }}>Application received</h1>
        <p className="cx-p" style={{ marginBottom: 18 }}>
          {rm
            ? <>Submitted for {who}. Verification is running in the background — you can start the next customer, nothing is waiting on you.</>
            : <>That&rsquo;s everything we need from you for now{c.firstName ? `, ${c.firstName}` : ''}. We&rsquo;re verifying your identity in the background — you don&rsquo;t need to wait here.</>}
        </p>
        <div className="cx-label" style={{ marginBottom: 8 }}>{rm ? 'Application reference' : 'Your reference'}</div>
        <div className="cx-appid" style={{ marginBottom: 18 }}>{c.id}</div>
        <div style={{ textAlign: 'left' }}>
          <Note tone="good" icon="checkCircle">
            {rm
              ? <>We&rsquo;ll text {who} the moment the account number is ready, with a link to finish KYC. No need to keep them at the desk.</>
              : <>We&rsquo;ll text you the moment your account number is ready, with a link to finish your KYC.</>}
          </Note>
        </div>
      </div>
      <div className="cx-foot">
        <Button onClick={onTrack}>{rm ? 'Track this application' : 'Track my application'}<Icon name="arrowRight" size={17} /></Button>
        <Button variant="ghost" onClick={onKyc}>{rm ? 'Complete KYC with them now' : 'Finish KYC now'}</Button>
      </div>
    </>
  );
}
