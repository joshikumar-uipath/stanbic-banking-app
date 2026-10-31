// ─────────────────────────────────────────────────────────────────────────────
// Approvals — the maker–checker queue, on the phone.
//
//   1. How many wait on you, in one number, with what they are worth and how
//      many are already past their SLA.
//   2. The queue as rows: what it is, whose and how much, and when it is due.
//   3. A sheet for one request: the facts, the maker's case, then Approve or
//      Reject against a reason code (and an optional note for the audit trail).
//
// Sample data (approvalsData.ts), held in memory like the screen it replaces: a
// decided request leaves the queue and is listed under "Decided".
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from 'react';
import { approvals, money, APPROVE_REASONS, REJECT_REASONS, type Approval, type Risk } from '../../../approvalsData';
import { LOCALE } from '../../../customersData';
import { NScreen, NSection, NGroup, NRow, NChips, NSheet, NButton, NField, NToast, NEmpty, NBig, NStatus } from '../nkit';
import { useNk, C, haptic } from '../nk';
import '../mobile.css';

type Filter = 'all' | 'sla' | 'value' | 'dual';
type Outcome = 'approve' | 'reject' | 'info';
interface Decision { a: Approval; outcome: Outcome; reason?: string; note?: string }

/** Requests at or above this are "high value" (the sample's large-ticket items). */
const HIGH_VALUE = 50_000_000;

/** ₦266.5m · ₦2.1bn · ₦45,000 — short enough for a row, never "₦266,545k". */
function compactMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const one = (v: number, unit: string) =>
    `${sign}${LOCALE.symbol}${v.toLocaleString(LOCALE.numberLocale, { maximumFractionDigits: 1 })}${unit}`;
  if (a >= 1e9) return one(Math.round((a / 1e9) * 10) / 10, 'bn');
  if (a >= 1e6) return one(Math.round((a / 1e6) * 10) / 10, 'm');
  return `${sign}${LOCALE.symbol}${Math.round(a).toLocaleString(LOCALE.numberLocale)}`;
}

const riskTone = (r: Risk) => (r === 'High' ? C.red : r === 'Medium' ? C.orange : undefined);

function Sla({ a }: { a: Approval }) {
  if (a.slaBreaching) return <NStatus color={C.red}>Past SLA</NStatus>;
  const m = /^Due in (.+)$/.exec(a.sla);
  return <NStatus color={C.orange}>{m ? <>Due in <span className="mono">{m[1]}</span></> : a.sla}</NStatus>;
}

function KV({ rows }: { rows: [string, ReactNode, boolean?][] }) {
  const nk = useNk();
  return (
    <NGroup>
      {rows.map(([k, v, mono]) => (
        <div key={k} className="mw-kv" style={{ borderColor: nk.sep }}>
          <span style={{ color: nk.ink2 }}>{k}</span>
          <b className={mono ? 'mono' : undefined} style={{ color: nk.ink }}>{v}</b>
        </div>
      ))}
    </NGroup>
  );
}

