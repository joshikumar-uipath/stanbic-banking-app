// The applicant — Profile, Identity checks and Documents. Identity shows what
// went to the bureaux and what came back, field by field; Documents carries the
// accept / ask-for-a-new-one decision when the rules referred something.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icn } from '../../../components/customerUi';
import { store, type OnboardingCase, type ValidationStatus } from '../../../onboarding';
import { bvnExchange, ninCheckExchange, ninLinkExchange, type Exchange } from '../../../integrations/kyc';
import { documentsFor, documentsOutcome, type DocResult } from '../../../integrations/docChecks';
import type { Outcome } from '../../../integrations/docRules';
import { getOperator } from '../../../onboarding/operator';
import { getLinkedInstance, getCachedState } from '../../../onboarding/maestro';
import { getActiveCountry, kycLabel } from '../../../config/countries';
import { useNav, useWorkData, type ApplicantTab } from '../nav';
import { NScreen, NSection, NGroup, NRow, NCard, NSegment, NButton, NStatus, NEmpty, Glyph } from '../nkit';
import { useNk, C } from '../nk';
import { name } from '../story';

const CO = getActiveCountry();
const OUT: Record<Outcome | 'n/a', string> = { Pass: C.green, 'Quick review': C.blue, Refer: C.orange, Fail: C.red, 'n/a': C.gray };

export default function Applicant({ id, tab }: { id: string; tab?: ApplicantTab }) {
  const nav = useNav();
  const c = useWorkData().byId(id);
  const [t, setT] = useState<ApplicantTab>(tab ?? 'profile');
  if (!c) return <NScreen title="Applicant" onBack={nav.pop} large={false}><NEmpty icon="user" title="Not found" color={C.gray} /></NScreen>;
  return (
    <NScreen title={name(c)} onBack={nav.pop} large={false}
      header={<NSegment value={t} onChange={setT} options={[{ id: 'profile', label: 'Profile' }, { id: 'identity', label: 'Identity' }, { id: 'documents', label: 'Documents' }]} />}>
      {t === 'profile' && <Profile c={c} />}
      {t === 'identity' && <Identity c={c} />}
      {t === 'documents' && <Documents c={c} />}
    </NScreen>
  );
}

/** An identity number, masked to its last four until the banker asks to see it
 *  (and hidden again after half a minute). */
function Masked({ value }: { value: string }) {
  const nk = useNk();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(false), 30_000);
    return () => window.clearTimeout(t);
  }, [shown]);
  const tail = value.replace(/\s+/g, '').slice(-4);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className="mono">{shown ? value : `•••• ${tail}`}</span>
      <button type="button" className="nk-link" style={{ color: nk.accent, minHeight: 32, padding: 0, fontSize: 14 }}
        aria-label={shown ? 'Hide the number' : 'Show the full number'} onClick={() => setShown((v) => !v)}>{shown ? 'Hide' : 'Show'}</button>
    </span>
  );
}
/** Identity numbers inside a bureau match are shown by their last four only. */
const hideId = (field: string, v?: string) => (v && /\b(BVN|NIN|ID|TIN)\b/i.test(field) && v.replace(/\D/g, '').length >= 6 ? `•••• ${v.replace(/\D/g, '').slice(-4)}` : v);
const mask = (v?: string) => (v ? <Masked value={v} /> : undefined);

function KV({ rows }: { rows: [string, ReactNode | undefined, boolean?][] }) {
  const nk = useNk();
  const shown = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!shown.length) return null;
  return (
    <NGroup>
      {shown.map(([k, v, mono]) => (
        <div key={k} className="mw-kv" style={{ borderColor: nk.sep }}>
          <span style={{ color: nk.ink2 }}>{k}</span>
          <b className={mono ? 'mono' : undefined} style={{ color: nk.ink }}>{v}</b>
        </div>
      ))}
    </NGroup>
  );
}

