// The pipeline — every customer this branch captured, by lane. Swipe a row
// right to call the customer, left to nudge them with their KYC link.
import { useMemo, useState } from 'react';
import { fullName, store } from '../../../onboarding';
import { useNav, useWorkData } from '../nav';
import { telHref } from '../links';
import { NScreen, NGroup, NRow, NChips, NSearchField, NEmpty, NToast } from '../nkit';
import { C } from '../nk';
import { storyOf, name, type Lane } from '../story';
import { ago } from '../../time';

const LANES: { id: Lane | 'all'; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'you', label: 'Needs you', color: C.red },
  { id: 'customer', label: 'Waiting on customer', color: C.orange },
  { id: 'moving', label: 'Moving', color: C.blue },
  { id: 'done', label: 'Opened', color: C.green },
  { id: 'closed', label: 'Declined', color: C.gray },
];

export default function Pipeline({ lane: initial = 'all' }: { lane?: Lane | 'all' }) {
  const nav = useNav();
  const { branch } = useWorkData();
  const [lane, setLane] = useState<Lane | 'all'>(initial);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(40);
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: branch.length };
    for (const c of branch) { const l = storyOf(c).lane; m[l] = (m[l] ?? 0) + 1; }
    return m;
  }, [branch]);

  const list = useMemo(() => {
    let l = lane === 'all' ? branch : branch.filter((c) => storyOf(c).lane === lane);
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((c) => fullName(c).toLowerCase().includes(t) || c.id.toLowerCase().includes(t) || (c.accountNumber ?? '').includes(t));
    return l;
  }, [branch, lane, q]);

  const nudge = async (id: string, who: string) => {
    try {
      await store.publish(id, 'customer-notification', 'KYC link re-sent by SMS from the RM’s phone', { resend: true, channel: 'sms' });
      setToast(`Link logged for ${who} — no SMS goes out in this demo`);
    } catch (e) { setToast(`Couldn’t log it: ${(e as Error).message}`); }
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <NScreen title="Pipeline" onBack={nav.pop} backLabel="Today"
      header={<>
        <NSearchField value={q} onChange={setQ} placeholder="Name, reference or account" />
        <NChips value={lane} onChange={(v) => { setLane(v); setShown(40); }} options={LANES.map((l) => ({ ...l, count: counts[l.id] ?? 0 }))} />
      </>}>
      {list.length ? (
        <>
          <NGroup>
            {list.slice(0, shown).map((c) => {
              const s = storyOf(c);
              const who = c.firstName || name(c);
              return (
                <NRow key={c.uid ?? c.id} avatar={name(c)} title={name(c)} tone={s.color}
                  subtitle={s.label} detail={`${c.id}${c.batchId ? ' · batch' : ''} · ${ago(c.createdAt)}`}
                  onClick={() => nav.push({ k: 'case', id: c.id })}
                  lead={telHref(c.phone) ? { label: 'Call', icon: 'phone', color: C.green, run: () => { window.location.href = telHref(c.phone)!; } } : undefined}
                  trail={s.lane !== 'done' && s.lane !== 'closed' ? { label: 'Send link', icon: 'sms', color: C.blue, run: () => void nudge(c.id, who) } : undefined}
                />
              );
            })}
          </NGroup>
          {list.length > shown && (
            <button type="button" className="mw-more tap" onClick={() => setShown((n) => n + 40)}>Show {Math.min(40, list.length - shown)} more</button>
          )}
          <p className="mw-hint">Swipe right to call, left to send the KYC link.</p>
        </>
      ) : (
        <NEmpty icon="search" title="No one here" color={C.gray}>{q ? `Nobody matches “${q.trim()}”.` : 'This lane is empty.'}</NEmpty>
      )}
      <NToast text={toast} />
    </NScreen>
  );
}
