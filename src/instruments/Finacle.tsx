// ─────────────────────────────────────────────────────────────────────────────
// Mock Finacle UI (/finacle) — the core-banking back office.
//
// Every case that reaches "account created" gets a Finacle CIF and account
// number in the shared store. This lists them live: resolve an exception in Ops
// or finish a capture on the desk and the new account materialises here on its
// own — the core-banking end of the Progress-First story.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, fullName, type OnboardingCase } from '../onboarding';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

// A case is in Finacle once it has an account number.
const hasAccount = (c: OnboardingCase) => Boolean(c.accountNumber);
const acctType = (c: OnboardingCase) => (c.channel === 'self' || c.source === 'customer' ? 'Savings' : 'Current');
const isFull = (c: OnboardingCase) => c.state === 'FULLY_ACTIVATED';
const kycLabel = (c: OnboardingCase) =>
  c.state === 'FULLY_ACTIVATED' ? 'Verified'
  : c.state === 'PENDING_LIVENESS' ? 'Liveness outstanding'
  : c.state === 'PENDING_DOCUMENTS' ? 'Documents outstanding'
  : 'In progress';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;
}
function isToday(iso: string): boolean {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function FinacleInner() {
  useBrandVars('Core Banking');
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => { void store.list().then((all) => { if (alive) setCases(all); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  const accounts = useMemo(
    () => cases.filter(hasAccount).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [cases],
  );

  // New accounts (a resolve in Ops, a fresh capture) animate in via a CSS mount
  // animation keyed by id — no JS bookkeeping.
  const open = openId ? accounts.find((c) => c.id === openId) ?? null : null;
  const stats = {
    cifs: accounts.length,
    active: accounts.filter(isFull).length,
    limited: accounts.filter((c) => !isFull(c)).length,
    today: accounts.filter((c) => isToday(c.createdAt)).length,
  };

  return (
    <div className="inst">
      <TopBar system="Finacle · Core Banking" sub="Core banking" />
      <div className={`fn${open ? ' open' : ''}`}>
        <div className="fn-main">
          <div className="fn-strip">
            <div className="fn-stat"><div className="k">CIFs</div><div className="v num">{stats.cifs}</div></div>
            <div className="fn-stat"><div className="k">Active accounts</div><div className="v num" style={{ color: 'var(--i-good-ink)' }}>{stats.active}</div></div>
            <div className="fn-stat"><div className="k">Limited (KYC pending)</div><div className="v num" style={{ color: stats.limited ? 'var(--i-warn-ink)' : undefined }}>{stats.limited}</div></div>
            <div className="fn-stat"><div className="k">Opened today</div><div className="v num">{stats.today}</div></div>
          </div>

          <div className="fn-body">
            <div className="fn-h"><h1>Accounts</h1><span className="n">{accounts.length}</span></div>
            {accounts.length === 0 ? (
              <div className="fn-empty"><b>No accounts yet</b><span>Open an account on the desk or in the customer app and the CIF appears here.</span></div>
            ) : (
              <div className="fn-rows">
                <div className="fn-cols"><span>CIF</span><span>Customer</span><span>Account no.</span><span>Type</span><span>Status</span><span /></div>
                {accounts.map((c) => (
                  <button key={c.id} className="fn-row" aria-current={openId === c.id} onClick={() => setOpenId(c.id)}>
                    <span className="cif">{c.cif}</span>
                    <span className="nm">{fullName(c).trim() || 'Unnamed'}</span>
                    <span className="acct">{c.accountNumber}</span>
                    <span style={{ fontSize: 13 }}>{acctType(c)}</span>
                    <span>{isFull(c)
                      ? <span className="fn-tag active"><i style={{ background: 'var(--i-good)' }} />Active</span>
                      : <span className="fn-tag limited"><i style={{ background: 'var(--i-warn)' }} />Limited</span>}</span>
                    <span style={{ color: 'var(--i-ink-4)' }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {open && (
          <aside className="fn-detail">
            <div className="dh">
              <div>
                <b>{fullName(open).trim() || 'Unnamed'}</b>
                <div><span>{open.cif}</span></div>
              </div>
              <button className="x" onClick={() => setOpenId(null)} aria-label="Close">✕</button>
            </div>

            <div className="acctcard">
              <div className="k">{acctType(open)} account</div>
              <div className="v num">{open.accountNumber}</div>
              <div className="sub">Opening balance ₦0.00 · {isFull(open) ? 'Active' : 'Active, limited until KYC'}</div>
            </div>

            <div className="eyebrow">Customer</div>
            <dl>
              <div><dt>BVN</dt><dd className="mono">{open.bvn || '—'}</dd></div>
              <div><dt>NIN</dt><dd className="mono">{open.nin || '—'}</dd></div>
              <div><dt>Phone</dt><dd>{open.phone || '—'}</dd></div>
              <div><dt>Email</dt><dd>{open.email || '—'}</dd></div>
              <div><dt>Address</dt><dd>{open.address || '—'}</dd></div>
            </dl>

            <div className="eyebrow">Account</div>
            <dl>
              <div><dt>Opened</dt><dd>{fmtDate(open.createdAt)}</dd></div>
              <div><dt>Channel</dt><dd style={{ textTransform: 'capitalize' }}>{open.channel}{open.source ? ` · ${open.source}` : ''}</dd></div>
              <div><dt>KYC</dt><dd>{kycLabel(open)}</dd></div>
              <div><dt>Tier</dt><dd>{isFull(open) ? 'Tier 3 · full' : 'Tier 1 · limited'}</dd></div>
            </dl>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function FinacleConsole() {
  return <InstrumentProvider><FinacleInner /></InstrumentProvider>;
}
