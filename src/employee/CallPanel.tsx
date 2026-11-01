// The call, as a popup on the desk.
//
// It wears the record-details dialog's own shell — `.ad-scrim` / `.ad cx`, the
// brand strip, the footer Close — because to the RM this is the same kind of
// thing: a record you open over the desk, look at, and close. Reusing those
// classes rather than restyling a second dialog is also why it stays in step
// when the desk's chrome changes.
//
// WHY IT IS AN IFRAME AND NOT A COMPONENT
// ---------------------------------------
// This app is a Power Apps code app, served under `connect-src 'none'`. Nothing
// may leave the page — no fetch, no XHR, no WebRTC signalling. So the desk cannot
// place the call itself, however much we would like it to.
//
// The voice service can. It runs the session, and posts everything it learns back
// up: each turn, the call state, the caller's tone, the outcome. The desk renders
// all of that as its own UI, so what the RM sees is the desk's transcript and the
// desk's tone badge — the frame underneath is only an engine.
//
// Whether the frame is allowed is DETECTED, not assumed. The page posts a 'ready'
// as soon as it runs; if that arrives, framing works and the call happens right
// here. A frame refused by CSP fires neither load nor error, so silence for a
// couple of seconds is the only evidence available — and only then does the panel
// offer the call in a tab. An earlier version decided this from the hostname,
// which meant a host that would happily have embedded it never got the chance.
import { useEffect, useMemo, useState } from 'react';
import { Brand } from '../customer/ui';
import { maestroConfig } from '../onboarding/maestro';
import Icon from '../customer/icons';
import './callpanel.css';

const VOICE_HOST = (import.meta.env.VITE_VOICE_AGENT_URL as string | undefined)
  || 'https://banking-demo-voice-agent.azurewebsites.net';

export interface CallSubject {
  reference: string;
  name: string;
  dob?: string;
  phone?: string;
  /** What the case is parked on — decides what the agent chases. The last three
   *  are the calls the case places itself; the popup opens on that call type. */
  hold: 'documents' | 'liveness' | 'review' | 'screening' | 'delay' | 'consent';
}

const HOLD_LABEL: Record<CallSubject['hold'], string> = {
  documents: 'Pending documents',
  liveness: 'Pending liveness',
  review: 'Awaiting review',
  screening: 'Name-collision screening',
  delay: 'Delay notification',
  consent: 'Consent / disclosure',
};

