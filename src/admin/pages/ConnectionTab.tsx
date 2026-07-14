import { useEffect, useState } from 'react';
import type { ConnectionConfig } from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Row, Field } from './BrandingTab';
import { getAdminTenant, apiBaseFor } from '../lib/adminTenant';

interface Folder {
  Id: number;
  DisplayName: string;
  FullyQualifiedName: string;
}

type FolderLoad =
  | { kind: 'loading' }
  | { kind: 'ok'; folders: Folder[] }
  | { kind: 'error'; message: string };

export default function ConnectionTab({ connection, onChange }: { connection: ConnectionConfig; onChange: (next: ConnectionConfig) => void }) {
  const [load, setLoad] = useState<FolderLoad>({ kind: 'loading' });

  useEffect(() => {
    const tenant = getAdminTenant();
    if (!tenant) {
      setLoad({ kind: 'error', message: 'No admin tenant credentials in this session.' });
      return;
    }
    let cancelled = false;
    const url = `${apiBaseFor(tenant, 'orchestrator_')}/odata/Folders?$select=Id,DisplayName,FullyQualifiedName&$top=1000&$orderby=FullyQualifiedName`;
    fetch(url, { headers: { Authorization: `Bearer ${tenant.pat}` } })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          setLoad({ kind: 'error', message: `HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}` });
          return;
        }
        const data = (await res.json()) as { value?: Folder[] };
        setLoad({ kind: 'ok', folders: data.value ?? [] });
      })
      .catch((e) => {
        if (!cancelled) setLoad({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => { cancelled = true; };
  }, []);

  const folders = load.kind === 'ok' ? load.folders : [];
  const selected = folders.find((f) => String(f.Id) === connection.defaultFolderId);
  const hasUnknownValue = load.kind === 'ok' && connection.defaultFolderId && !selected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Orchestrator connection"
        subtitle="Per-tenant connection settings used by Aura's runtime API calls. The org/tenant/Client ID the user enters on first launch take precedence over these — this section only covers values not handled there yet."
      />
      <Row>
        <Field label="Default folder">
          {load.kind === 'ok' ? (
            <select
              className="admin-input"
              style={fieldInput}
              value={connection.defaultFolderId}
              onChange={(e) => onChange({ ...connection, defaultFolderId: e.target.value })}
            >
              <option value="">— Select a folder —</option>
              {hasUnknownValue && (
                <option value={connection.defaultFolderId}>
                  Unknown folder · ID {connection.defaultFolderId}
                </option>
              )}
              {folders.map((f) => (
                <option key={f.Id} value={String(f.Id)}>
                  {f.FullyQualifiedName || f.DisplayName} · ID {f.Id}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="admin-input"
              style={fieldInput}
              value={connection.defaultFolderId}
              onChange={(e) => onChange({ ...connection, defaultFolderId: e.target.value })}
              placeholder={load.kind === 'loading' ? 'Loading folders…' : 'e.g. 2683975'}
            />
          )}
        </Field>
      </Row>
      {selected && (
        <p style={{ fontSize: 12, color: '#0a8c9c' }}>
          Selected: <strong>{selected.FullyQualifiedName || selected.DisplayName}</strong> · ID {selected.Id}
        </p>
      )}
      <p style={{ fontSize: 12, color: 'rgba(24,33,38,0.55)' }}>
        The folder ID is sent in the <code>X-UIPATH-OrganizationUnitId</code> header on every Orchestrator request
        (tasks, jobs, releases).
        {load.kind === 'error' && (
          <> Could not fetch folder list — falling back to manual ID entry. ({load.message})</>
        )}
      </p>
    </div>
  );
}
