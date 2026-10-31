import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../contexts/ThemeContext';
import { CHIP_TRANSLATIONS } from '../i18n/translations';
import { ConversationalAgent, MessageRole } from '@uipath/uipath-typescript/conversational-agent';
import type {
  AgentGetResponse,
  ConversationGetResponse,
  SessionStream,
} from '@uipath/uipath-typescript/conversational-agent';
import { useVideoBlob } from '../utils/useVideoBlob';
import { useConfig } from '../config';
import { agentLabel, isPrimaryAgent, PRIMARY_AGENT_LABEL } from '../config/primaryAgent';
import VideoEl from './VideoEl';
import type { AgentRunContext } from '../types';
import { CHAT_ORB_LIGHT, CHAT_ORB_DARK } from '../brandAssets';

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  fromVoice?: boolean;
  imageUrl?: string;
}

interface Props {
  agent: AgentGetResponse;
  conversationalAgent: ConversationalAgent;
  onBack: () => void;
  onSwitchAgent: (agent: AgentGetResponse) => void;
  conversationId?: string;
  context?: AgentRunContext;
}

const GENERIC = ['agent', 'assistant', 'bot', 'ai'];
function getDisplayName(a: AgentGetResponse): string {
  if (isPrimaryAgent(a)) return PRIMARY_AGENT_LABEL;
  const raw = a.name.trim();
  if (!GENERIC.includes(raw.toLowerCase()) && raw.length > 0) return raw;
  if (!a.processKey) return raw;
  const parts = a.processKey.split('.');
  const useful = parts.filter(p => !GENERIC.includes(p.toLowerCase()) && p.length > 2);
  if (useful.length === 0) return raw;
  const first = useful[0], last = useful[useful.length - 1];
  return (first === last ? first : `${first} · ${last}`).replace(/_/g, ' ');
}

type Chip = { label: string; icon: React.ReactNode };

const CHIP_ICONS = {
  search:   <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  list:     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  alert:    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  chart:    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  person:   <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  money:    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  box:      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  chat:     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
  doc:      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
};

const CATEGORY_ICONS: Record<string, React.ReactNode[]> = {
  default:  [CHIP_ICONS.chat,  CHIP_ICONS.list,  CHIP_ICONS.doc,    CHIP_ICONS.search, CHIP_ICONS.chart,  CHIP_ICONS.alert],
  invoice:  [CHIP_ICONS.list,  CHIP_ICONS.alert, CHIP_ICONS.chart,  CHIP_ICONS.search, CHIP_ICONS.money,  CHIP_ICONS.alert],
  claim:    [CHIP_ICONS.list,  CHIP_ICONS.alert, CHIP_ICONS.chart,  CHIP_ICONS.search, CHIP_ICONS.doc,    CHIP_ICONS.alert],
  hr:       [CHIP_ICONS.list,  CHIP_ICONS.person,CHIP_ICONS.doc,    CHIP_ICONS.chart,  CHIP_ICONS.search, CHIP_ICONS.list],
  supply:   [CHIP_ICONS.alert, CHIP_ICONS.box,   CHIP_ICONS.search, CHIP_ICONS.chart,  CHIP_ICONS.alert,  CHIP_ICONS.list],
  kcb:      [CHIP_ICONS.list,  CHIP_ICONS.alert, CHIP_ICONS.chat,   CHIP_ICONS.money,  CHIP_ICONS.search, CHIP_ICONS.person],
  customer: [CHIP_ICONS.list,  CHIP_ICONS.alert, CHIP_ICONS.chart,  CHIP_ICONS.search, CHIP_ICONS.doc,    CHIP_ICONS.chat],
};

function buildChips(lang: string, category: string): Chip[] {
  const labels = (CHIP_TRANSLATIONS[lang] ?? CHIP_TRANSLATIONS['en'])[category as keyof typeof CHIP_TRANSLATIONS['en']];
  const icons = CATEGORY_ICONS[category];
  return labels.map((label, i) => ({ label, icon: icons[i] }));
}

function getAgentChips(agent: AgentGetResponse, lang: string): Chip[] {
  const key = (agent.name + ' ' + (agent.processKey ?? '')).toLowerCase();
  if (key.includes('invoice') || key.includes('finance') || key.includes('payment')) return buildChips(lang, 'invoice');
  if (key.includes('claim') || key.includes('adjuster') || key.includes('insurance')) return buildChips(lang, 'claim');
  if (key.includes('hr') || key.includes('talent') || key.includes('recruit') || key.includes('onboard')) return buildChips(lang, 'hr');
  if (key.includes('supply') || key.includes('inventory') || key.includes('warehouse') || key.includes('logistics')) return buildChips(lang, 'supply');
  if (key.includes('kcb') || key.includes('bank') || key.includes('loan') || key.includes('transaction')) return buildChips(lang, 'kcb');
  if (key.includes('customer') || key.includes('support') || key.includes('ticket') || key.includes('service')) return buildChips(lang, 'customer');
  return buildChips(lang, 'default');
}

