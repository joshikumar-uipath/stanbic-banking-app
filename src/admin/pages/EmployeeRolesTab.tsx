import type { EmployeeAppConfig, EmployeeRole } from '../../config';
import { defaultConfig } from '../../config';
import { EMPLOYEE_ROLES } from '../../employee/mobile/role';
import { fieldInput } from '../components/AdminShell';
import { SectionHeader, Row, Field } from './BrandingTab';

// Who the employee phone app opens as, and who it may become. The desk and the
// Operations Workbench are separate tools on a laptop; on the phone they are one
// app whose role reshapes it — so the bank decides which jobs a device carries.
export default function EmployeeRolesTab({ employeeApp, onChange }: { employeeApp: EmployeeAppConfig; onChange: (next: EmployeeAppConfig) => void }) {
  const set = <K extends keyof EmployeeAppConfig>(key: K, value: EmployeeAppConfig[K]) =>
    onChange({ ...employeeApp, [key]: value });

  const toggleRole = (id: EmployeeRole, on: boolean) => {
    // The default role is always offered — un-ticking it would leave the app
    // opening as a role nobody can switch back to.
    if (id === employeeApp.defaultRole) return;
    set('roles', on ? [...new Set([...employeeApp.roles, id])] : employeeApp.roles.filter((r) => r !== id));
  };

  const setDefault = (id: EmployeeRole) =>
    onChange({ ...employeeApp, defaultRole: id, roles: [...new Set([...employeeApp.roles, id])] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHeader
        title="Default role"
        subtitle="The job the employee app (/employee-mobile) opens as on a device that hasn't picked one."
      />
      <Row>
        <Field label="Opens as">
          <select className="admin-input" style={fieldInput} value={employeeApp.defaultRole} onChange={(e) => setDefault(e.target.value as EmployeeRole)}>
            {EMPLOYEE_ROLES.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.sub}</option>)}
          </select>
        </Field>
      </Row>

      <SectionHeader
        title="Role switching"
        subtitle="Let the user change role from Home, Profile or the operations screen. Off locks every device to the default role."
      />
      <Check
        label="Allow switching roles in the app"
        hint="The pick is remembered on the device until the user changes it."
        checked={employeeApp.allowSwitch}
        onChange={(v) => set('allowSwitch', v)}
      />

      <SectionHeader title="Roles offered" subtitle="Which jobs appear in the in-app switcher." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {EMPLOYEE_ROLES.map((r) => {
          const isDefault = r.id === employeeApp.defaultRole;
          return (
            <Check
              key={r.id}
              label={`${r.name}${isDefault ? ' (default)' : ''}`}
              hint={r.blurb}
              checked={isDefault || employeeApp.roles.includes(r.id)}
              disabled={isDefault || !employeeApp.allowSwitch}
              onChange={(v) => toggleRole(r.id, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Check({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12,
        background: '#f9f9f9', borderRadius: 10, border: '1px solid rgba(24,33,38,0.06)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.65 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
