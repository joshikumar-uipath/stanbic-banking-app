// ─────────────────────────────────────────────────────────────────────────────
// The person acting on this device, right now.
//
// The maker/verifier screens used to stamp a fixed persona name on every write,
// so "who confirmed this" and "who opened it" were the same constant whoever was
// holding the phone — and the four-eyes rule could not tell two people apart.
// The shell sets the actor when someone picks who they are; writes read it back.
//
// Held for the tab (sessionStorage), not the device: a phone handed to a
// colleague and reopened must not carry the last person's name into their work.
// ─────────────────────────────────────────────────────────────────────────────

/** Fired on window whenever the actor changes. */
export const ACTOR_EVENT = 'aof-actor';

const KEY = 'aof_actor';
let actor: string | null = (() => {
  try { return sessionStorage.getItem(KEY) || null; } catch { return null; }
})();

/** Who is acting. `null` (or blank) clears it. */
export function setActor(name: string | null): void {
  const next = name?.trim() || null;
  if (next === actor) return;
  actor = next;
  try {
    if (next) sessionStorage.setItem(KEY, next); else sessionStorage.removeItem(KEY);
  } catch { /* unavailable */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACTOR_EVENT, { detail: { actor: next } }));
}

/** Whether anyone has been set. */
export const hasActor = (): boolean => actor !== null;

/** The actor, or `fallback` when nobody has been set. */
export const actorOr = (fallback: string): string => actor ?? fallback;

/** The actor, or 'You' when nobody has been set. */
export const currentActor = (): string => actorOr('You');
