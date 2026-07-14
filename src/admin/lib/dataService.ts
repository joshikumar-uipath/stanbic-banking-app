// UiPath Data Service client for the AuraConfig entity.
//
// Verified against staging.uipath.com (Apr 2026). The Data Service v8
// REST surface for entity CRUD lives under:
//
//   GET  /dataservice_/api/Entity                              — list/inspect entity definitions
//   POST /dataservice_/api/Entity                              — create entity (requires DataService.Schema scope)
//   POST /dataservice_/api/Entity/import                       — upload an exported entity JSON (also schema-scoped)
//   GET  /dataservice_/api/EntityService/{Name}/read           — list records  → {totalRecordCount, value[]}
//   POST /dataservice_/api/EntityService/{Name}/insert         — create one record (single object body)
//   POST /dataservice_/api/EntityService/{Name}/delete         — delete records (body: array of GUIDs)
//
// Data Service caps NVARCHAR fields at 4000 chars per the API validation
// ("ConfigJson length limit 1000000 outside of range [1, 4000]"). Our config
// is ~20KB serialized, so we chunk: each save splits the JSON across N
// records keyed by ChunkIndex, all sharing Key='current' and the same
// Version + LastSavedAt + LastSavedBy.
//
// Save = delete-all-chunks-with-Key='current' then insert N new chunks.
// There's no native /update verb in this Data Service build.

import type { TenantConfig } from '../../config';
import { migrate } from '../../config';
import type { AdminTenantCredentials } from './adminTenant';
import { apiBaseFor } from './adminTenant';

const ENTITY_NAME = 'AuraConfig';
const SINGLETON_KEY = 'current';
// Keep a safety margin under the 4000-char NVARCHAR limit. JSON.stringify
// outputs are escaped already so chunks are byte-safe.
const CHUNK_SIZE = 3800;
// Hard cap on how many chunks we'll fetch in one read (enough for ~3.6 MB
// of config — far more than we expect).
const MAX_CHUNKS = 100;

export interface AuraConfigChunkRecord {
  Id: string;
  Key: string;
  ConfigJson: string;
  ChunkIndex: number;
  Version: number;
  LastSavedAt: string;
  LastSavedBy: string;
}

/** Aggregate metadata for the in-app "Saved · v3 · 2 min ago by …" footer. */
export interface AuraConfigMeta {
  Version: number;
  LastSavedAt: string;
  LastSavedBy: string;
  ChunkCount: number;
  /** Snapshot of the chunks that backed this config — used so a subsequent
   *  save can delete them by Id rather than re-fetching. */
  chunks: AuraConfigChunkRecord[];
}

export type FetchResult =
  | { kind: 'ok'; meta: AuraConfigMeta; config: TenantConfig }
  | { kind: 'not-found' }            // entity exists, no chunks yet
  | { kind: 'entity-missing' }       // entity itself doesn't exist (404 on /read)
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

function entityServiceUrl(creds: AdminTenantCredentials, suffix: string): string {
  return `${apiBaseFor(creds, 'dataservice_')}/api/EntityService/${ENTITY_NAME}/${suffix}`;
}

function authHeader(creds: AdminTenantCredentials): HeadersInit {
  return { Authorization: `Bearer ${creds.pat}` };
}

/**
 * Fetches all chunks for a given Key and reconstitutes the TenantConfig.
 * Each named configuration lives under its own Key (the config's display name);
 * the legacy single config used Key='current'. Defaults to 'current' for
 * back-compat.
 */
