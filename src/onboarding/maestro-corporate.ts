// ─────────────────────────────────────────────────────────────────────────────
// Bridge to the REAL corporate Maestro case — the entity/business counterpart of
// `maestro.ts`.
//
// This is a DELIBERATE parallel module, not a refactor of maestro.ts. The
// individual flow is live and must not change, so corporate gets its own file,
// its own solution (CorporateOnboardingCaseSolution), its own Orchestrator
// folder and its own approval app. Nothing here can affect the individual case.
//
// Deployed: solution CorporateOnboardingCaseSolution v1.0.0, folder
// Banking/Account Opening/CorporateOnboardingCase, approval app
// corporateapprovalappao co-located in that folder.
// ─────────────────────────────────────────────────────────────────────────────
import type { StageTask } from './maestro';
import { checksFromSteps } from './maestro';
import type { ValidationResult } from './types';

const ORG = (import.meta.env.VITE_UIPATH_ORG_NAME as string) || 'mea';
const TENANT = (import.meta.env.VITE_UIPATH_TENANT_NAME as string) || 'DefaultTenant';
const TOKEN = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;

const BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/orchestrator_`
  : `https://staging.api.uipath.com/${ORG}/${TENANT}/orchestrator_`;

// Case-instance internals (element outputs, where the IXP result actually lands)
// are on pims_, which wants the folder KEY as a header, not the numeric unit id.
const PIMS_BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/pims_`
  : `https://staging.uipath.com/${ORG}/${TENANT}/pims_`;

export const CORP_FOLDER_KEY = '8c65336d-24e4-4032-9137-39467c1aefce';
export const CORP_FOLDER_ID = 3353156;
export const CORP_RELEASE_KEY = '441e0bda-1ea1-4b7e-8021-19bb048f55b6';

/** Corporate stages mirror the individual ones; only the gating tasks differ. */
export const CORP_STAGES = ['Intake', 'Verification', 'Decision', 'Activation', 'Closure'] as const;

/** Corporate approval titles → stage. These are the `taskTitle` values baked into
 *  the corporate caseplan.json.bpmn; if you rename a task there, rename it here. */
const CORP_STAGE_BY_TASK: Record<string, string> = {
  'Entity duplicate & risk pre-screen': 'Intake',
  'Directors & UBO verification': 'Verification',
  'Corporate mandate decision': 'Decision',
  'Mandate and signatory activation': 'Activation',
  'Corporate audit report': 'Closure',
};

export const corporateMaestroReady = (): boolean => Boolean(TOKEN);

async function orch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-UIPATH-OrganizationUnitId': String(CORP_FOLDER_ID),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  // AssignTasks and CompleteAppTask answer 204 with no body. Parsing that as JSON
  // throws, which aborted the assign-then-complete pair before it ever completed
  // the task — the review looked accepted while the case sat on the gate.
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** A Maestro `file` variable holds a JobAttachment record — not a path, not bytes.
 *  Shape and the `ID`-is-required rule come from the case schema's FILE_TYPE_JSON_SCHEMA
 *  (`x-uipath-resource-kind: "JobAttachment"`). The caseplan's IXP task reads its
 *  `fileRef` input from a case argument of exactly this shape. */
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

/** Upload a document as an Orchestrator attachment and return the record the case
 *  needs. Two steps: create the attachment to get a pre-signed blob URI, then PUT
 *  the bytes straight to it. The blob PUT is deliberately unauthenticated —
 *  Orchestrator returns `RequiresAuth: false` and the SAS token in the URI is the
 *  credential, so the bearer token must NOT be sent there. */
export async function uploadCaseAttachment(file: File): Promise<JobAttachmentRef> {
  const att = await orch<AttachmentCreated>('POST', '/odata/Attachments', { Name: file.name });

  const { Uri, Verb, Headers: h } = att.BlobFileAccess;
  const headers: Record<string, string> = {};
  h.Keys.forEach((k, i) => { headers[k] = h.Values[i]; });

  const put = await fetch(Uri, { method: Verb || 'PUT', headers, body: file });
  if (!put.ok) throw new Error(`attachment upload → ${put.status}`);

  return {
    ID: att.Id,
    FullName: att.Name,
    MimeType: file.type || 'application/octet-stream',
    Metadata: {},
  };
}

