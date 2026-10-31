// ─────────────────────────────────────────────────────────────────────────────
// Focus mode — confirming what OCR read, one application at a time.
//
// The desk shows the whole form beside every field. A phone shows only what
// needs a human: the fields the model doubted, each as its own card with
// "Correct" or "Edit". Where the form and the registry disagree it becomes a
// choice — tap the one that is right. The fields read confidently are folded
// away (one tap to check them anyway). Confirm moves straight to the next form;
// nobody goes back to a list between applications.
//
// Same control as the desk: every correction is recorded with who, when, before
// and after (BR-DOC-11), handle time is measured (BR-DOC-13), and a concern can
// be raised as an exception that travels with the case.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icn } from '../../../components/customerUi';
import { confidenceThresholdPct } from '../../../integrations/docRules';
import { fullName, type OnboardingCase } from '../../../onboarding';
import { approveExtraction, flagExtraction, awaitingReview } from '../../bulk/engine';
import { REVIEW_FIELDS, reviewer, byConfidence } from '../../bulk/bulkModel';
import { hasActor } from '../../actor';
import { finishReview, averageHandleMs, HANDLE_TARGET_MS, mmss } from '../../bulk/handleTime';
import { useNav, useWorkData } from '../nav';
import { NImmersive, NButton, NSheet, NField, NChips, NEmpty, NSuccess, Glyph } from '../nkit';
import { useNk, C, haptic } from '../nk';

export default function ReviewFocus({ batchId, startId }: { batchId?: string; startId?: string }) {
  const nav = useNav();
  const nk = useNk();
  const { batched } = useWorkData();
  const queue = useMemo(() => awaitingReview(batchId ? batched.filter((c) => c.batchId === batchId) : batched).sort(byConfidence), [batched, batchId]);
  const [doneN, setDoneN] = useState(0);
  // The total is fixed when the session starts, so progress reads "3 of 16" even
  // as confirmed forms leave the queue.
  const [start] = useState(() => queue.length);
  const total = Math.max(start, doneN + queue.length);
  const [currentId, setCurrentId] = useState<string | null>(() => startId ?? queue[0]?.id ?? null);
  const [flash, setFlash] = useState<string | null>(null);

  // If the current one left the queue (approved elsewhere) — or the queue had not
  // loaded when focus mode opened — take the first that is still waiting.
  const current = queue.find((c) => c.id === currentId) ?? (flash ? null : queue[0] ?? null);

  const advance = (msg: string) => {
    setDoneN((n) => n + 1);
    setFlash(msg);
    const next = queue.find((c) => c.id !== currentId);
    window.setTimeout(() => { setFlash(null); setCurrentId(next?.id ?? null); }, 750);
  };

  const position = Math.min(doneN + 1, Math.max(total, 1));

  return (
    <NImmersive onClose={nav.pop} label="Confirm what was read">
      <div className="mw-focus" style={{ background: nk.page, color: nk.ink }}>
        {current && !flash ? (
          <Review key={current.id} c={current} remaining={queue.length - 1} position={position} total={Math.max(total, 1)} doneN={doneN}
            onClose={() => { haptic(); nav.pop(); }} onDone={advance} onSkip={() => {
              const next = queue[(queue.findIndex((c) => c.id === current.id) + 1) % queue.length];
              if (next && next.id !== current.id) setCurrentId(next.id);
            }} />
        ) : !flash ? (
          <>
            <FocusBar position={position} total={Math.max(total, 1)} doneN={doneN} onClose={() => { haptic(); nav.pop(); }} />
            <div className="mw-focus-scroll">
              <NEmpty title="All confirmed" action={<NButton onClick={nav.pop}>Done</NButton>}>
                {doneN ? `You confirmed ${doneN} form${doneN === 1 ? '' : 's'}. They are with the verifier now.` : 'Nothing is waiting for review.'}
              </NEmpty>
            </div>
          </>
        ) : null}
        {flash && <NSuccess title={flash} sub={queue.length > 1 ? 'Next form…' : 'Last one'} />}
      </div>
    </NImmersive>
  );
}