export async function fetchAuraConfig(creds: AdminTenantCredentials, key: string = SINGLETON_KEY): Promise<FetchResult> {
  try {
    const url = `${entityServiceUrl(creds, 'read')}?$top=${MAX_CHUNKS}`;
    const res = await fetch(url, { headers: authHeader(creds) });
    if (res.status === 401 || res.status === 403) return { kind: 'unauthorized' };
    if (res.status === 404) return { kind: 'entity-missing' };
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { kind: 'error', message: `HTTP ${res.status}: ${text.slice(0, 240)}` };
    }
    const data = (await res.json()) as { totalRecordCount?: number; value?: AuraConfigChunkRecord[] };
    const chunks = (data.value ?? [])
      .filter((r) => r.Key === key)
      .sort((a, b) => (a.ChunkIndex ?? 0) - (b.ChunkIndex ?? 0));
    if (chunks.length === 0) return { kind: 'not-found' };
    const fullJson = chunks.map((c) => c.ConfigJson).join('');
    let parsed: unknown;
    try { parsed = JSON.parse(fullJson); }
    catch { return { kind: 'error', message: 'Stored ConfigJson chunks did not concatenate into valid JSON.' }; }
    const head = chunks[0];
    return {
      kind: 'ok',
      meta: {
        Version: head.Version,
        LastSavedAt: head.LastSavedAt,
        LastSavedBy: head.LastSavedBy,
        ChunkCount: chunks.length,
        chunks,
      },
      config: migrate(parsed),
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Named-config library (multiple configs, keyed by name) ──────────────

/** One named configuration stored in Data Fabric. `key` is the record Key
 *  (the config's name); `name` is the display name (branding.appName). */
export interface DataFabricConfigEntry {
  key: string;
  name: string;
  config: TenantConfig;
  meta: AuraConfigMeta;
}

export type ListResult =
  | { kind: 'ok'; entries: DataFabricConfigEntry[]; corruptKeys: string[] }
  | { kind: 'entity-missing' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string };

/**
 * Reads EVERY record once, groups by Key, and reconstitutes one config per Key.
 * A Key whose chunks don't reassemble into valid JSON (e.g. hand-edited in the
 * Data Fabric grid) is reported in `corruptKeys` and skipped — the rest still
 * load. This powers the admin picker's "From Data Fabric" library.
 */
export async function listDataFabricConfigs(creds: AdminTenantCredentials): Promise<ListResult> {
  try {
    const url = `${entityServiceUrl(creds, 'read')}?$top=${MAX_CHUNKS}`;
    const res = await fetch(url, { headers: authHeader(creds) });
    if (res.status === 401 || res.status === 403) return { kind: 'unauthorized' };
    if (res.status === 404) return { kind: 'entity-missing' };
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { kind: 'error', message: `HTTP ${res.status}: ${text.slice(0, 240)}` };
    }
    const data = (await res.json()) as { value?: AuraConfigChunkRecord[] };
    const byKey = new Map<string, AuraConfigChunkRecord[]>();
    for (const r of data.value ?? []) {
      if (!r.Key) continue;
      if (!byKey.has(r.Key)) byKey.set(r.Key, []);
      byKey.get(r.Key)!.push(r);
    }
    const entries: DataFabricConfigEntry[] = [];
    const corruptKeys: string[] = [];
    for (const [key, recs] of byKey) {
      const chunks = recs.sort((a, b) => (a.ChunkIndex ?? 0) - (b.ChunkIndex ?? 0));
      const fullJson = chunks.map((c) => c.ConfigJson).join('');
      let parsed: unknown;
      try { parsed = JSON.parse(fullJson); }
      catch { corruptKeys.push(key); continue; }
      const head = chunks[0];
      const config = migrate(parsed);
      entries.push({
        key,
        name: config.branding.appName || key,
        config,
        meta: { Version: head.Version, LastSavedAt: head.LastSavedAt, LastSavedBy: head.LastSavedBy, ChunkCount: chunks.length, chunks },
      });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { kind: 'ok', entries, corruptKeys };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Schema provisioning ─────────────────────────────────────────────────

export type ProvisionResult =
  | { kind: 'ok' }
  | { kind: 'already-exists' }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'insufficient-scope'; message: string }
  | { kind: 'error'; message: string; tried?: string[] };

/**
 * Field defaults shared by every field in the entity. Mirrors what
 * Data Service's `/api/Entity/export` outputs for a manually-created
 * entity, minus the per-field id/createTime/createdBy which the import
 * endpoint assigns server-side.
 */
const FIELD_DEFAULTS = {
  isPrimaryKey: false,
  isForeignKey: false,
  isExternalField: false,
  isHiddenField: false,
  fieldCategoryId: 0,
  referenceType: 'ManyToOne',
  isEncrypted: false,
  description: '',
  isSystemField: false,
  isAttachment: false,
  isRbacEnabled: false,
  isModelReserved: false,
};

const ENTITY_DEFINITION = {
  name: ENTITY_NAME,
  displayName: 'Aura Config',
  entityTypeId: 0,
  entityType: 'Entity',
  isRbacEnabled: false,
  description: 'Runtime configuration for the Aura mobile/web app, written by the admin panel. Config JSON is split across multiple chunked records — see ChunkIndex.',
  folderId: '00000000-0000-0000-0000-000000000000',
  fields: [
    { ...FIELD_DEFAULTS, name: 'Key',         displayName: 'Key',         sqlType: { name: 'NVARCHAR',       lengthLimit: 64 },   isRequired: true,  isUnique: false },
    { ...FIELD_DEFAULTS, name: 'ConfigJson',  displayName: 'Config JSON', sqlType: { name: 'NVARCHAR',       lengthLimit: 4000 }, isRequired: false, isUnique: false },
    { ...FIELD_DEFAULTS, name: 'ChunkIndex',  displayName: 'Chunk Index', sqlType: { name: 'DECIMAL', precision: 18, scale: 0 },   isRequired: false, isUnique: false },
    { ...FIELD_DEFAULTS, name: 'Version',     displayName: 'Version',     sqlType: { name: 'DECIMAL', precision: 18, scale: 0 },   isRequired: false, isUnique: false },
    { ...FIELD_DEFAULTS, name: 'LastSavedAt', displayName: 'Last Saved At', sqlType: { name: 'DATETIMEOFFSET' },                   isRequired: false, isUnique: false },
    { ...FIELD_DEFAULTS, name: 'LastSavedBy', displayName: 'Last Saved By', sqlType: { name: 'NVARCHAR',     lengthLimit: 256 },  isRequired: false, isUnique: false },
  ],
};

/**
 * JSON the admin can download and upload via Data Service's "Import" UI.
 * Format mirrors GET /api/Entity/export so the import accepts it directly.
 */
export function getAuraConfigEntityImportJson(): unknown {
  return {
    choicesets: [],
    entities: [ENTITY_DEFINITION],
  };
}

export async function provisionAuraConfigEntity(creds: AdminTenantCredentials): Promise<ProvisionResult> {
  const url = `${apiBaseFor(creds, 'dataservice_')}/api/Entity`;
  const headers: HeadersInit = {
    ...authHeader(creds),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(ENTITY_DEFINITION),
    });
    if (res.ok) return { kind: 'ok' };
    if (res.status === 409) return { kind: 'already-exists' };

    const text = await res.text().catch(() => '');
    let parsed: { error?: string } = {};
    try { parsed = JSON.parse(text); } catch { /* non-JSON */ }

    if (res.status === 403 || (parsed.error?.includes('insufficient_scope'))) {
      return {
        kind: 'insufficient-scope',
        message:
          'Your PAT is missing the DataService.Schema scope. Either regenerate the token with that scope ticked, or create the entity manually using the steps below.',
      };
    }
    if (res.status === 401) {
      return { kind: 'unauthorized', message: 'Tenant rejected the PAT.' };
    }
    return {
      kind: 'error',
      message: `HTTP ${res.status}${parsed.error ? `: ${parsed.error}` : text ? `: ${text.slice(0, 240)}` : ''}`,
      tried: [`POST /api/Entity → ${res.status}`],
    };
  } catch (e) {
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : String(e),
      tried: ['POST /api/Entity → network error'],
    };
  }
}

