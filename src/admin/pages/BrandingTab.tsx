import { useRef } from 'react';
import type { Branding, LogoSize } from '../../config';
import { fieldLabel, fieldInput } from '../components/AdminShell';

export default function BrandingTab({ branding, onChange }: { branding: Branding; onChange: (next: Branding) => void }) {
  const set = <K extends keyof Branding>(key: K, value: Branding[K]) =>
    onChange({ ...branding, [key]: value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Login screen"
        subtitle="Shown only on the sign-in screen, before users authenticate."
      />
      <Field label="Tagline">
        <input className="admin-input" style={fieldInput} value={branding.tagline} onChange={(e) => set('tagline', e.target.value)} />
      </Field>
      <Field label="Logo (welcome screen — optional)">
        <LogoInput value={branding.logo} onChange={(v) => set('logo', v)} />
      </Field>
      {branding.logo && (
        <Field label="Logo size">
          <SizeSelector value={branding.logoSize ?? 'large'} onChange={(v) => set('logoSize', v)} />
        </Field>
      )}

      <SectionHeader
        title="Inside the app"
        subtitle="Shown after sign-in — Home greeting, in-app headers, etc."
      />
      <Field label="Greeting word (Home — e.g. “Hello, John”)">
        <input className="admin-input" style={fieldInput} value={branding.greeting} onChange={(e) => set('greeting', e.target.value)} />
      </Field>

      <SectionHeader
        title="Shared identity (login + inside app)"
        subtitle="Name and brand colors applied everywhere — login, Home, Explore, Profile."
      />
      <Field label="App name">
        <input className="admin-input" style={fieldInput} value={branding.appName} onChange={(e) => set('appName', e.target.value)} />
      </Field>
      <Row>
        <Field label="Primary color">
          <ColorInput value={branding.primaryColor} onChange={(v) => set('primaryColor', v)} />
        </Field>
        <Field label="Secondary color (subtle accents)">
          <ColorInput value={branding.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
        </Field>
        <Field label="Accent color">
          <ColorInput value={branding.accentColor} onChange={(v) => set('accentColor', v)} />
        </Field>
        <Field label="Deep blue (legacy)">
          <ColorInput value={branding.deepBlue} onChange={(v) => set('deepBlue', v)} />
        </Field>
      </Row>
    </div>
  );
}

// ─── Local helpers (also re-used by other tabs) ─────────────────────────

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(24,33,38,0.06)', paddingBottom: 8, marginBottom: 4 }}>
      <h3 style={{ fontFamily: "'Poppins', Arial, sans-serif", fontSize: 16, fontWeight: 600, color: '#182126', margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: 'rgba(24,33,38,0.55)', margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="color"
        value={isValidHex(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        style={{ width: 44, height: 38, padding: 0, border: '1.5px solid rgba(24,33,38,0.08)', borderRadius: 8, cursor: 'pointer' }}
      />
      <input
        className="admin-input"
        style={{ ...fieldInput, fontFamily: 'monospace' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#FF3333"
      />
    </div>
  );
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

// Logo size — Small / Medium / Large segmented control. Maps to LOGO_SIZES in
// the config; the welcome + login screens render the logo at the chosen cap.
const LOGO_SIZE_OPTIONS: { id: LogoSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];
function SizeSelector({ value, onChange }: { value: LogoSize; onChange: (v: LogoSize) => void }) {
  return (
    <div style={{ display: 'inline-flex', border: '1.5px solid rgba(24,33,38,0.12)', borderRadius: 8, overflow: 'hidden' }}>
      {LOGO_SIZE_OPTIONS.map((o, i) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
              border: 'none', borderLeft: i ? '1.5px solid rgba(24,33,38,0.12)' : 'none',
              background: active ? '#182126' : '#fff', color: active ? '#fff' : '#182126',
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// Optional logo: upload an image → stored inline as a data URI in the config
// (so it travels through Data Fabric). Empty → the welcome screen shows the app
// name text on its own. Kept small (≤800 KB) to avoid bloating the chunked config.
const MAX_LOGO_BYTES = 800 * 1024;
function LogoInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const onFile = (file: File) => {
    if (file.size > MAX_LOGO_BYTES) {
      alert('That image is larger than 800 KB. Please use a smaller file (an SVG or a compressed PNG) so the config stays small in Data Fabric.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.onerror = () => alert('Could not read that image file.');
    reader.readAsDataURL(file);
  };
  const btn: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(24,33,38,0.12)',
    background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#182126',
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 132, height: 56, border: '1.5px dashed rgba(24,33,38,0.18)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc', overflow: 'hidden', flexShrink: 0 }}>
          {value
            ? <img src={value} alt="logo preview" style={{ maxWidth: '88%', maxHeight: '80%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 11, color: 'rgba(24,33,38,0.4)' }}>No logo</span>}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,.svg"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        />
        <button type="button" onClick={() => ref.current?.click()} style={btn}>
          {value ? 'Replace image' : 'Upload image'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} style={{ ...btn, color: '#b91c1c' }}>Remove</button>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'rgba(24,33,38,0.5)', marginTop: 6 }}>
        PNG or SVG. Shown above the app name on the welcome screen. Leave empty for a text-only view. Save / Publish to apply.
      </p>
    </div>
  );
}
