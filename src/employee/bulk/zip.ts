// ─────────────────────────────────────────────────────────────────────────────
// Reading a bundle properly — bytes, not just names.
//
// `bulk.ts` walks a ZIP's central directory for FILE NAMES and stops there. That
// was enough to group documents by customer and count them, and it is why the
// desk could say "3 documents found" while being unable to show you any of them.
//
// This reads the same archive for its CONTENT. No library: the central directory
// gives each entry's local-header offset and compression method, and the browser
// inflates raw DEFLATE natively through DecompressionStream. Stored (method 0)
// entries are a straight slice.
//
// Deliberately not handled: zip64 (>4GB or >65535 entries), encrypted entries,
// and compression methods other than stored/deflate. A bundle of scanned AOPs is
// none of those, and an entry we cannot read is reported rather than guessed at.
// ─────────────────────────────────────────────────────────────────────────────

export interface ZipEntry {
  /** Full path inside the archive, as the archive spells it. */
  path: string;
  /** Just the file name. */
  name: string;
  /** Uncompressed size in bytes, as the directory declares it. */
  size: number;
  /** Raw bytes, once read. Absent when the entry could not be decoded. */
  bytes?: Uint8Array;
  /** Why the bytes are missing — shown to the user rather than swallowed. */
  error?: string;
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** Inflate raw DEFLATE using the platform. Older browsers lack it; say so
 *  instead of shipping a 40KB inflate no demo needs. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new Error('This browser cannot decompress the archive');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Every entry in the archive, with its bytes. Directories and the junk macOS
 * adds are skipped — they are not documents and listing them as such is how a
 * customer ends up with a "__MACOSX" tab.
 */
export async function readZip(buf: ArrayBuffer): Promise<ZipEntry[]> {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // The end-of-central-directory record lives in the last 64KB, after a comment
  // of unknown length — so it is found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) return [];

  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];

  for (let i = 0; i < count && off + 46 <= u8.length; i++) {
    if (dv.getUint32(off, true) !== SIG_CENTRAL) break;

    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const rawSize = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const path = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commentLen;

    if (path.endsWith('/') || /__MACOSX|\.DS_Store|thumbs\.db/i.test(path)) continue;

    const name = path.split('/').filter(Boolean).pop() ?? path;
    const entry: ZipEntry = { path, name, size: rawSize };

    // The LOCAL header's name/extra lengths can differ from the central one's,
    // so the data offset has to be read from the local header, not assumed.
    if (localOff + 30 > u8.length || dv.getUint32(localOff, true) !== SIG_LOCAL) {
      entry.error = 'The archive entry is damaged';
      out.push(entry);
      continue;
    }
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = u8.subarray(start, start + compSize);

    try {
      if (method === 0) entry.bytes = data;
      else if (method === 8) entry.bytes = await inflateRaw(data);
      else entry.error = `Unsupported compression (method ${method})`;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : 'Could not read this file';
    }
    out.push(entry);
  }
  return out;
}

// ── Rendering ────────────────────────────────────────────────────────────────

export type DocMedia = 'image' | 'pdf' | 'text' | 'other';

const EXT = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

export function mediaOf(name: string): DocMedia {
  const e = EXT(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'].includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (['txt', 'csv', 'json', 'xml', 'md'].includes(e)) return 'text';
  return 'other';
}

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  json: 'application/json', xml: 'application/xml', md: 'text/plain',
};

/**
 * What this file actually IS, by its magic number, falling back to the
 * extension. Scanned bundles routinely carry a PNG named `.jpg` (phone
 * scanners, re-saves, scripted exports), and declaring the wrong type on a
 * Blob makes the browser refuse to render a file it could have shown.
 */
function sniff(bytes?: Uint8Array): string | null {
  if (!bytes || bytes.length < 12) return null;
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export const mimeOf = (name: string, bytes?: Uint8Array) =>
  sniff(bytes) ?? MIME[EXT(name)] ?? 'application/octet-stream';

/** How to render it — again by content first, so a mislabelled scan still shows. */
export function mediaFor(entry: ZipEntry): DocMedia {
  const m = sniff(entry.bytes);
  if (m?.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  return mediaOf(entry.name);
}

/** A blob URL for an entry. The CALLER owns it and must revoke it — a viewer
 *  that mints one per tab switch and never releases them leaks the whole bundle
 *  into memory for as long as the page is open. */
export function blobUrl(entry: ZipEntry): string | null {
  if (!entry.bytes) return null;
  return URL.createObjectURL(new Blob([entry.bytes as BlobPart], { type: mimeOf(entry.name, entry.bytes) }));
}

export function asText(entry: ZipEntry): string {
  return entry.bytes ? new TextDecoder().decode(entry.bytes) : '';
}

export const humanSize = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
