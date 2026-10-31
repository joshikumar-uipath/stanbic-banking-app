// Scripted assistant ("Aura Assistant" / digibot-style). No AI backend, no login
// — keyword-matched canned responses, quick-reply chips, service cards, a guided
// card-block flow, FAQs, feedback, and deep-links into the app. Localised to the bank of the loaded theme.
import { useEffect, useRef, useState } from 'react';
import { C, FONT_HEAD, FONT_BODY } from '../theme';
import Icon from '../icons';
import { useNav } from '../nav';
import { useConfig, activeBank } from '../../config';
import { customer, depositAccounts, cards, mpesa, money, supportPhone } from '../data';

interface Action { label: string; do: string } // do: an intent, or "nav:<kind>[:<param>]"
interface Block {
  text?: string;
  ai?: boolean;
  feedback?: boolean;
  balances?: boolean;
  cards?: Action[];
  replies?: Action[];
  faqs?: string[];
}
type Turn = { role: 'user'; text: string } | { role: 'bot'; blocks: Block[] };

const SUGGESTIONS: Action[] = [
  { label: 'Check my balance', do: 'balance' },
  { label: 'Send money', do: 'send' },
  { label: 'Pay a bill', do: 'paybill' },
  { label: 'Replace my card', do: 'replace' },
  { label: 'Reset card PIN', do: 'pin' },
  { label: 'Talk to support', do: 'support' },
];

function respond(intent: string): Block[] {
  switch (intent) {
    case 'balance':
      return [{ balances: true, text: 'Here are your balances. Anything else?', replies: [{ label: 'Send money', do: 'send' }, { label: 'Pay a bill', do: 'paybill' }] }];
    case 'send':
      return [{ text: 'Sure — how would you like to send money?', replies: [
        { label: 'Send via Mobile Wallet', do: 'nav:transfer:sendmoney' },
        { label: 'NIP Transfer', do: 'nav:transfer:pesalink' },
        { label: 'To my own account', do: 'nav:transfer:ownaccount' },
      ] }];
    case 'paybill':
      return [{ text: 'I can help you pay a bill (electricity, water, TV, school fees and more).', replies: [{ label: 'Pay a bill now', do: 'nav:transfer:paybill' }] }];
    case 'replace':
      return [{
        text: 'Lost or stolen card? I can block it immediately and order a replacement. Which would you like to do?',
        ai: true, feedback: true,
        replies: [{ label: 'Block my card', do: 'blockcard' }, { label: 'Order a replacement', do: 'blockcard' }],
        faqs: ['How long does a replacement take?', 'Is there a fee for a new card?', 'How do I activate my new card?'],
      }];
    case 'blockcard':
      return [{ text: 'Which card would you like to block?', cards: cards.map((c) => ({ label: `${c.name} ···· ${c.last4}`, do: 'blockdone' })) }];
    case 'blockdone':
      return [{
        text: `Done — your card has been blocked and a replacement is on its way (3–5 business days). Reference ${activeBank().slug.toUpperCase()}${Math.floor(Math.random() * 1e6).toString(36).toUpperCase()}.`,
        feedback: true, replies: [{ label: 'Anything else', do: 'menu' }],
      }];
    case 'pin':
      return [{
        text: 'To reset your card PIN:\n1. Go to More → Cards\n2. Select your card\n3. Tap “Reset PIN” and follow the steps.\nWant me to take you there?',
        ai: true, feedback: true,
        replies: [{ label: 'Open Cards', do: 'nav:more' }, { label: 'Maybe later', do: 'menu' }],
      }];
    case 'loan':
      return [{
        text: 'You can get quick cash with Overdraft, an EasySave loan, or a personal loan at competitive rates.',
        ai: true, feedback: true,
        replies: [{ label: 'Apply for a loan', do: 'applyloan' }, { label: 'About Overdraft', do: 'fuliza' }],
        faqs: ['What are the current loan rates?', 'How is my loan limit calculated?', 'How do I repay early?'],
      }];
    case 'fuliza':
      return [{ text: `Overdraft lets you complete Mobile Wallet payments even with insufficient funds. Your available limit is ${money(8800, 0)} and it auto-repays from your next deposit.`, feedback: true, replies: [{ label: 'Back to menu', do: 'menu' }] }];
    case 'applyloan':
      return [{ text: 'Great — loan applications are handled in the Apply section. I can take you there.', replies: [{ label: 'Open Apply', do: 'nav:more' }, { label: 'Back to menu', do: 'menu' }] }];
    case 'statement':
      return [{ text: 'Your May 2026 eStatement is ready, and your recent transactions are up to date.', replies: [{ label: 'View transactions', do: 'nav:transactions' }] }];
    case 'support':
      return [{ text: `Our contact centre is available 24/7:\n📞 ${supportPhone}\n💬 Live chat right here in the app`, replies: [{ label: 'Back to menu', do: 'menu' }] }];
    case 'menu':
      return [{ text: 'What else can I help you with?', replies: SUGGESTIONS }];
    default:
      return [{ text: "I'm still learning and may not have an answer for that yet. Here are some things I can help with:", replies: SUGGESTIONS }];
  }
}

