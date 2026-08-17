import { useEffect, useMemo, useState } from 'react';
import type { OnboardingCase } from '../../onboarding';
import { stateMeta, isCorporate } from '../../onboarding/types';
import { Brand } from '../../customer/ui';
import Icon from '../../customer/icons';
import { toRows, type ReviewField } from '../../customer/ExtractionReview';
// Each module is pinned to its own Orchestrator folder, so the case type picks
// the set — reading an individual instance through the corporate helpers 404s,
// and vice versa.
import * as corp from '../../onboarding/maestro-corporate';
import * as indiv from '../../onboarding/maestro';
import { getActiveCountry, kycLabelAuthority } from '../../config/countries';

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
const band = (c: number, missing: boolean) => (missing || c < 80 ? 'lo' : c < 90 ? 'mid' : 'hi');

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  const v = (value ?? '').trim();
  return (
    <div className="ad-row">
      <dt>{label}</dt>
      <dd className={`${v ? '' : 'empty'} ${mono ? 'num' : ''}`}>{v || 'Not captured'}</dd>
    </div>
  );
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

export default function ApplicationDetails({ c, instanceId, onReviewExtraction, onClose }: {
  c: OnboardingCase;
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
      .then((x) => { if (alive) setRead(toRows(x)); })
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

  const readGroups = useMemo(() => {
    const m = new Map<string, ReviewField[]>();
    (read ?? []).forEach((r) => { if (!m.has(r.group)) m.set(r.group, []); m.get(r.group)!.push(r); });
    return [...m.entries()];
  }, [read]);

  const tabs = useMemo(() => [
    { id: 'who', label: corporate ? 'Business' : 'Applicant' },
    { id: 'account', label: 'Employment & account' },
    ...(e && e.directors.length ? [{ id: 'directors', label: 'Directors', badge: e.directors.length }] : []),
    // Always offered. "Where did this data come from" has an answer for every
    // record — a scanned form, a payroll row, or someone typing — and a tab bar
    // that changes shape between records reads as though something failed to load.
    { id: 'extraction', label: 'Document' },
  ], [corporate, e]);

  // A waiting review is the reason the popup was opened, so start there.
  const [tab, setTab] = useState(onReviewExtraction ? 'extraction' : 'who');
  const active = tabs.some((t) => t.id === tab) ? tab : 'who';
  /** The Document tab splits the dialog into two full-height frames. */
  const wide = active === 'extraction';

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
          {active === 'who' && (
            <>
              {e && (
                <Section title="Registered business">
                  <dl className="ad-grid">
                    <Row label="Registered name" value={e.companyName} />
                    <Row label="RC number" value={e.rcNumber} mono />
                    <Row label="Tax ID (TIN)" value={e.tin} mono />
                    <Row label="Category" value={e.businessType} />
                    <Row label="Sector" value={e.sector} />
                    <Row label="Annual turnover" value={e.turnover} />
                    <Row label="Registered address" value={e.address} />
                    <Row label="Business email" value={e.email} />
                    <Row label="Business phone" value={e.phone} mono />
                  </dl>
                </Section>
              )}

              <Section title={e ? 'Primary signatory' : 'Personal'}>
                <dl className="ad-grid">
                  <Row label="Title" value={c.title} />
                  <Row label="First name" value={c.firstName} />
                  <Row label="Middle name" value={c.middleName} />
                  <Row label="Last name" value={c.lastName} />
                  <Row label="Date of birth" value={c.dob} />
                  <Row label="Gender" value={c.gender} />
                  <Row label="Marital status" value={c.maritalStatus} />
                  <Row label="Mother's maiden name" value={c.motherMaidenName} />
                  <Row label="Nationality" value={c.nationality} />
                  <Row label="State of origin" value={c.stateOfOrigin} />
                </dl>
              </Section>

              <Section title="Identification">
                <dl className="ad-grid">
                  <Row label={kycLabelAuthority('BVN', ' · ', CO)} value={c.bvn} mono />
                  <Row label={kycLabelAuthority('NIN', ' · ', CO)} value={c.nin} mono />
                  <Row label="Means of ID" value={c.idType} />
                  <Row label="ID number" value={c.idNumber} mono />
                  <Row label="ID expiry" value={c.idExpiry} />
                  <Row label="Tax ID (TIN)" value={c.tin} mono />
                </dl>
              </Section>

              <Section title="Contact and address">
                <dl className="ad-grid">
                  <Row label="Phone" value={c.phone} mono />
                  <Row label="Alternate phone" value={c.altPhone} mono />
                  <Row label="Email" value={c.email} />
                  <Row label="Address" value={c.address} />
                  <Row label="City / town" value={c.city} />
                  <Row label="State" value={c.stateOfResidence} />
                  <Row label="LGA / district" value={c.lga} />
                  <Row label="Years at address" value={c.yearsAtAddress} />
                </dl>
              </Section>

            </>
          )}

          {active === 'account' && (
            <>
              <Section title="Employment and income">
                <dl className="ad-grid">
                  <Row label="Employment status" value={c.employmentStatus} />
                  <Row label="Occupation" value={c.occupation} />
                  <Row label="Employer" value={c.employer} />
                  <Row label="Annual income" value={c.incomeBand} />
                  <Row label="Source of funds" value={c.sourceOfFunds} />
                </dl>
              </Section>

              <Section title="The account applied for">
                <dl className="ad-grid">
                  <Row label="Account type" value={c.accountType} />
                  <Row label="Purpose" value={c.accountPurpose} />
                  <Row label="Preferred branch" value={c.branch} />
                </dl>
              </Section>

              <Section title="Next of kin">
                {c.nextOfKin ? (
                  <dl className="ad-grid">
                    <Row label="Name" value={c.nextOfKin.name} />
                    <Row label="Relationship" value={c.nextOfKin.relationship} />
                    <Row label="Phone" value={c.nextOfKin.phone} mono />
                    <Row label="Address" value={c.nextOfKin.address} />
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

              {read === null && instanceId && corporate && <Nothing>Reading what the case extracted…</Nothing>}
              {read === null && !(instanceId && corporate) && !c.documentId && (
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
                  {c.documentName
                    ? `${c.documentName} was uploaded, but the case has not recorded an extraction for it.`
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
                      {read === null && instanceId && corporate ? 'Fetching the uploaded pages…' : 'No document was uploaded for this application.'}
                    </div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="cx-body">{body}</div>
        )}

        <div className="cx-foot">
          <button className="cx-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
