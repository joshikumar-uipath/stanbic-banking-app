// ─────────────────────────────────────────────────────────────────────────────
// Which applications belong to the person holding this phone.
//
// The OnboardingStore is shared across every surface — Operations has to see the
// bank's whole pipeline. A customer must only ever see their own, so the consumer
// app keeps its own list of the applications it started and filters by that.
//
// Real implementation: scope by the authenticated customer (CIF / BVN) server-side
// rather than trusting the device.
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'aof_my_apps';

export function myAppIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

export function rememberMyApp(id: string): void {
  try {
    const ids = myAppIds();
    if (!ids.includes(id)) localStorage.setItem(KEY, JSON.stringify([id, ...ids]));
  } catch { /* localStorage unavailable — the list just won't persist */ }
}
