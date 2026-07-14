import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell, { fieldLabel, fieldInput, primaryButton, secondaryButton } from './AdminShell';
import {
  listLocalProfiles,
  getActiveLocalProfileId,
  setActiveLocalProfile,
  renameLocalProfile,
  deleteLocalProfile,
  upsertLocalProfile,
  BUILTIN_PRESETS,
  DEFAULT_PRESET_ID,
  defaultConfig,
} from '../../config';
import { getAdminTenant } from '../lib/adminTenant';
import { listDataFabricConfigs, type DataFabricConfigEntry } from '../lib/dataService';

const DEFAULT_NAME = defaultConfig.branding.appName;

/** Re-exported for the admin router. Built-in presets aren't editable/deletable. */
export const DEFAULT_PROFILE_ID = DEFAULT_PRESET_ID;
/** Dropdown ids for Data Fabric library entries are prefixed with this. */
const DATAFABRIC_PREFIX = 'df:';
const dfId = (key: string) => `${DATAFABRIC_PREFIX}${key}`;
const PRESET_IDS = new Set(BUILTIN_PRESETS.map((p) => p.id));

/** Background read of the tenant's Data Fabric config library (saved creds). */
type DfState =
  | { status: 'idle' }
  | { status: 'loading'; tenantLabel: string }
  | { status: 'ok'; entries: DataFabricConfigEntry[]; corruptKeys: string[]; tenantLabel: string }
  | { status: 'empty'; tenantLabel: string }
  | { status: 'unauth'; tenantLabel: string }
  | { status: 'error'; tenantLabel: string; message: string };

interface Props {
  /** Load a saved profile (or DEFAULT_PROFILE_ID for the bundled default) into the editor. */
  onEdit: (profileId: string) => void;
  /** Create a brand-new configuration (from the bundled default) named `name`. */
  onCreate: (name: string) => void;
  /** Optional: switch to the PAT / Data Service path. */
  onConnectTenant?: () => void;
  onLogout: () => void;
}

