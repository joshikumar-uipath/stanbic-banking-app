// ─────────────────────────────────────────────────────────────────────────────
// Invitations — the manifest channel's own screen.
//
// A manifest does not open accounts; it authorises a list of people to open
// their own. So the RM's job after submitting one is not to watch a pipeline,
// it is to watch a FUNNEL: who was invited, who opened the link, who finished,
// and who has gone quiet. Nothing in the app had a shape for that.
//
// The chase actions are bulk by design — nudging nine people one at a time is
// the manual work this whole programme exists to remove.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { fullName, store, type Invite, type InviteState, type OnboardingCase } from '../../onboarding';
import type { BatchMeta } from './batches';
import { I, Tag, type Tone } from '../ui';
import { ago } from '../time';
import { INVITE_LABEL as LABEL, inviteStateOf as stateOf } from './bulkModel';

const TONE: Record<InviteState, Tone> = { sent: 'info', opened: 'warn', completed: 'good', lapsed: 'crit' };

export default function Invites({ meta, cases }: { meta: BatchMeta; cases: OnboardingCase[] }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);

  const rows = useMemo(() => cases.map((c) => ({ c, st: stateOf(c) })), [cases]);
  const count = (s: InviteState) => rows.filter((r) => r.st === s).length;
  /** A funnel counts everyone who got AT LEAST this far — someone who finished
   *  plainly opened the link. Counting the exact state instead made the strip
   *  read "opened 0" beside a funnel bar saying five, for the same people. */
  const reached = (s: InviteState) => (s === 'opened' ? count('opened') + count('completed') : count(s));
  const lapsed = rows.filter((r) => r.st === 'lapsed');

  const nudge = async (only?: OnboardingCase[]) => {
    const targets = only ?? lapsed.map((r) => r.c);
    if (!targets.length) return;
    setBusy(true);
    for (const c of targets) {
      const inv: Invite = {
        state: 'sent',
        sentAt: c.invite?.sentAt ?? c.createdAt,
        nudges: (c.invite?.nudges ?? 0) + 1,
        lastNudge: new Date().toISOString(),
      };
      await store.update(c.id, { invite: inv });
      await store.publish(c.id, 'customer-notification', 'Invitation re-sent to complete the application');
    }
    setSent(targets.length);
    setBusy(false);
  };

  return (
    <div className="bk-pane">
      <header className="bk-head">
        <div>
          <h1>Invitations</h1>
          <p>{meta.name} · the manifest named {cases.length} {cases.length === 1 ? 'person' : 'people'}. Each fills the form themselves — this is how far they have got.</p>
        </div>
        <span className="bk-br">BR-SUB-01 · BR-SUB-09 · §7.4</span>
      </header>

      <div className="bk-stats four">
        <div><span className="k">Invited</span><b>{cases.length}</b></div>
        <div><span className="k">Opened the link</span><b>{reached('opened')}</b></div>
        <div><span className="k">Completed</span><b className="ok">{count('completed')}</b></div>
        <div className="amber"><span className="k">No response</span><b className="warn">{count('lapsed')}</b></div>
      </div>

      <div className="bk-funnel">
        {(['sent', 'opened', 'completed'] as InviteState[]).map((s, i) => {
          const n = s === 'sent' ? cases.length : reached(s);
          const pct = cases.length ? Math.round((n / cases.length) * 100) : 0;
          return (
            <div className="st" key={s}>
              <span className="l">{i + 1}. {LABEL[s]}</span>
              <span className="b"><i style={{ width: `${pct}%` }} /></span>
              <span className="v">{n} <em>{pct}%</em></span>
            </div>
          );
        })}
      </div>

      {lapsed.length > 0 && (
        <div className="bk-chase">
          <div className="t">
            <b>{lapsed.length} {lapsed.length === 1 ? 'person has' : 'people have'} not started</b>
            <span className="mu">Invited {ago(lapsed[0].c.createdAt)}{lapsed[0].c.invite?.lastNudge ? ` · last nudged ${ago(lapsed[0].c.invite.lastNudge)}` : ' · never nudged'}</span>
          </div>
          <button className="dk-btn" disabled={busy} onClick={() => void nudge()}><I n="zap" s={13} />Re-send the link to all {lapsed.length}</button>
          <button className="dk-btn" disabled={busy} onClick={() => void nudge()}>Send by WhatsApp</button>
          {sent > 0 && <span className="ok">Re-sent to {sent}.</span>}
        </div>
      )}

      <div className="bk-table inv">
        <div className="hd"><span>Customer</span><span>Contact</span><span>Where they got to</span><span>Nudges</span><span>Age</span></div>
        {rows.map(({ c, st }) => (
          <div className="rw" key={c.uid ?? c.id}>
            <span className="nm">{fullName(c) || 'Unnamed'}<span className="mono sub">{c.id}</span></span>
            <span className="mu">{c.email || c.phone || '—'}</span>
            <span><Tag tone={TONE[st]}>{LABEL[st]}</Tag>{c.accountNumber && <span className="mono sub">Acct {c.accountNumber}</span>}</span>
            <span className="mu">{c.invite?.nudges ?? 0}</span>
            <span className="mu">{ago(c.createdAt)}</span>
          </div>
        ))}
      </div>

      <div className="bk-note">
        The link carries a token tied to the manifest row, so the reference, {' '}
        <b>BVN</b> and <b>NIN</b> are fixed before the customer types anything — which is what makes the
        manifest a control on who gets onboarded rather than just a mailing list.
      </div>
    </div>
  );
}
