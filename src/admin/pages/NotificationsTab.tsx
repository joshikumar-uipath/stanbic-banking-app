import type { NotificationsConfig } from '../../config';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Row, Field } from './BrandingTab';

export default function NotificationsTab({ notifications, onChange }: { notifications: NotificationsConfig; onChange: (next: NotificationsConfig) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Action Center notifications"
        subtitle="The pulsing banner Aura shows when a new task arrives. Tweak the substring filter to match your tenant's task titles."
      />
      <Row>
        <Field label="Title substring filter">
          <input
            className="admin-input"
            style={fieldInput}
            value={notifications.taskPopupFilter}
            onChange={(e) => onChange({ ...notifications, taskPopupFilter: e.target.value })}
            placeholder="Claim Data Verification"
          />
        </Field>
        <Field label="Recency window (ms)">
          <input
            className="admin-input"
            style={fieldInput}
            type="number"
            min={0}
            value={notifications.taskPopupRecencyMs}
            onChange={(e) => onChange({ ...notifications, taskPopupRecencyMs: Number(e.target.value) || 0 })}
          />
        </Field>
      </Row>
      <Row>
        <Field label="Auto-dismiss (ms)">
          <input
            className="admin-input"
            style={fieldInput}
            type="number"
            min={0}
            value={notifications.autoDismissMs}
            onChange={(e) => onChange({ ...notifications, autoDismissMs: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Poll interval (ms)">
          <input
            className="admin-input"
            style={fieldInput}
            type="number"
            min={0}
            value={notifications.taskPollIntervalMs}
            onChange={(e) => onChange({ ...notifications, taskPollIntervalMs: Number(e.target.value) || 0 })}
          />
        </Field>
      </Row>
    </div>
  );
}