function matchKeyword(text: string): string {
  const t = text.toLowerCase();
  if (/balance|how much|account/.test(t)) return 'balance';
  if (/send|transfer|money|mpesa|m-pesa|pesalink/.test(t)) return 'send';
  if (/bill|kplc|water|electric|pay/.test(t)) return 'paybill';
  if (/card|block|lost|stolen|replace/.test(t)) return 'replace';
  if (/pin/.test(t)) return 'pin';
  if (/loan|fuliza|borrow|m-shwari|mshwari|cash/.test(t)) return 'loan';
  if (/statement|history|transaction/.test(t)) return 'statement';
  if (/help|support|agent|human|call/.test(t)) return 'support';
  return 'fallback';
}

const TOPICS: Action[] = [
  { label: 'Payments & transfers', do: 'send' },
  { label: 'Cards', do: 'replace' },
  { label: 'Accounts & balances', do: 'balance' },
  { label: 'Loans & Overdraft', do: 'loan' },
  { label: 'General help', do: 'support' },
];

export default function Digibot() {
  const nav = useNav();
  const { branding } = useConfig();
  const [turns, setTurns] = useState<Turn[]>([{ role: 'bot', blocks: [{ text: `Hi ${customer.firstName} 👋 I'm your ${branding.appName} assistant. What can I help you with?`, replies: SUGGESTIONS }] }]);
  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [turns, typing]);

  const botReply = (intent: string) => {
    setTyping(true);
    window.setTimeout(() => { setTyping(false); setTurns((t) => [...t, { role: 'bot', blocks: respond(intent) }]); }, 450);
  };

  const doAction = (a: Action) => {
    if (a.do.startsWith('nav:')) {
      const [, kind, param] = a.do.split(':');
      nav.closeDigibot();
      if (kind === 'transfer') nav.push({ name: 'transfer', title: a.label, params: { action: param, label: a.label } });
      else if (kind === 'transactions') nav.push({ name: 'transactions', title: 'Transaction History' });
      else if (kind === 'more') nav.resetTo('more');
      return;
    }
    setTurns((t) => [...t, { role: 'user', text: a.label }]);
    botReply(a.do);
  };

  const send = () => {
    const t = input.trim(); if (!t) return;
    setInput('');
    setTurns((p) => [...p, { role: 'user', text: t }]);
    botReply(matchKeyword(t));
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: C.page, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, paddingTop: 'max(env(safe-area-inset-top), 10px)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
          <button type="button" aria-label="Topics" onClick={() => setMenuOpen(true)} style={hbtn}><Icon name="more" size={20} /></button>
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 17, color: C.text }}>Assistant</span>
          <button type="button" aria-label="Close" onClick={nav.closeDigibot} style={hbtn}><Icon name="close" size={22} /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {turns.map((turn, i) => turn.role === 'user'
          ? <UserBubble key={i} text={turn.text} />
          : turn.blocks.map((b, j) => <BotBlock key={`${i}-${j}`} block={b} onAction={doAction} />))}
        {typing && <Typing />}
      </div>

      {/* Input */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, padding: '10px 12px max(env(safe-area-inset-bottom), 12px)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => setMenuOpen(true)} style={{ ...hbtn, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, borderRadius: 999 }}><Icon name="more" size={18} /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask the assistant…" style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 999, padding: '11px 16px', fontSize: 14.5, outline: 'none', background: C.page, color: C.text }} />
        <button type="button" onClick={send} disabled={!input.trim()} style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: input.trim() ? 'var(--brand-primary)' : 'rgba(24,33,38,0.15)', color: '#fff', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="pay" size={18} />
        </button>
      </div>

      {/* Topic menu sheet */}
      {menuOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setMenuOpen(false)}>
          <div style={{ background: C.card, borderRadius: '20px 20px 0 0', padding: '8px 0 max(env(safe-area-inset-bottom), 14px)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(24,33,38,0.18)', margin: '8px auto 6px' }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, letterSpacing: 0.3, padding: '8px 18px 4px', textTransform: 'uppercase' }}>Topics</div>
            {TOPICS.map((t) => (
              <button key={t.do} type="button" onClick={() => { setMenuOpen(false); doAction(t); }} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '15px 18px', fontSize: 15, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {t.label}<Icon name="chevron" size={17} color={C.textFaint} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Render bits ──────────────────────────────────────────────────────────────
function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: '#1c2630', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: 14.5, lineHeight: 1.45 }}>{text}</div>
  );
}

