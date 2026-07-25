import { useEffect } from 'react';

/**
 * Sign-in screen — the original FaceID login HTML, rendered VERBATIM inside an
 * isolated <iframe srcDoc> so the console's global CSS can't leak into it. The
 * layout is unchanged; the tenant brand (colours, logo, name) is interpolated in,
 * and the button posts a message that the React wrapper turns into a demo sign-in
 * (the real UiPath OAuth is replaced by a one-click gate).
 */
export interface LoginBrand {
  appName: string;
  logo?: string;
  favicon?: string;
  primary: string;    // hex
  secondary: string;  // hex
}

function hexRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '250,70,22';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__APP__ Verify Console · Sign in</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;450;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --orange:__PRIMARY__;--orange-hover:__PRIMARY__;--orange-deep:__PRIMARY__;
    --navy:#0E1521;--navy-2:#152030;--teal:__SECONDARY__;--teal-deep:__SECONDARY__;
    --line:#E4E7EC;--text:#182126;--muted:#646E7A;--faint:#9AA2AF;
    --display:"Plus Jakarta Sans",system-ui,sans-serif;--body:"Inter",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--body);min-height:100vh;-webkit-font-smoothing:antialiased;color:var(--text)}
  .page{display:grid;grid-template-columns:1.08fr .92fr;min-height:100vh}

  .brand{
    position:relative;overflow:hidden;color:#fff;display:flex;flex-direction:column;padding:32px 64px;
    background:
      radial-gradient(900px 500px at 12% -8%, rgba(__PRGB__,.16), transparent 60%),
      radial-gradient(900px 600px at 90% 110%, rgba(__SRGB__,.18), transparent 60%),
      linear-gradient(160deg,#101826 0%, var(--navy) 55%, #0A1019 100%);
  }
  .brand::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(800px 600px at 50% 40%,#000,transparent 80%);pointer-events:none}
  .brand>*{position:relative;z-index:1}

  .b-top{display:flex;align-items:center;justify-content:space-between}
  .status{display:flex;align-items:center;gap:8px;font-size:14px;color:#9CA8B6;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);padding:9px 15px;border-radius:22px}
  .status .d{width:9px;height:9px;border-radius:50%;background:var(--teal);animation:pulse 2.4s ease-out infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(__SRGB__,.5)}70%{box-shadow:0 0 0 10px rgba(__SRGB__,0)}100%{box-shadow:0 0 0 0 rgba(__SRGB__,0)}}

  .b-mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:22px;max-width:620px}
  .ulogo{height:40px;width:auto;max-width:220px;object-fit:contain;display:block;border-radius:8px}
  .scan{position:relative;width:200px;height:200px}
  .scan .ring{position:absolute;inset:0;border-radius:44px;background:radial-gradient(circle at 50% 40%, rgba(__SRGB__,.16), transparent 70%)}
  .scan .frame{position:absolute;inset:22px;border-radius:34px;background:linear-gradient(160deg,#1C2A3C,#121C29);overflow:hidden;border:1px solid rgba(255,255,255,.06)}
  .scan .sil{position:absolute;inset:0;display:grid;place-items:center}
  .scan .sil svg{width:60%;opacity:.5}
  .scan .sil path{fill:#3E5570}
  .scan .mesh span{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--teal);box-shadow:0 0 12px var(--teal);opacity:0;animation:dot .5s ease forwards}
  @keyframes dot{to{opacity:.95}}
  .scan .line{position:absolute;left:0;right:0;height:54px;background:linear-gradient(180deg,transparent,rgba(__SRGB__,.4),transparent);box-shadow:0 0 26px rgba(__SRGB__,.5);top:-56px;animation:sweep 3.4s ease-in-out infinite}
  @keyframes sweep{0%{top:-56px}50%{top:100%}100%{top:-56px}}
  .scan .corner{position:absolute;width:32px;height:32px;border:3px solid var(--teal)}
  .scan .c1{top:12px;left:12px;border-right:0;border-bottom:0;border-top-left-radius:12px}
  .scan .c2{top:12px;right:12px;border-left:0;border-bottom:0;border-top-right-radius:12px}
  .scan .c3{bottom:12px;left:12px;border-right:0;border-top:0;border-bottom-left-radius:12px}
  .scan .c4{bottom:12px;right:12px;border-left:0;border-top:0;border-bottom-right-radius:12px}

  .b-mid h1{font-family:var(--display);font-size:44px;font-weight:700;line-height:1.06;letter-spacing:-.8px}
  .b-mid h1 em{font-style:normal;color:var(--teal)}
  .b-mid .lede{font-size:18px;color:#AEB9C6;line-height:1.55;max-width:520px}
  .feats{display:flex;flex-direction:column;gap:11px}
  .feat{display:flex;align-items:center;gap:14px;font-size:16px;color:#CDD5DE}
  .feat .fi{width:38px;height:38px;border-radius:11px;background:rgba(__SRGB__,.12);display:grid;place-items:center;color:var(--teal);flex-shrink:0}
  .feat .fi svg{width:22px}
  .feat b{font-weight:600;color:#fff}

  .b-foot{display:flex;align-items:center;gap:16px;font-size:12.5px;color:#6E7A88;font-family:var(--mono);flex-wrap:wrap}
  .b-foot span{display:flex;align-items:center;gap:8px}
  .b-foot svg{width:16px;color:#7E8A98}

  .auth{background:#FBFBFC;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 48px;position:relative}
  .auth-card{width:100%;max-width:440px;text-align:center;animation:rise .5s cubic-bezier(.2,.7,.3,1)}
  @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .badge{width:84px;height:84px;border-radius:22px;margin:0 auto 30px;background:linear-gradient(150deg,var(--orange),var(--orange-deep));display:grid;place-items:center;box-shadow:0 14px 30px -10px rgba(__PRGB__,.5),inset 0 1px 0 rgba(255,255,255,.25)}
  .badge svg{width:44px;height:44px}
  .auth h2{font-family:var(--display);font-size:32px;font-weight:700;letter-spacing:-.3px}
  .auth .sub{font-size:16px;color:var(--muted);margin-top:9px}
  .auth .sub b{color:var(--text);font-weight:600}

  .sso{margin-top:38px;width:100%;display:flex;align-items:center;justify-content:center;gap:13px;background:var(--orange);color:#fff;font-family:var(--body);font-size:18px;font-weight:600;padding:19px 26px;border:none;border-radius:16px;cursor:pointer;transition:.16s;box-shadow:0 12px 26px -10px rgba(__PRGB__,.55)}
  .sso:hover{filter:brightness(1.08);box-shadow:0 16px 32px -10px rgba(__PRGB__,.65);transform:translateY(-1px)}
  .sso:active{transform:translateY(0)}
  .sso .uim{width:28px;height:28px;border-radius:8px;background:#fff;display:grid;place-items:center;overflow:hidden}
  .sso .uim .ufav{width:100%;height:100%;object-fit:contain;display:block}
  .sso .arr{margin-left:auto;width:22px;height:22px;opacity:.85}

  .secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;font-size:14px;color:var(--muted)}
  .secure svg{width:17px;color:var(--teal-deep)}
  .help{margin-top:28px;font-size:15px;color:var(--faint)}
  .help a{color:var(--teal-deep);text-decoration:none;font-weight:500}
  .help a:hover{text-decoration:underline}

  .auth-foot{position:absolute;bottom:28px;left:0;right:0;text-align:center;font-size:13px;color:var(--faint);font-family:var(--mono)}

  @media (max-width:980px){
    .page{grid-template-columns:1fr}
    .brand{padding:36px 32px;min-height:auto}
    .b-mid{align-items:center;text-align:center;padding:30px 0;gap:30px;max-width:none}
    .scan{width:200px;height:200px}
    .b-mid h1{font-size:40px}
    .feats{align-items:flex-start}
    .b-foot{justify-content:center}
    .auth{padding:48px 28px}
    .auth-foot{position:static;margin-top:36px}
  }
  @media (max-width:520px){ .b-mid .feats,.b-mid .lede{display:none} .scan{width:150px;height:150px} .b-mid h1{font-size:34px} }

  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation:none!important;transition:none!important}
    .scan .line{display:none}.scan .mesh span{opacity:.9}
  }
</style>
</head>
<body>
<div class="page">

  <div class="brand">
    <div class="b-top">
      <span></span>
      <div class="status"><span class="d"></span>All systems operational</div>
    </div>

    <div class="b-mid">
      <img class="ulogo" src="__LOGO__" alt="__APP__">
      <div class="scan" aria-hidden="true">
        <div class="ring"></div>
        <div class="frame">
          <div class="sil"><svg viewBox="0 0 100 120"><path d="M50 12a22 22 0 1 1 0 44 22 22 0 0 1 0-44zM12 118c0-21 17-34 38-34s38 13 38 34z"/></svg></div>
          <div class="mesh" id="mesh"></div>
          <div class="line"></div>
        </div>
        <span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>
      </div>

      <div>
        <h1>Verify a real, live person.<br><em>In seconds.</em></h1>
        <p class="lede" style="margin-top:14px">The administration console for __APP__ Verify — enroll identities, run liveness-checked verifications, and review every decision.</p>
      </div>

      <div class="feats">
        <div class="feat"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></span><div><b>Liveness</b> — defeats photos, masks &amp; deepfakes</div></div>
        <div class="feat"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg></span><div><b>1:1 match</b> — against the passport / ID on file</div></div>
        <div class="feat"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span><div><b>Audit-ready</b> — every check logged &amp; governed</div></div>
      </div>
    </div>

    <div class="b-foot">
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Encrypted in transit</span>
      <span>Powered by UiPath Agentic AI</span>
    </div>
  </div>

  <div class="auth">
    <div class="auth-card">
      <div class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg></div>
      <h2>Verify Console</h2>
      <p class="sub">Identity verification · <b>__APP__</b></p>
      <!--ERR-->
      <button class="sso" onclick="parent.postMessage('faceid-signin','*')">
        <span class="uim"><img class="ufav" src="__FAV__" alt=""></span>
        <span class="lbl">Sign in with __APP__</span>
        <svg class="arr" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>

      <div class="secure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Secured by __APP__ SSO · MFA enforced</div>
      <div class="help">Trouble signing in? <a href="#">Contact your administrator</a></div>
    </div>
    <div class="auth-foot">__APP__ Verify · © 2026 __APP__</div>
  </div>

</div>

<script>
  var mesh=document.getElementById('mesh');
  var pts=[[36,30],[64,30],[50,42],[32,48],[68,48],[42,60],[58,60],[50,66],[28,40],[72,40]];
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  pts.forEach(function(p,i){var s=document.createElement('span');s.style.left=p[0]+'%';s.style.top=p[1]+'%';s.style.animationDelay=(reduce?0:0.4+i*0.05)+'s';mesh.appendChild(s);});
</script>
</body>
</html>`;

function render(brand: LoginBrand, error?: string | null): string {
  const app = (brand.appName || 'Verify').replace(/</g, '&lt;');
  let html = TEMPLATE
    .replaceAll('__PRIMARY__', brand.primary)
    .replaceAll('__SECONDARY__', brand.secondary)
    .replaceAll('__PRGB__', hexRgb(brand.primary))
    .replaceAll('__SRGB__', hexRgb(brand.secondary))
    .replaceAll('__LOGO__', brand.logo || '')
    .replaceAll('__FAV__', brand.favicon || brand.logo || '')
    .replaceAll('__APP__', app);
  html = html.replace(
    '<!--ERR-->',
    error
      ? `<div style="margin-top:16px;background:#fff5f4;color:#b42318;border:1px solid #f3c0bb;border-radius:10px;padding:10px 12px;font-size:12.5px">⚠ ${String(error).replace(/</g, '&lt;')}</div>`
      : '',
  );
  return html;
}

export function LoginScreen({ onSignIn, brand, error }: { onSignIn: () => void; brand: LoginBrand; error?: string | null }) {
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data === 'faceid-signin') onSignIn();
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onSignIn]);

  return (
    <iframe
      title="Sign in"
      srcDoc={render(brand, error)}
      style={{ border: 0, width: '100vw', height: '100vh', display: 'block' }}
    />
  );
}
