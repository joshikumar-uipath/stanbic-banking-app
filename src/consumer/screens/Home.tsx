import { useState, type ReactNode } from 'react';
import { C, SHADOW, FONT_HEAD, FONT_BODY } from '../theme';
import Icon from '../icons';
import { useNav } from '../nav';
import { Card, SegTabs, Sparkline, Tag, Amount } from '../components';
import { useBank } from '../../config';
import {
  customer, depositAccounts, depositsTotal, cards, cardsOutstanding,
  mpesa, netWorth, insights, money, CURRENCY, type Account, type CardAccount,
} from '../data';

const TREND = [792, 805, 788, 831, 856, 844, 870, 909]; // demo balance trend (000s)

export default function HomeScreen() {
  const [tab, setTab] = useState<'accounts' | 'insights'>('accounts');
  const { web } = useNav();

  // Internet banking: the balance and what you can do with it sit beside your
  // money, instead of the customer scrolling a phone column on a wide screen.
  if (web) {
    return (
      <div style={{ padding: '22px 16px 32px' }}>
        <Greeting />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)', gap: 20, alignItems: 'start', marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <BalanceHero />
            <QuickActions />
            <Extras />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SegTabs tabs={[{ id: 'accounts', label: 'Accounts' }, { id: 'insights', label: 'Insights' }]} active={tab} onChange={setTab} />
            {tab === 'accounts' ? <Accounts /> : <Insights />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Greeting />
      <BalanceHero />
      <QuickActions />
      <div style={{ marginTop: 2 }}>
        <SegTabs tabs={[{ id: 'accounts', label: 'Accounts' }, { id: 'insights', label: 'Insights' }]} active={tab} onChange={setTab} />
      </div>
      {tab === 'accounts' ? <Accounts /> : <Insights />}
    </div>
  );
}

// ── Greeting ─────────────────────────────────────────────────────────────────
function Greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div style={{ padding: '2px 2px 0' }}>
      <div style={{ fontSize: 14, color: C.textSoft }}>{part},</div>
      <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 24, color: C.text, letterSpacing: -0.5 }}>{customer.firstName} 👋</div>
    </div>
  );
}

// ── Balance hero (brand-gradient card) ───────────────────────────────────────
function BalanceHero() {
  const nav = useNav();
  return (
    <div style={{
      position: 'relative', borderRadius: 26, padding: '20px 22px 22px', color: '#fff', overflow: 'hidden',
      background: 'linear-gradient(140deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 58%, #000) 100%)',
      boxShadow: SHADOW.brand,
    }}>
      {/* decorative glow */}
      <span style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: 999, background: 'rgba(255,255,255,0.10)' }} />
      <span style={{ position: 'absolute', bottom: -70, left: -20, width: 150, height: 150, borderRadius: 999, background: 'rgba(0,0,0,0.08)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: 500 }}>Total balance</span>
          <button type="button" aria-label="Hide balances" onClick={nav.toggleBalances} style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,0.16)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="eye" size={16} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, gap: 12 }}>
          <div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 32, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>
              {nav.hideBalances ? `${CURRENCY} ••••••` : money(depositsTotal + mpesa.balance)}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: 'rgba(255,255,255,0.16)', borderRadius: 999, padding: '4px 10px', fontSize: 12.5, fontWeight: 600 }}>
              <Icon name="wealth" size={13} color="#fff" /> +2.4% this month
            </div>
          </div>
          <div style={{ paddingBottom: 2 }}>
            <Sparkline data={TREND} w={96} h={42} color="rgba(255,255,255,0.92)" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────
