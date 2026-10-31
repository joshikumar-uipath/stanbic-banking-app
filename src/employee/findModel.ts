// ─────────────────────────────────────────────────────────────────────────────
// What the one search box finds — openings, approvals and clients at once.
// Shared by the desk's Find and the phone's search screen, so both answer
// "where is Ngozi?" the same way.
// ─────────────────────────────────────────────────────────────────────────────
import { fullName, stateMeta, type OnboardingCase } from '../onboarding';
import { approvals, money } from '../approvalsData';
import { customers } from '../customersData';
import { getLinkedInstance, getCachedState } from '../onboarding/maestro';
import type { Tone } from './ui';
import type { Dest } from './DeskShell';

export type Hit = { key: string; who: string; sub: string; kind: string; tone: Tone; maestro?: string; go: () => void };

export function findHits(q: string, cases: OnboardingCase[], onNavigate: (d: Dest) => void, onOpenCase: (id: string) => void, limit = 8): Hit[] {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: Hit[] = [];
    for (const c of cases) {
      const n = fullName(c).trim();
      if (n.toLowerCase().includes(t) || c.id.toLowerCase().includes(t) || (c.accountNumber ?? '').includes(t)) {
        const m = stateMeta(c.state);
        // If the record is live in Maestro, surface its stage here too (read from the warm
        // cache the desk list keeps — no network call).
        const inst = getLinkedInstance(c.id);
        const ms = inst ? getCachedState(inst) : null;
        const maestro = ms && !ms.done && ms.jobState !== 'Unknown'
          ? ms.pendingTaskId
            ? ms.activeStage ? `${ms.activeStage} · awaiting` : 'Awaiting approval'
            : ms.activeStage ? `${ms.activeStage} · running` : 'Running'
          : undefined;
        out.push({ key: `c-${c.uid ?? c.id}`, who: n || 'Unnamed applicant', sub: c.id, kind: m.label,
          tone: m.tone === 'exception' ? 'crit' : m.tone === 'pending' ? 'warn' : m.tone === 'good' ? 'good' : 'info',
          maestro, go: () => onOpenCase(c.id) });
      }
    }
    for (const a of approvals) {
      if (a.customer.toLowerCase().includes(t) || a.title.toLowerCase().includes(t)) {
        out.push({ key: `a-${a.id}`, who: a.customer, sub: `${a.title}${a.amount ? ` · ${money(a.amount)}` : ''}`, kind: 'Approval',
          tone: a.slaBreaching ? 'crit' : 'info', go: () => onNavigate('approvals') });
      }
    }
    for (const c of customers) {
      if (c.name.toLowerCase().includes(t) || c.maskedId.toLowerCase().includes(t)) {
        out.push({ key: `k-${c.id}`, who: c.name, sub: `${c.maskedId} · ${c.segment}`, kind: 'Client',
          tone: c.headlineTone === 'warn' ? 'warn' : 'idle', go: () => onNavigate('customers') });
      }
    }
    return out.slice(0, limit);
  }