function Profile({ c }: { c: OnboardingCase }) {
  const e = c.entity;
  return (
    <>
      {e && <NSection title="Business"><KV rows={[['Registered name', e.companyName], ['RC number', e.rcNumber, true], ['TIN', mask(e.tin)], ['Category', e.businessType], ['Sector', e.sector], ['Turnover', e.turnover], ['Address', e.address]]} /></NSection>}
      {e?.directors.length ? (
        <NSection title="Directors">
          <NGroup>{e.directors.map((d, i) => <NRow key={i} title={d.name || 'Unnamed'} subtitle={[d.role, d.bvn && `BVN •••• ${d.bvn.slice(-4)}`].filter(Boolean).join(' · ')} />)}</NGroup>
        </NSection>
      ) : null}
      <NSection title={e ? 'Signatory' : 'Personal'}>
        <KV rows={[['Name', [c.title, c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')], ['Date of birth', c.dob], ['Gender', c.gender], ['Marital status', c.maritalStatus], ['Nationality', c.nationality], ['State of origin', c.stateOfOrigin]]} />
      </NSection>
      <NSection title="Contact">
        <KV rows={[['Phone', c.phone, true], ['Email', c.email], ['Address', c.address], ['City', c.city], ['State', c.stateOfResidence]]} />
      </NSection>
      <NSection title="Identity numbers">
        <KV rows={[[kycLabel('BVN', CO), mask(c.bvn)], [kycLabel('NIN', CO), mask(c.nin)], ['Means of ID', c.idType], ['ID number', mask(c.idNumber)], ['TIN', mask(c.tin)]]} />
      </NSection>
      <NSection title="Work and account">
        <KV rows={[[c.channel === 'bulk' ? 'Batch' : 'Employer', c.employer], ['Occupation', c.occupation], ['Income', c.incomeBand], ['Account type', c.accountType], ['Branch', c.branch], ['Account number', c.accountNumber, true]]} />
      </NSection>
      {c.nextOfKin && <NSection title="Next of kin"><KV rows={[['Name', c.nextOfKin.name], ['Relationship', c.nextOfKin.relationship], ['Phone', c.nextOfKin.phone, true]]} /></NSection>}
      <NSection title="How it arrived">
        <KV rows={[['Channel', c.channel === 'bulk' ? 'Bulk upload' : c.channel === 'self' ? 'Customer self-service' : 'Walk-in / direct'], ['Captured by', c.capturedBy], ['Batch', c.batchId, true], ['Form', c.documentName], ['Opened', new Date(c.createdAt).toLocaleString()]]} />
      </NSection>
    </>
  );
}

function Identity({ c }: { c: OnboardingCase }) {
  const nav = useNav();
  const inst = getLinkedInstance(c.id);
  const live = inst ? getCachedState(inst) : null;
  const st: Partial<Record<string, ValidationStatus>> = Object.fromEntries((live?.checks?.length ? live.checks : c.validations).map((x) => [x.kind, x.status]));
  return <>{[bvnExchange(c, st.BVN), ninCheckExchange(c, st.NIN), ninLinkExchange(c)].map((x) => <ExchangeCard key={x.service} x={x} technical={nav.role === 'ops'} />)}</>;
}

/** One bureau check. The request line and raw payload are for Operations; a
 *  banker in the field sees the verdict and the field-by-field match. */
function ExchangeCard({ x, technical }: { x: Exchange; technical?: boolean }) {
  const nk = useNk();
  const [raw, setRaw] = useState(false);
  const col = x.verdict.tone === 'good' ? C.green : x.verdict.tone === 'crit' ? C.red : C.gray;
  const r = x.response;
  return (
    <NSection title={x.name.split(' · ')[0]}>
      <NCard>
        <div className="mw-xv" style={{ color: col }}>
          <Icn name={x.verdict.tone === 'good' ? 'check' : x.verdict.tone === 'crit' ? 'close' : 'clock'} size={18} color="currentColor" strokeWidth={2.6} />
          <span>{x.verdict.text || 'Not sent yet'}</span>
        </div>
        <p style={{ fontSize: 14, color: nk.ink2, margin: '8px 0 0', lineHeight: 1.45 }}>{x.note || x.purpose}</p>
        {r && technical && <div className="mw-xmeta" style={{ color: nk.ink3 }}><span className="mono">{x.method} {x.path}</span><span>{r.http} · {r.latencyMs} ms</span></div>}
      </NCard>
      {x.matches.length > 0 && (
        <NGroup>
          {x.matches.map((m) => (
            <div key={m.field} className="mw-match" style={{ borderColor: nk.sep }}>
              <span className="mw-match-i"><Glyph color={m.ok ? C.green : C.red} size={10} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: nk.ink }}>{m.field}</div>
                <div style={{ fontSize: 13, color: nk.ink2, marginTop: 2 }}>Form <b className="mono">{hideId(m.field, m.application) || '—'}</b> · Bureau <b className="mono">{hideId(m.field, m.authority) || '—'}</b></div>
              </div>
            </div>
          ))}
        </NGroup>
      )}
      {r && technical && (
        <>
          <button type="button" className="nk-link" style={{ color: nk.accent, alignSelf: 'flex-start', padding: '0 4px' }} onClick={() => setRaw((v) => !v)}>{raw ? 'Hide' : 'Show'} the raw request and response</button>
          {raw && <pre className="mw-json" style={{ background: nk.card, color: nk.ink2 }}>{JSON.stringify({ request: x.body, response: r.body }, null, 2)}</pre>}
        </>
      )}
    </NSection>
  );
}

function Documents({ c }: { c: OnboardingCase }) {
  const nav = useNav();
  const { all } = useWorkData();
  const docs = useMemo(() => documentsFor(c, all), [c, all]);
  const overall = documentsOutcome(docs);
  const [busy, setBusy] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);
  const review = c.documentReview;
  const decide = async (decision: 'accepted' | 'new-document-requested') => {
    setBusy(true);
    const by = getOperator() || 'Relationship Manager';
    try {
      await store.update(c.id, { documentReview: { by, at: new Date().toISOString(), decision } });
      await store.publish(c.id, decision === 'accepted' ? 'exception-queue' : 'customer-notification',
        decision === 'accepted' ? `Document checks referred by the rules were accepted by ${by}` : `A new document was requested from ${c.firstName ?? 'the customer'}`);
    } catch (e) { setDocErr((e as Error).message || 'Could not save — nothing was changed.'); } finally { setBusy(false); }
  };
  if (!docs.length) return <NEmpty icon="doc" title="No documents" color={C.gray}>This application was captured without one.</NEmpty>;
  const needs = (overall === 'Refer' || overall === 'Fail') && !review;
  return (
    <>
      <NSection title="Documents" aside="Judged against the bank’s document rules">
        <div className="mw-xv" style={{ color: review ? C.green : OUT[overall], fontSize: 18 }}>
          <Glyph color={review ? C.green : OUT[overall]} size={10} />
          <span>{review ? (review.decision === 'accepted' ? `Accepted by ${review.by}` : 'New document requested')
            : overall === 'Pass' ? 'Every document passed' : overall === 'Quick review' ? 'One needs a quick look' : overall === 'Refer' ? 'A person needs to look' : 'A document failed'}</span>
        </div>
        {docErr && <div role="alert" style={{ fontSize: 14, color: C.red }}>{docErr}</div>}
        {needs && (
          <div className="nk-footer-row" style={{ marginTop: 6 }}>
            <NButton kind="secondary" disabled={busy} onClick={() => void decide('new-document-requested')}>Ask for a new one</NButton>
            <NButton disabled={busy} onClick={() => void decide('accepted')}>Accept</NButton>
          </div>
        )}
      </NSection>
      {docs.map((d) => <DocCard key={d.type + (d.file ?? '')} d={d} technical={nav.role === 'ops'} />)}
    </>
  );
}

/** One document's checks. Checks that weren't applicable (nothing to analyse)
 *  are Operations detail; the banker sees the ones that decided something. */
function DocCard({ d, technical }: { d: DocResult; technical?: boolean }) {
  const lines = technical ? d.lines : d.lines.filter((l) => (l.outcome as string) !== 'n/a');
  return (
    <NSection title={d.label}>
      <NGroup>
        <NRow icon={{ name: 'doc', color: OUT[d.outcome] }} title={d.file ?? 'From the application'}
          subtitle={d.from ? (d.from === 'third-party' ? 'Third party' : d.from === 'bank' ? 'Bank' : 'Customer') : undefined}
          value={<NStatus color={OUT[d.outcome]}>{d.outcome}</NStatus>} />
        {lines.map((l) => <NRow key={l.check} tone={OUT[l.outcome]} title={l.label} subtitle={l.detail} detail={technical && l.rule ? `Rule ${l.rule}${l.ref ? ` · ${l.ref}` : ''}` : undefined} />)}
      </NGroup>
    </NSection>
  );
}

