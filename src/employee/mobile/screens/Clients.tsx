// ─────────────────────────────────────────────────────────────────────────────
// Clients — the banker's key relationships, on the phone.
//
//   1. The book at a glance: relationships, at risk, suggested actions, KYC due
//      — a ruled strip of four; tap one to filter the list to it.
//   2. Find someone by name, or scan a walk-in's ID to pull them up.
//   3. One row per relationship: segment, what they hold with us, and the one
//      signal that matters most right now.
//   4. A sheet for one client: the relationship, the suggested actions (the top
//      one in navy), products with balances, signals, cases and notes.
//
// Sample data (customersData.ts), held in memory like the screen it replaces:
// an action is "sent for approval" (maker–checker) and a dismissed one goes.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from 'react';
import { customers, money, LOCALE, type Customer, type NBA, type Risk, type Tone } from '../../../customersData';
import ScanId from '../../../components/ScanId';
import { NScreen, NSection, NGroup, NRow, NChips, NSearchField, NSheet, NButton, NToast, NEmpty, NStatus, Glyph } from '../nkit';
import { useNk, C, haptic } from '../nk';
import '../mobile.css';

type Filter = 'all' | 'value' | 'risk' | 'maturing' | 'kyc';
/** Relationships at or above this are "high value". */
const HIGH_VALUE = 100_000_000;

/** ₦742m · ₦2.1bn · ₦45,000 — short enough for a row. */
function compactMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const one = (v: number, unit: string) =>
    `${sign}${LOCALE.symbol}${v.toLocaleString(LOCALE.numberLocale, { maximumFractionDigits: 1 })}${unit}`;
  if (a >= 1e9) return one(Math.round((a / 1e9) * 10) / 10, 'bn');
  if (a >= 1e6) return one(Math.round((a / 1e6) * 10) / 10, 'm');
  return `${sign}${LOCALE.symbol}${Math.round(a).toLocaleString(LOCALE.numberLocale)}`;
}

const riskTone = (r: Risk) => (r === 'High' ? C.red : r === 'Medium' ? C.orange : undefined);
const toneColor = (t: Tone) => (t === 'warn' ? C.red : t === 'good' ? C.green : C.blue);
const atRisk = (c: Customer) => c.headlineTone === 'warn';
const maturing = (c: Customer) => c.products.some((p) => /matur/i.test(p.status ?? '')) || /matur/i.test(c.headline);
const kycDue = (c: Customer) => c.kyc !== 'Verified';

/** The one signal that matters most, as a mark and a word. */
function topSignal(c: Customer): { color: string; word: string } {
  if (c.headlineTone === 'warn') return { color: C.red, word: 'At risk' };
  if (maturing(c)) return { color: C.blue, word: 'Maturing' };
  if (c.headlineTone === 'good') return { color: C.green, word: 'Opportunity' };
  return { color: C.blue, word: 'Watch' };
}

type Handled = Record<string, string>; // `${customer}:${nba}` → the action taken ('Dismiss' removes it)
const key = (c: Customer, n: NBA) => `${c.id}:${n.id}`;

function KV({ rows }: { rows: [string, ReactNode, boolean?][] }) {
  const nk = useNk();
  return (
    <NGroup>
      {rows.map(([k, v, mono]) => (
        <div key={k} className="mw-kv" style={{ borderColor: nk.sep }}>
          <span style={{ color: nk.ink2 }}>{k}</span>
          <b className={mono ? 'mono' : undefined} style={{ color: nk.ink }}>{v}</b>
        </div>
      ))}
    </NGroup>
  );
}

