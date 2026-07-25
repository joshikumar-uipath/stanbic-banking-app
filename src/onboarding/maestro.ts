// ─────────────────────────────────────────────────────────────────────────────
// Bridge to the REAL UiPath Maestro case (Phase 2).
//
// The /cases surface mirrors the onboarding case visually; this module drives the
// *actual* `OnboardingCase` Case Management process deployed on the mea tenant —
// starting a live instance and walking it through its human approvals — using the
// app's existing UiPath demo token (same one useAuth uses for Orchestrator REST).
//
// Everything goes through the Vite dev proxy (`/{org}/{tenant}/orchestrator_`), so
// no CORS and no new backend. The active stage is derived from the pending
// approval task's title, so the whole loop stays on the orchestrator_ surface.
// ─────────────────────────────────────────────────────────────────────────────
const ORG = (import.meta.env.VITE_UIPATH_ORG_NAME as string) || 'mea';
const TENANT = (import.meta.env.VITE_UIPATH_TENANT_NAME as string) || 'DefaultTenant';
const TOKEN = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;

const BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/orchestrator_`
  : `https://staging.api.uipath.com/${ORG}/${TENANT}/orchestrator_`;

// The deployed OnboardingCase, folder Shared/OnboardingCase, mea/DefaultTenant.
const FOLDER_KEY = '07fe31c1-84c8-4ac4-a3ae-ae875b1609e7';
const FOLDER_ID = 3268303;
const RELEASE_KEY = '32a69266-8822-4ce2-9cfd-093beb25ec73';

export const STAGES = ['Intake', 'Verification', 'Decision', 'Activation', 'Closure'] as const;

// Each stage is gated by one app-bound human approval; its task title tells us the stage.
const STAGE_BY_TASK: Record<string, string> = {
  'Duplicate & risk pre-screen': 'Intake',
  'Analyst review & exceptions': 'Verification',
  'Onboarding officer decision': 'Decision',
  'Activation sign-off': 'Activation',
  'Generate audit report': 'Closure',
};

/** True when the app was built with a UiPath demo token — otherwise the loop is disabled. */
export const maestroReady = (): boolean => Boolean(TOKEN);

// ── Record ↔ real Maestro instance link (localStorage; shared with the Ops app) ──
const LINK_KEY = 'aof_maestro_links';
function readLinks(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LINK_KEY) || '{}'); } catch { return {}; }
}
export function getLinkedInstance(recordId: string): string | null {
  return readLinks()[recordId] ?? null;
}
export function linkInstance(recordId: string, instanceId: string): void {
  const m = readLinks(); m[recordId] = instanceId; localStorage.setItem(LINK_KEY, JSON.stringify(m));
}
export function unlinkInstance(recordId: string): void {
  const m = readLinks(); delete m[recordId]; localStorage.setItem(LINK_KEY, JSON.stringify(m));
}

export function instanceUrl(instanceId: string): string {
  return `https://staging.uipath.com/${ORG}/${TENANT}/maestro_/cases/${RELEASE_KEY}/instances/${instanceId}?folderKey=${FOLDER_KEY}`;
}

/**
 * The bridge config, for handing to the standalone Ops console (public/ops-console.html)
 * over postMessage — so the token lives only in the app bundle, never in static HTML,
 * and the console drives the SAME real case on the SAME orchestrator_ proxy.
 */
export function maestroConfig() {
  return { token: TOKEN, base: BASE, folderId: FOLDER_ID, folderKey: FOLDER_KEY, releaseKey: RELEASE_KEY, org: ORG, tenant: TENANT };
}

async function orch<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-UIPATH-OrganizationUnitId': String(FOLDER_ID),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`UiPath ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export interface CaseInput {
  applicantId: string;
  firstName: string;
  lastName: string;
  bvn?: string;
  nin?: string;
  channel?: string;
}

/** Start a live OnboardingCase instance in Maestro. Returns its instance id. */
export async function startCase(input: CaseInput): Promise<string> {
  const r = await orch<{ value: { Key: string }[] }>('POST', '/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs', {
    startInfo: {
      ReleaseKey: RELEASE_KEY,
      Strategy: 'ModernJobsCount',
      JobsCount: 1,
      InputArguments: JSON.stringify({ ...input, channel: input.channel ?? 'self', approved: true }),
    },
  });
  const id = r.value?.[0]?.Key;
  if (!id) throw new Error('No instance returned from StartJobs');
  return id;
}

export interface LiveState {
  jobState: string;                 // Running | Successful | Faulted | …
  done: boolean;
  activeStage: string | null;
  completedStages: string[];
  pendingTaskId: number | null;
  pendingTitle: string | null;
}

/** Current real state of the case: job status + which stage is awaiting approval. */
export async function getState(instanceId: string): Promise<LiveState> {
  const jr = await orch<{ value: { State: string }[] }>('GET', `/odata/Jobs?%24filter=Key%20eq%20${instanceId}&%24select=State`);
  const jobState = jr.value?.[0]?.State ?? 'Unknown';
  const done = jobState === 'Successful' || jobState === 'Completed';

  if (done) return { jobState, done: true, activeStage: null, completedStages: [...STAGES], pendingTaskId: null, pendingTitle: null };

  const tr = await orch<{ value: { Id: number; Title: string; OrganizationUnitId: number; CreatorJobKey: string }[] }>(
    'GET',
    `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?%24filter=Status%20ne%20'Completed'&%24orderby=CreationTime%20desc&%24top=40`,
  );
  // Scope strictly to THIS instance — CreatorJobKey is the case job that spawned the task.
  const pending = (tr.value ?? []).find((t) => t.OrganizationUnitId === FOLDER_ID && t.CreatorJobKey === instanceId && STAGE_BY_TASK[t.Title]);
  const activeStage = pending ? STAGE_BY_TASK[pending.Title] : null;
  const idx = activeStage ? STAGES.indexOf(activeStage as (typeof STAGES)[number]) : -1;
  const completedStages = idx > 0 ? STAGES.slice(0, idx) : [];

  return {
    jobState,
    done: false,
    activeStage,
    completedStages,
    pendingTaskId: pending?.Id ?? null,
    pendingTitle: pending?.Title ?? null,
  };
}

async function currentUserId(): Promise<number> {
  const me = await orch<{ Id: number }>('GET', '/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUserExtended()');
  return me.Id;
}

/** Approve the pending stage decision — advances the real case to the next stage. */
export async function approve(taskId: number): Promise<void> {
  const userId = await currentUserId();
  await orch('POST', '/odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks', { taskAssignments: [{ TaskId: taskId, UserId: userId }] });
  await orch('POST', '/tasks/AppTasks/CompleteAppTask', { taskId, data: { decision: 'Approve' }, action: 'Approve' });
}
