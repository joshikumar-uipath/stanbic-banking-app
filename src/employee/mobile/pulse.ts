// ─────────────────────────────────────────────────────────────────────────────
// Ask Pulse from inside Aura.
//
// Aura answers what it can from the live record on the phone. Anything else it
// asks the bank's conversational agent (Stanbic_Convo_Agent, "Ask Pulse") and
// shows the reply in the same thread — the banker never leaves the screen.
//
// One conversation per Aura thread, opened on the first question and reused
// for follow-ups so the agent keeps the context. The calls mirror ChatView's:
// create → startSession → wait for Connected → exchange → stream the chunks.
// ─────────────────────────────────────────────────────────────────────────────
import { MessageRole } from '@uipath/uipath-typescript/conversational-agent';
import type { ConversationalAgent, ConversationGetResponse, SessionStream } from '@uipath/uipath-typescript/conversational-agent';
import { findPrimaryAgent } from '../../config/primaryAgent';

const CONNECT_WAIT_MS = 3000;   // sending before the socket is open fails the exchange
const ANSWER_TIMEOUT_MS = 45000;

export interface PulseThread {
  /** Ask a question; `onText` gets the reply so far as it streams. Resolves with the full reply. */
  ask(question: string, onText: (soFar: string) => void): Promise<string>;
  close(): void;
}

// What the banker reads when the agent can't be reached. A network failure or a
// 5xx from the agent service ("Failed to fetch" in the browser) is the service
// being down, not a bad question — say so, rather than echo the raw error.
function plain(e: unknown): Error {
  const err = e instanceof Error ? e : new Error(String(e));
  const status = (err as { statusCode?: number }).statusCode;
  if (err instanceof TypeError || (status !== undefined && status >= 500)) {
    return new Error('Ask Pulse isn’t responding right now — UiPath’s agent service is unavailable. Try again in a moment');
  }
  if (status === 401 || status === 403) return new Error('Ask Pulse turned you away — your sign-in may have expired. Sign in again and retry');
  if (err.message.startsWith('Ask Pulse')) return err;   // ours, already worded for the banker
  return new Error(`Ask Pulse couldn’t answer — ${err.message}`);
}

interface Pending { onChunk: (s: string) => void; done: () => void; fail: (e: Error) => void }

export function pulseThread(ca: ConversationalAgent): PulseThread {
  let opening: Promise<{ conv: ConversationGetResponse; session: SessionStream }> | null = null;
  let closed = false;
  const pending = new Map<string, Pending>();

  const open = async () => {
    const agent = findPrimaryAgent(await ca.getAll());
    if (!agent) throw new Error('Ask Pulse isn’t available on this tenant');
    const conv = await agent.conversations.create({ label: 'Aura · Ask Pulse' });
    const session = conv.startSession({ echo: true });

    session.onAnyErrorStart((err) => {
      const e = new Error(err.message || 'Ask Pulse ran into an error');
      pending.forEach((p) => p.fail(e));
    });
    session.onExchangeStart((exchange) => {
      const p = pending.get(exchange.exchangeId);
      if (!p) return;
      exchange.onMessageStart((message) => {
        if (!message.isAssistant) return;
        message.onContentPartStart((part) => {
          if (part.isMarkdown || part.isText) part.onChunk((c) => { if (c.data) p.onChunk(c.data); });
        });
      });
      exchange.onExchangeEnd(() => p.done());
      exchange.onErrorStart((err) => p.fail(new Error(err.message || 'Ask Pulse ran into an error')));
    });

    // onConnectionStatusChanged only fires on transitions, so read the current
    // status first; past the wait, send anyway (as ChatView does).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = session as any;
    if (s.connectionStatus !== 'Connected') {
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, CONNECT_WAIT_MS);
        s.onConnectionStatusChanged?.((status: string) => { if (status === 'Connected') { window.clearTimeout(t); resolve(); } });
      });
    }
    if (closed) conv.endSession();
    return { conv, session };
  };

  return {
    async ask(question, onText) {
      opening ??= open();
      let session: SessionStream;
      try {
        ({ session } = await opening);
      } catch (e) {
        opening = null;   // let the next question try again
        throw plain(e);
      }
      const exchangeId = `aura-${Date.now()}-${crypto.randomUUID().slice(0, 12)}`;
      return new Promise<string>((resolve, reject) => {
        let text = '';
        const finish = (err?: Error) => {
          window.clearTimeout(timer);
          pending.delete(exchangeId);
          if (err && !text) reject(plain(err)); else resolve(text);
        };
        const timer = window.setTimeout(() => finish(new Error('Ask Pulse didn’t answer in time')), ANSWER_TIMEOUT_MS);
        pending.set(exchangeId, {
          onChunk: (c) => { text += c; onText(text); },
          done: () => finish(),
          fail: (e) => finish(e),
        });
        const message = session.startExchange({ exchangeId }).startMessage({ role: MessageRole.User });
        void message.sendContentPart({ data: question }).then(() => message.sendMessageEnd(), (e) => finish(e as Error));
      });
    },
    close() {
      closed = true;
      pending.clear();
      void opening?.then(({ conv }) => conv.endSession(), () => undefined);
    },
  };
}
