// ─────────────────────────────────────────────────────────────────────────────
// Aura — the bank's assistant, on the phone.
//
// It answers from the same shared record the rest of the app reads, so every
// answer is about real customers and every button does the real thing: retry
// the BVN, send the reminder, open the batch, text the customer. It understands
// the questions a banker asks between appointments (who's stuck on BVN, who's
// waiting on a selfie, how's a batch doing, what's my STP, draft a message to …)
// and finds a customer by name. Anything broader goes to the full agents,
// one tap away in the header.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { OnboardingCase } from '../../../onboarding';
import { useConfig, defaultConfig } from '../../../config';
import { useBank } from '../../../config/bank';
import { opsHealth, incidentsOf } from '../../../ops/opsModel';
import { rerunAll, remindAll, sayTally } from '../actions';
import LiveVideo from '../LiveVideo';
import { ORB_LIGHT, ORB_DARK } from '../../../brandAssets';
import { telHref, smsHref, waHref } from '../links';
import { routeFor } from '../routes';
import type { EmployeeRole } from '../../../config';
import { useNav, useWorkData, type Route } from '../nav';
import { NImmersive, Glyph } from '../nkit';
import { useNk, C, haptic, MONO, canListen, HERO_TINT } from '../nk';
import { storyOf, name } from '../story';
import { Icn } from '../../../components/customerUi';
import { PRIMARY_AGENT_LABEL } from '../../../config/primaryAgent';
import ReactMarkdown from 'react-markdown';
import type { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import { pulseThread, type PulseThread } from '../pulse';
import { readPackage, PACKAGE_TYPE } from '../../../integrations/packageDocs';
import { DOC_TYPE_LABEL, type DocType } from '../../../integrations/docChecks';

interface Row { title: string; sub: string; color: string }
interface Act { label: string; primary?: boolean; run?: () => Promise<string>; href?: string; route?: Route }
interface Draft { to: string; phone: string; text: string }
// `unknown`: Aura's own answerer had nothing — the question goes to Ask Pulse.
// `md`: Ask Pulse's reply (markdown), streamed in place.
// `img`: a photo the banker sent, shown in their bubble.
interface Msg { id: number; who: 'me' | 'aura'; text?: string; img?: string; rows?: Row[]; acts?: Act[]; draft?: Draft; note?: string; unknown?: boolean; md?: string }

// The action on an answer Aura can't give: hand the question to Ask Pulse.
const ASK_AGENT = PRIMARY_AGENT_LABEL;
// The action on a reply Ask Pulse couldn't give: ask it again, here.
const RETRY = 'Try again';

const SUGGEST = ['Who’s stuck on BVN?', 'Who’s waiting on a selfie?', 'Summarise my latest batch', 'What’s our STP this week?'];

const first = (c: OnboardingCase) => c.firstName || name(c).split(' ')[0];
const days = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86400000));

