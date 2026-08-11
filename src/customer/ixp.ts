// ─────────────────────────────────────────────────────────────────────────────
// Real corporate-AOF extraction via UiPath IXP (Document Understanding).
//
// Flow: upload the scanned AOF → poll until the model has predictions for it →
// map IXP's field names onto the corporate wizard's shape. The taxonomy lives in
// the IXP project `corporateaof-ad0e6921-ixp` (12 company fields + a repeating
// "Directors/Signatories" group, one occurrence per director).
//
// AUTH NOTE — the one thing that gates this in production:
// `du_` requires a JWT carrying `Du.*` scopes (Du.Digitization.Api /
// Du.Extraction.Api). The app's bundled demo token is an opaque `rt_` PAT scoped
// to OR.* + DataFabric.* only, and du_ answers it with 401 "JWT Token is invalid".
// In dev the Vite proxy swaps in VITE_UIPATH_DU_TOKEN so this is genuinely live;
// in production the app's token must be reissued with the Du.* scopes added to
// the external app. Until then `extractAof()` throws and the caller falls back to
// the sample values, so the wizard keeps working either way.
// ─────────────────────────────────────────────────────────────────────────────
const ORG = (import.meta.env.VITE_UIPATH_ORG_NAME as string) || 'mea';
const TENANT = (import.meta.env.VITE_UIPATH_TENANT_NAME as string) || 'DefaultTenant';
const TOKEN = import.meta.env.VITE_UIPATH_DEMO_TOKEN as string | undefined;

/** IXP training project holding the corporate-AOF taxonomy. */
export const IXP_PROJECT = 'corporateaof-ad0e6921-ixp';

// Dev goes through the Vite proxy (which injects the Du-scoped token); production
// talks to the platform directly with whatever token the app already holds.
const DU_BASE = import.meta.env.DEV
  ? `/${ORG}/${TENANT}/du_/api/designtimeapi`
  : `https://staging.uipath.com/${ORG}/${TENANT}/du_/api/designtimeapi`;

const API_VERSION = '1.0';

function duUrl(path: string): string {
  return `${DU_BASE}${path}${path.includes('?') ? '&' : '?'}api-version=${API_VERSION}`;
}

/** The proxy overrides Authorization in dev; in prod we send the app's token. */
function duHeaders(): Record<string, string> {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

export interface AofDirector {
  fullName: string;
  bvn: string;
  nationality: string;
  dob: string;
  idNumber: string;
  phone: string;
  email: string;
  role: string;
}

export interface AofCompany {
  companyName: string;
  rcNumber: string;
  tin: string;
  businessType: string;
  incorporated: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  industry: string;
  turnover: string;
}

export interface AofExtract {
  company: AofCompany;
  directors: AofDirector[];
}

interface PredField { FieldName: string; FormattedValue?: string | null }
interface PredLabel { Name: string; Occurrence: number; Fields: PredField[] }
interface PredResponse { DocumentId?: string; Labels?: PredLabel[] }

/** IXP returns dates as ISO instants; the wizard wants plain YYYY-MM-DD. */
function asDate(v: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(v);
  return m ? m[1] : v;
}

function fieldMap(fields: PredField[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const f of fields) {
    const v = (f.FormattedValue ?? '').trim();
    if (v) m[f.FieldName] = /^\d{4}-\d{2}-\d{2}T/.test(v) ? asDate(v) : v;
  }
  return m;
}

function toExtract(labels: PredLabel[]): AofExtract {
  const company = labels.find((l) => l.Name === 'Company Details');
  const c = fieldMap(company?.Fields ?? []);
  const dirLabels = labels
    .filter((l) => l.Name.endsWith('Directors/Signatories'))
    .sort((a, b) => a.Occurrence - b.Occurrence);

  return {
    company: {
      companyName: c['Registered Company Name'] ?? '',
      rcNumber: c['RC/Registration Number'] ?? '',
      tin: c['TIN'] ?? '',
      businessType: c['Business Type'] ?? '',
      incorporated: c['Date of Incorporation'] ?? '',
      address: c['Registered Address'] ?? '',
      city: c['City'] ?? '',
      state: c['State'] ?? '',
      phone: c['Phone'] ?? '',
      email: c['Email'] ?? '',
      industry: c['Industry/Nature of Business'] ?? '',
      turnover: c['Expected Turnover'] ?? '',
    },
    directors: dirLabels.map((l) => {
      const d = fieldMap(l.Fields);
      return {
        fullName: d['Full Name'] ?? '',
        bvn: d['BVN'] ?? '',
        nationality: d['Nationality'] ?? '',
        dob: d['Date of Birth'] ?? '',
        idNumber: d['ID/Means-of-Identification Number'] ?? '',
        phone: d['Phone'] ?? '',
        email: d['Email'] ?? '',
        role: d['Designation/Role'] ?? '',
      };
    }),
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** True when at least one company field came back — i.e. the model has read the page. */
function hasContent(labels: PredLabel[]): boolean {
  return labels.some((l) => l.Fields.some((f) => (f.FormattedValue ?? '').trim() !== ''));
}

/**
 * Upload a scanned AOF and return the extracted company + directors.
 * Throws if IXP is unreachable/unauthorised so the caller can fall back.
 */
export async function extractAof(file: File, onProgress?: (s: string) => void): Promise<AofExtract> {
  onProgress?.('Uploading the form…');
  const form = new FormData();
  form.append('file', file, file.name);

  const up = await fetch(duUrl(`/api/projects/${encodeURIComponent(IXP_PROJECT)}/documents`), {
    method: 'POST',
    headers: duHeaders(),          // NB: no Content-Type — the browser sets the multipart boundary
    body: form,
  });
  if (!up.ok) throw new Error(`IXP upload failed (${up.status})`);
  const uploaded = (await up.json()) as { DocumentId?: string; documentId?: string };
  const docId = uploaded.DocumentId ?? uploaded.documentId;
  if (!docId) throw new Error('IXP upload returned no document id');

  // OCR + extraction on a 15-page scan takes a while; poll until fields appear.
  onProgress?.('Reading the document…');
  const predPath = `/api/projects/${encodeURIComponent(IXP_PROJECT)}/documents/${encodeURIComponent(docId)}/predictions`;
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(3000);
    const r = await fetch(duUrl(predPath), { headers: duHeaders() });
    if (!r.ok) continue;                       // still processing / transient
    const p = (await r.json()) as PredResponse;
    const labels = p.Labels ?? [];
    if (labels.length && hasContent(labels)) {
      onProgress?.('Extracting fields…');
      return toExtract(labels);
    }
  }
  throw new Error('IXP extraction timed out');
}
