// Demo content has three sub-sections: Agent Insights (the cards on Home),
// Action Center mock tasks (the popup banner + drill-in list), and Alerts
// (the full Alerts tab). Each is a repeatable-row form. Big tab — split
// into sub-pages keyed by an internal section state.

import { useState } from 'react';
import type {
  DemoContent,
  AgentRunResult,
  AgentActionItem,
  MockActionCenterTask,
  MockAlert,
  MockAlertReviewAction,
  MockAlertField,
} from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Field } from './BrandingTab';

type SubSection = 'insights' | 'tasks' | 'alerts';

export default function DemoContentTab({ demoContent, onChange }: { demoContent: DemoContent; onChange: (next: DemoContent) => void }) {
  const [active, setActive] = useState<SubSection>('insights');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Demo content"
        subtitle="Mock data shown to users while the app fills with real Action Center / agent data. Toggle the master switch to hide it entirely in production."
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#f9f9f9', borderRadius: 10, border: '1px solid rgba(24,33,38,0.06)' }}>
        <input
          type="checkbox"
          checked={demoContent.enabled}
          onChange={(e) => onChange({ ...demoContent, enabled: e.target.checked })}
          style={{ width: 18, height: 18, accentColor: '#FF3333' }}
        />
        <span style={{ fontSize: 14, fontWeight: 500, color: '#182126' }}>Demo content enabled</span>
        <span style={{ fontSize: 12, color: 'rgba(24,33,38,0.55)', marginInlineStart: 'auto' }}>
          Off = none of the data below ships to users.
        </span>
      </label>

      <div
        aria-disabled={demoContent.enabled}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          opacity: demoContent.enabled ? 0.45 : 1,
          pointerEvents: demoContent.enabled ? 'none' : 'auto',
          filter: demoContent.enabled ? 'grayscale(0.4)' : 'none',
          transition: 'opacity 0.18s ease, filter 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(24,33,38,0.08)', paddingBottom: 8 }}>
          <SubTabButton label={`Agent Insights (${demoContent.agentInsights.length})`} active={active === 'insights'} onClick={() => setActive('insights')} />
          <SubTabButton label={`Mock Tasks (${demoContent.tasks.length})`} active={active === 'tasks'} onClick={() => setActive('tasks')} />
          <SubTabButton label={`Alerts (${demoContent.alerts.length})`} active={active === 'alerts'} onClick={() => setActive('alerts')} />
        </div>

        {active === 'insights' && (
          <InsightsEditor
            insights={demoContent.agentInsights}
            onChange={(next) => onChange({ ...demoContent, agentInsights: next })}
          />
        )}
        {active === 'tasks' && (
          <TasksEditor
            tasks={demoContent.tasks}
            onChange={(next) => onChange({ ...demoContent, tasks: next })}
          />
        )}
        {active === 'alerts' && (
          <AlertsEditor
            alerts={demoContent.alerts}
            onChange={(next) => onChange({ ...demoContent, alerts: next })}
          />
        )}
      </div>
    </div>
  );
}

function SubTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? 'rgba(255,51,51,0.12)' : 'transparent',
        color: active ? '#FF3333' : 'rgba(24,33,38,0.6)',
        border: 'none',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
      }}
    >{label}</button>
  );
}

