import { useCallback, useEffect, useRef, useState } from 'react';
import { Icn, Avatar, SegBadge } from './customerUi';
import { customers, type Customer } from '../customersData';

// Branch walk-in: opens the live device camera → operator scans the customer's
// ID → verify → match record → open 360. The match is scripted (no real OCR);
// the camera is real. Robust to React StrictMode double-mount and to camera
// being blocked/unavailable (graceful "demo mode" + retry).
const ANIM = '@keyframes scanidLine{0%{top:6%}50%{top:90%}100%{top:6%}}@keyframes scanidPulse{0%,100%{opacity:.55}50%{opacity:1}}';

const ERR_HINT: Record<string, string> = {
  NotAllowedError: 'Permission was blocked — allow camera for this site',
  NotFoundError: 'No camera was found on this device',
  NotReadableError: 'Camera is in use by another app',
  SecurityError: 'Camera needs HTTPS or localhost',
};

export default function ScanId({ onBack, onMatched }: { onBack: () => void; onMatched: (c: Customer) => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const acquiring = useRef(false);
  const mounted = useRef(true);
  const matched = customers.find((c) => c.id === 'sofia') ?? customers[0];

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (acquiring.current || streamRef.current) return; // guard StrictMode/double calls
    acquiring.current = true;
    setCamError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'SecurityError' });
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
      if (!mounted.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      setCamOn(true);
    } catch (e) {
      if (mounted.current) setCamError((e as Error)?.name || 'Camera unavailable');
    } finally {
      acquiring.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    startCamera();
    return () => { mounted.current = false; stopCam(); };
  }, [startCamera, stopCam]);

  const start = () => {
    setPhase('scanning');
    window.setTimeout(() => { setPhase('done'); videoRef.current?.pause(); }, 1900); // freeze the frame on capture
  };

  const fields = [
    { label: 'Document', value: 'National ID' },
    { label: 'Full name', value: matched.name },
    { label: 'ID number', value: matched.maskedId },
    { label: 'Date of birth', value: '14 Mar 1986' },
    { label: 'Document status', value: 'Valid · exp. 2029' },
  ];

  const bw = '2.5px solid var(--brand-primary)';
  const corners = [
    { top: 10, left: 10, borderTop: bw, borderLeft: bw, borderTopLeftRadius: 10 },
    { top: 10, right: 10, borderTop: bw, borderRight: bw, borderTopRightRadius: 10 },
    { bottom: 10, left: 10, borderBottom: bw, borderLeft: bw, borderBottomLeftRadius: 10 },
    { bottom: 10, right: 10, borderBottom: bw, borderRight: bw, borderBottomRightRadius: 10 },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0b1419', position: 'relative', overflow: 'hidden' }}>
      <style>{ANIM}</style>
      {/* Header */}
      <div style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px' }}>
          <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icn name="back" size={20} color="#fff" />
          </button>
          <span className="tracking-tight" style={{ fontWeight: 700, fontSize: 19, color: '#fff' }}>Scan customer ID</span>
        </div>
      </div>

      {/* Viewfinder */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 300, aspectRatio: '1.58 / 1', borderRadius: 18, background: '#05090c', overflow: 'hidden' }}>
          {/* Live camera (always mounted so the stream can attach) */}
          <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: camOn ? 1 : 0, transition: 'opacity .3s' }} />
          {/* Placeholder / fallback faux ID when camera not on */}
          {!camOn && (
            <div style={{ position: 'absolute', inset: 0, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: phase === 'done' ? 0.22 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.5)' }}>NATIONAL ID</span>
                <Icn name="idcard" size={20} color="rgba(255,255,255,0.4)" />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ width: 46, height: 54, borderRadius: 8, background: 'rgba(255,255,255,0.12)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, width: '70%', borderRadius: 4, background: 'rgba(255,255,255,0.18)', marginBottom: 7 }} />
                  <div style={{ height: 6, width: '50%', borderRadius: 4, background: 'rgba(255,255,255,0.12)', marginBottom: 6 }} />
                  <div style={{ height: 6, width: '62%', borderRadius: 4, background: 'rgba(255,255,255,0.12)' }} />
                </div>
              </div>
            </div>
          )}
          {corners.map((c, i) => <span key={i} style={{ position: 'absolute', width: 26, height: 26, ...c }} />)}
          {phase === 'scanning' && <div style={{ position: 'absolute', left: '4%', right: '4%', height: 2, background: 'var(--brand-primary)', boxShadow: '0 0 12px 2px rgba(var(--brand-primary-rgb),0.8)', animation: 'scanidLine 1.9s ease-in-out infinite' }} />}
          {phase === 'done' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,20,25,0.5)' }}>
              <span style={{ width: 52, height: 52, borderRadius: 999, background: '#16A968', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(22,169,104,0.5)' }}><Icn name="check" size={28} color="#fff" strokeWidth={2.6} /></span>
            </div>
          )}
        </div>
        <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', minHeight: 34, maxWidth: 300 }}>
          {phase === 'idle' && !camError && (camOn ? 'Position the customer’s ID within the frame' : 'Starting camera…')}
          {phase === 'idle' && camError && <span style={{ color: '#E0904A' }}>{ERR_HINT[camError] || `Camera unavailable (${camError})`}</span>}
          {phase === 'scanning' && <span style={{ animation: 'scanidPulse 1s infinite' }}>Scanning & verifying…</span>}
          {phase === 'done' && <span style={{ color: '#16A968', fontWeight: 600 }}>Identity verified</span>}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ flexShrink: 0, padding: '0 16px max(env(safe-area-inset-bottom), 16px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phase === 'idle' && camError && (
          <button type="button" onClick={startCamera} style={{ width: '100%', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: 14, fontSize: 14.5, fontWeight: 700, color: '#fff', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <Icn name="camera" size={19} color="#fff" /> Enable camera
          </button>
        )}
        {phase !== 'done' ? (
          <button type="button" onClick={start} disabled={phase === 'scanning'} style={{ width: '100%', border: 'none', borderRadius: 16, padding: 15, fontSize: 15, fontWeight: 700, color: '#fff', cursor: phase === 'scanning' ? 'default' : 'pointer', background: 'var(--brand-primary)', opacity: phase === 'scanning' ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 8px 22px rgba(var(--brand-primary-rgb),0.4)' }}>
            <Icn name="camera" size={20} color="#fff" /> {phase === 'scanning' ? 'Scanning…' : (camError ? 'Scan in demo mode' : 'Scan ID')}
          </button>
        ) : (
          <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 -4px 30px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
              {fields.map((f) => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12.5, color: '#7A8896' }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#11181d', textAlign: 'right' }}>{f.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.18)', marginBottom: 14 }}>
              <Avatar initials={matched.initials} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#11181d' }}>{matched.name}</span>
                  <SegBadge segment={matched.segment} />
                </div>
                <div style={{ fontSize: 12, color: '#16A968', fontWeight: 600, marginTop: 2 }}>✓ Matched · {matched.segment} client since {matched.since}</div>
              </div>
            </div>
            <button type="button" onClick={() => onMatched(matched)} style={{ width: '100%', border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', background: 'var(--brand-primary)', boxShadow: '0 8px 22px rgba(var(--brand-primary-rgb),0.4)' }}>
              Open customer profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
