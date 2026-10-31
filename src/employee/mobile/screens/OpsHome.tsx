// ─────────────────────────────────────────────────────────────────────────────
// Operations — the analyst's phone. Clear the cause, not the cases.
//
//   Health      — one ring: how much of the book goes straight through, against
//                 target, with the three numbers that say why not.
//   Incidents   — exceptions grouped by root cause. Each carries its one fix for
//                 every case in it ("Retry NIN on all 8"), confirmed by a slide.
//   The queue   — the oldest few, then the whole queue a swipe at a time.
// Rules and decision tables are authored on a laptop; they open from here in
// the full console.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useOwners } from '../useOwners';
import { useConfig, defaultConfig } from '../../../config';
import { slaOf } from '../../../ops/derive';
import { incidentsOf, opsHealth, isOpsCase, ageMin, runIncident, CAUSES, deriveCause, assignee, type Incident, type IncidentRun } from '../../../ops/opsModel';
import { useNav, useWorkData } from '../nav';
import { name } from '../story';
import { NScreen, NSection, NGroup, NRow, NAvatar, NButton, NSheet, NSlide, NStatus, NEmpty, NToast, NBig, Glyph } from '../nkit';
import { BankMark, AuraHero } from '../parts';
import { useNk, C, haptic, today, HERO_TINT } from '../nk';


