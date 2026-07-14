// ─────────────────────────────────────────────────────────────────────────────
// GuestChat — first screen for non-authenticated users.
//
// Apple App Store guideline 5.1.1(i) requires that apps don't gate non-account
// functionality behind a login. This component fulfils that by exposing the
// "Ask UiPath" agent (chat) to anyone who opens the app, with no sign-in flow
// in the way.
//
// Important: this is a SEPARATE component from ChatView/MainApp on purpose.
// Logged-in users keep their existing experience (HomeTab + ChatView + tabs)
// unchanged. This file is the only thing the guest-mode UI uses, so the
// guest-only UX can be iterated here without risk of touching authenticated
// flows.
//
// Backend: identical to logged-in chat. The component bootstraps its own
// UiPath SDK instance using the bundled demo PAT (VITE_UIPATH_DEMO_TOKEN) and
// talks to the same ConversationalAgent streaming endpoints that authenticated
// users use. No new backend surface area is required.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Capacitor } from '@capacitor/core';

// Minimal SpeechRecognition typings — mirrors the structure used in HomeTab.
interface SpeechRecognitionResult {
  0: { transcript: string };
}
interface SpeechRecognitionEvent {
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
import { UiPath } from '@uipath/uipath-typescript/core';
import { ConversationalAgent, MessageRole } from '@uipath/uipath-typescript/conversational-agent';
import type {
  AgentGetResponse,
  ConversationGetResponse,
  SessionStream,
} from '@uipath/uipath-typescript/conversational-agent';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../config';
import LoopingVideo from './LoopingVideo';
import VideoEl from './VideoEl';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  imageUrl?: string;
  fromVoice?: boolean;
}

interface Props {
  /** Called when the user taps "Sign in". Parent reveals the login screen. */
  onSignIn: () => void;
  /** Called when the user declines the AI disclosure. Parent should return
   *  to the welcome screen so the user is not stuck on a blocked chat. */
  onDecline?: () => void;
}

// localStorage key for the AI-data-sharing disclosure acceptance. One-time per
// install — once set, the modal never shows again on this device.
const DISCLOSURE_KEY = 'aura_ai_disclosure_accepted_v1';
// Privacy policy URL shown by the "View Privacy Policy" button.
const PRIVACY_POLICY_URL = 'https://www.uipath.com/legal/privacy-policy';

const TEAL = 'var(--brand-primary)';