/** Close, where you are in the queue, the clock — and the queue as a ruler. */
function FocusBar({ position, total, doneN, onClose, elapsed }: { position: number; total: number; doneN: number; onClose: () => void; elapsed?: number }) {
  const nk = useNk();
  const { avg, n } = averageHandleMs();
  const ticks = Math.min(total, 24);
  const at = Math.min(ticks - 1, Math.floor((doneN / Math.max(total, 1)) * ticks));
  return (
    <>
      <div className="mw-focus-bar">
        <button type="button" className="mw-focus-x" onClick={onClose} aria-label="Leave focus mode" style={{ color: nk.ink }}>
          <Icn name="close" size={20} color="currentColor" strokeWidth={1.7} />
        </button>
        <div className="mw-focus-prog">
          <span style={{ fontSize: 13, color: nk.ink2 }}>{hasActor() ? 'Your queue' : `${reviewer().split(' ')[0]}’s queue`}</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>{position} of {total}</span>
        </div>
        <span className="mw-timer" style={{ color: elapsed !== undefined && elapsed > HANDLE_TARGET_MS ? C.red : nk.accent }}>{elapsed !== undefined ? mmss(elapsed) : ''}</span>
      </div>
      <div className="mw-ticks" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => (
          <i key={i} className={i === at ? 'on' : i % 5 === 0 ? 'major' : undefined} style={{ background: i <= at ? nk.brandFill : nk.sep }} />
        ))}
      </div>
      <div className="mw-focus-pace" style={{ color: nk.ink3 }}>
        <span>Your average <span className="mono" style={{ color: nk.ink }}>{n ? mmss(avg) : '—'}</span></span>
        <span>Target <span className="mono" style={{ color: nk.ink }}>{mmss(HANDLE_TARGET_MS)}</span></span>
      </div>
    </>
  );
}

