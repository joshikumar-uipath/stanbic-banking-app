// ─────────────────────────────────────────────────────────────────────────────
// Ops-layer derivations. Priority, SLA, risk and assignee are computed from the
// case data (not stored) so the workbench reads enterprise-grade without
// changing the shared model. Swap for real fields when the backend provides them.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase, OnboardingState, ValidationKind, ValidationStatus } from '../onboarding';

export const valOf = (c: OnboardingCase, k: ValidationKind): ValidationStatus =>
  c.validations.find((v) => v.kind === k)?.status ?? 'pending';

export function hash(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Priority ──
export type Priority = 'high' | 'medium' | 'low';
export function priorityOf(c: OnboardingCase): Priority {
  if (c.state === 'EXCEPTION' || c.duplicate === 'potential-duplicate') return 'high';
  if (c.state === 'VALIDATED' || c.state === 'VALIDATION_IN_PROGRESS') return 'medium';
  return 'low';
}

// ── SLA ──
const SLA_MIN: Partial<Record<OnboardingState, number>> = {
  PRE_REGISTERED: 30, VALIDATION_IN_PROGRESS: 30, VALIDATED: 15,
  EXCEPTION: 60, PENDING_DOCUMENTS: 2880, PENDING_LIVENESS: 2880,
};
export interface Sla { has: boolean; tone: 'ok' | 'warn' | 'breach' | 'none'; label: string; }
function dur(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); const rem = m % 60;
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
export function slaOf(c: OnboardingCase): Sla {
  const target = SLA_MIN[c.state];
  if (!target) return { has: false, tone: 'none', label: '—' };
  const due = new Date(c.createdAt).getTime() + target * 60000;
  const rem = due - Date.now();
  if (rem < 0) return { has: true, tone: 'breach', label: `${dur(-rem)} over` };
  const tone: Sla['tone'] = rem < target * 60000 * 0.25 ? 'warn' : 'ok';
  return { has: true, tone, label: `${dur(rem)} left` };
}

// ── Risk ──
export interface Risk { score: number; level: 'low' | 'medium' | 'high'; }
export function riskOf(c: OnboardingCase): Risk {
  let s = 8;
  if (c.duplicate === 'potential-duplicate') s += 42; else if (c.duplicate === 'existing') s += 12;
  if (['AML', 'PEP', 'FRAUD'].some((k) => { const v = valOf(c, k as ValidationKind); return v === 'failed' || v === 'timeout'; })) s += 22;
  if (['NIN', 'BVN'].some((k) => { const v = valOf(c, k as ValidationKind); return v === 'failed' || v === 'timeout'; })) s += 18;
  if (c.state === 'EXCEPTION') s += 14;
  s = Math.min(100, s);
  return { score: s, level: s >= 55 ? 'high' : s >= 28 ? 'medium' : 'low' };
}

// ── Assignee ──
const ANALYSTS = ['Ade Okonkwo', 'Ruth Mbeki', 'Samuel Idris', 'Joy Aluko', 'Kene Obi'];
export function assigneeOf(c: OnboardingCase): string | null {
  if (c.state === 'EXCEPTION' && hash(c.id) % 3 === 0) return null; // some exceptions unassigned
  if (c.state === 'PRE_REGISTERED') return null;
  return ANALYSTS[hash(c.id + c.bvn) % ANALYSTS.length];
}

// ── Deterministic sparkline series ending near `end` (no randomness) ──
export function ramp(end: number, n = 12): number[] {
  const arr = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const base = end * (0.5 + 0.5 * t);
    const wobble = end * 0.07 * Math.sin(i * 1.6 + 0.5);
    return Math.max(0, Math.round(base + wobble));
  });
  arr[n - 1] = end;
  return arr;
}
