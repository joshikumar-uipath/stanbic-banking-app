// Search across openings, approvals and clients at once (the desk's Find model).
import { useMemo, useState } from 'react';
import { findHits } from '../../findModel';
import { useNav, useWorkData } from '../nav';
import { NScreen, NGroup, NRow, NSearchField, NEmpty, NStatus } from '../nkit';
import { C } from '../nk';
import { storyOf, name } from '../story';
import { routeFor } from '../routes';

const TONE: Record<string, string> = { crit: C.red, warn: C.orange, good: C.green, info: C.blue, idle: C.gray };

export default function Find() {
  const nav = useNav();
  const { branch, all } = useWorkData();
  // The RM searches their branch; Operations searches the bank.
  const pool = nav.role === 'rm' ? branch : all;
  const byKey = useMemo(() => new Map(pool.map((c) => [`c-${c.uid ?? c.id}`, c])), [pool]);
  const [q, setQ] = useState('');
  const hits = useMemo(() => findHits(q, pool,
    (d) => (d === 'approvals' ? nav.openApprovals() : d === 'customers' ? nav.openClients() : undefined),
    (id) => nav.push(routeFor(nav.role, pool.find((c) => c.id === id)!)), 50), [q, pool, nav]);
  return (
    <NScreen title="Search" onBack={nav.pop} header={<NSearchField value={q} onChange={setQ} placeholder="Name, reference or account" autoFocus />}>
      {q.trim().length < 2 ? (
        <NEmpty icon="search" title="Find anyone" color={C.blue}>Customers, applications, approvals and clients — whichever queue they are in.</NEmpty>
      ) : hits.length ? (
        <NGroup>
          {hits.map((h) => (
            (() => {
              // An application reads in the same four plain statuses as everywhere else.
              const c = byKey.get(h.key);
              const st = c ? storyOf(c) : null;
              return (
                <NRow key={h.key} title={c ? name(c) : h.who} subtitle={h.sub} detail={h.maestro ? `Maestro · ${h.maestro}` : undefined}
                  value={st ? <NStatus color={st.color}>{st.label}</NStatus> : <NStatus color={TONE[h.tone] ?? C.gray}>{h.kind}</NStatus>} onClick={h.go} />
              );
            })()
          ))}
        </NGroup>
      ) : (
        <NEmpty icon="search" title="No match" color={C.gray}>Nothing for “{q.trim()}”. Try a surname or part of the reference.</NEmpty>
      )}
    </NScreen>
  );
}
