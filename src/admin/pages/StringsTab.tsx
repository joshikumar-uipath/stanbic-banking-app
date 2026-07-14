import { useState } from 'react';
import type { StringsConfig } from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Field } from './BrandingTab';

export default function StringsTab({ strings, onChange }: { strings: StringsConfig; onChange: (next: StringsConfig) => void }) {
  const langs = Object.keys(strings);
  const [active, setActive] = useState<string | null>(langs[0] ?? null);
  const [newLang, setNewLang] = useState('');

  const addLanguage = () => {
    const code = newLang.trim().toLowerCase();
    if (!code) return;
    onChange({ ...strings, [code]: strings[code] ?? {} });
    setActive(code);
    setNewLang('');
  };

  const removeLanguage = (code: string) => {
    const { [code]: _removed, ...rest } = strings;
    void _removed;
    onChange(rest);
    setActive(Object.keys(rest)[0] ?? null);
  };

  const setEntry = (code: string, key: string, value: string) => {
    onChange({ ...strings, [code]: { ...(strings[code] ?? {}), [key]: value } });
  };

  const removeEntry = (code: string, key: string) => {
    const { [key]: _removed, ...rest } = strings[code] ?? {};
    void _removed;
    onChange({ ...strings, [code]: rest });
  };

  const addEntry = (code: string) => {
    onChange({ ...strings, [code]: { ...(strings[code] ?? {}), '': '' } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Translation overrides"
        subtitle="Per-language string overrides on top of Aura's bundled translations. Empty by default — add a language and the keys you want to override."
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {langs.length > 0 ? langs.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setActive(code)}
            style={{
              fontFamily: 'monospace', fontSize: 13, padding: '6px 12px', borderRadius: 8,
              background: active === code ? 'rgba(255,51,51,0.12)' : 'rgba(24,33,38,0.06)',
              color: active === code ? '#FF3333' : '#182126',
              border: 'none', cursor: 'pointer',
              fontWeight: active === code ? 600 : 500,
            }}
          >{code}</button>
        )) : <span style={{ fontSize: 13, color: 'rgba(24,33,38,0.55)' }}>No languages yet.</span>}
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
          <input
            className="admin-input"
            style={{ ...fieldInput, padding: '6px 10px', fontSize: 13, width: 90, fontFamily: 'monospace' }}
            placeholder="en, ar, …"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLanguage(); } }}
          />
          <button
            type="button"
            onClick={addLanguage}
            style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,51,51,0.10)', color: '#FF3333',
              border: '1px solid rgba(255,51,51,0.25)', cursor: 'pointer',
            }}
          >+ Add language</button>
        </div>
      </div>

      {active && (
        <div style={{ background: '#f9f9f9', borderRadius: 12, border: '1px solid rgba(24,33,38,0.06)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#182126', fontFamily: 'monospace' }}>Editing: <strong>{active}</strong></span>
            <button
              type="button"
              onClick={() => removeLanguage(active)}
              style={{
                marginInlineStart: 'auto', fontSize: 12, padding: '5px 10px', borderRadius: 6,
                background: 'rgba(239,68,68,0.10)', color: '#dc2626', border: 'none', cursor: 'pointer',
              }}
            >Remove language</button>
          </div>

          <Field label="Translation key → value">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(strings[active] ?? {}).map(([k, v], idx) => (
                <div key={`${idx}-${k}`} style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: 8 }}>
                  <input
                    className="admin-input"
                    style={{ ...fieldInput, fontFamily: 'monospace', fontSize: 13, padding: '8px 10px' }}
                    placeholder="navHome"
                    value={k}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      const merged = Object.fromEntries(Object.entries(strings[active] ?? {}).map(([key, val], i) => i === idx ? [newKey, val] : [key, val]));
                      onChange({ ...strings, [active]: merged });
                    }}
                  />
                  <input
                    className="admin-input"
                    style={{ ...fieldInput, fontSize: 13, padding: '8px 10px' }}
                    placeholder="Home"
                    value={v}
                    onChange={(e) => setEntry(active, k, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeEntry(active, k)}
                    style={{
                      fontSize: 12, padding: '5px 10px', borderRadius: 6,
                      background: 'rgba(239,68,68,0.10)', color: '#dc2626', border: 'none', cursor: 'pointer',
                    }}
                  >Remove</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addEntry(active)}
                style={{
                  alignSelf: 'flex-start', fontSize: 12, padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(255,51,51,0.10)', color: '#FF3333',
                  border: '1px solid rgba(255,51,51,0.25)', cursor: 'pointer',
                }}
              >+ Add key</button>
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}
