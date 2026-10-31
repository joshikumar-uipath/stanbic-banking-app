import { useState, type ReactNode } from 'react';
import { C, FONT_HEAD } from '../theme';
import Icon from '../icons';
import { useBank } from '../../config';
import { Card, Pill, Tag, RiskMeter, Amount, ScreenTitle, ChipTabs } from '../components';
import {
  wealthProducts, investmentSummary, coverageNeeds, retirement, cashflow,
  transactions, money, CURRENCY, advisor,
} from '../data';

type WTab = 'invest' | 'protect' | 'retire' | 'cashflow';
const TABS: { id: WTab; label: string }[] = [
  { id: 'invest', label: 'Invest' },
  { id: 'protect', label: 'Protect' },
  { id: 'retire', label: 'Retire' },
  { id: 'cashflow', label: 'Money in/out' },
];

export default function WealthScreen() {
  const [tab, setTab] = useState<WTab>('invest');
  return (
    <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenTitle>Wealth</ScreenTitle>
      <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'invest' && <Invest />}
        {tab === 'protect' && <Protect />}
        {tab === 'retire' && <Retire />}
        {tab === 'cashflow' && <Cashflow />}
      </div>
    </div>
  );
}

// ── Invest ───────────────────────────────────────────────────────────────────
const INTENTS = [
  { id: 'grow', label: 'Grow long-term wealth', icon: 'wealth' },
  { id: 'income', label: 'Earn passive income', icon: 'cash' },
  { id: 'safe', label: 'Safeguard capital', icon: 'shield' },
];
const CATEGORIES = [
  { id: 'mmf', label: 'Money Market', icon: 'cash' },
  { id: 'ut', label: 'Unit Trusts', icon: 'wealth' },
  { id: 'nse', label: 'Shares (NSE)', icon: 'wealth' },
  { id: 'pension', label: 'Pension', icon: 'shield' },
];
function Invest() {
  const [intent, setIntent] = useState('grow');
  const [funding, setFunding] = useState('cash');
  return (
    <>
      <SectionTitle>Build on what you have</SectionTitle>
      <div style={{ fontSize: 13, color: C.textSoft, marginTop: -8 }}>Tell us your intent and funding source.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {INTENTS.map((it) => {
          const on = it.id === intent;
          return (
            <button key={it.id} type="button" onClick={() => setIntent(it.id)} style={{ background: on ? `rgba(${C.brandRgb},0.08)` : C.card, border: `1.5px solid ${on ? `rgba(${C.brandRgb},0.5)` : C.border}`, borderRadius: 14, padding: '14px 10px', cursor: 'pointer', textAlign: 'left' }}>
              <Icon name={it.icon} size={22} color={C.brand} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginTop: 8, lineHeight: 1.25 }}>{it.label}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['cash', 'Cash'], ['nssf', 'Pension (RSA)'], ['usd', 'Dollar']].map(([id, label]) => (
          <Pill key={id} active={funding === id} onClick={() => setFunding(id)}>{label}</Pill>
        ))}
      </div>

      {/* Product cards */}
      {wealthProducts.map((p) => (
        <Card key={p.id} onClick={() => {}}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15.5, color: C.text }}>{p.name}</div>
              <Icon name="chevron" size={18} color={C.textFaint} />
            </div>
            <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5, marginTop: 4 }}>{p.desc}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Tag tone="good">Zero charge</Tag>
              {p.tag && <Tag>{p.tag}</Tag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 700, letterSpacing: 0.4 }}>1Y RETURN</div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, color: C.good }}>{p.oneYear}% <span style={{ fontSize: 12, color: C.textSoft, fontWeight: 500 }}>p.a.</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 700, letterSpacing: 0.4, marginBottom: 5 }}>RISK</div>
                <RiskMeter level={p.risk} />
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Categories */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '16px 6px' }}>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, background: `rgba(${C.brandRgb},0.09)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={22} /></span>
              <span style={{ fontSize: 11, color: C.text, textAlign: 'center', lineHeight: 1.2 }}>{c.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Investment summary */}
      <Card>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textSoft }}>Your investment value</div>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 28, color: C.text, marginTop: 4 }}>{money(investmentSummary.total)}</div>
          <div style={{ fontSize: 13.5, color: C.good, marginTop: 4, fontWeight: 600 }}>▲ {money(investmentSummary.change)} (+{investmentSummary.changePct}%)</div>
          <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>Since {investmentSummary.since}</div>
        </div>
      </Card>

      {/* Relationship manager */}
      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: C.text }}>Questions about investing?</div>
          <div style={{ fontSize: 13, color: C.textSoft, marginTop: 2 }}>Speak to your Relationship Manager.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: 999, background: `rgba(${C.brandRgb},0.12)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{advisor.initials}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{advisor.name}</div>
              <div style={{ fontSize: 12, color: C.textSoft }}>{advisor.phone}</div>
            </div>
            <OutlineBtn>Call</OutlineBtn>
          </div>
        </div>
      </Card>
    </>
  );
}