// ─── Save (delete-all-chunks then insert chunks) ─────────────────────────

export type SaveResult =
  | { kind: 'ok'; meta: AuraConfigMeta }
  | { kind: 'conflict'; message: string }
  | { kind: 'unauthorized' }
  | { kind: 'insufficient-scope'; message: string }
  | { kind: 'entity-missing' }
  | { kind: 'error'; message: string };

function splitIntoChunks(s: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += CHUNK_SIZE) {
    chunks.push(s.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [''];
}

export async function saveAuraConfig(
  creds: AdminTenantCredentials,
  config: TenantConfig,
  existing: AuraConfigMeta | null,
  updatedBy: string,
  key: string = SINGLETON_KEY
): Promise<SaveResult> {
  const headers: HeadersInit = {
    ...authHeader(creds),
    'Content-Type': 'application/json',
  };

  try {
    // Step 1 — delete every chunk from the previous version so we don't
    // accidentally leave orphaned chunks if the new config has fewer of them.
    if (existing && existing.chunks.length > 0) {
      const ids = existing.chunks.map((c) => c.Id);
      const delRes = await fetch(entityServiceUrl(creds, 'delete'), {
        method: 'POST',
        headers,
        body: JSON.stringify(ids),
      });
      if (delRes.status === 401 || delRes.status === 403) {
        return await unauthorizedResult(delRes);
      }
      if (!delRes.ok) {
        const text = await delRes.text().catch(() => '');
        return { kind: 'error', message: `Delete-before-update failed: HTTP ${delRes.status}${text ? `: ${text.slice(0, 200)}` : ''}` };
      }
    }

    // Step 2 — split config into chunks and POST them sequentially.
    const json = JSON.stringify(config);
    const chunks = splitIntoChunks(json);
    const nextVersion = (existing?.Version ?? 0) + 1;
    const now = new Date().toISOString();
    const insertedChunks: AuraConfigChunkRecord[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const body = {
        Key: key,
        ConfigJson: chunks[i],
        ChunkIndex: i,
        Version: nextVersion,
        LastSavedAt: now,
        LastSavedBy: updatedBy,
      };
      const res = await fetch(entityServiceUrl(creds, 'insert'), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) return await unauthorizedResult(res);
      if (res.status === 404) return { kind: 'entity-missing' };
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          kind: 'error',
          message: `Insert chunk ${i + 1}/${chunks.length} failed: HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        };
      }
      const inserted = (await res.json()) as AuraConfigChunkRecord;
      insertedChunks.push(inserted);
    }

    return {
      kind: 'ok',
      meta: {
        Version: nextVersion,
        LastSavedAt: now,
        LastSavedBy: updatedBy,
        ChunkCount: chunks.length,
        chunks: insertedChunks,
      },
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

async function unauthorizedResult(res: Response): Promise<SaveResult> {
  const text = await res.text().catch(() => '');
  if (text.includes('insufficient_scope')) {
    return {
      kind: 'insufficient-scope',
      message: 'PAT is missing DataService.Data scope (or the read/write permission for AuraConfig). Regenerate with proper scopes.',
    };
  }
  return { kind: 'unauthorized' };
}
