// ─────────────────────────────────────────────────────────────────────────────
// My desk — the banker's landing screen on /employee-web.
//
// The premise: open it and know what to do next. Everything waiting on this
// person, from every source (openings, approvals, clients), ranked into one
// list — "needs you now" above "in flight, nothing needed from you". That split
// IS the Progress-First story: most of the pipeline is moving without them.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { stateMeta, fullName, type OnboardingCase } from '../../onboarding';
import { approvals, money, type Approval } from '../../approvalsData';
import { customers, type Customer } from '../../customersData';
import { I, Tag, Dot, Stat, type Tone } from '../ui';
import { useMaestroStates, MaestroCell } from '../maestroStatus';
import type { LiveStateLite } from '../../onboarding/maestro';
import { ago } from '../time';
import type { Dest } from '../DeskShell';

/** One line on the desk, whatever it came from. */
type Item = {
  key: string;
  dot: Tone;
  who: string;
  ref: string;
  cta: string;          // what the attention-bar button should say
  what: string;
  why: string;          // a fuller, one-sentence reason — drives the "next move" hero
  when: string;
  /** Onboarding record id — set for openings only, so the Maestro lane can resolve it. */
  recordId?: string;
  tag?: { tone: Tone; text: string };
  /** Where the application came from — set for openings only, so a banker can
   *  tell a payroll row from a walk-in without opening it. */
  src?: { kind: 'bulk' | 'single'; label: string };
  rank: number;          // lower = more urgent
  go: () => void;
};

const STATE_TONE: Record<string, Tone> = { good: 'good', pending: 'warn', exception: 'crit', progress: 'info', neutral: 'idle' };

function fromCases(cases: OnboardingCase[], open: (id: string) => void): Item[] {
  return cases.map((c) => {
    const m = stateMeta(c.state);
    const exc = c.state === 'EXCEPTION';
    const pend = c.state === 'PENDING_LIVENESS' || c.state === 'PENDING_DOCUMENTS';
    // What actually went wrong, in the banker's words — not the state name.
    const failed = c.validations.filter((v) => v.status === 'failed' || v.status === 'timeout').map((v) => v.kind);
    const what = exc
      ? (failed.length ? `${failed.join(' & ')} needs a person` : 'Needs review')
      : pend
        ? (c.state === 'PENDING_LIVENESS' ? 'Account open — selfie outstanding' : 'Account open — documents outstanding')
        : m.label;
    const why = exc
      ? `${failed.length ? failed.join(' & ') + ' validation ' : 'A check '}needs a person before this application can continue — clear it to send the case back into straight-through processing.`
      : pend
        ? (c.state === 'PENDING_LIVENESS'
          ? 'The account is open but the customer’s selfie is still outstanding — nudge them to finish liveness.'
          : 'The account is open but required documents are still outstanding from the customer.')
        : m.desc;
    return {
      key: `c-${c.id}`,
      dot: STATE_TONE[m.tone] ?? 'idle',
      who: fullName(c).trim() || 'Unnamed applicant',
      ref: c.id,
      cta: c.id,
      what,
      why,
      when: ago(c.createdAt),
      recordId: c.id,
      tag: { tone: STATE_TONE[m.tone] ?? 'idle', text: m.label },
      src: c.batchId
        ? { kind: 'bulk', label: c.employer || 'Bulk' }
        : { kind: 'single', label: 'Walk-in' },
      rank: exc ? 0 : pend ? 2 : 5,
      go: () => open(c.id),
    };
  });
}

function fromApprovals(list: Approval[], go: () => void): Item[] {
  return list.map((a) => ({
    key: `a-${a.id}`,
    dot: a.slaBreaching ? 'crit' : a.risk === 'High' ? 'warn' : 'info',
    who: a.customer,
    ref: `Raised by ${a.maker}`,   // the demo ids ('a3') mean nothing to a banker
    cta: a.customer,
    what: `${a.typeLabel}${a.amount ? ` · ${money(a.amount)}` : ''}`,
    why: `${a.typeLabel}${a.amount ? ` for ${money(a.amount)}` : ''} — ${a.slaBreaching ? 'past its SLA and needs your sign-off now.' : !a.withinAuthority ? 'above your limit, so it needs dual approval.' : 'awaiting your approval.'}`,
    when: a.ago,
    tag: a.slaBreaching ? { tone: 'crit', text: 'SLA breach' } : !a.withinAuthority ? { tone: 'warn', text: 'Dual approval' } : undefined,
    rank: a.slaBreaching ? 1 : 3,
    go,
  }));
}

