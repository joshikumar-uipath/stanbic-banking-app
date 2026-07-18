// ─────────────────────────────────────────────────────────────────────────────
// Open Account — the raised centre tab. A landing that explains the offer and
// launches the full-screen account-opening flow on a button click (same escape
// hatch TransferFlow uses). Also lists applications already in flight.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { C, SHADOW, R, FONT_HEAD, FONT_BODY } from '../theme';
import Icon from '../icons';
import { useNav } from '../nav';
import { store, fullName, stateMeta, type OnboardingCase } from '../../onboarding';
import { myAppIds } from '../../customer/mine';

const PERKS = [
  { icon: 'check', b: 'Open in about five minutes', s: 'Your account opens while checks run in the background' },
  { icon: 'shield', b: 'Verified with NIMC & NIBSS', s: 'We confirm your NIN and BVN at source' },
  { icon: 'face', b: 'Finish KYC whenever', s: 'Send documents and your selfie later, from a link' },
];

export default function OpenAccount() {
  const nav = useNav();
  const [cases, setCases] = useState<OnboardingCase[]>([]);

  // Only ever this customer's own applications. The store holds the bank's whole
  // pipeline (Operations needs that); a consumer must never see someone else's.
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void store.list().then((cs) => {
        if (!alive) return;
        const mine = myAppIds();
        setCases(cs.filter((c) => mine.includes(c.id)).slice(0, 4));
      });
    };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  const start = () => nav.push({ name: 'open-account', title: 'Open an account' });

  // This tab is an offer and one button, not a dashboard — a call to action
  // stretched across a 1180px laptop stops reading as a button at all.
  return (
    <div style={{ padding: nav.web ? '28px 16px 40px' : '4px 16px 24px', fontFamily: FONT_BODY, maxWidth: nav.web ? 760 : undefined, margin: nav.web ? '0 auto' : undefined }}>
      {/* Hero */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: R.card, padding: '24px 20px 22px', color: '#fff',
        background: 'linear-gradient(150deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 55%, #000) 100%)',
        boxShadow: SHADOW.brand,
      }}>
        <span style={{ position: 'absolute', right: -46, top: -56, width: 190, height: 190, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', opacity: 0.85 }}>NEW ACCOUNT</div>
          <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 25, lineHeight: 1.18, letterSpacing: -0.6, margin: '10px 0 8px', maxWidth: '15ch' }}>
            A bank account in about five minutes.
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.86)', maxWidth: '34ch' }}>
            Start with your BVN and NIN. We verify everything in the background — you never wait on a queue.
          </p>
        </div>
      </div>

      {/* Perks */}
      <div style={{ background: C.card, borderRadius: R.card, boxShadow: SHADOW.md, marginTop: 14, padding: '4px 16px' }}>
        {PERKS.map((p, i) => (
          <div key={p.b} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: i ? `1px solid ${C.hairline}` : 'none' }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(${C.brandRgb},0.10)`, color: C.brand }}>
              <Icon name={p.icon} size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{p.b}</b>
              <span style={{ display: 'block', fontSize: 12.5, color: C.textSoft, marginTop: 1 }}>{p.s}</span>
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button type="button" onClick={start} style={{
        width: '100%', marginTop: 14, padding: '16px 18px', borderRadius: 18, border: 'none', cursor: 'pointer',
        background: C.brand, color: '#fff', fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15.5,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: SHADOW.brand,
      }}>
        <Icon name="plus" size={19} strokeWidth={2.4} />Open an account
      </button>
      <p style={{ fontSize: 11.5, color: C.textFaint, textAlign: 'center', marginTop: 10 }}>
        Takes about 5 minutes · You&rsquo;ll need your BVN and NIN
      </p>

      {/* In-flight applications */}
      {cases.length > 0 && (
        <>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: C.text, margin: '22px 0 10px', letterSpacing: -0.2 }}>
            Applications in progress
          </div>
          <div style={{ background: C.card, borderRadius: R.card, boxShadow: SHADOW.md, padding: '2px 16px' }}>
            {cases.map((c, i) => {
              const m = stateMeta(c.state);
              const tone = m.tone === 'good' ? C.good : m.tone === 'exception' ? C.warn : m.tone === 'pending' ? '#D97706' : C.brand;
              return (
                <button key={c.id} type="button" onClick={() => nav.push({ name: 'open-account', title: 'Application', params: { id: c.id } })}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', background: 'transparent', border: 'none', borderTop: i ? `1px solid ${C.hairline}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(${C.brandRgb},0.10)`, color: C.brand }}>
                    <Icon name="doc" size={17} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(c)}</b>
                    <span style={{ display: 'block', fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>{c.id}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tone, background: `${tone}1a`, borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap' }}>{m.label}</span>
                  <Icon name="chevron" size={16} color={C.textFaint} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
