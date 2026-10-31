// A batch, live — one ring for how far it has got, then who has it now: the
// checks, Operations, you (exceptions), or done. Manifest batches show their
// invitation funnel and a one-tap chase for everyone who has gone quiet.
import { useMemo, useState } from 'react';
import { fullName, store, type Invite, type OnboardingCase } from '../../../onboarding';
import { getBatch } from '../../bulk/batches';
import { decisionLabel, inviteStateOf, INVITE_LABEL } from '../../bulk/bulkModel';
import { useNav, useWorkData } from '../nav';
import { NScreen, NSection, NGroup, NRow, NBar, NSegment, NButton, NEmpty, NToast, NBig } from '../nkit';
import { LegendRow, LaneBar } from '../parts';
import { useNk, C } from '../nk';
import { ago } from '../../time';

type Who = 'all' | 'you' | 'ops' | 'done';

export default function BatchLive({ id }: { id: string }) {
  const nav = useNav();
  const nk = useNk();
  const { batched, batches } = useWorkData();
  const meta = useMemo(() => batches.find((b) => b.id === id) ?? getBatch(id), [batches, id]);
  const cases = useMemo(() => batched.filter((c) => c.batchId === id), [batched, id]);
  const [who, setWho] = useState<Who>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const g = useMemo(() => {
    const you = cases.filter((c) => c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD');
    const ops = cases.filter((c) => !c.accountNumber && (c.reviewState === 'awaiting' || c.reviewState === 'approved'));
    const done = cases.filter((c) => !!c.accountNumber || c.state === 'DECLINED');
    const checking = cases.filter((c) => !you.includes(c) && !ops.includes(c) && !done.includes(c));
    return { you, ops, done, checking };
  }, [cases]);
  const pct = cases.length ? Math.round((g.done.length / cases.length) * 100) : 0;
  const manifest = meta?.channel === 'manifest';
  const invites = manifest ? cases.map((c) => inviteStateOf(c)) : [];
  const lapsed = manifest ? cases.filter((c) => inviteStateOf(c) === 'lapsed') : [];

  if (!meta) return <NScreen title="Batch" onBack={nav.pop}><NEmpty icon="layers" title="Batch not found" color={C.gray} /></NScreen>;

  const list = who === 'you' ? g.you : who === 'ops' ? g.ops : who === 'done' ? g.done : cases;
  const open = (c: OnboardingCase) => nav.push(c.state === 'EXCEPTION' ? { k: 'disposition', id: c.id } : { k: 'case', id: c.id });

  const chase = async () => {
    setBusy(true);
    let n = 0;
    try {
      for (const c of lapsed) {
        const inv: Invite = { state: 'sent', sentAt: c.invite?.sentAt ?? c.createdAt, nudges: (c.invite?.nudges ?? 0) + 1, lastNudge: new Date().toISOString() };
        await store.update(c.id, { invite: inv });
        await store.publish(c.id, 'customer-notification', 'Invitation re-sent to complete the application');
        n++;
      }
      setToast(`Reminder logged for ${n} — not sent in this demo`);
    } catch (e) {
      setToast(`Stopped after ${n}: ${(e as Error).message}`);
    } finally { setBusy(false); }
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <NScreen title={meta.name} eyebrow={`${manifest ? 'List of people' : 'Filled forms'} · ${ago(meta.createdAt)}`} onBack={nav.pop}>
      <div className="mw-batchtop">
        <span className="mw-keyline-l">
          <NBig>{pct}<small>%</small></NBig>
          <span className="mw-keyline-r" style={{ color: nk.ink2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: nk.ink }}>decided</span>
            <span><span className="mono">{g.done.length}</span> of <span className="mono">{cases.length}</span></span>
          </span>
        </span>
        <span className="mw-batchtop-r">
          <LegendRow color={C.red} n={g.you.length} label="Needs you" />
          <LegendRow color={C.blue} n={g.checking.length} label="Being checked" />
          <LegendRow color={C.orange} n={g.ops.length} label="With Operations" />
          <LegendRow color={C.green} n={g.done.length} label="Opened or closed" />
        </span>
      </div>
      <LaneBar parts={[{ n: g.you.length, color: C.red }, { n: g.checking.length, color: C.blue }, { n: g.ops.length, color: C.orange }, { n: g.done.length, color: C.green }]} />

      {g.you.length > 0 && (
        <NGroup>
          <NRow tone={C.red} title={<span style={{ color: C.red }}>{g.you.length} need{g.you.length === 1 ? 's' : ''} you</span>}
            subtitle="Each carries its full evidence — decide it with a reason and a note."
            onClick={() => nav.push({ k: 'disposition', id: g.you[0].id })} />
        </NGroup>
      )}
      {g.ops.length > 0 && (
        <NSection footer="OCR read these forms. A maker confirms them, then a different verifier opens the accounts — you’ll see them move here.">
          <NGroup><NRow tone={C.orange} title={`${g.ops.length} with Operations`} subtitle="Maker review, then authorisation" chevron={false} /></NGroup>
        </NSection>
      )}

      {manifest && (
        <NSection title="Invitations">
          <NGroup>
            {(['sent', 'opened', 'completed'] as const).map((st) => {
              const n = st === 'sent' ? cases.length : st === 'opened' ? invites.filter((x) => x === 'opened' || x === 'completed').length : invites.filter((x) => x === 'completed').length;
              return (
                <NRow key={st} title={INVITE_LABEL[st]} chevron={false} value={<span className="mono" style={{ color: nk.ink }}>{n}</span>}>
                  <div style={{ marginTop: 6 }}><NBar value={cases.length ? (n / cases.length) * 100 : 0} color={st === 'completed' ? C.green : nk.brandFill} /></div>
                </NRow>
              );
            })}
          </NGroup>
          {lapsed.length > 0 && <NButton kind="secondary" icon="sms" disabled={busy} onClick={() => void chase()}>Re-send the link to {lapsed.length} who haven’t started</NButton>}
        </NSection>
      )}

      <NSection title="People">
        <NSegment value={who} onChange={setWho} options={[
          { id: 'all', label: 'All', count: cases.length },
          { id: 'you', label: 'You', count: g.you.length },
          { id: 'ops', label: 'Ops', count: g.ops.length },
          { id: 'done', label: 'Done', count: g.done.length },
        ]} />
        {list.length ? (
          <NGroup>
            {list.slice(0, 60).map((c) => {
              const stuck = c.state === 'EXCEPTION' || c.state === 'COMPLIANCE_HOLD';
              const col = c.accountNumber ? C.green : stuck || c.state === 'DECLINED' ? C.red : c.reviewState ? C.purple : C.blue;
              return (
                <NRow key={c.uid ?? c.id} avatar={fullName(c) || '?'} title={fullName(c) || 'Unnamed'} tone={col}
                  subtitle={manifest ? INVITE_LABEL[inviteStateOf(c)] : decisionLabel(c)} detail={c.id} onClick={() => open(c)} />
              );
            })}
          </NGroup>
        ) : <NEmpty title="Nobody here" color={C.gray} />}
      </NSection>
      <NToast text={toast} />
    </NScreen>
  );
}