/** Mint a fresh pre-signed READ url for an attachment. Orchestrator returns a new
 *  SAS on every GET, valid ~30 minutes, `RequiresAuth: false` — so it can be dropped
 *  straight into an <iframe> or <embed>. Call it late rather than caching: the desk
 *  re-mints on open so a review resumed hours later still shows the pages. */
export async function attachmentReadUrl(attachmentId: string): Promise<string> {
  const att = await orch<AttachmentCreated>('GET', `/odata/Attachments(${attachmentId})`);
  return att?.BlobFileAccess?.Uri ?? '';
}

// ── Pending extraction ───────────────────────────────────────────────────────
// An upload starts the case before the application record exists, so there is
// nothing to hang the instance off yet — `linkInstance` is keyed by record id.
// Park it here instead so "Finish later" is genuinely resumable: close the
// wizard, come back, and the review is still reachable.

const PENDING_KEY = 'aof_corp_pending_extraction';

export interface PendingExtraction {
  /** The record this extraction belongs to. Without it the slot is anonymous, and
   *  a parked review outlives its record — every later application then offers to
   *  resume someone else's document. */
  recordId: string;
  instanceId: string;
  attachmentId: string;
  documentName: string;
  startedAt: string;
}

export function savePendingExtraction(p: Omit<PendingExtraction, 'startedAt'>): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, startedAt: new Date().toISOString() }));
  } catch { /* quota/disabled — resume just won't survive a reload */ }
}

/** The parked extraction, if one is still worth resuming. Anything older than a
 *  day is stale: the document's read link is long gone and the case has moved on.
 *
 *  Pass `forRecord` to get it only when it belongs to that record. Callers that
 *  omit it still get the raw slot, but should check `recordId` before offering a
 *  resume — an entry whose record is gone is an orphan, not a pending review. */
export function loadPendingExtraction(forRecord?: string): PendingExtraction | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingExtraction;
    if (!p?.instanceId) return null;
    // Written before the slot carried a record id — unattributable, so not offerable.
    if (!p.recordId) { clearPendingExtraction(); return null; }
    if (Date.now() - new Date(p.startedAt).getTime() > 24 * 60 * 60 * 1000) {
      clearPendingExtraction();
      return null;
    }
    if (forRecord && p.recordId !== forRecord) return null;
    return p;
  } catch { return null; }
}

export function clearPendingExtraction(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

/** The extraction review task the case parks after IXP finishes. */
export interface ExtractionTask {
  taskId: number;
  status: string;
  /** Raw IXP result, as handed to the action app. */
  extraction: unknown;
  documentUri: string;
  documentName: string;
  attachmentId: string;
  companyName: string;
}

const REVIEW_TASK_TITLES = ['Confirm extracted details', 'corporateextractionreviewao'];

/** Find the pending extraction-review task for an instance, if the case has
 *  reached it. Returns null while IXP is still running — the caller polls. */
export async function findExtractionTask(instanceId: string): Promise<ExtractionTask | null> {
  // Filter on the job only. A freshly created task is `Unassigned`, not `Pending` —
  // filtering on Pending server-side silently skips the window we care about.
  const r = await orch<{ value: Array<Record<string, unknown>> }>(
    'GET',
    `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?$filter=${
      encodeURIComponent(`CreatorJobKey eq ${instanceId}`)}&$top=20`,
  );
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
    companyName: String(d.companyName ?? ''),
  };
}

/** Complete the review task from the desk. Mirrors what the Action Center app
 *  sends, so the case cannot tell which surface the reviewer used.
 *
 *  A task arrives `Unassigned` and cannot be completed in that state, so claim it
 *  first — the same two-step the individual flow's approve() uses. */