function QuickActions() {
  const nav = useNav();
  const items = [
    { id: 'send', label: 'Send', icon: 'transfer', go: () => nav.push({ name: 'transfer', title: 'Send Money', params: { action: 'sendmoney', label: 'Send Money' } }) },
    { id: 'pay', label: 'Pay', icon: 'bill', go: () => nav.push({ name: 'transfer', title: 'Pay Bill', params: { action: 'paybill', label: 'Pay Bill' } }) },
    { id: 'topup', label: 'Top up', icon: 'phone', go: () => nav.push({ name: 'transfer', title: 'Buy Airtime', params: { action: 'airtime', label: 'Buy Airtime' } }) },
    { id: 'scan', label: 'Scan', icon: 'qr', go: () => nav.push({ name: 'scan', title: 'Scan & Pay' }) },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={it.go} style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: C.card, boxShadow: SHADOW.md, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={it.icon} size={24} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Accounts tab ─────────────────────────────────────────────────────────────
const ACCENT: Record<string, string> = {
  current: 'linear-gradient(140deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 55%, #000))',
  savings: 'linear-gradient(140deg, var(--brand-secondary), color-mix(in srgb, var(--brand-secondary) 50%, #000))',
  loop: 'linear-gradient(140deg, #12B5A6, #0A7E73)',
  fixed: 'linear-gradient(140deg, #6C5CE0, #3E327F)',
  mpesa: 'linear-gradient(140deg, #4BB543, #2C7D1F)',
};

function Accounts() {
  const nav = useNav();
  const { web } = useNav();
  const accounts = [
    ...depositAccounts,
    { id: 'mpesa', name: 'Mobile Wallet', number: mpesa.number, balance: mpesa.balance, kind: 'mpesa' as Account['kind'] },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Your money. The phone swipes a carousel; on a laptop there's room to
          show every account at once, so nothing hides off the right edge. */}
      <div>
        <SecLabel right={<SeeAll onClick={() => nav.resetTo('more')} />}>Your money</SecLabel>
        {web ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, padding: '2px 0 6px' }}>
            {accounts.map((a) => (
              <AccountCard key={a.id} a={a} wide
                onClick={() => nav.push(a.id === 'mpesa' ? { name: 'mpesa', title: 'Mobile Wallet' } : { name: 'account', title: a.name, params: { id: a.id } })} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 0 6px', margin: '0 -16px', scrollbarWidth: 'none' }}>
            <span style={{ width: 4, flexShrink: 0 }} />
            {accounts.map((a) => (
              <AccountCard key={a.id} a={a}
                onClick={() => nav.push(a.id === 'mpesa' ? { name: 'mpesa', title: 'Mobile Wallet' } : { name: 'account', title: a.name, params: { id: a.id } })} />
            ))}
            <span style={{ width: 4, flexShrink: 0 }} />
          </div>
        )}
      </div>

      {/* Cards */}
      <div>
        <SecLabel right={<SeeAll />}>Cards</SecLabel>
        <PaymentCard card={cards[0]} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '0 4px' }}>
          <div>
            <div style={{ fontSize: 12, color: C.textSoft }}>Outstanding balance</div>
            <Amount value={cardsOutstanding} size={18} />
          </div>
          <button type="button" onClick={() => nav.push({ name: 'transfer', title: 'Pay Card', params: { action: 'card', label: 'Pay Card' } })} style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 20px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', boxShadow: SHADOW.sm }}>Pay now</button>
        </div>
      </div>

      {/* Extras. On the web these move up into the left column beside the
          balance, so this renders only on the phone. */}
      {!web && <Extras />}
    </div>
  );
}

function Extras() {
  return (
    <Card>
      <MiniRow icon="leaf" tint={C.good} title="Go Green" subtitle="Track your footprint, plant a tree" badge={<Tag tone="good">New</Tag>} />
      <div style={{ height: 1, background: C.hairline, margin: '0 18px' }} />
      <MiniRow icon="wealth" tint={C.brand} title="Net worth" subtitle="Across all your accounts" right={<Amount value={netWorth} size={16} />} />
    </Card>
  );
}

