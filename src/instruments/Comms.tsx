// ─────────────────────────────────────────────────────────────────────────────
// Customer Comms console (/comms) — the notification service, visualised.
//
// Every step of the journey sends the customer an SMS or email. This reads the
// shared store live and derives each customer's message thread from their
// lifecycle: application received → account opened → KYC link → reminder →
// welcome. Open an account on the desk or resolve one in Ops and watch the new
// messages land here — the customer-facing end of the Progress-First story.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { store, fullName, commsFor, CHANNEL_META, MSG_CHANNELS, type OnboardingCase, type MsgChannel } from '../onboarding';
import { ChannelIcon } from '../onboarding/ChannelIcon';
import { InstrumentProvider, TopBar } from './shell';
import { useBrandVars } from './brand';

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function isToday(iso: string): boolean {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function CommsInner() {
  useBrandVars('Customer Comms');
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [chFilter, setChFilter] = useState<'all' | MsgChannel>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    const refresh = () => { void store.list().then((all) => { if (alive) setCases(all); }); };
    refresh();
    const un = store.subscribe(refresh);
    return () => { alive = false; un(); };
  }, []);

  // One thread per customer, newest activity first.
  const threads = useMemo(() => {
    const t = cases
      .map((c) => ({ c, msgs: commsFor(c) }))
      .filter((x) => x.msgs.length > 0);
    const withCh = chFilter === 'all' ? t : t.filter((x) => x.msgs.some((m) => m.channel === chFilter));
    const term = q.trim().toLowerCase();
    const searched = term
      ? withCh.filter((x) => x.c && (fullName(x.c).toLowerCase().includes(term) || x.c.id.toLowerCase().includes(term) || (x.c.phone || '').includes(term)))
      : withCh;
    return searched.sort((a, b) => {
      const la = a.msgs[a.msgs.length - 1].at, lb = b.msgs[b.msgs.length - 1].at;
      return la < lb ? 1 : la > lb ? -1 : 0;
    });
  }, [cases, chFilter, q]);

  const allMsgs = useMemo(() => threads.flatMap((t) => t.msgs), [threads]);
  const stats = {
    today: allMsgs.filter((m) => isToday(m.at)).length,
    delivered: allMsgs.length ? Math.round((allMsgs.filter((m) => m.delivery === 'delivered').length / allMsgs.length) * 100) : 100,
    sms: allMsgs.filter((m) => m.channel === 'sms').length,
    whatsapp: allMsgs.filter((m) => m.channel === 'whatsapp').length,
    email: allMsgs.filter((m) => m.channel === 'email').length,
  };

  const open = openId ? threads.find((t) => t.c.id === openId) ?? null : null;

  return (
    <div className="inst">
      <TopBar system="Notification Service" sub="Customer comms" />
      <div className={`fn${open ? ' open' : ''}`}>
        <div className="fn-main">
          <div className="fn-strip">
            <div className="fn-stat"><div className="k">Sent today</div><div className="v num">{stats.today}</div></div>
            <div className="fn-stat"><div className="k">Delivered</div><div className="v num" style={{ color: 'var(--i-good-ink)' }}>{stats.delivered}%</div></div>
            <div className="fn-stat"><div className="k">SMS</div><div className="v num">{stats.sms}</div></div>
            <div className="fn-stat"><div className="k">WhatsApp</div><div className="v num" style={{ color: '#1da851' }}>{stats.whatsapp}</div></div>
            <div className="fn-stat"><div className="k">Email</div><div className="v num">{stats.email}</div></div>
          </div>

          <div className="fn-body">
            <div className="cm-tools">
              <div className="fn-h" style={{ padding: 0 }}><h1>Conversations</h1><span className="n">{threads.length}</span></div>
              <div className="cm-find">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ref or number" />
              </div>
              <div className="cm-segs">
                <button aria-pressed={chFilter === 'all'} onClick={() => setChFilter('all')}>All</button>
                {MSG_CHANNELS.map((k) => (
                  <button key={k} className={`ch-${k}`} aria-pressed={chFilter === k} onClick={() => setChFilter(k)}>
                    <ChannelIcon ch={k} size={13} />{CHANNEL_META[k].label}
                  </button>
                ))}
              </div>
            </div>

            {threads.length === 0 ? (
              <div className="fn-empty"><b>No messages yet</b><span>Open an account on the desk or in the customer app and the SMS and emails appear here.</span></div>
            ) : (
              <div className="cm-list">
                {threads.map(({ c, msgs }) => {
                  const last = msgs[msgs.length - 1];
                  return (
                    <button key={c.id} className="cm-conv" aria-current={openId === c.id} onClick={() => setOpenId(c.id)}>
                      <span className={`cm-ava ${last.channel}`}><ChannelIcon ch={last.channel} size={16} /></span>
                      <span className="cm-cmid">
                        <span className="cm-nm">{fullName(c).trim() || 'Unnamed'}</span>
                        <span className="cm-prev">{last.body}</span>
                      </span>
                      <span className="cm-meta">
                        <span className="cm-at num">{ago(last.at)}</span>
                        <span className="cm-count">{msgs.length}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {open && (
          <aside className="fn-detail cm-detail">
            <div className="dh">
              <div>
                <b>{fullName(open.c).trim() || 'Unnamed'}</b>
                <div><span className="num">{open.c.phone || open.c.email || open.c.id}</span></div>
              </div>
              <button className="x" onClick={() => setOpenId(null)} aria-label="Close">✕</button>
            </div>

            <div className="cm-thread">
              {open.msgs.map((m) => (
                <div key={m.id} className={`cm-msg ${m.channel}`}>
                  <div className="cm-msg-h">
                    <span className="cm-chip"><ChannelIcon ch={m.channel} />{CHANNEL_META[m.channel].label}</span>
                    <span className="cm-label">{m.label}</span>
                    <span className="cm-time num">{clock(m.at)}</span>
                  </div>
                  <div className="cm-bubble">{m.body}</div>
                  <div className="cm-status">
                    <span className="cm-to num">to {m.to}</span>
                    <span className={`cm-del ${m.delivery}`}>{m.delivery === 'delivered' ? '✓✓ Delivered' : '✓ Sent'}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function CommsConsole() {
  return <InstrumentProvider><CommsInner /></InstrumentProvider>;
}