export default function GuestChat({ onSignIn, onDecline }: Props) {
  const { theme, isRtl } = useTheme();
  const { branding } = useConfig();
  // AI-data-sharing disclosure. Read once on mount from localStorage; until
  // accepted, the chat surface is blocked by a modal overlay.
  const [disclosureAccepted, setDisclosureAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISCLOSURE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const handleAcceptDisclosure = useCallback(() => {
    try {
      localStorage.setItem(DISCLOSURE_KEY, '1');
    } catch {
      /* private mode or storage disabled — accept in-memory only */
    }
    setDisclosureAccepted(true);
  }, []);
  const handleDeclineDisclosure = useCallback(() => {
    onDecline?.();
  }, [onDecline]);
  const handleOpenPrivacyPolicy = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      // Use the in-app SFSafariViewController so users stay in Aura's task
      // switcher context. Fallback to window.open if Browser isn't available.
      import('@capacitor/browser').then(({ Browser }) => {
        Browser.open({ url: PRIVACY_POLICY_URL }).catch(() => {
          window.open(PRIVACY_POLICY_URL, '_blank', 'noopener');
        });
      });
    } else {
      window.open(PRIVACY_POLICY_URL, '_blank', 'noopener');
    }
  }, []);
  const isLight = theme === 'light';

  // ── SDK bootstrap ─────────────────────────────────────────────────────────
  // Build a self-contained, demo-PAT-authenticated UiPath SDK instance. This
  // intentionally bypasses useAuth() — guests are NOT logged in, so we don't
  // touch the auth context. When they later tap "Sign in" and successfully
  // authenticate, App.tsx pivots to MainApp which uses its own (real) SDK.
  const sdk = useMemo(
    () =>
      new UiPath({
        baseUrl: import.meta.env.VITE_UIPATH_BASE_URL,
        orgName: import.meta.env.VITE_UIPATH_ORG_NAME,
        tenantName: import.meta.env.VITE_UIPATH_TENANT_NAME,
        secret: import.meta.env.VITE_UIPATH_DEMO_TOKEN,
        clientId: undefined,
        redirectUri: undefined,
        scope: undefined,
      } as ConstructorParameters<typeof UiPath>[0]),
    []
  );
  const conversationalAgent = useMemo(() => new ConversationalAgent(sdk), [sdk]);

  // ── Conversation state ────────────────────────────────────────────────────
  const [agent, setAgent] = useState<AgentGetResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs used by the streaming callbacks — these don't need to trigger re-renders.
  const convRef = useRef<ConversationGetResponse | null>(null);
  const sessionRef = useRef<SessionStream | null>(null);
  const sessionConnectedRef = useRef(false);
  // Map of exchangeId → the assistant ChatMessage.id that's currently streaming.
  const exchangeAssistantIdRef = useRef<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // Track which agent ID we've bound a session for, so we don't re-bind on
  // every render once `agent` is set.
  const sessionBoundForAgentRef = useRef<string | null>(null);
  // ── Voice mode state ──────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRef = useRef<any>(null);
  // ── Camera mode state ─────────────────────────────────────────────────────
  const [showCamera, setShowCamera] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Scroll to bottom on every new message / chunk.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Step 1: discover the "Ask UiPath" agent ───────────────────────────────
  // Logic mirrors HomeTab so the guest experience matches the logged-in one.
  useEffect(() => {
    let cancelled = false;
    conversationalAgent
      .getAll()
      .then((all) => {
        if (cancelled) return;
        // Dedupe by processKey, prefer the most recent.
        const byKey = new Map<string, AgentGetResponse>();
        for (const a of all) {
          const existing = byKey.get(a.processKey);
          if (!existing) {
            byKey.set(a.processKey, a);
            continue;
          }
          const existingTime = existing.createdTime ? new Date(existing.createdTime).getTime() : 0;
          const newTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
          if (newTime > existingTime) byKey.set(a.processKey, a);
        }
        const sorted = Array.from(byKey.values()).sort((a, b) => {
          const aT = a.createdTime ? new Date(a.createdTime).getTime() : 0;
          const bT = b.createdTime ? new Date(b.createdTime).getTime() : 0;
          return bT - aT;
        });
        const askUiPath =
          sorted.find((a) => a.name.trim() === 'Ask UiPath' && a.processKey === 'All.in.One.Agent.agent.Agent') ??
          sorted[0] ??
          null;
        setAgent(askUiPath);
        if (!askUiPath) setAgentError('No agents available right now. Please try again later.');
      })
      .catch(() => {
        if (!cancelled) setAgentError('Could not reach UiPath. Please check your connection.');
      });
    return () => {
      cancelled = true;
    };
  }, [conversationalAgent]);

  // ── Step 2: create conversation + open streaming session ──────────────────
  useEffect(() => {
    if (!agent) return;
    // Guard against re-binding on re-render with the same agent.
    if (sessionBoundForAgentRef.current === String(agent.id)) return;
    sessionBoundForAgentRef.current = String(agent.id);

    let cancelled = false;
    const setup = async () => {
      try {
        const conv = await agent.conversations.create({ label: 'Guest chat' });
        if (cancelled) return;
        convRef.current = conv;
        const session = conv.startSession({ echo: true });
        sessionRef.current = session;
        // Track readiness — sending an exchange before the WebSocket is
        // "Connected" produces EXCHANGE_START_PROCESSING_FAILED.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = session as any;
          if (s.connectionStatus === 'Connected') sessionConnectedRef.current = true;
          s.onConnectionStatusChanged?.((status: string) => {
            if (status === 'Connected') sessionConnectedRef.current = true;
            else if (status === 'Disconnected') sessionConnectedRef.current = false;
          });
        } catch {
          /* older SDK versions don't expose this — best-effort delay used in sendMessage instead */
        }

        // Bind the streaming callbacks. Each exchange corresponds to one
        // user message → one assistant reply. Chunks arrive as they're
        // generated.
        session.onAnyErrorStart((err) => {
          const errMsg = err.message || 'The agent encountered an error. Please try again.';
          exchangeAssistantIdRef.current.forEach((assistantId) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, content: m.content || errMsg } : m))
            );
          });
          setIsStreaming(false);
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
                    setMessages((prev) =>
                      prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk.data } : m))
                    );
                  }
                });
              }
            });
          });
          const finishExchange = (errorMsg?: string) => {
            exchangeAssistantIdRef.current.delete(exchange.exchangeId);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, isStreaming: false, ...(errorMsg && !m.content ? { content: errorMsg } : {}) }
                  : m
              )
            );
            if (exchangeAssistantIdRef.current.size === 0) setIsStreaming(false);
          };
          exchange.onExchangeEnd(() => finishExchange());
          exchange.onErrorStart((err) => finishExchange(err.message || 'Agent error'));
        });
      } catch (err) {
        if (!cancelled) {
          setAgentError(err instanceof Error ? err.message : 'Failed to start the chat session.');
        }
      }
    };
    setup();
    return () => {
      cancelled = true;
    };
  }, [agent]);

  // ── Step 3: send a user message (optionally with an image attachment) ─────
  // Mirrors ChatView.sendMessage: when an imageFile is provided, upload it via
  // the conversation's attachment endpoint, then transmit the resulting URI as
  // a content part before the user's text. Without this, photos taken from the
  // camera arrive as text-only ("please analyze the image") and the agent
  // responds saying it sees no attachment.
  const sendMessage = useCallback(
    async (text: string, fromVoice = false, imageFile?: File) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !sessionRef.current) return;
      const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: trimmed, fromVoice };
      const assistantId = `asst-${Date.now()}`;
      const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsStreaming(true);
      const exchangeId = `ex-${Date.now()}`;
      exchangeAssistantIdRef.current.set(exchangeId, assistantId);

      // Wait briefly for the WebSocket session to be ready (avoids the
      // EXCHANGE_START_PROCESSING_FAILED race when sending immediately after
      // session.startSession() resolves).
      const waitForConnected = async () => {
        const start = Date.now();
        while (!sessionConnectedRef.current && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 50));
        }
      };
      await waitForConnected();

      // Upload image (if any) BEFORE opening the exchange — same order as ChatView.
      let attachmentUri: string | undefined;
      let attachmentName: string | undefined;
      let attachmentError: string | undefined;
      if (imageFile && convRef.current) {
        try {
          const attachment = await convRef.current.uploadAttachment(imageFile);
          attachmentUri = attachment.uri;
          attachmentName = attachment.name;
        } catch (e) {
          attachmentError = e instanceof Error ? e.message : String(e);
        }
      }
      if (imageFile && !attachmentUri) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, content: `Couldn't attach the image — ${attachmentError ?? 'upload returned no URI'}.` }
              : m
          )
        );
        exchangeAssistantIdRef.current.delete(exchangeId);
        setIsStreaming(false);
        return;
      }

      try {
        const exchange = sessionRef.current.startExchange({ exchangeId });
        const message = exchange.startMessage({ role: MessageRole.User });
        if (attachmentUri) {
          message
            .startContentPart({
              mimeType: imageFile?.type || 'image/jpeg',
              name: attachmentName,
              externalValue: { uri: attachmentUri },
            })
            .sendContentPartEnd();
        }
        await message.sendContentPart({ data: trimmed });
        message.sendMessageEnd();
      } catch (err) {
        exchangeAssistantIdRef.current.delete(exchangeId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, content: err instanceof Error ? err.message : 'Failed to send.' }
              : m
          )
        );
        setIsStreaming(false);
      }
    },
    [isStreaming]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  // Mic button — Web Speech API voice-to-text. Mirrors HomeTab.toggleVoice:
  // tap to enter listening mode (full-screen voice page below), tap again to
  // stop and send the transcript as a message.
  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) {
      const rec = speechRef.current;
      speechRef.current = null;
      rec?.stop();
      setIsListening(false);
      const text = transcript.trim();
      setTranscript('');
      if (text) void sendMessage(text, true);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    speechRef.current = rec;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => {
      if (speechRef.current) {
        try {
          speechRef.current.start();
        } catch {
          /* already started */
        }
      } else {
        setIsListening(false);
      }
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        speechRef.current = null;
        setIsListening(false);
      }
    };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join('');
      setTranscript(text);
    };
    rec.start();
  }, [isListening, transcript, sendMessage]);

  // Camera — request the device camera stream. Same flow as ChatView.openCamera:
  // try rear camera first, fall back to any available camera. If both fail
  // (e.g. permissions denied on desktop), drop to a hidden file picker.
  const openCamera = useCallback(async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        /* fall through */
      }
    }
    if (stream) {
      cameraStreamRef.current = stream;
      setShowCamera(true);
      return;
    }
    // Fallback: file picker (e.g. desktop without webcam, or denied permission)
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: 'user', content: '📷 Photo captured', imageUrl: dataUrl },
        ]);
        void sendMessage(
          'Please analyze this attached image and extract any relevant information from it.',
          false,
          file
        );
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }, [sendMessage]);

  const capturePhoto = useCallback(() => {
    const video = videoPreviewRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setShowCamera(false);
    // Convert canvas → Blob → File so it can actually be uploaded as an
    // attachment via convRef.current.uploadAttachment(). Without this the
    // agent only sees the text prompt and replies "I don't see an image".
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: 'user', content: '📷 Photo captured', imageUrl: dataUrl },
        ]);
        void sendMessage(
          'Please analyze this attached image and extract any relevant information from it.',
          false,
          file
        );
      },
      'image/jpeg',
      0.85
    );
  }, [sendMessage]);

  const closeCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setShowCamera(false);
  }, []);

  // ── Rendering ─────────────────────────────────────────────────────────────
  const bgColor = isLight ? '#e8ebed' : '#000';
  const textPrimary = isLight ? '#182126' : '#fff';
  const textMuted = isLight ? 'rgba(24,33,38,0.55)' : 'rgba(255,255,255,0.55)';
  const orbSrc = isLight ? './orb-light.mp4' : './orb.mp4';

  // ── Camera viewfinder (full-screen) ─────────────────────────────────────
  // Identical to ChatView's camera page so the guest experience matches the
  // logged-in one when the camera button is tapped.
  if (showCamera) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#000' }}>
        <div className="flex items-center justify-center pt-4 pb-3">
          <div className="px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
            Camera
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <video
            ref={(el) => {
              videoPreviewRef.current = el;
              if (el && cameraStreamRef.current) el.srcObject = cameraStreamRef.current;
            }}
            autoPlay
            playsInline
            muted
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

  // ── Voice mode (full-screen) ─────────────────────────────────────────────
  // Identical to ChatView's voice mode: "Talking to Ask UiPath" pill, mic-orb
  // video, live transcript, and Cancel / Mic toggle / Submit buttons.
  if (isListening) {
    const finishAndSend = () => {
      const text = transcript.trim();
      const rec = speechRef.current;
      speechRef.current = null;
      rec?.stop();
      setIsListening(false);
      setTranscript('');
      if (text) void sendMessage(text, true);
    };
    const cancelVoice = () => {
      const rec = speechRef.current;
      speechRef.current = null;
      rec?.stop();
      setIsListening(false);
      setTranscript('');
    };
    return (
      <div className="flex flex-col h-full" style={{ background: '#000' }}>
        <div className="flex items-center justify-center pt-4 pb-3">
          <div className="px-5 py-2 rounded-full text-sm font-medium text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
            Talking to Ask UiPath
          </div>
        </div>
        <p className="text-center text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>Go ahead, I'm listening...</p>
        <div className="flex-1 flex flex-col justify-center" style={{ background: '#000' }}>
          <VideoEl
            src="./mic-orb.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            ref={(el) => {
              if (el && el.readyState >= 2) el.style.opacity = '1';
            }}
            style={{ width: '100%', objectFit: 'cover', background: '#000', opacity: 0, transition: 'opacity 0.3s ease' }}
            onCanPlay={(e) => {
              (e.target as HTMLVideoElement).style.opacity = '1';
            }}
          />
          {transcript && (
            <p className="text-center px-10 mt-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {transcript}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-12 pb-14">
          {/* Cancel */}
          <button onClick={cancelVoice} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.55)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Mic toggle */}
          <button onClick={toggleVoice} className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 32px rgba(var(--brand-primary-rgb),0.7)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* Submit */}
          <button onClick={finishAndSend} className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{
              background: transcript.trim() ? 'rgba(var(--brand-primary-rgb),0.25)' : 'rgba(255,255,255,0.1)',
              border: transcript.trim() ? '1px solid rgba(var(--brand-primary-rgb),0.55)' : '1px solid transparent',
              boxShadow: transcript.trim() ? '0 0 16px rgba(var(--brand-primary-rgb),0.35)' : 'none',
            }}
          >
            <svg className="w-5 h-5" style={{ color: transcript.trim() ? 'var(--brand-primary)' : 'rgba(255,255,255,0.55)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: bgColor }}>
      {/* AI-data-sharing disclosure modal. Blocks the chat surface on first
       * use; the user must explicitly Accept or Decline. The acceptance flag
       * is persisted in localStorage so it shows only once per install. */}
      {!disclosureAccepted && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full rounded-t-3xl flex flex-col"
            style={{
              background: isLight ? '#ffffff' : 'linear-gradient(180deg, #1a242d 0%, #131b21 100%)',
              border: `1px solid ${isLight ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
              maxHeight: '90%',
              padding: '14px 20px 20px',
            }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
            {/* Header icon + title */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: 'rgba(var(--brand-primary-rgb),0.15)', border: '1px solid rgba(var(--brand-primary-rgb),0.35)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p
                className="font-bold"
                style={{
                  fontFamily: "'Poppins', Arial, sans-serif",
                  fontSize: 17,
                  letterSpacing: -0.3,
                  color: isLight ? '#182126' : '#fff',
                }}
              >
                {branding.appName} uses UiPath AI services
              </p>
            </div>
            {/* Scrollable body */}
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              <p
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: isLight ? 'rgba(24,33,38,0.78)' : 'rgba(255,255,255,0.78)',
                  marginBottom: 12,
                }}
              >
                When you chat, attach images, or use voice input, {branding.appName} sends that content to UiPath's AI services (operated by UiPath, Inc.) to generate responses.
              </p>
              <p
                className="font-semibold"
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 13,
                  color: isLight ? '#182126' : '#fff',
                  marginBottom: 6,
                }}
              >
                We share:
              </p>
              <ul
                className="pl-5"
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: isLight ? 'rgba(24,33,38,0.78)' : 'rgba(255,255,255,0.78)',
                  listStyleType: 'disc',
                  marginBottom: 14,
                }}
              >
                <li>Your chat messages and questions</li>
                <li>Images you attach</li>
                <li>Voice recordings (transcribed to text)</li>
                <li>Your UiPath account identity (name, email)</li>
              </ul>
              <p
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: isLight ? 'rgba(24,33,38,0.65)' : 'rgba(255,255,255,0.65)',
                  marginBottom: 18,
                }}
              >
                This data is processed by UiPath's third-party AI providers under their Privacy Policy. <span style={{ fontWeight: 600, color: isLight ? 'rgba(24,33,38,0.85)' : 'rgba(255,255,255,0.85)' }}>Do not share confidential or personal data you do not want processed by AI.</span>
              </p>
            </div>
            {/* Privacy Policy link */}
            <button
              type="button"
              onClick={handleOpenPrivacyPolicy}
              className="text-sm font-semibold active:opacity-70 transition-opacity flex items-center gap-1.5 mb-3"
              style={{ color: TEAL, background: 'none', border: 'none', padding: 0, alignSelf: 'flex-start' }}
            >
              View Privacy Policy
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </button>
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeclineDisclosure}
                className="flex-1 rounded-2xl text-sm font-medium active:scale-95 transition-transform"
                style={{
                  padding: '14px 0',
                  background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
                  color: isLight ? '#182126' : '#fff',
                  border: 'none',
                }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptDisclosure}
                className="flex-1 rounded-2xl text-sm font-semibold text-white active:scale-95 transition-transform"
                style={{
                  padding: '14px 0',
                  background: 'var(--brand-primary)',
                  border: 'none',
                  boxShadow: '0 2px 10px rgba(var(--brand-primary-rgb),0.35)',
                }}
              >
                I Agree &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header — sign-in driver. The guest experience is a preview; the
       * primary intent is to convert the user to sign in. So the entire
       * header is a single tappable banner with a clear value proposition.
       * Inspired by ChatGPT's "Sign up to save chats" and Notion's free-tier
       * banners — gives the visitor a constant, low-pressure prompt without
       * blocking access to the chat. */}
      <header
        role="button"
        tabIndex={0}
        onClick={onSignIn}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSignIn();
        }}
        className="flex items-center justify-center gap-3 flex-shrink-0 active:scale-[0.99] transition-transform cursor-pointer"
        style={{
          paddingTop: 'max(25px - env(safe-area-inset-top, 0px), 13px)',
          paddingBottom: 13,
          paddingLeft: 16,
          paddingRight: 16,
          background:
            'linear-gradient(90deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(var(--brand-primary-rgb),0.10) 100%)',
          borderBottom: `1px solid ${isLight ? 'rgba(24,33,38,0.07)' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        {/* Lock icon — subtle "more behind this" affordance */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            background: 'var(--brand-primary)',
            boxShadow: '0 2px 8px rgba(var(--brand-primary-rgb),0.35)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Value prop — two lines, primary line bolder */}
        <div className="min-w-0">
          <p
            className="font-semibold truncate"
            style={{
              fontFamily: "'Poppins', Arial, sans-serif",
              fontSize: 14,
              letterSpacing: -0.2,
              color: textPrimary,
              lineHeight: 1.2,
            }}
          >
            Sign in to see your agents, conversations & alerts
          </p>
          <p
            className="truncate"
            style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: 11.5,
              color: textMuted,
              marginTop: 1,
              lineHeight: 1.2,
            }}
          >
            Your agents, conversations & alerts
          </p>
        </div>

        {/* Chevron to telegraph "tap to continue" */}
        <div className="flex-shrink-0" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 min-h-0 overflow-y-auto pb-3 flex flex-col" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <div className="flex flex-col h-full">
            {/* Top spacer — pushes the orb down into the upper-middle area to
             * match the vertical position of the orb on the WelcomeScreen and
             * the login screen. */}
            <div className="flex-1 min-h-0" />
            {/* Hero orb — full-width with the same mask gradient and 320px height
             * used on the login/welcome screens, so the brand visual stays
             * consistent across the first three screens of the app. */}
            <div className="flex-shrink-0" style={{ height: 320 }}>
              <LoopingVideo
                src={orbSrc}
                style={{
                  objectFit: 'cover',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                  maskImage:
                    'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                }}
              />
            </div>
            {/* Greeting block — sits beneath the orb with breathing room. */}
            <div className="flex flex-col items-center px-6 text-center" style={{ paddingTop: 4 }}>
              <p
                className="font-bold mb-2"
                style={{
                  fontFamily: "'Poppins', Arial, sans-serif",
                  fontSize: 24,
                  color: textPrimary,
                  letterSpacing: -0.4,
                }}
              >
                How can I help you today?
              </p>
              <p style={{ fontSize: 13.5, color: textMuted, lineHeight: 1.5, maxWidth: 320 }}>
                From everyday questions to deep dives — ask me anything.
              </p>
              {agentError && (
                <div
                  className="mt-4 rounded-xl px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#dc2626',
                  }}
                >
                  {agentError}
                </div>
              )}
            </div>
            {/* Bottom spacer — balances the top spacer so the orb sits at the
             * upper-middle, same as the login/welcome screens. */}
            <div className="flex-1 min-h-0" />
          </div>
        )}
        {messages.length > 0 && (
          <div className="px-4 pt-4 flex-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex mb-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="rounded-2xl overflow-hidden max-w-[80%]"
                  style={{
                    background: m.role === 'user'
                      ? TEAL
                      : (isLight ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                    color: m.role === 'user' ? '#fff' : textPrimary,
                    border: m.role === 'user' ? 'none' : `1px solid ${isLight ? 'rgba(24,33,38,0.08)' : 'rgba(255,255,255,0.1)'}`,
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordBreak: 'break-word' as const,
                  }}
                >
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Attached photo"
                      style={{ display: 'block', width: '100%', maxWidth: 240, objectFit: 'cover' }}
                    />
                  )}
                  {m.role === 'user' && (m.content || m.isStreaming) && (
                    <div style={{ padding: '10px 16px' }}>
                      <div className="flex items-end gap-2">
                        <p className="whitespace-pre-wrap flex-1" style={{ margin: 0 }}>{m.content}</p>
                        {m.fromVoice && (
                          <span
                            className="flex-shrink-0 flex items-center justify-center rounded-full mb-0.5"
                            style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.25)' }}
                          >
                            <svg className="w-3 h-3" style={{ color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {m.role === 'assistant' && (
                    <div className="markdown-body" style={{ padding: '10px 16px' }}>
                      {!m.content && m.isStreaming ? (() => {
                        // Context-aware "Thinking…" / "Analyzing image…" widget.
                        // Mirrors ChatView's loading label so guests get the
                        // same feedback as authenticated users.
                        const idx = messages.indexOf(m);
                        const prevUser = [...messages.slice(0, idx)].reverse().find((x) => x.role === 'user');
                        const isImageAnalysis = !!prevUser?.imageUrl;
                        const label = isImageAnalysis ? 'Analyzing image…' : 'Thinking…';
                        return (
                          <div className="flex items-center gap-2 py-0.5" style={{ color: textPrimary }}>
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
                              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                            <span className="text-sm" style={{ opacity: 0.75 }}>{label}</span>
                          </div>
                        );
                      })() : m.content ? (
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <p className="font-bold text-base mb-1" style={{ color: textPrimary }}>{children}</p>,
                            h2: ({ children }) => <p className="font-bold text-sm mb-1 mt-2" style={{ color: 'rgba(var(--brand-primary-rgb),0.9)' }}>{children}</p>,
                            h3: ({ children }) => <p className="font-semibold text-sm mb-1 mt-1.5" style={{ color: 'rgba(var(--brand-primary-rgb),0.75)' }}>{children}</p>,
                            p: ({ children }) => <p className="mb-1.5 leading-relaxed">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold" style={{ color: textPrimary }}>{children}</strong>,
                            em: ({ children }) => <em className="italic" style={{ color: isLight ? 'rgba(24,33,38,0.75)' : 'rgba(200,220,255,0.8)' }}>{children}</em>,
                            ul: ({ children }) => <ul className="mb-2 space-y-1 pl-1">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 space-y-1 pl-1">{children}</ol>,
                            li: ({ children }) => (
                              <li className="flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand-primary)' }} />
                                <span>{children}</span>
                              </li>
                            ),
                            code: ({ children }) => (
                              <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)', color: 'var(--brand-primary)' }}>
                                {children}
                              </code>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="pl-3 my-1.5 italic" style={{ borderLeft: '2px solid rgba(var(--brand-primary-rgb),0.5)', color: isLight ? 'rgba(24,33,38,0.7)' : 'rgba(200,225,230,0.7)' }}>
                                {children}
                              </blockquote>
                            ),
                            hr: () => <hr className="my-2" style={{ borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)' }} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Composer — visual + behavior parity with HomeTab.tsx's input pill.
       *  Camera button → file picker (image attach)
       *  Globe button  → no-op (placeholder, same as HomeTab)
       *  Mic button    → Web Speech API voice-to-text into the input
       *  Send button   → submits the current input to the agent */}
      <form
        onSubmit={handleSubmit}
        className="px-4 mb-4 relative z-10 flex-shrink-0"
        style={{ paddingTop: 0 }}
      >
        <div
          className="rounded-full px-3 flex items-center gap-2"
          style={{
            background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(8,18,38,0.65)',
            border: '1px solid rgba(var(--brand-primary-rgb),0.25)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            height: 68,
          }}
        >
          {/* Camera */}
          <button
            type="button"
            onClick={openCamera}
            aria-label="Attach photo"
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}
          >
            <svg style={{ width: 15, height: 15, color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </button>
          {/* Globe — visual placeholder (matches HomeTab where it's also no-op) */}
          <button
            type="button"
            aria-label="Web"
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}
          >
            <svg style={{ width: 15, height: 15, color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            </svg>
          </button>
          {/* Mic — voice-to-text */}
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{
              background: isListening
                ? 'rgba(var(--brand-primary-rgb),0.18)'
                : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'),
            }}
          >
            <svg
              style={{
                width: 15,
                height: 15,
                color: isListening ? 'var(--brand-primary)' : (isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'),
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Divider */}
          <div className="flex-shrink-0" style={{ width: 1, height: 22, background: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }} />

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={agent ? 'Ask me anything...' : 'Loading...'}
            disabled={!agent || isStreaming}
            className="flex-1 bg-transparent outline-none min-w-0"
            style={{ color: textPrimary, fontSize: 13.5, caretColor: TEAL }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!agent || isStreaming || !input.trim()}
            aria-label="Send"
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center active:scale-95 transition-transform"
            style={{
              background: !agent || isStreaming || !input.trim() ? 'rgba(var(--brand-secondary-rgb),0.4)' : 'var(--brand-secondary)',
              boxShadow: !agent || isStreaming || !input.trim() ? 'none' : '0 0 16px rgba(var(--brand-secondary-rgb),0.5)',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {isStreaming ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}>
                <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg style={{ width: 15, height: 15 }} className="text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