function AccountCard({ a, onClick, wide }: { a: Account; onClick?: () => void; wide?: boolean }) {
  const icon = a.kind === 'mpesa' ? 'mpesa' : a.kind === 'savings' ? 'cash' : a.kind === 'fixed' ? 'lock' : a.kind === 'loop' ? 'accounts' : 'bank';
  return (
    <button type="button" onClick={onClick} style={{
      // `wide` lets the grid size it; the carousel needs a fixed width to swipe.
      flexShrink: 0, width: wide ? '100%' : 168, textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 20, padding: 16, color: '#fff',
      background: ACCENT[a.kind] ?? ACCENT.current, boxShadow: SHADOW.md, position: 'relative', overflow: 'hidden',
    }}>
      <span style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'relative' }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color="#fff" /></span>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 16, fontWeight: 500 }}>{a.name}</div>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, marginTop: 3, letterSpacing: -0.4 }}>
          <Amount value={a.balance} size={18} color="#fff" />
        </div>
      </div>
    </button>
  );
}

function PaymentCard({ card }: { card: CardAccount }) {
  const bank = useBank();
  return (
    <div style={{ borderRadius: 20, padding: 20, color: '#fff', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${card.gradient[0]}, ${card.gradient[1]})`, boxShadow: SHADOW.lg, minHeight: 176 }}>
      <span style={{ position: 'absolute', bottom: -60, right: -40, width: 200, height: 200, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>{bank.name}</span>
        <Icon name="globe" size={20} color="rgba(255,255,255,0.7)" />
      </div>
      {/* chip */}
      <div style={{ width: 40, height: 30, borderRadius: 7, background: 'linear-gradient(135deg,#f3d27a,#caa24a)', marginTop: 26 }} />
      <div style={{ fontFamily: FONT_HEAD, fontSize: 19, letterSpacing: 2.5, marginTop: 16, fontWeight: 500 }}>
        ••••&nbsp; ••••&nbsp; ••••&nbsp; {card.last4}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, position: 'relative' }}>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>CARD HOLDER</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{customer.name.toUpperCase()}</div>
        </div>
        <span style={{ fontFamily: FONT_HEAD, fontStyle: 'italic', fontWeight: 700, fontSize: 16 }}>{card.scheme}</span>
      </div>
    </div>
  );
}

// ── Insights tab ─────────────────────────────────────────────────────────────
function Insights() {
  const tone = { good: { c: C.good, bg: C.goodSoft, i: 'cash' }, warn: { c: C.warn, bg: C.warnSoft, i: 'info' }, info: { c: C.brand, bg: `rgba(${C.brandRgb},0.10)`, i: 'wealth' } } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {insights.map((it) => {
        const t = tone[it.tone];
        return (
          <Card key={it.id}>
            <div style={{ display: 'flex', gap: 14, padding: 16 }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: t.bg, color: t.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={t.i} size={22} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textFaint, letterSpacing: 0.4 }}>{it.date}</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: C.text, marginTop: 3, letterSpacing: -0.2 }}>{it.title}</div>
                <div style={{ fontSize: 13.5, color: C.textSoft, lineHeight: 1.5, marginTop: 4 }}>{it.body}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────
function SecLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 12px' }}>
      <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17, color: C.text, letterSpacing: -0.3 }}>{children}</span>
      {right}
    </div>
  );
}
function SeeAll({ onClick }: { onClick?: () => void }) {
  return <button type="button" onClick={onClick} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.brand, fontWeight: 600, fontSize: 13, fontFamily: FONT_BODY }}>See all</button>;
}
function MiniRow({ icon, tint, title, subtitle, right, badge }: { icon: string; tint: string; title: string; subtitle: string; right?: ReactNode; badge?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px' }}>
      <span style={{ width: 42, height: 42, borderRadius: 13, background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={icon} size={21} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</span>{badge}</div>
        <div style={{ fontSize: 12.5, color: C.textSoft, marginTop: 1 }}>{subtitle}</div>
      </div>
      {right ?? <Icon name="chevron" size={18} color={C.textFaint} />}
    </div>
  );
}
