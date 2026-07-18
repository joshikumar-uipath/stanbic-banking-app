// ─────────────────────────────────────────────────────────────────────────────
// KYC — progressive completion from the tokenised link (/kyc/:token).
// Documents → liveness → signature → activated. No login: the token is the key.
//
// Liveness is REAL: the UiPath FaceID app is embedded and owns the camera, the
// capture and the scoring (see ./faceid). The signature pad is real too (canvas +
// pointer events). Documents are still a mock upload.
//
// NOTE: like the Apply wizard, gating is deliberately OFF — documents, selfie and
// signature are all optional so the flow can be clicked straight through in a
// demo. The requirements get enforced later.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { store, fullName, type OnboardingCase } from '../onboarding';
import { Button, Note, Brand } from './ui';
import Icon from './icons';
import { FACE_ID_URL, useFaceIdComplete } from './faceid';

type Stage = 'intro' | 'docs' | 'liveness' | 'signature' | 'done';

export default function Kyc({ c, onExit }: { c: OnboardingCase; onExit: () => void }) {
  const [stage, setStage] = useState<Stage>('intro');
  const [docs, setDocs] = useState<Record<string, boolean>>({ id: false, address: false });
  const [scan, setScan] = useState<'idle' | 'scanning' | 'ok'>('idle');
  const [score, setScore] = useState<number | undefined>(undefined);

  // Liveness is done: record it against the case and hand back to the signature.
  // One path whether FaceID told us or the customer did.
  const livenessDone = useCallback((s?: number) => {
    setScan('ok');
    if (s !== undefined) setScore(s);
    void store.update(c.id, {
      validations: c.validations.map((v) => (v.kind === 'LIVENESS'
        ? { ...v, status: 'passed', attempts: v.attempts + 1, updatedAt: new Date().toISOString(), detail: s !== undefined ? `FaceID score ${s.toFixed(2)}` : 'FaceID liveness completed' }
        : v)),
    });
    setStage('signature');
  }, [c.id, c.validations]);

  // Auto-advance the day FaceID starts announcing completion. Inert until then.
  useFaceIdComplete(livenessDone);

  const finish = async () => {
    await store.update(c.id, { validations: c.validations.map((v) => (v.kind === 'LIVENESS' ? { ...v, status: 'passed', attempts: v.attempts + 1, updatedAt: new Date().toISOString() } : v)) });
    await store.advance(c.id, 'FULLY_ACTIVATED', 'KYC completed by the customer — documents, liveness and signature received');
    setStage('done');
  };

  return (
    <>
      <div className="cx-head">
        <div className="cx-topline"><Brand sub="Finish your account" /></div>
      </div>

      {/* `fill` only on the liveness step: FaceID is the tallest thing in the
          flow and should use every pixel between the heading and the button. */}
      <div className={`cx-body${stage === 'liveness' ? ' fill' : ''}`}>
        {stage === 'intro' && (
          <>
            <h1 className="cx-h1">Hello {c.firstName || 'there'} 👋</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>
              Your account <b style={{ color: 'var(--ink)' }}>{c.accountNumber ?? c.id}</b> is already open. Three quick things and we can lift the limits on it.
            </p>
            <div className="cx-usp">
              {[
                { i: 'doc', b: 'Your documents', s: 'A photo of your ID and proof of address' },
                { i: 'face', b: 'A quick selfie', s: 'So we know it&rsquo;s really you' },
                { i: 'pen', b: 'Your signature', s: 'Sign with your finger' },
              ].map((x) => (
                <div className="cx-usp-row" key={x.i}>
                  <span className="cx-usp-ic"><Icon name={x.i} size={17} /></span>
                  <span><b>{x.b}</b><span dangerouslySetInnerHTML={{ __html: x.s }} /></span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}><Note tone="info" icon="clock">Takes about two minutes. You can stop and come back — this link keeps your place.</Note></div>
          </>
        )}

        {stage === 'docs' && (
          <>
            <h1 className="cx-h1">Your documents</h1>
            <p className="cx-p" style={{ marginBottom: 16 }}>Photos are fine — just make sure all four corners are visible.</p>
            {[
              { k: 'id', ic: 'id', b: 'Means of identification', s: "NIN slip, driver's licence or passport" },
              { k: 'address', ic: 'home', b: 'Proof of address', s: 'A utility bill from the last 90 days' },
            ].map((d) => (
              <button key={d.k} className={`cx-drop ${docs[d.k] ? 'done' : ''}`} onClick={() => setDocs((p) => ({ ...p, [d.k]: true }))}>
                <span className="di"><Icon name={docs[d.k] ? 'checkCircle' : d.ic} size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{d.b}</b><span>{docs[d.k] ? 'Uploaded · tap to replace' : d.s}</span></span>
                <Icon name={docs[d.k] ? 'refresh' : 'upload'} size={17} />
              </button>
            ))}
          </>
        )}

        {stage === 'liveness' && (
          <>
            {/* No heading here on purpose. FaceID puts its own titles on every
                screen ("Face Scan", "Please look into the camera", "Let's verify
                it's you") — ours only repeated them, and cost the app 74px of
                height it needed for its result card. */}
            {/* The real FaceID app takes over from here. `allow` is not optional:
                a cross-origin frame gets no camera unless the host grants it, and
                the browser blocks whatever is missing silently-ish. FaceID asks for
                geolocation too (it throws a permissions-policy violation without
                it) — presumably to stamp where the check happened. */}
            <div className="cx-faceid">
              <iframe
                src={FACE_ID_URL}
                title="Liveness &amp; verification"
                allow="camera; microphone; geolocation; fullscreen"
                referrerPolicy="origin"
              />
            </div>
            {scan === 'ok'
              ? <p className="cx-score" style={{ color: 'var(--good)' }}>Liveness confirmed{score !== undefined ? ` · score ${score.toFixed(2)}` : ''}</p>
              : <p className="cx-score" style={{ color: 'var(--soft)' }}>Finish the check above, then continue</p>}
          </>
        )}

        {stage === 'signature' && (
          <>
            <h1 className="cx-h1">Sign here</h1>
            <p className="cx-p" style={{ marginBottom: 14 }}>Use your finger. This is the signature we&rsquo;ll hold on file for {fullName(c)}.</p>
            <SignaturePad />
          </>
        )}

        {stage === 'done' && (
          <div style={{ paddingTop: 20, textAlign: 'center' }}>
            <div className="cx-tick"><Icon name="check" size={38} strokeWidth={2.6} /></div>
            <h1 className="cx-h1" style={{ textAlign: 'center' }}>You&rsquo;re all set</h1>
            <p className="cx-p" style={{ marginBottom: 18 }}>Your account is fully activated. Every limit is lifted and you can start using it right away.</p>
            {c.accountNumber && <div className="cx-appid">{c.accountNumber}</div>}
          </div>
        )}
      </div>

      <div className="cx-foot">
        {/* No gates — every step advances freely (see the note at the top of this
            file). Upload / selfie / signature are all optional for now. */}
        {stage === 'intro' && <Button onClick={() => setStage('docs')}>Get started<Icon name="arrowRight" size={17} /></Button>}
        {stage === 'docs' && <Button onClick={() => setStage('liveness')}>Continue<Icon name="arrowRight" size={17} /></Button>}
        {stage === 'liveness' && (
          <>
            {/* FaceID doesn't signal the host page (see ./faceid), so the customer
                tells us. The moment it does, useFaceIdComplete skips this. */}
            <Button variant={scan === 'ok' ? 'primary' : 'sky'} onClick={() => livenessDone()}>
              {scan === 'ok' ? <>Continue<Icon name="arrowRight" size={17} /></> : <>I&rsquo;ve finished the check<Icon name="arrowRight" size={17} /></>}
            </Button>
          </>
        )}
        {stage === 'signature' && <Button onClick={finish}>Finish</Button>}
        {stage === 'done' && <Button variant="ghost" onClick={onExit}>Done</Button>}
      </div>
    </>
  );
}

// Real signature capture — canvas + pointer events.
function SignaturePad() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [has, setHas] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.offsetWidth * dpr; cv.height = cv.offsetHeight * dpr;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#11181D';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    if (!has) setHas(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const cv = ref.current; const ctx = cv?.getContext('2d');
    if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    setHas(false);
  };

  return (
    <>
      <div className="cx-sign">
        <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        <span className="base" />
        {!has && <span className="ph">Sign above the line</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="cx-link" onClick={clear}>Clear</button>
      </div>
    </>
  );
}
