// Video blob cache — fixes two CDN-side issues:
//  1. UiPath/Cloudflare serves .mp4 with Content-Type: application/octet-stream,
//     which makes <link rel="preload" as="video"> useless and prevents reuse
//     across <video> elements. We re-wrap fetched bytes in a Blob with the
//     correct video/mp4 type and hand back URL.createObjectURL().
//  2. Multiple <video> elements with the same src would otherwise re-download.
//     A single shared blob URL means one network fetch per video file.

declare global {
  interface Window {
    __VIDEO_BLOB_URLS__?: Record<string, string>;
    __VIDEO_BLOB_PROMISES__?: Record<string, Promise<string | undefined>>;
  }
}

const SUBSCRIBERS = new Map<string, Set<(url: string) => void>>();

function notify(src: string, url: string) {
  const subs = SUBSCRIBERS.get(src);
  if (subs) {
    subs.forEach(cb => cb(url));
    SUBSCRIBERS.delete(src);
  }
}

export function getCachedVideoBlob(src: string): string | null {
  return window.__VIDEO_BLOB_URLS__?.[src] ?? null;
}

export function ensureVideoBlob(src: string): Promise<string | undefined> {
  if (!window.__VIDEO_BLOB_URLS__) window.__VIDEO_BLOB_URLS__ = {};
  if (!window.__VIDEO_BLOB_PROMISES__) window.__VIDEO_BLOB_PROMISES__ = {};

  const cached = window.__VIDEO_BLOB_URLS__[src];
  if (cached) return Promise.resolve(cached);

  let promise = window.__VIDEO_BLOB_PROMISES__[src];
  if (!promise) {
    promise = fetch(src)
      .then(r => r.blob())
      .then(rawBlob => {
        const blob = new Blob([rawBlob], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        window.__VIDEO_BLOB_URLS__![src] = url;
        return url;
      })
      .catch(() => undefined);
    window.__VIDEO_BLOB_PROMISES__[src] = promise;
  }

  // Always wire notification — covers both cases (fetch we created and
  // fetch already kicked off by the index.html bootstrap script).
  promise.then(url => { if (url) notify(src, url); });

  return promise;
}

export function subscribeVideoBlob(src: string, cb: (url: string) => void): () => void {
  const cached = getCachedVideoBlob(src);
  if (cached) {
    cb(cached);
    return () => {};
  }
  if (!SUBSCRIBERS.has(src)) SUBSCRIBERS.set(src, new Set());
  SUBSCRIBERS.get(src)!.add(cb);
  return () => {
    const subs = SUBSCRIBERS.get(src);
    if (subs) subs.delete(cb);
  };
}
