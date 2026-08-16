// ─────────────────────────────────────────────────────────────────────────────
// The application filter toolbar — shared by Open an account and My desk.
//
// Both screens offer the same three questions about a case (where is it, how did
// it arrive, what type is it), so the options and the predicate live here rather
// than in either screen. Two copies would drift the moment a state is added.
// ─────────────────────────────────────────────────────────────────────────────
import { isCorporate, type OnboardingCase, type OnboardingState } from '../onboarding';

export type Filter = 'all' | 'needs' | 'flight' | 'done';
export type Src = 'all' | 'bulk' | 'single';
export type Kind = 'all' | 'corporate' | 'individual';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs', label: 'Needs attention' },
  { id: 'flight', label: 'In flight' },
  { id: 'done', label: 'Done' },
];
export const SOURCES: { id: Src; label: string }[] = [
  { id: 'all', label: 'All sources' },
  { id: 'bulk', label: 'Bulk' },
  { id: 'single', label: 'Single' },
];
export const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'individual', label: 'Individual' },
];

export const needsAttention = (s: OnboardingState) =>
  s === 'EXCEPTION' || s === 'PENDING_LIVENESS' || s === 'PENDING_DOCUMENTS';

export interface FilterState { filter: Filter; source: Src; kind: Kind }

/** Nothing selected — every case passes, and the screens that mix in non-case
 *  work (My desk) can keep showing it. */
export const isFiltering = (f: FilterState) =>
  f.filter !== 'all' || f.source !== 'all' || f.kind !== 'all';

export function matchesFilters(c: OnboardingCase, { filter, source, kind }: FilterState): boolean {
  if (source === 'bulk' && !c.batchId) return false;
  if (source === 'single' && c.batchId) return false;
  if (kind === 'corporate' && !isCorporate(c)) return false;
  if (kind === 'individual' && isCorporate(c)) return false;
  if (filter === 'needs') return needsAttention(c.state);
  if (filter === 'flight') return !needsAttention(c.state) && c.state !== 'FULLY_ACTIVATED';
  if (filter === 'done') return c.state === 'FULLY_ACTIVATED';
  return true;
}