export default function Approvals({ onClose }: { onClose: () => void }) {
  const nk = useNk();
  const [filter, setFilter] = useState<Filter>('all');
  const [decided, setDecided] = useState<Decision[]>([]);
  const [focus, setFocus] = useState<Approval | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pending = useMemo(() => approvals.filter((a) => !decided.some((d) => d.a.id === a.id)), [decided]);
  const value = pending.reduce((s, a) => s + a.amount, 0);
  const counts = {
    sla: pending.filter((a) => a.slaBreaching).length,
    value: pending.filter((a) => a.amount >= HIGH_VALUE).length,
    dual: pending.filter((a) => !a.withinAuthority).length,
  };
  const list = pending.filter((a) =>
    filter === 'sla' ? a.slaBreaching : filter === 'value' ? a.amount >= HIGH_VALUE : filter === 'dual' ? !a.withinAuthority : true);

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2200); };
  const decide = (d: Decision) => {
    setDecided((x) => [d, ...x]);
    setFocus(null);
    haptic('success');
    const dual = !d.a.withinAuthority;
    flash(d.outcome === 'approve' ? (dual ? 'Approved — routed for a second approval' : 'Approved')
      : d.outcome === 'reject' ? 'Rejected — the maker has been told'
        : `More information requested from ${d.a.maker}`);
  };

  return (
    <>
      <NScreen title="Approvals" eyebrow="Maker–checker" onBack={onClose}>
        {pending.length ? (
          <>
            <div className="mw-keyline">
              <span className="mw-keyline-l">
                <NBig>{pending.length}</NBig>
                <span className="mw-keyline-r" style={{ color: nk.ink2 }}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: nk.ink }}>awaiting you</span>
                  <span>
                    <span className="mono">{compactMoney(value)}</span> in total
                    {counts.sla > 0 && <> · <span style={{ color: C.red, fontWeight: 500 }}><span className="mono">{counts.sla}</span> past SLA</span></>}
                  </span>
                </span>
              </span>
            </div>

            <NChips value={filter} onChange={setFilter} options={[
              { id: 'all', label: 'All', count: pending.length },
              { id: 'sla', label: 'Past SLA', count: counts.sla, color: counts.sla ? C.red : undefined },
              { id: 'value', label: 'High value', count: counts.value },
              { id: 'dual', label: 'Dual approval', count: counts.dual },
            ]} />

            <NSection title={filter === 'all' ? 'Waiting · most urgent first' : 'Waiting'}>
              {list.length ? (
                <NGroup>
                  {[...list].sort((x, y) => Number(!!y.slaBreaching) - Number(!!x.slaBreaching)).map((a) => (
                    <NRow key={a.id} title={a.typeLabel} tone={riskTone(a.risk)}
                      subtitle={<>{a.customer}{a.amount > 0 && <> · <span className="mono" style={{ color: nk.ink }}>{compactMoney(a.amount)}</span></>}</>}
                      value={<Sla a={a} />}
                      onClick={() => setFocus(a)}>
                      <span style={{ fontSize: 13, color: nk.ink3 }}>
                        {a.risk} risk · {a.maker}{!a.withinAuthority ? ' · dual approval' : ''}
                      </span>
                    </NRow>
                  ))}
                </NGroup>
              ) : (
                <NEmpty icon="filter" color={C.gray} title="Nothing matches"
                  action={<NButton kind="secondary" onClick={() => setFilter('all')}>Show all</NButton>}>
                  None of the waiting requests fit this filter.
                </NEmpty>
              )}
            </NSection>
          </>
        ) : (
          <NEmpty title="All caught up">Nothing is waiting for your sign-off.</NEmpty>
        )}

        {decided.length > 0 && (
          <NSection title="Decided" aside="This session">
            <NGroup>
              {decided.map((d) => {
                const dual = !d.a.withinAuthority;
                const st = d.outcome === 'reject' ? { c: C.red, w: 'Rejected' }
                  : d.outcome === 'info' ? { c: C.orange, w: 'Asked maker' }
                    : dual ? { c: C.blue, w: 'Routed' } : { c: C.green, w: 'Approved' };
                return (
                  <NRow key={d.a.id} title={d.a.typeLabel} chevron={false}
                    subtitle={<>{d.a.customer}{d.reason ? ` · ${d.reason}` : ''}</>}
                    detail={d.note || undefined}
                    value={<NStatus color={st.c}>{st.w}</NStatus>} />
                );
              })}
            </NGroup>
          </NSection>
        )}

        <NToast text={toast} />
      </NScreen>

      {focus && <ApprovalSheet key={focus.id} a={focus} onClose={() => setFocus(null)} onDecide={decide} />}
    </>
  );
}

