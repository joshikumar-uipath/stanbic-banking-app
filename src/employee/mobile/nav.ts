// ─────────────────────────────────────────────────────────────────────────────
// The phone's navigation — a stack, the way a native app pushes screens.
// Opening anything pushes a full screen; Back pops it. Every screen reads the
// stack and the live data through context rather than threading callbacks.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext } from 'react';
import type { OnboardingCase } from '../../onboarding';
import type { BatchMeta } from '../bulk/batches';
import type { EmployeeRole } from '../../config';
import type { Lane } from './story';
import type { Tab } from '../../components/BottomNav';
import type { MAlert } from './alertsModel';

export type ApplicantTab = 'profile' | 'identity' | 'documents';

export type Route =
  // Relationship Manager
  | { k: 'pipeline'; lane?: Lane | 'all' }
  | { k: 'case'; id: string }
  | { k: 'applicant'; id: string; tab?: ApplicantTab }
  | { k: 'capture' }
  | { k: 'find' }
  | { k: 'newBatch' }
  | { k: 'batch'; id: string }
  | { k: 'disposition'; id: string }
  | { k: 'docs'; id: string; start?: number }
  // Maker
  | { k: 'focus'; batchId?: string; startId?: string }
  // Verifier
  | { k: 'authorise'; batchId?: string }
  // Operations analyst
  | { k: 'opsQueue'; cause?: string }
  | { k: 'opsCase'; id: string };

export interface WorkNav {
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  /** Back to the role's home. */
  home: () => void;
  role: EmployeeRole;
  setRole: (r: EmployeeRole) => void;
  openRoleSheet: () => void;
  openApprovals: () => void;
  openClients: () => void;
  openAssistant: () => void;
  userName: string;
  userEmail?: string;
  onLogout?: () => void;
  /** Roles this device may switch between, and whether it may. */
  roles: EmployeeRole[];
  canSwitchRole: boolean;
  /** The tab bar. */
  tab: Tab;
  setTab: (t: Tab) => void;
  /** From any tab: go to Home and open this screen on top of where you were. */
  open: (r: Route) => void;
  /** Go to Aura, asking this question (or just opening it). */
  /** Open Aura with a question, a photo (camera/file) to read, or both. */
  askAura: (q?: string, photo?: File) => void;
  toLauncher: () => void;
}

export interface WorkData {
  all: OnboardingCase[];
  /** What the branch captured — the RM's pipeline. */
  branch: OnboardingCase[];
  batched: OnboardingCase[];
  batches: BatchMeta[];
  byId: (id: string) => OnboardingCase | undefined;
  /** The alerts for this role, worked out once (MobileWork). */
  alerts: MAlert[];
}

export const NavContext = createContext<WorkNav | null>(null);
export const DataContext = createContext<WorkData | null>(null);

export function useNav(): WorkNav {
  const n = useContext(NavContext);
  if (!n) throw new Error('useNav outside the work area');
  return n;
}
export function useWorkData(): WorkData {
  const d = useContext(DataContext);
  if (!d) throw new Error('useWorkData outside the work area');
  return d;
}