// ─── Agent Insights editor ───────────────────────────────────────────────
function InsightsEditor({ insights, onChange }: { insights: AgentRunResult[]; onChange: (n: AgentRunResult[]) => void }) {
  const updateAt = (i: number, patch: Partial<AgentRunResult>) =>
    onChange(insights.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () =>
    onChange([...insights, {
      id: `${Date.now()}`, agentName: 'New Agent', tag: 'Tag', tagColor: '#FF3333',
      summary: '', actions: [], timeAgo: 'just now', accentColor: '#FF3333',
    }]);
  const removeAt = (i: number) => onChange(insights.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {insights.map((r, i) => (
        <Card key={r.id} title={`#${i + 1} · ${r.agentName}`} onRemove={() => removeAt(i)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Field label="Agent name">
              <input className="admin-input" style={fieldInput} value={r.agentName} onChange={(e) => updateAt(i, { agentName: e.target.value })} />
            </Field>
            <Field label="Tag (badge text)">
              <input className="admin-input" style={fieldInput} value={r.tag} onChange={(e) => updateAt(i, { tag: e.target.value })} />
            </Field>
            <Field label="Tag color (hex)">
              <input className="admin-input" style={{ ...fieldInput, fontFamily: 'monospace' }} value={r.tagColor} onChange={(e) => updateAt(i, { tagColor: e.target.value })} />
            </Field>
            <Field label="Accent color (hex)">
              <input className="admin-input" style={{ ...fieldInput, fontFamily: 'monospace' }} value={r.accentColor} onChange={(e) => updateAt(i, { accentColor: e.target.value })} />
            </Field>
            <Field label="Time ago">
              <input className="admin-input" style={fieldInput} value={r.timeAgo} onChange={(e) => updateAt(i, { timeAgo: e.target.value })} />
            </Field>
          </div>
          <Field label="Summary">
            <input className="admin-input" style={fieldInput} value={r.summary} onChange={(e) => updateAt(i, { summary: e.target.value })} />
          </Field>
          <ActionsEditor
            actions={r.actions}
            onChange={(actions) => updateAt(i, { actions })}
          />
        </Card>
      ))}
      <AddButton label="+ Add agent insight" onClick={addRow} />
    </div>
  );
}

function ActionsEditor({ actions, onChange }: { actions: AgentActionItem[]; onChange: (n: AgentActionItem[]) => void }) {
  const updateAt = (i: number, patch: Partial<AgentActionItem>) =>
    onChange(actions.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const addRow = () =>
    onChange([...actions, { id: `${Date.now()}`, type: 'auto', text: '' }]);
  const removeAt = (i: number) => onChange(actions.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(24,33,38,0.55)', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4 }}>
        Actions ({actions.length})
      </div>
      {actions.map((a, i) => (
        <div key={a.id} style={{ background: '#fff', border: '1px solid rgba(24,33,38,0.06)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 130px 130px 130px 1fr auto', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(24,33,38,0.5)' }}>#{i + 1}</span>
            <select
              value={a.type}
              onChange={(e) => updateAt(i, { type: e.target.value as 'auto' | 'review' })}
              style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }}
            >
              <option value="auto">auto</option>
              <option value="review">review</option>
            </select>
            <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="ref" value={a.ref ?? ''} onChange={(e) => updateAt(i, { ref: e.target.value || undefined })} />
            <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="amount" value={a.amount ?? ''} onChange={(e) => updateAt(i, { amount: e.target.value || undefined })} />
            <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="text" value={a.text} onChange={(e) => updateAt(i, { text: e.target.value })} />
            <SmallBtn onClick={() => removeAt(i)} variant="danger">Remove</SmallBtn>
          </div>
          {a.type === 'review' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'rgba(24,33,38,0.55)' }}>Review action labels (comma-separated)</label>
              <input
                className="admin-input"
                style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }}
                value={(a.reviewActions ?? []).join(', ')}
                onChange={(e) => updateAt(i, { reviewActions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="Approve, Reject"
              />
            </div>
          )}
        </div>
      ))}
      <AddButton label="+ Add action" onClick={addRow} small />
    </div>
  );
}

// ─── Mock Tasks editor ───────────────────────────────────────────────────
function TasksEditor({ tasks, onChange }: { tasks: MockActionCenterTask[]; onChange: (n: MockActionCenterTask[]) => void }) {
  const updateAt = (i: number, patch: Partial<MockActionCenterTask>) =>
    onChange(tasks.map((tk, idx) => idx === i ? { ...tk, ...patch } : tk));
  const addRow = () =>
    onChange([...tasks, { Id: 9000 + tasks.length, Title: 'New Task', Status: 'Pending', minutesAgo: 0 }]);
  const removeAt = (i: number) => onChange(tasks.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tasks.map((tk, i) => (
        <Card key={tk.Id} title={`#${i + 1} · ${tk.Title}`} onRemove={() => removeAt(i)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Field label="Task ID (number)">
              <input className="admin-input" style={fieldInput} type="number" value={tk.Id} onChange={(e) => updateAt(i, { Id: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Category (bold label)">
              <input className="admin-input" style={fieldInput} value={tk.category ?? ''} placeholder="e.g. Invoice Task" onChange={(e) => updateAt(i, { category: e.target.value || undefined })} />
            </Field>
            <Field label="Status">
              <input className="admin-input" style={fieldInput} value={tk.Status} onChange={(e) => updateAt(i, { Status: e.target.value })} />
            </Field>
            <Field label="Assigned to">
              <input className="admin-input" style={fieldInput} value={tk.AssignedToUser ?? ''} onChange={(e) => updateAt(i, { AssignedToUser: e.target.value || undefined })} />
            </Field>
            <Field label="Minutes ago">
              <input className="admin-input" style={fieldInput} type="number" min={0} value={tk.minutesAgo ?? 0} onChange={(e) => updateAt(i, { minutesAgo: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Field label="Title">
            <input className="admin-input" style={fieldInput} value={tk.Title} onChange={(e) => updateAt(i, { Title: e.target.value })} />
          </Field>
        </Card>
      ))}
      <AddButton label="+ Add mock task" onClick={addRow} />
    </div>
  );
}

// ─── Alerts editor ───────────────────────────────────────────────────────
function AlertsEditor({ alerts, onChange }: { alerts: MockAlert[]; onChange: (n: MockAlert[]) => void }) {
  const updateAt = (i: number, patch: Partial<MockAlert>) =>
    onChange(alerts.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const addRow = () =>
    onChange([...alerts, {
      id: `alert-${Date.now()}`, type: 'action', agent: 'Agent', title: 'New alert',
      desc: '', daysAgo: 0, hour: -1, minute: -1, read: false,
    }]);
  const removeAt = (i: number) => onChange(alerts.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {alerts.map((a, i) => (
        <Card key={a.id} title={`#${i + 1} · ${a.title}`} onRemove={() => removeAt(i)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Field label="ID">
              <input className="admin-input" style={{ ...fieldInput, fontFamily: 'monospace' }} value={a.id} onChange={(e) => updateAt(i, { id: e.target.value })} />
            </Field>
            <Field label="Type">
              <select
                value={a.type}
                onChange={(e) => updateAt(i, { type: e.target.value as MockAlert['type'] })}
                style={{ ...fieldInput }}
              >
                <option value="action">action</option>
                <option value="success">success</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </Field>
            <Field label="Agent">
              <input className="admin-input" style={fieldInput} value={a.agent} onChange={(e) => updateAt(i, { agent: e.target.value })} />
            </Field>
            <Field label="Days ago">
              <input className="admin-input" style={fieldInput} type="number" min={0} value={a.daysAgo} onChange={(e) => updateAt(i, { daysAgo: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Hour (-1 for now)">
              <input className="admin-input" style={fieldInput} type="number" min={-1} max={23} value={a.hour} onChange={(e) => updateAt(i, { hour: Number(e.target.value) })} />
            </Field>
            <Field label="Minute (-1 for now)">
              <input className="admin-input" style={fieldInput} type="number" min={-1} max={59} value={a.minute} onChange={(e) => updateAt(i, { minute: Number(e.target.value) })} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#182126', alignSelf: 'flex-end' }}>
              <input type="checkbox" checked={a.read} onChange={(e) => updateAt(i, { read: e.target.checked })} />
              Read
            </label>
          </div>
          <Field label="Title">
            <input className="admin-input" style={fieldInput} value={a.title} onChange={(e) => updateAt(i, { title: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="admin-input" style={{ ...fieldInput, minHeight: 60, resize: 'vertical' as const }} value={a.desc} onChange={(e) => updateAt(i, { desc: e.target.value })} />
          </Field>
          <ReviewActionsEditor
            label="Review actions (action-type only)"
            value={a.reviewActions ?? []}
            onChange={(reviewActions) => updateAt(i, { reviewActions: reviewActions.length > 0 ? reviewActions : undefined })}
          />
          <ReviewDetailEditor
            value={a.reviewDetail}
            onChange={(reviewDetail) => updateAt(i, { reviewDetail })}
          />
        </Card>
      ))}
      <AddButton label="+ Add alert" onClick={addRow} />
    </div>
  );
}

function ReviewActionsEditor({ label, value, onChange }: { label: string; value: MockAlertReviewAction[]; onChange: (n: MockAlertReviewAction[]) => void }) {
  const updateAt = (i: number, patch: Partial<MockAlertReviewAction>) =>
    onChange(value.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  const addRow = () => onChange([...value, { label: 'Action', style: 'primary' }]);
  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(24,33,38,0.55)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      {value.map((v, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center' }}>
          <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="Label" value={v.label} onChange={(e) => updateAt(i, { label: e.target.value })} />
          <select value={v.style} onChange={(e) => updateAt(i, { style: e.target.value as MockAlertReviewAction['style'] })} style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }}>
            <option value="primary">primary</option>
            <option value="secondary">secondary</option>
            <option value="danger">danger</option>
            <option value="warning">warning</option>
          </select>
          <SmallBtn onClick={() => removeAt(i)} variant="danger">Remove</SmallBtn>
        </div>
      ))}
      <AddButton label="+ Add review action" onClick={addRow} small />
    </div>
  );
}

function ReviewDetailEditor({ value, onChange }: { value: MockAlert['reviewDetail']; onChange: (n: MockAlert['reviewDetail']) => void }) {
  const fields = value?.fields ?? [];
  const setRef = (ref: string) => onChange({ ...(value ?? { fields: [] }), ref: ref || undefined, fields });
  const setAmount = (amount: string) => onChange({ ...(value ?? { fields: [] }), amount: amount || undefined, fields });
  const setFields = (next: MockAlertField[]) => onChange({ ...(value ?? {}), fields: next });
  const updateField = (i: number, patch: Partial<MockAlertField>) =>
    setFields(fields.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const addField = () => setFields([...fields, { label: '', value: '' }]);
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const clearAll = () => onChange(undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(24,33,38,0.55)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Review detail</span>
        {value && <SmallBtn onClick={clearAll} variant="danger">Remove detail</SmallBtn>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="ref (optional)" value={value?.ref ?? ''} onChange={(e) => setRef(e.target.value)} />
        <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="amount (optional)" value={value?.amount ?? ''} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 8 }}>
          <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="Label" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
          <input className="admin-input" style={{ ...fieldInput, padding: '8px 10px', fontSize: 13 }} placeholder="Value" value={f.value} onChange={(e) => updateField(i, { value: e.target.value })} />
          <SmallBtn onClick={() => removeField(i)} variant="danger">Remove</SmallBtn>
        </div>
      ))}
      <AddButton label="+ Add detail field" onClick={addField} small />
    </div>
  );
}

// ─── Shared inline helpers ───────────────────────────────────────────────
function Card({ title, onRemove, children }: { title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f9f9f9', borderRadius: 12, border: '1px solid rgba(24,33,38,0.06)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#182126' }}>{title}</span>
        <div style={{ marginInlineStart: 'auto' }}>
          <SmallBtn onClick={onRemove} variant="danger">Remove</SmallBtn>
        </div>
      </div>
      {children}
    </div>
  );
}

function AddButton({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        alignSelf: 'flex-start',
        fontSize: small ? 12 : 13,
        padding: small ? '6px 12px' : '10px 18px',
        borderRadius: small ? 8 : 10,
        background: 'rgba(255,51,51,0.10)',
        color: '#FF3333',
        border: '1px solid rgba(255,51,51,0.25)',
        cursor: 'pointer',
      }}
    >{label}</button>
  );
}

function SmallBtn({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant?: 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: variant === 'danger' ? 'rgba(239,68,68,0.10)' : 'rgba(24,33,38,0.06)',
        color: variant === 'danger' ? '#dc2626' : '#182126',
      }}
    >{children}</button>
  );
}