function BotBlock({ block, onAction }: { block: Block; onAction: (a: Action) => void }) {
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(block.text || block.balances) && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px 16px 16px 4px', padding: '12px 14px' }}>
          {block.text && <div style={{ fontSize: 14.5, lineHeight: 1.5, color: C.text, whiteSpace: 'pre-line' }}>{block.text}</div>}
          {block.balances && <Balances />}
          {block.ai && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>✨ Response generated by AI</div>}
          {block.feedback && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Thumb dir="up" /><Thumb dir="down" />
            </div>
          )}
        </div>
      )}
      {block.cards && block.cards.map((c, i) => (
        <button key={i} type="button" onClick={() => onAction(c)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>SELECT</span>
        </button>
      ))}
      {block.faqs && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, padding: '8px 0 4px' }}>Related FAQs</div>
          {block.faqs.map((f, i) => (
            <div key={i} style={{ fontSize: 13.5, color: C.brand, padding: '10px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}>{f}</div>
          ))}
        </div>
      )}
      {block.replies && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          {block.replies.map((r, i) => (
            <button key={i} type="button" onClick={() => onAction(r)} style={{ background: `rgba(${C.brandRgb},0.08)`, border: `1px solid rgba(${C.brandRgb},0.35)`, color: C.brand, borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_BODY }}>{r.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Balances() {
  const rows = [
    ...depositAccounts.filter((a) => a.kind !== 'fixed').map((a) => ({ name: a.name, bal: a.balance })),
    { name: 'Mobile Wallet', bal: mpesa.balance },
  ];
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
          <span style={{ fontSize: 13.5, color: C.textSoft }}>{r.name}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{money(r.bal)}</span>
        </div>
      ))}
    </div>
  );
}

function Thumb({ dir }: { dir: 'up' | 'down' }) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" onClick={() => setOn((v) => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${on ? `rgba(${C.brandRgb},0.4)` : C.border}`, background: on ? `rgba(${C.brandRgb},0.1)` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: on ? C.brand : C.textFaint, transform: dir === 'down' ? 'scaleY(-1)' : 'none' }}>
      <Icon name="wealth" size={14} />
    </button>
  );
}

function Typing() {
  return (
    <div style={{ alignSelf: 'flex-start', background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: C.textFaint, animation: `auraDot 1s ${i * 0.15}s infinite ease-in-out` }} />
      ))}
      <style>{`@keyframes auraDot{0%,80%,100%{opacity:0.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  );
}

const hbtn: React.CSSProperties = { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' };