export async function completeExtractionTask(
  taskId: number,
  outcome: 'Accept' | 'Reject',
  payload: { confirmed: unknown; corrections: unknown; notes?: string },
): Promise<void> {
  const me = await orch<{ Id: number }>(
    'GET', '/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUserExtended()');
  await orch('POST', '/odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks', {
    taskAssignments: [{ TaskId: taskId, UserId: me.Id }],
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

export interface CorporateCaseInput {
  applicantId: string;
  companyName: string;
  rcNumber?: string;
  tin?: string;
  directors?: number;
  channel?: string;
  /** The uploaded AOF, as an attachment record. Feeds the caseplan's `aofDocument`
   *  argument, which the Intake stage's IXP extraction task reads as its File input. */
  document?: JobAttachmentRef;
  /** Pre-signed read url for the same document, passed straight through to the
   *  extraction-review task. Action Center apps get no HTTP client, so this is the
   *  only way the reviewer sees the pages there. ~30 minute life; the desk re-mints
   *  its own on open, so a stale one only affects the Action Center surface. */
  documentUri?: string;
}

/** Start a live CorporateOnboardingCase instance. Returns its instance id. */
export async function startCorporateCase(input: CorporateCaseInput): Promise<string> {
  const r = await orch<{ value: { Key: string }[] }>('POST', '/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs', {
    startInfo: {
      ReleaseKey: CORP_RELEASE_KEY,
      Strategy: 'ModernJobsCount',
      JobsCount: 1,
      InputArguments: JSON.stringify({
        applicantId: input.applicantId,
        // The case's arguments are shared with the individual flow's shape, so the
        // company rides in as the "name" the downstream steps display.
        firstName: input.companyName,
        lastName: '',
        rc: input.rcNumber ?? '',
        tin: input.tin ?? '',
        directors: input.directors ?? 0,
        channel: input.channel ?? 'corporate',
        approved: true,
        // The scanned form. Only sent when an upload actually happened — the case
        // argument is optional, and a null would fail the IXP task's required File.
        ...(input.document ? { aofDocument: input.document } : {}),
        ...(input.documentUri ? { aofDocumentUri: input.documentUri } : {}),
      }),
    },
  });
  const id = r.value?.[0]?.Key;
  if (!id) throw new Error('No corporate instance returned from StartJobs');
  return id;
}

export interface CorporateLiveState {
  jobState: string;
  done: boolean;
  activeStage: string | null;
  completedStages: string[];
  pendingTaskId: number | null;
  pendingTitle: string | null;
  stageTasks?: StageTask[];
  checks?: ValidationResult[];
}

interface ElementExec {
  elementType: string;
  elementName: string;
  status: string;
  elementId?: string;
  /** Which stage this step belongs to — how the flat element list regains its shape. */
  caseStageElementId?: string;
  startedTimeUtc?: string;
  externalLink?: string;
}

/** Steps worth showing. The rest of the element list is plumbing — subprocesses,
 *  catch events, the guardrail agent — which a banker has no use for. */
const STEP_TYPES = new Set(['UserTask', 'ServiceTask', 'Task', 'Agent']);

/** Finished work above, the live step, then what has not started. Strict start-time
 *  order puts a long-running approval above checks that finished after it began,
 *  which reads as though the case went backwards. This is a status list, not an
 *  audit log — the live line should be the "you are here". */
const STEP_RANK: Record<string, number> = { Completed: 0, Faulted: 0, InProgress: 1 };
const byProgress = (a: { status: string; startedTimeUtc?: string }, b: { status: string; startedTimeUtc?: string }) =>
  (STEP_RANK[a.status] ?? 2) - (STEP_RANK[b.status] ?? 2)
  || String(a.startedTimeUtc ?? '').localeCompare(String(b.startedTimeUtc ?? ''));


function stepsOfStage(els: ElementExec[], stageElementId: string | undefined): StageTask[] {
  if (!stageElementId) return [];
  return els
    .filter((e) => e.caseStageElementId === stageElementId && STEP_TYPES.has(e.elementType))
    .sort(byProgress)
    .map((e) => ({
      name: e.elementName,
      kind: e.elementType === 'UserTask' ? 'human' : 'auto',
      status: e.status,
      link: e.externalLink || undefined,
    }));
}

/**
 * Real stage progress, from the case instance's own elements.
 *
 * Deriving the stage from "which human task is open" only works while one is —
 * between an approval being completed and the next appearing, the case looks
 * like it has not started. CaseStage elements carry InProgress/Completed the
 * whole way through, so they describe where the case actually is.
 */
/** The Action Center task id, dug out of an element's deep link
 *  (…/actions_/tasks/101023920). The element knows which task it spawned; the
 *  task itself is titled after the app, so it cannot be found by name. */
function taskIdFromLink(link: string | undefined): number | null {
  const m = /\/tasks\/(\d+)/.exec(link ?? '');
  return m ? Number(m[1]) : null;
}

async function corporateCaseStages(
  instanceId: string,
): Promise<{
  active: string | null;
  completed: string[];
  tasks: StageTask[];
  checks: ValidationResult[];
  pending: { id: number; title: string } | null;
} | null> {
  try {
    const res = await fetch(`${PIMS_BASE}/api/v1/element-executions/case-instances/${instanceId}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'x-uipath-folderkey': CORP_FOLDER_KEY },
    });
    if (!res.ok) return null;
    const r = (await res.json()) as { elementExecutions?: ElementExec[] };
    const els = r.elementExecutions ?? [];
    const stageEls = els.filter((e) => e.elementType === 'CaseStage' && e.status !== 'NotStarted');
    const reached = new Set(stageEls.map((e) => e.elementName));
    // A stage stays InProgress after the next one opens, so "where we are" is the
    // furthest stage reached along the spine, not the first one still open.
    const ordered = (CORP_STAGES as readonly string[]).filter((s) => reached.has(s));
    const active = ordered.length ? ordered[ordered.length - 1] : null;
    const idx = active ? (CORP_STAGES as readonly string[]).indexOf(active) : -1;
    const activeStageId = stageEls.find((e) => e.elementName === active)?.elementId;
    // The human step the case is actually sitting on, named as the caseplan names
    // it rather than as Orchestrator titles it.
    const waiting = els.find(
      (e) => e.caseStageElementId === activeStageId && e.elementType === 'UserTask' && e.status === 'InProgress',
    );
    const waitingId = taskIdFromLink(waiting?.externalLink);
    return {
      active,
      completed: idx > 0 ? (CORP_STAGES as readonly string[]).slice(0, idx) : [],
      tasks: stepsOfStage(els, activeStageId),
      // From every stage, not just the active one.
      checks: checksFromSteps(
        els.filter((x) => STEP_TYPES.has(x.elementType)).map((x) => ({ name: x.elementName, status: x.status })),
      ),
      pending: waiting && waitingId ? { id: waitingId, title: waiting.elementName } : null,
    };
  } catch { return null; }
}

const CORP_CACHE_KEY = 'aof_corp_state';
const lastCorpState = new Map<string, CorporateLiveState>();
try {
  const raw = sessionStorage.getItem(CORP_CACHE_KEY);
  if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, CorporateLiveState>)) lastCorpState.set(k, v);
} catch { /* ignore */ }

/** Last known state for an instance, for instant first paint on reopen. The desk
 *  otherwise renders a state-based conclusion ("nothing to do") a beat before the
 *  live answer arrives, and the card visibly changes its mind. */
export function getCachedCorporateState(instanceId: string): CorporateLiveState | null {
  return lastCorpState.get(instanceId) ?? null;
}

/**
 * Whether the corporate CASE finished, from the case service rather than the
 * Orchestrator job — the job for a Maestro case never leaves `Running`, so it
 * can never report completion. Mirrors instanceDone() in maestro.ts, but pinned
 * to the corporate folder. Null when the read fails, so callers can fall back.
 */
async function corporateInstanceDone(instanceId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${PIMS_BASE}/api/v1/instances/${instanceId}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'x-uipath-folderkey': CORP_FOLDER_KEY },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const s = (text ? JSON.parse(text) : {})?.latestRunStatus as string | undefined;
    return s ? s === 'Completed' || s === 'Successful' : null;
  } catch { return null; }
}

/** Current state of a corporate case: job status + which stage awaits approval. */
export async function getCorporateState(instanceId: string): Promise<CorporateLiveState> {
  const [jr, tr, stages, caseDone] = await Promise.all([
    orch<{ value: { State: string }[] }>('GET', `/odata/Jobs?%24filter=Key%20eq%20${instanceId}&%24select=State`),
    // Scoped to the job server-side — see the note in maestro.ts getState: a
    // tenant-wide top-40 silently loses older parked tasks.
    orch<{ value: { Id: number; Title: string; OrganizationUnitId: number; CreatorJobKey: string }[] }>(
      'GET',
      `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?%24filter=${
        encodeURIComponent(`CreatorJobKey eq ${instanceId} and Status ne 'Completed'`)}&%24top=20`,
    ),
    corporateCaseStages(instanceId),
    corporateInstanceDone(instanceId),
  ]);
  const jobState = jr.value?.[0]?.State ?? 'Unknown';
  // Case service first; job state only as a fallback. See corporateInstanceDone().
  const done = caseDone ?? (jobState === 'Successful' || jobState === 'Completed');
  if (done) {
    // `stages` is already in hand from the batch above — the old code re-fetched it
    // here, paying a second round trip on every poll of a finished case.
    const finished: CorporateLiveState = { jobState, done: true, activeStage: null, completedStages: [...CORP_STAGES], pendingTaskId: null, pendingTitle: null, stageTasks: [], checks: stages?.checks ?? [] };
    lastCorpState.set(instanceId, finished);
    return finished;
  }

  // Fallback only. Orchestrator titles an app task after the app that serves it
  // ("corporateapprovalappao"), not after the caseplan step, so this map never
  // matched and corporate cases were left with no approve action at all. The
  // element executions above are authoritative; this stays for the case where
  // they could not be read.
  const pending = (tr.value ?? []).find(
    (t) => t.OrganizationUnitId === CORP_FOLDER_ID && t.CreatorJobKey === instanceId && CORP_STAGE_BY_TASK[t.Title],
  );
  const out: CorporateLiveState = {
    jobState,
    done: false,
    // Stage progress leads; the open task only names the stage when the elements
    // could not be read at all.
    activeStage: stages?.active ?? (pending ? CORP_STAGE_BY_TASK[pending.Title] : null),
    completedStages: stages?.completed ?? [],
    stageTasks: stages?.tasks ?? [],
    checks: stages?.checks ?? [],
    // When the elements could be read they are the authority — including when
    // they say nothing is parked. The task query is scoped to the job, not the
    // stage, so an approval still open in an EARLIER stage would otherwise be
    // offered under the CURRENT stage's name ("Approve Activation" for a
    // Verification task).
    pendingTaskId: stages ? stages.pending?.id ?? null : pending?.Id ?? null,
    pendingTitle: stages ? stages.pending?.title ?? null : pending?.Title ?? null,
  };
  lastCorpState.set(instanceId, out);
  try { sessionStorage.setItem(CORP_CACHE_KEY, JSON.stringify(Object.fromEntries(lastCorpState))); } catch { /* ignore */ }
  return out;
}

interface CaseVarsBody {
  elements?: Array<{ inputs?: Record<string, unknown>; outputs?: Record<string, unknown> }>;
}

/** The case instance's element inputs/outputs — where the running case keeps both
 *  the document it was given and the result IXP produced. */
async function caseVariables(instanceId: string): Promise<CaseVarsBody | null> {
  try {
    const res = await fetch(`${PIMS_BASE}/api/v1/instances/${instanceId}/variables`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
        'x-uipath-folderkey': CORP_FOLDER_KEY,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as CaseVarsBody;
  } catch { return null; }
}

/**
 * Whether the extraction review has been done, asked of the case rather than
 * inferred.
 *
 * "No open task" is NOT the same as "confirmed": IXP finishes writing its result
 * ~30s before the review task is created, and in that window a brand-new case has
 * an extraction and no gate — which reads as already-reviewed when it is the
 * opposite. The UserTask element carries the truth throughout.
 *
 *   'open'  — the review is waiting for someone
 *   'done'  — it was completed (here, in Action Center, or another tab)
 *   null    — the case has not reached the review yet
 */
export async function reviewTaskState(instanceId: string): Promise<'open' | 'done' | null> {
  try {
    const res = await fetch(`${PIMS_BASE}/api/v1/element-executions/case-instances/${instanceId}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json', 'x-uipath-folderkey': CORP_FOLDER_KEY },
    });
    if (!res.ok) return null;
    const r = (await res.json()) as { elementExecutions?: ElementExec[] };
    const el = (r.elementExecutions ?? []).find(
      (e) => e.elementType === 'UserTask'
        && REVIEW_TASK_TITLES.some((n) => e.elementName.toLowerCase().includes(n.toLowerCase())),
    );
    if (!el) return null;
    return el.status === 'Completed' ? 'done' : 'open';
  } catch { return null; }
}

/**
 * The document a case was opened from, read back from the case itself.
 *
 * `findExtractionTask` deliberately only returns an OPEN task — it answers "is
 * there something to complete". Once confirmed, the pages are still worth showing,
 * so this asks the weaker question: which document did this case read?
 */
export async function findCaseDocument(instanceId: string): Promise<{ attachmentId: string; documentName: string } | null> {
  // Not from the task: once completed, GetTaskDataById returns only its outputs
  // (confirmed/corrections/notes) — the inputs that named the document are gone.
  // The case keeps the attachment in its own `aofDocument` argument.
  const body = await caseVariables(instanceId);
  for (const el of body?.elements ?? []) {
    const d = (el.outputs?.aofDocument ?? el.inputs?.aofDocument) as { ID?: string; FullName?: string } | undefined;
    if (d?.ID) return { attachmentId: d.ID, documentName: d.FullName ?? '' };
  }
  return null;
}

/**
 * The IXP result, read from the case instance itself.
 *
 * The extraction task completes and its result is held in the case — but the
 * "Confirm extracted details" task is handed `extraction: null`, so a reviewer
 * reading only the task input sees nothing. The result is in the element outputs
 * under `output2.ExtractionResult`, which this digs out. Independent of whatever
 * fixes the task-input binding: once that lands, the task input wins and this is
 * simply never reached.
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


/** Approve a corporate stage task: assign, then complete.
 *
 *  Mirrors the individual `approve`, but every call in this module carries the
 *  corporate folder header — a task in this case cannot be assigned or completed
 *  through the individual folder, so the two are not interchangeable. */
export async function approveCorporate(taskId: number): Promise<void> {
  const me = await orch<{ Id: number }>(
    'GET', '/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUserExtended()');
  await orch('POST', '/odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks', {
    taskAssignments: [{ TaskId: taskId, UserId: me.Id }],
  });
  await orch('POST', '/tasks/AppTasks/CompleteAppTask', {
    taskId, action: 'Approve', data: { decision: 'Approve' },
  });
}

/** Deep link to the corporate case instance in Maestro. */
export function corporateMaestroUrl(instanceId: string): string {
  return `https://staging.uipath.com/${ORG}/${TENANT}/maestro_/cases/${CORP_RELEASE_KEY}/instances/${instanceId}?folderKey=${CORP_FOLDER_KEY}`;
}
