import type { FeatureFlags } from '../../config';
import { defaultConfig } from '../../config';
import { SectionHeader } from './BrandingTab';

export default function FeaturesTab({ features, onChange }: { features: FeatureFlags; onChange: (next: FeatureFlags) => void }) {
  const setFlag = <K extends keyof Omit<FeatureFlags, 'tabs'>>(key: K, value: boolean) =>
    onChange({ ...features, [key]: value });

  const setTab = (key: keyof FeatureFlags['tabs'], value: boolean) =>
    onChange({ ...features, tabs: { ...features.tabs, [key]: value } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader title="Feature flags" subtitle="Toggle whole capabilities on or off for this tenant." />
      <ToggleGrid>
        <Toggle label="Voice input (microphone)" hint="Hide the mic on iOS where WKWebView lacks Speech API support." checked={features.enableVoiceInput} onChange={(v) => setFlag('enableVoiceInput', v)} />
        <Toggle label="Camera attachments" checked={features.enableCamera} onChange={(v) => setFlag('enableCamera', v)} />
        <Toggle label="Web search" hint="Sends search queries through the Serper proxy." checked={features.enableSearch} onChange={(v) => setFlag('enableSearch', v)} />
        <Toggle label="Notifications poll" checked={features.enableNotifications} onChange={(v) => setFlag('enableNotifications', v)} />
        <Toggle label="Theme toggle" checked={features.enableThemeToggle} onChange={(v) => setFlag('enableThemeToggle', v)} />
        <Toggle label="Language selector" checked={features.enableLanguageSelector} onChange={(v) => setFlag('enableLanguageSelector', v)} />
        <Toggle label="Demo login (demo/demo)" hint="Disable in production — exposes a backdoor." checked={features.enableDemoLogin} onChange={(v) => setFlag('enableDemoLogin', v)} />
      </ToggleGrid>

      <SectionHeader title="Bottom navigation" subtitle="Show or hide entire tabs." />
      <ToggleGrid>
        <Toggle label="Home" checked={features.tabs.home} onChange={(v) => setTab('home', v)} />
        <Toggle label="Chat" checked={features.tabs.chat} onChange={(v) => setTab('chat', v)} />
        <Toggle label="Explore" checked={features.tabs.explore} onChange={(v) => setTab('explore', v)} />
        <Toggle label="Alerts" checked={features.tabs.alerts} onChange={(v) => setTab('alerts', v)} />
        <Toggle label="Profile" checked={features.tabs.profile} onChange={(v) => setTab('profile', v)} />
      </ToggleGrid>
    </div>
  );
}

function ToggleGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>{children}</div>;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12,
        background: '#f9f9f9', borderRadius: 10, border: '1px solid rgba(24,33,38,0.06)',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: defaultConfig.branding.accentColor, marginTop: 2, flexShrink: 0 }}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#182126' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'rgba(24,33,38,0.55)', marginTop: 2 }}>{hint}</div>}
      </div>
    </label>
  );
}