function MiniOrb({ size = 28 }: { size?: number }) {
  const { t, theme } = useTheme();
  const src = theme === 'light' ? CHAT_ORB_LIGHT : CHAT_ORB_DARK;
  const blobSrc = useVideoBlob(src);
  return (
    <video
      src={blobSrc}
      key={blobSrc}
      autoPlay loop muted playsInline
      preload="auto"
      className="flex-shrink-0"
      style={{ width: size, height: size, objectFit: 'contain', mixBlendMode: t.orbBlend, opacity: 0, transition: 'opacity 0.3s ease' }}
      onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
    />
  );
}

function buildContextPreFill(ctx: AgentRunContext): string {
  if (ctx.prefill) return ctx.prefill;
  if (ctx.reviewItems.length > 0) {
    const first = ctx.reviewItems[0];
    const ref = first.ref ? `${first.ref}${first.amount ? ` (${first.amount})` : ''}` : '';
    return ref
      ? `I need your advice on ${ref} — ${first.text} What do you recommend?`
      : `I need help deciding on this: ${first.text} What do you recommend?`;
  }
  return `Walk me through what you processed in this run — ${ctx.summary}`;
}

export default function ChatView({ agent, conversationalAgent, onBack, onSwitchAgent, conversationId: existingConversationId, context }: Props) {
  const { theme, t, tr, lang } = useTheme();
  const { agents: agentsConfig } = useConfig();
  const isLight = theme === 'light';
  const chatOrbBlobSrc = useVideoBlob(isLight ? CHAT_ORB_LIGHT : CHAT_ORB_DARK);
  // Agent display-name override sourced from config so admins can rename
  // agents shown in the header / dropdown without redeploying.
  const getAgentDisplayName = (a: AgentGetResponse) => agentLabel(a, agentsConfig.displayNameOverrides);
  const agentDisplayName = getAgentDisplayName(agent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Voice prefill is sent directly (see auto-send effect below) so we don't
  // populate the input — only non-voice context-derived prefills go in the box.
  const [input, setInput] = useState(() => context && !existingConversationId && !context.prefill ? buildContextPreFill(context) : '');
  const [contextDismissed, setContextDismissed] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [allAgents, setAllAgents] = useState<AgentGetResponse[]>([]);
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null);
  const [copied, setCopied] = useState(false);
  const [isVoiceInput, setIsVoiceInput] = useState(() => !!(context?.prefill) && context?.prefillVoice !== false);
  const [showCamera, setShowCamera] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; snippet: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      // In dev, vite proxies /serper-search/* to google.serper.dev and injects
      // the API key. In prod (static SPA on UiPath Apps), no proxy — call
      // Serper directly with the key from VITE_SERPER_API_KEY.
      const isDev = import.meta.env.DEV;
      const url = isDev ? '/serper-search/search' : 'https://google.serper.dev/search';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!isDev) {
        const key = import.meta.env.VITE_SERPER_API_KEY as string | undefined;
        if (key) headers['X-API-KEY'] = key;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ q, num: 8 }),
      });
      const data = await res.json();
      const results = (data.organic || []).map((r: { title: string; link: string; snippet: string }) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Agent block-list / allow-list come from runtime config so admins can
  // change which agents appear in the switcher without a rebuild.
  const blockedProcessKeys = agentsConfig.blockedProcessKeys;
  const allowedAgentNames = agentsConfig.allowedChatAgentNames;

  // Fetch & deduplicate agents for the switcher
  useEffect(() => {
    conversationalAgent.getAll().then((all) => {
      const byKey = new Map<string, AgentGetResponse>();
      const blocked = new Set(blockedProcessKeys);
      for (const a of all) {
        if (blocked.has(a.processKey)) continue;
        const existing = byKey.get(a.processKey);
        if (!existing) { byKey.set(a.processKey, a); continue; }
        const t1 = existing.createdTime ? new Date(existing.createdTime).getTime() : 0;
        const t2 = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        if (t2 > t1) byKey.set(a.processKey, a);
      }
      const allowed = new Set(allowedAgentNames);
      setAllAgents(Array.from(byKey.values()).filter(a => isPrimaryAgent(a) || allowed.has(a.name.trim())));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationalAgent, blockedProcessKeys, allowedAgentNames]);

  const convRef = useRef<ConversationGetResponse | null>(null);
  const sessionRef = useRef<SessionStream | null>(null);
  const sessionConnectedRef = useRef(false);
  const exchangeAssistantIdRef = useRef<Map<string, string>>(new Map());
  const exchangeTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hasSavedHistoryRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      try {
        const agentName = agentDisplayName;

        // Either resume an existing conversation or create a new one
        let conv: ConversationGetResponse;
        if (existingConversationId) {
          conv = await conversationalAgent.conversations.getById(existingConversationId);
        } else {
          conv = await agent.conversations.create({ label: `Chat with ${agentName}` });
        }
        if (!mounted) return;

        // Load existing message history from exchanges
        if (existingConversationId) {
          try {
            const exchangesResult = await conv.exchanges.getAll();
            const loaded: ChatMessage[] = [];
            // SDK returns exchanges newest-first; reverse for chronological display
            const orderedExchanges = [...exchangesResult.items].reverse();
            for (const exchange of orderedExchanges) {
              for (const message of exchange.messages) {
                const parts = message.contentParts ?? [];
                let content = '';
                for (const part of parts) {
                  try {
                    const data = await part.getData();
                    if (typeof data === 'string') {
                      content += data;
                    } else {
                      content += await (data as Response).text();
                    }
                  } catch { /* skip unreadable part */ }
                }
                if (content.trim()) {
                  loaded.push({
                    id: message.id,
                    role: message.role === MessageRole.User ? 'user' : 'assistant',
                    content,
                  });
                }
              }
            }
            if (mounted && loaded.length > 0) setMessages(loaded);
          } catch { /* ignore history load errors */ }
        }

        convRef.current = conv;
        const session = conv.startSession({ echo: true });
        sessionRef.current = session;
        // Mark the session ready when the WebSocket is open. Sending earlier
        // gets EXCHANGE_START_PROCESSING_FAILED. We check the current status
        // first because onConnectionStatusChanged only fires on transitions —
        // subscribing after the status flipped to Connected gets us nothing.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = session as any;
          if (s.connectionStatus === 'Connected') sessionConnectedRef.current = true;
          s.onConnectionStatusChanged?.((status: string) => {
            if (status === 'Connected') sessionConnectedRef.current = true;
            else if (status === 'Disconnected') sessionConnectedRef.current = false;
          });
        } catch { /* SDK may not expose status hook in some versions — fall back to delay */ }

        const agentNameForHistory = agentDisplayName;
        const clearExchange = (exchangeId: string, assistantId: string, errorMsg?: string) => {
          clearTimeout(exchangeTimeoutRef.current.get(exchangeId));
          exchangeTimeoutRef.current.delete(exchangeId);
          exchangeAssistantIdRef.current.delete(exchangeId);
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, ...(errorMsg && !m.content ? { content: errorMsg } : {}) }
              : m
          ));
          setIsStreaming(false);
          // Save to history only on first successful exchange (no error, has a conv ID)
          if (!errorMsg && !hasSavedHistoryRef.current && convRef.current && !existingConversationId) {
            hasSavedHistoryRef.current = true;
            try {
              const history = JSON.parse(localStorage.getItem('pa_chat_history') || '[]');
              const todayStr = new Date().toDateString();
              const existingIdx = history.findIndex(
                (h: { agentName: string; timestamp: number }) =>
                  h.agentName === agentNameForHistory && new Date(h.timestamp).toDateString() === todayStr
              );
              if (existingIdx >= 0) {
                history[existingIdx].timestamp = Date.now();
                history[existingIdx].conversationId = convRef.current.id;
              } else {
                history.push({ id: `chat-${Date.now()}`, agentId: String(agent.id), agentName: agentNameForHistory, title: `Chat with ${agentNameForHistory}`, timestamp: Date.now(), conversationId: convRef.current.id });
              }
              localStorage.setItem('pa_chat_history', JSON.stringify(history.slice(-50)));
            } catch { /* ignore */ }
          }
        };

        session.onAnyErrorStart((err) => {
          const errMsg = err.message || 'The agent encountered an error. Please try again.';
          exchangeAssistantIdRef.current.forEach((assistantId, exchangeId) => {
            clearExchange(exchangeId, assistantId, errMsg);
          });
          setError(errMsg);
        });

        session.onExchangeStart((exchange) => {
          const assistantId = exchangeAssistantIdRef.current.get(exchange.exchangeId);
          if (!assistantId) return;
          setIsStreaming(true);
          exchange.onMessageStart((message) => {
            if (!message.isAssistant) return;
            message.onContentPartStart((contentPart) => {
              if (contentPart.isMarkdown || contentPart.isText) {
                contentPart.onChunk((chunk) => {
                  if (chunk.data) {
                    setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk.data } : m));
                  }
                });
              }
            });
          });
          exchange.onExchangeEnd(() => clearExchange(exchange.exchangeId, assistantId));
          exchange.onErrorStart((err) => clearExchange(exchange.exchangeId, assistantId, err.message || 'Agent error'));
        });

        if (mounted) setIsInitializing(false);
      } catch {
        if (mounted) { setError(tr.failedToConnect); setIsInitializing(false); }
      }
    };
    setup();
    return () => { mounted = false; convRef.current?.endSession(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, existingConversationId]);

  const sendMessage = useCallback(async (textOverride?: string, fromVoice?: boolean, imageFile?: File) => {
    const text = (textOverride ?? input).trim();
    if (!sessionRef.current || !text || isStreaming) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text, fromVoice };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsVoiceInput(false);
    setIsStreaming(true);

    const exchangeId = `exchange-${Date.now()}-${crypto.randomUUID().slice(0, 12)}`;
    exchangeAssistantIdRef.current.set(exchangeId, assistantId);

    const timeout = setTimeout(() => {
      if (!exchangeAssistantIdRef.current.has(exchangeId)) return;
      exchangeTimeoutRef.current.delete(exchangeId);
      exchangeAssistantIdRef.current.delete(exchangeId);
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, isStreaming: false, content: 'Agent is not responding. Please try again.' } : m
      ));
      setIsStreaming(false);
    }, 40000);
    exchangeTimeoutRef.current.set(exchangeId, timeout);

    // Upload image attachment if provided
    let attachmentUri: string | undefined;
    let attachmentName: string | undefined;
    let attachmentError: string | undefined;
    if (imageFile && convRef.current) {
      try {
        const attachment = await convRef.current.uploadAttachment(imageFile);
        attachmentUri = attachment.uri;
        attachmentName = attachment.name;
        console.info('[ChatView] attachment uploaded:', { uri: attachmentUri, name: attachmentName, mimeType: imageFile.type, size: imageFile.size });
      } catch (e) {
        attachmentError = e instanceof Error ? e.message : String(e);
        console.error('[ChatView] Failed to upload attachment:', e);
      }
    }
    if (imageFile && !attachmentUri) {
      // Make the failure visible in the chat instead of silently sending text-only.
      setMessages((prev) => prev.map((m) => m.id === assistantId
        ? { ...m, isStreaming: false, content: `Couldn’t attach the image — ${attachmentError ?? 'upload returned no URI'}. Check PAT scopes (needs ConversationalAgents attachment permission) or try signing in via SSO.` }
        : m));
      setIsStreaming(false);
      clearTimeout(exchangeTimeoutRef.current.get(exchangeId));
      exchangeTimeoutRef.current.delete(exchangeId);
      exchangeAssistantIdRef.current.delete(exchangeId);
      return;
    }

    const exchange = sessionRef.current.startExchange({ exchangeId });
    const message = exchange.startMessage({ role: MessageRole.User });
    if (attachmentUri) {
      // Send image as a content part with the attachment URI
      // await message.sendContentPart({ data: attachmentUri, mimeType: imageFile?.type || 'image/jpeg' });
      message.startContentPart({ mimeType: imageFile?.type || 'image/jpeg', name: attachmentName, externalValue: { uri: attachmentUri } }).sendContentPartEnd();
    }
    await message.sendContentPart({ data: text });
    message.sendMessageEnd();
  }, [input, isStreaming]);

  const openCamera = useCallback(async () => {
    // Prefer rear camera on mobile, but fall back to any available camera on
    // desktops (webcam) before resorting to a file picker.
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch { /* fall through to file picker below */ }
    }
    if (stream) {
      cameraStreamRef.current = stream;
      setShowCamera(true);
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: '📷 Photo captured', imageUrl: dataUrl }]);
        sendMessage('Please analyze this attached image and extract any relevant information from it.', false, file);
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }, [sendMessage]);

  const capturePhoto = useCallback(() => {
    const video = videoPreviewRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setShowCamera(false);
    // Convert canvas to File for upload
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: '📷 Photo captured', imageUrl: dataUrl }]);
      sendMessage('Please analyze this attached image and extract any relevant information from it.', false, file);
    }, 'image/jpeg', 0.85);
  }, [sendMessage]);

  const closeCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setShowCamera(false);
  }, []);

  // Auto-open camera if launched with openCamera context flag
  const cameraOpenedRef = useRef(false);
  useEffect(() => {
    if (context?.openCamera && !cameraOpenedRef.current) {
      cameraOpenedRef.current = true;
      openCamera();
    }
  }, [context, openCamera]);

  // Auto-send voice-dictated prefill once the WebSocket reports Connected.
  // sendMessage and the prefill text are routed through refs so that if the
  // parent re-renders with a new `context` object identity (or sendMessage
  // is recreated when input/isStreaming change), the polling loop is not
  // cancelled mid-flight. The dep array intentionally only watches the
  // single transition we care about: isInitializing flipping false.
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  const prefillTextRef = useRef<string | null>(null);
  const prefillVoiceRef = useRef(context?.prefillVoice !== false);
  if (prefillTextRef.current === null && context?.prefill && !existingConversationId) {
    prefillTextRef.current = context.prefill.trim() || '';
  }
  const prefillSentRef = useRef(false);
  useEffect(() => {
    if (isInitializing) return;
    if (prefillSentRef.current) return;
    const text = prefillTextRef.current;
    if (!text) return;
    prefillSentRef.current = true;
    const start = Date.now();
    const trySend = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const live = (sessionRef.current as any)?.connectionStatus;
      if (live === 'Connected') sessionConnectedRef.current = true;
      if (sessionConnectedRef.current && sessionRef.current) {
        sendMessageRef.current(text, prefillVoiceRef.current);
        return;
      }
      if (Date.now() - start >= 1500) {
        sendMessageRef.current(text, prefillVoiceRef.current);
        return;
      }
      setTimeout(trySend, 50);
    };
    trySend();
    // No cleanup — once kicked off, the send should complete.
  }, [isInitializing]);

  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Voice not supported. Try Chrome.'); return; }
    if (isListening) { speechRef.current?.stop(); setIsListening(false); setTranscript(''); return; }
    setTranscript('');
    const rec = new SR();
    // continuous=true keeps the mic open; we detect end-of-speech via a 2.5s silence timer
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    speechRef.current = rec;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let finalTranscript = '';
    const SILENCE_MS = 2500; // 2.5 seconds of silence triggers send
    const submit = () => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      rec.stop();
      if (finalTranscript.trim()) { setIsVoiceInput(true); sendMessage(finalTranscript.trim(), true); }
      setTranscript('');
      finalTranscript = '';
    };
    rec.onstart = () => setIsListening(true);
    rec.onend = () => { setIsListening(false); if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } };
    rec.onerror = () => { setIsListening(false); if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      // Build the full transcript from all results so far
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      const display = (finalTranscript + interim).trim();
      setTranscript(display);
      // Reset the silence timer on every new speech result
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(submit, SILENCE_MS);
    };
    rec.start();
  }, [isListening, sendMessage]);

  /* ── Loading ────────────────────────────────────────────────────── */
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: isLight ? '#e8ebed' : '#000' }}>
        <video src={chatOrbBlobSrc} key={chatOrbBlobSrc} autoPlay loop muted playsInline preload="auto" style={{ width: 48, height: 48, objectFit: 'contain', mixBlendMode: isLight ? 'multiply' : 'screen', opacity: 0, transition: 'opacity 0.3s ease' }} onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }} />
        <p className="text-sm" style={{ color: 'rgba(var(--brand-primary-rgb),0.75)' }}>
          Connecting to {agentDisplayName}...
        </p>
      </div>
    );
  }

  /* ── Camera viewfinder ──────────────────────────────────────────── */
  if (showCamera) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#000' }}>
        <div className="flex items-center justify-center pt-4 pb-3">
          <div className="px-5 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
            Camera
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <video
            ref={(el) => {
              videoPreviewRef.current = el;
              if (el && cameraStreamRef.current) el.srcObject = cameraStreamRef.current;
            }}
            autoPlay playsInline muted
            className="rounded-2xl"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', background: '#111' }}
          />
        </div>
        <div className="flex items-center justify-center gap-12 pb-14 pt-6">
          <button onClick={closeCamera} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.55)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button onClick={capturePhoto} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#fff', boxShadow: '0 0 24px rgba(255,255,255,0.3)' }}>
            <div className="w-14 h-14 rounded-full" style={{ border: '3px solid #000' }} />
          </button>
          <div className="w-12 h-12" />
        </div>
      </div>
    );
  }

  /* ── Voice mode ─────────────────────────────────────────────────── */
  if (isListening) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#000' }}>
        <div className="flex items-center justify-center pt-4 pb-3">
          <div className="px-5 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
            Talking to {agentDisplayName}
          </div>
        </div>
        <p className="text-center text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>Go ahead, I'm listening...</p>
        <div className="flex-1 flex flex-col justify-center" style={{ background: '#000' }}>
          <VideoEl src="./mic-orb.mp4" autoPlay loop muted playsInline preload="auto"
            ref={(el) => { if (el && el.readyState >= 2) el.style.opacity = '1'; }}
            style={{ width: '100%', objectFit: 'cover', background: '#000', opacity: 0, transition: 'opacity 0.3s ease' }}
            onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }} />
          {transcript && (
            <p className="text-center px-10 mt-6 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{transcript}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-12 pb-14">
          {/* Cancel — discard and go back to chat, no send */}
          <button onClick={() => { speechRef.current?.abort(); setIsListening(false); setTranscript(''); setInput(''); }} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.55)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Mic — toggle recording */}
          <button onClick={toggleVoice} className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--brand-primary)', boxShadow: '0 0 32px rgba(var(--brand-primary-rgb),0.65)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* Submit — send transcript and go back to chat */}
          <button onClick={() => {
            const currentTranscript = transcript.trim();
            // Stop recognition without auto-submit — we handle send manually
            speechRef.current?.stop();
            setIsListening(false);
            setTranscript('');
            if (currentTranscript) { sendMessage(currentTranscript, true); }
          }} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: transcript.trim() ? 'rgba(var(--brand-primary-rgb),0.25)' : 'rgba(255,255,255,0.1)', border: transcript.trim() ? '1px solid rgba(var(--brand-primary-rgb),0.5)' : '1px solid transparent' }}>
            <svg className="w-5 h-5" style={{ color: transcript.trim() ? 'var(--brand-primary)' : 'rgba(255,255,255,0.55)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  /* ── Chat screen ────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full"
      style={{ background: t.bgPage }}>

      {/* Header — back | centered title dropdown | menu */}
      <div className="flex-shrink-0 relative" style={{ borderBottom: `1px solid ${t.headerBorder}` }}>
        <div className="flex items-center px-4 pt-3 pb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: t.backBtnBg }}
          >
            <svg className="w-5 h-5" style={{ color: t.backBtnIcon }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Clickable agent name */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => setShowDropdown(v => !v)}
              className="flex items-center gap-1"
            >
              <span className="font-semibold text-sm" style={{ color: t.headerName }}>{getDisplayName(agent)}</span>
              <svg
                className="w-3.5 h-3.5 transition-transform"
                style={{ color: t.headerChevron, transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <button className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" style={{ color: t.headerMenu }} fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>

        {/* Agent switcher dropdown */}
        {showDropdown && allAgents.length > 0 && (
          <div
            className="absolute left-4 right-4 z-50 rounded-2xl overflow-hidden"
            style={{
              top: '100%',
              marginTop: 4,
              background: t.dropdownBg,
              border: `1px solid ${t.borderStrong}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {allAgents.map((a, idx) => (
              <button
                key={a.id}
                onClick={() => { setShowDropdown(false); onSwitchAgent(a); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/10"
                style={{
                  borderBottom: idx < allAgents.length - 1 ? `1px solid ${t.divider}` : 'none',
                  background: a.id === agent.id ? 'rgba(var(--brand-primary-rgb),0.1)' : 'transparent',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{getDisplayName(a)}</p>
                  {a.processKey && (
                    <p className="text-xs truncate" style={{ color: t.textSecondary }}>{a.processKey}</p>
                  )}
                </div>
                {a.id === agent.id && (
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 flex-shrink-0 flex items-start gap-2 rounded-xl p-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* ── Context card (shown when launched from an agent run result) ── */}
        {context && !context.openCamera && !context.prefill && !existingConversationId && !contextDismissed && (
          <div className="mb-4 rounded-2xl overflow-hidden"
            style={{ background: t.bgCard, border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${t.divider}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(var(--brand-primary-rgb),0.15)' }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'rgba(var(--brand-primary-rgb),0.9)' }}>Run context · {context.timeAgo}</p>
                  <p className="text-xs" style={{ color: t.textMuted }}>{context.summary}</p>
                </div>
              </div>
              <button onClick={() => setContextDismissed(true)}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: t.backBtnBg, color: t.backBtnIcon }}>
                <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stats row */}
            <div className="flex gap-2 px-4 py-2.5" style={{ borderBottom: context.reviewItems.length > 0 ? `1px solid ${t.divider}` : 'none' }}>
              <span className="flex items-center gap-1 px-2 py-1 rounded-full"
                style={{ fontSize: 10, background: 'rgba(var(--brand-primary-rgb),0.1)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)', color: 'var(--brand-primary)' }}>
                <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                {context.autoItems.length} handled
              </span>
              {context.reviewItems.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full"
                  style={{ fontSize: 10, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.28)', color: '#fb923c' }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#fb923c"><circle cx="12" cy="12" r="10"/><path fill="white" d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                  {context.reviewItems.length} flagged for review
                </span>
              )}
            </div>

            {/* Review items */}
            {context.reviewItems.length > 0 && (
              <div className="px-4 py-3 flex flex-col gap-2">
                {context.reviewItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#fb923c' }} />
                    <div className="flex-1 min-w-0">
                      {(item.ref || item.amount) && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {item.ref && <span className="font-mono font-semibold" style={{ fontSize: 10, color: '#fb923c' }}>{item.ref}</span>}
                          {item.amount && <span className="font-semibold" style={{ fontSize: 10, color: t.textBody }}>{item.amount}</span>}
                        </div>
                      )}
                      <p style={{ fontSize: 11.5, color: isLight ? 'rgba(24,33,38,0.85)' : 'rgba(255,210,170,0.8)', lineHeight: 1.4 }}>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state — orb + heading + chips */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center mt-0 px-2 text-center">
            {(!context || context.openCamera || context.prefill) && (
              <>
                <VideoEl src={isLight ? CHAT_ORB_LIGHT : CHAT_ORB_DARK} key={isLight ? 'light' : 'dark'} autoPlay loop muted playsInline preload="auto" className={isLight ? 'mb-2' : 'mb-2 mt-3'} style={{ width: isLight ? 680 : 420, marginTop: isLight ? -24 : undefined, objectFit: 'contain', mixBlendMode: t.orbBlend, opacity: 0, transition: 'opacity 0.4s ease', ...(isLight && { WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)', WebkitMaskComposite: 'source-in', maskComposite: 'intersect' }) }} onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }} />
                <h3 className="font-semibold text-lg mb-1" style={{ color: t.textPrimary }}>{tr.howCanIHelp}</h3>
                <p className="text-sm mb-5" style={{ color: 'rgba(var(--brand-primary-rgb),0.6)' }}>
                  {agent.description ?? `Ask ${agentDisplayName} anything`}
                </p>
              </>
            )}
            {context && !context.openCamera && !context.prefill && (
              <p className="text-sm mb-4 mt-1" style={{ color: 'rgba(var(--brand-primary-rgb),0.65)' }}>
                Ask a question or send the pre-filled message below
              </p>
            )}
            {/* 2-column chip grid — context-aware */}
            <div className="grid grid-cols-2 gap-2 w-full">
              {(context && !context.openCamera && !context.prefill
                ? [
                    ...(context.reviewItems.length > 0 ? [
                      { label: context.reviewItems[0].ref ? `Explain ${context.reviewItems[0].ref}` : 'Explain this case', icon: CHIP_ICONS.doc },
                      { label: 'What do you recommend?', icon: CHIP_ICONS.chart },
                      { label: 'What are the risks?', icon: CHIP_ICONS.alert },
                      { label: 'Show me similar cases', icon: CHIP_ICONS.search },
                    ] : [
                      { label: 'Summarise this run', icon: CHIP_ICONS.list },
                      { label: 'Any anomalies?', icon: CHIP_ICONS.alert },
                      { label: 'What happened here?', icon: CHIP_ICONS.doc },
                      { label: 'Next steps?', icon: CHIP_ICONS.chart },
                    ])
                  ]
                : getAgentChips(agent, lang)
              ).map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => sendMessage(chip.label)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs text-left transition-all active:scale-95"
                  style={{
                    background: t.bgCard,
                    border: '1px solid rgba(var(--brand-primary-rgb),0.2)',
                    color: t.textBody,
                  }}
                >
                  <span style={{ color: 'rgba(var(--brand-primary-rgb),0.8)', flexShrink: 0 }}>{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        <div className="space-y-3 mt-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end items-end' : 'justify-start items-start'}`}>
              <div className={`${msg.role === 'user' ? 'max-w-[78%] rounded-br-sm' : 'w-full rounded-bl-sm'} flex flex-col gap-1.5`}>
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--brand-primary)', color: '#fff' }
                    : { background: t.aiBubbleBg, border: `1px solid ${t.aiBubbleBorder}`, color: t.aiBubbleText }
                }
              >
                {msg.isStreaming && !msg.content ? (() => {
                  // Show a context-aware loading label so the bubble doesn't
                  // look blank while the agent works. Image uploads kick off
                  // an analyze prompt, so we surface "Analyzing image…" until
                  // the first chunk streams back.
                  const prevUser = [...messages].reverse().find(x => x.role === 'user' && messages.indexOf(x) < messages.indexOf(msg));
                  const isImageAnalysis = !!prevUser?.imageUrl;
                  const label = isImageAnalysis ? 'Analyzing image…' : 'Thinking…';
                  return (
                    <div className="flex items-center gap-2 py-0.5" style={{ color: t.aiBubbleText }}>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
                        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      <span className="text-sm" style={{ opacity: 0.75 }}>{label}</span>
                    </div>
                  );
                })() : msg.role === 'user' ? (
                  <div className="flex flex-col gap-2">
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Captured" className="rounded-xl max-w-full" style={{ maxHeight: 200, objectFit: 'cover' }} />
                    )}
                    <div className="flex items-end gap-2">
                    <p className="whitespace-pre-wrap flex-1">{msg.content}</p>
                    {msg.fromVoice && (
                      <span className="flex-shrink-0 flex items-center justify-center rounded-full mb-0.5"
                        style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.25)' }}>
                        <svg className="w-3 h-3" style={{ color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </span>
                    )}
                    </div>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <p className="font-bold text-base mb-1" style={{ color: t.textPrimary }}>{children}</p>,
                        h2: ({ children }) => <p className="font-bold text-sm mb-1 mt-2" style={{ color: 'rgba(var(--brand-primary-rgb),0.9)' }}>{children}</p>,
                        h3: ({ children }) => <p className="font-semibold text-sm mb-1 mt-1.5" style={{ color: 'rgba(var(--brand-primary-rgb),0.75)' }}>{children}</p>,
                        p: ({ children }) => <p className="mb-1.5 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold" style={{ color: t.textPrimary }}>{children}</strong>,
                        em: ({ children }) => <em className="italic" style={{ color: isLight ? 'rgba(24,33,38,0.75)' : 'rgba(200,220,255,0.8)' }}>{children}</em>,
                        ul: ({ children }) => <ul className="mb-2 space-y-1 pl-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 space-y-1 pl-1">{children}</ol>,
                        li: ({ children }) => (
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand-primary)' }} />
                            <span>{children}</span>
                          </li>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2 rounded-xl" style={{ border: `1px solid ${t.border}` }}>
                            <table className="w-full text-xs border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead style={{ background: 'rgba(var(--brand-primary-rgb),0.12)' }}>{children}</thead>,
                        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold" style={{ color: 'rgba(var(--brand-primary-rgb),0.9)', borderBottom: `1px solid ${t.border}` }}>{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2" style={{ borderBottom: `1px solid ${t.divider}`, color: t.textBody }}>{children}</td>,
                        code: ({ children }) => <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)', color: 'var(--brand-primary)' }}>{children}</code>,
                        blockquote: ({ children }) => <blockquote className="pl-3 my-1.5 italic" style={{ borderLeft: '2px solid rgba(var(--brand-primary-rgb),0.5)', color: isLight ? 'rgba(24,33,38,0.7)' : 'rgba(200,225,230,0.7)' }}>{children}</blockquote>,
                        hr: () => <hr className="my-2" style={{ borderColor: t.divider }} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {msg.role === 'assistant' && <div className="pl-1"><MiniOrb size={22} /></div>}
              </div>
            </div>
          ))}
        </div>

        {/* Reaction row after last assistant message */}
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].isStreaming && (
          <div className="flex items-center gap-3 mt-2 ml-1">
            {/* Thumbs up */}
            <button
              onClick={() => setReaction(r => r === 'like' ? null : 'like')}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                background: reaction === 'like' ? 'rgba(var(--brand-primary-rgb),0.18)' : t.bgCard,
                border: `1px solid ${reaction === 'like' ? 'rgba(var(--brand-primary-rgb),0.5)' : t.border}`,
              }}>
              <svg className="w-3.5 h-3.5" style={{ color: reaction === 'like' ? 'var(--brand-primary)' : t.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </button>
            {/* Thumbs down */}
            <button
              onClick={() => setReaction(r => r === 'dislike' ? null : 'dislike')}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                background: reaction === 'dislike' ? 'rgba(248,113,113,0.15)' : t.bgCard,
                border: `1px solid ${reaction === 'dislike' ? 'rgba(248,113,113,0.5)' : t.border}`,
              }}>
              <svg className="w-3.5 h-3.5" style={{ color: reaction === 'dislike' ? '#f87171' : t.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>
            {/* Copy */}
            <button
              onClick={() => {
                const lastMsg = messages[messages.length - 1];
                navigator.clipboard.writeText(lastMsg.content).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                background: copied ? 'rgba(var(--brand-primary-rgb),0.15)' : t.bgCard,
                border: `1px solid ${copied ? 'rgba(var(--brand-primary-rgb),0.5)' : t.border}`,
              }}>
              <svg className="w-3.5 h-3.5" style={{ color: copied ? 'var(--brand-primary)' : t.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {copied
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                }
              </svg>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="flex-shrink-0 border-t" style={{ borderColor: 'rgba(var(--brand-primary-rgb),0.2)', background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(13,26,32,0.98)', maxHeight: '55%', overflowY: 'auto' }}>
          {/* Search header */}
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: t.bgInput, border: '1px solid rgba(var(--brand-primary-rgb),0.25)' }}>
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: t.textBody }}
                placeholder="Search the web..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(searchQuery); }}
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => runSearch(searchQuery)} className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'var(--brand-primary)', color: '#fff' }}>Go</button>
              )}
            </div>
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: t.backBtnBg }}>
              <svg className="w-3.5 h-3.5" style={{ color: t.backBtnIcon }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Results */}
          <div className="px-4 pb-3 flex flex-col gap-2">
            {isSearching && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <svg className="animate-spin w-4 h-4" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-xs" style={{ color: t.textMuted }}>Searching…</span>
              </div>
            )}
            {!isSearching && searchResults.length === 0 && searchQuery && (
              <p className="text-xs text-center py-4" style={{ color: t.textMuted }}>No results found</p>
            )}
            {searchResults.map((r, i) => (
              <div key={i} className="rounded-xl p-3 cursor-pointer active:scale-[0.98] transition-transform"
                style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
                onClick={() => window.open(r.url, '_blank', 'noopener,noreferrer')}>
                <p className="text-xs font-semibold mb-0.5 truncate" style={{ color: 'var(--brand-primary)' }}>{r.title}</p>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: t.textBody }}>{r.snippet}</p>
                <p className="text-xs mt-1 truncate" style={{ color: t.textMuted }}>{r.url}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 pt-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${t.headerBorder}`, paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
        <div className="rounded-2xl px-4 pt-3 pb-2.5" style={{
          background: t.bgInput,
          border: `1px solid ${t.border}`,
          backdropFilter: 'blur(12px)',
        }}>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(undefined, isVoiceInput); } }}
            placeholder={isListening ? tr.listening : tr.askAnything}
            className="w-full bg-transparent text-sm outline-none resize-none leading-relaxed"
            style={{ color: t.textBody, caretColor: 'var(--brand-primary)' }}
            disabled={isStreaming || isListening}
          />
          {/* Bottom row: icons left, send button right */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-4">
              {/* Camera */}
              <button className="flex-shrink-0" style={{ color: t.textMuted }} onClick={openCamera}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </button>
              {/* Web search */}
              <button
                className="flex-shrink-0"
                style={{ color: showSearch ? 'var(--brand-primary)' : t.textMuted }}
                onClick={() => {
                  if (showSearch) {
                    setShowSearch(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  } else {
                    const q = input.trim();
                    setSearchQuery(q);
                    setSearchResults([]);
                    setShowSearch(true);
                    if (q) runSearch(q);
                  }
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
                </svg>
              </button>
              {/* Mic */}
              <button onClick={toggleVoice} className="flex-shrink-0" style={{ color: isListening ? '#ef4444' : t.textMuted }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
            {/* Send button — inside the box, bottom right */}
            <button
              onClick={() => sendMessage(undefined, isVoiceInput)}
              disabled={!input.trim() || isStreaming}
              className="flex items-center justify-center rounded-2xl"
              style={{
                width: 38, height: 32,
                background: 'var(--brand-primary)',
                boxShadow: '0 0 16px rgba(var(--brand-primary-rgb),0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
