/* Ported verbatim from the standalone FaceID kiosk (face-id-public); its own lint
   patterns are kept while tsc type-checks it. Only the scan-arc colours are wired
   to the tenant brand. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { FaceMeshOverlay } from "./FaceMeshOverlay";
import { FaceMeshIcon } from "./FaceMeshIcon";
import { ScrambleText } from "./ScrambleText";
import { assetUrl } from "./appBase";

/**
 * Pre-screen sequence shown before the AWS liveness check:
 *   Stage 1 "prep" (7s): a static prep photo in the frame + scan line + copy.
 *   Stage 2 "live" (8s): the user's live camera + face mesh + scan line.
 * Then it releases the camera and hands off to the real check.
 *
 * Stage 1's photo loads from /prep-face.jpg (drop your image in frontend/public).
 */
const PREP_MS = 7000;
const LIVE_MS = 8000;

type Stage = "prep" | "live";

export function LivenessPrescreen({
  onStart,
  onCancel,
}: {
  onStart: () => void;
  onCancel?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
  const [stage, setStage] = useState<Stage>("prep");
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imgOk, setImgOk] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start the camera up front so it's ready for the live stage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err: any) {
        setError(
          err?.name === "NotAllowedError"
            ? "Camera permission is needed to continue."
            : "Could not access the camera."
        );
      }
    })();
    return () => {
      cancelled = true;
      releaseCamera();
    };
  }, []);

  // Stage 1 → Stage 2 after PREP_MS.
  useEffect(() => {
    const t = setTimeout(() => setStage("live"), PREP_MS);
    return () => clearTimeout(t);
  }, []);

  // Stage 2: run the progress, then hand off to AWS.
  useEffect(() => {
    if (stage !== "live") return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const pct = Math.min(100, Math.round(((now - start) / LIVE_MS) * 100));
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
      else begin();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function releaseCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function begin() {
    if (startedRef.current) return;
    startedRef.current = true;
    releaseCamera();
    setTimeout(onStart, 150);
  }

  function cancel() {
    releaseCamera();
    onCancel?.();
  }

  // Tap anywhere to skip the wait: prep → live, live → start the scan.
  function advance() {
    if (stage === "prep") setStage("live");
    else begin();
  }

  const Arc = (
    <svg className="fs-arc" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="arcg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" style={{ stopColor: "var(--fc-secondary)", stopOpacity: 0 }} />
          <stop offset="50%" style={{ stopColor: "var(--fc-secondary)" }} />
          <stop offset="100%" style={{ stopColor: "var(--fc-primary)", stopOpacity: 0 }} />
        </linearGradient>
        {/* trailing glow/shadow that drags below the line */}
        <linearGradient id="arctrail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--fc-secondary)", stopOpacity: 0.42 }} />
          <stop offset="55%" style={{ stopColor: "var(--fc-secondary)", stopOpacity: 0.14 }} />
          <stop offset="100%" style={{ stopColor: "var(--fc-secondary)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {/* the drag: fill from the curve downward, fading out */}
      <path d="M10 70 Q160 20 310 70 L310 200 L10 200 Z" fill="url(#arctrail)" />
      {/* the scan line itself (arched upward ∩, trail drags below) */}
      <path d="M10 70 Q160 20 310 70" fill="none" stroke="url(#arcg)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );

  if (error) {
    return (
      <div className="fs-scan">
        <div className="fs-top">
          {onCancel ? <button className="fs-cancel" onClick={cancel}>Cancel</button> : <span />}
          <span className="fs-title">Face Scan</span>
          <span />
        </div>
        <div className="center stack pad" style={{ flex: 1 }}>
          <div className="result fail" style={{ width: "100%" }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fs-scan" onClick={advance} role="button">
      {/* live camera (covered by the prep photo during stage 1) */}
      <video ref={videoRef} className="fs-video" playsInline muted />

      {stage === "prep" &&
        (imgOk ? (
          <img className="fs-prep-img" src={assetUrl("prep-face.jpg")} alt="" onError={() => setImgOk(false)} />
        ) : (
          <div className="fs-prep-fallback">
            <FaceMeshIcon size={120} />
            <div className="fs-prep-hint">Add frontend/public/prep-face.jpg</div>
          </div>
        ))}

      <div className="fs-vignette" />

      {/* face mesh sits BELOW the scan line (live stage only) */}
      {stage === "live" && ready && <FaceMeshOverlay />}

      {/* scanning sweep line (above the mesh) */}
      {Arc}

      <div className="fs-top">
        {onCancel ? <button className="fs-cancel" onClick={(e) => { e.stopPropagation(); cancel(); }}>Cancel</button> : <span />}
        <span className={stage === "live" ? "fs-title fs-title-lg" : "fs-title"}>
          {stage === "prep" ? <ScrambleText text="Let's verify it's you" /> : "Face Scan"}
        </span>
        <span />
      </div>

      <div className="fs-bottom">
        {stage === "live" && (
          <div className="fs-progress">
            <div className="fs-progress-pct">{progress}%</div>
            <div className="fs-progress-bar">
              <div className="fs-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {stage === "prep" && <div className="fs-emoji">👍</div>}
        <div className="fs-stay">{stage === "prep" ? "Stay in Position" : "Mapping your face"}</div>
        <div className="fs-sub">
          {stage === "prep" ? "It will take just a few seconds" : "Please look into the camera"}
        </div>
      </div>
    </div>
  );
}