export default function OpsHome() {
  const nav = useNav();
  const nk = useNk();
  const cfg = useConfig();
  const { all } = useWorkData();
  useOwners();
  const target = (cfg.operations ?? defaultConfig.operations!).stpTarget;
  const h = useMemo(() => opsHealth(all, target), [all, target]);
  const incidents = useMemo(() => incidentsOf(all), [all]);
  const oldest = useMemo(() => all.filter(isOpsCase).sort((a, b) => ageMin(b) - ageMin(a)).slice(0, 4), [all]);
  const [bulk, setBulk] = useState<Incident | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const top = incidents.find((i) => i.meta.bulk && i.cases.length > 1) ?? incidents.find((i) => i.meta.bulk);
  // The straight-through scale runs 50–100%; the target and today's rate sit on it.
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - 50) / 50) * 100))}%`;

  return (
    <NScreen title="Exception triage" eyebrow={`Operations · ${today()}`} lead={<BankMark />}
      hero={<AuraHero name={nav.userName && nav.userName !== 'User' ? nav.userName.split(' ')[0] : undefined} onAsk={nav.askAura} onScan={() => nav.push({ k: 'capture' })} onExplore={() => nav.setTab('explore')} compact />}
      tint={nk.dark ? HERO_TINT.dark : HERO_TINT.light}
      actions={<button type="button" className="mw-me tap" onClick={() => { haptic(); if (nav.canSwitchRole) nav.openRoleSheet(); else nav.setTab('profile'); }} aria-label={nav.canSwitchRole ? 'Switch role' : 'Your profile'}><NAvatar name={nav.userName || 'Operations'} size={32} solid /></button>}
      footer={top ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: nk.ink2 }}>
            <span>Biggest cause · <span style={{ color: nk.ink, fontWeight: 500 }}>{top.meta.title}</span></span>
            {top.breaching > 0 && <span className="mono" style={{ color: C.red, flex: '0 0 auto' }}>{top.breaching} past SLA</span>}
          </div>
          <NButton icon="refresh" onClick={() => setBulk(top)}>{top.meta.bulk!.label.replace(/ on all$/, '')} on all {top.cases.length}</NButton>
        </>
      ) : undefined}>
      <section aria-label="Straight-through rate" className="nk-section">
        <div className="mw-keyline">
          <NBig>{h.stp}<small>%</small></NBig>
          <span className="mw-keyline-r" style={{ alignItems: 'flex-end', color: nk.ink2 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: nk.ink }}>Straight-through</span>
            <span style={{ fontSize: 13 }}>target <span className="mono">{h.target}%</span></span>
            <span className="mono" style={{ fontSize: 13, color: h.stp >= h.target ? C.green : C.red }}>{h.stp >= h.target ? '+' : ''}{h.stp - h.target} pts</span>
          </span>
        </div>
        <div className="mw-scale" aria-hidden>
          <span className="mw-scale-line" style={{ background: nk.sep }} />
          <span className="mw-scale-fill" style={{ width: pos(h.stp), background: nk.brandFill }} />
          {[50, 60, 70, 80, 90, 100].map((v) => <span key={v} className="mw-scale-tick" style={{ left: pos(v), background: v <= h.stp ? nk.brandFill : nk.ink3 }} />)}
          <span className="mw-scale-target" style={{ left: pos(h.target), background: nk.ink }} />
          <span className="mw-scale-now" style={{ left: pos(h.stp), background: nk.brandFill }} />
          <span className="mw-scale-lab" style={{ left: 0, color: nk.ink3 }}>50</span>
          <span className="mw-scale-lab" style={{ left: pos(h.target), transform: 'translateX(-50%)', color: nk.ink }}>target</span>
          <span className="mw-scale-lab" style={{ right: 0, color: nk.ink3 }}>100</span>
        </div>
      </section>

      <div className="mw-trio">
        {([
          ['Open exceptions', h.open, null, () => nav.push({ k: 'opsQueue' })],
          ['Past SLA', h.breaching, C.red, () => nav.push({ k: 'opsQueue', cause: 'sla' })],
          ['Unassigned', h.unassigned, null, () => nav.push({ k: 'opsQueue', cause: 'unassigned' })],
        ] as const).map(([l, n, col, go]) => (
          <button key={l} type="button" className="mw-stat tap" onClick={() => { haptic(); go(); }}>
            <b style={{ color: col ?? nk.ink }}>{n}</b>
            <span style={{ color: col ?? nk.ink2, fontWeight: col ? 500 : 400 }}>{col && <Glyph color={col} />}{l}</span>
          </button>
        ))}
      </div>

      <NSection title="By root cause" aside="One fix per cause">
        {incidents.length ? (
          <div className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
            {incidents.map((inc) => (
              <div key={inc.cause} className="mw-inc" style={{ borderColor: nk.sep }}>
                <div className="mw-inc-top">
                  <span className="mw-inc-t">{inc.meta.title}</span>
                  <span className="mono" style={{ fontSize: 13 }}>{inc.cases.length} case{inc.cases.length === 1 ? '' : 's'}</span>
                </div>
                {inc.breaching > 0 && <div style={{ marginTop: 2, fontSize: 13, color: C.red, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><Glyph color={C.red} />{inc.breaching} past SLA</div>}
                <p className="mw-inc-d" style={{ color: nk.ink2 }}>{inc.meta.detail}</p>
                <div className="mw-inc-acts">
                  {inc.cases.length === 1
                    ? <button type="button" className="mw-textbtn tap" style={{ color: nk.accent }} onClick={() => { haptic(); nav.push({ k: 'opsCase', id: inc.cases[0].id }); }}>Open the case<Arrow /></button>
                    : <>
                        {inc.meta.bulk && inc !== top && <button type="button" className="mw-textbtn tap" style={{ color: nk.accent }} onClick={() => { haptic(); setBulk(inc); }}>{inc.meta.bulk.label.replace(/ on all$/, '')} on all {inc.cases.length}<Arrow /></button>}
                        <button type="button" className="mw-textbtn tap" style={{ color: nk.accent }} onClick={() => { haptic(); nav.push({ k: 'opsQueue', cause: inc.cause }); }}>See the {inc.cases.length}<Arrow /></button>
                      </>}
                </div>
              </div>
            ))}
          </div>
        ) : <NEmpty title="No incidents">Nothing has stopped for a person.</NEmpty>}
      </NSection>

      {oldest.length > 0 && (
        <NSection title="Waiting longest" action={{ label: 'Queue', onClick: () => nav.push({ k: 'opsQueue' }) }}>
          <NGroup>
            {oldest.map((c) => {
              const sla = slaOf(c);
              return (
                <NRow key={c.uid ?? c.id} title={name(c)}
                  subtitle={`${CAUSES[deriveCause(c)].title} · ${assignee(c) ? `with ${assignee(c)}` : 'unassigned'}`}
                  value={<span className="mono" style={{ fontSize: 13, color: sla.tone === 'breach' ? C.red : sla.tone === 'warn' ? C.orange : nk.ink2 }}>{sla.label}</span>}
                  onClick={() => nav.push({ k: 'opsCase', id: c.id })} />
              );
            })}
          </NGroup>
        </NSection>
      )}

      <NSection title="On a laptop">
        <NGroup>
          <NRow icon={{ name: 'filter', color: nk.accent }} title="Rules and decision tables" subtitle="Author and promote rules in the full console" onClick={() => window.open(`${import.meta.env.BASE_URL ?? '/'}ops`.replace('//', '/'), '_blank', 'noreferrer')} />
        </NGroup>
      </NSection>

      {bulk && <BulkSheet inc={bulk} onClose={() => setBulk(null)} onDone={(msg) => { setBulk(null); setToast(msg); window.setTimeout(() => setToast(null), 3200); }} />}
      <NToast text={toast} />
    </NScreen>
  );
}

function Arrow() {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BulkSheet({ inc, onClose, onDone }: { inc: Incident; onClose: () => void; onDone: (msg: string) => void }) {
  const nk = useNk();
  const [n, setN] = useState(0);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<IncidentRun | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setRunning(true);
    try {
      const r = await runIncident(inc, (k) => setN(k));
      setRun(r);
      haptic(r.failed ? 'warn' : 'success');
      if (!r.failed && !r.skipped) onDone(`${r.done} case${r.done === 1 ? '' : 's'} re-run — each moves on if its check passes`);
    } catch (e) {
      setErr((e as Error).message || 'The bulk fix stopped.');
    } finally { setRunning(false); }
  };
  const resultOf = (id: string) => run?.results.find((x) => x.id === id);
  return (
    <NSheet title={inc.meta.bulk?.label ?? 'Fix all'} subtitle={`${inc.cases.length} case${inc.cases.length === 1 ? '' : 's'} · ${inc.meta.title}`} onClose={() => !running && onClose()}
      footer={running
        ? <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: nk.ink }}>Working… {n} of {inc.cases.length}</div>
        : run || err
          ? <NButton onClick={() => (run && !run.failed && !run.skipped ? onDone(`${run.done} done`) : onClose())}>Done</NButton>
          : <NSlide label={`Slide to run on all ${inc.cases.length}`} onConfirm={() => void go()} />}>
      <div style={{ fontSize: 14, color: nk.ink2, lineHeight: 1.45 }}>
        {inc.meta.detail} Each case is written back to the shared record. A re-run passes only the check it re-runs — the account opens later, in the normal way.
      </div>
      {run && (
        <div style={{ fontSize: 15, color: nk.ink }}>
          <span className="mono">{run.done}</span> done · <span className="mono">{run.skipped}</span> skipped · <span className="mono" style={{ color: run.failed ? C.red : undefined }}>{run.failed}</span> failed
        </div>
      )}
      {err && <div style={{ fontSize: 14, color: C.red }}>{err}</div>}
      <NGroup>
        {inc.cases.slice(0, 8).map((c, i) => {
          const r = resultOf(c.id);
          return (
            <NRow key={c.id} title={name(c)} subtitle={r?.message ?? c.id}
              value={r ? <NStatus color={r.result === 'done' ? C.green : r.result === 'failed' ? C.red : C.gray}>{r.result === 'done' ? 'Done' : r.result === 'failed' ? 'Failed' : 'Skipped'}</NStatus>
                : running ? (i < n ? <NStatus color={C.green}>Done</NStatus> : <NStatus color={C.gray}>Queued</NStatus>) : undefined} />
          );
        })}
        {inc.cases.length > 8 && <NRow title={`+ ${inc.cases.length - 8} more`} />}
      </NGroup>
    </NSheet>
  );
}