// ── Protect ──────────────────────────────────────────────────────────────────
function Protect() {
  const bank = useBank();
  return (
    <>
      <Card style={{ background: `rgba(${C.brandRgb},0.06)`, border: `1px solid rgba(${C.brandRgb},0.18)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: `rgba(${C.brandRgb},0.14)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={24} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>Free 3-month accident cover</div>
            <div style={{ fontSize: 12.5, color: C.textSoft, marginTop: 2 }}>Activate instantly with {bank.name} Insurance.</div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 }}>
          <div style={{ fontSize: 13.5, color: C.textSoft }}>Already insured? Link your policies for one timeline view.</div>
          <FilledBtn>Link</FilledBtn>
        </div>
      </Card>

      <SectionTitle>Coverage you need</SectionTitle>
      <div style={{ fontSize: 12.5, color: C.textSoft, marginTop: -8 }}>Based on your profile · <span style={{ color: C.brand, fontWeight: 600 }}>Edit details</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {coverageNeeds.map((c) => (
          <Card key={c.id}>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                <Icon name="chevron" size={16} color={C.textFaint} />
              </div>
              <div style={{ fontSize: 12, color: C.textSoft, marginTop: 4 }}>Your cover: <b style={{ color: C.text }}>{c.cover}</b></div>
              <div style={{ fontSize: 12, color: C.textSoft, lineHeight: 1.45, marginTop: 6 }}>{c.note}</div>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle>Your policy payouts</SectionTitle>
      <Card>
        <div style={{ padding: 16 }}>
          <Timeline color={C.brand} title="Education endowment" value={`${CURRENCY} 2,000,000`} />
          <div style={{ height: 14 }} />
          <Timeline color="#e0a500" title="Income stream" value={`${CURRENCY} 50,000 / month for 10 years`} />
        </div>
      </Card>
    </>
  );
}

// ── Retire ───────────────────────────────────────────────────────────────────
function Retire() {
  const bank = useBank();
  const r = retirement;
  return (
    <>
      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15 }}>Your retirement goal</span>
            <span style={{ fontSize: 13, color: C.brand, fontWeight: 600 }}>Edit ›</span>
          </div>
          <div style={{ background: `rgba(${C.brandRgb},0.06)`, borderRadius: 12, padding: 14, marginTop: 12, fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>
            You'd like to retire at <b>{r.retireAge}</b> with basic expenses of <b>{money(r.basicExpenses, 0)}</b> and lifestyle expenses of <b>{money(r.lifestyleExpenses, 0)}</b> until age {r.untilAge}.
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Can you achieve it?</div>
          <div style={{ fontSize: 12.5, color: C.textSoft, marginTop: 6 }}>Projected retirement income</div>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 24, color: C.text }}>{money(r.projectedMonthly, 0)} <span style={{ fontSize: 13, fontWeight: 500, color: C.textSoft }}>/ month</span></div>
          <Goal label="Basic expenses" have={r.basicExpenses} need={r.basicExpenses} />
          <Goal label="Lifestyle expenses" have={r.lifestyleExpenses} need={r.lifestyleExpenses} />
        </div>
      </Card>

      <Card style={{ background: `rgba(${C.brandRgb},0.06)`, border: `1px solid rgba(${C.brandRgb},0.18)` }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="wealth" size={18} color={C.brand} /><span style={{ fontWeight: 700, fontSize: 14, color: C.brand }}>Boost your retirement</span></div>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5, margin: '6px 0 12px' }}>Top up your Pension Plan and enjoy tax relief on contributions up to {CURRENCY} 240,000 a year.</div>
          <FilledBtn>Top up pension</FilledBtn>
        </div>
      </Card>

      <SectionTitle>Your income streams</SectionTitle>
      <Card>
        {['Cash savings', 'Pension (RSA)', `${bank.name} Pension Plan`, 'Investments'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="cash" size={18} color={C.brand} /><span style={{ fontSize: 14, fontWeight: 600 }}>{s}</span></span>
            <Icon name="chevronDown" size={18} color={C.textFaint} />
          </div>
        ))}
      </Card>
    </>
  );
}