function Review({ c, remaining, position, total, doneN, onClose, onDone, onSkip }: { c: OnboardingCase; remaining: number; position: number; total: number; doneN: number; onClose: () => void; onDone: (msg: string) => void; onSkip: () => void }) {
  const nk = useNk();
  const threshold = confidenceThresholdPct();
  const conf = c.fieldConfidence ?? {};
  const reconOf = (label: string) => c.recon?.find((r) => r.field.toLowerCase() === label.toLowerCase());
  const doubtful = REVIEW_FIELDS.filter((f) => (conf[f.key] ?? 100) < threshold || !!reconOf(f.label));
  const sure = REVIEW_FIELDS.filter((f) => !doubtful.includes(f));

  const [vals, setVals] = useState<Record<string, string>>({});
  const [ok, setOk] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [showSure, setShowSure] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [concern, setConcern] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    started.current = Date.now();
    const iv = window.setInterval(() => setElapsed(Date.now() - started.current), 1000);
    return () => window.clearInterval(iv);
  }, []);

  const value = (k: string, of: (c: OnboardingCase) => string) => vals[k] ?? of(c) ?? '';
  const confirm = (k: string) => { haptic(); setOk((s) => new Set(s).add(k)); setEditing(null); };
  const left = doubtful.filter((f) => !ok.has(f.key)).length;
  const edited = REVIEW_FIELDS.filter((f) => vals[f.key] !== undefined && vals[f.key] !== (f.of(c) ?? ''));

  const [fail, setFail] = useState<string | null>(null);
  // Recorded as the person signed in; the handle time only once the write lands.
  const approve = async () => {
    const by = reviewer();
    setBusy(true); setFail(null);
    try {
      await approveExtraction(c.id, by, edited.map((f) => ({ field: f.label, before: f.of(c) ?? '', after: vals[f.key], at: new Date().toISOString(), by })));
      finishReview(c.id, started.current, by, 'approved');
      haptic('success');
      onDone(edited.length ? `Confirmed with ${edited.length} correction${edited.length === 1 ? '' : 's'}` : 'Confirmed');
    } catch (e) {
      haptic('warn'); setFail((e as Error).message || 'Could not save — nothing was changed.'); setBusy(false);
    }
  };
  const flag = async () => {
    if (!concern.trim()) return;
    const by = reviewer();
    setBusy(true); setFail(null);
    try {
      await flagExtraction(c.id, by, concern.trim());
      finishReview(c.id, started.current, by, 'flagged');
      haptic('warn');
      setFlagging(false);
      onDone('Raised as an exception');
    } catch (e) {
      setFail((e as Error).message || 'Could not raise it — nothing was changed.'); setBusy(false); setFlagging(false);
    }
  };

  const overall = c.extractionConfidence ?? 100;

  const name = fullName(c) || 'Unnamed';
  return (
    <>
      <FocusBar position={position} total={total} doneN={doneN} onClose={onClose} elapsed={elapsed} />
      <div className="mw-focus-scroll">
        <div>
          <h1 className={`nk-h1${name.length > 22 ? ' long' : ''}`} style={{ marginTop: 4 }}>{name}</h1>
          <div style={{ marginTop: 4, fontSize: 14, color: nk.ink2 }}>
            {c.accountType ?? 'Account'} · <span className="mono" style={{ fontSize: 13, color: nk.ink }}>{c.id}</span> · read <span className="mono" style={{ fontSize: 13, color: overall < threshold ? C.red : nk.ink }}>{overall}%</span>
          </div>
        </div>

        <div className="mw-focus-h" style={{ color: nk.ink3 }}>
          <span>{doubtful.length ? (left ? `${left} field${left === 1 ? '' : 's'} to check` : 'All checked — confirm the form') : 'Everything was read confidently'}</span>
          {doubtful.length > 0 && <span>Crop from the scanned form</span>}
        </div>

        {doubtful.map((f) => {
          const r = reconOf(f.label);
          const cf = conf[f.key] ?? 100;
          const isOk = ok.has(f.key);
          const isEdit = editing === f.key;
          const read = f.of(c) ?? '';
          return (
            <div key={f.key}>
              <div className="mw-crop" role="img" aria-label={`Handwriting on the form: ${f.label}, ${read}`}>
                <span className="mw-crop-l">{f.label}</span>
                <span className="mw-crop-rule" />
                <span className="mw-crop-hand">{read || ' '}</span>
              </div>
              <div className="mw-fread">
                <span style={{ color: nk.ink3 }}>{f.label}, read as <span style={{ fontSize: 15, color: nk.ink }}>{value(f.key, f.of) || '—'}</span></span>
                {isOk
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.green, fontWeight: 500 }}><Glyph color={C.green} />Checked</span>
                  : r ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.red, fontWeight: 500 }}><Glyph color={C.red} />Sources disagree</span>
                  : <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.red }}><Glyph color={C.red} />{cf}%</span>}
              </div>
              {vals[f.key] !== undefined && vals[f.key] !== read && <div style={{ fontSize: 12.5, color: nk.ink3, marginTop: 2 }}>Corrected from “{read}”</div>}
              {r && !isOk ? (
                <div className="mw-fopts">
                  {r.sources.map((src) => (
                    <button key={src.name} type="button" className="mw-fopt tap" style={{ borderColor: nk.line, color: nk.ink }}
                      onClick={() => { setVals((v) => ({ ...v, [f.key]: src.value })); confirm(f.key); }}>
                      <span style={{ color: nk.ink2 }}>{src.name}</span><b>{src.value}</b>
                    </button>
                  ))}
                </div>
              ) : isEdit ? (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input className="mw-finput" autoFocus aria-label={f.label} value={value(f.key, f.of)} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                    style={{ background: nk.fill, color: nk.ink }} />
                  <NButton small onClick={() => confirm(f.key)}>Save</NButton>
                </div>
              ) : !isOk ? (
                <div className="mw-fbtns">
                  <NButton small kind="secondary" icon="check" onClick={() => confirm(f.key)}>Correct</NButton>
                  <NButton small kind="secondary" icon="pen" onClick={() => setEditing(f.key)}>Edit</NButton>
                </div>
              ) : (
                <button type="button" className="nk-link" style={{ color: nk.accent, padding: '6px 0' }} onClick={() => { setOk((st) => { const n = new Set(st); n.delete(f.key); return n; }); setEditing(f.key); }}>Change</button>
              )}
            </div>
          );
        })}

        <button type="button" className="mw-sure tap" style={{ color: nk.ink, borderColor: nk.sep }} onClick={() => { haptic(); setShowSure((v) => !v); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Glyph color={C.green} />{sure.length} field{sure.length === 1 ? '' : 's'} read confidently</span>
          <span style={{ color: nk.accent, fontWeight: 500 }}>{showSure ? 'Hide' : 'Check anyway'}</span>
        </button>
        {showSure && (
          <div style={{ marginTop: -20 }}>
            {sure.map((f) => (
              <div key={f.key} className="mw-kv" style={{ borderColor: nk.sep }}>
                <span style={{ color: nk.ink2 }}>{f.label}</span>
                {editing === f.key
                  ? <input className="mw-finput sm" autoFocus aria-label={f.label} value={value(f.key, f.of)} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} onBlur={() => setEditing(null)} style={{ background: nk.fill, color: nk.ink }} />
                  : <b style={{ color: nk.ink }} onClick={() => setEditing(f.key)}>{value(f.key, f.of) || '—'} <Icn name="pen" size={12} color={nk.ink3} /></b>}
              </div>
            ))}
          </div>
        )}
        <p className="mw-audit" style={{ color: nk.ink3 }}>
          <Icn name="lock" size={14} color="currentColor" strokeWidth={1.6} style={{ flex: '0 0 auto', marginTop: 1 }} />
          Every change is logged with your name, the time, and the value before and after.
        </p>
      </div>

      {fail && <div role="alert" style={{ padding: '10px 20px', fontSize: 14, color: C.red, borderTop: `1px solid ${nk.sep}` }}>{fail}</div>}
      <div className="mw-focus-foot" style={{ background: nk.page, borderColor: nk.sep }}>
        <button type="button" className="mw-focus-side tap" onClick={() => { haptic(); setFlagging(true); }} style={{ color: nk.accent }} aria-label="Flag a concern">
          <Icn name="flag" size={20} color="currentColor" strokeWidth={1.6} /><span>Flag</span>
        </button>
        <button type="button" className="mw-focus-main tap" disabled={busy || left > 0} onClick={() => { haptic(); void approve(); }}
          style={left > 0 || busy ? { background: nk.sep, color: nk.ink2 } : { background: nk.brandFill, color: '#fff' }}>
          <b>{busy ? 'Saving…' : remaining ? 'Confirm & next' : 'Confirm'}</b>
          {left > 0 && <small>{left} left to check</small>}
        </button>
        <button type="button" className="mw-focus-side tap" onClick={() => { haptic(); onSkip(); }} style={{ color: nk.accent }} aria-label="Skip for now" disabled={!remaining}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M5 6l7 6-7 6zM13 6l7 6-7 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg><span>Skip</span>
        </button>
      </div>

      {flagging && (
        <NSheet title="Flag a concern" subtitle="It becomes an exception and travels with the case to whoever picks it up." onClose={() => setFlagging(false)}
          footer={<NButton kind="destructive" disabled={!concern.trim() || busy} onClick={() => void flag()}>Raise the exception</NButton>}>
          <NChips value={concern as string} onChange={setConcern} options={[
            'The ID document looks altered', 'Photo does not match the ID', 'Form is incomplete or unsigned', 'Wrong customer in this folder',
          ].map((x) => ({ id: x, label: x }))} />
          <NField label="Or describe it"><textarea value={concern} onChange={(e) => setConcern(e.target.value)} rows={3} placeholder="What made you stop?" /></NField>
        </NSheet>
      )}
    </>
  );
}
