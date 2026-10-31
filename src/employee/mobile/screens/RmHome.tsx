// ─────────────────────────────────────────────────────────────────────────────
// Today — the Relationship Manager's home.
//
// Built for a banker with a phone in one hand and a customer in front of them:
//   1. The month in one number — how many need you — and the rest of the
//      pipeline as a legend and a single bar, in plain words.
//   2. Needs you, oldest first — each row carries its own fix ("Retry BVN"), so
//      most of the day's interventions happen without opening anything.
//   3. Starting a customer — the most frequent job — docked in thumb reach.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { approvalsPulse } from '../../../approvalsData';
import { branchPulse } from '../../../customersData';
import { getLinkedInstance } from '../../../onboarding/maestro';
import { nextBestActions } from '../../nba';
import type { OnboardingCase } from '../../../onboarding';
import { Icn } from '../../../components/customerUi';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NNavButton, NAvatar, NBig, NToast, NEmpty, Glyph } from '../nkit';
import { useNk, C, greeting, today, haptic, MONO, HERO_TINT } from '../nk';
import { storyOf, name, type Lane } from '../story';
import { roleInfo } from '../role';
import { ago } from '../../time';
import { BankMark, FixRow, LegendRow, LaneBar, AuraHero, RecentlyActive } from '../parts';

const dayAge = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d < 1 ? ago(iso).replace(' ago', '') : `${d} day${d === 1 ? '' : 's'}`;
};

