// ─────────────────────────────────────────────────────────────────────────────
// Batch metadata — the things a batch knows that its rows do not.
//
// A batch's applications live on the shared store like any other case, keyed to
// each other by `batchId`. But a batch also has a name, a channel, a booking
// branch and a set of rows that were REJECTED at intake — and a rejected row
// never became a case, so there is nowhere on the store to hang it.
//
// Rather than add a second entity to the store abstraction (and a second table
// to every backend it might later front), that metadata lives here, keyed by
// batch id and persisted to localStorage so a reload does not lose a batch
// mid-flight. Nothing else in the app reads it.
// ─────────────────────────────────────────────────────────────────────────────
import type { BulkChannel } from '../../onboarding';

/** A document or row that never made it into the pipeline, and why. */
export interface IntakeRejection {
  /** The file or row as the submitter named it, so they can find it again. */
  source: string;
  /** Who it appeared to be for. Blank when the document identified nobody. */
  customer: string;
  /** Said in words the submitter can act on — never a code. */
  reason: string;
  /** Whether replacing the file is enough to fix it. */
  fixable: boolean;
}

export interface BatchMeta {
  id: string;
  name: string;
  channel: BulkChannel;
  segment: string;
  branch: string;
  createdAt: string;
  /** How many documents or manifest rows arrived. */
  submitted: number;
  /** How many became live applications. */
  accepted: number;
  rejections: IntakeRejection[];
}

const KEY = 'aof_bulk_batches';

type Store = Record<string, BatchMeta>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};                       // private window, blocked storage, bad JSON
  }
}

function write(s: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* unavailable */ }
}

const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

export function subscribeBatches(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function saveBatch(meta: BatchMeta): void {
  const s = read();
  s[meta.id] = meta;
  write(s);
  announce();
}

export function getBatch(id: string): BatchMeta | null {
  return read()[id] ?? null;
}

/** Newest first — the list a banker actually wants. */
export function listBatches(): BatchMeta[] {
  return Object.values(read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function newBatchId(): string {
  return `BATCH-${String(Date.now()).slice(-6)}`;
}
