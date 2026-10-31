// ─────────────────────────────────────────────────────────────────────────────
// Authorise — the verifier opens the accounts.
//
// §9.1 keeps maker and checker apart: the person who confirmed the extraction
// may not be the one who creates the account. The screen says whose work it is
// approving and what they changed, because "approve" without that is a rubber
// stamp rather than a control.
//
// PND (§9.2) is applied BY RULE from the product — business restricted, savings
// and salary operative — and an override is allowed only against a deferral
// reference. That is why the toggle is disabled until the reference is typed.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { fullName, type OnboardingCase } from '../../onboarding';
import type { BatchMeta } from './batches';
import { awaitingAuthorisation, openAccount, pndByProduct } from './engine';
import { store } from '../../onboarding';
import { Tag } from '../ui';
import { VERIFIER } from './bulkModel';


export default function Authorise({ cases, meta }: { cases: OnboardingCase[]; meta: BatchMeta | null }) {
  const queue = useMemo(() => awaitingAuthorisation(cases), [cases]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [deferral, setDeferral] = useState('');
  const [operative, setOperative] = useState(false);
  const [busy, setBusy] = useState(false);

  const chosen = queue.filter((c) => sel[c.id] !== false);
  const one = focus ? queue.find((c) => c.id === focus) ?? queue[0] : queue[0];

  const create = async () => {
    setBusy(true);
    for (const c of chosen) {
      // The override only applies to the row in focus, and only with a reference.
      if (one && c.id === one.id && operative && deferral.trim()) {
        await store.update(c.id, { pnd: false, deferralRef: deferral.trim() });
      }
      await openAccount(c.id);
    }
    setBusy(false);
    setOperative(false);
    setDeferral('');
  };

  if (!queue.length) {
    return (
      <div className="bk-pane">
        <header className="bk-head">
          <div><h1>Authorise account opening</h1><p>Nothing is waiting on you.</p></div>
        </header>
        <div className="bk-ok">
          {meta ? <>Every confirmed application on <b>{meta.name}</b> has been opened. Switch to the Maker to clear the review queue, or to the Relationship Manager to see the batch.</> : 'No batch open.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bk-pane">
      <header className="bk-head">
        <div>
          <h1>Authorise account opening <span className="n">{queue.length} ready</span></h1>
          <p>Extractions confirmed by a maker. You decide the PND position and create the accounts.</p>
        </div>
        <span className="bk-br">BR-DEC-03 · BR-PROV-01 · BR-PROV-02 · §9.2</span>
      </header>

      <div className="bk-split">
        <div className="bk-table auth">
          <div className="hd"><span /><span>Reference</span><span>Customer</span><span>Product</span><span>PND by rule</span></div>
          {queue.map((c) => (
            <div className={`rw${one?.id === c.id ? ' on' : ''}`} key={c.uid ?? c.id} onClick={() => { setFocus(c.id); setOperative(false); setDeferral(''); }}>
              <span>
                <input type="checkbox" checked={sel[c.id] !== false} aria-label={`Include ${c.id}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setSel((s) => ({ ...s, [c.id]: e.target.checked }))} />
              </span>
              <span className="mono">{c.id}</span>
              <span className="nm">{fullName(c) || 'Unnamed'}</span>
              <span className="mu">{c.accountType ?? '—'}</span>
              <span>{c.pnd ? <Tag tone="warn">PND on</Tag> : <Tag tone="good">Operative</Tag>}</span>
            </div>
          ))}
        </div>

        <aside className="bk-aside">
          {one && (
            <>
              <div className="card">
                <b>{fullName(one) || 'Unnamed'}</b>
                <div className="kv"><span>Product</span><b>{one.accountType ?? '—'}</b></div>
                <div className="kv"><span>Rule</span><b>{pndByProduct(one.accountType ?? '') ? 'Business accounts open on PND' : 'Savings and salary accounts open operative'}</b></div>
                {one.pnd && (
                  <>
                    <hr />
                    <label className="chk">
                      <input type="checkbox" checked={operative} onChange={(e) => setOperative(e.target.checked)} />
                      <span>Open operative instead — overrides the PND rule</span>
                    </label>
                    <label className="fl">
                      <span>Deferral reference {operative && !deferral.trim() && <em className="bad">required to override</em>}</span>
                      <input value={deferral} onChange={(e) => setDeferral(e.target.value)} placeholder="DEF-2026-…" disabled={!operative} />
                    </label>
                  </>
                )}
              </div>

              <div className="card">
                <span className="lb">Maker trail</span>
                <div className="kv"><span>Confirmed by</span><b>{one.reviewedBy ?? '—'}</b></div>
                <div className="kv"><span>Fields corrected</span><b>{one.edits?.length ?? 0}</b></div>
                {one.edits?.map((e) => (
                  <div className="edit" key={e.field}>
                    <b>{e.field}</b>
                    <span><s>{e.before || '(blank)'}</s> → {e.after}</span>
                  </div>
                ))}
                {one.reviewedBy === VERIFIER && (
                  <div className="warnbox">You confirmed this extraction yourself. Maker-checker means someone else authorises it.</div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      <footer className="bk-foot">
        <span className="mu">Creation is idempotent — a retry never opens a second account for the same application.</span>
        <button className="dk-btn pri lg" disabled={!chosen.length || busy || (operative && !deferral.trim())} onClick={() => void create()}>
          {busy ? 'Creating…' : `Create ${chosen.length} account${chosen.length === 1 ? '' : 's'} →`}
        </button>
      </footer>
    </div>
  );
}
