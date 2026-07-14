import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Icn, Avatar, Pill, TONE, RISK } from './customerUi';
import { money, APPROVE_REASONS, REJECT_REASONS, type Approval } from '../approvalsData';

type Outcome = 'approve' | 'reject' | 'info';

export default function ApprovalDetail({ approval, onBack, onResolved }: { approval: Approval; onBack: () => void; onResolved: (id: string) => void }) {
  const { t, theme } = useTheme();
  const [phase, setPhase] = useState<'review' | 'reason' | 'done'>('review');
  const [outcome, setOutcome] = useState<Outcome>('approve');
  const [reason, setReason] = useState<string | null>(null);

  const dual = !approval.withinAuthority;
  const reasons = outcome === 'reject' ? REJECT_REASONS : APPROVE_REASONS;

  const choose = (o: Outcome) => {
    if (o === 'info') { setOutcome('info'); setPhase('done'); return; }
    setOutcome(o); setReason(null); setPhase('reason');
  };

  const doneMsg = outcome === 'info'
    ? 'Information requested from the maker'
    : outcome === 'reject'
      ? 'Rejected — maker notified, decision logged'
      : dual
        ? 'Routed to Regional Credit for dual approval'
        : 'Approved — second approver notified (maker-checker)';
  const doneTone = outcome === 'reject' ? '#E0533D' : outcome === 'info' ? TONE.info : '#16A968';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bgPage }}>
      {/* Header */}
      <div style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
          <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 999, background: t.backBtnBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icn name="back" size={20} color={t.backBtnIcon} />
          </button>
          <span className="tracking-tight" style={{ fontWeight: 700, fontSize: 19, color: t.textPrimary }}>Approval</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '6px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title + amount */}
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(var(--brand-primary-rgb),0.1)', color: 'var(--brand-primary)', fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              <Icn name={approval.icon} size={13} color="var(--brand-primary)" /> {approval.typeLabel}
            </span>
            <div className="tracking-tight" style={{ fontWeight: 700, fontSize: 21, color: t.textPrimary, marginTop: 8 }}>{approval.title}</div>
            {approval.amount > 0 && <div style={{ fontWeight: 700, fontSize: 26, color: 'var(--brand-primary)', marginTop: 2, letterSpacing: -0.4 }}>{money(approval.amount)}</div>}
          </div>

          {/* Customer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 12 }}>
            <Avatar initials={approval.initials} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary }}>{approval.customer}</div>
              <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 1 }}>Requested by {approval.maker} · {approval.ago}</div>
            </div>
            <Pill color={RISK[approval.risk]} soft><Icn name="shield" size={12} color={RISK[approval.risk]} /> {approval.risk}</Pill>
          </div>

          {/* Authority check */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: dual ? 'rgba(224,144,74,0.1)' : 'rgba(22,169,104,0.1)', border: `1px solid ${dual ? 'rgba(224,144,74,0.28)' : 'rgba(22,169,104,0.28)'}` }}>
            <Icn name={dual ? 'shield' : 'check'} size={18} color={dual ? '#E0904A' : '#16A968'} strokeWidth={2.2} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: dual ? '#E0904A' : '#16A968' }}>
              {dual ? 'Exceeds your limit — requires dual approval' : 'Within your approval authority'}
            </span>
          </div>

          {/* Maker reason */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Maker’s justification</div>
            <div style={{ fontSize: 13.5, color: t.textBody, lineHeight: 1.5 }}>{approval.reason}</div>
          </div>

          {/* Details */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {approval.details.map((d, i) => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${t.divider}` : 'none' }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>{d.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>{d.value}</span>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(var(--brand-primary-rgb),0.07)', border: '1px solid rgba(var(--brand-primary-rgb),0.18)' }}>
            <Icn name="sparkle" size={17} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, fontSize: 13, color: t.textBody, lineHeight: 1.5 }}><b style={{ color: 'var(--brand-primary)' }}>Recommendation. </b>{approval.recommendation}</span>
          </div>

          <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'center', padding: '2px 8px', lineHeight: 1.5 }}>
            Maker-checker enforced · every decision is audit-logged with your reason code.
          </div>
        </div>
      </div>

      {/* Action area */}
      <div style={{ flexShrink: 0, background: t.navBg, borderTop: `1px solid ${t.navBorder}`, backdropFilter: 'blur(20px)', padding: '12px 16px max(env(safe-area-inset-bottom), 12px)' }}>
        {phase === 'review' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => choose('reject')} style={{ flex: 1, border: `1px solid rgba(224,83,61,0.35)`, cursor: 'pointer', borderRadius: 14, padding: '13px 6px', fontSize: 14, fontWeight: 700, background: 'rgba(224,83,61,0.1)', color: '#E0533D' }}>Reject</button>
            <button type="button" onClick={() => choose('info')} style={{ flex: 1, border: `1px solid ${t.border}`, cursor: 'pointer', borderRadius: 14, padding: '13px 6px', fontSize: 14, fontWeight: 700, background: t.bgCardStrong, color: t.textBody }}>Request info</button>
            <button type="button" onClick={() => choose('approve')} style={{ flex: 1.4, border: 'none', cursor: 'pointer', borderRadius: 14, padding: '13px 6px', fontSize: 14, fontWeight: 700, background: 'var(--brand-primary)', color: '#fff', boxShadow: '0 6px 16px rgba(var(--brand-primary-rgb),0.4)' }}>{dual ? 'Approve & route' : 'Approve'}</button>
          </div>
        )}

        {phase === 'reason' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: t.textPrimary }}>Select a reason code to {outcome === 'reject' ? 'reject' : 'approve'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {reasons.map((r) => {
                const on = reason === r;
                return (
                  <button key={r} type="button" onClick={() => setReason(r)} style={{ border: on ? 'none' : `1px solid ${t.border}`, cursor: 'pointer', borderRadius: 999, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, background: on ? (outcome === 'reject' ? '#E0533D' : 'var(--brand-primary)') : (theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)'), color: on ? '#fff' : t.textBody }}>{r}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPhase('review')} style={{ flex: 1, border: `1px solid ${t.border}`, cursor: 'pointer', borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 700, background: t.bgCardStrong, color: t.textBody }}>Back</button>
              <button type="button" disabled={!reason} onClick={() => setPhase('done')} style={{ flex: 1.6, border: 'none', cursor: reason ? 'pointer' : 'default', opacity: reason ? 1 : 0.5, borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 700, background: outcome === 'reject' ? '#E0533D' : 'var(--brand-primary)', color: '#fff' }}>Confirm {outcome === 'reject' ? 'rejection' : 'approval'}</button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', paddingTop: 4 }}>
            <span style={{ width: 50, height: 50, borderRadius: 999, background: doneTone, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 18px ${doneTone}66` }}>
              <Icn name={outcome === 'reject' ? 'close' : outcome === 'info' ? 'note' : 'check'} size={26} color="#fff" strokeWidth={2.6} />
            </span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary }}>{doneMsg}</div>
              {reason && <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 3 }}>Reason: {reason}</div>}
            </div>
            <button type="button" onClick={() => onResolved(approval.id)} style={{ width: '100%', border: 'none', cursor: 'pointer', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 700, background: 'var(--brand-primary)', color: '#fff', boxShadow: '0 6px 16px rgba(var(--brand-primary-rgb),0.4)' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
