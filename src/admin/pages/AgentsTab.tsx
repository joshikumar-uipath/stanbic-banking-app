import type { AgentsConfig } from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Field } from './BrandingTab';

export default function AgentsTab({ agents, onChange }: { agents: AgentsConfig; onChange: (next: AgentsConfig) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Allowed chat agents"
        subtitle="Only agents whose display name matches one of these are shown in the Chat tab. Order here is the display order. One per line."
      />
      <ListEditor
        items={agents.allowedChatAgentNames}
        onChange={(items) => onChange({ ...agents, allowedChatAgentNames: items })}
        placeholder="HR Assistant"
      />

      <SectionHeader
        title="Blocked process keys"
        subtitle="Agents whose processKey appears here are hidden from every view (Chat tab, history, switcher). One per line."
      />
      <ListEditor
        items={agents.blockedProcessKeys}
        onChange={(items) => onChange({ ...agents, blockedProcessKeys: items })}
        placeholder="MyOrg.Agent.processKey"
      />

      <SectionHeader
        title="Display name overrides"
        subtitle="Map an agent's raw name to a friendlier label shown in the chat header / dropdown."
      />
      <KeyValueEditor
        map={agents.displayNameOverrides}
        onChange={(m) => onChange({ ...agents, displayNameOverrides: m })}
        keyPlaceholder="Raw agent name"
        valuePlaceholder="Display label"
      />
    </div>
  );
}

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const value = items.join('\n');
  return (
    <Field label="One per line">
      <textarea
        className="admin-input"
        style={{ ...fieldInput, fontFamily: 'monospace', fontSize: 13, minHeight: 110, resize: 'vertical' as const }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
      />
    </Field>
  );
}

function KeyValueEditor({
  map, onChange, keyPlaceholder, valuePlaceholder,
}: {
  map: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const entries = Object.entries(map);
  const setEntry = (idx: number, k: string, v: string) => {
    const next = [...entries];
    next[idx] = [k, v];
    onChange(Object.fromEntries(next.filter(([key]) => key.length > 0)));
  };
  const removeEntry = (idx: number) => {
    const next = entries.filter((_, i) => i !== idx);
    onChange(Object.fromEntries(next));
  };
  const addEntry = () => onChange({ ...map, [`new-${entries.length}`]: '' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.length === 0 && <p style={{ fontSize: 12, color: 'rgba(24,33,38,0.55)' }}>No overrides yet.</p>}
      {entries.map(([k, v], idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="admin-input"
            style={{ ...fieldInput, fontFamily: 'monospace', fontSize: 13, flex: 1 }}
            value={k}
            placeholder={keyPlaceholder}
            onChange={(e) => setEntry(idx, e.target.value, v)}
          />
          <span style={{ color: 'rgba(24,33,38,0.4)' }}>→</span>
          <input
            className="admin-input"
            style={{ ...fieldInput, fontFamily: 'monospace', fontSize: 13, flex: 1 }}
            value={v}
            placeholder={valuePlaceholder}
            onChange={(e) => setEntry(idx, k, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeEntry(idx)}
            style={{
              fontSize: 12, padding: '6px 10px', borderRadius: 8,
              background: 'rgba(239,68,68,0.10)', color: '#dc2626', border: 'none', cursor: 'pointer',
            }}
          >Remove</button>
        </div>
      ))}
      <button
        type="button"
        onClick={addEntry}
        style={{
          alignSelf: 'flex-start', fontSize: 13, padding: '8px 14px', borderRadius: 8,
          background: 'rgba(255,51,51,0.10)', color: '#FF3333', border: '1px solid rgba(255,51,51,0.25)', cursor: 'pointer',
        }}
      >+ Add override</button>
    </div>
  );
}
