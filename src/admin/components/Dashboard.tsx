// The post-login admin shell: header bar, tab strip, active tab body.
//
// All tabs map 1:1 to a section of the TenantConfig schema. Each save
// writes the entire config to the AuraConfig entity in Data Service.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultConfig, migrate, SCHEMA_VERSION, loadLocalConfig, getActiveLocalProfile, getActiveLocalProfileId, upsertLocalProfile, getPresetById } from '../../config';
import type { TenantConfig } from '../../config';
import { getAdminTenant, type AdminTenantCredentials } from '../lib/adminTenant';
import { fetchAuraConfig, saveAuraConfig, type AuraConfigMeta, type FetchResult } from '../lib/dataService';
import ConnectionTab from '../pages/ConnectionTab';
import BrandingTab from '../pages/BrandingTab';
import AgentsTab from '../pages/AgentsTab';
import NotificationsTab from '../pages/NotificationsTab';
import FeaturesTab from '../pages/FeaturesTab';
import HomeShowcaseTab from '../pages/HomeShowcaseTab';
import DemoContentTab from '../pages/DemoContentTab';
import StringsTab from '../pages/StringsTab';
import OperationsTab from '../pages/OperationsTab';
import EmployeeRolesTab from '../pages/EmployeeRolesTab';

type TabId =
  | 'branding'
  | 'connection'
  | 'agents'
  | 'showcase'
  | 'demo'
  | 'notifications'
  | 'operations'
  | 'roles'
  | 'features'
  | 'strings';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'branding',      label: 'Branding' },
  { id: 'connection',    label: 'Connection' },
  { id: 'agents',        label: 'Agents' },
  { id: 'showcase',      label: 'Home Showcase' },
  { id: 'demo',          label: 'Demo Content' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'operations',    label: 'Operations' },
  { id: 'roles',         label: 'Employee roles' },
  { id: 'features',      label: 'Features' },
  { id: 'strings',       label: 'Strings' },
];

interface Props {
  tenant: AdminTenantCredentials | null;
  profileName: string;
  /** No-PAT mode: load/save the config to the browser (localStorage) instead
   *  of UiPath Data Service. The runtime app reads it from the same origin. */
  localMode?: boolean;
  /** Local mode only: go back to the configuration picker. */
  onSwitchProfile?: () => void;
  onSwitchTenant: () => void;
  onLogout: () => void;
}

