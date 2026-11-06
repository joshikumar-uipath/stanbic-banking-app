// The verifier's home — what is ready to open, grouped the way it arrived.
// One card per batch: how many, who confirmed them, how many open on PND.
import { useMemo } from 'react';
import { awaitingAuthorisation, opened, isStraightThrough } from '../../bulk/engine';
import { verifier } from '../../bulk/bulkModel';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NAvatar, NEmpty, NButton, NBig, NTag } from '../nkit';
import { BankMark, AuraHero } from '../parts';
import { useNk, C, haptic, today, HERO_TINT } from '../nk';

export default function VerifierHome() {
  const nav = useNav();
  const nk = useNk();
  const { batched, batches } = useWorkData();
  const ready = useMemo(() => awaitingAuthorisation(batched), [batched]);
  const openedToday = opened(batched).filter((c) => new Date(c.openedAt ?? c.updatedAt).toDateString() === new Date().toDateString()).length;
  const groups = useMemo(() => {
    const m = new Map<string, typeof ready>();
    for (const c of ready) m.set(c.batchId!, [...(m.get(c.batchId!) ?? []), c]);
    return [...m.entries()].map(([id, cs]) => ({
      id, cs, meta: batches.find((b) => b.id === id),
      pnd: cs.filter((c) => c.pnd).length,
      makers: [...new Set(cs.map((c) => c.reviewedBy).filter(Boolean))] as string[],
      self: cs.some((c) => !!c.reviewedBy && c.reviewedBy === verifier()),
    }));
  }, [ready, batches]);

  const pndN = ready.filter((c) => c.pnd).length;
  return (
    <NScreen title="Ready to open" eyebrow={`Operations · Verifier · ${today()}`} lead={<BankMark />}
      hero={<AuraHero name={nav.userName && nav.userName !== 'User' ? nav.userName.split(' ')[0] : undefined} onAsk={nav.askAura} onPhoto={(f) => nav.askAura(undefined, f)} onExplore={() => nav.setTab('explore')} compact />}
      tint={nk.dark ? HERO_TINT.dark : HERO_TINT.light}
      actions={<button type="button" className="mw-me tap" onClick={() => { haptic(); if (nav.canSwitchRole) nav.openRoleSheet(); else nav.setTab('profile'); }} aria-label={nav.canSwitchRole ? 'Switch role' : 'Your profile'}><NAvatar name={nav.userName || 'Verifier'} size={32} solid /></button>}
      footer={ready.length ? <NButton icon="lock" onClick={() => nav.push({ k: 'authorise' })}>Review and open {ready.length}</NButton> : undefined}>
      {ready.length ? (
        <>
          <div className="mw-keyline">
            <span className="mw-keyline-l">
              <NBig>{ready.length}</NBig>
              <span className="mw-keyline-r" style={{ color: nk.ink2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: nk.ink }}>account{ready.length === 1 ? '' : 's'}</span>
                <span>confirmed by makers across <span className="mono">{groups.length}</span> batch{groups.length === 1 ? '' : 'es'}</span>
              </span>
            </span>
          </div>
          {pndN > 0 && (
            <p style={{ margin: '-8px 0 0', fontSize: 15, lineHeight: 1.5 }}>
              <span className="mono">{pndN}</span> open on <NTag>PND</NTag> — Post No Debit — until their documents are verified.
            </p>
          )}
        </>
      ) : (
        <NEmpty title="Nothing to authorise">Every confirmed application has been opened.</NEmpty>
      )}

      <p className="mw-rule" style={{ borderColor: nk.sep, color: nk.ink2 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ flex: '0 0 auto' }}><circle cx="7.5" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="16.5" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 12h2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        <span><b style={{ color: nk.ink, fontWeight: 600 }}>Four-eyes rule.</b> You can’t open an account you confirmed yourself.</span>
      </p>

      <div className="mw-pair">
        <span className="mw-stat"><b>{openedToday}</b><span style={{ color: nk.ink2 }}>Opened today</span></span>
        <span className="mw-stat"><b>{ready.filter((c) => c.edits?.length).length}</b><span style={{ color: nk.ink2 }}>With maker corrections</span></span>
      </div>

      {groups.length > 0 && (
        <NSection title="By batch">
          <NGroup>
            {groups.map((g) => (
              <NRow key={g.id} tone={g.self ? C.red : undefined}
                title={g.meta?.name ?? 'Bulk batch'}
                subtitle={g.makers.length ? `Confirmed by ${g.makers.join(', ')}` : g.cs.every(isStraightThrough) ? 'Straight-through — no maker review' : 'Confirmed by a maker'}
                detail={g.self ? 'Includes forms you confirmed yourself' : `${g.pnd} on PND · ${g.cs.length - g.pnd} operative`}
                value={<span className="mono" style={{ color: nk.ink }}>{g.cs.length}</span>}
                onClick={() => nav.push({ k: 'authorise', batchId: g.id })} />
            ))}
          </NGroup>
        </NSection>
      )}
    </NScreen>
  );
}
