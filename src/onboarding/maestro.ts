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

// Maestro case-instance state (persistent live stage) is on the pims_ service.
const PIMS_BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/pims_`
  : `https://staging.uipath.com/${ORG}/${TENANT}/pims_`;

// The deployed OnboardingCase, folder Banking/Account Opening/OnboardingCase,
// mea/DefaultTenant (solution OnboardingCaseSolution v1.0.29, migrated from
// Shared/OnboardingCase 2026-08-11 via a clean uninstall + fresh install).
//
// Migration gotcha worth remembering: the approval AppTask kept spawning back in
// Shared because `caseplan.json.bpmn` — the artifact Maestro actually EXECUTES —
// carried its own hardcoded app bindings and was stale. Editing caseplan.json
// alone is NOT enough; the .bpmn `<uipath:binding>` defaults + resourceKeys (and
// the copies inside its CDATA) must be repointed too, or every redeploy silently
// keeps routing approvals to the old folder's app.
const FOLDER_KEY = '34480da8-1d41-479f-bf3f-40689043c59a';
const FOLDER_ID = 3352699;
const RELEASE_KEY = '381f59ef-2dd1-4c00-8395-4b3d055fe430';

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

// ── Record ↔ real Maestro instance link ──────────────────────────────────────
// The link map is mirrored in UiPath Data Fabric (Data Service entity
// `AOFMaestroLink`) so it's SHARED across every user/browser — a case a colleague
// runs shows up live on your desk too. `localStorage` stays as a synchronous, offline
// cache: reads are instant and local, and Data Fabric hydrates + write-throughs keep
// every browser converged. If Data Fabric is unreachable, the app degrades to the old
// per-browser behaviour rather than breaking.
const LINK_KEY = 'aof_maestro_links';
// Bump when SEED_LINKS changes to a new set of instances — forces every browser to
// drop its cached links (which may point at old/faulted instances) and reseed fresh.
const LINK_SEED_KEY = 'aof_maestro_links_v';
const LINK_SEED = '2026-08-11-ao';
/** Fired on `window` after the Data Fabric hydrate merges shared links in, so open
 *  screens re-read their link and flip to the live embed without a manual refresh. */
export const LINKS_EVENT = 'aof-maestro-links';

const ENTITY = 'AOFMaestroLink';
const DS_BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/dataservice_`
  : `https://staging.uipath.com/${ORG}/${TENANT}/dataservice_`;

// Pre-seeded demo cases: these records already have a REAL Maestro instance parked at a
// stage (Intake / Verification / Decision / Activation), so the desk shows in-flight cases
// out of the box — no need for the RM to click "Run" first. Seeded locally AND pushed to
// Data Fabric so they're shared for everyone. (Instances live in the current deployment's
// folder; regenerate via scratchpad/seed_cases.sh after a redeploy.)
//
// The record ids are the FIRST few seeded desk cases (store seeds a fixed band from
// AO-2026-000101 — see SEED_BASE in store.ts), so they exist on every fresh browser and
// the links resolve to a real record regardless of how far the local counter has run.
// Each is matched to a store case whose state loosely mirrors the parked Maestro stage.
// Fresh live Maestro instances (case v1.0.26), each parked at a stage that MATCHES
// the record's outcome — so the desk never shows a contradictory outcome-vs-stage
// (e.g. "Fully activated" while the live case sits at Verification). Only in-flight
// records carry a live embed; completed records (e.g. 000101 Fully activated) do not.
const SEED_LINKS: Record<string, string> = {
  'AO-2026-000106': '4ba82a0a-6bc5-46c1-8e9d-4ef9eb62176b', // VALIDATION_IN_PROGRESS → Intake
  'AO-2026-000107': 'c9a5f2a1-0811-4288-b03f-e0a4d3c5cadf', // EXCEPTION            → Verification
  'AO-2026-000103': '48b2e1b3-4f6d-423b-b5e6-92bdfa75cafd', // VALIDATED            → Decision
  'AO-2026-000104': 'f7f5a929-f846-4812-8f11-f3544d296836', // PENDING_LIVENESS      → Activation
  'AO-2026-000102': 'f3cb6f70-50e9-4131-8bb8-2a9ad10235d3', // ACCOUNT_CREATED       → Activation
};

