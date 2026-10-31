// Self-contained settings store for the kit — localStorage-backed, no backend.
// The only consumer here is relayView.ts (the Consolidated/Stacked toggle), so it
// persists per-browser. If you already have a shared settings store in the target
// project, delete this file and point relayView.ts at yours (it needs the same
// getSetting / setSetting / useSetting shape).

import { useEffect, useState } from 'react';

const PREFIX = 'kit-setting:';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function getSetting(key: string): string | undefined {
  try { return localStorage.getItem(PREFIX + key) ?? undefined; } catch { return undefined; }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try { localStorage.setItem(PREFIX + key, value); } catch { /* storage blocked */ }
  notify();
}

export function useSetting(key: string): string | undefined {
  const [v, setV] = useState<string | undefined>(() => getSetting(key));
  useEffect(() => {
    const update = () => setV(getSetting(key));
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, [key]);
  return v;
}