// ── Money in/out ─────────────────────────────────────────────────────────────
function Cashflow() {
  const max = Math.max(...cashflow.months.flatMap(([, i, o]) => [i, o]));
  return (
    <>
      <div style={{ display: 'flex', gap: 10 }}>
        <SelectPill label="All accounts" />
        <SelectPill label="Jun 2026" />
      </div>

      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, color: C.textSoft }}>Net cashflow</div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 26, color: cashflow.netCashflow < 0 ? C.warn : C.good }}>{cashflow.netCashflow < 0 ? '-' : '+'}{money(Math.abs(cashflow.netCashflow))}</div>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 130, marginTop: 18, padding: '0 4px' }}>
            {cashflow.months.map(([m, inc, out]) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                  <span style={{ width: 9, height: `${(inc / max) * 100}%`, background: C.good, borderRadius: '3px 3px 0 0' }} />
                  <span style={{ width: 9, height: `${(out / max) * 100}%`, background: C.brand, borderRadius: '3px 3px 0 0' }} />
                </div>
                <span style={{ fontSize: 10.5, color: C.textFaint }}>{m}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 12, fontSize: 12 }}>
            <Legend color={C.good} label={`Money in · ${money(cashflow.moneyIn, 0)}`} />
            <Legend color={C.brand} label={`Money out · ${money(cashflow.moneyOut, 0)}`} />
          </div>
        </div>
      </Card>

      <SectionTitle>Latest transactions</SectionTitle>
      <Card>
        {transactions.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: t.amount > 0 ? 'rgba(31,157,87,0.12)' : `rgba(${C.brandRgb},0.08)`, color: t.amount > 0 ? C.good : C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={t.amount > 0 ? 'arrowDown' : 'transfer'} size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{t.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: C.textSoft }}>{t.date} · {t.subtitle}</span>
            </span>
            <Amount value={t.amount} size={14.5} color={t.amount > 0 ? C.good : C.text} />
          </div>
        ))}
      </Card>
    </>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, color: C.text, marginTop: 4 }}>{children}</div>;
}
function OutlineBtn({ children }: { children: ReactNode }) {
  return <button type="button" style={{ background: 'transparent', border: `1.5px solid ${C.borderStrong}`, color: C.text, borderRadius: 999, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{children}</button>;
}
function FilledBtn({ children }: { children: ReactNode }) {
  return <button type="button" style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>{children}</button>;
}
function SelectPill({ label }: { label: string }) {
  return (
    <button type="button" style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 14, color: C.text, fontWeight: 600 }}>
      {label}<Icon name="chevronDown" size={16} color={C.textFaint} />
    </button>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textSoft }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />{label}</span>;
}
function Goal({ label, have, need }: { label: string; have: number; need: number }) {
  const pct = Math.min(100, (have / need) * 100);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textSoft }}>
        <Icon name="check" size={14} color={C.good} /> {label} · {money(have, 0)} / {money(need, 0)}
      </div>
      <div style={{ height: 8, background: 'rgba(24,33,38,0.08)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: C.good, borderRadius: 999 }} />
      </div>
    </div>
  );
}
function Timeline({ color, title, value }: { color: string; title: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ width: 12, height: 12, borderRadius: 999, background: color, marginTop: 3, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.textSoft, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