function readLinks(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LINK_KEY) || '{}'); } catch { return {}; }
}
function writeLinks(m: Record<string, string>): void {
  try { localStorage.setItem(LINK_KEY, JSON.stringify(m)); } catch { /* unavailable */ }
}

// ── Data Fabric (Data Service) transport ──
// Maps recordId → the Data Fabric row id, learned on hydrate/insert, so we can
// update/delete a link without re-querying. Populated best-effort.
const fabricRowId = new Map<string, string>();

async function ds<T = unknown>(method: string, path: string, body?: unknown): Promise<T | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(`${DS_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-UIPATH-OrganizationUnitId': String(FOLDER_ID),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch { return null; }
}

interface LinkRow { Id: string; RecordId: string; InstanceId: string }

/** Push (upsert) a link to Data Fabric. RecordId is unique, so replace any prior row. */
async function pushLinkToFabric(recordId: string, instanceId: string): Promise<void> {
  const existing = fabricRowId.get(recordId);
  if (existing) {
    // Same record already linked — drop the old row before inserting the new instance.
    await ds('POST', `/api/EntityService/${ENTITY}/delete`, [existing]);
    fabricRowId.delete(recordId);
  }
  const row = await ds<LinkRow>('POST', `/api/EntityService/${ENTITY}/insert`, { RecordId: recordId, InstanceId: instanceId });
  if (row?.Id) fabricRowId.set(recordId, row.Id);
}

/** Remove a link from Data Fabric (best-effort). */
async function deleteLinkFromFabric(recordId: string): Promise<void> {
  const id = fabricRowId.get(recordId);
  if (!id) return;
  await ds('POST', `/api/EntityService/${ENTITY}/delete`, [id]);
  fabricRowId.delete(recordId);
}

/** Merge the demo seed into the local link map (idempotent; existing links win).
 *  When LINK_SEED changes, the cached map is dropped first — stale links (e.g. to
 *  faulted instances from a previous seed) must not survive into the new set. */
function ensureSeeded(): void {
  let m = readLinks();
  try {
    if (localStorage.getItem(LINK_SEED_KEY) !== LINK_SEED) {
      m = {};                              // drop stale cached links
      localStorage.setItem(LINK_SEED_KEY, LINK_SEED);
    }
  } catch { /* storage unavailable */ }
  let changed = false;
  for (const [rec, inst] of Object.entries(SEED_LINKS)) { if (m[rec] !== inst) { m[rec] = inst; changed = true; } }
  if (changed) writeLinks(m);
}

/** Pull shared links from Data Fabric on startup and merge them into the local cache
 *  (Data Fabric is the shared source of truth). Emits LINKS_EVENT when the local cache
 *  changed, so open screens re-read. The hero SEED_LINKS are pushed up if missing so a
 *  fresh tenant is seeded — but arbitrary local-only links are NOT (they'd resurrect
 *  stale, browser-specific records that no other user can resolve). Real user runs reach
 *  the store through linkInstance() at click time. Best-effort; silent on failure. */
async function hydrateFromFabric(): Promise<void> {
  const res = await ds<{ value?: LinkRow[] }>('GET', `/api/EntityService/${ENTITY}/read?take=500`);
  if (!res?.value) { void seedFabric(); return; }
  const local = readLinks();
  let changed = false;
  const remoteRecords = new Set<string>();
  for (const r of res.value) {
    if (!r.RecordId || !r.InstanceId) continue;
    remoteRecords.add(r.RecordId);
    fabricRowId.set(r.RecordId, r.Id);
    if (local[r.RecordId] !== r.InstanceId) { local[r.RecordId] = r.InstanceId; changed = true; }
  }
  seedFabric(remoteRecords);   // ensure the shared hero links exist for everyone
  if (changed) { writeLinks(local); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LINKS_EVENT)); }
}

/** Seed Data Fabric with the hero SEED_LINKS that aren't already present. */
function seedFabric(present: Set<string> = new Set()): void {
  for (const [rec, inst] of Object.entries(SEED_LINKS)) { if (!present.has(rec)) void pushLinkToFabric(rec, inst); }
}

if (typeof window !== 'undefined') {
  ensureSeeded();
  void hydrateFromFabric();
  // Re-pull the shared links whenever the tab regains focus, so a case a colleague
  // ran on another machine appears when you switch back — without polling.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void hydrateFromFabric(); });
}

export function getLinkedInstance(recordId: string): string | null {
  return readLinks()[recordId] ?? null;
}
export function linkInstance(recordId: string, instanceId: string): void {
  const m = readLinks(); m[recordId] = instanceId; writeLinks(m);
  void pushLinkToFabric(recordId, instanceId);   // write-through to the shared store
}
export function unlinkInstance(recordId: string): void {
  const m = readLinks(); delete m[recordId]; writeLinks(m);
  void deleteLinkFromFabric(recordId);
}

export function instanceUrl(instanceId: string): string {
  return `https://staging.uipath.com/${ORG}/${TENANT}/maestro_/cases/${RELEASE_KEY}/instances/${instanceId}?folderKey=${FOLDER_KEY}`;
}