function fromClients(list: Customer[], go: () => void): Item[] {
  return list
    .filter((c) => c.kyc !== 'Verified' || c.headlineTone === 'warn')
    .map((c) => ({
      key: `k-${c.id}`,
      dot: c.kyc !== 'Verified' ? 'warn' : 'idle',
      who: c.name,
      ref: c.maskedId,
      cta: c.name,
      what: c.kyc !== 'Verified' ? `KYC ${c.kyc.toLowerCase()}` : c.headline,
      why: c.kyc !== 'Verified' ? `KYC is ${c.kyc.toLowerCase()} — refresh due diligence to keep this relationship compliant.` : c.headline,
      when: '',
      tag: c.kyc !== 'Verified' ? { tone: 'warn', text: 'KYC due' } : undefined,
      rank: 4,
      go,
    }));
}

export default function MyDesk({ cases, onNavigate, onOpenCase, onNewApplication }: { cases: OnboardingCase[]; onNavigate: (d: Dest) => void; onOpenCase: (id: string) => void; onNewApplication: () => void }) {
  const { now, flight, health } = useMemo(() => {
    const all = [
      ...fromCases(cases, onOpenCase),
      ...fromApprovals(approvals, () => onNavigate('approvals')),
      ...fromClients(customers, () => onNavigate('customers')),
    ];
    // "Needs you" is anything a person must touch. Everything else is moving.
    const now = all.filter((i) => i.rank <= 4).sort((a, b) => a.rank - b.rank);
    const flight = all.filter((i) => i.rank > 4);
    // Straight-through = never needed a person. Not "reached account created" —
    // that penalises everything still legitimately in flight.
    const touched = cases.filter((c) => c.state === 'EXCEPTION' || c.validations.some((v) => v.status === 'failed' || v.status === 'timeout')).length;
    const stp = cases.length ? Math.round(((cases.length - touched) / cases.length) * 100) : 0;
    return {
      now, flight,
      health: {
        items: now.length,
        breaching: approvals.filter((a) => a.slaBreaching).length + cases.filter((c) => c.state === 'EXCEPTION').length,
        flight: flight.length,
        stp,
      },
    };
  }, [cases, onNavigate, onOpenCase]);

  // Focus Flow — the desk leads with ONE next best action; "Skip for now" walks
  // the queue instead of dropping the banker into a wall of 40 rows.
  const [focusIdx, setFocusIdx] = useState(0);
  const cur = now.length ? now[Math.min(focusIdx, now.length - 1)] : undefined;

  // Live Maestro status for every onboarding record on the desk (shared hook).
  const mstates = useMaestroStates(useMemo(() => cases.map((c) => c.id), [cases]));

  return (
    <div className="dk-scroll">
      {/* Next move — the single most urgent thing, guided; or an all-clear. */}
      {cur ? (
        <div className="dk-hero">
          <div className="ey"><I n="alert" s={13} w={2.2} />Your next move · {Math.min(focusIdx, now.length - 1) + 1} of {now.length}</div>
          <div className="cust">
            <span className="av">{initials(cur.who)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{cur.who}</div>
              <div className="sub">{cur.ref}{cur.src ? ` · ${cur.src.label}` : ''}{cur.when ? ` · ${cur.when}` : ''}</div>
            </div>
            {cur.tag && <span className={`dk-tag ${cur.tag.tone === 'crit' ? 'red' : cur.tag.tone === 'warn' ? 'amber' : cur.tag.tone === 'good' ? 'green' : 'info'}`}>{cur.tag.text}</span>}
          </div>
          <p className="what">{cur.why}</p>
          <div className="acts">
            <button className="dk-btn pri lg" onClick={cur.go}>Open {cur.cta}</button>
            {now.length > 1 && <button className="skip" onClick={() => setFocusIdx((i) => (i + 1) % now.length)}>Skip for now →</button>}
            <span className="q">{health.items} {health.items === 1 ? 'thing needs' : 'things need'} you</span>
          </div>
        </div>
      ) : (
        <div className="dk-triage green">
          <div className="dk-tin">
            <div className="lft">
              <span className="pip"><I n="check" s={16} w={2.6} /></span>
              <div>
                <div className="hl">Your desk is clear</div>
                <div className="sb">{health.flight} applications are moving without you.</div>
              </div>
            </div>
            <button className="go" onClick={() => onNavigate('open-account')}>Open an account</button>
          </div>
        </div>
      )}

      <div className="dk-health">
        <Stat k="Needs you" v={health.items} tone={health.items ? '#dc2626' : '#16a34a'} />
        <Stat k="Breaching SLA" v={health.breaching} tone={health.breaching ? '#d97706' : undefined} />
        <Stat k="In flight" v={health.flight} sub="no action needed" />
        <Stat k="Straight through" v={`${health.stp}%`} sub="of your openings" tone={health.stp >= 80 ? '#16a34a' : undefined} />
      </div>

      <div className="dk-body">
        <div className="dk-col">
          <div className="dk-qhead">
            <h1>My desk<span className="n">{now.length + flight.length} items</span></h1>
            <button className="dk-btn pri lg" onClick={onNewApplication}><I n="plus" s={15} w={2.4} />New application</button>
          </div>

          <div className="dk-eyebrow"><i className="no">01</i>Needs you now<span className="ln" /><span className="n">{now.length}</span></div>
          {now.length ? <Rows items={now} mstates={mstates} /> : (
            <div className="dk-empty"><b>Nothing waiting on you</b><span>Every application is either moving or done.</span></div>
          )}

          <div className="dk-eyebrow"><i className="no">02</i>In flight<span className="ln" /><span className="n">nothing needed from you</span></div>
          {flight.length ? <Rows items={flight} mstates={mstates} /> : (
            <div className="dk-empty"><b>Nothing in flight</b><span>Start an application and it will track here.</span></div>
          )}
        </div>
      </div>
    </div>
  );
}

/** First letters of the first two words — the hero avatar mark. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—';
}

const GRID = { gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr) 150px 118px 84px 20px' };

function Rows({ items, mstates }: { items: Item[]; mstates: Record<string, LiveStateLite> }) {
  return (
    <div className="dk-rows">
      <div className="dk-cols" style={GRID}>
        <span>Who</span><span>What</span><span>Maestro stage</span><span>Status</span><span>When</span><span />
      </div>
      {items.map((i) => (
        <button key={i.key} className={`dk-row ${i.dot === 'crit' ? 'sev-crit' : i.dot === 'warn' ? 'sev-warn' : ''}`} style={GRID} onClick={i.go}>
          <span className="who">
            <Dot tone={i.dot} live={i.dot === 'info'} />
            <span style={{ minWidth: 0 }}>
              <span className="nm" style={{ display: 'block' }}>{i.who}</span>
              <span className="rf">
                {i.ref}
                {i.src && (
                  <span className={`dk-src ${i.src.kind}`} title={i.src.kind === 'bulk' ? `Bulk upload · ${i.src.label}` : 'Single capture'}>
                    {i.src.kind === 'bulk' && <I n="layers" s={10} w={2.2} />}{i.src.label}
                  </span>
                )}
              </span>
            </span>
          </span>
          <span className="mu">{i.what}</span>
          {i.recordId ? <MaestroCell m={mstates[i.recordId]} /> : <span />}
          <span>{i.tag ? <Tag tone={i.tag.tone}>{i.tag.text}</Tag> : null}</span>
          <span className="rf">{i.when}</span>
          <span className="ch"><I n="chevron" s={15} /></span>
        </button>
      ))}
    </div>
  );
}
