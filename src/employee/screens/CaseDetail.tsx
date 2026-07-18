// ─────────────────────────────────────────────────────────────────────────────
// Case detail — the desk's right pane for an existing application.
//
// Replaces the customer's own tracker, which was being shown to staff: an RM was
// reading "YOUR application" and "your account number is ready" about somebody
// else, with no indication of what to do. This is the same case in the banker's
// voice, led by the next best action.
//
// (The capture wizard still shows the customer-facing screens — during capture
// the screen is turned toward the customer, which is exactly who they're for.)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { stateMeta, fullName, VALIDATION_KINDS, type OnboardingCase, type ValidationKind } from '../../onboarding';
import Kyc from '../../customer/Kyc';
import { nextBestActions, type Nba } from '../nba';
import { I, Tag, type Tone } from '../ui';
import { ago } from '../time';

const TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };

const CHECK_LABEL: Record<ValidationKind, string> = {
  NIN: 'NIN — NIMC', BVN: 'BVN — NIBSS', AML: 'AML screening',
  PEP: 'PEP screening', FRAUD: 'Fraud screening', LIVENESS: 'Selfie check',
};
const CHECK_TONE: Record<string, Tone> = {
  passed: 'good', running: 'info', retrying: 'info', pending: 'idle', failed: 'crit', timeout: 'crit',
};

export default function CaseDetail({ c, onClose }: { c: OnboardingCase; onClose: () => void }) {
  const [kyc, setKyc] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (kyc) return <div className="dk-flow"><Kyc c={c} onExit={() => setKyc(false)} /></div>;

  const m = stateMeta(c.state);
  const actions = nextBestActions(c);
  const name = fullName(c).trim() || 'Unnamed applicant';

  const fire = async (a: Nba) => {
    if (a.opens === 'kyc') { setKyc(true); return; }
    if (a.href) { window.location.href = a.href; return; }
    if (!a.run) return;
    setBusy(a.id);
    try {
      const msg = await a.run();
      setToast(msg);
      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dk-case">
      <div className="dk-case-head">
        <button className="x" onClick={onClose} aria-label="Close"><I n="chevron" s={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">{name}</div>
          <div className="rf num">{c.id} · opened {ago(c.createdAt)}</div>
        </div>
        <Tag tone={TONE[m.tone] ?? 'idle'}>{m.label}</Tag>
      </div>

      <div className="dk-case-body">
        {/* The point of the pane: what to do, and why. */}
        <Action actions={actions} busy={busy} onFire={fire} />

        {c.accountNumber && (
          <div className="dk-acct">
            <div>
              <span className="k">Account number</span>
              <span className="v num">{c.accountNumber}</span>
              {c.cif && <span className="c num">CIF {c.cif}</span>}
            </div>
            <span className="dk-tag green">Live</span>
          </div>
        )}

        <div className="dk-eyebrow" style={{ marginTop: 18 }}>Checks</div>
        <div className="dk-checks">
          {VALIDATION_KINDS.map((k) => {
            const v = c.validations.find((x) => x.kind === k);
            const st = v?.status ?? 'pending';
            const t = CHECK_TONE[st] ?? 'idle';
            return (
              <div className="dk-check" key={k}>
                <span className={`dk-dot ${t}${st === 'running' || st === 'retrying' ? ' live' : ''}`} />
                <span className="l">{CHECK_LABEL[k]}</span>
                <span className={`s ${t}`}>
                  {st === 'passed' ? 'Verified' : st === 'failed' ? 'Failed' : st === 'timeout' ? 'Timed out' : st === 'retrying' ? 'Retrying' : st === 'running' ? 'Running' : 'Pending'}
                  {v && v.attempts > 1 && (st === 'failed' || st === 'timeout') ? ` · ${v.attempts} attempts` : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div className="dk-eyebrow" style={{ marginTop: 18 }}>Contact</div>
        <div className="dk-kv">
          {c.phone && <div><span>Phone</span><a className="num" href={`tel:${c.phone}`}>{c.phone}</a></div>}
          {c.email && <div><span>Email</span><a href={`mailto:${c.email}`}>{c.email}</a></div>}
          {c.bvn && <div><span>BVN</span><b className="num">{c.bvn}</b></div>}
          {c.nin && <div><span>NIN</span><b className="num">{c.nin}</b></div>}
        </div>

        <div className="dk-eyebrow" style={{ marginTop: 18 }}>Activity</div>
        <div className="dk-tl">
          {c.timeline.slice(0, 8).map((e) => (
            <div className="dk-tl-i" key={e.id}>
              <span className="d" />
              <span className="t">
                {e.message}
                <em className="num">{e.topic} · {ago(e.at)}</em>
              </span>
            </div>
          ))}
          {!c.timeline.length && <div className="dk-empty" style={{ padding: '18px 14px' }}><span>Nothing recorded yet.</span></div>}
        </div>
      </div>

      {toast && <div className="dk-toast">{toast}</div>}
    </div>
  );
}

function Action({ actions, busy, onFire }: { actions: Nba[]; busy: string | null; onFire: (a: Nba) => void }) {
  const [first, ...rest] = actions;
  if (!first) return null;
  const quiet = first.kind !== 'do';

  return (
    <div className={`dk-nba ${first.kind}`}>
      <div className="hd">
        <span className="ic">
          <I n={first.kind === 'do' ? 'zap' : first.kind === 'done' ? 'check' : 'clock'} s={14} w={2.2} />
        </span>
        <span>{quiet ? 'Status' : 'Next best action'}</span>
      </div>

      <div className="ttl">{first.title}</div>
      <p className="why">{first.why}</p>

      {!quiet && (
        <div className="acts">
          <button className="dk-btn pri lg" disabled={busy === first.id} onClick={() => onFire(first)}>
            {busy === first.id ? 'Working…' : first.title}
          </button>
        </div>
      )}

      {rest.length > 0 && (
        <div className="alt">
          <div className="alt-h">If that doesn&rsquo;t work</div>
          {rest.map((a) => (
            <button key={a.id} className="alt-i" disabled={busy === a.id} onClick={() => onFire(a)}>
              <span className="t">
                <b>{busy === a.id ? 'Working…' : a.title}</b>
                <span>{a.why}</span>
              </span>
              <I n="chevron" s={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
