// ─────────────────────────────────────────────────────────────────────────────
// Status — live tracking of an onboarding case. Subscribes to the shared store,
// so the Progress-First lifecycle plays out in front of the applicant.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { store, stateMeta, VALIDATION_KINDS, type OnboardingCase, type OnboardingState } from '../onboarding';
import { useConfig } from '../config';
import { getActiveCountry, kycLabel, kycLabelAuthority } from '../config/countries';
import { Button, Chip, Note, Brand } from './ui';
import Icon from './icons';

const CO = getActiveCountry();
const MAIN: { s: OnboardingState; label: string; desc: string }[] = [
  { s: 'PRE_REGISTERED', label: 'Application received', desc: 'We have your details' },
  { s: 'VALIDATION_IN_PROGRESS', label: 'Verifying your identity', desc: `${kycLabel('NIN', CO)}, ${kycLabel('BVN', CO)} and screening` },
  { s: 'VALIDATED', label: 'Identity verified', desc: 'All checks passed' },
  { s: 'ACCOUNT_CREATED', label: 'Account created', desc: 'Your account number is ready' },
  { s: 'FULLY_ACTIVATED', label: 'Fully activated', desc: 'Everything is complete' },
];
const reached = (s: OnboardingState) =>
  s === 'FULLY_ACTIVATED' ? 4 : ['ACCOUNT_CREATED', 'PENDING_DOCUMENTS', 'PENDING_LIVENESS'].includes(s) ? 3
  : s === 'VALIDATED' ? 2 : (s === 'VALIDATION_IN_PROGRESS' || s === 'EXCEPTION') ? 1 : 0;

const VC: Record<string, string> = { passed: '#16A34A', running: '#0091DA', pending: '#C7CDD4', failed: '#DC2626', timeout: '#DC2626', retrying: '#D97706' };

export function useCase(id: string | null): OnboardingCase | null {
  const [c, setC] = useState<OnboardingCase | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const refresh = () => { void store.get(id).then((x) => { if (alive) setC(x ?? null); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, [id]);
  return c;
}

export default function Status({ c, onBack, onKyc }: { c: OnboardingCase; onBack: () => void; onKyc: () => void }) {
  const appName = useConfig().branding.appName;
  const m = stateMeta(c.state);
  const at = reached(c.state);
  const isExc = c.state === 'EXCEPTION';
  const pending = c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS';

  return (
    <>
      <div className="cx-head">
        <div className="cx-topline">
          <button className="cx-back" onClick={onBack} aria-label="Back"><Icon name="arrowLeft" /></button>
          <Brand sub="Your application" />
        </div>
      </div>

      <div className="cx-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div>
            <div className="cx-label">Application</div>
            <div style={{ font: '600 16px/1 var(--f-body)', letterSpacing: '.04em', marginTop: 6 }}>{c.id}</div>
          </div>
          <Chip tone={m.tone === 'good' ? 'good' : m.tone === 'exception' ? 'crit' : m.tone === 'pending' ? 'warn' : 'info'}>{m.label}</Chip>
        </div>

        {c.accountNumber && (
          <div className="cx-card" style={{ background: 'linear-gradient(150deg, var(--blue), var(--navy))', border: 'none', color: '#fff', marginBottom: 12 }}>
            <div style={{ font: '600 10.5px/1 var(--f-body)', letterSpacing: '.12em', color: 'rgba(255,255,255,.8)' }}>YOUR ACCOUNT NUMBER</div>
            <div style={{ font: '600 26px/1 var(--f-head)', letterSpacing: '.04em', margin: '10px 0 6px' }}>{c.accountNumber}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{c.cif ? `CIF ${c.cif} · ` : ''}{appName}</div>
          </div>
        )}

        {pending && (
          <div style={{ marginBottom: 12 }}>
            <Note tone="warn" icon="clock">
              <b>Your account is open and working.</b> Finish {c.state === 'PENDING_LIVENESS' ? 'your selfie check' : 'your documents'} to lift the limits on it.
            </Note>
            <Button onClick={onKyc} style={{ marginTop: 10 }}>Finish setting up</Button>
          </div>
        )}
        {isExc && (
          <div style={{ marginBottom: 12 }}>
            <Note tone="warn" icon="alert"><b>We need a moment.</b> One of our checks needs a person to look at it. We&rsquo;ll be in touch — you don&rsquo;t need to do anything.</Note>
          </div>
        )}

        <div className="cx-card">
          <div className="cx-label" style={{ marginBottom: 14 }}>Progress</div>
          <div className="cx-steps">
            {MAIN.map((st, i) => {
              const cls = i < at ? 'done' : i === at ? (isExc ? 'exc' : 'cur') : '';
              return (
                <div className={`cx-st ${cls}`} key={st.s}>
                  <span className="dot">{i < at && <Icon name="check" size={10} strokeWidth={3} />}</span>
                  <span className="tx">
                    <b>{st.label}</b>
                    <span>{i === at && !isExc && i > 0 && i < 4 ? 'In progress…' : i === at && isExc ? 'Needs review' : st.desc}</span>
                  </span>
                  {i === at && !isExc && i < 4 && <span className="cx-spin" style={{ marginLeft: 'auto', marginTop: 3 }} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cx-card">
          <div className="cx-label" style={{ marginBottom: 10 }}>Checks</div>
          {VALIDATION_KINDS.map((k) => {
            const v = c.validations.find((x) => x.kind === k);
            const st = v?.status ?? 'pending';
            return (
              <div className="cx-check" key={k}>
                <span className="l">
                  <span className="ic" style={{ background: VC[st] }}>{st === 'passed' ? <Icon name="check" size={11} strokeWidth={3} /> : st === 'failed' || st === 'timeout' ? '!' : ''}</span>
                  {k === 'NIN' || k === 'BVN' ? kycLabelAuthority(k, ' · ', CO) : k === 'LIVENESS' ? 'Selfie check' : k === 'AML' ? 'AML screening' : k === 'PEP' ? 'PEP screening' : 'Fraud screening'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--soft)', textTransform: 'capitalize' }}>{st === 'passed' ? 'Verified' : st}</span>
              </div>
            );
          })}
        </div>

        <div className="cx-card">
          <div className="cx-label" style={{ marginBottom: 10 }}>Activity</div>
          {c.timeline.slice(0, 6).map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, padding: '7px 0', fontSize: 12.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--sky)', marginTop: 5, flex: '0 0 auto' }} />
              <span style={{ color: 'var(--ink)' }}>{e.message}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
