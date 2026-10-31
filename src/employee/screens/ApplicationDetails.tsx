import { useEffect, useMemo, useState } from 'react';
import { store, type OnboardingCase } from '../../onboarding';
import { confidenceThresholdPct } from '../../integrations/docRules';
import { stateMeta, isCorporate } from '../../onboarding/types';
import { Brand } from '../../customer/ui';
import Icon from '../../customer/icons';
import { toRows, type ReviewField } from '../../customer/ExtractionReview';
import KycExchange from './KycExchange';
import DocumentChecks from './DocumentChecks';
import { bvnExchange, ninCheckExchange, ninLinkExchange } from '../../integrations/kyc';
import type { ValidationStatus } from '../../onboarding/types';
// Each module is pinned to its own Orchestrator folder, so the case type picks
// the set — reading an individual instance through the corporate helpers 404s,
// and vice versa.
import * as corp from '../../onboarding/maestro-corporate';
import * as indiv from '../../onboarding/maestro';
import { getActiveCountry, kycLabelAuthority } from '../../config/countries';
import { maestroConfig } from '../../onboarding/maestro';

// ─────────────────────────────────────────────────────────────────────────────
// Application details — who the applicant is.
//
// Split of duties with the pane beside it, and it is worth being strict about:
//
//   this popup  →  the APPLICANT. Facts that do not change as the case moves:
//                  identity, contact, the business and its directors, the form
//                  they handed over and what was read from it.
//   the pane    →  the CASE. Everything that does move: stage, steps, the task
//                  it is waiting on, checks, messages, activity, the account.
//
// An earlier pass put checks, account and history in here too — all three were
// already in the pane, so the same facts were maintained in two places and the
// popup stopped being about the applicant at all.
// ─────────────────────────────────────────────────────────────────────────────

const CO = getActiveCountry();

const CHANNEL_LABEL: Record<string, string> = {
  self: 'Customer self-service', bulk: 'Bulk upload', single: 'Walk-in / direct',
};
const SOURCE_LABEL: Record<string, string> = {
  rm: 'Relationship manager', branch: 'Branch', 'contact-centre': 'Contact centre',
  agent: 'Agent banking', customer: 'Customer self-service', mobile: 'Mobile app',
  web: 'Internet banking', whatsapp: 'WhatsApp', partner: 'Partner referral', email: 'Email',
};

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');
const band = (c: number, missing: boolean) => (missing || c < confidenceThresholdPct() ? 'lo' : c < 90 ? 'mid' : 'hi');

/** A field while the record is being edited: its current text and a setter. */
type EditBind = { value: string; set: (v: string) => void };

function Row({ label, value, mono, edit }: { label: string; value?: string; mono?: boolean; edit?: EditBind }) {
  const v = (value ?? '').trim();
  if (edit) {
    return (
      <div className="ad-row editing">
        <dt>{label}</dt>
        <dd>
          <input className={`ad-input${mono ? ' num' : ''}`} value={edit.value} aria-label={label}
                 placeholder="Not captured" onChange={(ev) => edit.set(ev.target.value)} />
        </dd>
      </div>
    );
  }
  return (
    <div className="ad-row">
      <dt>{label}</dt>
      <dd className={`${v ? '' : 'empty'} ${mono ? 'num' : ''}`}>{v || 'Not captured'}</dd>
    </div>
  );
}

// The record's own fields a person can correct here. Everything the Applicant and
// Employment & account tabs show, bar provenance (channel, batch, timestamps),
// which is a fact about how the record arrived rather than about the applicant.
const EDITABLE = [
  'title', 'firstName', 'middleName', 'lastName', 'dob', 'gender', 'maritalStatus', 'motherMaidenName',
  'nationality', 'stateOfOrigin', 'bvn', 'nin', 'idType', 'idNumber', 'idExpiry', 'tin',
  'phone', 'altPhone', 'email', 'address', 'city', 'stateOfResidence', 'lga', 'yearsAtAddress',
  'employmentStatus', 'occupation', 'employer', 'incomeBand', 'sourceOfFunds',
  'accountType', 'accountPurpose', 'branch',
] as const;
const ENTITY_EDITABLE = ['companyName', 'rcNumber', 'tin', 'businessType', 'sector', 'turnover', 'address', 'email', 'phone'] as const;
const NOK_EDITABLE = ['name', 'relationship', 'phone', 'address'] as const;