export default function Clients({ onClose }: { onClose: () => void }) {
  const nk = useNk();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [handled, setHandled] = useState<Handled>({});
  const [toast, setToast] = useState<string | null>(null);

  const pendingNbas = (c: Customer) => c.nbas.filter((n) => !handled[key(c, n)]);
  const stats = {
    relationships: customers.length,
    risk: customers.filter(atRisk).length,
    actions: customers.reduce((s, c) => s + pendingNbas(c).length, 0),
    kyc: customers.filter(kycDue).length,
  };
  const counts: Record<Filter, number> = {
    all: customers.length,
    value: customers.filter((c) => c.relationshipValue >= HIGH_VALUE).length,
    risk: stats.risk,
    maturing: customers.filter(maturing).length,
    kyc: stats.kyc,
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) =>
      (filter === 'value' ? c.relationshipValue >= HIGH_VALUE
        : filter === 'risk' ? atRisk(c)
          : filter === 'maturing' ? maturing(c)
            : filter === 'kyc' ? kycDue(c) : true)
      && (!q || c.name.toLowerCase().includes(q)));
  }, [filter, query]);

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2200); };
  const act = (c: Customer, n: NBA, label: string) => {
    setHandled((h) => ({ ...h, [key(c, n)]: label }));
    if (label === 'Dismiss') { haptic(); flash('Suggestion dismissed'); return; }
    haptic('success');
    flash(`${label} — sent for approval`);
  };

  const open = customers.find((c) => c.id === openId) ?? null;

  const stat = (label: string, n: number, color: string | null, f: Filter | null, first?: boolean) => {
    const cell = { padding: first ? '10px 8px 10px 0' : '10px 8px 10px 10px', borderLeft: first ? 'none' : `1px solid ${nk.sep}`, minWidth: 0 };
    const inner = (
      <>
        <b style={{ color: color ?? nk.ink }}>{n}</b>
        <span style={{ color: color ?? nk.ink2, fontWeight: color ? 500 : 400, lineHeight: 1.3 }}>{color && <Glyph color={color} />}{label}</span>
      </>
    );
    return f
      ? <button key={label} type="button" className="mw-stat tap" aria-pressed={filter === f} style={{ ...cell, minHeight: 44 }}
          onClick={() => { haptic(); setFilter(f); }}>{inner}</button>
      : <div key={label} className="mw-stat" style={cell}>{inner}</div>;
  };

  return (
    <>
      <NScreen title="Clients" eyebrow="Key relationships" onBack={onClose}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderTop: `1px solid ${nk.sep}`, borderBottom: `1px solid ${nk.sep}` }}>
          {stat('Relationships', stats.relationships, null, 'all', true)}
          {stat('At risk', stats.risk, stats.risk ? C.red : null, 'risk')}
          {stat('Suggested actions', stats.actions, null, null)}
          {stat('KYC due', stats.kyc, stats.kyc ? C.orange : null, 'kyc')}
        </div>

        <NGroup>
          <NRow icon={{ name: 'idcard', color: nk.accent }} title="Scan customer ID"
            subtitle="A walk-in? Scan their ID to pull up their profile." onClick={() => setScanning(true)} />
        </NGroup>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NSearchField value={query} onChange={setQuery} placeholder="Search clients" />
          <NChips value={filter} onChange={setFilter} options={[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'value', label: 'High value', count: counts.value },
            { id: 'risk', label: 'At risk', count: counts.risk, color: counts.risk ? C.red : undefined },
            { id: 'maturing', label: 'Maturing', count: counts.maturing },
            { id: 'kyc', label: 'KYC due', count: counts.kyc, color: counts.kyc ? C.orange : undefined },
          ]} />
        </div>

        <NSection title="Relationships" aside={<span className="mono">{list.length} of {customers.length}</span>}>
          {list.length ? (
            <NGroup>
              {list.map((c) => {
                const sig = topSignal(c);
                const n = pendingNbas(c).length;
                return (
                  <NRow key={c.id} title={c.name} tone={riskTone(c.risk)}
                    subtitle={<>{c.segment} · <span className="mono" style={{ color: nk.ink }}>{compactMoney(c.relationshipValue)}</span> · {c.products.length} product{c.products.length === 1 ? '' : 's'}</>}
                    value={<NStatus color={sig.color}>{sig.word}</NStatus>}
                    onClick={() => setOpenId(c.id)}>
                    <span style={{ fontSize: 13, color: nk.ink3 }}>
                      {c.headline}{n > 0 && <> · <span className="mono">{n}</span> suggested</>}
                    </span>
                  </NRow>
                );
              })}
            </NGroup>
          ) : (
            <NEmpty icon="search" color={C.gray} title="No clients match"
              action={<NButton kind="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Clear search and filter</NButton>}>
              Try another name, or show everyone.
            </NEmpty>
          )}
        </NSection>

        {/* While the sheet is up the toast rides on it (the sheet sits above this screen). */}
        {!open && <NToast text={toast} />}
      </NScreen>

      {scanning && (
        <div className="mw-full">
          <ScanId onBack={() => setScanning(false)} onMatched={(c) => { setScanning(false); setOpenId(c.id); }} />
        </div>
      )}
      {open && <ClientSheet c={open} handled={handled} toast={toast} onAct={act} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ClientSheet({ c, handled, toast, onAct, onClose }: { c: Customer; handled: Handled; toast: string | null; onAct: (c: Customer, n: NBA, label: string) => void; onClose: () => void }) {
  const nk = useNk();
  const pending = c.nbas.filter((n) => !handled[key(c, n)]);
  const sent = c.nbas.filter((n) => handled[key(c, n)] && handled[key(c, n)] !== 'Dismiss');
  const verified = c.kyc === 'Verified';

  return (
    <NSheet title={c.name} subtitle={`${c.segment} · customer since ${c.since} · RM ${c.rm}`} onClose={onClose}>
      <div className="mw-hero">
        <span className="mw-hero-n mono" style={{ color: nk.ink }}>{compactMoney(c.relationshipValue)}</span>
        <span className="mw-hero-r" style={{ color: nk.ink2 }}>Relationship value · <span className="mono">{c.products.length}</span> product{c.products.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        <NStatus color={c.risk === 'Low' ? C.green : riskTone(c.risk) ?? C.gray}>{c.risk} risk</NStatus>
        <NStatus color={verified ? C.green : C.orange}>KYC {verified ? 'verified' : c.kyc.toLowerCase()}</NStatus>
      </div>

      <NSection title="Relationship" footer="This view is logged. Personal details are masked.">
        <KV rows={[
          ['Relationship value', money(c.relationshipValue), true],
          ['Monthly profit', money(c.monthlyProfit), true],
          ['Lifetime value', money(c.clv), true],
          ['Customer ID', c.maskedId, true],
          ['Phone', c.phone, true],
          ['Email', c.email],
          ['Relationship manager', c.rm],
        ]} />
      </NSection>

      <NSection title="Suggested actions" aside={pending.length ? <span className="mono">{pending.length} open</span> : undefined}>
        {pending.length || sent.length ? (
          <div className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
            {pending.map((n, i) => {
              const [lead, ...others] = n.actions.filter((x) => x !== 'Dismiss');
              const canDismiss = n.actions.includes('Dismiss');
              return (
                <div key={n.id} style={{ borderTop: `1px solid ${nk.sep}`, padding: '12px 0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, fontWeight: 500, color: nk.ink, lineHeight: 1.3 }}>
                      {n.kind === 'risk' && <Glyph color={C.red} />}{n.title}
                    </span>
                    <span className="mono" style={{ fontSize: 13, color: nk.ink3, flex: '0 0 auto' }} aria-label={`${n.confidence} percent confidence`}>{n.confidence}%</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.45, color: nk.ink2 }}>{n.rationale}</p>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 500, color: n.kind === 'risk' ? C.red : nk.ink }}>{n.value}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    {lead && (i === 0
                      ? <NButton small full={false} onClick={() => onAct(c, n, lead)}>{lead}</NButton>
                      : <button type="button" className="mw-obtn tap" style={{ color: nk.accent, borderColor: nk.line, background: nk.page }} onClick={() => { haptic(); onAct(c, n, lead); }}>{lead}</button>)}
                    {others.map((x) => (
                      <button key={x} type="button" className="mw-obtn tap" style={{ color: nk.accent, borderColor: nk.line, background: nk.page }} onClick={() => { haptic(); onAct(c, n, x); }}>{x}</button>
                    ))}
                    {canDismiss && (
                      <button type="button" className="mw-textbtn tap" style={{ color: nk.ink2, fontWeight: 500, padding: '0 6px' }} onClick={() => onAct(c, n, 'Dismiss')}>Dismiss</button>
                    )}
                  </div>
                </div>
              );
            })}
            {sent.map((n) => (
              <NRow key={n.id} title={n.title} chevron={false}
                subtitle={`${handled[key(c, n)]} — waiting on a second approver`}
                value={<NStatus color={C.orange}>Sent</NStatus>} />
            ))}
          </div>
        ) : (
          <NEmpty title="Nothing suggested">Every suggestion for this client has been actioned or dismissed.</NEmpty>
        )}
      </NSection>

      <NSection title="Products">
        <NGroup>
          {c.products.map((p) => (
            <NRow key={p.name} title={p.name} subtitle={p.status} chevron={false}
              value={<span className="mono" style={{ fontSize: 15, color: nk.ink }}>{compactMoney(p.balance)}</span>} />
          ))}
        </NGroup>
      </NSection>

      <NSection title="Signals">
        <NGroup>
          {c.signals.map((s) => (
            <NRow key={s.text} title={s.text} tone={toneColor(s.tone)} chevron={false}
              value={<span style={{ fontSize: 13, color: nk.ink3 }}>{s.when}</span>} />
          ))}
        </NGroup>
      </NSection>

      {(c.cases.length > 0 || c.notes.length > 0) && (
        <NSection title="Cases & notes">
          <NGroup>
            {c.cases.map((k) => (
              <NRow key={k.ref} title={k.title} chevron={false}
                subtitle={<span className="mono" style={{ fontSize: 13 }}>{k.ref}</span>}
                value={<NStatus color={k.status === 'Open' ? C.orange : C.green}>{k.status}</NStatus>} />
            ))}
            {c.notes.map((t) => <NRow key={t} icon={{ name: 'note', color: nk.ink2 }} title={t} chevron={false} />)}
          </NGroup>
        </NSection>
      )}

      <p className="mw-hint" style={{ color: nk.ink3 }}>Actions need a second person’s approval (maker–checker). Every view and action is audit-logged.</p>
      <NToast text={toast} />
    </NSheet>
  );
}
