/* Ported from the standalone FaceID kiosk (face-id-public) — the REAL AWS liveness
   flow. Kept close to the reference (its own lint patterns and `any` casts stay)
   while tsc type-checks it; only the data source (deployed backend), branding, and
   the internal Azure comparison toggle differ. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { api, type KioskResult } from "./data";
import { getActiveCountry } from "../config/countries";
import { LivenessPrescreen } from "./LivenessPrescreen";
import { LivenessScan } from "./LivenessScan";
import { notifyParent } from "./embed";

type Phase = "prescreen" | "starting" | "scanning" | "identifying" | "result" | "error";

// Location shown on the confirmation card (browser geolocation overrides it).
const KIOSK_LOCATION = `${getActiveCountry().cities[0]} branch, ${getActiveCountry().name}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "22 Jun 2026 10:00 AM" */
function fmtTimestamp(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${h}:${m} ${ampm}`;
}

/** YYYYMMDD for the reference id (today if no date). */
function ymd(d: Date | null): string {
  const x = d ?? new Date();
  return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
}

/** Stable 5-digit code derived from the verification id. */
function shortCode(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return String(h).padStart(5, "0");
}

/**
 * Resolve the user's location from the browser (Geolocation API), then
 * reverse-geocode the coordinates to a readable place name. Falls back to
 * KIOSK_LOCATION if permission is denied / geolocation is unavailable.
 */
async function resolveBrowserLocation(): Promise<string> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return KIOSK_LOCATION;
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 300000,
      enableHighAccuracy: false,
    })
  );
  const { latitude, longitude } = pos.coords;
  const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    const j: any = await res.json();
    // Country names come in ISO form ("United Arab Emirates (the)") — drop "(the)".
    const country = (j.countryName || "").replace(/\s*\(the\)\s*$/i, "");
    const raw = [j.locality || j.city, j.principalSubdivision, country].filter(Boolean);
    // Drop duplicates (e.g. locality === region → "Dubai, Dubai").
    const seen = new Set<string>();
    const parts = raw.filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return parts.length ? parts.join(", ") : coords;
  } catch {
    return coords; // geocoding failed — show raw coordinates
  }
}

// ---- Failure / manual-review screens, keyed to the backend's reason ----
type FailKind = "mismatch" | "liveness" | "review";

/** Map the kiosk identify `reason` to a screen. */
function classifyFailure(reason?: string): FailKind {
  if (reason === "no-match") return "mismatch"; // live, but matched no one on file
  if (reason === "not-live") return "liveness"; // real session, failed anti-spoof
  return "review"; // liveness-incomplete | no-frame | anything unexpected
}

const FAIL_SCREENS: Record<
  FailKind,
  { title: string; reason: string; status: string; footer: string; cta: string }
> = {
  mismatch: {
    title: "Verification Failed",
    reason: "The submitted selfie does not sufficiently match the identity document on file.",
    status: "Verification Failed",
    footer: "Please retake your selfie or contact support.",
    cta: "Try again",
  },
  liveness: {
    title: "Verification Failed",
    reason: "Unable to confirm that the selfie was captured from a live person.",
    status: "Liveness Check Failed",
    footer: "Please try again in a well-lit environment.",
    cta: "Try again",
  },
  review: {
    title: "Verification Under Review",
    reason: "Additional checks are required to complete verification.",
    status: "Pending Manual Review",
    footer: "You will be notified once verification is complete.",
    cta: "Done",
  },
};

// Dev preview: open with ?demo=mismatch | liveness | review | partial | success
const DEMO_RESULTS: Record<string, KioskResult> = {
  mismatch: { recognized: false, reason: "no-match", isLive: true, similarity: 41.2 },
  liveness: { recognized: false, reason: "not-live", isLive: false, livenessConfidence: 38.5 },
  review: { recognized: false, reason: "liveness-incomplete", isLive: false },
  partial: {
    recognized: true,
    partial: true,
    verificationId: "demo-partial-0001",
    subject: { displayName: "John Doe", employeeId: "EMD123", designation: "Test" },
    time: "2026-06-22T10:00:00",
    isLive: true,
    similarity: 84.6,
    livenessConfidence: 95,
  },
  success: {
    recognized: true,
    verificationId: "demo-0001",
    subject: { displayName: "John Doe", employeeId: "EMD123", designation: "Test" },
    event: "enter",
    time: "2026-06-22T10:00:00",
    isLive: true,
    similarity: 98.2,
    livenessConfidence: 95,
  },
};

function WarnIcon() {
  return (
    <svg className="result-icon" viewBox="0 0 52 52" width="60" height="60" aria-hidden>
      <path d="M26 7 L49 46 H3 Z" fill="none" stroke="#ff6b81" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 22 v11" stroke="#ff6b81" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="26" cy="40" r="2.2" fill="#ff6b81" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg className="result-icon" viewBox="0 0 52 52" width="58" height="58" aria-hidden>
      <circle cx="26" cy="26" r="23" fill="none" stroke="#f5b14c" strokeWidth="2" opacity="0.5" />
      <path
        d="M19 15 H33 M19 37 H33 M21 15 V20 L26 26 L31 20 V15 M21 37 V32 L26 26 L31 32 V37"
        fill="none" stroke="#f5b14c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Turn AWS's technical error text into friendly, actionable copy. */
function friendlyError(raw: string | null): string {
  const e = (raw || "").toLowerCase();
  if (/time|timeout|timed out/.test(e))
    return "That took a little too long. Center your face in the oval and try again.";
  if (/multiple|many faces/.test(e)) return "Make sure you're the only one in frame.";
  if (/distance|too far|too close|match oval/.test(e))
    return "Keep your face centered and filling the oval, then try again.";
  if (/camera|permission|device/.test(e))
    return "We couldn't access your camera. Check permissions and try again.";
  if (/network|connect|server/.test(e))
    return "Connection hiccup — please try again.";
  return "Something interrupted the scan. Please try again.";
}

/**
 * Walk-up attendance kiosk: liveness scan → 1:N identify → log Enter/Exit.
 * No token / no pre-known user. Loops back for the next person.
 */
export function KioskWidget() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const demo = params?.get("demo") ?? null;
  const force = params?.get("force") ?? null; // e.g. ?force=partial → force a manual-review outcome for testing
  const demoResult = (demo && DEMO_RESULTS[demo]) || null;

  const [phase, setPhase] = useState<Phase>(demoResult ? "result" : "prescreen");
  const [region, setRegion] = useState("us-east-1");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<KioskResult | null>(demoResult);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<string>(demoResult ? "Dubai, United Arab Emirates" : "");

  // Resolve the user's location from the browser once, up front.
  useEffect(() => {
    resolveBrowserLocation()
      .then(setLocation)
      .catch(() => setLocation(KIOSK_LOCATION));
  }, []);

  // Tell an embedding host app the kiosk is ready.
  useEffect(() => {
    notifyParent({ type: "ready", surface: "kiosk" });
  }, []);

  // No auto-reset: the kiosk only returns to the start when the user taps
  // Done / Try again (which call reset()).
  function reset() {
    setResult(null);
    setError(null);
    setSessionId(null);
    setPhase("prescreen");
  }

  async function start() {
    setError(null);
    setResult(null);
    setPhase("starting");
    try {
      const s = await api.createKioskSession();
      setSessionId(s.sessionId);
      setRegion(s.region);
      setPhase("scanning");
      notifyParent({ type: "started", surface: "kiosk", mode: "liveness" });
    } catch (err: any) {
      setError(err?.message || "Could not start the scanner.");
      setPhase("error");
      notifyParent({ type: "error", surface: "kiosk", message: String(err?.message || err) });
    }
  }

  async function onComplete() {
    if (!sessionId) return;
    setPhase("identifying");
    try {
      const r = await api.kioskIdentify(sessionId, location, force);
      setResult(r);
      setPhase("result");
      notifyParent({
        type: "result",
        surface: "kiosk",
        verificationId: r.verificationId ?? null,
        recognized: r.recognized,
        verified: !!r.recognized && !r.partial,
        partial: !!r.partial,
        similarity: r.similarity ?? null,
        isLive: r.isLive ?? null,
        displayName: r.subject?.displayName ?? null,
        reason: r.reason ?? null,
      });
    } catch (err: any) {
      setError(err?.message || "Identification failed.");
      setPhase("error");
      notifyParent({ type: "error", surface: "kiosk", message: String(err?.message || err) });
    } finally {
      setSessionId(null);
    }
  }

  function onError(err: unknown) {
    const message =
      (err as any)?.error?.message || (err as any)?.state || "The scan failed or was cancelled.";
    setError(String(message));
    setPhase("error");
    setSessionId(null);
    notifyParent({ type: "error", surface: "kiosk", message: String(message) });
  }

  return (
    <div className="widget">
      <div className="phone">
        <div className="phone-glow" />
        <div className="phone-inner">
          {phase === "prescreen" && <LivenessPrescreen onStart={start} />}

          {phase === "starting" && (
            <div className="liveness-prep">
              <div className="spinner" />
              <p>Preparing secure scan…</p>
            </div>
          )}

          {phase === "scanning" && sessionId && (
            <LivenessScan
              sessionId={sessionId}
              region={region}
              onComplete={onComplete}
              onError={onError}
            />
          )}

          {phase === "identifying" && (
            <div className="center stack pad">
              <div className="spinner" />
              <p className="muted">Identifying…</p>
            </div>
          )}

          {phase === "result" && result && (
            <KioskResultView result={result} location={location} onNext={reset} />
          )}

          {phase === "error" && (
            <div className="success pad">
              <div className="success-top">
                <div className="err-icon" aria-hidden>
                  <svg viewBox="0 0 52 52" width="64" height="64">
                    <circle cx="26" cy="26" r="24" fill="none" stroke="var(--fc-primary)" strokeWidth="2.5" />
                    <path d="M26 14 v16" stroke="var(--fc-primary)" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="26" cy="38" r="2.4" fill="var(--fc-primary)" />
                  </svg>
                </div>
                <h2 className="bad">Let's try that again</h2>
                <p className="muted">{friendlyError(error)}</p>
              </div>
              <button className="primary big cta" onClick={reset}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KioskResultView({
  result,
  location,
  onNext,
}: {
  result: KioskResult;
  location: string;
  onNext: () => void;
}) {
  // Haptic feedback on result (success = soft double, fail = single longer).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(result.recognized ? [35, 30, 55] : 120);
  }, [result.recognized]);

  if (!result.recognized) {
    const kind = classifyFailure(result.reason);
    const screen = FAIL_SCREENS[kind];
    const isReview = kind === "review";
    return (
      <div className="success pad">
        <div className="success-top">
          {isReview ? <ReviewIcon /> : <WarnIcon />}
          <h2 className={isReview ? "review" : "bad"}>{screen.title}</h2>
        </div>
        <div className="fail-reason">
          <span className="fr-label">Reason</span>
          <p className="fr-text">{screen.reason}</p>
        </div>
        <div className={`verify-status ${isReview ? "review" : "fail"}`}>
          Status: {screen.status}
        </div>
        <p className="muted fail-help">{screen.footer}</p>
        <button className="primary big cta" onClick={onNext}>
          {screen.cta}
        </button>
      </div>
    );
  }

  if (result.partial) {
    const sp = result.subject;
    const photoP = result.captureImageUrl || result.referenceImageUrl || undefined;
    const dtP = result.time ? new Date(result.time) : null;
    const confP = result.similarity != null ? `${result.similarity.toFixed(1)}%` : "—";
    const refP = `VER-${ymd(dtP)}-${shortCode(result.verificationId || sp?.displayName || "")}`;
    return (
      <div className="success pad">
        <div className="success-top">
          <ReviewIcon />
          <h2 className="review">Partially Verified</h2>
        </div>
        <div className="avatar-wrap">
          {photoP ? <img className="avatar" src={photoP} alt="" /> : <div className="avatar empty" />}
        </div>
        <div className="success-name">{sp?.displayName ?? "Unknown"}</div>
        <div className="verify-rows">
          <div className="vrow"><span className="vk">Face Match</span><span className="vv">Borderline</span></div>
          <div className="vrow"><span className="vk">Liveness Check</span><span className="vv pass">Passed</span></div>
          <div className="vrow"><span className="vk">Verification Confidence</span><span className="vv">{confP}</span></div>
          <div className="vrow"><span className="vk">Reference ID</span><span className="vv">{refP}</span></div>
          <div className="vrow"><span className="vk">Timestamp</span><span className="vv">{dtP ? fmtTimestamp(dtP) : "—"}</span></div>
          <div className="vrow"><span className="vk">Location</span><span className="vv">{location || "—"}</span></div>
        </div>
        <div className="verify-status review">Status: Pending Manual Review</div>
        <p className="muted fail-help">Your identity needs a quick manual review. A team member will follow up shortly.</p>
        <button className="primary big cta" onClick={onNext}>Done</button>
      </div>
    );
  }

  const s = result.subject;
  const photo = result.captureImageUrl || result.referenceImageUrl || undefined;
  const dt = result.time ? new Date(result.time) : null;

  const faceMatch = result.recognized ? "Passed" : "Failed";
  const liveness = result.isLive === false ? "Failed" : "Passed";
  // "Verification Confidence" = face-match similarity (fall back to liveness).
  const confPct =
    result.similarity != null
      ? result.similarity
      : result.livenessConfidence != null
        ? result.livenessConfidence
        : null;
  const confidence = confPct != null ? `${confPct.toFixed(1)}%` : "—";
  const referenceId = `VER-${ymd(dt)}-${shortCode(result.verificationId || s?.displayName || "")}`;
  const timestamp = dt ? fmtTimestamp(dt) : "—";

  return (
    <div className="success pad">
      <div className="success-top">
        <svg className="check-anim" viewBox="0 0 52 52" aria-hidden>
          <circle className="check-circle" cx="26" cy="26" r="24" fill="none" />
          <path className="check-mark" fill="none" d="M14 27 l8 8 16-18" />
        </svg>
        <h2 className="ok">Customer Verification Complete</h2>
      </div>

      <div className="avatar-wrap">
        {photo ? <img className="avatar" src={photo} alt="" /> : <div className="avatar empty" />}
      </div>
      <div className="success-name">{s?.displayName ?? "Unknown"}</div>

      <div className="verify-rows">
        <div className="vrow"><span className="vk">Face Match</span><span className="vv pass">{faceMatch}</span></div>
        <div className="vrow"><span className="vk">Liveness Check</span><span className={`vv ${liveness === "Passed" ? "pass" : "vfail"}`}>{liveness}</span></div>
        <div className="vrow"><span className="vk">Verification Confidence</span><span className="vv">{confidence}</span></div>
        <div className="vrow"><span className="vk">Reference ID</span><span className="vv">{referenceId}</span></div>
        <div className="vrow"><span className="vk">Timestamp</span><span className="vv">{timestamp}</span></div>
        <div className="vrow"><span className="vk">Location</span><span className="vv">{location || "Locating…"}</span></div>
      </div>

      <div className="verify-status">Identity Successfully Verified</div>

      <button className="primary big cta" onClick={onNext}>
        Done
      </button>
    </div>
  );
}
