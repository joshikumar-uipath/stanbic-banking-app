// ─────────────────────────────────────────────────────────────────────────────
// Authorise — check the list, then slide to open the accounts.
//
// Opening an account cannot be undone, so the commit is a slide, not a tap. The
// list above it is the review: each row says whose work it is and whether it
// opens on PND; tap one for the maker's trail or to open it operative against a
// deferral reference (§9.2). A form this person confirmed themselves is held
// back — maker and checker must differ (§9.1).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Icn } from '../../../components/customerUi';
import { fullName, store, type OnboardingCase } from '../../../onboarding';
import { awaitingAuthorisation, openAccount, pndByProduct, isStraightThrough } from '../../bulk/engine';
import { verifier } from '../../bulk/bulkModel';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NSlide, NSheet, NToggle, NField, NButton, NEmpty, NAvatar, NBig, NTag, NStatus } from '../nkit';
import { nuban } from '../alertsModel';
import { useNk, C, haptic } from '../nk';

export default function Authorise({ batchId }: { batchId?: string }) {
  const nav = useNav();
  const nk = useNk();
  const { batched, batches, byId } = useWorkData();
  const queue = useMemo(() => awaitingAuthorisation(batchId ? batched.filter((c) => c.batchId === batchId) : batched), [batched, batchId]);
  const me = verifier();
  // Four-eyes: anything this person confirmed as maker is always held back —
  // worked out on every render, so rows that arrive later are covered too.
  const isSelf = (c: OnboardingCase) => !!c.reviewedBy && c.reviewedBy === me;
  const [skip, setSkip] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<OnboardingCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; ok: boolean; why?: string }[] | null>(null);
  const [slideKey, setSlideKey] = useState(0);

  const chosen = queue.filter((c) => !skip.has(c.id) && !isSelf(c));
  const badOverride = chosen.some((c) => c.id in overrides && !overrides[c.id].trim());
  const title = batchId ? batches.find((b) => b.id === batchId)?.name ?? 'Batch' : 'Ready to open';

  const open = async () => {
    setBusy(true);
    const out: { id: string; ok: boolean; why?: string }[] = [];
    for (const c of chosen) {
      try {
        const ref = overrides[c.id];
        if (ref?.trim()) await store.update(c.id, { pnd: false, deferralRef: ref.trim() });
        await openAccount(c.id, me);
        out.push({ id: c.id, ok: true });
      } catch (e) {
        out.push({ id: c.id, ok: false, why: (e as Error).message });
      }
    }
    setBusy(false);
    if (!out.some((r) => r.ok)) {
      // Nothing opened — stay here, say why, and let them slide again.
      haptic('warn');
      setFail(out[0]?.why ?? 'No account could be opened.');
      setSlideKey((k) => k + 1);
      return;
    }
    haptic(out.every((r) => r.ok) ? 'success' : 'warn');
    setResult(out);
  };

  if (result) {
    const opened = result.filter((r) => r.ok);
    const failed = result.filter((r) => !r.ok);
    return (
      <NScreen title={failed.length ? 'Some accounts opened' : 'Accounts opened'} onBack={nav.pop} large={false} footer={<NButton onClick={nav.pop}>Done</NButton>}>
        <div className="mw-done">
          <span className="mw-done-c" style={{ border: `1.5px solid ${nk.sep}`, color: C.green }}><Icn name="check" size={26} color="currentColor" strokeWidth={2} /></span>
          <div className="mw-done-t" style={{ color: nk.ink }}><span className="nk-big" style={{ fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 600 }}>{opened.length}</span> account{opened.length === 1 ? '' : 's'} opened</div>
          <div className="mw-done-s" style={{ color: nk.ink2 }}>
            {failed.length ? `${failed.length} could not be opened — see why below. ` : ''}Each number is on its customer’s record. Trying again never opens a second account.
          </div>
        </div>
        <NGroup>
          {result.map((r) => {
            const c = byId(r.id);
            return <NRow key={r.id} tone={r.ok ? undefined : C.red} title={c ? fullName(c) : r.id} subtitle={r.ok ? c?.accountType : r.why}
              value={r.ok ? <span className="mono" style={{ color: nk.ink, fontSize: 15 }}>{nuban(c?.accountNumber) || '…'}</span> : <NStatus color={C.red}>Not opened</NStatus>} />;
          })}
        </NGroup>
      </NScreen>
    );
  }

  const pndOpen = chosen.filter((c) => c.pnd && !overrides[c.id]).length;
  return (
    <>
      <NScreen title={title} eyebrow="Authorise" onBack={nav.pop}
        footer={queue.length ? (
          <>
            {badOverride && <div style={{ fontSize: 13, color: C.red }}>An operative override needs its deferral reference.</div>}
            {fail && <div style={{ fontSize: 13, color: C.red }}>{fail}</div>}
            <NSlide resetKey={slideKey} disabled={!chosen.length || busy || badOverride} onConfirm={() => { setFail(null); void open(); }}
              label={busy ? 'Opening…' : `Slide to open ${chosen.length} account${chosen.length === 1 ? '' : 's'}`} />
          </>
        ) : undefined}>
        {queue.length ? (
          <>
            <div className="mw-keyline">
              <span className="mw-keyline-l">
                <NBig>{chosen.length}</NBig>
                <span className="mw-keyline-r" style={{ color: nk.ink2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: nk.ink }}>to open</span>
                  <span>{pndOpen ? <><span className="mono">{pndOpen}</span> on PND · {chosen.length - pndOpen} operative</> : 'all operative'}
                  {skip.size ? <> · <span className="mono">{skip.size}</span> held back</> : null}</span>
                </span>
              </span>
            </div>
            <NSection title="Maker trail" aside="Swipe left to hold one back">
              <NGroup>
                {queue.map((c) => {
                  const held = skip.has(c.id);
                  const pnd = c.pnd && !overrides[c.id];
                  const self = isSelf(c);
                  return (
                    <NRow key={c.uid ?? c.id} title={fullName(c) || 'Unnamed'} tone={self ? C.red : undefined}
                      subtitle={self ? 'You confirmed this one — someone else must open it' : `${c.accountType ?? 'Account'} · ${isStraightThrough(c) ? 'straight-through — no maker review' : c.reviewedBy ? `confirmed by ${c.reviewedBy}` : 'confirmed by a maker'}`}
                      detail={c.edits?.length ? `${c.edits.length} correction${c.edits.length === 1 ? '' : 's'} by the maker` : undefined}
                      value={held ? <span style={{ fontSize: 13, color: nk.ink3 }}>Held</span> : <NTag>{pnd ? 'PND' : 'Operative'}</NTag>}
                      onClick={() => setFocus(c)}
                      trail={self ? undefined : { label: held ? 'Include' : 'Hold back', icon: held ? 'plus' : 'close', color: held ? C.green : C.red, run: () => setSkip((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; }) }} />
                  );
                })}
              </NGroup>
            </NSection>
            <p className="mw-hint" style={{ color: nk.ink3, marginTop: -18 }}>Tap one for the maker’s changes, or to open it operative against a deferral reference.</p>
          </>
        ) : (
          <NEmpty title="Nothing to authorise" action={<NButton kind="secondary" onClick={nav.pop}>Back</NButton>}>Every confirmed application here has been opened.</NEmpty>
        )}
      </NScreen>

      {focus && (
        <NSheet title={fullName(focus) || 'Unnamed'} subtitle={`${focus.id} · ${focus.accountType ?? 'Account'}`} onClose={() => setFocus(null)}
          footer={<NButton onClick={() => setFocus(null)}>Done</NButton>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NAvatar name={focus.reviewedBy || '?'} size={40} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: nk.ink }}>{isStraightThrough(focus) ? 'Straight-through — no maker review' : focus.reviewedBy ? `Confirmed by ${focus.reviewedBy}` : 'Confirmed by a maker'}</div>
              <div style={{ fontSize: 13, color: nk.ink2 }}>{focus.reviewedAt ? new Date(focus.reviewedAt).toLocaleString() : ''}</div>
            </div>
          </div>
          {focus.edits?.length ? (
            <NGroup>
              {focus.edits.map((e) => <NRow key={e.field} icon={{ name: 'pen', color: nk.accent }} title={e.field} subtitle={<><s>{e.before || '(blank)'}</s> → <b>{e.after}</b></>} />)}
            </NGroup>
          ) : <div style={{ fontSize: 14, color: nk.ink2 }}>The maker changed nothing — the form was read correctly.</div>}
          <div style={{ borderTop: `1px solid ${nk.sep}`, paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: nk.ink3 }}>Rule</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: nk.ink, marginTop: 4 }}>{pndByProduct(focus.accountType ?? '') ? 'Business accounts open on PND' : 'Savings and salary accounts open operative'}</div>
          </div>
          {!isSelf(focus) && (
            <NToggle on={skip.has(focus.id)} onChange={(v) => setSkip((st) => { const n = new Set(st); if (v) n.add(focus.id); else n.delete(focus.id); return n; })}
              label="Hold this one back" sub="It stays in the queue for later — nothing is opened for it now." />
          )}
          {focus.pnd && (
            <>
              <NToggle on={focus.id in overrides} onChange={(v) => setOverrides((o) => { const n = { ...o }; if (v) n[focus.id] = ''; else delete n[focus.id]; return n; })}
                label="Open operative instead" sub="Overrides the PND rule — only against a deferral reference." />
              {focus.id in overrides && (
                <NField label="Deferral reference" required>
                  <input autoFocus value={overrides[focus.id]} onChange={(e) => setOverrides((o) => ({ ...o, [focus.id]: e.target.value }))} placeholder="DEF-2026-…" />
                </NField>
              )}
            </>
          )}
        </NSheet>
      )}
    </>
  );
}
