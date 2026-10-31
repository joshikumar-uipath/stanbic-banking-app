// ─────────────────────────────────────────────────────────────────────────────
// My desk — the banker's landing screen on /employee-web.
//
// The premise: open it and know what to do next. Everything waiting on this
// person, from every source (openings, approvals, clients), ranked into one
// list — "needs you now" above "in flight, nothing needed from you". That split
// IS the Progress-First story: most of the pipeline is moving without them.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import type { OnboardingCase } from '../../onboarding';
import { approvals } from '../../approvalsData';
import { customers } from '../../customersData';
import { I, Tag, Dot, Stat } from '../ui';
import { useMaestroStates, MaestroCell } from '../maestroStatus';
import type { LiveStateLite } from '../../onboarding/maestro';
import { FILTERS, SOURCES, KINDS, matchesFilters, isFiltering, type Filter, type Src, type Kind } from '../caseFilters';
import type { Dest } from '../DeskShell';
import { fromCases, fromApprovals, fromClients, deskHealth, type Item } from '../deskItems';

export default function MyDesk({ cases, onNavigate, onOpenCase, onNewApplication }: { cases: OnboardingCase[]; onNavigate: (d: Dest) => void; onOpenCase: (id: string) => void; onNewApplication: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState<Src>('all');
  const [kind, setKind] = useState<Kind>('all');
  const f = { filter, source, kind };
  const narrowed = isFiltering(f);

  const { now, flight, health } = useMemo(() => {
    const all = [
      ...fromCases(cases.filter((c) => matchesFilters(c, f)), onOpenCase),
      // Approvals and KYC rows are not applications — they have no source and no
      // type, so they cannot satisfy a narrowed filter. Rather than leave them
      // sitting there looking unfiltered, they drop out until the filters clear.
      ...(narrowed ? [] : fromApprovals(approvals, () => onNavigate('approvals'))),
      ...(narrowed ? [] : fromClients(customers, () => onNavigate('customers'))),
    ];
    // "Needs you" is anything a person must touch. Everything else is moving.
    const now = all.filter((i) => i.rank <= 4).sort((a, b) => a.rank - b.rank);
    const flight = all.filter((i) => i.rank > 4);
    return {
      now, flight,
      health: deskHealth(cases),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, onNavigate, onOpenCase, filter, source, kind]);

  // Focus Flow — the desk leads with ONE next best action; "Skip for now" walks
  // the queue instead of dropping the banker into a wall of 40 rows.
  const [focusIdx, setFocusIdx] = useState(0);

  // The two lanes fold, the same way the pipeline's groups do on Open an account.
  // A banker who has cleared "needs you now" wants the in-flight lane out of the
  // way — and one who is working the queue wants the opposite.
  const [lanes, setLanes] = useState({ now: true, flight: true });
  const anyLaneOpen = lanes.now || lanes.flight;
  const setAllLanes = (v: boolean) => setLanes({ now: v, flight: v });
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
            {/* Counts what the banker is actually looking at — equal to the desk
                total until a filter narrows the view. */}
            <span className="q">{now.length} {now.length === 1 ? 'thing needs' : 'things need'} you</span>
          </div>
        </div>
      ) : narrowed ? null : (
        // Only an all-clear when the whole desk really is clear. Under a filter an
        // empty queue means "nothing matches", which is not the same news.
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
            <h1>My desk<span className="n">{now.length + flight.length} {now.length + flight.length === 1 ? 'item' : 'items'}</span></h1>
            <button className="dk-btn pri lg" onClick={onNewApplication}><I n="plus" s={15} w={2.4} />New application</button>
          </div>

          <div className="dk-deskfilters">
            <div className="dk-segs">
              {FILTERS.map((x) => (
                <button key={x.id} aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>{x.label}</button>
              ))}
            </div>
            <div className="dk-segs">
              {SOURCES.map((x) => (
                <button key={x.id} aria-pressed={source === x.id} onClick={() => setSource(x.id)}>{x.label}</button>
              ))}
            </div>
            <div className="dk-segs">
              {KINDS.map((x) => (
                <button key={x.id} aria-pressed={kind === x.id} onClick={() => setKind(x.id)}>{x.label}</button>
              ))}
            </div>
            {narrowed && (
              <button className="dk-clearf" onClick={() => { setFilter('all'); setSource('all'); setKind('all'); }}>
                Clear filters
              </button>
            )}
            <button className="dk-btn" style={{ marginLeft: 'auto' }} onClick={() => setAllLanes(!anyLaneOpen)}>
              <I n={anyLaneOpen ? 'collapse' : 'expand'} s={14} />{anyLaneOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          <button className="dk-eyebrow tog" aria-expanded={lanes.now} onClick={() => setLanes((l) => ({ ...l, now: !l.now }))}>
            <span className="tw"><I n="chevron" s={13} /></span><i className="no">01</i>Needs you now<span className="ln" /><span className="n">{now.length}</span>
          </button>
          {lanes.now && (now.length ? <Rows items={now} mstates={mstates} /> : narrowed ? (
            <div className="dk-empty"><b>Nothing here matches</b><span>No work needing you fits the filters you have set.</span></div>
          ) : (
            <div className="dk-empty"><b>Nothing waiting on you</b><span>Every application is either moving or done.</span></div>
          ))}

          <button className="dk-eyebrow tog" aria-expanded={lanes.flight} onClick={() => setLanes((l) => ({ ...l, flight: !l.flight }))}>
            <span className="tw"><I n="chevron" s={13} /></span><i className="no">02</i>In flight<span className="ln" /><span className="n">{lanes.flight ? 'nothing needed from you' : `${flight.length} hidden`}</span>
          </button>
          {lanes.flight && (flight.length ? <Rows items={flight} mstates={mstates} /> : narrowed ? (
            <div className="dk-empty"><b>Nothing here matches</b><span>No application in flight fits the filters you have set.</span></div>
          ) : (
            <div className="dk-empty"><b>Nothing in flight</b><span>Start an application and it will track here.</span></div>
          ))}
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
                {i.corporate && <span className="dk-src corp" title="Business account">Corporate</span>}
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
