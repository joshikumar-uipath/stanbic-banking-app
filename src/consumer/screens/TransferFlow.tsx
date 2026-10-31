import { useState } from 'react';
import { C, FONT_HEAD, FONT_BODY } from '../theme';
import Icon from '../icons';
import { useNav, type ScreenRoute } from '../nav';
import { Card } from '../components';
import { useBank } from '../../config';
import { depositAccounts, mpesa, recipients, money, fmt, CURRENCY, type Account } from '../data';

type Step = 'form' | 'review' | 'success';

const FROM_OPTIONS: { id: string; name: string; sub: string; balance: number }[] = [
  ...depositAccounts.filter((a: Account) => a.kind !== 'fixed').map((a) => ({ id: a.id, name: a.name, sub: a.number, balance: a.balance })),
  { id: 'mpesa', name: 'Mobile Wallet', sub: mpesa.number, balance: mpesa.balance },
];

function toPlaceholder(action?: string): { label: string; placeholder: string } {
  switch (action) {
    case 'paybill': return { label: 'Pay Bill number', placeholder: 'e.g. 888880' };
    case 'buygoods': return { label: 'Till number', placeholder: 'e.g. 5483210' };
    case 'pesalink': return { label: 'Account / phone', placeholder: 'Account or 07••• •••' };
    case 'ownaccount': return { label: 'To account', placeholder: 'Select your account' };
    case 'card': return { label: 'Card', placeholder: 'Select card to pay' };
    case 'airtime': return { label: 'Phone number', placeholder: '07•• ••• •••' };
    default: return { label: 'Phone number', placeholder: '07•• ••• •••' };
  }
}

export default function TransferFlow({ route }: { route: ScreenRoute }) {
  const nav = useNav();
  const params = (route.params ?? {}) as { action?: string; recipient?: string; label?: string };
  const recipient = params.recipient ? recipients.find((r) => r.id === params.recipient) : undefined;
  const action = params.action;
  const { label: toLabel, placeholder } = toPlaceholder(action);

  const [step, setStep] = useState<Step>('form');
  const [from, setFrom] = useState(FROM_OPTIONS[0]);
  const [fromOpen, setFromOpen] = useState(false);
  const [to, setTo] = useState(recipient ? recipient.name : '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const amt = parseFloat(amount || '0') || 0;
  const fee = action === 'sendmoney' || action === 'pesalink' ? Math.min(Math.max(amt * 0.01, 0), 110) : 0;
  const bank = useBank();
  const ref = `${bank.slug.toUpperCase()}${Math.floor(Math.random() * 1e9).toString(36).toUpperCase().padStart(7, '0')}`;
  const canContinue = amt > 0 && (recipient || to.trim().length > 0);

  const back = () => { if (step === 'review') setStep('form'); else nav.pop(); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.page }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, paddingTop: 'max(env(safe-area-inset-top), 10px)', flexShrink: 0 }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
          {step !== 'success' && (
            <button type="button" aria-label="Back" onClick={back} style={hdrBtn}><Icon name="back" size={22} /></button>
          )}
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 17, color: C.text, marginLeft: step === 'success' ? 14 : 0 }}>
            {step === 'success' ? 'Done' : params.label ?? 'Send Money'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* From */}
            <div>
              <FieldLabel>From</FieldLabel>
              <Card>
                <button type="button" onClick={() => setFromOpen((o) => !o)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                  <span style={{ textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>{from.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.textSoft, marginTop: 2 }}>{from.sub} · {money(from.balance)}</span>
                  </span>
                  <Icon name="chevronDown" size={18} color={C.textFaint} style={{ transform: fromOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {fromOpen && FROM_OPTIONS.filter((o) => o.id !== from.id).map((o) => (
                  <button key={o.id} type="button" onClick={() => { setFrom(o); setFromOpen(false); }} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left', padding: '12px 16px' }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{o.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.textSoft }}>{o.sub} · {money(o.balance)}</span>
                  </button>
                ))}
              </Card>
            </div>

            {/* To */}
            <div>
              <FieldLabel>{recipient ? 'To' : toLabel}</FieldLabel>
              <Card>
                {recipient ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 999, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                      {recipient.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <span>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{recipient.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: C.textSoft }}>{recipient.detail}</span>
                    </span>
                  </div>
                ) : (
                  <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={placeholder} style={inputStyle} />
                )}
              </Card>
            </div>

            {/* Amount */}
            <div>
              <FieldLabel>Amount</FieldLabel>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px' }}>
                  <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 22, color: C.textSoft }}>{CURRENCY}</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0.00" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 28, color: C.text, minWidth: 0 }} />
                </div>
              </Card>
              {fee > 0 && <div style={{ fontSize: 12, color: C.textSoft, marginTop: 6, paddingLeft: 2 }}>Transaction fee: {money(fee)}</div>}
            </div>

            {/* Note */}
            <div>
              <FieldLabel>Note (optional)</FieldLabel>
              <Card><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's this for?" style={inputStyle} /></Card>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div style={{ fontSize: 13, color: C.textSoft }}>You're sending</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 34, color: C.text, marginTop: 4 }}>{CURRENCY} {fmt(amt)}</div>
            </div>
            <Card>
              <ReviewRow label="From" value={from.name} sub={from.sub} />
              <ReviewRow label="To" value={recipient ? recipient.name : to} sub={recipient ? recipient.detail : toLabel} divider />
              <ReviewRow label="Amount" value={money(amt)} divider />
              <ReviewRow label="Fee" value={fee > 0 ? money(fee) : 'Free'} divider />
              <ReviewRow label="Total" value={money(amt + fee)} strong divider />
              {note && <ReviewRow label="Note" value={note} divider />}
            </Card>
            <div style={{ fontSize: 12, color: C.textFaint, textAlign: 'center', lineHeight: 1.5 }}>This is a demo — no real money moves.</div>
          </div>
        )}

        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
            <span style={{ width: 76, height: 76, borderRadius: 999, background: 'rgba(31,157,87,0.12)', color: C.good, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Icon name="checkCircle" size={44} strokeWidth={1.8} />
            </span>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 22, color: C.text }}>{CURRENCY} {fmt(amt)} sent</div>
            <div style={{ fontSize: 14, color: C.textSoft, marginTop: 4 }}>to {recipient ? recipient.name : to}</div>
            <Card style={{ width: '100%', marginTop: 22 }}>
              <ReviewRow label="From" value={from.name} />
              <ReviewRow label="Reference" value={ref} divider />
              <ReviewRow label="Date" value="13 Jun 2026, 11:08" divider />
            </Card>
            <div style={{ display: 'flex', gap: 24, marginTop: 18 }}>
              <SuccessAction icon="share" label="Share" />
              <SuccessAction icon="copy" label="Copy ref" />
              <SuccessAction icon="doc" label="Receipt" />
            </div>
          </div>
        )}
      </div>

      {/* Footer button */}
      <div style={{ padding: '12px 16px max(env(safe-area-inset-bottom), 14px)', background: C.card, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {step === 'form' && (
          <PrimaryButton disabled={!canContinue} onClick={() => setStep('review')}>Continue</PrimaryButton>
        )}
        {step === 'review' && (
          <PrimaryButton onClick={() => setStep('success')}>Confirm &amp; Send</PrimaryButton>
        )}
        {step === 'success' && (
          <PrimaryButton onClick={() => nav.resetTo('pay')}>Done</PrimaryButton>
        )}
      </div>
    </div>
  );
}

