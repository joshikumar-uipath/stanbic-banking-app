// ─────────────────────────────────────────────────────────────────────────────
// Role sheet — the phone's "same workspace, different job" switcher.
//
// A bottom sheet rather than the desk's rail menu: it is reached from Home, from
// Profile and from the operations screen, so it lives at the app level and
// slides over whatever is showing. Picking a role reshapes Home immediately.
// Built on the kit (NSheet); the list follows Profile's "Work role" radio rows.
// ─────────────────────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core';
import { goToLauncher } from '../../skeleton/routes';
import type { EmployeeRole } from '../../config';
import { EMPLOYEE_ROLES } from './role';
import { NSheet } from './nkit';
import { useNk, haptic } from './nk';
import './mobile.css';

export default function RoleSheet({ role, roles, onPick, onClose }: { role: EmployeeRole; roles: EmployeeRole[]; onPick: (r: EmployeeRole) => void; onClose: () => void }) {
  const nk = useNk();
  return (
    <NSheet title="Switch role" subtitle="Same workspace — a different job. Home changes to match." onClose={onClose}>
      <div role="radiogroup" aria-label="Work role" className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
        {EMPLOYEE_ROLES.filter((r) => roles.includes(r.id)).map((r) => {
          const on = r.id === role;
          return (
            <button key={r.id} type="button" role="radio" aria-checked={on} className="mw-radio-row tap"
              onClick={() => { haptic(on ? 'tap' : 'success'); onPick(r.id); onClose(); }}
              style={{ borderColor: nk.sep, alignItems: 'flex-start', gap: 14, padding: '12px 0' }}>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                <span style={{ fontSize: 16, lineHeight: 1.3, fontWeight: on ? 600 : 500, color: on ? nk.accent : nk.ink }}>
                  {r.name}<span style={{ fontWeight: 400, color: nk.ink2 }}> · {r.sub}</span>
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.4, color: nk.ink2 }}>{r.blurb}</span>
              </span>
              <span style={{ width: 20, height: 20, flex: '0 0 auto', marginTop: 1, color: nk.accent }}>
                {on && <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
            </button>
          );
        })}
      </div>
      {!Capacitor.isNativePlatform() && (
        <button type="button" className="nk-link tap" onClick={() => { haptic(); goToLauncher(); }}
          style={{ color: nk.ink2, alignSelf: 'center', minHeight: 44, padding: '0 12px' }}>
          ← Back to the launcher
        </button>
      )}
    </NSheet>
  );
}

/** The chip that opens the sheet — shows who you are now. */
export function RoleChip({ role, onClick, tone = 'light' }: { role: EmployeeRole; onClick: () => void; tone?: 'light' | 'dark' }) {
  const nk = useNk();
  const info = EMPLOYEE_ROLES.find((r) => r.id === role) ?? EMPLOYEE_ROLES[0];
  const onDark = tone === 'dark';
  return (
    <button
      type="button" className="tap" onClick={() => { haptic(); onClick(); }} aria-label={`Role: ${info.name}. Switch role`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 10px', borderRadius: 999,
        background: 'transparent', border: `1px solid ${onDark ? 'rgba(255,255,255,0.4)' : nk.line}`,
        color: onDark ? '#fff' : nk.accent, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
      }}
    >
      {info.name}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}