// `conversationalAgent` lets Aura put anything it can't answer itself to the
// bank's agent (Ask Pulse) and show the reply here. `onAskAgent` opens the full
// Ask Pulse chat from the header. Without either, it falls back to `agents`.
export default function Aura({ agents, onAskAgent, conversationalAgent, initial, initialPhoto }: { agents?: ReactNode; onAskAgent?: (question?: string) => void; conversationalAgent?: ConversationalAgent; initial?: string; initialPhoto?: File }) {
  const nav = useNav();
  const nk = useNk();
  const bank = useBank();
  const cfg = useConfig();
  const { all, branch, batches, batched } = useWorkData();
  const mine = nav.role === 'rm' ? branch : all;
  const me = nav.userName && nav.userName !== 'User' ? nav.userName.split(' ')[0] : nav.role === 'rm' ? 'your relationship manager' : 'the account opening team';

  const [text, setText] = useState('');
  const tint = nk.dark ? HERO_TINT.dark : HERO_TINT.light;
  const [thinking, setThinking] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const seq = useRef(3);
  const scroller = useRef<HTMLDivElement>(null);

  const target = (cfg.operations ?? defaultConfig.operations!).stpTarget;
  const answerer = useMemo(() => makeAnswerer({ mine, all, batches, batched, target, me, bank: bank.name, role: nav.role }), [mine, all, batches, batched, target, me, bank.name, nav.role]);
  // A question asked from a home's ask bar arrives already answered — or, if
  // only Ask Pulse can answer it, already on its way there (effect below).
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (!initial) return [];
    const a = answerer(initial);
    return a.unknown && conversationalAgent ? [{ id: 1, who: 'me', text: initial }] : [{ id: 1, who: 'me', text: initial }, { id: 2, who: 'aura', ...a }];
  });

  // Ask Pulse, in this thread. Returns false when there's no agent to ask.
  const thread = useRef<PulseThread | null>(null);
  const askPulse = (q: string) => {
    if (!conversationalAgent) return false;
    const id = seq.current++;
    const patch = (p: Partial<Msg>) => setMsgs((ms) => ms.map((x) => (x.id === id ? { ...x, ...p } : x)));
    setMsgs((ms) => [...ms, { id, who: 'aura', md: '' }]);
    setThinking(true);
    thread.current ??= pulseThread(conversationalAgent);
    thread.current.ask(q, (soFar) => { setThinking(false); patch({ md: soFar }); })
      .then((full) => { if (!full.trim()) patch({ md: undefined, text: 'Ask Pulse had no answer to that.' }); })
      .catch((e: Error) => patch({ md: undefined, text: `${e.message}.`, acts: [{ label: RETRY }] }))
      .finally(() => setThinking(false));
    return true;
  };
  useEffect(() => {
    if (!initial || !conversationalAgent || !answerer(initial).unknown) return;
    const t = window.setTimeout(() => askPulse(initial), 0);   // cancellable, so StrictMode's double run asks once
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { thread.current?.close(); thread.current = null; }, []);
  // The banker's question an answer replies to, so Ask Pulse gets it verbatim.
  const questionFor = (m: Msg) => {
    const i = msgs.findIndex((x) => x.id === m.id);
    const q = i > 0 ? msgs[i - 1] : undefined;
    return q?.who === 'me' ? q.text : undefined;
  };
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [msgs, thinking]);

  const ask = (q: string) => {
    const t = q.trim();
    if (!t) return;
    haptic();
    setText('');
    setMsgs((m) => [...m, { id: seq.current++, who: 'me', text: t }]);
    setThinking(true);
    window.setTimeout(() => {
      const a = answerer(t);
      if (a.unknown && askPulse(t)) return;
      setThinking(false);
      setMsgs((m) => [...m, { id: seq.current++, who: 'aura', ...a }]);
    }, 450);
  };

  // A photo (or file) from the camera button — here or on Home. Aura reads it with
  // the same pipeline the application uses: identifies the document, reads a known
  // form's fields, and offers the next step.
  const camRef = useRef<HTMLInputElement>(null);
  const attach = async (file: File) => {
    haptic();
    const img = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setMsgs((m) => [...m, { id: seq.current++, who: 'me', text: img ? undefined : file.name, img }]);
    setThinking(true);
    try {
      const r = await readPackage([file]);
      const f = r.files[0];
      const facts = f?.facts;
      const pkgLabel = f && f.type !== 'unknown' ? (PACKAGE_TYPE as Record<string, { label: string }>)[f.type]?.label : undefined;
      const factLabel = facts && facts.t !== 'unknown' ? DOC_TYPE_LABEL[facts.t as DocType] : undefined;
      const label = pkgLabel ?? factLabel;
      const a: Partial<Msg> = {};
      if (f && f.fields.length > 0) {
        const who = r.rows.find((x) => /company|business name/i.test(x.name))?.value ?? r.rows.find((x) => /^(first name|surname|last name|full name)$/i.test(x.name))?.value;
        a.text = `That's ${label ? `the ${label.toLowerCase()}` : 'an account opening form'}${who ? ` for ${who}` : ''} — I read ${f.fields.length} fields across ${f.pages} page${f.pages === 1 ? '' : 's'}.`;
        a.rows = r.rows.slice(0, 4).map((x) => ({ title: x.value || '—', sub: x.name, color: x.confidence >= 0.8 ? C.green : C.orange }));
        a.note = 'Open a new application and upload the same file to fill it in; the fields keep their confidence so a maker can check the doubtful ones.';
        a.acts = [{ label: 'Open a new application', primary: true, route: { k: 'capture' } }];
      } else if (label) {
        a.text = `This looks like ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}.`;
        const rows: Row[] = [];
        if (facts?.n) rows.push({ title: `•••• ${String(facts.n).slice(-4)}`, sub: 'Document number', color: C.blue });
        if (facts?.x) rows.push({ title: facts.x, sub: new Date(facts.x) < new Date() ? 'Expired' : 'Valid until', color: new Date(facts.x) < new Date() ? C.red : C.green });
        if (facts?.mrz !== undefined) rows.push({ title: facts.mrz ? 'Check digits verify' : 'Check digits do not verify', sub: 'Machine-readable zone', color: facts.mrz ? C.green : C.red });
        if (facts?.e) rows.push({ title: 'Saved by an editing tool', sub: facts.p ?? 'Producer', color: C.orange });
        a.rows = rows;
        a.note = rows.length ? undefined : 'Nothing else could be read off it in the browser; the full checks run once it is attached to an application.';
        a.acts = [{ label: 'Find the customer', primary: true, route: { k: 'find' } }, { label: 'Open a new application', route: { k: 'capture' } }];
      } else {
        a.text = "I couldn't tell what this document is. Try a sharper photo with the whole page in frame, or tell me who it belongs to.";
      }
      setMsgs((m) => [...m, { id: seq.current++, who: 'aura', ...a }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: seq.current++, who: 'aura', text: `I couldn't read that file — ${(e as Error).message || 'it may be damaged'}.` }]);
    } finally { setThinking(false); }
  };
  useEffect(() => {
    if (!initialPhoto) return;
    const t = window.setTimeout(() => { void attach(initialPhoto); }, 0);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (m: Msg, a: Act) => {
    if (a.route) { nav.open(a.route); return; }
    if (!a.run) return;
    const key = `${m.id}:${a.label}`;
    setBusy(key);
    try {
      const said = await a.run();
      haptic('success');
      setMsgs((ms) => [...ms, { id: seq.current++, who: 'aura', text: `${said}.` }]);
    } catch (e) {
      haptic('warn');
      setMsgs((ms) => [...ms, { id: seq.current++, who: 'aura', text: `That didn’t work — ${(e as Error).message || 'nothing was changed'}.` }]);
    } finally { setBusy(null); }
  };

  const listen = () => {
    type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void; onend: () => void; start: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = 'en-NG';
    r.interimResults = false;
    r.onresult = (e) => { const said = e.results[0][0].transcript; setText(said); ask(said); };
    r.onend = () => setListening(false);
    setListening(true);
    haptic();
    r.start();
  };

  return (
    <div className="nk-screen" style={{ background: nk.page, color: nk.ink, ['--sep' as string]: nk.sep }}>
      <header className="mw-aura-h" style={{ borderColor: nk.sep }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mw-aura-orb"><LiveVideo src="./chat-orb.mp4" /></span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 17, fontWeight: 600, lineHeight: '20px' }}>Aura</span>
            <span style={{ fontSize: 12, color: nk.ink3 }}>{bank.name} assistant</span>
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {onAskAgent
            ? <button type="button" className="nk-link" style={{ color: nk.accent, padding: '0 10px' }} onClick={() => { haptic(); onAskAgent(); }}>{PRIMARY_AGENT_LABEL}</button>
            : agents && <button type="button" className="nk-link" style={{ color: nk.accent, padding: '0 10px' }} onClick={() => { haptic(); setAgentsOpen(true); }}>Agents</button>}
          <button type="button" className="nk-navbtn" aria-label="New conversation" style={{ color: nk.accent }} onClick={() => { haptic(); thread.current?.close(); thread.current = null; setThinking(false); setMsgs([]); }}>
            <Icn name="pen" size={20} strokeWidth={1.6} />
          </button>
        </span>
      </header>

      <div ref={scroller} className="mw-aura-scroll" role="log" aria-live="polite" aria-label="Conversation with Aura">
        {msgs.length === 0 && (
          <div className="mw-aura-empty">
            {/* The orb, as on Home — Aura's face before the conversation starts. */}
            <div className="mw-aura-hero" style={{ background: `linear-gradient(to bottom, ${nk.page} 0%, ${tint} 18%, ${tint} 78%, ${nk.page} 100%)` }} aria-hidden>
              <LiveVideo src={nk.dark ? ORB_DARK : ORB_LIGHT} className="mw-orb-v" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: nk.ink3 }}>Ask about your work</div>
            <p style={{ margin: '6px 0 0', fontSize: 20, lineHeight: 1.35, fontWeight: 500, letterSpacing: '-0.01em' }}>
              A customer, a batch, or your queue — I answer from the live record, and I can do the next step for you.
            </p>
          </div>
        )}
        {msgs.map((m) => m.who === 'me'
          ? <div key={m.id} className={`mw-aura-me${m.img ? ' has-img' : ''}`} style={{ background: nk.brandFill }}>{m.img && <img src={m.img} alt="Photo sent to Aura" />}{m.text}</div>
          : (
            m.md === '' && !m.text ? null : <div key={m.id} className="mw-aura-a">
              {m.md && (
                <>
                  <span className="mw-aura-src" style={{ color: nk.ink3, fontFamily: MONO }}>{PRIMARY_AGENT_LABEL}</span>
                  <div className="mw-aura-md"><ReactMarkdown>{m.md}</ReactMarkdown></div>
                </>
              )}
              {m.text && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>{m.text}</p>}
              {m.rows && m.rows.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {m.rows.map((r, i) => (
                    <div key={i} className="mw-aura-row" style={{ borderColor: nk.sep }}>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{r.title}</span>
                        <span style={{ fontSize: 13, color: nk.ink2 }}>{r.sub}</span>
                      </span>
                      <Glyph color={r.color} />
                    </div>
                  ))}
                </div>
              )}
              {m.note && <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.45, color: nk.ink2 }}>{m.note}</p>}
              {m.draft && <DraftCard draft={m.draft} />}
              {m.acts && m.acts.length > 0 && (
                <div className="mw-aura-acts">
                  {m.acts.filter((a) => onAskAgent || agents || a.label !== ASK_AGENT).map((a) => a.href
                    ? <a key={a.label} className="mw-obtn tap" href={a.href} style={{ color: nk.accent, borderColor: nk.line }}>{a.label}</a>
                    : <button key={a.label} type="button" className="mw-obtn tap" disabled={busy === `${m.id}:${a.label}`}
                        style={a.primary ? { background: nk.brandFill, color: '#fff', borderColor: 'transparent' } : { color: nk.accent, borderColor: nk.line, background: nk.page }}
                        onClick={() => {
                          haptic();
                          if (a.label === ASK_AGENT) {
                            if (onAskAgent) onAskAgent(questionFor(m));
                            else setAgentsOpen(true);
                            return;
                          }
                          if (a.label === RETRY) {
                            const q = questionFor(m);
                            setMsgs((ms) => ms.filter((x) => x.id !== m.id));
                            if (q) askPulse(q);
                            return;
                          }
                          void run(m, a);
                        }}>
                        {busy === `${m.id}:${a.label}` ? 'Working…' : a.label}
                      </button>)}
                </div>
              )}
            </div>
          ))}
        {thinking && <div className="mw-aura-typing" aria-label="Aura is answering"><i style={{ background: nk.ink3 }} /><i style={{ background: nk.ink3 }} /><i style={{ background: nk.ink3 }} /></div>}
      </div>

      <div className="mw-aura-sugg" aria-label="Suggestions">
        {SUGGEST.map((s) => (
          <button key={s} type="button" className="mw-aura-chip tap" style={{ color: nk.accent, borderColor: nk.sep, background: nk.page }} onClick={() => ask(s)}>{s}</button>
        ))}
      </div>
      <form className="mw-aura-in" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input ref={camRef} type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attach(f); }} />
        <button type="button" className="mw-aura-mic tap" aria-label="Take a photo or add a file" onClick={() => camRef.current?.click()} style={{ color: nk.accent, background: nk.page, borderColor: nk.sep }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.8 6.2A2.3 2.3 0 0 1 5.2 7.2l-1.1.2A2.1 2.1 0 0 0 2.2 9.6V18a2.2 2.2 0 0 0 2.2 2.2h15.1A2.2 2.2 0 0 0 21.8 18V9.6a2.1 2.1 0 0 0-1.8-2.2l-1.1-.2a2.3 2.3 0 0 1-1.6-1l-.8-1.3a2.2 2.2 0 0 0-1.7-1 49 49 0 0 0-5.2 0 2.2 2.2 0 0 0-1.7 1z" /><circle cx="12" cy="12.8" r="4.5" /></svg>
        </button>
        <label htmlFor="aura-ask" className="sr-only">Ask Aura</label>
        <input id="aura-ask" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about a customer or a batch" autoComplete="off"
          style={{ background: nk.fill, color: nk.ink }} />
        {text.trim()
          ? <button type="submit" className="mw-aura-mic tap" aria-label="Send" style={{ background: nk.brandFill, color: '#fff', borderColor: 'transparent' }}><Icn name="arrow" size={20} strokeWidth={1.8} /></button>
          : canListen() && <button type="button" className="mw-aura-mic tap" aria-label="Speak to Aura" onClick={listen} style={{ color: listening ? '#fff' : nk.accent, background: listening ? C.red : nk.page, borderColor: nk.sep }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
            </button>}
      </form>

      {agentsOpen && agents && (
        <NImmersive>
          <div className="nk-screen" style={{ background: nk.page }}>
            <div className="nk-nav" style={{ background: nk.page, borderColor: nk.sep }}>
              <div className="nk-nav-l"><button type="button" className="nk-back" style={{ color: nk.accent }} onClick={() => setAgentsOpen(false)}><Icn name="back" size={22} strokeWidth={1.8} /><span>Aura</span></button></div>
              <div className="nk-nav-t">Agents</div><div />
            </div>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{agents}</div>
          </div>
        </NImmersive>
      )}
    </div>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const nk = useNk();
  const [body, setBody] = useState(draft.text);
  const [edit, setEdit] = useState(false);
  const parts = Math.max(1, Math.ceil(body.length / 153));
  return (
    <div className="nk-card" style={{ marginTop: 10, padding: 14, borderColor: nk.sep, background: nk.page }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: nk.ink3 }}>Draft SMS · {draft.to}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: nk.ink3 }}>{parts} part{parts === 1 ? '' : 's'}</span>
      </div>
      {edit
        ? <textarea value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" rows={5}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, border: 'none', borderRadius: 10, padding: 10, fontSize: 15, lineHeight: 1.45, background: nk.fill, color: nk.ink, fontFamily: 'inherit', resize: 'vertical' }} />
        : <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.45 }}>{body}</p>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        {smsHref(draft.phone, body) && <a className="mw-obtn tap" style={{ flex: 1, background: nk.brandFill, color: '#fff', borderColor: 'transparent', justifyContent: 'center' }}
          href={smsHref(draft.phone, body)} onClick={() => haptic('success')}>Send by SMS</a>}
        {waHref(draft.phone, body) && <a className="mw-obtn tap" style={{ color: nk.accent, borderColor: nk.line }} href={waHref(draft.phone, body)} target="_blank" rel="noreferrer">WhatsApp</a>}
        {!draft.phone && <span style={{ flex: 1, fontSize: 13, color: nk.ink2 }}>No phone number on file — copy the message instead.</span>}
        <button type="button" className="nk-link" style={{ color: nk.accent, padding: '0 6px' }} onClick={() => { haptic(); setEdit((e) => !e); }}>{edit ? 'Done' : 'Edit'}</button>
      </div>
    </div>
  );
}