// ── Scan & Pay (camera placeholder) ──────────────────────────────────────────
export function ScanPay() {
  const nav = useNav();
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0c1b26' }}>
      <div style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 6px' }}>
          <button type="button" aria-label="Back" onClick={nav.pop} style={{ ...hdrBtn, color: '#fff' }}><Icon name="back" size={22} color="#fff" /></button>
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 17, color: '#fff' }}>Scan &amp; Pay</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24 }}>
        <div style={{ width: 230, height: 230, borderRadius: 24, position: 'relative', border: '2px solid rgba(255,255,255,0.25)' }}>
          {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([r, c], i) => (
            <span key={i} style={{ position: 'absolute', width: 34, height: 34, border: '3px solid var(--brand-primary)', [r ? 'bottom' : 'top']: -2, [c ? 'right' : 'left']: -2, [`border${r ? 'Top' : 'Bottom'}`]: 'none', [`border${c ? 'Left' : 'Right'}`]: 'none', borderRadius: r ? (c ? '0 0 12px 0' : '0 0 0 12px') : (c ? '0 12px 0 0' : '12px 0 0 0') } as React.CSSProperties} />
          ))}
          <Icon name="qr" size={120} color="rgba(255,255,255,0.18)" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14.5, textAlign: 'center' }}>Point at a Lipa na Mobile Wallet or NIP Transfer QR code</div>
      </div>
      <div style={{ padding: '12px 16px max(env(safe-area-inset-bottom), 14px)' }}>
        <button type="button" onClick={() => nav.push({ name: 'transfer', title: 'Pay Merchant', params: { action: 'buygoods', label: 'Pay Merchant' } })} style={{ width: '100%', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '14px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
          Enter code manually
        </button>
      </div>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, letterSpacing: 0.3, marginBottom: 7, paddingLeft: 2, textTransform: 'uppercase' }}>{children}</div>;
}
function ReviewRow({ label, value, sub, divider, strong }: { label: string; value: React.ReactNode; sub?: string; divider?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '13px 16px', borderTop: divider ? `1px solid ${C.border}` : 'none' }}>
      <span style={{ fontSize: 13.5, color: C.textSoft }}>{label}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: strong ? 700 : 600, color: C.text }}>{value}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: C.textFaint, marginTop: 2 }}>{sub}</span>}
      </span>
    </div>
  );
}
function SuccessAction({ icon, label }: { icon: string; label: string }) {
  return (
    <button type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: C.brand }}>
      <span style={{ width: 46, height: 46, borderRadius: 999, background: `rgba(${C.brandRgb},0.10)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} /></span>
      <span style={{ fontSize: 11.5, color: C.textSoft, fontFamily: FONT_BODY }}>{label}</span>
    </button>
  );
}
function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      width: '100%', background: disabled ? 'rgba(24,33,38,0.18)' : 'var(--brand-primary)', color: '#fff', border: 'none',
      borderRadius: 14, padding: '15px', fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 6px 18px rgba(var(--brand-primary-rgb),0.35)',
    }}>{children}</button>
  );
}

const hdrBtn: React.CSSProperties = { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.text, padding: '15px 16px' };