export default function ProfilePicker({ onEdit, onCreate, onConnectTenant, onLogout }: Props) {
  // Bump to re-read localStorage after delete/reset.
  const [version, setVersion] = useState(0);
  const profiles = useMemo(() => listLocalProfiles(), [version]);
  const activeId = useMemo(() => getActiveLocalProfileId(), [version]);

  const [selected, setSelected] = useState<string>(() => getActiveLocalProfileId() ?? DEFAULT_PROFILE_ID);
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Auto-populate from Data Fabric using credentials saved on a previous
  // "Connect a UiPath tenant" — no connect step each time. Stays empty (and the
  // group hidden) when no PAT is stored or the tenant has no config yet.
  const [df, setDf] = useState<DfState>({ status: 'idle' });
  useEffect(() => {
    const creds = getAdminTenant();
    if (!creds) return; // nothing saved → show local presets only
    const tenantLabel = `${creds.orgName}/${creds.tenantName}`;
    let cancelled = false;
    setDf({ status: 'loading', tenantLabel });
    listDataFabricConfigs(creds).then((r) => {
      if (cancelled) return;
      if (r.kind === 'ok') {
        if (r.entries.length === 0) setDf({ status: 'empty', tenantLabel });
        else setDf({ status: 'ok', entries: r.entries, corruptKeys: r.corruptKeys, tenantLabel });
      }
      else if (r.kind === 'entity-missing') setDf({ status: 'empty', tenantLabel });
      else if (r.kind === 'unauthorized') setDf({ status: 'unauth', tenantLabel });
      else setDf({ status: 'error', tenantLabel, message: r.message });
    });
    return () => { cancelled = true; };
  }, []);
  const dfEntries = df.status === 'ok' ? df.entries : [];

  // Custom dropdown (native <select> popups misposition on some macOS/HiDPI setups).
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selectedDfEntry = selected.startsWith(DATAFABRIC_PREFIX)
    ? dfEntries.find((e) => dfId(e.key) === selected)
    : undefined;
  const effectiveSelected = PRESET_IDS.has(selected) || profiles.some((p) => p.id === selected) || selectedDfEntry
    ? selected
    : DEFAULT_PROFILE_ID;
  // Built-in presets and Data Fabric library entries can't be renamed/deleted here.
  const isPresetSelected = PRESET_IDS.has(effectiveSelected);
  const isDataFabricSelected = effectiveSelected.startsWith(DATAFABRIC_PREFIX);
  const isReadOnlySelected = isPresetSelected || isDataFabricSelected;

  const isLive = (id: string) =>
    id === DEFAULT_PROFILE_ID ? (activeId === null || activeId === DEFAULT_PROFILE_ID) : activeId === id;
  const nameFor = (id: string) =>
    id.startsWith(DATAFABRIC_PREFIX)
      ? (dfEntries.find((e) => dfId(e.key) === id)?.name ?? 'Data Fabric')
      : BUILTIN_PRESETS.find((p) => p.id === id)?.name ?? profiles.find((p) => p.id === id)?.name ?? 'Select…';
  const labelFor = (id: string) => `${nameFor(id)}${isLive(id) ? '  ·  (currently live)' : ''}`;

  const refresh = () => setVersion((v) => v + 1);

  // "Load from Data Fabric" — copy the live Data Fabric config into the active
  // LOCAL slot so the consumer app (same origin) renders it on refresh WITHOUT
  // any end-user login. (The consumer can only read Data Fabric directly after
  // SSO; loading it locally here is what makes the no-login admin→refresh flow
  // work, exactly like the local presets.) Reuses an existing same-named profile
  // so repeated loads don't pile up duplicates.
  const loadDataFabricLive = () => {
    if (!selectedDfEntry) return;
    const existing = profiles.find((p) => p.name === selectedDfEntry.name);
    const prof = upsertLocalProfile(existing?.id ?? null, selectedDfEntry.name, selectedDfEntry.config);
    setSelected(prof.id);
    setNotice(`✓ "${selectedDfEntry.name}" is now live. Refresh the app tab to see it — no sign-in needed.`);
    refresh();
  };

  const resetToDefault = () => {
    setActiveLocalProfile(null);
    setNotice(`App reset to the bundled default (${DEFAULT_NAME}). Reload the app tab to see it.`);
    refresh();
  };

  const renameSelected = () => {
    if (isReadOnlySelected) return;
    const p = profiles.find((x) => x.id === effectiveSelected);
    if (!p) return;
    const name = prompt('Rename configuration', p.name);
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === p.name) return;
    renameLocalProfile(p.id, trimmed);
    setNotice(`Renamed to "${trimmed}".`);
    refresh();
  };

  const deleteSelected = () => {
    if (!effectiveSelected || isReadOnlySelected) return;
    const p = profiles.find((x) => x.id === effectiveSelected);
    if (!p) return;
    if (!confirm(`Delete configuration "${p.name}"? This can't be undone.`)) return;
    deleteLocalProfile(p.id);
    setNotice(`Deleted "${p.name}".`);
    setSelected('');
    refresh();
  };

  const create = () => {
    const name = newName.trim() || `Configuration ${profiles.length + 1}`;
    onCreate(name);
  };

  return (
    <AdminShell
      title="Choose a configuration"
      subtitle="Pick a saved demo to load, or create a new one. Each is stored in this browser — no PAT needed."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {notice && (
          <div style={{ background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.25)', color: '#0a8c9c', padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
            {notice}
          </div>
        )}

        {/* Load a configuration (bundled default is always first) */}
        <div>
          <label style={fieldLabel} htmlFor="pp-select">Saved configurations</label>
          <div ref={ddRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="admin-input"
              onClick={() => setOpen((o) => !o)}
              style={{ ...fieldInput, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelFor(effectiveSelected)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(24,33,38,0.5)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open && (
              <div
                role="listbox"
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                  background: '#ffffff', border: '1px solid rgba(24,33,38,0.12)', borderRadius: 12,
                  boxShadow: '0 12px 32px -8px rgba(24,33,38,0.25), 0 2px 6px rgba(24,33,38,0.08)',
                  padding: 6, maxHeight: 320, overflowY: 'auto',
                }}
              >
                <DropdownGroup label="Built-in presets">
                  {BUILTIN_PRESETS.map((preset) => (
                    <DropdownOption
                      key={preset.id}
                      label={preset.name}
                      live={isLive(preset.id)}
                      active={effectiveSelected === preset.id}
                      onClick={() => { setSelected(preset.id); setOpen(false); }}
                    />
                  ))}
                </DropdownGroup>
                {profiles.length > 0 && (
                  <DropdownGroup label="Your configurations">
                    {profiles.map((p) => (
                      <DropdownOption
                        key={p.id}
                        label={p.name}
                        live={isLive(p.id)}
                        active={effectiveSelected === p.id}
                        onClick={() => { setSelected(p.id); setOpen(false); }}
                      />
                    ))}
                  </DropdownGroup>
                )}
                {dfEntries.length > 0 && (
                  <DropdownGroup label={`From Data Fabric · ${df.status === 'ok' ? df.tenantLabel : ''}`}>
                    {dfEntries.map((e) => (
                      <DropdownOption
                        key={e.key}
                        label={e.name}
                        live={false}
                        active={effectiveSelected === dfId(e.key)}
                        onClick={() => { setSelected(dfId(e.key)); setOpen(false); }}
                      />
                    ))}
                  </DropdownGroup>
                )}
                {df.status === 'loading' && (
                  <div style={{ padding: '8px 10px', fontSize: 12, color: 'rgba(24,33,38,0.45)' }}>
                    Loading from Data Fabric…
                  </div>
                )}
              </div>
            )}
          </div>
          {df.status === 'unauth' && (
            <p style={dfHint}>
              Saved PAT can’t read Data Fabric (403). Regenerate it with the <strong>DataService.Data</strong> (DataFabric.Data.Read) scope, then reload this page.
            </p>
          )}
          {df.status === 'error' && (
            <p style={dfHint}>Couldn’t load from Data Fabric: {df.message}</p>
          )}
          {df.status === 'ok' && df.corruptKeys.length > 0 && (
            <p style={dfHint}>
              ⚠ {df.corruptKeys.length} Data Fabric config{df.corruptKeys.length === 1 ? '' : 's'} couldn’t be read (corrupt/hand-edited chunks): {df.corruptKeys.join(', ')}. Re-publish from the editor to fix.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => (isDataFabricSelected ? loadDataFabricLive() : onEdit(effectiveSelected))}
              style={{ ...primaryButton, flex: 1 }}
            >
              {isDataFabricSelected ? 'Load from Data Fabric' : isPresetSelected ? 'Load preset' : 'Load & edit'}
            </button>
            <button
              type="button"
              onClick={renameSelected}
              disabled={isReadOnlySelected}
              style={{ ...secondaryButton, color: isReadOnlySelected ? 'rgba(24,33,38,0.3)' : '#182126', cursor: isReadOnlySelected ? 'not-allowed' : 'pointer' }}
            >
              Rename
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={isReadOnlySelected}
              style={{ ...secondaryButton, color: isReadOnlySelected ? 'rgba(24,33,38,0.3)' : '#b91c1c', cursor: isReadOnlySelected ? 'not-allowed' : 'pointer' }}
            >
              Delete
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(24,33,38,0.10)' }} />

        {/* Create a new profile */}
        <div>
          <label style={fieldLabel} htmlFor="pp-new">Create a new configuration</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <input
              id="pp-new"
              className="admin-input"
              type="text"
              placeholder="e.g. NCBA Kenya, DBS Singapore…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
              style={{ ...fieldInput, flex: 1 }}
            />
            <button type="button" onClick={create} style={{ ...primaryButton, whiteSpace: 'nowrap' }}>
              Create
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(24,33,38,0.5)', marginTop: 6 }}>
            Starts from the bundled default — you’ll set the name, colors &amp; copy in the editor.
          </p>
        </div>

        <div style={{ borderTop: '1px solid rgba(24,33,38,0.10)' }} />

        {/* Footer actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={resetToDefault} style={linkButton}>
            Reset app to default ({DEFAULT_NAME})
          </button>
          {onConnectTenant && (
            <button type="button" onClick={onConnectTenant} style={linkButton}>
              Connect a UiPath tenant instead
            </button>
          )}
          <button type="button" onClick={onLogout} style={{ ...linkButton, marginInlineStart: 'auto', color: '#b91c1c' }}>
            Logout
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function DropdownGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(24,33,38,0.4)', padding: '8px 10px 4px' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function DropdownOption({ label, live, active, onClick }: { label: string; live: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className="dd-option"
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(24,33,38,0.06)' : 'transparent',
        fontFamily: "'Inter', Arial, sans-serif", fontSize: 14, color: '#182126',
      }}
    >
      <span style={{ width: 14, flexShrink: 0, color: '#182126' }}>{active ? '✓' : ''}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}{live ? <span style={{ color: 'rgba(24,33,38,0.45)' }}>  ·  currently live</span> : null}
      </span>
    </button>
  );
}

const dfHint: React.CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.5,
  color: 'rgba(24,33,38,0.6)',
  marginTop: 8,
};

const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 12.5,
  fontWeight: 500,
  color: '#0a8c9c',
  cursor: 'pointer',
  textDecoration: 'underline',
};
