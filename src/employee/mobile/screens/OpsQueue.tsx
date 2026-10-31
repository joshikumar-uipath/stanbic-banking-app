// The analyst's queue. Swipe right to take a case, left to escalate it; tap to
// triage. Oldest first — it has waited longest.
import { useMemo, useState } from 'react';
import { slaOf } from '../../../ops/derive';
import { isOpsCase, ageMin, CAUSES, deriveCause, assignee, claim, escalate, ME, type Cause } from '../../../ops/opsModel';
import { useNav, useWorkData } from '../nav';
import { name } from '../story';
import { NScreen, NGroup, NRow, NSegment, NStatus, NEmpty, NToast } from '../nkit';
import { C } from '../nk';
import { useOwners } from '../useOwners';

type View = 'all' | 'unassigned' | 'mine' | 'sla';

export default function OpsQueue({ cause }: { cause?: string }) {
  const nav = useNav();
  const { all } = useWorkData();
  useOwners();
  const byCause = cause && cause in CAUSES ? (cause as Cause) : null;
  const [view, setView] = useState<View>(cause === 'sla' ? 'sla' : cause === 'unassigned' ? 'unassigned' : 'all');
  const [toast, setToast] = useState<string | null>(null);
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2000); };

  const open = useMemo(() => all.filter(isOpsCase).filter((c) => !byCause || deriveCause(c) === byCause).sort((a, b) => ageMin(b) - ageMin(a)), [all, byCause]);
  const list = open.filter((c) => view === 'all' ? true : view === 'unassigned' ? !assignee(c) : view === 'mine' ? assignee(c) === ME : slaOf(c).tone === 'breach');

  return (
    <NScreen title={byCause ? CAUSES[byCause].title : 'Queue'} eyebrow={`${open.length} open`} onBack={nav.pop}
      header={<NSegment value={view} onChange={setView} options={[
        { id: 'all', label: 'All' },
        { id: 'sla', label: 'Past SLA' },
        { id: 'unassigned', label: 'Unowned' },
        { id: 'mine', label: 'Mine' },
      ]} />}>
      {list.length ? (
        <>
          <NGroup>
            {list.map((c) => {
              const sla = slaOf(c);
              const who = assignee(c);
              const nm = name(c);
              return (
                <NRow key={c.uid ?? c.id} avatar={nm} title={nm}
                  subtitle={CAUSES[deriveCause(c)].title}
                  detail={`${c.id} · ${who ? (who === ME ? 'Yours' : `With ${who}`) : 'Unowned'}`}
                  value={<NStatus color={sla.tone === 'breach' ? C.red : sla.tone === 'warn' ? C.orange : C.gray}>{sla.label}</NStatus>}
                  onClick={() => nav.push({ k: 'opsCase', id: c.id })}
                  lead={who === ME ? undefined : { label: 'Take it', icon: 'hand', color: C.green, run: () => { claim(c.id, ME); flash(`${c.firstName || 'Case'} is yours`); } }}
                  trail={{ label: 'Escalate', icon: 'up', color: C.orange, run: () => { escalate(c.id).then(() => flash('Escalated to a supervisor')).catch((e: Error) => flash(e.message)); } }} />
              );
            })}
          </NGroup>
          <p className="mw-hint">Swipe right to take a case, left to escalate it.</p>
        </>
      ) : <NEmpty title="Clear" color={C.green}>Nothing in this view.</NEmpty>}
      <NToast text={toast} />
    </NScreen>
  );
}
