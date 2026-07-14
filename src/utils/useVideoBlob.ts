import { useEffect, useState } from 'react';
import { getCachedVideoBlob, ensureVideoBlob } from './videoBlob';

// Resolve per src. If cache primed, return blob URL immediately; otherwise
// fall back to raw src while we warm the blob cache, then upgrade when ready.
// Must track src changes so theme toggles (orb-light.mp4 ↔ orb.mp4) actually
// swap the underlying video — using a single ref would freeze the first src
// forever.
export function useVideoBlob(src: string): string {
  const [resolved, setResolved] = useState<string>(() => getCachedVideoBlob(src) ?? src);

  useEffect(() => {
    const cached = getCachedVideoBlob(src);
    setResolved(cached ?? src);
    if (cached) return;
    let cancelled = false;
    ensureVideoBlob(src).then(url => {
      if (!cancelled && url) setResolved(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [src]);

  return resolved;
}
