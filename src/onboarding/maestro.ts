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
import type { ValidationKind, ValidationResult, ValidationStatus } from './types';

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
/** Announce a link change to anything already on screen. Without this a link
 *  written after its row rendered is invisible until something else forces a
 *  recompute: the desk list builds its record→instance map when the record set
 *  changes, and a record is created BEFORE its case is linked — so the new row
 *  read "Not started" until a page reload. The hydrate already emits this; the
 *  local writers have to as well. */
function announceLinks(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LINKS_EVENT));
}

export function linkInstance(recordId: string, instanceId: string): void {
  const m = readLinks(); m[recordId] = instanceId; writeLinks(m);
  announceLinks();
  void pushLinkToFabric(recordId, instanceId);   // write-through to the shared store
}
export function unlinkInstance(recordId: string): void {
  const m = readLinks(); delete m[recordId]; writeLinks(m);
  announceLinks();
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

/**
 * Whether the CASE finished, from the case service itself.
 *
 * Not from the Orchestrator job: a Maestro case job never leaves `Running`. An
 * instance that completed cleanly still reports `State: Running` with a null
 * EndTime indefinitely, so deriving `done` from it pins a finished case to its
 * last stage forever. The instance record is what the Maestro UI shows.
 *
 * Returns null when the read fails, so callers can fall back rather than
 * declaring a running case complete (or vice versa) on a network blip.
 */
export async function instanceDone(instanceId: string): Promise<boolean | null> {
  try {
    const r = await pims<{ latestRunStatus?: string }>(`/api/v1/instances/${instanceId}`);
    const s = r?.latestRunStatus;
    return s ? s === 'Completed' || s === 'Successful' : null;
  } catch { return null; }
}

interface ElementExec {
  elementType: string;
  elementName: string;
  status: string;
  elementId?: string;
  /** Which stage this step belongs to — how the flat element list regains its shape. */
  caseStageElementId?: string;
  startedTimeUtc?: string;
  /** Action Center deep link for a human step. Carries the task id, which is the
   *  only reliable way to find it — the task is titled after the app, not the step. */
  externalLink?: string;
}

/** Steps worth showing. The rest of the element list is plumbing a banker has no
 *  use for — subprocesses, catch events, the guardrail agent. */
const STEP_TYPES = new Set(['UserTask', 'ServiceTask', 'Task', 'Agent']);

/** Finished work above, the live step, then what has not started. Strict start-time
 *  order puts a long-running approval above checks that finished after it began,
 *  which reads as though the case went backwards. This is a status list, not an
 *  audit log — the live line should be the "you are here". */
const STEP_RANK: Record<string, number> = { Completed: 0, Faulted: 0, InProgress: 1 };
const byProgress = (a: { status: string; startedTimeUtc?: string }, b: { status: string; startedTimeUtc?: string }) =>
  (STEP_RANK[a.status] ?? 2) - (STEP_RANK[b.status] ?? 2)
  || String(a.startedTimeUtc ?? '').localeCompare(String(b.startedTimeUtc ?? ''));


/**
 * The case instance's REAL stage progress from Maestro — persistent, unlike the
 * pending-task heuristic. `CaseStage` elements carry InProgress / Completed status
 * throughout, including while the case runs automated tasks between approvals.
 */
/** The Action Center task id, dug out of an element's deep link
 *  (…/actions_/tasks/101023920). The element knows which task it spawned; the
 *  task itself is titled after the APP that serves it, so it cannot be found by
 *  name — which is exactly why the title map below is only a fallback. */
function taskIdFromLink(link: string | undefined): number | null {
  const m = /\/tasks\/(\d+)/.exec(link ?? '');
  return m ? Number(m[1]) : null;
}

async function caseStages(instanceId: string): Promise<{ active: string | null; completed: string[]; tasks: StageTask[]; checks: ValidationResult[]; pending: { id: number; title: string } | null } | null> {
  try {
    const r = await pims<{ elementExecutions?: ElementExec[] }>(`/api/v1/element-executions/case-instances/${instanceId}`);
    const els = r.elementExecutions ?? [];
    const stages = els.filter((e) => e.elementType === 'CaseStage');
    // In case management a stage stays "InProgress" even after the next one starts, so a
    // stage is "reached" if it's InProgress OR Completed. The real active stage is the
    // FURTHEST reached along the main flow; everything before it counts as done.
    const reachedNames = new Set(stages.filter((e) => e.status !== 'NotStarted').map((e) => e.elementName));
    const reached = STAGES.filter((s) => reachedNames.has(s));
    const active = reached.length ? reached[reached.length - 1] : null;
    const idx = active ? STAGES.indexOf(active) : -1;
    const completed = idx > 0 ? STAGES.slice(0, idx) : [];
    // The steps inside the stage the case is in now, in the order it ran them —
    // the same detail the corporate pane shows, so the two read alike.
    const activeStageId = stages.find((e) => e.elementName === active)?.elementId;
    const tasks: StageTask[] = !activeStageId ? [] : els
      .filter((e) => e.caseStageElementId === activeStageId && STEP_TYPES.has(e.elementType))
      .sort(byProgress)
      .map((e) => ({
        name: e.elementName,
        kind: e.elementType === 'UserTask' ? 'human' as const : 'auto' as const,
        status: e.status,
      }));
    // Checks come from EVERY stage, not just the active one — Verification's
    // results still matter once the case has moved to Decision.
    const checks = checksFromSteps(
      els.filter((x) => STEP_TYPES.has(x.elementType)).map((x) => ({ name: x.elementName, status: x.status })),
    );
    // The human step the case is actually parked on, named as the CASE names it
    // rather than as Orchestrator titles it. Same mechanism corporate uses.
    const waiting = els.find(
      (e) => e.caseStageElementId === activeStageId && e.elementType === 'UserTask' && e.status === 'InProgress',
    );
    const waitingId = taskIdFromLink(waiting?.externalLink);
    return {
      active, completed, tasks, checks,
      pending: waiting && waitingId ? { id: waitingId, title: waiting.elementName } : null,
    };
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
  /** The uploaded account-opening form, as an Orchestrator attachment. Passed to
   *  the case as `aofDocument`, which is what the extraction step reads and what
   *  its entry condition tests — omit it and the case simply skips extraction. */
  document?: JobAttachmentRef;
}

/** Start a live OnboardingCase instance in Maestro. Returns its instance id. */
export async function startCase(input: CaseInput): Promise<string> {
  const { document, ...rest } = input;
  const r = await orch<{ value: { Key: string }[] }>('POST', '/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs', {
    startInfo: {
      ReleaseKey: RELEASE_KEY,
      Strategy: 'ModernJobsCount',
      JobsCount: 1,
      InputArguments: JSON.stringify({
        ...rest,
        channel: input.channel ?? 'self',
        approved: true,
        ...(document ? { aofDocument: document } : {}),
      }),
    },
  });
  const id = r.value?.[0]?.Key;
  if (!id) throw new Error('No instance returned from StartJobs');
  return id;
}

/** One step inside a stage, as the case is actually running it. `human` steps are
 *  the ones a person has to clear — the distinction the stage bar alone can't make. */
export interface StageTask {
  name: string;
  kind: 'human' | 'auto';
  status: string;                   // Completed | InProgress | NotStarted | Faulted
  /** Action Center deep link, for the human steps that have one. */
  link?: string;
}

/** Which verification a case step corresponds to. Order matters: the first match
 *  wins, so PEP is tested before the broader sanctions/AML pattern. Both the
 *  individual and corporate case plans are covered — "NIN validation" and
 *  "Director NIN validation (per director)" are the same check to a banker. */
const CHECK_MATCH: [ValidationKind, RegExp][] = [
  ['NIN', /\bNIN\b/i],
  ['BVN', /\bBVN\b/i],
  ['PEP', /\bPEP\b/i],
  ['AML', /sanction|\bAML\b/i],
  ['FRAUD', /fraud|duplicate|risk pre-screen/i],
  ['LIVENESS', /liveness|face match|selfie/i],
];

/**
 * The verification checks a LIVE case has actually run, derived from its steps.
 *
 * A linked record otherwise shows its own seeded validations — all "Pending" —
 * beside a case that finished Verification twenty minutes ago. Same rule as the
 * next best action: while Maestro is running the case, Maestro is the source of
 * truth. Kinds the case plan does not perform are simply absent rather than shown
 * as forever-pending.
 */
export function checksFromSteps(steps: { name: string; status: string }[]): ValidationResult[] {
  const now = new Date().toISOString();
  const out: ValidationResult[] = [];
  for (const [kind, re] of CHECK_MATCH) {
    const hits = steps.filter((s) => re.test(s.name));
    if (!hits.length) continue;
    // Worst status wins: one faulted director check means the check has failed,
    // however many others passed.
    const status: ValidationStatus =
      hits.some((h) => h.status === 'Faulted') ? 'failed'
      : hits.some((h) => h.status === 'InProgress') ? 'running'
      : hits.every((h) => h.status === 'Completed') ? 'passed'
      : 'pending';
    out.push({ kind, status, attempts: status === 'passed' || status === 'failed' ? 1 : 0, updatedAt: now });
  }
  return out;
}

export interface LiveState {
  jobState: string;                 // Running | Successful | Faulted | …
  done: boolean;
  activeStage: string | null;
  completedStages: string[];
  pendingTaskId: number | null;
  pendingTitle: string | null;
  /** The steps of the stage the case is in now, in the order it ran them. */
  stageTasks?: StageTask[];
  /** Verification checks as the live case has actually run them. */
  checks?: ValidationResult[];
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

/**
 * Resolve the REAL stage (and whether a person is holding it) for instances the
 * list poller could not name.
 *
 * Why this exists: `getStates` is deliberately two calls for the whole list, and
 * it can only learn a stage from an open Orchestrator task whose Title happens to
 * be a caseplan step name. Orchestrator titles app-backed tasks after the APP
 * (`onboardingapprovalappao`), and a case running automated steps has no open task
 * at all — so most live rows came back `stage: null, awaiting: false` and rendered
 * as a bare "Running" with an empty bar. Opening the case ran `getState`, which
 * reads the case's own element executions, and only THEN did the row show its
 * stage — because `getStates` falls back to `cached?.activeStage`. The stage was
 * therefore a reward for clicking rather than a property of the list.
 *
 * This asks the same authoritative source (`pims_` element executions) for the
 * rows the cheap path could not answer, one call each. Bounded by `limit` so a
 * long desk cannot turn one refresh into fifty requests, and it writes through to
 * `lastState` so the answer is reused rather than re-fetched.
 */
export async function backfillStages(
  instanceIds: string[],
  limit = 12,
): Promise<Record<string, { stage: string | null; awaiting: boolean }>> {
  const out: Record<string, { stage: string | null; awaiting: boolean }> = {};
  const ids = [...new Set(instanceIds)].slice(0, limit);
  if (!TOKEN || ids.length === 0) return out;
  await Promise.all(ids.map(async (id) => {
    const s = await caseStages(id);
    if (!s) return;
    out[id] = { stage: s.active, awaiting: Boolean(s.pending) };
    const prev = lastState.get(id);
    if (prev && !prev.done) {
      // Authoritative, so it CLEARS as well as sets: when the case's own elements
      // report no in-progress UserTask the approval is genuinely gone, and leaving
      // a stale id here would strand the row on "Awaiting approval" for ever.
      lastState.set(id, {
        ...prev,
        activeStage: s.active,
        completedStages: s.completed,
        pendingTaskId: s.pending?.id ?? null,
        pendingTitle: s.pending?.title ?? null,
      });
    }
  }));
  persistCache();
  return out;
}

export async function getState(instanceId: string): Promise<LiveState> {
  // Fire all three reads AT ONCE — first paint is gated by the slowest call, not the sum
  // of all three. (The two extra reads are wasted only for an already-completed case.)
  const [jr, stages, tr, caseDone] = await Promise.all([
    orch<{ value: { State: string }[] }>('GET', `/odata/Jobs?%24filter=Key%20eq%20${instanceId}&%24select=State`),
    caseStages(instanceId),
    // Filter by the job SERVER-side. This used to pull the 40 most recent open
    // tasks tenant-wide and match CreatorJobKey in the browser — so once 40 newer
    // tasks existed anywhere on the tenant, an older parked approval fell out of
    // the window and the desk simply stopped offering it. Nothing about the case
    // had changed; it just aged out of a page size.
    orch<{ value: { Id: number; Title: string; OrganizationUnitId: number; CreatorJobKey: string }[] }>(
      'GET',
      `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?%24filter=${
        encodeURIComponent(`CreatorJobKey eq ${instanceId} and Status ne 'Completed'`)}&%24top=20`,
    ),
    instanceDone(instanceId),
  ]);
  const jobState = jr.value?.[0]?.State ?? 'Unknown';
  // The case service is authoritative. The job state is only a fallback for when
  // that read fails — on its own it would never report a finished case, because a
  // Maestro case job sits at Running forever. See instanceDone().
  const done = caseDone ?? (jobState === 'Successful' || jobState === 'Completed');

  let result: LiveState;
  if (done) {
    result = { jobState, done: true, activeStage: null, completedStages: [...STAGES], pendingTaskId: null, pendingTitle: null, stageTasks: [], checks: stages?.checks ?? [] };
  } else {
    // Fallback only. Orchestrator titles an app task after the app that serves it
    // ("onboardingapprovalappao"), not after the caseplan step, so this map misses
    // on any case whose approval taskTitle is the app name — which left a parked
    // case reading "Nothing for you to do" while Maestro waited on a person. The
    // element executions above are authoritative; this stays for when they cannot
    // be read. Scoped to THIS instance — CreatorJobKey is the case job.
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
    result = {
      jobState, done: false, activeStage, completedStages,
      stageTasks: stages?.tasks ?? [], checks: stages?.checks ?? [],
      // When the elements could be read they are the authority — including when
      // they say nothing is parked. The task query is scoped to the job, not the
      // stage, so an approval still open in an EARLIER stage would otherwise be
      // offered under the CURRENT stage's name.
      pendingTaskId: stages ? stages.pending?.id ?? null : pending?.Id ?? null,
      pendingTitle: stages ? stages.pending?.title ?? null : pending?.Title ?? null,
    };
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
    const cached = getCachedState(id);
    const stage = awaitStage ?? cached?.activeStage ?? null;
    // The task query can only recognise an approval whose title is a caseplan step
    // name, and Orchestrator titles app tasks after the app — so on its own this
    // reports a case that is parked on a person as merely "running". getState
    // resolves the pending task from the case's own elements and writes it here,
    // so trust that too rather than under-reporting the row.
    out[id] = { jobState, done, awaiting: Boolean(awaitStage) || Boolean(!done && cached?.pendingTaskId), stage };
    // Seed the shared per-instance cache so opening this case paints instantly (with its
    // approve button, since we captured the task id). getState refines it on the detail poll.
    if (jobState !== 'Unknown') {
      const idx = stage ? STAGES.indexOf(stage as (typeof STAGES)[number]) : -1;
      // MERGE, don't replace. This used to write `pendingTaskId: task?.id ?? null`,
      // which nulled the pending approval every single tick — because the task query
      // only recognises a caseplan-named title and app-backed approvals are named
      // after the app. The next tick then computed `awaiting` from that null, so a
      // parked row flipped "Awaiting approval" → "Running" → "Awaiting approval" as
      // the richer read (detail pane, or the list backfill) and this one took turns
      // writing the same cache. Only a finished case, or the authoritative element
      // read in backfillStages(), may clear it.
      const prev = cached;
      lastState.set(id, {
        ...prev,
        jobState,
        done,
        activeStage: done ? null : stage,
        completedStages: done ? [...STAGES] : idx > 0 ? STAGES.slice(0, idx) : prev?.completedStages ?? [],
        pendingTaskId: done ? null : task?.id ?? prev?.pendingTaskId ?? null,
        pendingTitle: done ? null : task?.title ?? prev?.pendingTitle ?? null,
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

// ─────────────────────────────────────────────────────────────────────────────
// Extraction half — upload a filled account-opening form, let the case read it,
// review what came back.
//
// These mirror the corporate implementations in maestro-corporate.ts one for one.
// They are deliberately NOT shared yet: corporate is the working, demo-critical
// path and cannot be verified end to end from here, so it keeps its own copy for
// now. Once the individual flow has run against a real case, both should collapse
// onto a single folder-parameterised module — the `extraction: null` workaround in
// particular must not live in two places for long.
//
// Everything below reaches Orchestrator through this module's `orch`/`pims`, which
// pin the INDIVIDUAL folder. A corporate instance read through here 404s.
// ─────────────────────────────────────────────────────────────────────────────

export interface JobAttachmentRef {
  ID: string;
  FullName: string;
  MimeType: string;
  Metadata: Record<string, string>;
}

interface AttachmentCreated {
  Id: string;
  Name: string;
  BlobFileAccess: { Uri: string; Verb: string; RequiresAuth: boolean; Headers: { Keys: string[]; Values: string[] } };
}

/** Upload a document as an Orchestrator attachment. Two steps: create the record
 *  to get a pre-signed blob URI, then PUT the bytes straight to it. The blob PUT
 *  carries only the headers Orchestrator hands back — adding our bearer token to
 *  it makes the storage service reject the request. */
export async function uploadCaseAttachment(file: File): Promise<JobAttachmentRef> {
  const att = await orch<AttachmentCreated>('POST', '/odata/Attachments', { Name: file.name });
  const { Uri, Verb, Headers: h } = att.BlobFileAccess;
  const headers: Record<string, string> = {};
  h.Keys.forEach((k, i) => { headers[k] = h.Values[i]; });
  const put = await fetch(Uri, { method: Verb || 'PUT', headers, body: file });
  if (!put.ok) throw new Error(`attachment upload → ${put.status}`);
  return { ID: att.Id, FullName: att.Name, MimeType: file.type || 'application/octet-stream', Metadata: {} };
}

/** A fresh pre-signed READ url. Orchestrator mints a new SAS on every GET (~30 min,
 *  no auth required), so this can go straight into an iframe. Call it late rather
 *  than caching — a review resumed hours later still needs working pages. */
export async function attachmentReadUrl(attachmentId: string): Promise<string> {
  const att = await orch<AttachmentCreated>('GET', `/odata/Attachments(${attachmentId})`);
  return att?.BlobFileAccess?.Uri ?? '';
}

// ── Pending extraction ───────────────────────────────────────────────────────
// An upload starts the case before the application record exists, so there is
// nothing to hang the instance off yet. Park it here so "Finish later" resumes.
// Separate key from corporate's: one browser can have both mid-flight.

const PENDING_KEY = 'aof_indiv_pending_extraction';

export interface PendingExtraction {
  recordId: string;
  instanceId: string;
  attachmentId: string;
  documentName: string;
}

export function savePendingExtraction(p: PendingExtraction): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

/** The parked extraction, optionally scoped to one record. Without the record id
 *  a second application would pick up the first one's review. */
export function loadPendingExtraction(recordId?: string): PendingExtraction | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingExtraction;
    if (recordId && p.recordId !== recordId) return null;
    return p;
  } catch { return null; }
}

export function clearPendingExtraction(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

// ── The review gate ──────────────────────────────────────────────────────────

/** Titles the extraction-review task can carry. Orchestrator names an app task
 *  after the app that serves it, not after the caseplan step, so both spellings
 *  have to match. */
const REVIEW_TASK_TITLES = ['Confirm extracted details', 'individualextractionreviewao'];

export interface ExtractionTask {
  taskId: number;
  status: string;
  /** Raw IXP result as handed to the action app — frequently null; see fetchCaseExtraction. */
  extraction: unknown;
  documentUri: string;
  documentName: string;
  attachmentId: string;
  applicantName: string;
}

/** The pending extraction-review task for an instance, if the case has parked it.
 *  Null while extraction is still running — the caller polls. */
export async function findExtractionTask(instanceId: string): Promise<ExtractionTask | null> {
  const r = await orch<{ value: Array<Record<string, unknown>> }>(
    'GET',
    `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?$filter=${
      encodeURIComponent(`CreatorJobKey eq ${instanceId}`)}&$top=20`,
  );
  // A freshly created task is Unassigned, not Pending — filtering on Pending
  // server-side skips exactly the window we care about.
  const open = new Set(['Unassigned', 'Pending']);
  const hit = (r.value ?? []).find((t) =>
    open.has(String(t.Status ?? '')) &&
    REVIEW_TASK_TITLES.some((n) => String(t.Title ?? '').toLowerCase().includes(n.toLowerCase())));
  if (!hit) return null;

  const id = Number(hit.Id);
  const detail = await orch<{ data?: Record<string, unknown>; status?: string }>(
    'GET', `/tasks/GenericTasks/GetTaskDataById?taskId=${id}`);
  const d = detail?.data ?? {};
  return {
    taskId: id,
    status: String(detail?.status ?? hit.Status ?? ''),
    extraction: d.extraction,
    documentUri: String(d.documentUri ?? ''),
    documentName: String(d.documentName ?? ''),
    attachmentId: String(d.attachmentId ?? ''),
    applicantName: String(d.applicantName ?? ''),
  };
}

/** Complete the review from the desk. Mirrors what the Action Center app sends,
 *  so the case cannot tell which surface the reviewer used. */
export async function completeExtractionTask(
  taskId: number,
  outcome: 'Accept' | 'Reject',
  payload: { confirmed: unknown; corrections: unknown; notes?: string },
): Promise<void> {
  const userId = await currentUserId();
  await orch('POST', '/odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks', {
    taskAssignments: [{ TaskId: taskId, UserId: userId }],
  });
  await orch('POST', '/tasks/AppTasks/CompleteAppTask', {
    taskId,
    action: outcome,
    data: {
      confirmed: JSON.stringify(payload.confirmed),
      corrections: JSON.stringify(payload.corrections),
      notes: payload.notes ?? '',
    },
  });
}

interface CaseVarsBody { elements?: Array<{ outputs?: Record<string, unknown>; inputs?: Record<string, unknown> }> }

async function caseVariables(instanceId: string): Promise<CaseVarsBody | null> {
  try { return await pims<CaseVarsBody>(`/api/v1/instances/${instanceId}/variables`); }
  catch { return null; }
}

/**
 * The IXP result, read from the case rather than the task.
 *
 * The review task is handed `extraction: null` — the result never reaches the task
 * input — so a reviewer reading only the task sees nothing. The same result IS in
 * the case's own element outputs. Unresolved with the product team; this is the
 * workaround, and it is why the review screen is not simply task-driven.
 */
export async function fetchCaseExtraction(instanceId: string): Promise<unknown | null> {
  const body = await caseVariables(instanceId);
  // Scan for ANY output carrying an ExtractionResult rather than naming the
  // variable. The key is whatever the caseplan's IXP node happened to call its
  // output — `output2` in the corporate plan, `output` in the individual one —
  // and hardcoding one of them is why an individual read came back empty and the
  // screen fell through to the illustrative sample. The task's own `extraction`
  // input is null in both plans, and the plan's declared `extractionResult`
  // variable is never populated either; the element output is the only real copy.
  let found: unknown = null;
  for (const el of body?.elements ?? []) {
    for (const v of Object.values(el.outputs ?? {})) {
      const r = (v as { ExtractionResult?: unknown } | null)?.ExtractionResult;
      if (r) found = r;                       // newest wins: a re-run leaves several
    }
  }
  return found;
}


/** Which document this case read. Asked of the case, not the task: once the review
 *  is completed GetTaskDataById returns only outputs, and the inputs that named the
 *  document are gone — but the case keeps it in `aofDocument`. */
export async function findCaseDocument(instanceId: string): Promise<{ attachmentId: string; documentName: string } | null> {
  const body = await caseVariables(instanceId);
  for (const el of body?.elements ?? []) {
    const d = (el.outputs?.aofDocument ?? el.inputs?.aofDocument) as { ID?: string; FullName?: string } | undefined;
    if (d?.ID) return { attachmentId: d.ID, documentName: d.FullName ?? '' };
  }
  return null;
}

/** Whether the review task is still open, already done, or unknown. Needed because
 *  IXP completes ~30s before the task appears: without this the screen decides
 *  "nothing to confirm" during the gap and settles on the wrong answer. */
export async function reviewTaskState(instanceId: string): Promise<'open' | 'done' | null> {
  try {
    const r = await pims<{ elementExecutions?: ElementExec[] }>(
      `/api/v1/element-executions/case-instances/${instanceId}`);
    const el = (r.elementExecutions ?? []).find(
      (e) => e.elementType === 'UserTask'
        && REVIEW_TASK_TITLES.some((n) => e.elementName.toLowerCase().includes(n.toLowerCase())),
    );
    if (!el) return null;
    return el.status === 'Completed' ? 'done' : 'open';
  } catch { return null; }
}
