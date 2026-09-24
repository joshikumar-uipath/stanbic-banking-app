// ─────────────────────────────────────────────────────────────────────────────
// CallConfirm — "UiBank is calling you" card, for when the voice agent asks the
// customer to confirm the call is genuine.
//
// The card itself is a page served by the voice service and FRAMED here, the
// way the desk frames the voice page: inside the Power Apps player this app
// cannot fetch anything outside itself, but a frame from another origin can
// poll its own server. The frame polls for a pending confirmation, renders the
// call, a two-digit number and This is me / Not me, and posts the answer straight
// back to the voice service. All this component does is show or hide the slot
// when the frame says so.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { SHADOW } from './theme';

const HOST = ((import.meta.env.VITE_VOICE_AGENT_URL as string | undefined) || 'https://banking-demo-voice-agent.azurewebsites.net').replace(/\/+$/, '');
// The frame reports the card's real height with every state change, so the
// slot is exactly the card and never scrolls, whatever width the phone is.
const FALLBACK_HEIGHT = 300;

export default function CallConfirm() {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only the voice service may drive this slot.
      if (e.origin !== HOST) return;
      const d = e.data as { source?: string; state?: string; height?: number } | null;
      if (!d || d.source !== 'uibank-confirm') return;
      if (typeof d.height === 'number' && d.height > 40) setHeight(d.height);
      setOpen(d.state === 'pending' || d.state === 'answered');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'absolute', left: 12, right: 12, top: 10, zIndex: 60,
        height: open ? height : 0, opacity: open ? 1 : 0,
        transition: 'height .35s cubic-bezier(.2,.7,.2,1), opacity .3s',
        pointerEvents: open ? 'auto' : 'none', overflow: 'hidden',
        borderRadius: 20, boxShadow: open ? SHADOW.lg : 'none',
      }}
    >
      <iframe
        src={`${HOST}/confirm/card`}
        title="Call confirmation"
        scrolling="no"
        style={{ width: '100%', height, border: 0, display: 'block', background: 'transparent', overflow: 'hidden' }}
      />
    </div>
  );
}
