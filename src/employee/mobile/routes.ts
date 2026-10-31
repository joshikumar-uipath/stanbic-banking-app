// Where a case opens, by the job of the person opening it. An analyst works a
// case in the Operations view; a maker opens the form they confirm; a verifier
// the batch they authorise. Only the Relationship Manager gets the RM's case
// screen (with its customer actions and delete).
import type { OnboardingCase } from '../../onboarding';
import type { EmployeeRole } from '../../config';
import type { Route } from './nav';

export function routeFor(role: EmployeeRole, c: OnboardingCase | undefined): Route {
  if (!c) return { k: 'pipeline', lane: 'all' };
  if (role === 'ops') return { k: 'opsCase', id: c.id };
  if (role === 'maker' && c.state === 'AWAITING_EXTRACTION' && c.batchId) return { k: 'focus', batchId: c.batchId, startId: c.id };
  if (role === 'verifier' && c.batchId && c.reviewState) return { k: 'authorise', batchId: c.batchId };
  return { k: 'case', id: c.id };
}