/** The record as flat strings, keyed the way the form binds them. */
function snapshot(c: OnboardingCase): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of EDITABLE) out[k] = String(c[k] ?? '');
  for (const k of ENTITY_EDITABLE) out[`entity.${k}`] = String(c.entity?.[k] ?? '');
  for (const k of NOK_EDITABLE) out[`nok.${k}`] = String(c.nextOfKin?.[k] ?? '');
  return out;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="ad-sec">
      <h3>{title}{count != null && <em>{count}</em>}</h3>
      {children}
    </section>
  );
}

function Nothing({ children }: { children: React.ReactNode }) {
  return <div className="ad-none">{children}</div>;
}

export default function ApplicationDetails({ c, instanceId, onReviewExtraction, onClose, initialTab, checkStatus = {} }: {
  c: OnboardingCase;
  /** Open on this tab rather than the applicant (the BVN/NIN buttons in Checks). */
  initialTab?: 'bvn' | 'nin' | 'docs';
  /** Each check's status as the case reports it, so the calls shown agree with it. */
  checkStatus?: Partial<Record<string, ValidationStatus>>;
  /** The live case, when this record has one — the extraction is read from it. */
  instanceId?: string | null;
  /** Present while the case is still parked at its extraction gate. */
  onReviewExtraction?: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const e = c.entity;
  const meta = stateMeta(c.state);
  const corporate = isCorporate(c);
  const title = e?.companyName?.trim() || `${c.firstName} ${c.lastName}`.trim() || c.id;

  // What the document actually read, as reference. Correcting it is the review
  // screen's job — this is the record of what was captured.
  const [read, setRead] = useState<ReviewField[] | null>(null);
  const api = corporate ? corp : indiv;
  useEffect(() => {
    // Both types can be read now that the individual module has its own extraction
    // helpers — this used to bail out for individuals, which is why an individual
    // record showed its pages with no fields beside them.
    if (!instanceId) return;
    let alive = true;
    api.fetchCaseExtraction(instanceId)
      .then((x) => { if (alive) setRead(toRows(x, corporate ? 'Company details' : 'Applicant details')); })
      .catch(() => { /* tab shows why it is empty */ });
    return () => { alive = false; };
  }, [instanceId, corporate, api]);

  // The pages themselves. The read is only meaningful next to what it was read
  // from, so the Document tab shows both — the same pairing as the review screen.
  const [docUrl, setDocUrl] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      let id = c.documentId;
      if (!id && instanceId) id = (await api.findCaseDocument(instanceId))?.attachmentId;
      if (!id || !alive) return;
      try { const u = await api.attachmentReadUrl(id); if (alive && u) setDocUrl(u); } catch { /* pane degrades */ }
    })();
    return () => { alive = false; };
  }, [c.documentId, instanceId, corporate, api]);

  /** Does this record actually have a form behind it? True if the row names one
   *  or the pages resolved, so the copy below can never contradict the frame. */
  const hasDoc = Boolean(c.documentId || c.documentName || docUrl);

  const readGroups = useMemo(() => {
    const m = new Map<string, ReviewField[]>();
    (read ?? []).forEach((r) => { if (!m.has(r.group)) m.set(r.group, []); m.get(r.group)!.push(r); });
    return [...m.entries()];
  }, [read]);

  const tabs = useMemo(() => [
    { id: 'who', label: corporate ? 'Business' : 'Applicant' },
    { id: 'account', label: 'Employment & account' },
    // What NIBSS and NIMC were asked, what they said, and whether it is this
    // person — opened from the BVN / NIN buttons in the case pane's Checks.
    { id: 'bvn', label: 'BVN' },
    { id: 'nin', label: 'NIN' },
    // Every document checked against the Document rules DMN (BR-DOC-01…08).
    { id: 'docs', label: 'Document checks' },
    ...(e && e.directors.length ? [{ id: 'directors', label: 'Directors', badge: e.directors.length }] : []),
    // Always offered. "Where did this data come from" has an answer for every
    // record — a scanned form, a payroll row, or someone typing — and a tab bar
    // that changes shape between records reads as though something failed to load.
    { id: 'extraction', label: 'Document' },
    // Web IQ: what the public web says about this applicant, with sources.
    { id: 'web', label: 'Web research' },
  ], [corporate, e]);

  // A waiting review is the reason the popup was opened, so start there.
  const [tab, setTab] = useState<string>(initialTab ?? (onReviewExtraction ? 'extraction' : 'who'));
  const active = tabs.some((t) => t.id === tab) ? tab : 'who';
  /** The Document tab splits the dialog into two full-height frames. */
  const wide = active === 'extraction';

  // Editing. The draft is the whole record as flat strings; Save writes back only
  // what changed, so a field nobody touched keeps exactly what it had (including
  // being absent, which the rows show as "Not captured").
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const canEdit = active === 'who' || active === 'account';
  const startEdit = () => { setDraft(snapshot(c)); setSaveError(''); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setSaveError(''); };
  /** Bind a row to the draft while editing; undefined (read-only) otherwise. */
  const bind = (k: string): EditBind | undefined =>
    editing ? { value: draft[k] ?? '', set: (v) => setDraft((d) => ({ ...d, [k]: v })) } : undefined;

  const save = async () => {
    const before = snapshot(c);
    const changed = (k: string) => (draft[k] ?? '').trim() !== (before[k] ?? '').trim();
    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (!changed(k)) continue;
      const v = draft[k].trim();
      // A cleared optional field goes back to absent; the two names stay strings.
      patch[k] = v || (k === 'firstName' || k === 'lastName' ? '' : undefined);
    }
    if (c.entity && ENTITY_EDITABLE.some((k) => changed(`entity.${k}`))) {
      const ent: Record<string, unknown> = { ...c.entity };
      for (const k of ENTITY_EDITABLE) ent[k] = draft[`entity.${k}`].trim() || (k === 'companyName' ? '' : undefined);
      patch.entity = ent;
    }
    if (NOK_EDITABLE.some((k) => changed(`nok.${k}`))) {
      const n = Object.fromEntries(NOK_EDITABLE.map((k) => [k, draft[`nok.${k}`].trim()]));
      patch.nextOfKin = n.name
        ? { name: n.name, relationship: n.relationship, phone: n.phone, address: n.address || undefined }
        : undefined;
    }
    if (!Object.keys(patch).length) { setEditing(false); return; }
    setSaving(true); setSaveError('');
    try {
      await store.update(c.id, patch as Partial<OnboardingCase>);
      setEditing(false);
    } catch (err) {
      setSaveError('Could not save: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Rendered either under the brand strip (normal) or inside the left frame
  // (Document tab) — same markup, two homes.
  const heading = (
    <>
      <h1 className="ad-title">{title}</h1>
      <p className="ad-ref">{c.id} · opened {when(c.createdAt)}</p>
      {/* One tab is not a tab bar — a walk-in individual with no document has a
          single panel, and a lone tab just looks broken. */}
      {tabs.length > 1 && (
        <div className="ad-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)}>
              {t.label}{t.badge ? <span className="n">{t.badge}</span> : null}
            </button>
          ))}
        </div>
      )}
    </>
  );

  // The tab panels. Declared here because they render in one of two places: the
  // dialog body normally, or the left frame when the Document tab splits it.
  const body = (
    <>
          {active === 'web' && <WebResearch c={c} corporate={corporate} e={e} />}
          {active === 'bvn' && <KycExchange exchanges={[bvnExchange(c, checkStatus.BVN)]} />}
          {active === 'docs' && <DocumentChecks c={c} />}
          {active === 'nin' && <KycExchange exchanges={[ninCheckExchange(c, checkStatus.NIN), ninLinkExchange(c)]} />}
          {active === 'who' && (
            <>
              {e && (
                <Section title="Registered business">
                  <dl className="ad-grid">
                    <Row label="Registered name" value={e.companyName} edit={bind('entity.companyName')} />
                    <Row label="RC number" value={e.rcNumber} mono edit={bind('entity.rcNumber')} />
                    <Row label="Tax ID (TIN)" value={e.tin} mono edit={bind('entity.tin')} />
                    <Row label="Category" value={e.businessType} edit={bind('entity.businessType')} />
                    <Row label="Sector" value={e.sector} edit={bind('entity.sector')} />
                    <Row label="Annual turnover" value={e.turnover} edit={bind('entity.turnover')} />
                    <Row label="Registered address" value={e.address} edit={bind('entity.address')} />
                    <Row label="Business email" value={e.email} edit={bind('entity.email')} />
                    <Row label="Business phone" value={e.phone} mono edit={bind('entity.phone')} />
                  </dl>
                </Section>
              )}

              <Section title={e ? 'Primary signatory' : 'Personal'}>
                <dl className="ad-grid">
                  <Row label="Title" value={c.title} edit={bind('title')} />
                  <Row label="First name" value={c.firstName} edit={bind('firstName')} />
                  <Row label="Middle name" value={c.middleName} edit={bind('middleName')} />
                  <Row label="Last name" value={c.lastName} edit={bind('lastName')} />
                  <Row label="Date of birth" value={c.dob} edit={bind('dob')} />
                  <Row label="Gender" value={c.gender} edit={bind('gender')} />
                  <Row label="Marital status" value={c.maritalStatus} edit={bind('maritalStatus')} />
                  <Row label="Mother's maiden name" value={c.motherMaidenName} edit={bind('motherMaidenName')} />
                  <Row label="Nationality" value={c.nationality} edit={bind('nationality')} />
                  <Row label="State of origin" value={c.stateOfOrigin} edit={bind('stateOfOrigin')} />
                </dl>
              </Section>

              <Section title="Identification">
                <dl className="ad-grid">
                  <Row label={kycLabelAuthority('BVN', ' · ', CO)} value={c.bvn} mono edit={bind('bvn')} />
                  <Row label={kycLabelAuthority('NIN', ' · ', CO)} value={c.nin} mono edit={bind('nin')} />
                  <Row label="Means of ID" value={c.idType} edit={bind('idType')} />
                  <Row label="ID number" value={c.idNumber} mono edit={bind('idNumber')} />
                  <Row label="ID expiry" value={c.idExpiry} edit={bind('idExpiry')} />
                  <Row label="Tax ID (TIN)" value={c.tin} mono edit={bind('tin')} />
                </dl>
              </Section>

              <Section title="Contact and address">
                <dl className="ad-grid">
                  <Row label="Phone" value={c.phone} mono edit={bind('phone')} />
                  <Row label="Alternate phone" value={c.altPhone} mono edit={bind('altPhone')} />
                  <Row label="Email" value={c.email} edit={bind('email')} />
                  <Row label="Address" value={c.address} edit={bind('address')} />
                  <Row label="City / town" value={c.city} edit={bind('city')} />
                  <Row label="State" value={c.stateOfResidence} edit={bind('stateOfResidence')} />
                  <Row label="LGA / district" value={c.lga} edit={bind('lga')} />
                  <Row label="Years at address" value={c.yearsAtAddress} edit={bind('yearsAtAddress')} />
                </dl>
              </Section>

            </>
          )}

          {active === 'account' && (
            <>
              <Section title="Employment and income">
                <dl className="ad-grid">
                  <Row label="Employment status" value={c.employmentStatus} edit={bind('employmentStatus')} />
                  <Row label="Occupation" value={c.occupation} edit={bind('occupation')} />
                  <Row label="Employer" value={c.employer} edit={bind('employer')} />
                  <Row label="Annual income" value={c.incomeBand} edit={bind('incomeBand')} />
                  <Row label="Source of funds" value={c.sourceOfFunds} edit={bind('sourceOfFunds')} />
                </dl>
              </Section>

              <Section title="The account applied for">
                <dl className="ad-grid">
                  <Row label="Account type" value={c.accountType} edit={bind('accountType')} />
                  <Row label="Purpose" value={c.accountPurpose} edit={bind('accountPurpose')} />
                  <Row label="Preferred branch" value={c.branch} edit={bind('branch')} />
                </dl>
              </Section>

              <Section title="Next of kin">
                {/* While editing, offered even when none was captured — adding one is
                    as much a correction as fixing one. */}
                {c.nextOfKin || editing ? (
                  <dl className="ad-grid">
                    <Row label="Name" value={c.nextOfKin?.name} edit={bind('nok.name')} />
                    <Row label="Relationship" value={c.nextOfKin?.relationship} edit={bind('nok.relationship')} />
                    <Row label="Phone" value={c.nextOfKin?.phone} mono edit={bind('nok.phone')} />
                    <Row label="Address" value={c.nextOfKin?.address} edit={bind('nok.address')} />
                  </dl>
                ) : <Nothing>No next of kin was captured on this application.</Nothing>}
              </Section>

              {/* How the record came to exist. Not process state — the pane owns
                  that — but provenance, which belongs with the record. */}
              <Section title="How it arrived">
                <dl className="ad-grid">
                  <Row label="Channel" value={CHANNEL_LABEL[c.channel] ?? c.channel} />
                  <Row label="Captured by" value={SOURCE_LABEL[c.source] ?? c.source} />
                  <Row label="Bulk batch" value={c.batchId} />
                  <Row label="Uploaded form" value={c.documentName} />
                  <Row label="Opened" value={when(c.createdAt)} />
                  <Row label="Last updated" value={when(c.updatedAt)} />
                </dl>
              </Section>
            </>
          )}

          {active === 'directors' && e && (
            <Section title="Directors and signatories" count={e.directors.length}>
              <div className="ad-people">
                {e.directors.map((d, i) => (
                  <div className="ad-person" key={`${d.name}-${i}`}>
                    <span className="ad-ava">{(d.name || '?').slice(0, 2).toUpperCase()}</span>
                    <div>
                      <b>{d.name || 'Unnamed'}</b>
                      <span>{[d.role, d.bvn && `BVN ${d.bvn}`].filter(Boolean).join(' · ')}</span>
                      <span>{[d.idType, d.idNumber].filter(Boolean).join(' ')}</span>
                      <span>{[d.phone, d.email].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {active === 'extraction' && (
            <>
              {onReviewExtraction && (
                <button className="ad-cta" onClick={onReviewExtraction}>
                  <span className="ad-cta-ic"><Icon name="doc" size={17} /></span>
                  <span className="ad-cta-t">
                    <b>Review the extraction</b>
                    <em>Check these against the pages and correct anything wrong.</em>
                  </span>
                  <Icon name="arrowRight" size={16} />
                </button>
              )}

              {read === null && instanceId && <Nothing>Reading what the case extracted…</Nothing>}
              {/* `hasDoc`, not c.documentId: the pages in the frame beside this are
                  resolved from the case as well as the row, and can be present when
                  that field is empty — which is how a record ended up showing a
                  scanned form and claiming in the same breath that none was scanned. */}
              {read === null && !instanceId && !hasDoc && (
                <Nothing>
                  {c.batchId
                    ? `No form was scanned. This application came in as a row of the ${c.batchId} bulk upload, so the details were taken from that file.`
                    : c.channel === 'self'
                      ? 'No form was scanned. The customer typed these details in themselves.'
                      : 'No form was scanned. These details were keyed in at the desk.'}
                </Nothing>
              )}
              {read !== null && !read.length && (
                <Nothing>
                  {hasDoc
                    ? `${c.documentName || 'A form'} was uploaded, but the case has not recorded an extraction for it.`
                    : c.batchId
                      ? `No form was scanned. This application came in as a row of the ${c.batchId} bulk upload, so the details were taken from that file.`
                      : c.channel === 'self'
                        ? 'No form was scanned. The customer typed these details in themselves.'
                        : 'No form was scanned. These details were keyed in at the desk.'}
                </Nothing>
              )}

              {readGroups.map(([g, rs]) => (
                <Section title={g} key={g}>
                  <div className="ad-read">
                    {rs.map((r) => (
                      <div className="ad-read-r" key={r.id}>
                        <span className="k">{r.name}</span>
                        <span className={`v ${r.missing ? 'empty' : ''}`}>{r.value || 'Not found on the form'}</span>
                        <span className={`ad-conf ${band(r.confidence, r.missing)}`}>
                          {r.missing ? 'missing' : `${r.confidence}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              ))}

              {!onReviewExtraction && read !== null && read.length > 0 && (
                <p className="ad-note">
                  Confirmed values, as the case recorded them. The percentages are how sure the model was
                  when it read each one.
                </p>
              )}
            </>
          )}
    </>
  );

  return (
    <div className="ad-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className={`ad cx${active === 'extraction' ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label="Application details">
        {/* Only the brand strip spans the full width. On the Document tab everything
            else — title, tabs, fields — lives in the left frame, so the pages can
            start immediately under this line and run to the footer. */}
        <div className={`cx-head${wide ? ' strip' : ''}`}>
          <div className="cx-topline">
            <button className="cx-back" onClick={onClose} aria-label="Close">
              <Icon name="arrowLeft" />
            </button>
            <Brand sub={corporate ? 'Business' : 'Applicant'} />
            <span className={`ad-pill ${meta.tone}`}>{meta.label}</span>
            {/* The footer Close sits below the content, so on a long tab it is a
                scroll away. This one is always in reach, at the corner people
                already aim for. */}
            <button className="cx-x" onClick={onClose} aria-label="Close" title="Close">
              <Icon name="x" />
            </button>
          </div>
          {!wide && heading}
        </div>

        {wide ? (
          <div className="ad-split">
            <div className="ad-left">
              <div className="ad-left-head">{heading}</div>
              <div className="ad-left-body">
                {body}
              </div>
            </div>

            {/* The pages, floor to ceiling — from under the brand strip to the footer. */}
            <div className="ad-doc-pane">
              <div className="ad-doc-h">
                <span>{c.documentName || 'Account opening form'}</span>
                {read?.length ? <span className="n">{read.length} fields</span> : null}
              </div>
              <div className="ad-doc-body">
                {/* The sweep runs only while the read is genuinely outstanding —
                    it is a progress indicator, not decoration. */}
                {read === null && instanceId && <span className="ad-scan" />}
                {docUrl
                  ? <iframe className="ad-frame" title="Uploaded form" src={`${docUrl}#view=FitH&toolbar=1`} />
                  : <div className="ad-doc-none">
                      {read === null && instanceId ? 'Fetching the uploaded pages…' : 'No document was uploaded for this application.'}
                    </div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="cx-body">{body}</div>
        )}

        <div className="cx-foot">
          {saveError && <div className="ad-save-err" role="alert">{saveError}</div>}
          {editing ? (
            <div className="ad-foot-row">
              <button className="cx-btn ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button className="cx-btn" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          ) : (
            <div className="ad-foot-row">
              {/* Offered where the fields are — the Document and Web research tabs
                  show what was read and found, which is not the record to edit. */}
              {canEdit && <button className="cx-btn ghost" onClick={startEdit}>Edit details</button>}
              <button className="cx-btn" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Web research ─────────────────────────────────────────────────────────────
// Web IQ. A Foundry agent grounded with Bing searches the public web for the
// applicant and writes a dossier: verdict, findings with whether each one is
// really this person, the searches run and the sources. It runs on the voice
// service and is framed here by URL — the same arrangement as the call popup.
// Nothing in this app calls Azure; it draws an iframe.
const RESEARCH_HOST = ((import.meta.env.VITE_VOICE_AGENT_URL as string | undefined)
  || 'https://banking-demo-voice-agent.azurewebsites.net').replace(/\/+$/, '');

function WebResearch({ c, corporate, e }: { c: OnboardingCase; corporate: boolean; e: OnboardingCase['entity'] }) {
  const url = useMemo(() => {
    const q = new URLSearchParams({ ref: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') });
    // Same reason as CallPanel: dossiers are cached per reference on the shared
    // service, and our reference series overlaps the Microsoft demo's.
    q.set('folder', maestroConfig().folderKey);
    if (c.dob) q.set('dob', c.dob);
    if (c.nationality) q.set('nationality', c.nationality);
    if (c.city) q.set('city', c.city);
    if (c.stateOfResidence) q.set('state', c.stateOfResidence);
    if (c.stateOfOrigin) q.set('stateOfOrigin', c.stateOfOrigin);
    if (c.employer) q.set('employer', c.employer);
    if (c.occupation) q.set('occupation', c.occupation);
    if (corporate && e) {
      if (e.companyName) q.set('company', e.companyName);
      if (e.directors.length) q.set('directors', e.directors.map((d) => d.name).join('; '));
    }
    return `${RESEARCH_HOST}/research?${q}`;
  }, [c, corporate, e]);
  return (
    <iframe
      title={`Web research on ${c.firstName ?? ''} ${c.lastName ?? ''}`}
      src={url}
      style={{ width: '100%', height: 'calc(min(1000px, 94vh) - 250px)', border: 0, display: 'block' }}
    />
  );
}
