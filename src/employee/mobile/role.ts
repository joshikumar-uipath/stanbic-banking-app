// ─────────────────────────────────────────────────────────────────────────────
// The phone's role — whose job the employee app is doing right now.
//
// The desk splits this across two tools (/employee-web for the branch, /ops for
// the back office) and a persona switch inside Batches. A phone can't hand you
// to another tool, so here it is ONE choice that reshapes the whole app:
//
//   rm        Relationship Manager — open accounts in the field or branch,
//             submit batches, chase the pipeline, approve, look after clients.
//   maker     Operations · Maker — confirm what OCR read off a batch's forms.
//   verifier  Operations · Verifier — set PND and open the confirmed accounts.
//   ops       Operations analyst — triage stuck cases across the bank.
//
// The admin console (Employee roles) sets the role a fresh install opens in and
// which roles may be switched to. The user's pick is remembered on the device.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig, defaultConfig, type EmployeeRole, type EmployeeAppConfig } from '../../config';
import type { Persona } from '../roles';

export interface RoleInfo {
  id: EmployeeRole;
  name: string;
  short: string;
  sub: string;
  blurb: string;
}

export const EMPLOYEE_ROLES: RoleInfo[] = [
  {
    id: 'rm',
    name: 'Relationship Manager',
    short: 'RM',
    sub: 'Branch & field',
    blurb: 'Open accounts, submit batches, chase your pipeline, approve and look after your clients.',
  },
  {
    id: 'maker',
    name: 'Operations · Maker',
    short: 'Maker',
    sub: 'Extraction review',
    blurb: 'Confirm what OCR read off each form in a batch, and correct it.',
  },
  {
    id: 'verifier',
    name: 'Operations · Verifier',
    short: 'Verifier',
    sub: 'Authorisation',
    blurb: 'Set the PND position and open the accounts a maker has confirmed.',
  },
  {
    id: 'ops',
    name: 'Operations analyst',
    short: 'Ops',
    sub: 'Exception triage',
    blurb: 'Clear stuck cases across the bank by cause, in bulk, and keep the line moving.',
  },
];

export const roleInfo = (id: EmployeeRole): RoleInfo => EMPLOYEE_ROLES.find((r) => r.id === id) ?? EMPLOYEE_ROLES[0];

/** The Batches persona a role works as. Ops analysts aren't a bulk persona. */
export const personaOf = (role: EmployeeRole): Persona =>
  role === 'maker' ? 'maker' : role === 'verifier' ? 'verifier' : 'rm';

const KEY = 'aof_employee_role';
const EVENT = 'aof-employee-role';

function readSaved(): EmployeeRole | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && EMPLOYEE_ROLES.some((r) => r.id === v) ? (v as EmployeeRole) : null;
  } catch { return null; }
}

/** The effective settings: admin config, falling back to the bundled default for
 *  configs saved before this section existed. The default is always offered. */
export function useEmployeeAppConfig(): EmployeeAppConfig {
  const cfg = useConfig();
  const ea = cfg.employeeApp ?? defaultConfig.employeeApp!;
  return useMemo(() => {
    const roles = EMPLOYEE_ROLES.map((r) => r.id).filter((id) => id === ea.defaultRole || ea.roles.includes(id));
    return { ...ea, roles };
  }, [ea]);
}

/**
 * The active role and a setter. A saved pick wins while the admin still offers
 * it; otherwise the admin's default. Every mounted copy of the hook stays in
 * step through a window event, so the Home chip, Profile and the ops screen
 * never disagree.
 */
export function useEmployeeRole(): { role: EmployeeRole; setRole: (r: EmployeeRole) => void; config: EmployeeAppConfig } {
  const config = useEmployeeAppConfig();
  const [saved, setSaved] = useState<EmployeeRole | null>(readSaved);

  useEffect(() => {
    const on = () => setSaved(readSaved());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);

  const role: EmployeeRole = config.allowSwitch && saved && config.roles.includes(saved) ? saved : config.defaultRole;

  const setRole = useCallback((r: EmployeeRole) => {
    try { localStorage.setItem(KEY, r); } catch { /* unavailable: the pick lasts this session */ }
    setSaved(r);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { role, setRole, config };
}
