// ─────────────────────────────────────────────────────────────────────────────
// Where a submitted package lives: this browser's IndexedDB, against its record.
//
// A record is serialised to a small JSON column, so the files cannot ride on it
// — but the desk needs them later: when the case parks on "Confirm extracted
// details", the review should show the package that was actually read, not the
// single-form screen's empty frame and sample values. IndexedDB holds the bytes
// (tens of MB is fine) for as long as the browser keeps the site's data.
// ─────────────────────────────────────────────────────────────────────────────
import type { PackageResult } from './packageDocs';

const DB = 'aof-packages';
const STORE = 'byRecord';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePackage(recordId: string, r: PackageResult): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      // Facts are on the record already; the bytes and rows are what is kept here.
      tx.objectStore(STORE).put({ files: r.files.map((f) => ({ ...f, facts: undefined })), rows: r.rows, kind: r.kind }, recordId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* storage blocked or full: the desk falls back to the standard review */ }
}

export async function loadPackage(recordId: string): Promise<PackageResult | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(recordId);
      req.onsuccess = () => resolve((req.result as PackageResult | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}
