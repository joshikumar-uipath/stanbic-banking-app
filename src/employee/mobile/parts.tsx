// Small pieces shared by the phone's screens.
import { useMemo, useState, type ReactNode } from 'react';
import LiveVideo from './LiveVideo';
import { approvalsPulse } from '../../approvalsData';
import { awaitingReview, awaitingAuthorisation } from '../bulk/engine';
import { useNav, useWorkData } from './nav';
import { storyOf, type Lane } from './story';
import { ORB_LIGHT, ORB_DARK } from '../../brandAssets';
import { useConfig } from '../../config';
import { useNk, haptic, MONO, HERO_TINT, greeting, canListen } from './nk';
import { Glyph } from './nkit';

/** The bank's logo, small — the way a banking app signs its home screens. */
export function BankMark({ height = 22 }: { height?: number }) {
  const nk = useNk();
  const b = useConfig().branding;
  const src = nk.dark ? (b.logoLight || b.logo) : b.logo;
  if (!src) return <span style={{ fontSize: 17, fontWeight: 600, color: nk.accent }}>{b.appName}</span>;
  // On a dark page without a light variant, the artwork sits on a small white
  // plate rather than vanishing into the black.
  const plate = nk.dark && !b.logoLight;
  return (
    <span style={plate ? { display: 'inline-flex', background: '#fff', borderRadius: 6, padding: '3px 6px' } : { display: 'inline-flex' }}>
      <img src={src} alt={b.appName} style={{ height: plate ? height - 4 : height, width: 'auto', display: 'block' }} />
    </span>
  );
}

/**
 * The opening of every home: the Aura orb, a greeting, and an ask bar —
 * scan a form, explore, speak, or type a question for Aura.
 */