/** Deep-link to the pending human task in UiPath Action Center. */
export function actionCenterUrl(taskId: number): string {
  return `https://staging.uipath.com/${ORG}/${TENANT}/actions_/tasks/${taskId}`;
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

// pims_ needs the folder key as a header (not the numeric folder-unit id).
async function pims<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${PIMS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'x-uipath-folderkey': FOLDER_KEY },
  });
  if (!res.ok) throw new Error(`pims ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

interface ElementExec { elementType: string; elementName: string; status: string }

/**
 * The case instance's REAL stage progress from Maestro — persistent, unlike the
 * pending-task heuristic. `CaseStage` elements carry InProgress / Completed status
 * throughout, including while the case runs automated tasks between approvals.
 */
async function caseStages(instanceId: string): Promise<{ active: string | null; completed: string[] } | null> {
  try {
    const r = await pims<{ elementExecutions?: ElementExec[] }>(`/api/v1/element-executions/case-instances/${instanceId}`);
    const stages = (r.elementExecutions ?? []).filter((e) => e.elementType === 'CaseStage');
    // In case management a stage stays "InProgress" even after the next one starts, so a
    // stage is "reached" if it's InProgress OR Completed. The real active stage is the
    // FURTHEST reached along the main flow; everything before it counts as done.
    const reachedNames = new Set(stages.filter((e) => e.status !== 'NotStarted').map((e) => e.elementName));
    const reached = STAGES.filter((s) => reachedNames.has(s));
    const active = reached.length ? reached[reached.length - 1] : null;
    const idx = active ? STAGES.indexOf(active) : -1;
    const completed = idx > 0 ? STAGES.slice(0, idx) : [];
    return { active, completed };
  } catch {
    return null;
  }
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
// Last-known live state per instance, so opening/reopening a case paints its stage instantly
// (from cache) instead of the "starting…" placeholder while the network refresh runs. Shared:
// BOTH getState (the detail pane) and getStates (the list column) write to it, so opening a
// case the list already knows about is instant. Persisted per-tab so it survives a refresh.
const CACHE_KEY = 'aof_case_states';
const lastState = new Map<string, LiveState>();
(function hydrateCache() {
  try {
    const o = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') as Record<string, LiveState>;
    for (const [k, v] of Object.entries(o)) lastState.set(k, v);
  } catch { /* ignore */ }
})();
function persistCache(): void {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(lastState))); } catch { /* ignore */ }
}
export function getCachedState(instanceId: string): LiveState | null {
  return lastState.get(instanceId) ?? null;
}

export async function getState(instanceId: string): Promise<LiveState> {
  // Fire all three reads AT ONCE — first paint is gated by the slowest call, not the sum
  // of all three. (The two extra reads are wasted only for an already-completed case.)
  const [jr, stages, tr] = await Promise.all([
    orch<{ value: { State: string }[] }>('GET', `/odata/Jobs?%24filter=Key%20eq%20${instanceId}&%24select=State`),
    caseStages(instanceId),
    orch<{ value: { Id: number; Title: string; OrganizationUnitId: number; CreatorJobKey: string }[] }>(
      'GET',
      `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?%24filter=Status%20ne%20'Completed'&%24orderby=CreationTime%20desc&%24top=40`,
    ),
  ]);
  const jobState = jr.value?.[0]?.State ?? 'Unknown';
  const done = jobState === 'Successful' || jobState === 'Completed';

  let result: LiveState;
  if (done) {
    result = { jobState, done: true, activeStage: null, completedStages: [...STAGES], pendingTaskId: null, pendingTitle: null };
  } else {
    // Scope strictly to THIS instance — CreatorJobKey is the case job that spawned the task.
    const pending = (tr.value ?? []).find((t) => t.OrganizationUnitId === FOLDER_ID && t.CreatorJobKey === instanceId && STAGE_BY_TASK[t.Title]);
    const pendingStage = pending ? STAGE_BY_TASK[pending.Title] : null;
    // Prefer the case instance's real stage; fall back to the pending task's stage.
    let activeStage = stages?.active ?? pendingStage;
    let completedStages = stages?.completed ?? [];
    if (!stages && pendingStage) {
      const idx = STAGES.indexOf(pendingStage as (typeof STAGES)[number]);
      completedStages = idx > 0 ? STAGES.slice(0, idx) : [];
    }
    // A pending approval means its stage is the one awaiting action, not yet complete.
    if (pendingStage) { activeStage = pendingStage; completedStages = completedStages.filter((s) => s !== pendingStage); }
    result = { jobState, done: false, activeStage, completedStages, pendingTaskId: pending?.Id ?? null, pendingTitle: pending?.Title ?? null };
  }
  lastState.set(instanceId, result);
  persistCache();
  return result;
}

/** Compact live state for the desk list column. */
export interface LiveStateLite {
  jobState: string;          // Running | Successful | Faulted | Unknown
  done: boolean;
  awaiting: boolean;         // parked on a human approval (needs intervention)
  stage: string | null;      // current stage, e.g. "Decision"
}

/**
 * Bulk live state for MANY instances in just TWO calls (all job states + all open tasks),
 * so the desk list can show a Maestro column without hammering the API per row. The stage
 * shown while a case runs automated steps between approvals falls back to the per-instance
 * cache (populated when the case is opened); the awaiting stage is always exact.
 */
export async function getStates(instanceIds: string[]): Promise<Record<string, LiveStateLite>> {
  const out: Record<string, LiveStateLite> = {};
  const ids = [...new Set(instanceIds)];
  if (!TOKEN || ids.length === 0) return out;
  const keyFilter = ids.map((id) => `Key%20eq%20${id}`).join('%20or%20');
  const [jr, tr] = await Promise.all([
    orch<{ value: { Key: string; State: string }[] }>('GET', `/odata/Jobs?%24filter=${keyFilter}&%24select=Key,State`),
    orch<{ value: { Id: number; Title: string; OrganizationUnitId: number; CreatorJobKey: string }[] }>(
      'GET',
      `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?%24filter=Status%20ne%20'Completed'&%24orderby=CreationTime%20desc&%24top=40`,
    ),
  ]).catch(() => [null, null] as const);
  const jobByKey = new Map((jr?.value ?? []).map((j) => [j.Key, j.State]));
  const taskByKey = new Map<string, { id: number; title: string; stage: string }>();
  for (const t of tr?.value ?? []) {
    if (t.OrganizationUnitId === FOLDER_ID && STAGE_BY_TASK[t.Title] && !taskByKey.has(t.CreatorJobKey)) {
      taskByKey.set(t.CreatorJobKey, { id: t.Id, title: t.Title, stage: STAGE_BY_TASK[t.Title] });
    }
  }
  let touched = false;
  for (const id of ids) {
    const jobState = jobByKey.get(id) ?? 'Unknown';
    const done = jobState === 'Successful' || jobState === 'Completed';
    const task = taskByKey.get(id);
    const awaitStage = task?.stage ?? null;
    const stage = awaitStage ?? getCachedState(id)?.activeStage ?? null;
    out[id] = { jobState, done, awaiting: Boolean(awaitStage), stage };
    // Seed the shared per-instance cache so opening this case paints instantly (with its
    // approve button, since we captured the task id). getState refines it on the detail poll.
    if (jobState !== 'Unknown') {
      const idx = stage ? STAGES.indexOf(stage as (typeof STAGES)[number]) : -1;
      lastState.set(id, {
        jobState,
        done,
        activeStage: done ? null : stage,
        completedStages: done ? [...STAGES] : idx > 0 ? STAGES.slice(0, idx) : [],
        pendingTaskId: task?.id ?? null,
        pendingTitle: task?.title ?? null,
      });
      touched = true;
    }
  }
  if (touched) persistCache();
  return out;
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