export default function Dashboard({ tenant, profileName, localMode = false, onSwitchProfile, onSwitchTenant, onLogout }: Props) {
  const [active, setActive] = useState<TabId>('branding');
  const [config, setConfig] = useState<TenantConfig>(defaultConfig);
  const [meta, setMeta] = useState<AuraConfigMeta | null>(null);
  const [status, setStatus] = useState<{ loading: boolean; error?: string; notice?: string }>({ loading: true });
  // Local mode: the name of the active configuration profile (editable → rename).
  const [configName, setConfigName] = useState<string>(() => getActiveLocalProfile()?.name ?? 'My configuration');

  // Initial load of the config.
  useEffect(() => {
    // Local (no-PAT) mode: read the active profile from the browser, skip Data Service.
    if (localMode || !tenant) {
      const local = loadLocalConfig();
      const activeProfile = getActiveLocalProfile();
      const preset = getPresetById(getActiveLocalProfileId());
      const base = local ?? defaultConfig;
      setConfig(base);
      setConfigName(activeProfile?.name ?? base.branding.appName);
      setMeta(null);
      setStatus({
        loading: false,
        notice: activeProfile
          ? `Editing "${activeProfile.name}". Save, then reload the app tab to see changes.`
          : `Editing the ${preset?.name ?? 'Zara AI (Default)'} preset — Save creates a new configuration. Reload the app tab to see it.`,
      });
      return;
    }
    let cancelled = false;
    setStatus({ loading: true });
    fetchAuraConfig(tenant).then((result: FetchResult) => {
      if (cancelled) return;
      if (result.kind === 'ok') {
        setConfig(result.config);
        setMeta(result.meta);
        setStatus({ loading: false, notice: `Loaded version ${result.meta.Version} (${result.meta.ChunkCount} chunk${result.meta.ChunkCount === 1 ? '' : 's'}).` });
      } else if (result.kind === 'not-found') {
        setConfig(defaultConfig);
        setMeta(null);
        setStatus({ loading: false, notice: 'No saved config yet — editing the bundled default. First save will create it.' });
      } else if (result.kind === 'entity-missing') {
        setConfig(defaultConfig);
        setMeta(null);
        setStatus({ loading: false, error: 'AuraConfig entity not found in Data Service. Create it first before saving.' });
      } else if (result.kind === 'unauthorized') {
        setStatus({ loading: false, error: 'Tenant rejected the PAT — re-enter credentials.' });
      } else {
        setStatus({ loading: false, error: result.message });
      }
    });
    return () => { cancelled = true; };
  }, [tenant, localMode]);

  const updateSection = <K extends keyof TenantConfig>(key: K, value: TenantConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    // Local (no-PAT) mode: persist to the active profile; app reads it on reload.
    if (localMode || !tenant) {
      const name = configName.trim() || 'My configuration';
      const saved = upsertLocalProfile(getActiveLocalProfileId(), name, config);
      setConfigName(saved.name);
      setStatus({ loading: false, notice: `Saved "${saved.name}" to this browser. Reload the app tab (localhost:5180) to see the new name & theme.` });
      return;
    }
    setStatus({ loading: true });
    const result = await saveAuraConfig(tenant, config, meta, profileName);
    if (result.kind === 'ok') {
      setMeta(result.meta);
      setStatus({ loading: false, notice: `Saved version ${result.meta.Version} across ${result.meta.ChunkCount} chunk${result.meta.ChunkCount === 1 ? '' : 's'}.` });
    } else if (result.kind === 'conflict') {
      setStatus({ loading: false, error: result.message });
    } else if (result.kind === 'unauthorized') {
      setStatus({ loading: false, error: 'PAT rejected. Re-enter tenant credentials.' });
    } else if (result.kind === 'insufficient-scope') {
      setStatus({ loading: false, error: result.message });
    } else if (result.kind === 'entity-missing') {
      setStatus({ loading: false, error: 'AuraConfig entity not found in Data Service.' });
    } else {
      setStatus({ loading: false, error: result.message });
    }
  };

  // Publisher action: push the config currently in the editor to Data Fabric so
  // the whole team sees it on staging (they just sign in — no PAT). Reuses the
  // tenant credentials connected once via "Connect a UiPath tenant".
  const publishToDataFabric = async () => {
    const creds = getAdminTenant();
    if (!creds) {
      setStatus({
        loading: false,
        error: 'To publish to Data Fabric, connect a UiPath tenant once (top-right "Connect UiPath tenant"). That stores your PAT in this browser; after that, Publish works directly.',
      });
      return;
    }
    setStatus({ loading: true, notice: 'Publishing to Data Fabric…' });
    // Each named config lives under its own Key (the config's name) so publishing
    // ADDS to the Data Fabric library instead of overwriting a single slot. Fetch
    // the existing record for THIS key so we version/replace it rather than dupe.
    const key = (configName || config.branding.appName || 'current').trim();
    const existing = await fetchAuraConfig(creds, key);
    const existingMeta = existing.kind === 'ok' ? existing.meta : null;
    const result = await saveAuraConfig(creds, config, existingMeta, configName || 'Publisher', key);
    if (result.kind === 'ok') {
      setStatus({
        loading: false,
        notice: `Published "${config.branding.appName}" to the Data Fabric library (v${result.meta.Version}). It now appears under "From Data Fabric" in the picker for everyone.`,
      });
    } else if (result.kind === 'entity-missing') {
      setStatus({
        loading: false,
        error: 'The AuraConfig entity does not exist yet in this tenant. Open "Connect UiPath tenant" once — it provisions the entity — then Publish again.',
      });
    } else if (result.kind === 'insufficient-scope') {
      setStatus({ loading: false, error: result.message });
    } else if (result.kind === 'unauthorized') {
      setStatus({ loading: false, error: 'Tenant rejected the PAT. Re-connect with a PAT that has DataService.Data + DataService.Schema scopes.' });
    } else {
      setStatus({ loading: false, error: result.message ?? 'Publish failed.' });
    }
  };

  const activeTab: ReactNode = useMemo(() => {
    switch (active) {
      case 'branding':
        return <BrandingTab branding={config.branding} onChange={(v) => updateSection('branding', v)} />;
      case 'connection':
        return <ConnectionTab connection={config.connection} onChange={(v) => updateSection('connection', v)} />;
      case 'agents':
        return <AgentsTab agents={config.agents} onChange={(v) => updateSection('agents', v)} />;
      case 'showcase':
        return <HomeShowcaseTab items={config.homeShowcase} onChange={(v) => updateSection('homeShowcase', v)} />;
      case 'demo':
        return <DemoContentTab demoContent={config.demoContent} onChange={(v) => updateSection('demoContent', v)} />;
      case 'notifications':
        return <NotificationsTab notifications={config.notifications} onChange={(v) => updateSection('notifications', v)} />;
      case 'operations':
        return <OperationsTab operations={config.operations ?? defaultConfig.operations!} onChange={(v) => updateSection('operations', v)} />;
      case 'roles':
        return <EmployeeRolesTab employeeApp={config.employeeApp ?? defaultConfig.employeeApp!} onChange={(v) => updateSection('employeeApp', v)} />;
      case 'features':
        return <FeaturesTab features={config.features} onChange={(v) => updateSection('features', v)} />;
      case 'strings':
        return <StringsTab strings={config.strings} onChange={(v) => updateSection('strings', v)} />;
    }
  }, [active, config]);

  // ─── Export / Import config as JSON ──────────────────────────────
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `aura-config-${tenant?.orgName ?? 'local'}-${tenant?.tenantName ?? 'browser'}-v${meta?.Version ?? 'new'}-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importInputRef = useRef<HTMLInputElement>(null);
  const importConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const migrated = migrate(parsed);
        setConfig(migrated);
        setStatus({ loading: false, notice: `Imported ${file.name} — review the tabs and Save to commit.` });
      } catch (e) {
        setStatus({ loading: false, error: e instanceof Error ? e.message : 'Could not parse JSON file.' });
      }
    };
    reader.onerror = () => setStatus({ loading: false, error: 'Could not read file.' });
    reader.readAsText(file);
  };

  return (
    <div
      style={{
        // Own scroll container, set inline so it always wins: index.css locks
        // html/body to overflow:hidden for the phone shell, and relying on a
        // stylesheet override to unlock it can lose the CSS race (tall forms then
        // can't scroll). A self-contained scroller sidesteps that entirely.
        height: '100dvh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#f4f5f7',
        backgroundImage: `
          radial-gradient(ellipse 60% 30% at 12% 0%, rgba(255,51,51,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 50% 30% at 88% 0%, rgba(255,51,51,0.06) 0%, transparent 60%)
        `,
        fontFamily: "'Inter', Arial, sans-serif",
        color: '#182126',
      }}
    >
      <style>{`
        body { margin: 0; }
        html { color-scheme: light; }
        .admin-input { transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.18s ease; }
        .admin-input:focus { outline: none; border-color: ${defaultConfig.branding.accentColor} !important; box-shadow: 0 0 0 4px rgba(255,51,51,0.14); }
        .admin-input::placeholder { color: rgba(24,33,38,0.34); }
        .tab-pill { transition: background 0.18s ease, color 0.18s ease, transform 0.12s ease; }
        .tab-pill:hover { background: rgba(24,33,38,0.05); }
        .tab-btn { transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease; cursor: pointer; }
        .tab-btn:hover { background: rgba(255,51,51,0.04); }
        .header-btn { transition: filter 0.15s ease, transform 0.12s ease; cursor: pointer; }
        .header-btn:hover { filter: brightness(0.96); }
        .header-btn:active { transform: translateY(1px); }
        .save-btn { transition: filter 0.15s ease, transform 0.12s ease, opacity 0.15s ease; }
        .save-btn:not(:disabled):hover { filter: brightness(1.05); }
        .save-btn:not(:disabled):active { transform: translateY(1px); }
      `}</style>

      {/* Top bar */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid rgba(24,33,38,0.06)',
          boxShadow: '0 1px 0 rgba(24,33,38,0.02)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: "'Poppins', Arial, sans-serif",
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: -0.6,
                color: '#182126',
                lineHeight: 1,
              }}
            >
              {defaultConfig.branding.appName}
            </span>
            <span
              style={{
                fontFamily: "'Poppins', Arial, sans-serif",
                fontWeight: 600,
                fontSize: 10,
                color: defaultConfig.branding.accentColor,
                background: `${defaultConfig.branding.accentColor}14`,
                border: `1px solid ${defaultConfig.branding.accentColor}40`,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: 1.1,
                textTransform: 'uppercase' as const,
              }}
            >
              ADMIN
            </span>
          </div>

          <div
            style={{
              marginInlineStart: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                textAlign: 'right',
                marginInlineEnd: 8,
                paddingInlineEnd: 10,
                borderInlineEnd: '1px solid rgba(24,33,38,0.10)',
              }}
            >
              {localMode ? (
                <>
                  <input
                    className="admin-input"
                    aria-label="Configuration name"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="Configuration name"
                    style={{ fontSize: 13, fontWeight: 600, color: '#182126', padding: '4px 8px', border: '1px solid rgba(24,33,38,0.12)', borderRadius: 8, width: 180, textAlign: 'right' }}
                  />
                  <div style={{ fontSize: 11, color: 'rgba(24,33,38,0.55)', marginTop: 2 }}>
                    Local (this browser) · schema v{SCHEMA_VERSION}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#182126', fontWeight: 600 }}>
                    {tenant
                      ? <>{tenant.orgName} <span style={{ color: 'rgba(24,33,38,0.4)' }}>/</span> {tenant.tenantName}</>
                      : 'Local (this browser)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(24,33,38,0.55)', marginTop: 2 }}>
                    {profileName || '—'} · schema v{SCHEMA_VERSION}
                  </div>
                </>
              )}
            </div>
            <button onClick={exportConfig} className="header-btn" style={ghostButtonStyle('teal')}>Export JSON</button>
            <button onClick={() => importInputRef.current?.click()} className="header-btn" style={ghostButtonStyle('teal')}>
              Import JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importConfig(f);
                if (e.target) e.target.value = '';
              }}
            />
            {onSwitchProfile && (
              <button onClick={onSwitchProfile} className="header-btn" style={ghostButtonStyle('teal')}>Configurations</button>
            )}
            <button onClick={onSwitchTenant} className="header-btn" style={ghostButtonStyle('neutral')}>{localMode ? 'Connect UiPath tenant' : 'Switch tenant'}</button>
            <button onClick={onLogout} className="header-btn" style={ghostButtonStyle('danger')}>Logout</button>
          </div>
        </div>

        {/* Tab strip */}
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className="tab-btn"
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  padding: '14px 18px',
                  background: 'transparent',
                  color: isActive ? defaultConfig.branding.accentColor : 'rgba(24,33,38,0.6)',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? defaultConfig.branding.accentColor : 'transparent'}`,
                  whiteSpace: 'nowrap',
                  letterSpacing: -0.1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Tab body */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 96px' }}>
        {status.error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.28)',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            {status.error}
          </div>
        )}
        {status.notice && !status.error && (
          <div
            style={{
              background: 'rgba(255,51,51,0.08)',
              border: '1px solid rgba(255,51,51,0.25)',
              color: '#0a8c9c',
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            {status.notice}
          </div>
        )}

        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid rgba(24,33,38,0.06)',
            padding: 32,
            marginBottom: 24,
            boxShadow:
              '0 1px 2px rgba(24,33,38,0.03), 0 8px 24px -8px rgba(24,33,38,0.06)',
          }}
        >
          {status.loading && !meta ? (
            <div
              style={{
                color: 'rgba(24,33,38,0.55)',
                fontSize: 14,
                textAlign: 'center',
                padding: 48,
              }}
            >
              Loading configuration…
            </div>
          ) : (
            activeTab
          )}
        </div>
      </main>

      {/* Sticky save footer — desktop docked above viewport bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255,255,255,0.92)',
          borderTop: '1px solid rgba(24,33,38,0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 5,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '14px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(24,33,38,0.55)' }}>
            {localMode
              ? `Configuration "${configName || 'Untitled'}" — saved in this browser.`
              : meta
                ? `Current: version ${meta.Version} · ${meta.ChunkCount} chunk${meta.ChunkCount === 1 ? '' : 's'} · last updated ${formatTimeAgo(meta.LastSavedAt)} by ${meta.LastSavedBy || '—'}`
                : 'No saved configuration yet for this tenant.'}
          </span>
          {localMode && (
            <button
              onClick={publishToDataFabric}
              disabled={status.loading}
              className="header-btn"
              title="Push this config to Data Fabric so your team sees it on staging"
              style={{
                marginInlineStart: 'auto',
                fontFamily: "'Poppins', Arial, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                padding: '12px 20px',
                background: 'rgba(24,33,38,0.06)',
                color: '#182126',
                border: '1px solid rgba(24,33,38,0.12)',
                borderRadius: 12,
                cursor: status.loading ? 'not-allowed' : 'pointer',
                opacity: status.loading ? 0.6 : 1,
                letterSpacing: -0.2,
              }}
            >
              Publish to Data Fabric
            </button>
          )}
          <button
            onClick={save}
            disabled={status.loading}
            className="save-btn"
            style={{
              marginInlineStart: localMode ? 0 : 'auto',
              fontFamily: "'Poppins', Arial, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              padding: '12px 24px',
              background: defaultConfig.branding.primaryColor,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: status.loading ? 'not-allowed' : 'pointer',
              opacity: status.loading ? 0.6 : 1,
              boxShadow: `0 6px 20px -6px ${defaultConfig.branding.primaryColor}80, 0 2px 4px rgba(24,33,38,0.06)`,
              letterSpacing: -0.2,
            }}
          >
            {status.loading
              ? 'Saving…'
              : localMode
                ? 'Save configuration'
                : meta
                  ? `Save changes (v${meta.Version} → v${meta.Version + 1})`
                  : 'Create configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function ghostButtonStyle(variant: 'teal' | 'neutral' | 'danger'): React.CSSProperties {
  const palette: Record<string, { bg: string; color: string }> = {
    teal: { bg: 'rgba(255,51,51,0.10)', color: '#0a8c9c' },
    neutral: { bg: 'rgba(24,33,38,0.06)', color: '#182126' },
    danger: { bg: 'rgba(239,68,68,0.10)', color: '#b91c1c' },
  };
  const c = palette[variant];
  return {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    padding: '7px 13px',
    borderRadius: 8,
    background: c.bg,
    color: c.color,
    border: 'none',
    letterSpacing: -0.1,
  };
}

function formatTimeAgo(iso: string): string {
  if (!iso) return 'just now';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}