export function AuraHero({ name, onAsk, onScan, onExplore, compact, strip }: {
  name?: string; onAsk: (q?: string) => void; onScan: () => void; onExplore: () => void;
  /** A smaller orb, for homes whose own number should show without scrolling. */
  compact?: boolean;
  /** Shown under the ask bar (the Recently active strip on the RM's home). */
  strip?: ReactNode;
}) {
  const nk = useNk();
  const tint = nk.dark ? HERO_TINT.dark : HERO_TINT.light;
  const [q, setQ] = useState('');
  const [listening, setListening] = useState(false);
  const speak = () => {
    type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void; onend: () => void; start: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    haptic();
    if (!R) { onAsk(); return; }
    const r = new R();
    r.lang = 'en-NG';
    r.interimResults = false;
    r.onresult = (e) => onAsk(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };
  const iconBtn = { background: nk.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: nk.dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' };
  return (
    <div className="mw-hero-home" style={{ background: `linear-gradient(to bottom, ${tint} 0%, ${tint} 82%, ${nk.page} 100%)` }}>
      <button type="button" className={`mw-orb tap${compact ? ' sm' : ''}`} aria-label="Open Aura" onClick={() => { haptic(); onAsk(); }}>
        <LiveVideo src={nk.dark ? ORB_DARK : ORB_LIGHT} className="mw-orb-v" />
      </button>
      <div className="mw-hero-g">
        <h1 style={{ color: nk.ink }}>{greeting()}{name ? `, ${name}` : ''}</h1>
        <p style={{ color: nk.accent }}>How can I help you today?</p>
      </div>
      <form className="mw-pill" onSubmit={(e) => { e.preventDefault(); haptic(); onAsk(q); setQ(''); }}
        style={{ background: nk.dark ? 'rgba(20,26,34,0.85)' : 'rgba(255,255,255,0.88)', borderColor: nk.dark ? 'rgba(255,255,255,0.12)' : 'rgba(var(--brand-primary-rgb),0.22)' }}>
        <button type="button" className="mw-pill-i tap" style={iconBtn} aria-label="Scan a form" onClick={() => { haptic(); onScan(); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.8 6.2A2.3 2.3 0 0 1 5.2 7.2l-1.1.2A2.1 2.1 0 0 0 2.2 9.6V18a2.2 2.2 0 0 0 2.2 2.2h15.1A2.2 2.2 0 0 0 21.8 18V9.6a2.1 2.1 0 0 0-1.8-2.2l-1.1-.2a2.3 2.3 0 0 1-1.6-1l-.8-1.3a2.2 2.2 0 0 0-1.7-1 49 49 0 0 0-5.2 0 2.2 2.2 0 0 0-1.7 1z" /><circle cx="12" cy="12.8" r="4.5" /></svg>
        </button>
        <button type="button" className="mw-pill-i tap" style={iconBtn} aria-label="Explore" onClick={() => { haptic(); onExplore(); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>
        </button>
{canListen() && (
                <button type="button" className="mw-pill-i tap" aria-label="Speak to Aura" onClick={speak}
          style={listening ? { background: 'var(--nk-red)', color: '#fff' } : iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
        </button>
        )}
        <span className="mw-pill-div" style={{ background: nk.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} aria-hidden />
        <label htmlFor="mw-pill-q" className="sr-only">Ask me anything</label>
        <input id="mw-pill-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask me anything…" autoComplete="off" style={{ color: nk.ink }} />
        <button type="submit" className="mw-pill-go tap" aria-label="Ask Aura" style={{ background: nk.brandFill }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" /></svg>
        </button>
      </form>
      {strip}
    </div>
  );
}

/** What is running behind the work — the automations, named for a bank. */
const ACTIVE: { id: string; name: string; tag: string; video: string; light?: string; scale?: number; lightScale?: number; pos?: string }[] = [
  { id: 'opening', name: 'Account opening', tag: 'Maestro', video: './maestro-card.mp4', scale: 2.5 },
  { id: 'reading', name: 'Form reading', tag: 'Agent', video: './agent-card.mp4', light: './chat-agent-card.mp4', lightScale: 1.15 },
  { id: 'core', name: 'Core banking', tag: 'RPA', video: './rpa-card.mp4', light: './rpa-card-light.mp4', scale: 3.4, lightScale: 1.3, pos: 'center 85%' },
  { id: 'exceptions', name: 'Exceptions', tag: 'Case', video: './case-card.mp4', scale: 1.4 },
  { id: 'kyc', name: 'KYC checks', tag: 'Agent', video: './agent-card.mp4', light: './chat-agent-card.mp4', lightScale: 1.15 },
  { id: 'approvals', name: 'Approvals', tag: 'Delegate', video: './delegate-card.mp4', scale: 1.4 },
  { id: 'bulk', name: 'Bulk opening', tag: 'Maestro', video: './maestro-card.mp4', scale: 2.5 },
  { id: 'signoffs', name: 'Sign-offs', tag: 'Tasks', video: './tasks-card.mp4', scale: 1.2 },
  { id: 'compliance', name: 'Compliance', tag: 'Case', video: './case-card.mp4', scale: 1.4 },
];

type Live = { n: number; what: string; go: () => void };

/** "Recently active": the automations at work on this banker's applications,
 *  each with a live count, drifting past. Tap one to see what it's working on. */
export function RecentlyActive() {
  const nk = useNk();
  const nav = useNav();
  const { branch, batched, batches } = useWorkData();
  const tint = nk.dark ? HERO_TINT.dark : HERO_TINT.light;
  const cards = useMemo(() => {
    const lane = (l: Lane) => branch.filter((c) => storyOf(c).lane === l);
    const today = new Date().toDateString();
    const live: Record<string, Live> = {
      opening: { n: lane('moving').length, what: 'in flight', go: () => nav.push({ k: 'pipeline', lane: 'moving' }) },
      reading: { n: awaitingReview(batched).length, what: 'forms to confirm', go: () => nav.push({ k: 'pipeline', lane: 'you' }) },
      core: { n: branch.filter((c) => c.accountNumber && new Date(c.updatedAt).toDateString() === today).length, what: 'opened today', go: () => nav.push({ k: 'pipeline', lane: 'done' }) },
      exceptions: { n: branch.filter((c) => c.state === 'EXCEPTION').length, what: 'stopped', go: () => nav.push({ k: 'pipeline', lane: 'you' }) },
      kyc: { n: branch.filter((c) => c.state === 'VALIDATION_IN_PROGRESS' || c.state === 'PRE_REGISTERED').length, what: 'running', go: () => nav.push({ k: 'pipeline', lane: 'moving' }) },
      approvals: { n: approvalsPulse().pending, what: 'to sign off', go: () => nav.openApprovals() },
      bulk: { n: batches.length, what: batches.length === 1 ? 'batch' : 'batches', go: () => (batches[0] ? nav.push({ k: 'batch', id: batches[0].id }) : nav.push({ k: 'newBatch' })) },
      signoffs: { n: awaitingAuthorisation(batched).length, what: 'ready to open', go: () => nav.push({ k: 'pipeline', lane: 'moving' }) },
      compliance: { n: branch.filter((c) => c.state === 'COMPLIANCE_HOLD').length, what: 'with Compliance', go: () => nav.push({ k: 'pipeline', lane: 'you' }) },
    };
    return ACTIVE.map((a) => ({ ...a, live: live[a.id] }));
  }, [branch, batched, batches, nav]);
  const items = [...cards, ...cards];
  return (
    <section className="mw-active" aria-label="Recently active">
      <h2 style={{ color: nk.ink }}>Recently active</h2>
      <div className="mw-active-view">
        <span className="mw-active-fade l" style={{ background: `linear-gradient(to right, ${tint}, transparent)` }} aria-hidden />
        <span className="mw-active-fade r" style={{ background: `linear-gradient(to left, ${tint}, transparent)` }} aria-hidden />
        <div className="mw-active-track">
          {items.map((it, i) => {
            const accent = i % 2 === 0 ? 'var(--brand-primary)' : 'var(--brand-secondary, var(--brand-primary))';
            const src = !nk.dark && it.light ? it.light : it.video;
            const scale = !nk.dark && it.light ? it.lightScale ?? 1 : it.scale ?? 1;
            const copy = i >= cards.length;
            return (
              <button key={i} type="button" className="mw-active-card tap" aria-hidden={copy || undefined} tabIndex={copy ? -1 : 0}
                aria-label={copy ? undefined : `${it.name}: ${it.live.n} ${it.live.what}`}
                onClick={() => { haptic(); it.live.go(); }}
                style={{ background: nk.dark ? '#070710' : '#fff', borderColor: nk.dark ? 'rgba(var(--brand-primary-rgb),0.35)' : 'rgba(var(--brand-primary-rgb),0.22)' }}>
                <span className="mw-active-v" style={{ background: nk.dark ? '#070710' : '#F0F1F3' }}>
                  <LiveVideo src={src}
                    style={{ objectFit: !nk.dark && it.light ? 'cover' : 'contain', objectPosition: !nk.dark && it.light ? it.pos ?? 'center' : 'center', transform: `scale(${scale})` }} />
                </span>
                <span className="mw-active-b">
                  <span className="mw-active-n" style={{ color: nk.ink }}>{it.name}</span>
                  <span className="mw-active-c" style={{ color: nk.ink2 }}><span className="mono" style={{ color: nk.ink }}>{it.live.n}</span> {it.live.what}</span>
                  <span className="mw-active-t" style={{ color: nk.dark ? `color-mix(in srgb, ${accent} 45%, #fff)` : `color-mix(in srgb, ${accent} 70%, #000)`, background: `color-mix(in srgb, ${accent} 12%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)` }}>{it.tag}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** A row of the "needs you" kind: who, how long, what happened, and its one fix. */
export function FixRow({ title, age, ageHot, sentence, refId, fix, onFix, onOpen, busy }: {
  title: ReactNode; age?: string; ageHot?: boolean; sentence: ReactNode; refId?: string;
  fix?: string; onFix?: () => void; onOpen: () => void; busy?: boolean;
}) {
  const nk = useNk();
  return (
    <div className="mw-fix" style={{ borderColor: nk.sep }}>
      <button type="button" className="mw-fix-open tap" onClick={() => { haptic(); onOpen(); }}>
        <span className="mw-fix-top">
          <span style={{ fontSize: 16, fontWeight: 500, color: nk.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          {age && <span style={{ fontFamily: MONO, fontSize: 13, color: ageHot ? 'var(--nk-red)' : nk.ink2, flex: '0 0 auto' }}>{age}</span>}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 15, lineHeight: 1.4, color: nk.ink2 }}>{sentence}</span>
      </button>
      <div className="mw-fix-foot">
        <span style={{ fontFamily: MONO, fontSize: 12, color: nk.ink3 }}>{refId}</span>
        <button type="button" className="mw-fix-go tap" disabled={busy} onClick={() => { haptic(); (onFix ?? onOpen)(); }} style={{ color: nk.accent }}>
          {busy ? 'Working…' : fix ?? 'Open'}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

/** A count with its status mark and label, for legends. */
export function LegendRow({ color, n, label }: { color: string; n: number; label: string }) {
  const nk = useNk();
  return (
    <span className="mw-legend-r" style={{ color: nk.ink2 }}>
      <Glyph color={color} />
      <span style={{ fontFamily: MONO, color: nk.ink, minWidth: 22, textAlign: 'right' }}>{n}</span>
      {label}
    </span>
  );
}

/** The pipeline as one stacked bar, each lane drawn in its own mark. */
export function LaneBar({ parts }: { parts: { n: number; color: string }[] }) {
  const nk = useNk();
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (!total) return <div className="mw-lanebar" style={{ background: nk.sep }} aria-hidden />;
  return (
    <div className="mw-lanebar" aria-hidden>
      {parts.filter((p) => p.n > 0).map((p, i) => {
        const style =
          p.color === 'var(--nk-red)' || p.color === 'var(--nk-green)' ? { background: p.color }
          : p.color === 'var(--nk-blue)' ? { border: `1.5px solid ${p.color}`, background: `repeating-linear-gradient(135deg, ${p.color} 0 1.5px, transparent 1.5px 4px)` }
          : { border: `1.5px solid ${p.color}` };
        return <span key={i} style={{ flex: p.n, boxSizing: 'border-box', ...style }} />;
      })}
    </div>
  );
}
