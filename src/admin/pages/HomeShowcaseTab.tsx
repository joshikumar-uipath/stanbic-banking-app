import type { ShowcaseItem } from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Field } from './BrandingTab';

export default function HomeShowcaseTab({ items, onChange }: { items: ShowcaseItem[]; onChange: (next: ShowcaseItem[]) => void }) {
  const updateAt = (i: number, patch: Partial<ShowcaseItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...items, {
    name: 'New item', category: 'Agent', color: '#FF3333', video: './agent-card.mp4',
  }]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Home — Recently Active carousel"
        subtitle="Scrolling banner on the home screen. Each item links to either a chat agent (by name) or an Explore tile (by capability id)."
      />
      {items.map((item, i) => (
        <div
          key={i}
          style={{ background: '#f9f9f9', borderRadius: 12, border: '1px solid rgba(24,33,38,0.06)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(24,33,38,0.55)' }}>#{i + 1}</span>
            <span style={{ fontSize: 13, color: '#182126' }}>{item.name}</span>
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
              <SmallBtn onClick={() => move(i, -1)} disabled={i === 0}>↑</SmallBtn>
              <SmallBtn onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</SmallBtn>
              <SmallBtn onClick={() => removeAt(i)} variant="danger">Remove</SmallBtn>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Field label="Name">
              <input className="admin-input" style={fieldInput} value={item.name} onChange={(e) => updateAt(i, { name: e.target.value })} />
            </Field>
            <Field label="Category badge">
              <input className="admin-input" style={fieldInput} value={item.category} onChange={(e) => updateAt(i, { category: e.target.value })} placeholder="Agent / RPA / Maestro / …" />
            </Field>
            <Field label="Accent color (hex)">
              <input className="admin-input" style={{ ...fieldInput, fontFamily: 'monospace' }} value={item.color} onChange={(e) => updateAt(i, { color: e.target.value })} />
            </Field>
            <Field label="Video URL">
              <input className="admin-input" style={fieldInput} value={item.video} onChange={(e) => updateAt(i, { video: e.target.value })} />
            </Field>
            <Field label="Video scale">
              <input className="admin-input" style={fieldInput} type="number" step="0.1" value={item.videoScale ?? 1} onChange={(e) => updateAt(i, { videoScale: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Tap action — chat agent name">
              <input className="admin-input" style={fieldInput} value={item.chatAgentName ?? ''} onChange={(e) => updateAt(i, { chatAgentName: e.target.value || undefined })} placeholder="Leave blank if Explore link" />
            </Field>
            <Field label="Tap action — Explore tile id">
              <input className="admin-input" style={fieldInput} value={item.exploreCategory ?? ''} onChange={(e) => updateAt(i, { exploreCategory: e.target.value || undefined })} placeholder="agents / rpa / maestro / …" />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{
          alignSelf: 'flex-start', fontSize: 13, padding: '10px 18px', borderRadius: 10,
          background: 'rgba(255,51,51,0.10)', color: '#FF3333',
          border: '1px solid rgba(255,51,51,0.25)', cursor: 'pointer',
        }}
      >+ Add showcase item</button>
    </div>
  );
}

function SmallBtn({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 12, padding: '5px 10px', borderRadius: 6,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        background: variant === 'danger' ? 'rgba(239,68,68,0.10)' : 'rgba(24,33,38,0.06)',
        color: variant === 'danger' ? '#dc2626' : '#182126',
      }}
    >{children}</button>
  );
}
