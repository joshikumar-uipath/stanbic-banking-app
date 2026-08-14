import { useEffect } from 'react';
import type { OnboardingCase } from '../../onboarding';
import { stateMeta } from '../../onboarding/types';
import { Brand } from '../../customer/ui';
import Icon from '../../customer/icons';

// ─────────────────────────────────────────────────────────────────────────────
// Application details — the full captured record, as a popup.
//
// The pane beside the pipeline stays the operational view: where the case is,
// what it is waiting on, what to do next. This is the other half — everything
// the applicant actually gave us, which is reference read in one pass.
//
// It is built on the capture wizard's own shell (.cx head / body / foot) rather
// than a second set of styles, so it carries the same branding, spacing and
// button treatment the RM just came from.
// ─────────────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string }) {
  const v = (value ?? '').trim();
  return (
    <div className="ad-row">
      <dt>{label}</dt>
      <dd className={v ? '' : 'empty'}>{v || 'Not captured'}</dd>
    </div>
  );
}

export default function ApplicationDetails({ c, onReviewExtraction, onClose }: {
  c: OnboardingCase;
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
  const corporate = Boolean(e) || c.state === 'AWAITING_EXTRACTION';
  const title = e?.companyName?.trim() || `${c.firstName} ${c.lastName}`.trim() || c.id;

  return (
    <div className="ad-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="ad cx" role="dialog" aria-modal="true" aria-label="Application details">
        <div className="cx-head">
          <div className="cx-topline">
            <button className="cx-back" onClick={onClose} aria-label="Close">
              <Icon name="arrowLeft" />
            </button>
            <Brand sub={corporate ? 'Business' : 'Applicant'} />
            <span className={`ad-pill ${meta.tone}`}>{meta.label}</span>
          </div>
        </div>

        <div className="cx-body">
          <h1 className="cx-h1">{title}</h1>
          <p className="cx-p ad-ref">{c.id} · opened {new Date(c.createdAt).toLocaleString()}</p>

          {onReviewExtraction && (
            <button className="ad-cta" onClick={onReviewExtraction}>
              <span className="ad-cta-ic"><Icon name="doc" size={17} /></span>
              <span className="ad-cta-t">
                <b>Review the extraction</b>
                <em>See what was read from the form, beside the pages themselves.</em>
              </span>
              <Icon name="arrowRight" size={16} />
            </button>
          )}

          {e && (
            <section className="ad-sec">
              <h3>Business</h3>
              <dl className="ad-grid">
                <Row label="Registered name" value={e.companyName} />
                <Row label="RC number" value={e.rcNumber} />
                <Row label="Tax ID (TIN)" value={e.tin} />
                <Row label="Category" value={e.businessType} />
                <Row label="Sector" value={e.sector} />
                <Row label="Annual turnover" value={e.turnover} />
                <Row label="Registered address" value={e.address} />
                <Row label="Business email" value={e.email} />
                <Row label="Business phone" value={e.phone} />
              </dl>
            </section>
          )}

          {e && e.directors.length > 0 && (
            <section className="ad-sec">
              <h3>Directors and signatories <em>{e.directors.length}</em></h3>
              <div className="ad-people">
                {e.directors.map((d, i) => (
                  <div className="ad-person" key={`${d.name}-${i}`}>
                    <span className="ad-ava">{(d.name || '?').slice(0, 2).toUpperCase()}</span>
                    <div>
                      <b>{d.name || 'Unnamed'}</b>
                      <span>{d.role}{d.bvn ? ` · BVN ${d.bvn}` : ''}</span>
                      <span>{[d.idType, d.idNumber].filter(Boolean).join(' ')}</span>
                      <span>{[d.phone, d.email].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!e && (
            <section className="ad-sec">
              <h3>Applicant</h3>
              <dl className="ad-grid">
                <Row label="First name" value={c.firstName} />
                <Row label="Last name" value={c.lastName} />
                <Row label="BVN" value={c.bvn} />
                <Row label="NIN" value={c.nin} />
                <Row label="Address" value={c.address} />
                <Row label="Employer" value={c.employer} />
              </dl>
            </section>
          )}

          <section className="ad-sec">
            <h3>Contact</h3>
            <dl className="ad-grid">
              <Row label="Phone" value={c.phone} />
              <Row label="Email" value={c.email} />
            </dl>
          </section>

          <section className="ad-sec">
            <h3>Capture</h3>
            <dl className="ad-grid">
              <Row label="Channel" value={c.channel === 'self' ? 'Customer self-service' : c.channel === 'bulk' ? 'Bulk upload' : 'Walk-in / direct'} />
              <Row label="Captured by" value={c.source === 'rm' ? 'Relationship manager' : 'Customer'} />
              <Row label="Batch" value={c.batchId} />
              <Row label="Last updated" value={new Date(c.updatedAt).toLocaleString()} />
            </dl>
          </section>

          {(c.cif || c.accountNumber) && (
            <section className="ad-sec">
              <h3>Core banking</h3>
              <dl className="ad-grid">
                <Row label="CIF" value={c.cif} />
                <Row label="Account number" value={c.accountNumber} />
              </dl>
            </section>
          )}

          <p className="ad-note">{meta.desc}</p>
        </div>

        <div className="cx-foot">
          <button className="cx-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