export default function RmHome() {
  const nav = useNav();
  const nk = useNk();
  const { branch, batches, batched } = useWorkData();
  const [toast, setToast] = useState<string | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const first = (nav.userName || '').split(/\s+/)[0];
  const who = first && first !== 'User' ? first : '';

  const lanes = useMemo(() => {
    const by: Record<Lane, OnboardingCase[]> = { you: [], customer: [], moving: [], done: [], closed: [] };
    for (const c of branch) by[storyOf(c).lane].push(c);
    // The oldest problem first — it has waited longest.
    by.you.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return by;
  }, [branch]);

  const needs = lanes.you.filter((c) => !cleared.has(c.id));
  const oldest = needs[0];
  const ap = approvalsPulse();
  const bp = branchPulse();
  const live = batches.slice(0, 3).map((b) => {
    const rows = batched.filter((c) => c.batchId === b.id);
    const done = rows.filter((c) => c.accountNumber || c.state === 'DECLINED').length;
    const stuck = rows.filter((c) => storyOf(c).lane === 'you').length;
    return { b, n: rows.length, done, stuck };
  });
  const total = branch.length;

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2200); };

  const fixOf = (c: OnboardingCase) => {
    // While a live Maestro case runs the record, Maestro decides the next step —
    // that is on the case screen. Otherwise the record's own next best action.
    if (getLinkedInstance(c.id)) return null;
    return nextBestActions(c).find((a) => a.kind === 'do' && a.run && !a.opens) ?? null;
  };
  const fire = async (c: OnboardingCase) => {
    const a = fixOf(c);
    if (!a?.run) { nav.push({ k: 'case', id: c.id }); return; }
    setBusy(c.id);
    try { const msg = await a.run(); setCleared((s) => new Set(s).add(c.id)); haptic('success'); flash(msg); }
    catch (e) { haptic('warn'); flash((e as Error).message || 'That didn’t work — nothing was changed.'); }
    finally { setBusy(null); }
  };

  return (
    <NScreen
      title={who ? `${greeting()}, ${who}` : greeting()}
      eyebrow={today()}
      lead={<BankMark />}
      hero={<AuraHero name={who || undefined} onAsk={nav.askAura} onScan={() => nav.push({ k: 'capture' })} onExplore={() => nav.setTab('explore')} strip={<RecentlyActive />} />}
      tint={nk.dark ? HERO_TINT.dark : HERO_TINT.light} heroOnly
      actions={<>
        <NNavButton icon="search" label="Find a customer" onClick={() => nav.push({ k: 'find' })} />
        <button type="button" className="mw-me tap" onClick={() => { haptic(); if (nav.canSwitchRole) nav.openRoleSheet(); else nav.setTab('profile'); }} aria-label={nav.canSwitchRole ? `Role: ${roleInfo(nav.role).name}. Switch role` : 'Your profile'}>
          <NAvatar name={nav.userName || 'Relationship Manager'} size={32} solid />
        </button>
      </>}
    >
      {/* 1 — start a customer, right under what's running */}
      <NSection title="New customer">
        <div className="mw-dock">
          <button type="button" className="mw-dock-a tap" style={{ background: nk.brandFill }} onClick={() => { haptic(); nav.push({ k: 'capture' }); }}>
            <Icn name="scanLine" size={22} color="#fff" strokeWidth={1.6} />
            <span><b>One customer</b><small>Scan or type · 3 min</small></span>
          </button>
          <button type="button" className="mw-dock-b tap" style={{ background: nk.fill, color: nk.accent }} onClick={() => { haptic(); nav.push({ k: 'newBatch' }); }}>
            <b>Many at once</b><small style={{ color: nk.ink2 }}>Staff list or zip</small>
          </button>
        </div>
      </NSection>

      {/* 1 — the pipeline in one number */}
      <NSection title="Your pipeline" aside={<span className="mono">{total} application{total === 1 ? '' : 's'}</span>}>
        <button type="button" className="mw-month tap" onClick={() => { haptic(); nav.push({ k: 'pipeline', lane: 'all' }); }}>
          <span className="mw-month-l">
            <NBig>{lanes.you.length}</NBig>
            <span className="mw-month-k">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: C.red }}><Glyph color={C.red} />Need{lanes.you.length === 1 ? 's' : ''} you</span>
              {oldest && <span style={{ fontSize: 13, color: nk.ink3 }}>Oldest {dayAge(oldest.createdAt)}</span>}
            </span>
          </span>
          <span className="mw-legend">
            <LegendRow color={C.orange} n={lanes.customer.length} label="Waiting on customer" />
            <LegendRow color={C.blue} n={lanes.moving.length} label="Moving on its own" />
            <LegendRow color={C.green} n={lanes.done.length} label="Opened" />
          </span>
        </button>
        <LaneBar parts={[
          { n: lanes.you.length, color: C.red }, { n: lanes.customer.length, color: C.orange },
          { n: lanes.moving.length, color: C.blue }, { n: lanes.done.length, color: C.green },
        ]} />
      </NSection>

      {/* 2 — needs you, each with its fix */}
      <NSection title="Needs you · oldest first" action={needs.length > 3 ? { label: `See all ${needs.length}`, onClick: () => nav.push({ k: 'pipeline', lane: 'you' }) } : undefined}>
        {needs.length ? (
          <div className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
            {needs.slice(0, 3).map((c) => {
              const fix = fixOf(c);
              const d = Math.floor((Date.now() - Date.parse(c.createdAt)) / 86400000);
              return (
                <FixRow key={c.uid ?? c.id} title={name(c)} age={dayAge(c.createdAt)} ageHot={d >= 7}
                  sentence={storyOf(c).sentence} refId={c.id}
                  fix={fix?.title ?? (getLinkedInstance(c.id) ? 'See the live case' : 'Open')}
                  busy={busy === c.id} onFix={() => void fire(c)} onOpen={() => nav.push({ k: 'case', id: c.id })} />
              );
            })}
          </div>
        ) : (
          <NEmpty title="Nothing needs you">Every application is moving on its own or waiting on the customer.</NEmpty>
        )}
      </NSection>

      {/* 3 — batches in flight */}
      {live.length > 0 && (
        <NSection title="Batches" action={{ label: 'New batch', onClick: () => nav.push({ k: 'newBatch' }) }}>
          <NGroup>
            {live.map(({ b, n, done, stuck }) => (
              <NRow key={b.id} title={b.name} chevron={false}
                subtitle={<><span className="mono">{n}</span> people · <span className="mono">{done}</span> of <span className="mono">{n}</span> decided</>}
                value={stuck ? <span style={{ color: C.red, fontWeight: 500, fontSize: 13 }}>{stuck} need{stuck === 1 ? 's' : ''} you</span> : <span style={{ fontSize: 13 }}>{done === n && n ? 'Done' : 'Moving'}</span>}
                onClick={() => nav.push({ k: 'batch', id: b.id })} />
            ))}
          </NGroup>
        </NSection>
      )}

      {/* 4 — the rest of the job */}
      <NSection title="Also on your desk">
        <NGroup>
          <NRow icon={{ name: 'check', color: nk.accent }} title="Approvals"
            subtitle={ap.breaching ? `${ap.breaching} past SLA` : 'Waiting for your sign-off'}
            value={<span style={{ fontFamily: MONO, color: nk.ink }}>{ap.pending}</span>} onClick={nav.openApprovals} />
          <NRow icon={{ name: 'users', color: nk.accent }} title="Clients"
            subtitle={`${bp.atRisk} at risk · ${bp.nbas} suggested actions`}
            value={<span style={{ fontFamily: MONO, color: nk.ink }}>{bp.relationships}</span>} onClick={nav.openClients} />
        </NGroup>
      </NSection>

      {/* 5 — recent */}
      <NSection title="Recent customers" action={{ label: 'See all', onClick: () => nav.push({ k: 'pipeline', lane: 'all' }) }}>
        <NGroup>
          {branch.slice(0, 5).map((c) => {
            const s = storyOf(c);
            return (
              <NRow key={c.uid ?? c.id} title={name(c)} tone={s.color}
                subtitle={s.label} detail={`${c.id} · ${ago(c.createdAt)}`}
                onClick={() => nav.push({ k: 'case', id: c.id })} />
            );
          })}
        </NGroup>
      </NSection>

      <NToast text={toast} />
    </NScreen>
  );
}
