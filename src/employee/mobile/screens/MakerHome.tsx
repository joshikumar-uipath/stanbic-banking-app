// ─────────────────────────────────────────────────────────────────────────────
// The maker's home — one decision: start reviewing.
//
// A review queue is worked, not browsed. So the screen leads with how much is
// waiting and how long it should take at this person's own pace, and one button
// that drops them into focus mode on the most doubtful form. The detail below
// (by batch, the hardest few, the handle-time ring) is there for orientation.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { confidenceThresholdPct } from '../../../integrations/docRules';
import { fullName } from '../../../onboarding';
import { awaitingReview } from '../../bulk/engine';
import { byConfidence } from '../../bulk/bulkModel';
import { averageHandleMs, handleTimes, HANDLE_TARGET_MS, mmss } from '../../bulk/handleTime';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NAvatar, NEmpty, NStatus, NButton, NBig } from '../nkit';
import { BankMark, AuraHero } from '../parts';
import { useNk, C, haptic, today, HERO_TINT } from '../nk';
import { ago } from '../../time';

export default function MakerHome() {
  const nav = useNav();
  const nk = useNk();
  const { batched, batches } = useWorkData();
  const threshold = confidenceThresholdPct();
  const queue = useMemo(() => awaitingReview(batched).sort(byConfidence), [batched]);
  const low = queue.filter((c) => (c.extractionConfidence ?? 100) < threshold).length;
  const recon = queue.filter((c) => (c.recon?.length ?? 0) > 0).length;
  // Read once per queue change, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed when a review lands (the queue shrinks)
  const { avg, n } = useMemo(() => averageHandleMs(), [queue.length]);
  const pace = n ? avg : 90_000;
  const minutes = Math.max(1, Math.round((queue.length * pace) / 60_000));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
  const doneToday = useMemo(() => handleTimes().filter((h) => new Date(h.at).toDateString() === new Date().toDateString()).length, [queue.length]);

  const byBatch = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of queue) m.set(c.batchId!, (m.get(c.batchId!) ?? 0) + 1);
    return [...m.entries()].map(([id, count]) => ({ id, count, meta: batches.find((b) => b.id === id) }));
  }, [queue, batches]);

  return (
    <NScreen title="Review" eyebrow={`Operations · Maker · ${today()}`} lead={<BankMark />}
      hero={<AuraHero name={nav.userName && nav.userName !== 'User' ? nav.userName.split(' ')[0] : undefined} onAsk={nav.askAura} onScan={() => nav.push({ k: 'capture' })} onExplore={() => nav.setTab('explore')} compact />}
      tint={nk.dark ? HERO_TINT.dark : HERO_TINT.light}
      actions={<button type="button" className="mw-me tap" onClick={() => { haptic(); if (nav.canSwitchRole) nav.openRoleSheet(); else nav.setTab('profile'); }} aria-label={nav.canSwitchRole ? 'Switch role' : 'Your profile'}><NAvatar name={nav.userName || 'Maker'} size={32} solid /></button>}
      footer={queue.length ? <NButton icon="arrow" onClick={() => nav.push({ k: 'focus' })}>Start reviewing</NButton> : undefined}>
      {queue.length ? (
        <div className="mw-keyline">
          <span className="mw-keyline-l">
            <NBig>{queue.length}</NBig>
            <span className="mw-keyline-r" style={{ color: nk.ink2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: nk.ink }}>forms to confirm</span>
              <span>About <span className="mono">{minutes}</span> min at your pace{low ? <> · <span className="mono">{low}</span> read with low confidence</> : null}</span>
            </span>
          </span>
        </div>
      ) : (
        <NEmpty title="Queue is clear">Everything has been confirmed and is with the verifier.</NEmpty>
      )}

      <div className="mw-pair">
        <span className="mw-stat">
          <b style={{ color: n && avg > HANDLE_TARGET_MS ? C.red : nk.ink }}>{n ? mmss(avg) : '—'}</b>
          <span style={{ color: nk.ink2 }}>Your average · target <span className="mono">{mmss(HANDLE_TARGET_MS)}</span></span>
        </span>
        <span className="mw-stat">
          <b>{doneToday}</b>
          <span style={{ color: nk.ink2 }}>Confirmed today</span>
        </span>
      </div>

      {recon > 0 && (
        <NGroup>
          <NRow tone={C.red} title={<span style={{ color: C.red }}>{recon} where the sources disagree</span>}
            subtitle="The form and the registry say different things — you pick which is right."
            onClick={() => nav.push({ k: 'focus', startId: queue.find((c) => c.recon?.length)?.id })} />
        </NGroup>
      )}

      {byBatch.length > 0 && (
        <NSection title="By batch">
          <NGroup>
            {byBatch.map((b) => (
              <NRow key={b.id} title={b.meta?.name ?? 'Bulk batch'} detail={b.id}
                value={<span className="mono" style={{ color: nk.ink }}>{b.count}</span>} onClick={() => nav.push({ k: 'focus', batchId: b.id })} />
            ))}
          </NGroup>
        </NSection>
      )}

      {queue.length > 0 && (
        <NSection title="Hardest first" footer={`Fields read below ${threshold}% are the ones you’ll be asked about.`}>
          <NGroup>
            {queue.slice(0, 5).map((c) => {
              const conf = c.extractionConfidence ?? 100;
              return (
                <NRow key={c.uid ?? c.id} title={fullName(c) || 'Unnamed'}
                  subtitle={c.recon?.length ? `${c.recon.map((r) => r.field).join(', ')} disagree` : `${Object.values(c.fieldConfidence ?? {}).filter((v) => v < threshold).length} doubtful fields`}
                  detail={`${c.id} · ${ago(c.createdAt)}`}
                  value={<NStatus color={conf < threshold ? C.red : C.green}><span className="mono">{conf}%</span></NStatus>}
                  onClick={() => nav.push({ k: 'focus', startId: c.id })} />
              );
            })}
          </NGroup>
        </NSection>
      )}
    </NScreen>
  );
}
