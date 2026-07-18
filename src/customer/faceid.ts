// ─────────────────────────────────────────────────────────────────────────────
// FaceID — the real liveness app, embedded into the KYC step.
//
// It's a UiPath Coded App ("FaceID — Liveness & Verification", AWS Amplify's
// liveness detector under the hood) that owns the whole check: camera, face
// capture, scoring. We hand the customer over to it and take them back for the
// signature step afterwards.
//
// Two things it needs from the host, both non-obvious:
//   • allow="camera; microphone; geolocation" — a cross-origin frame gets none of
//     these by default, and it throws a permissions-policy violation without the
//     last one.
//   • a frame narrower than 480px — see .cx-faceid in ./customer.css.
//
// ── On knowing when it's finished ────────────────────────────────────────────
// It cannot tell us. The app's bundle contains no `parent.postMessage` /
// `top.postMessage` — nothing crosses the frame boundary — and because it's on
// another origin we can't read its DOM or its URL either. So auto-advance is
// impossible today; the customer taps a button when the check is done.
//
// The listener below is here so that stops being true the moment FaceID emits
// something on completion. One line on their side:
//
//     window.parent.postMessage({ type: 'faceid:complete', score: 0.94 }, '*')
//
// and this flow advances on its own, no change needed here.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

/** Override per environment without touching code. */
export const FACE_ID_URL: string =
  import.meta.env.VITE_FACEID_URL || 'https://mea.staging.uipath.host/face-id-verify';

export const FACE_ID_ORIGIN: string = (() => {
  try { return new URL(FACE_ID_URL).origin; } catch { return ''; }
})();

/** Does this message look like "the check finished, and passed"? */
function looksComplete(data: unknown): { done: boolean; score?: number } {
  if (!data || typeof data !== 'object') return { done: false };
  const d = data as Record<string, unknown>;
  const tag = String(d.type ?? d.name ?? d.event ?? d.status ?? '').toLowerCase();
  const done = /complete|success|verified|finish|done|pass/.test(tag);
  const raw = d.score ?? d.confidence ?? d.livenessScore;
  return { done, score: typeof raw === 'number' ? raw : undefined };
}

/**
 * Advance when FaceID says it's finished — if it ever does.
 * Only listens to messages from FACE_ID_ORIGIN, so an unrelated page can't
 * fake a passed liveness check by posting into this window.
 */
export function useFaceIdComplete(onDone: (score?: number) => void) {
  useEffect(() => {
    if (!FACE_ID_ORIGIN) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== FACE_ID_ORIGIN) return;
      const { done, score } = looksComplete(e.data);
      // Unrecognised shapes are logged rather than guessed at: if FaceID starts
      // emitting something, this is where you'll see what it actually sends.
      if (!done) { console.info('[faceid] message from the embedded app:', e.data); return; }
      onDone(score);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onDone]);
}
