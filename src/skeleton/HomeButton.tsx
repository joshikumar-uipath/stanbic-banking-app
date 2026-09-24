// A way back to the launcher from every surface.
//
// Fixed to the viewport rather than added to each surface's own chrome: the
// desk, the ops console and the phone-framed customer app all build their
// headers differently, and threading a button through each would mean touching
// five layouts. Routing is resolved once at load (see main.tsx), so getting home
// is a real navigation to the app root — which detectRoute reads as the launcher.
//
// The root is taken from document.baseURI, not '/'. UiPath Coded App hosting
// serves this app under <base href="/<app>/">, and an absolute '/' leaves the app
// entirely; on localhost the two are the same thing. The ops console used to
// carry its own link in its rail, hard-wired to '/', which is exactly how it
// broke on staging — and it lived in an iframe, so it could not be fixed there.
//
// Bottom-left, at the very bottom. Surfaces reserve the corner (desk.css
// .dk-side, ops-console.html .side) rather than the button dodging whatever is
// beneath it on any given screen.
export default function HomeButton() {
  const home = () => {
    try { window.location.assign(new URL('./', document.baseURI).href); }
    catch { window.location.href = '/'; }
  };
  return (
    <button
      type="button"
      onClick={home}
      title="Back to the launcher"
      style={{
        position: 'fixed', bottom: 12, left: 14, zIndex: 2147483000,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        font: '600 12px/1 "Segoe UI", system-ui', letterSpacing: '.01em',
        color: '#0b1220', background: 'rgba(255,255,255,.92)',
        border: '1px solid #dfe3ea', borderRadius: 999, padding: '7px 12px',
        cursor: 'pointer', boxShadow: '0 1px 2px rgba(11,18,32,.06), 0 6px 18px -10px rgba(11,18,32,.35)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>&#8592;</span>
      Launcher
    </button>
  );
}
