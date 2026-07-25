import { useEffect, useRef, useState } from "react";
import { FaceLivenessDetector } from "@aws-amplify/ui-react-liveness";
import { ThemeProvider } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

/**
 * Wraps the AWS FaceLivenessDetector and sizes it to fill the phone frame.
 * NOTE: AWS controls the in-scan UI (oval, color flashes) — it can't be
 * redesigned. We customize the hint copy (displayText), replace the error
 * screen (components.ErrorView), and cover the connect handshake with our own
 * branded loader.
 */

// Warm, action-first hint copy (world-class verification voice).
const DISPLAY_TEXT = {
  hintCenterFaceText: "Center your face",
  hintMoveFaceFrontOfCameraText: "Center your face",
  hintTooFarText: "Come closer",
  hintTooCloseText: "Move back",
  hintHoldFaceForFreshnessText: "Hold still",
  hintIlluminationTooDarkText: "More light",
  hintIlluminationTooBrightText: "Too bright",
  hintIlluminationNormalText: "Lighting good",
  hintTooManyFacesText: "One face only",
  hintFaceDetectedText: "Hold still",
  hintCheckCompleteText: "Got it",
  recordingIndicatorText: "Live",
  cancelLivenessCheckText: "Cancel",
  // Blanked so our own loader covers connect/verify/permission.
  hintConnectingText: " ",
  hintVerifyingText: " ",
  waitingCameraPermissionText: " ",
};

/** Branded full-screen error/retry view (replaces AWS's default modal). */
function LivenessErrorView({
  children,
  onRetry,
}: {
  children: React.ReactNode;
  onRetry: () => void;
}) {
  return (
    <div className="lv-error">
      <div className="lv-error-icon" aria-hidden>
        <svg viewBox="0 0 52 52" width="60" height="60">
          <circle cx="26" cy="26" r="24" fill="none" stroke="var(--fc-primary)" strokeWidth="2.5" opacity="0.9" />
          <path d="M26 15 v15" stroke="var(--fc-primary)" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="26" cy="37" r="2" fill="var(--fc-primary)" />
        </svg>
      </div>
      <div className="lv-error-body">{children}</div>
      <button className="primary big cta" onClick={onRetry}>
        Try again
      </button>
      <p className="lv-error-help">Make sure your face is centered in good lighting.</p>
    </div>
  );
}

export function LivenessScan({
  sessionId,
  region,
  onComplete,
  onError,
}: {
  sessionId: string;
  region: string;
  onComplete: () => void | Promise<void>;
  onError: (err: unknown) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [camReady, setCamReady] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const host = hostRef.current;
      if (!host) return;
      const v = host.querySelector("video") as HTMLVideoElement | null;
      const liveVideo =
        !!v &&
        v.videoWidth > 0 &&
        !v.paused &&
        v.offsetParent !== null &&
        v.getBoundingClientRect().height > 30;
      const txt = host.innerText || "";
      const hintShown =
        /closer|center|still|back|light|frame|live|hold|great/i.test(txt);
      if ((liveVideo && hintShown) || Date.now() - start > 9000) {
        setCamReady(true);
        clearInterval(id);
      }
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="liveness-fill" ref={hostRef}>
      <ThemeProvider colorMode="dark">
        <FaceLivenessDetector
          sessionId={sessionId}
          region={region}
          disableStartScreen
          displayText={DISPLAY_TEXT}
          components={{ ErrorView: LivenessErrorView }}
          onAnalysisComplete={async () => {
            await onComplete();
          }}
          onError={onError}
        />
      </ThemeProvider>

      {!camReady && (
        <div className="liveness-prep">
          <div className="spinner" />
          <p>Preparing secure scan…</p>
        </div>
      )}
    </div>
  );
}
