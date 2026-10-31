// Alerts — what changed, newest first, grouped by day. Unread items carry a
// navy dot; only the ones that need a person carry buttons.
import { useEffect, useRef, useState } from 'react';
import { useNav, useWorkData } from '../nav';
import { NScreen, NChips, NEmpty, NToast, Glyph } from '../nkit';
import { useNk, C, haptic, MONO } from '../nk';
import { matches, actionable, dayOf, timeOf, readIds, markRead, KIND_LABEL, type AlertFilter, type MAlert, type AlertAction } from '../alertsModel';

const KIND_COLOR: Record<MAlert['kind'], string | null> = {
  needs: C.red, sla: C.orange, ready: C.blue, compliance: null, opened: C.green, system: null,
};

export default function Alerts() {
  const nav = useNav();
  const nk = useNk();
  const { alerts } = useWorkData();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [read, setRead] = useState(readIds);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const on = () => setRead(readIds());
    window.addEventListener('aof-alerts-read', on);
    return () => window.removeEventListener('aof-alerts-read', on);
  }, []);

  const shown = alerts.filter((a) => matches(a, filter));
  const needN = alerts.filter((a) => matches(a, 'needs')).length;
  const groups: { day: string; items: MAlert[] }[] = [];
  for (const a of shown) {
    const d = dayOf(a.at);
    const g = groups[groups.length - 1];
    if (g && g.day === d) g.items.push(a); else groups.push({ day: d, items: [a] });
  }

  const [err, setErr] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = (t: string, bad = false) => { setErr(bad); setToast(t); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), bad ? 4500 : 3200); };
  const act = async (a: MAlert, x: AlertAction) => {
    markRead([a.id]);
    if (x.route) { nav.open(x.route); return; }
    if (!x.run) return;
    setBusy(`${a.id}:${x.label}`);
    try { const said = await x.run(); haptic('success'); flash(said); }
    catch (e) { haptic('warn'); flash((e as Error).message || 'That didn’t work — nothing was changed.', true); }
    finally { setBusy(null); }
  };

  return (
    <NScreen title="Alerts"
      actions={alerts.some((a) => !read.has(a.id)) ? <button type="button" className="nk-link" style={{ color: nk.accent, paddingRight: 10 }} onClick={() => { haptic(); markRead(alerts.map((a) => a.id)); }}>Mark all read</button> : undefined}
      header={<NChips value={filter} onChange={setFilter} options={[
        { id: 'all', label: 'All' },
        { id: 'needs', label: 'Needs you', count: needN || undefined, color: needN ? C.red : undefined },
        { id: 'customers', label: 'Customers' },
        { id: 'system', label: 'System' },
      ]} />}>
      {groups.length ? groups.map((g) => (
        <section key={g.day} className="nk-section">
          <div className="nk-section-h"><h2 style={{ color: nk.ink3 }}>{g.day}</h2></div>
          <div>
            {g.items.map((a) => {
              const unread = !read.has(a.id);
              const col = KIND_COLOR[a.kind];
              const loud = actionable(a) || unread;
              return (
                <article key={a.id} className="mw-alert" style={{ borderColor: nk.sep }}>
                  <button type="button" className="mw-alert-b tap" onClick={() => { haptic(); markRead([a.id]); if (a.route) nav.open(a.route); }}>
                    <span className="mw-alert-k">
                      <span style={{ color: col ?? nk.ink3, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: col ? 600 : 500 }}>
                        {col && <Glyph color={col} />}{KIND_LABEL[a.kind]}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, color: nk.ink3, letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>
                        {timeOf(a.at)}
                        {unread && <span className="mw-alert-dot" role="img" aria-label="Unread" style={{ background: nk.brandFill }} />}
                      </span>
                    </span>
                    <span className="mw-alert-t" style={{ color: loud ? nk.ink : nk.ink2, fontWeight: loud ? 600 : 400 }}>{a.title}</span>
                    {(a.sub || a.ref) && (
                      <span className="mw-alert-s" style={{ color: loud ? nk.ink2 : nk.ink3 }}>
                        {a.sub}{a.sub && a.ref ? ' · ' : ''}{a.ref && <span className="mono" style={{ fontSize: 12 }}>{a.ref}</span>}
                      </span>
                    )}
                  </button>
                  {a.actions && a.actions.length > 0 && (
                    <div className="mw-alert-acts">
                      {a.actions.map((x) => x.href
                        ? <a key={x.label} className="mw-obtn tap" href={x.href} style={{ color: nk.accent, borderColor: nk.line }} onClick={() => markRead([a.id])}>{x.label}</a>
                        : <button key={x.label} type="button" className="mw-obtn tap" disabled={busy === `${a.id}:${x.label}`} style={{ color: nk.accent, borderColor: nk.line, background: nk.page }} onClick={() => { haptic(); void act(a, x); }}>
                            {busy === `${a.id}:${x.label}` ? 'Working…' : x.label}
                          </button>)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )) : <NEmpty title="Nothing new">You'll see failed checks, SLA warnings, batches ready to open and accounts opened here.</NEmpty>}
      <NToast text={toast} tone={err ? 'error' : undefined} />
    </NScreen>
  );
}
