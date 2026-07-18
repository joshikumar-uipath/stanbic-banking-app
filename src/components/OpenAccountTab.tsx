// ─────────────────────────────────────────────────────────────────────────────
// Open an account — the staff-assisted capture entry inside the employee app.
// Launched as an overlay from Home, the same way Customers and Approvals are.
//
// The wizard itself is the *same* component the customer uses in their own app
// (../customer/flow) — passed mode='rm' so it writes source:'rm', channel:'single'
// and speaks to the banker rather than the applicant. One flow, two audiences:
// whatever we fix for one surface lands on both.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../config';
import { Icn } from './customerUi';
import { store, stateMeta, fullName, type OnboardingCase } from '../onboarding';
import AccountOpeningFlow from '../customer/flow';

const TONE: Record<string, string> = { good: '#16A968', pending: '#E0904A', exception: '#E0533D', progress: 'var(--brand-secondary)', neutral: '#7A8896' };

/** The branch's own openings — everything a banker captured, newest first. */
function useBranchCases(): OnboardingCase[] {
  const [list, setList] = useState<OnboardingCase[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void store.list().then((all) => {
        if (!alive) return;
        setList(all.filter((c) => c.source === 'rm' || c.source === 'branch')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      });
    };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);
  return list;
}

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

export default function OpenAccountTab({ onClose, wide }: { onClose?: () => void; wide?: boolean } = {}) {
  const cases = useBranchCases();
  // null = nothing open; '' = start a new capture; an id = track that one.
  const [flow, setFlow] = useState<string | null>(null);

  // Phone: the wizard takes the screen. Desk: pipeline stays put on the left and
  // the customer you're capturing sits beside it — the way a banker works.
  if (!wide) {
    if (flow !== null) {
      return (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 50 }}>
          <AccountOpeningFlow mode="rm" startCaseId={flow || undefined} onExit={() => setFlow(null)} />
        </div>
      );
    }
    return <Pipeline cases={cases} onClose={onClose} onPick={setFlow} />;
  }

  return (
    <div className={`ew-split${flow !== null ? ' busy' : ''}`}>
      <div className="pane left"><Pipeline cases={cases} onPick={setFlow} active={flow} /></div>
      <div className="pane right">
        {flow !== null
          ? <div className="ew-flow"><AccountOpeningFlow key={flow} mode="rm" startCaseId={flow || undefined} onExit={() => setFlow(null)} /></div>
          : <Blank />}
      </div>
    </div>
  );
}

function Blank() {
  return (
    <div className="ew-empty">
      <div className="in">
        <div className="mark"><Icn name="idcard" size={26} /></div>
        <h3>Nothing open</h3>
        <p>Start a new application, or pick one from the pipeline to see where it got to.</p>
      </div>
    </div>
  );
}

function Pipeline({ cases, onClose, onPick, active }: { cases: OnboardingCase[]; onClose?: () => void; onPick: (id: string) => void; active?: string | null }) {
  const { t } = useTheme();
  const { branding } = useConfig();

  const open = cases.filter((c) => c.state !== 'FULLY_ACTIVATED').length;
  const waiting = cases.filter((c) => c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS').length;
  const exceptions = cases.filter((c) => c.state === 'EXCEPTION').length;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: t.bgPage }}>
      <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onClose && (
              <button type="button" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 999, background: t.backBtnBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icn name="back" size={20} color={t.backBtnIcon} />
              </button>
            )}
            <div className="tracking-tight" style={{ fontWeight: 700, fontSize: 24, color: t.textPrimary }}>Open an account</div>
          </div>
          <div style={{ fontSize: 13.5, color: t.textMuted, marginTop: 4 }}>Assisted capture · {branding.appName}</div>
        </div>

        {/* Pipeline pulse */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <Stat t={t} n={open} label="In progress" />
          <Stat t={t} n={waiting} label="Awaiting KYC" tone={TONE.pending} />
          <Stat t={t} n={exceptions} label="Exceptions" tone={TONE.exception} />
        </div>

        {/* The whole point of the screen */}
        <button type="button" onClick={() => onPick('')} style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.22)', borderRadius: 16, padding: '13px 14px', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 5px 14px rgba(var(--brand-primary-rgb),0.4)' }}><Icn name="idcard" size={22} color="#fff" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.textPrimary }}>New application</span>
            <span style={{ display: 'block', fontSize: 12.5, color: t.textMuted, marginTop: 1 }}>Capture their details — the account opens while they walk away</span>
          </span>
          <Icn name="chevron" size={18} color={t.chevron} />
        </button>

        {/* Branch pipeline */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: t.textMuted, marginBottom: 10 }}>Your applications</div>
          {cases.length === 0 ? (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>Nothing open yet</div>
              <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 4 }}>Start a new application and it&rsquo;ll track here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cases.map((c) => {
                const m = stateMeta(c.state);
                const tone = TONE[m.tone] ?? TONE.neutral;
                const name = fullName(c).trim();
                const on = active === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => onPick(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: on ? 'rgba(var(--brand-primary-rgb),0.09)' : t.bgCard, border: `1px solid ${on ? 'rgba(var(--brand-primary-rgb),0.3)' : t.border}`, borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: tone, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Unnamed applicant'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: t.textMuted }}>
                        <span style={{ letterSpacing: 0.3 }}>{c.id}</span>
                        <span>·</span>
                        <span>{ago(c.createdAt)}</span>
                      </span>
                    </span>
                    <span style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone, fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 7, flexShrink: 0 }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ t, n, label, tone }: { t: Record<string, string>; n: number; label: string; tone?: string }) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: tone ?? t.textPrimary, letterSpacing: -0.4 }}>{n}</div>
      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
