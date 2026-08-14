import { useEffect } from 'react';
import type { OnboardingCase } from '../../onboarding';
import { stateMeta } from '../../onboarding/types';
import Icon from '../../customer/icons';

// ─────────────────────────────────────────────────────────────────────────────
// Application details — the full captured record, as a popup.
//
// The pane beside the pipeline stays the operational view: where the case is,
// what it is waiting on, what to do next. This is the other half — everything
// the applicant actually gave us, which is reference material a banker reads in
// one go rather than glances at. A popup suits that; it does not compete with
// the pane, it complements it.
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

export default function ApplicationDetails({ c, onClose }: { c: OnboardingCase; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const e = c.entity;
  const meta = stateMeta(c.state);
  const corporate = Boolean(e);

  return (
    <div className="ad-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="ad" role="dialog" aria-modal="true" aria-label="Application details">
        <div className="ad-head">
          <div>
            <div className="ad-eyebrow">{corporate ? 'Corporate application' : 'Application'}</div>
            <h2>{corporate ? e!.companyName || c.firstName : `${c.firstName} ${c.lastName}`.trim()}</h2>
            <div className="ad-sub">
              <code>{c.id}</code>
              <span className={`ad-pill ${meta.tone}`}>{meta.label}</span>
            </div>
          </div>
          <button className="ad-x" onClick={onClose} aria-label="Close details">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="ad-body">
          {corporate && (
            <section className="ad-sec">
              <h3>Business</h3>
              <dl className="ad-grid">
                <Row label="Registered name" value={e!.companyName} />
                <Row label="RC number" value={e!.rcNumber} />
                <Row label="Tax ID (TIN)" value={e!.tin} />
                <Row label="Category" value={e!.businessType} />
                <Row label="Sector" value={e!.sector} />
                <Row label="Annual turnover" value={e!.turnover} />
                <Row label="Registered address" value={e!.address} />
                <Row label="Business email" value={e!.email} />
                <Row label="Business phone" value={e!.phone} />
              </dl>
            </section>
          )}

          {corporate && (e!.directors?.length ?? 0) > 0 && (
            <section className="ad-sec">
              <h3>Directors and signatories <em>{e!.directors.length}</em></h3>
              <div className="ad-people">
                {e!.directors.map((d, i) => (
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

          {!corporate && (
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
              <Row label="Reference" value={c.id} />
              <Row label="Batch" value={c.batchId} />
              <Row label="Opened" value={new Date(c.createdAt).toLocaleString()} />
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
        </div>

        <div className="ad-foot">
          <span className="ad-note">{meta.desc}</span>
          <button className="ad-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
