// First-time setup screen — blocks the dashboard until the AuraConfig
// Data Service entity exists in this tenant.
//
// Three options:
//   1. Provision automatically — POST /api/Entity (needs DataService.Schema scope)
//   2. Manual / Upload — download AuraConfig.json, import via Data Service UI
//   3. Manual / Step-by-step — type the 5 fields by hand
//
// Both manual paths share a "Verify entity exists" button (single round-trip
// to /api/EntityService/AuraConfig/read) that advances to the dashboard once
// the entity is found.

import { useState } from 'react';
import AdminShell, { primaryButton, secondaryButton, errorBanner } from './AdminShell';
import type { AdminTenantCredentials } from '../lib/adminTenant';
import {
  fetchAuraConfig,
  provisionAuraConfigEntity,
  getAuraConfigEntityImportJson,
} from '../lib/dataService';

interface Props {
  tenant: AdminTenantCredentials;
  onProvisioned: () => void;
  onSwitchTenant: () => void;
  onLogout: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'provisioning' }
  | { kind: 'provisioned-verifying' }
  | { kind: 'verifying' }
  | { kind: 'verified-not-found' }
  | { kind: 'error'; message: string; details?: string[] };

type ManualMode = null | 'upload' | 'steps';

export default function EntityProvisioning({ tenant, onProvisioned, onSwitchTenant, onLogout }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showManual, setShowManual] = useState(false);
  const [manualMode, setManualMode] = useState<ManualMode>(null);

  const verify = async (): Promise<boolean> => {
    const result = await fetchAuraConfig(tenant);
    if (result.kind === 'ok' || result.kind === 'not-found') {
      onProvisioned();
      return true;
    }
    return false;
  };

  const autoProvision = async () => {
    setStatus({ kind: 'provisioning' });
    const result = await provisionAuraConfigEntity(tenant);
    if (result.kind === 'ok' || result.kind === 'already-exists') {
      setStatus({ kind: 'provisioned-verifying' });
      await new Promise((r) => setTimeout(r, 1500));
      const ok = await verify();
      if (!ok) {
        setStatus({
          kind: 'error',
          message: 'Entity created, but Data Service reports it as not yet available. Try again in a few seconds.',
        });
      }
      return;
    }
    if (result.kind === 'insufficient-scope' || result.kind === 'unauthorized') {
      setStatus({ kind: 'error', message: result.message });
      setShowManual(true);
      setManualMode((prev) => prev ?? 'upload');
      return;
    }
    setStatus({ kind: 'error', message: result.message, details: result.tried });
    setShowManual(true);
    setManualMode((prev) => prev ?? 'upload');
  };

  const checkAgain = async () => {
    setStatus({ kind: 'verifying' });
    const ok = await verify();
    if (!ok) setStatus({ kind: 'verified-not-found' });
  };

  const openDataService = () => {
    const url = `${tenant.baseUrl.replace(/\/$/, '')}/${tenant.orgName}/${tenant.tenantName}/dataservice_/entities`;
    window.open(url, '_blank', 'noopener');
  };

  const downloadImportJson = () => {
    const blob = new Blob([JSON.stringify(getAuraConfigEntityImportJson(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AuraConfig.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const busy =
    status.kind === 'provisioning' ||
    status.kind === 'provisioned-verifying' ||
    status.kind === 'verifying';

  return (
    <AdminShell
      title="One last setup step"
      subtitle={`Aura needs a Data Service entity called "AuraConfig" in ${tenant.orgName} / ${tenant.tenantName} to store your configuration. Pick the option that fits.`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {status.kind === 'error' && (
          <div style={errorBanner}>
            {status.message}
            {status.details && status.details.length > 0 && (
              <details style={{ marginTop: 8, textAlign: 'left' }}>
                <summary style={{ fontSize: 12, cursor: 'pointer', opacity: 0.7 }}>Technical details</summary>
                <ul style={{ marginTop: 6, paddingInlineStart: 18, fontSize: 11, opacity: 0.8 }}>
                  {status.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
        {status.kind === 'verified-not-found' && (
          <div style={{ ...errorBanner, background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.35)', color: '#a16207' }}>
            Still not finding the entity. Make sure it&apos;s named exactly <code>AuraConfig</code> and has been Published.
          </div>
        )}

        {/* Option 1: auto */}
        <button
          onClick={autoProvision}
          disabled={busy}
          style={{
            ...primaryButton,
            opacity: busy ? 0.7 : 1,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {status.kind === 'provisioning'
            ? 'Provisioning entity…'
            : status.kind === 'provisioned-verifying'
              ? 'Verifying…'
              : 'Provision automatically'}
        </button>

        <p style={{ fontSize: 11, color: 'rgba(24,33,38,0.55)', textAlign: 'center', margin: '0 16px' }}>
          Fastest. Requires a PAT with <code style={inlineCode}>DataService.Schema</code> scope.
        </p>

        {/* Option 2/3: manual */}
        <button
          onClick={() => setShowManual((v) => !v)}
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,51,51,0.85)',
            fontSize: 13,
            fontWeight: 500,
            padding: '8px 0',
            cursor: 'pointer',
          }}
        >
          {showManual ? 'Hide manual setup' : 'Or set it up manually →'}
        </button>

        {showManual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Sub-tabs */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                background: '#f4f5f7',
                padding: 4,
                borderRadius: 10,
                border: '1px solid rgba(24,33,38,0.06)',
              }}
            >
              <SubTab active={manualMode === 'upload'} onClick={() => setManualMode('upload')}>
                ⬆️ Upload config
              </SubTab>
              <SubTab active={manualMode === 'steps'} onClick={() => setManualMode('steps')}>
                📝 Step by step
              </SubTab>
            </div>

            {manualMode === 'upload' && (
              <ManualUpload
                onDownload={downloadImportJson}
                onOpenDataService={openDataService}
                onVerify={checkAgain}
                verifying={status.kind === 'verifying'}
              />
            )}
            {manualMode === 'steps' && (
              <ManualSteps
                onOpenDataService={openDataService}
                onVerify={checkAgain}
                verifying={status.kind === 'verifying'}
              />
            )}
            {!manualMode && (
              <p style={{ fontSize: 12, color: 'rgba(24,33,38,0.55)', textAlign: 'center', margin: '8px 0' }}>
                Pick one of the two options above.
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'space-between' }}>
          <button onClick={onSwitchTenant} type="button" style={{ ...secondaryButton, fontSize: 12, padding: '8px 14px' }}>
            ← Switch tenant
          </button>
          <button onClick={onLogout} type="button" style={{ ...secondaryButton, fontSize: 12, padding: '8px 14px', background: 'rgba(239,68,68,0.08)', color: '#b91c1c' }}>
            Logout
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? '#ffffff' : 'transparent',
        border: 'none',
        color: active ? '#182126' : 'rgba(24,33,38,0.6)',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        boxShadow: active ? '0 1px 2px rgba(24,33,38,0.06)' : 'none',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

function ManualUpload({
  onDownload,
  onOpenDataService,
  onVerify,
  verifying,
}: {
  onDownload: () => void;
  onOpenDataService: () => void;
  onVerify: () => void;
  verifying: boolean;
}) {
  return (
    <div style={cardStyle}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>Upload pre-built schema (~30 seconds)</p>
      <ol style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, lineHeight: 1.7 }}>
        <li>
          Download the schema file —{' '}
          <button type="button" onClick={onDownload} style={inlineLinkBtn}>
            AuraConfig.json
          </button>
        </li>
        <li>
          Open <strong>Data Service → Entities</strong>
        </li>
        <li>
          Click the <strong>Import</strong> button (top-right of the entities list)
        </li>
        <li>Select the file you just downloaded</li>
        <li>
          Confirm the import → <strong>Publish</strong>
        </li>
      </ol>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={onDownload} type="button" style={{ ...secondaryButton, fontSize: 13 }}>
          📥 Download AuraConfig.json
        </button>
        <button onClick={onOpenDataService} type="button" style={{ ...secondaryButton, fontSize: 13 }}>
          Open Data Service ↗
        </button>
        <button
          onClick={onVerify}
          type="button"
          disabled={verifying}
          style={{
            ...primaryButton,
            fontSize: 13,
            padding: '11px 16px',
            flex: 1,
            opacity: verifying ? 0.7 : 1,
            cursor: verifying ? 'wait' : 'pointer',
          }}
        >
          {verifying ? 'Checking…' : 'Verify entity exists'}
        </button>
      </div>
    </div>
  );
}

function ManualSteps({
  onOpenDataService,
  onVerify,
  verifying,
}: {
  onOpenDataService: () => void;
  onVerify: () => void;
  verifying: boolean;
}) {
  return (
    <div style={cardStyle}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>Step-by-step in the UI (~2 min)</p>
      <ol style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, lineHeight: 1.7 }}>
        <li>Open Data Service in this tenant</li>
        <li>Entities → <strong>+ Add Entity</strong></li>
        <li>
          Display name: <code style={inlineCode}>Aura Config</code> · System name: <code style={inlineCode}>AuraConfig</code>
        </li>
        <li>
          Add these fields:
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Field</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Length</th>
                <th style={thStyle}>Other</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}><code style={inlineCode}>Key</code></td>          <td style={tdStyle}>Text</td>      <td style={tdStyle}>64</td>   <td style={tdStyle}>Required</td></tr>
              <tr><td style={tdStyle}><code style={inlineCode}>ConfigJson</code></td>   <td style={tdStyle}>Text</td>      <td style={tdStyle}>4000</td> <td style={tdStyle}>—</td></tr>
              <tr><td style={tdStyle}><code style={inlineCode}>ChunkIndex</code></td>   <td style={tdStyle}>Number</td>    <td style={tdStyle}>—</td>    <td style={tdStyle}>—</td></tr>
              <tr><td style={tdStyle}><code style={inlineCode}>Version</code></td>      <td style={tdStyle}>Number</td>    <td style={tdStyle}>—</td>    <td style={tdStyle}>—</td></tr>
              <tr><td style={tdStyle}><code style={inlineCode}>LastSavedAt</code></td>  <td style={tdStyle}>Date Time</td> <td style={tdStyle}>—</td>    <td style={tdStyle}>—</td></tr>
              <tr><td style={tdStyle}><code style={inlineCode}>LastSavedBy</code></td>  <td style={tdStyle}>Text</td>      <td style={tdStyle}>256</td>  <td style={tdStyle}>—</td></tr>
            </tbody>
          </table>
        </li>
        <li>
          Click <strong>Publish</strong> at the top right of the entity page
        </li>
      </ol>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={onOpenDataService} type="button" style={{ ...secondaryButton, fontSize: 13 }}>
          Open Data Service ↗
        </button>
        <button
          onClick={onVerify}
          type="button"
          disabled={verifying}
          style={{
            ...primaryButton,
            fontSize: 13,
            padding: '11px 16px',
            flex: 1,
            opacity: verifying ? 0.7 : 1,
            cursor: verifying ? 'wait' : 'pointer',
          }}
        >
          {verifying ? 'Checking…' : 'Verify entity exists'}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#f8f9fa',
  border: '1px solid rgba(24,33,38,0.06)',
  borderRadius: 12,
  padding: 18,
  fontSize: 13,
  color: '#182126',
  lineHeight: 1.6,
};

const inlineCode: React.CSSProperties = {
  fontFamily: 'SFMono-Regular, Consolas, monospace',
  fontSize: 12,
  background: 'rgba(24,33,38,0.06)',
  padding: '1px 6px',
  borderRadius: 4,
};

const inlineLinkBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: '#0a8c9c',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'underline',
  cursor: 'pointer',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 8,
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid rgba(24,33,38,0.10)',
  color: 'rgba(24,33,38,0.55)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid rgba(24,33,38,0.05)',
};
