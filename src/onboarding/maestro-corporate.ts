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
const ORG = (import.meta.env.VITE_UIPATH_ORG_NAME as string) || 'mea';
const TENANT = (import.meta.env.VITE_UIPATH_TENANT_NAME as string) || 'DefaultTenant';
const TOKEN = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;

const BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/orchestrator_`
  : `https://staging.api.uipath.com/${ORG}/${TENANT}/orchestrator_`;

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
  return (await res.json()) as T;
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
 *  sends, so the case cannot tell which surface the reviewer used. */
export async function completeExtractionTask(
  taskId: number,
  outcome: 'Accept' | 'Reject',
  payload: { confirmed: unknown; corrections: unknown; notes?: string },
): Promise<void> {
  await orch('POST', '/tasks/GenericTasks/CompleteTask', {
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
  pendingTaskId: number | null;
  pendingTitle: string | null;
}

/** Current state of a corporate case: job status + which stage awaits approval. */
export async function getCorporateState(instanceId: string): Promise<CorporateLiveState> {
  const [jr, tr] = await Promise.all([
    orch<{ value: { State: string }[] }>('GET', `/odata/Jobs?%24filter=Key%20eq%20${instanceId}&%24select=State`),
    orch<{ value: { Id: number; Title: string; OrganizationUnitId: number; CreatorJobKey: string }[] }>(
      'GET',
      `/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?%24filter=Status%20ne%20'Completed'&%24orderby=CreationTime%20desc&%24top=40`,
    ),
  ]);
  const jobState = jr.value?.[0]?.State ?? 'Unknown';
  const done = jobState === 'Successful' || jobState === 'Completed';
  if (done) return { jobState, done: true, activeStage: null, pendingTaskId: null, pendingTitle: null };

  const pending = (tr.value ?? []).find(
    (t) => t.OrganizationUnitId === CORP_FOLDER_ID && t.CreatorJobKey === instanceId && CORP_STAGE_BY_TASK[t.Title],
  );
  return {
    jobState,
    done: false,
    activeStage: pending ? CORP_STAGE_BY_TASK[pending.Title] : null,
    pendingTaskId: pending?.Id ?? null,
    pendingTitle: pending?.Title ?? null,
  };
}

/** Deep link to the corporate case instance in Maestro. */
export function corporateMaestroUrl(instanceId: string): string {
  return `https://staging.uipath.com/${ORG}/${TENANT}/maestro_/cases/${CORP_RELEASE_KEY}/instances/${instanceId}?folderKey=${CORP_FOLDER_KEY}`;
}