// ── The answers ──────────────────────────────────────────────────────────────
function makeAnswerer(ctx: {
  mine: OnboardingCase[]; all: OnboardingCase[]; batches: { id: string; name: string; createdAt: string }[]; batched: OnboardingCase[];
  target: number; me: string; bank: string; role: string;
}) {
  const { mine, all, batches, batched, target, me, bank } = ctx;
  const open = (c: OnboardingCase): Route => routeFor(ctx.role as EmployeeRole, c);

  const findByName = (q: string): OnboardingCase | undefined => {
    const words = q.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    let best: { c: OnboardingCase; n: number } | undefined;
    // Only the banker's own customers (Operations works the whole bank).
    for (const c of mine) {
      const nm = name(c).toLowerCase();
      const n = words.filter((w) => nm.split(/\s+/).includes(w)).length;
      if (n && (!best || n > best.n || (n === best.n && c.updatedAt > best.c.updatedAt))) best = { c, n };
    }
    return best?.c;
  };

  return (q: string): Omit<Msg, 'id' | 'who'> => {
    const s = q.toLowerCase();

    if (/\b(draft|message|text|sms|write to)\b/.test(s)) {
      const c = findByName(q);
      if (!c) return { text: 'Who should I write to? Give me the customer’s name — for example, “Draft a message to Fatima Adeyemi”.' };
      const st = storyOf(c);
      const bvn = c.validations.find((v) => v.kind === 'BVN' && (v.status === 'failed' || v.status === 'timeout'));
      const body =
        bvn ? `Hello ${first(c)}, this is ${me} from ${bank}. We couldn't verify your BVN on your account application (${c.id}). Could you confirm the 11 digits, or reply with a photo of your BVN slip? Thank you.`
        : c.state === 'PENDING_LIVENESS' ? `Hello ${first(c)}, this is ${me} from ${bank}. Your account is nearly ready — we just need a quick selfie to confirm it's you. Please open the link we sent you. Thank you.`
        : c.state === 'PENDING_DOCUMENTS' ? `Hello ${first(c)}, this is ${me} from ${bank}. To finish opening your account we still need a recent utility bill. You can upload it from the link we sent you. Thank you.`
        : c.accountNumber ? `Hello ${first(c)}, this is ${me} from ${bank}. Good news — your account is open and ready to use. Your account number is in the app and on your welcome email. Welcome to ${bank}.`
        : `Hello ${first(c)}, this is ${me} from ${bank}. Just letting you know your account application (${c.id}) is in progress — ${st.sentence.charAt(0).toLowerCase()}${st.sentence.slice(1)}`;
      return { text: `Here's a message for ${name(c)}.`, draft: { to: name(c), phone: c.phone, text: body } };
    }

    if (/\bbvn\b|nibss/.test(s) || (/stuck/.test(s) && !/\bnin\b|selfie|liveness/.test(s))) {
      const cs = mine.filter((c) => c.validations.some((v) => v.kind === 'BVN' && (v.status === 'failed' || v.status === 'timeout')));
      if (!cs.length) return { text: 'No one is stuck at the BVN check right now.' };
      const rows = cs.slice(0, 6).map((c) => {
        const v = c.validations.find((x) => x.kind === 'BVN')!;
        return { title: name(c), sub: v.status === 'timeout' ? 'NIBSS timed out — will retry' : `${v.attempts} failed attempt${v.attempts === 1 ? '' : 's'}`, color: v.status === 'timeout' ? C.blue : C.red };
      });
      const top = cs[0];
      return {
        text: `${cs.length === 1 ? 'One is' : `${cs.length} are`} stuck at the BVN check:`, rows,
        note: cs.length > 6 ? `And ${cs.length - 6} more.` : undefined,
        acts: [
          { label: cs.length === 1 ? 'Re-run it' : `Re-run all ${cs.length}`, primary: true, run: async () => sayTally(await rerunAll(cs.map((c) => c.id), 'BVN'), 'BVN check') },
          ...(telHref(top.phone) ? [{ label: `Call ${first(top)}`, href: telHref(top.phone) }] : []),
        ],
      };
    }

    if (/selfie|liveness|face/.test(s)) {
      const cs = mine.filter((c) => c.state === 'PENDING_LIVENESS' || c.validations.some((v) => v.kind === 'LIVENESS' && (v.status === 'failed' || v.status === 'timeout')));
      if (!cs.length) return { text: 'Nobody is waiting on a selfie.' };
      return {
        text: `${cs.length === 1 ? 'One customer is' : `${cs.length} customers are`} waiting on a selfie:`,
        rows: cs.slice(0, 6).map((c) => ({ title: name(c), sub: days(c.updatedAt) ? `${days(c.updatedAt)} day${days(c.updatedAt) === 1 ? '' : 's'} waiting` : 'Waiting since today', color: C.orange })),
        acts: [{ label: cs.length === 1 ? 'Log a reminder' : `Log reminders for all ${cs.length}`, primary: true, run: async () => `${sayTally(await remindAll(cs.map((c) => c.id)), 'reminder')} — not sent in this demo` }],
      };
    }

    if (/batch|bulk|summar/.test(s)) {
      const named = batches.find((b) => s.includes(b.name.toLowerCase().split(/[\s—-]+/)[0]));
      const b = named ?? batches[0];
      if (!b) return { text: 'You have no batches yet. Start one from Home → Many at once.' };
      const rows = batched.filter((c) => c.batchId === b.id);
      const openN = rows.filter((c) => !!c.accountNumber).length;
      const closed = rows.filter((c) => c.state === 'DECLINED').length;
      const you = rows.filter((c) => storyOf(c).lane === 'you').length;
      const decided = openN + closed;
      return {
        text: `${b.name}: ${decided} of ${rows.length} decided.`,
        rows: [
          { title: `${openN} opened`, sub: 'Accounts live', color: C.green },
          { title: `${you} need${you === 1 ? 's' : ''} you`, sub: 'A person has to act', color: C.red },
          { title: `${rows.length - decided - you} moving on their own`, sub: 'Checks running or with Operations', color: C.blue },
          ...(closed ? [{ title: `${closed} declined`, sub: 'Closed', color: C.gray }] : []),
        ],
        acts: [{ label: 'Open the batch', primary: true, route: { k: 'batch', id: b.id } }],
      };
    }

    if (/\bstp\b|straight[- ]through|\brate\b/.test(s)) {
      const h = opsHealth(all, target);
      const inc = incidentsOf(all)[0];
      return {
        text: `Straight-through is ${h.stp}% against a target of ${h.target}% — ${h.stp >= h.target ? `${h.stp - h.target} points ahead` : `${h.target - h.stp} points short`}.`,
        note: inc ? `The biggest cause of exceptions is “${inc.meta.title}” (${inc.cases.length} case${inc.cases.length === 1 ? '' : 's'}).` : undefined,
        rows: [
          { title: `${h.open} open exceptions`, sub: `${h.breaching} past SLA`, color: C.red },
          { title: `${h.unassigned} unassigned`, sub: 'Waiting for an owner', color: C.orange },
        ],
      };
    }

    if (/need|today|todo|to do|what should|queue|urgent/.test(s)) {
      const cs = mine.filter((c) => storyOf(c).lane === 'you').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      if (!cs.length) return { text: 'Nothing needs you right now.' };
      return {
        text: `${cs.length} need${cs.length === 1 ? 's' : ''} you. Oldest first:`,
        rows: cs.slice(0, 5).map((c) => ({ title: name(c), sub: storyOf(c).sentence, color: storyOf(c).color })),
        acts: [{ label: `Open ${first(cs[0])}`, primary: true, route: open(cs[0]) }],
      };
    }

    const c = findByName(q);
    if (c) {
      const st = storyOf(c);
      return {
        text: `${name(c)} · ${c.id}`,
        rows: [{ title: st.label, sub: st.sentence, color: st.color }],
        acts: [
          { label: 'Open', primary: true, route: open(c) },
          ...(telHref(c.phone) ? [{ label: 'Call', href: telHref(c.phone) }] : []),
        ],
      };
    }

    return {
      text: 'I can answer from your pipeline — who’s stuck on BVN, who’s waiting on a selfie, how a batch is doing, your STP, or anything about a customer by name. I can also draft a message to a customer.',
      acts: [{ label: ASK_AGENT }],
      unknown: true,
    };
  };
}
