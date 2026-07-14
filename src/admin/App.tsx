import { useEffect, useState } from 'react';
import AdminLogin from './components/AdminLogin';
import TenantSetup from './components/TenantSetup';
import Dashboard from './components/Dashboard';
import ProfilePicker, { DEFAULT_PROFILE_ID } from './components/ProfilePicker';
import EntityProvisioning from './components/EntityProvisioning';
import AdminShell from './components/AdminShell';
import { isAdminLoggedIn, adminLogout } from './lib/adminAuth';
import { getAdminTenant, clearAdminTenant, type AdminTenantCredentials } from './lib/adminTenant';
import { fetchAuraConfig } from './lib/dataService';
import { defaultConfig, setActiveLocalProfile, upsertLocalProfile } from '../config';

// Stage progression (no-PAT local path):
//   login → profiles → dashboard
// Optional PAT / Data Service path:
//   login → tenant → check-entity → (provision if missing) → dashboard
//
// "check-entity" is a brief loading screen that fires fetchAuraConfig once;
// based on the result it either advances to dashboard, drops to provisioning,
// or bounces the admin back to tenant setup if the PAT was rejected.
type Stage = 'login' | 'profiles' | 'tenant' | 'check-entity' | 'provision' | 'dashboard';

export default function AdminApp() {
  const [stage, setStage] = useState<Stage>(() => {
    if (!isAdminLoggedIn()) return 'login';
    // Always land on the configuration picker. Connecting a UiPath tenant is a
    // one-time setup (stores the PAT + provisions the entity) and then returns
    // here; publishing to Data Fabric happens from the editor's Publish button.
    return 'profiles';
  });
  const [tenant, setTenant] = useState<AdminTenantCredentials | null>(() => getAdminTenant());
  const [profileName, setProfileName] = useState<string>('');
  const [checkError, setCheckError] = useState<string | null>(null);
  // Local editor is the default surface; publishing to Data Fabric is an action.
  const [localMode, setLocalMode] = useState(() => isAdminLoggedIn());

  // Whenever we land in 'check-entity' (right after connecting a tenant), probe
  // Data Service once; then open the Data Fabric editor (the live published
  // config) so "Connect a UiPath tenant" actually lands somewhere useful.
  useEffect(() => {
    if (stage !== 'check-entity' || !tenant) return;
    let cancelled = false;
    setCheckError(null);
    fetchAuraConfig(tenant).then((result) => {
      if (cancelled) return;
      if (result.kind === 'ok' || result.kind === 'not-found') {
        // Land on the picker, which now lists the whole Data Fabric library
        // ("From Data Fabric"). The user picks one and Loads it from there.
        setStage('profiles');
      } else if (result.kind === 'entity-missing') {
        setStage('provision');
      } else if (result.kind === 'unauthorized') {
        setCheckError(
          'Connected to the tenant, but this PAT was forbidden (403) from reading Data Service. ' +
          'Regenerate the PAT with the DataService.Data and DataService.Schema scopes ticked, then reconnect.'
        );
        setStage('tenant');
      } else {
        setCheckError(result.message);
        setStage('provision'); // surface as setup screen with error visible
      }
    });
    return () => { cancelled = true; };
  }, [stage, tenant]);

  if (stage === 'login') {
    return (
      <AdminLogin
        onLoggedIn={() => {
          setLocalMode(true);
          setStage('profiles');
        }}
      />
    );
  }

  if (stage === 'profiles') {
    return (
      <ProfilePicker
        onEdit={(id) => {
          // DEFAULT_PROFILE_ID → bundled default (activeId null); editing it and
          // saving creates a new named copy.
          setActiveLocalProfile(id === DEFAULT_PROFILE_ID ? null : id);
          setLocalMode(true);
          setStage('dashboard');
        }}
        onCreate={(name) => {
          upsertLocalProfile(null, name, defaultConfig);
          setLocalMode(true);
          setStage('dashboard');
        }}
        onConnectTenant={() => {
          setCheckError(null);
          setLocalMode(false);
          setStage('tenant');
        }}
        onLogout={() => {
          adminLogout();
          clearAdminTenant();
          setTenant(null);
          setProfileName('');
          setLocalMode(false);
          setStage('login');
        }}
      />
    );
  }

  if (stage === 'tenant' || (!tenant && !localMode)) {
    return (
      <TenantSetup
        initial={tenant}
        initialError={checkError}
        onConnected={(creds, profile) => {
          setTenant(creds);
          setProfileName(profile.name);
          setStage('check-entity');
        }}
        onSkipLocal={() => {
          setLocalMode(true);
          setStage('profiles');
        }}
      />
    );
  }

  if (stage === 'check-entity') {
    return (
      <AdminShell title="Connecting to Data Service…" subtitle="Verifying that the AuraConfig entity exists in this tenant.">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,51,51,0.18)',
              borderTopColor: '#FF3333',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
        {checkError && (
          <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: '#b91c1c' }}>{checkError}</p>
        )}
      </AdminShell>
    );
  }

  if (stage === 'provision' && tenant) {
    return (
      <EntityProvisioning
        tenant={tenant}
        onProvisioned={() => { setStage('profiles'); }}
        onSwitchTenant={() => {
          clearAdminTenant();
          setTenant(null);
          setProfileName('');
          setStage('tenant');
        }}
        onLogout={() => {
          adminLogout();
          clearAdminTenant();
          setTenant(null);
          setProfileName('');
          setStage('login');
        }}
      />
    );
  }

  return (
    <Dashboard
      tenant={tenant}
      profileName={profileName}
      localMode={localMode}
      onSwitchProfile={() => setStage('profiles')}
      onSwitchTenant={() => {
        clearAdminTenant();
        setTenant(null);
        setProfileName('');
        setLocalMode(false);
        setStage('tenant');
      }}
      onLogout={() => {
        adminLogout();
        clearAdminTenant();
        setTenant(null);
        setProfileName('');
        setLocalMode(false);
        setStage('login');
      }}
    />
  );
}