export default function CallPanel({ subject, onClose, tab = 'call' }: { subject: CallSubject; onClose: () => void; tab?: 'call' | 'calls' }) {
  // Only what the desk's own chrome shows. The conversation, the tone and the
  // outcome are the page's to draw now, so the desk no longer mirrors them.
  const [state, setState] = useState('Not started');
  const [live, setLive] = useState(false);
  // null = still finding out. The frame is ALWAYS attempted; we only fall back
  // once it has demonstrably failed to load.
  const [frameOk, setFrameOk] = useState<boolean | null>(null);
  // The directive that actually refused the frame, when the browser tells us.
  // Silence is ambiguous — a slow host looks identical to a blocked one — so a
  // named directive is the difference between a guess and evidence.
  const [violation, setViolation] = useState<string | null>(null);
  // The WHOLE policy, straight off the violation event. Guessing which directives
  // the player sets has cost this feature two wrong diagnoses; the event hands us
  // the real thing, so read it rather than infer it.
  const [policy, setPolicy] = useState<string | null>(null);

  // `view=case` — the page's framed view: this record's call and this
  // applicant's own history, without the customers table or the masthead. The RM
  // already picked the record; re-showing every customer inside the popup they
  // opened from a case row is noise.
  //
  // NOT `embed=1`, which strips the page to a bare call button on the assumption
  // that the desk redraws the conversation itself — that showed a cut-down call
  // in the popup while the same URL in a tab showed the real one.
  //
  // Every parameter comes off the case row the RM opened, so `ref` follows the
  // record and the agent is briefed on the right applicant.
  const url = useMemo(() => {
    const q = new URLSearchParams({
      ref: subject.reference, name: subject.name, hold: subject.hold, view: 'case',
      // Which deployment is asking. The voice service is shared with the
      // Microsoft demo and keeps its calls per REFERENCE, and both demos number
      // their applications AO-2026-0001xx from the same seed — so without this
      // the popup for our AO-2026-000107 played back the other demo's seeded
      // call for its AO-2026-000107, while our desk (reading our own Maestro
      // case) rightly said no call had been placed. The service's watcher
      // already stamps every real call with the Orchestrator folder it came
      // from; sending ours lets the page show only calls from this folder.
      folder: maestroConfig().folderKey,
      // No `bank`: the agent says "I'm calling from your bank". Pass
      // `bank: activeBank().name` to have it name this deployment's bank instead.
    });
    // Straight onto the history for a record whose calls are in the past.
    if (tab === 'calls') q.set('tab', 'calls');
    if (subject.dob) q.set('dob', subject.dob);
    if (subject.phone) q.set('phone', subject.phone);
    return `${VOICE_HOST}/?${q}`;
  }, [subject, tab]);

  // Everything the panel knows comes up the postMessage channel. postMessage is
  // not a network request, so the player's CSP does not touch it.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as Record<string, unknown> | null;
      if (!d || d.source !== 'uibank-voice') return;
      if (d.type === 'ready') {
        setFrameOk(true);
      } else if (d.type === 'state') {
        // The only thing the desk still mirrors: the status pill in its own
        // header. Turn, action, handover, tone and outcome all keep arriving on
        // this channel — the page renders them, so the desk ignores them rather
        // than drawing a second copy a few pixels away.
        setState(String(d.state || ''));
        setLive(d.cls === 'live');
      }
    };
    // A refused frame fires neither load nor error on the element, but the
    // document whose policy blocked it does get `securitypolicyviolation`. That
    // is the only first-hand account of the refusal available to us.
    const onCsp = (ev: SecurityPolicyViolationEvent) => {
      if (!ev.violatedDirective.startsWith('frame-src')) return;
      if (!ev.blockedURI || !VOICE_HOST.includes(new URL(ev.blockedURI).host)) return;
      setViolation(ev.violatedDirective);
      setPolicy(ev.originalPolicy || null);
      setFrameOk(false);
    };
    document.addEventListener('securitypolicyviolation', onCsp);
    window.addEventListener('message', onMsg);
    // A frame refused by CSP fires neither load nor error, so silence is the only
    // evidence available. Two and a half seconds is comfortably longer than a cold
    // App Service response and short enough not to strand the RM.
    const t = window.setTimeout(() => setFrameOk((v) => (v === null ? false : v)), 2500);
    return () => {
      window.removeEventListener('message', onMsg);
      document.removeEventListener('securitypolicyviolation', onCsp);
      window.clearTimeout(t);
    };
  }, []);

  // Escape closes, as it does everywhere else on the desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ad-scrim" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="ad cx cp" role="dialog" aria-modal="true" aria-label={`Call ${subject.name}`}>
        <div className="cx-head">
          <div className="cx-topline">
            <button className="cx-back" onClick={onClose} aria-label="Close">
              <Icon name="arrowLeft" />
            </button>
            <Brand sub="Call" />
            <span className={`ad-pill ${live ? 'progress' : 'pending'}`}>{state}</span>
            <button className="cx-x" onClick={onClose} aria-label="Close" title="Close">
              <Icon name="x" />
            </button>
          </div>
          <h1 className="ad-title">{subject.name}</h1>
          <p className="ad-ref">{subject.reference} · {HOLD_LABEL[subject.hold]}</p>
        </div>

        {/* The page draws the whole call — controls, meter, transcript, tone,
            handover. The desk deliberately no longer redraws any of it: two
            transcripts side by side is not "the same experience", it is two.
            Always mounted, because attempting the frame is the only way to find
            out whether this host allows it. */}
        <div className="cx-body cp-stage">
          <iframe
            className={`cp-engine${frameOk ? '' : ' pending'}`}
            title={`Call ${subject.name}`}
            src={url}
            allow="microphone; autoplay"
          />
          {frameOk === null && <div className="cp-wait">Connecting the call…</div>}
          {frameOk === false && (
            <div className="cp-blocked">
              {violation ? (
                <p><b>This host blocked the call frame.</b> The browser refused it
                  under <code>{violation}</code>, so the call cannot run inside the
                  desk here — no change to this app can lift that. It runs normally
                  in its own tab, and from the desk outside the player.</p>
              ) : (
                <p><b>The call frame did not load.</b> No security violation was
                  reported, so this is more likely the voice service being slow or
                  unreachable than the host refusing it. Try again, or open it
                  separately.</p>
              )}
              <a className="cp-open" href={url} target="_blank" rel="noopener noreferrer">
                Open the call <span aria-hidden="true">↗</span>
              </a>
              {/* What the host actually permits — the only reliable way to tell
                  whether another route exists, rather than assuming none does. */}
              {policy && (
                <details className="cp-csp">
                  <summary>What this host allows</summary>
                  <pre>{policy.split(';').map((d) => d.trim()).filter(Boolean).join('\n')}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="cx-foot">
          <button className="cx-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
