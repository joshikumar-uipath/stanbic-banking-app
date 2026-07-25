// Embedding contract — the widget is designed to run inside a host app's <iframe>.
// Every message is posted to the parent as { source: "faceid-widget", type, ...payload }.
// Host apps filter on `source` and switch on `type`:
//   ready   → widget loaded and ready for the user
//   started → the user began a scan            { mode: "liveness" | "photo" }
//   result  → the scan finished               { verificationId, verified, ... }
//   error   → the scan failed / was cancelled { message }
export function notifyParent(payload: Record<string, unknown>) {
  try {
    // targetOrigin "*" keeps embedding host-agnostic; hosts must verify event.origin.
    window.parent?.postMessage({ source: "faceid-widget", ...payload }, "*");
  } catch {
    /* ignore — not embedded, or blocked */
  }
}

/** True when running inside an iframe (i.e. embedded in a host app). */
export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}