function ApprovalSheet({ a, onClose, onDecide }: { a: Approval; onClose: () => void; onDecide: (d: Decision) => void }) {
  const nk = useNk();
  const [outcome, setOutcome] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const dual = !a.withinAuthority;
  const reasons = outcome === 'reject' ? REJECT_REASONS : APPROVE_REASONS;

  const choose = (o: 'approve' | 'reject') => { setOutcome(o); setReason(null); };

  const footer = outcome ? (
    <>
      <NButton kind="secondary" onClick={() => setOutcome(null)}>Back</NButton>
      <NButton kind={outcome === 'reject' ? 'destructive' : 'primary'} disabled={!reason}
        onClick={() => reason && onDecide({ a, outcome, reason, note: note.trim() || undefined })}>
        {outcome === 'reject' ? 'Confirm rejection' : dual ? 'Approve & route' : 'Confirm approval'}
      </NButton>
    </>
  ) : (
    <>
      <NButton kind="destructive" onClick={() => choose('reject')}>Reject</NButton>
      <NButton onClick={() => choose('approve')}>{dual ? 'Approve & route' : 'Approve'}</NButton>
    </>
  );

  return (
    <NSheet title={a.title} subtitle={`${a.customer} · ${a.typeLabel}`} onClose={onClose} footer={footer}>
      {a.amount > 0 && (
        <div className="mw-hero">
          <span className="mw-hero-n mono" style={{ color: nk.ink }}>{money(a.amount)}</span>
          <span className="mw-hero-r" style={{ color: nk.ink2 }}>Requested by {a.maker} · <span className="mono">{a.ago}</span></span>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        <NStatus color={dual ? C.orange : C.green}>{dual ? 'Over your limit — needs a second approver' : 'Within your approval authority'}</NStatus>
        <Sla a={a} />
      </div>

      {outcome ? (
        <>
          <NSection title={outcome === 'reject' ? 'Reason to reject' : 'Reason to approve'}>
            <div role="radiogroup" aria-label={outcome === 'reject' ? 'Reason to reject' : 'Reason to approve'} className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
              {reasons.map((r) => {
                const on = reason === r;
                return (
                  <button key={r} type="button" role="radio" aria-checked={on} className="mw-radiorow tap"
                    style={{ borderColor: nk.sep, color: nk.ink }} onClick={() => { haptic(); setReason(r); }}>
                    <span className="mw-radio" style={{ borderColor: on ? nk.accent : nk.ink3 }}>{on && <i style={{ background: nk.accent }} />}</span>
                    <span>{r}</span>
                  </button>
                );
              })}
            </div>
          </NSection>
          <NField label="Note" hint="Optional. Saved with your reason code in the audit trail.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything the next reviewer should know" />
          </NField>
        </>
      ) : (
        <>
          <NSection title="Request">
            <KV rows={[
              ['Type', a.typeLabel],
              ['Customer', a.customer],
              ...(a.amount > 0 ? [['Amount', money(a.amount), true] as [string, ReactNode, boolean]] : []),
              ['Requested by', a.maker],
              ['Raised', a.ago, true],
              ['Risk', a.risk],
            ]} />
          </NSection>
          <NSection title="Maker’s justification">
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: nk.ink }}>{a.reason}</p>
          </NSection>
          {a.details.length > 0 && (
            <NSection title="Checks">
              <KV rows={a.details.map((d) => [d.label, d.value, /\d/.test(d.value)] as [string, ReactNode, boolean])} />
            </NSection>
          )}
          <NSection title="Recommendation">
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: nk.ink }}>{a.recommendation}</p>
          </NSection>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <button type="button" className="mw-textbtn tap" style={{ color: nk.accent }}
              onClick={() => { haptic(); onDecide({ a, outcome: 'info' }); }}>
              Ask the maker for more
            </button>
            <p className="mw-hint" style={{ color: nk.ink3 }}>Maker–checker enforced. Every decision is audit-logged with your reason code.</p>
          </div>
        </>
      )}
    </NSheet>
  );
}
