import { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import type { AgentGetResponse } from '@uipath/uipath-typescript/conversational-agent';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import LoopingVideo from './LoopingVideo';
import { useVideoBlob } from '../utils/useVideoBlob';
import VideoEl from './VideoEl';
import { useConfig, LOGO_SIZES } from '../config';
import { branchPulse, customers, money } from '../customersData';
import { approvalsPulse } from '../approvalsData';
import { Avatar, Icn } from './customerUi';
import type { AgentActionItem as AgentAction, AgentRunResult } from '../config';
import type { AgentRunContext } from '../types';
import { ORB_LIGHT, ORB_DARK } from '../brandAssets';

interface ActionCenterTask {
  Id: number;
  Title: string;
  CreationTime: string;
  Status: string;
  AssignedToUser?: string;
  category?: string;
}

interface SpeechRecognitionEvent {
  results: { [i: number]: { [i: number]: { transcript: string }; isFinal: boolean }; length: number };
}




interface Props {
  conversationalAgent: ConversationalAgent;
  selectedAgent: AgentGetResponse | null;
  onSelectAgent: (agent: AgentGetResponse) => void;
  onStartChat: (agent: AgentGetResponse, context?: AgentRunContext) => void;
  onLogout: () => void;
  userName?: string;
  homeNavPressCount?: number;
  onNavigateToTasks?: () => void;
  onNavigateToExplore?: (capability: string) => void;
  onOpenCustomers?: () => void;
  onOpenApprovals?: () => void;
}

export default function HomeTab({ conversationalAgent, selectedAgent, onSelectAgent, onStartChat, userName, homeNavPressCount, onNavigateToTasks, onNavigateToExplore, onOpenCustomers, onOpenApprovals }: Props) {
  const { t, tr, theme } = useTheme();
  const { branding, demoContent, homeShowcase } = useConfig();
  const orbSrc = theme === 'light' ? ORB_LIGHT : ORB_DARK;
  const orbBlobSrc = useVideoBlob(orbSrc);
  const { sdk } = useAuth();
  const [agents, setAgents] = useState<AgentGetResponse[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedResult, setSelectedResult] = useState<AgentRunResult | null>(null);
  const [modalFilter, setModalFilter] = useState<'review' | 'auto' | null>(null);
  const [pendingAction, setPendingAction] = useState<{ item: AgentAction; label: string; labelIdx: number } | null>(null);
  const [resolvedActions, setResolvedActions] = useState<Map<string, { label: string; scheduleInfo?: string; decidedAt: Date }>>(new Map());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);
  const [scheduleDate, setScheduleDate] = useState<string>('tomorrow');
  const [scheduleTime, setScheduleTime] = useState<string>('afternoon');
  const [scheduleNote, setScheduleNote] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRef = useRef<any>(null);

  // ── Action Center polling for "Claim App Task" ────────────────────
  // Initial state: render the configured demo tasks (relative timestamps
  // are converted to absolute using minutesAgo so the list always reads
  // fresh). Once real tasks load, these are replaced.
  const [actionTasks, setActionTasks] = useState<ActionCenterTask[]>(() =>
    demoContent.enabled
      ? demoContent.tasks.map(task => ({
          Id: task.Id,
          Title: task.Title,
          Status: task.Status,
          AssignedToUser: task.AssignedToUser,
          category: task.category,
          CreationTime: new Date(Date.now() - (task.minutesAgo ?? 0) * 60000).toISOString(),
        }))
      : []
  );
  const [selectedActionTask, setSelectedActionTask] = useState<ActionCenterTask | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  // Per-task notes and decisions — keyed by task Id so each card is independent
  const [taskNotes, setTaskNotes] = useState<Map<number, { comment: string; voiceUrl: string | null; voiceTranscript: string | null }>>(new Map());
  const [taskDecisions, setTaskDecisions] = useState<Map<number, 'approved' | 'rejected'>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>('');

  const activeTaskIdRef = useRef<number | null>(null);
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS WKWebView's MediaRecorder produces audio/mp4 (AAC), not WebM.
      // Pick the first MIME the current browser actually supports so the Blob
      // we build after onstop matches what the bytes are — otherwise <audio>
      // fires onError ("Error" in the play button).
      const preferredTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      const pickedType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, pickedType ? { mimeType: pickedType } : undefined);
      audioChunksRef.current = [];
      finalTranscriptRef.current = '';

      // Web Speech API runs alongside MediaRecorder to capture a transcript.
      // interimResults is enabled (but not displayed) so short recordings still get text
      // even if the browser never emits a sentence-finalized result before stop().
      let finalizedText = '';
      let runningInterim = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          let thisInterim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const text = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalizedText += text;
            else thisInterim += text;
          }
          runningInterim = thisInterim;
          finalTranscriptRef.current = (finalizedText + ' ' + runningInterim).replace(/\s+/g, ' ').trim();
        };
        rec.onerror = () => { /* ignore — transcript is best-effort */ };
        try { rec.start(); speechRecognitionRef.current = rec; } catch { /* already started */ }
      }

      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || pickedType || 'audio/mp4' });
        const url = URL.createObjectURL(blob);
        const tid = activeTaskIdRef.current;
        // Small delay so the speech recognizer can flush any pending final result
        // triggered by rec.stop() before we snapshot the transcript.
        setTimeout(() => {
          const transcript = finalTranscriptRef.current.trim() || null;
          if (tid !== null) {
            setTaskNotes(prev => {
              const next = new Map(prev);
              next.set(tid, { comment: prev.get(tid)?.comment ?? '', voiceUrl: url, voiceTranscript: transcript });
              return next;
            });
          }
        }, 250);
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setIsRecording(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordingSecs(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000);
    } catch { /* mic permission denied */ }
  }, []);

  const stopRecording = useCallback(() => {
    // Stop speech recognition first so it can flush its final result
    // before MediaRecorder's onstop snapshots the transcript.
    try { speechRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    speechRecognitionRef.current = null;
    mediaRecorderRef.current?.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);
  const seenTaskIds = useRef<Set<number>>(new Set());
  const folderKeyRef = useRef<string | null>(null);

  // Notification banner state
  const [notifTask, setNotifTask] = useState<ActionCenterTask | null>(null);
  const [notifVisible, setNotifVisible] = useState(false);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifTouchStartY = useRef(0);
  const notifElRef = useRef<HTMLDivElement>(null);
  // Ref so the polling effect can call showNotif without stale closure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showNotifRef = useRef<((task: ActionCenterTask) => void) | null>(null);

  const dismissNotif = useCallback(() => {
    setNotifVisible(false);
    // Let slide-up animation finish before removing from DOM
    setTimeout(() => setNotifTask(null), 350);
    if (notifTimerRef.current) { clearTimeout(notifTimerRef.current); notifTimerRef.current = null; }
  }, []);

  useEffect(() => {
    showNotifRef.current = (task: ActionCenterTask) => {
      setNotifTask(task);
      setNotifVisible(true);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => dismissNotif(), 5000);
    };
  }, [dismissNotif]);

  useEffect(() => {
    let mounted = true;
    const orgName = import.meta.env.VITE_UIPATH_ORG_NAME || 'mea';
    const tenantName = import.meta.env.VITE_UIPATH_TENANT_NAME || 'DefaultTenant';
    // Dev uses the Vite proxy path to avoid CORS; prod hits the staging API host directly.
    const apiBase = import.meta.env.DEV
      ? `/${orgName}/${tenantName}/orchestrator_`
      : `https://staging.api.uipath.com/${orgName}/${tenantName}/orchestrator_`;

    const getFolderKey = async (token: string): Promise<string | null> => {
      if (folderKeyRef.current) return folderKeyRef.current;
      try {
        const res = await fetch(
          `${apiBase}/odata/Folders/UiPath.Server.Configuration.OData.GetAllForCurrentUser`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const folders: Array<{ Key: string; DisplayName: string; FullyQualifiedName: string }> = data.value || [];
        const target = folders.find(f =>
          f.FullyQualifiedName?.toLowerCase().includes('cx - insurance') ||
          f.DisplayName?.toLowerCase().includes('cx - insurance') ||
          f.FullyQualifiedName?.toLowerCase().includes('whatsapp') ||
          f.DisplayName?.toLowerCase().includes('whatsapp')
        );
        if (target) { folderKeyRef.current = target.Key; return target.Key; }
        const insurance = folders.find(f =>
          f.DisplayName?.toLowerCase() === 'insurance' || f.FullyQualifiedName?.toLowerCase().startsWith('insurance')
        );
        if (insurance) { folderKeyRef.current = insurance.Key; return insurance.Key; }
        return null;
      } catch { return null; }
    };

    const fetchTasks = async () => {
      const token = sdk.getToken();
      if (!token || !mounted) return;

      // Folder key is optional — some tenants return tasks without it
      const folderKey = await getFolderKey(token);
      if (!mounted) return;

      const tryFetch = async (headers: Record<string, string>) => {
        // Fetch all non-completed, non-faulted tasks — filter by AppName client-side
        // (AppName OData field may not exist on all Orchestrator versions)
        const url = `${apiBase}/odata/Tasks?$filter=Status ne 'Completed' and Status ne 'Faulted'&$orderby=CreationTime desc&$top=50`;
        const res = await fetch(url, { headers });
        if (!res.ok) return [] as ActionCenterTask[];
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = data.value || [];
        // Client-side: keep only tasks belonging to "Claim App Task"
        return all.filter(t => {
          const haystack = [t.Title, t.AppName, t.ExternalTag, t.FormDefinitionName, t.ProcessName]
            .filter(Boolean).join(' ').toLowerCase();
          return haystack.includes('claim app task') || haystack.includes('claim');
        }) as ActionCenterTask[];
      };

      try {
        // Try with folder key first; fall back to without if folder key wasn't found
        const hdrs: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (folderKey) hdrs['x-uipath-folderkey'] = folderKey;
        let tasks = await tryFetch(hdrs);

        // If nothing came back and we used a folder key, retry globally (no folder key)
        if (tasks.length === 0 && folderKey) {
          tasks = await tryFetch({ Authorization: `Bearer ${token}` });
        }

        if (!mounted) return;

        // First poll: mark existing tasks as seen (show them, but no notification)
        if (seenTaskIds.current.size === 0) {
          tasks.forEach(t => seenTaskIds.current.add(t.Id));
          if (tasks.length > 0 && mounted) setActionTasks(tasks);
          return;
        }

        // Subsequent polls: surface newly appeared tasks + trigger notification
        const newTasks = tasks.filter(t => !seenTaskIds.current.has(t.Id));
        newTasks.forEach(t => seenTaskIds.current.add(t.Id));
        if (newTasks.length > 0 && mounted) {
          setActionTasks(prev => [...newTasks, ...prev]);
          showNotifRef.current?.(newTasks[0]);
        }
      } catch { /* silent — don't break the app */ }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [sdk]);

  useEffect(() => {
    conversationalAgent.getAll().then((all) => {
      // Deduplicate by processKey, keep latest by createdTime, then sort latest first
      const byKey = new Map<string, AgentGetResponse>();
      for (const agent of all) {
        const existing = byKey.get(agent.processKey);
        if (!existing) { byKey.set(agent.processKey, agent); continue; }
        const existingTime = existing.createdTime ? new Date(existing.createdTime).getTime() : 0;
        const newTime = agent.createdTime ? new Date(agent.createdTime).getTime() : 0;
        if (newTime > existingTime) byKey.set(agent.processKey, agent);
      }
      const sorted = Array.from(byKey.values()).sort((a, b) => {
        const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return bTime - aTime;
      });
      setAgents(sorted);
      // Default the home page chat to "All in One Agent" if available
      if (!selectedAgent && sorted.length > 0) {
        // "Ask UiPath" agent from Coded Apps / All in One Agent folder
        const allInOne = sorted.find(a => a.name.trim() === 'Ask UiPath' && a.processKey === 'All.in.One.Agent.agent.Agent');
        onSelectAgent(allInOne ?? sorted[0]);
      }
    });
  }, [conversationalAgent]);

  useEffect(() => {
    if (homeNavPressCount) setSelectedResult(null);
  }, [homeNavPressCount]);

  const activeAgent = selectedAgent ?? agents[0] ?? null;

  const toggleVoice = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) {
      const rec = speechRef.current;
      speechRef.current = null; // clear first so onend doesn't restart
      rec?.stop();
      setIsListening(false);
      if (activeAgent) {
        onStartChat(activeAgent, transcript.trim() ? {
          agentName: activeAgent.name, summary: '', timeAgo: '', autoItems: [], reviewItems: [],
          prefill: transcript.trim(),
        } : undefined);
      }
      setTranscript('');
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    speechRef.current = rec;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => {
      // restart automatically unless the ref was cleared (user stopped)
      if (speechRef.current) {
        try { speechRef.current.start(); } catch { /* already started */ }
      } else {
        setIsListening(false);
      }
    };
    rec.onerror = (e: { error: string }) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        speechRef.current = null;
        setIsListening(false);
      }
      // no-speech / aborted — onend will restart
    };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join('');
      setTranscript(text);
    };
    rec.start();
  }, [isListening, activeAgent, onStartChat]);

  const handleActionClick = (item: AgentAction, label: string, labelIdx: number) => {
    setPendingAction({ item, label, labelIdx });
  };

  const DATE_OPTIONS = (() => {
    const now = new Date();
    return [0, 1, 2, 3].map((n) => {
      const d = new Date(now);
      d.setDate(d.getDate() + n);
      return {
        key: n === 0 ? 'today' : n === 1 ? 'tomorrow' : `day-${n}`,
        label: n === 0 ? 'Today' : n === 1 ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        short: n === 0 ? 'Today' : n === 1 ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short' }),
      };
    });
  })();

  const TIME_OPTIONS = [
    { key: 'morning',   label: 'Morning',   sub: '9:00 AM' },
    { key: 'afternoon', label: 'Afternoon', sub: '2:00 PM' },
    { key: 'eod',       label: 'End of Day', sub: '5:00 PM' },
  ];

  const confirmAction = () => {
    if (!pendingAction) return;
    const { item, label } = pendingAction;
    const l = label.toLowerCase();
    let scheduleInfo: string | undefined;
    let msg: string;
    if (l.includes('schedule') || l.includes('snooze')) {
      const dl = DATE_OPTIONS.find(d => d.key === scheduleDate)?.label ?? scheduleDate;
      const tl = TIME_OPTIONS.find(t => t.key === scheduleTime)?.sub ?? scheduleTime;
      scheduleInfo = `${dl} at ${tl}`;
      msg = `Review scheduled · ${scheduleInfo}`;
    } else {
      msg = l.includes('reject') || l.includes('cancel') || l.includes('return')
        ? `${label} submitted`
        : l.includes('request') || l.includes('discuss') || l.includes('negotiate')
        ? `${label} sent`
        : `${label} — confirmed`;
    }
    setResolvedActions((prev) => {
      const next = new Map(prev);
      next.set(item.id, { label, scheduleInfo, decidedAt: new Date() });
      return next;
    });
    setPendingAction(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
    setScheduleNote('');
  };

  const getConfirmConfig = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('reject') || l.includes('cancel') || l.includes('return'))
      return { color: '#f87171', btnBg: 'rgba(239,68,68,0.85)', btnBorder: 'rgba(239,68,68,0.4)', verb: 'Confirm' };
    if (l.includes('approve') || l.includes('verify') || l.includes('clear') || l.includes('issue') || l.includes('confirm'))
      return { color: '#fb923c', btnBg: 'linear-gradient(135deg,#fb923c,#f97316)', btnBorder: 'transparent', verb: 'Confirm' };
    if (l.includes('escalate') || l.includes('notice') || l.includes('hold'))
      return { color: '#fbbf24', btnBg: 'rgba(251,191,36,0.85)', btnBorder: 'rgba(251,191,36,0.4)', verb: 'Confirm' };
    return { color: 'var(--brand-primary)', btnBg: 'var(--brand-primary)', btnBorder: 'transparent', verb: 'Send' };
  };

  /* ── PDF Viewer — replaces HomeTab content within the same container ── */
  if (pdfOpen) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#080d1a' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: '#0c1526', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setPdfOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate" style={{ fontSize: 13.5, color: '#fff' }}>Property Claim Form</p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>HO5-2021-RC-4872 · Handwritten · 4 pages</p>
          </div>
          <span className="font-bold px-2 py-0.5 rounded-md flex-shrink-0"
            style={{ fontSize: 9, background: 'rgba(var(--brand-primary-rgb),0.15)', color: 'var(--brand-primary)', border: '1px solid rgba(var(--brand-primary-rgb),0.3)' }}>PDF</span>
        </div>
        {/* PDF iframe fills remaining space */}
        <iframe
          src="./property-claim-form.pdf"
          className="flex-1 w-full"
          style={{ border: 'none', background: '#080d1a' }}
          title="Property Claim Form"
        />
      </div>
    );
  }

  /* ── Task detail — full in-container page ───────────────────────── */
  if (selectedActionTask) {
    const task = selectedActionTask;
    activeTaskIdRef.current = task.Id;
    const createdAt = new Date(task.CreationTime);
    const timeStr = createdAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isVendorInvoice = task.Id === 1002;
    const isITAccess = task.Id === 1003;
    const isHandwritten = !isVendorInvoice && !isITAccess;
    // Per-task note helpers
    const taskComment = taskNotes.get(task.Id)?.comment ?? '';
    const voiceNoteUrl = taskNotes.get(task.Id)?.voiceUrl ?? null;
    const voiceTranscript = taskNotes.get(task.Id)?.voiceTranscript ?? null;
    const taskDecision = taskDecisions.get(task.Id) ?? null;
    const setTaskComment = (val: string) => setTaskNotes(prev => { const n = new Map(prev); const cur = n.get(task.Id); n.set(task.Id, { comment: val, voiceUrl: cur?.voiceUrl ?? null, voiceTranscript: cur?.voiceTranscript ?? null }); return n; });
    const setVoiceNoteUrl = (url: string | null) => setTaskNotes(prev => { const n = new Map(prev); const cur = n.get(task.Id); n.set(task.Id, { comment: cur?.comment ?? '', voiceUrl: url, voiceTranscript: url === null ? null : cur?.voiceTranscript ?? null }); return n; });
    const setTaskDecision = (d: 'approved' | 'rejected') => setTaskDecisions(prev => { const n = new Map(prev); n.set(task.Id, d); return n; });
    const srcColor = isHandwritten ? '#f59e0b' : 'var(--brand-primary)';
    const srcBg = isHandwritten ? 'rgba(245,158,11,0.08)' : 'rgba(var(--brand-primary-rgb),0.07)';
    const srcBorder = isHandwritten ? 'rgba(245,158,11,0.22)' : 'rgba(var(--brand-primary-rgb),0.18)';
    const srcIconBg = isHandwritten ? 'rgba(245,158,11,0.16)' : 'rgba(var(--brand-primary-rgb),0.14)';
    // Light-theme overrides for task detail modal
    const labelColor = theme === 'light' ? 'rgba(24,33,38,0.5)' : 'rgba(255,255,255,0.4)';
    const valueColor = theme === 'light' ? 'rgba(24,33,38,0.88)' : 'rgba(255,255,255,0.88)';
    const descColor = theme === 'light' ? 'rgba(24,33,38,0.78)' : 'rgba(200,218,245,0.7)';
    const itemNameColor = theme === 'light' ? 'rgba(24,33,38,0.78)' : 'rgba(215,228,252,0.7)';
    const isLightTheme = theme === 'light';
    return (
      <div
        className={isLightTheme ? 'flex flex-col h-full items-center justify-center px-2' : 'flex flex-col h-full'}
        style={{
          background: isLightTheme ? 'rgba(24,33,38,0.88)' : 'rgba(0,0,0,0.75)',
          backdropFilter: isLightTheme ? 'blur(10px)' : 'none',
        }}
        onClick={isLightTheme ? () => setSelectedActionTask(null) : undefined}
      >
        {!isLightTheme && (
          <div className="flex-shrink-0" style={{ height: 28 }}
            onClick={() => setSelectedActionTask(null)} />
        )}
        <div
          className={isLightTheme ? 'w-full flex flex-col overflow-hidden' : 'flex flex-col flex-1 overflow-hidden mx-2'}
          style={{
            background: isLightTheme ? '#ffffff' : '#0c1526',
            borderRadius: isLightTheme ? '24px' : '24px 24px 0 0',
            border: isLightTheme ? '1px solid rgba(var(--brand-primary-rgb),0.18)' : `1px solid ${t.border}`,
            borderBottom: isLightTheme ? '1px solid rgba(var(--brand-primary-rgb),0.18)' : 'none',
            boxShadow: isLightTheme ? '0 20px 60px rgba(24,33,38,0.28), 0 4px 16px rgba(24,33,38,0.1)' : 'none',
            maxHeight: isLightTheme ? '97%' : undefined,
          }}
          onClick={isLightTheme ? (e) => e.stopPropagation() : undefined}
        >

          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />

          {/* Top bar — favicon + title + close (matches Agent Insights) */}
          <div className="flex items-center justify-between px-4 pt-2 pb-3 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img src="./favicon.ico" alt="UiPath" className="w-10 h-10 rounded-full flex-shrink-0" style={{ objectFit: 'cover', background: '#fff' }} />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate" style={{ fontSize: 15, color: 'var(--brand-primary)' }}>
                  {isVendorInvoice ? 'Invoice Approval' : isITAccess ? 'IT Access Request' : 'Property Claim Review'}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="rounded-full px-2.5 py-0.5 font-bold" style={{ fontSize: 10, background: 'rgba(var(--brand-primary-rgb),0.15)', border: '1px solid rgba(var(--brand-primary-rgb),0.45)', color: 'var(--brand-primary)' }}>
                    {task.Status || 'Pending'}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ fontSize: 10, background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}`, color: t.textBody }}>
                    {timeStr}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedActionTask(null)}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)', border: `1px solid ${t.border}` }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)'} strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-6">

          {/* Source tag */}
          <div className="px-5 pt-4 mb-4">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: srcBg, border: `1px solid ${srcBorder}` }}>
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: srcIconBg }}>
                {isHandwritten ? (
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={srcColor} strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" fill={srcColor} fillOpacity={0.18}/>
                    <line x1="16" y1="8" x2="2" y2="22" strokeLinecap="round"/>
                    <line x1="17.5" y1="15" x2="9" y2="15" strokeLinecap="round"/>
                  </svg>
                ) : isVendorInvoice ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={srcColor} strokeWidth={1.9}>
                    <rect x="7" y="7" width="10" height="10" rx="1"/><path strokeLinecap="round" d="M7 9H4M7 12H4M7 15H4M17 9h3M17 12h3M17 15h3M9 7V4M12 7V4M15 7V4M9 17v3M12 17v3M15 17v3"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={srcColor} strokeWidth={1.9}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold" style={{ fontSize: 11.5, color: srcColor }}>{isHandwritten ? 'Handwritten' : 'Machine-Generated'}</p>
                <p style={{ fontSize: 10.5, color: t.textMuted }}>{isVendorInvoice ? 'Auto-parsed digital invoice' : isITAccess ? 'Online form submission' : 'OCR extracted · Field form'}</p>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full font-bold tracking-wide" style={{ fontSize: 8.5, background: srcIconBg, color: srcColor, border: `1px solid ${srcBorder}` }}>
                {isHandwritten ? 'HAND-WRITTEN' : 'DIGITAL'}
              </span>
            </div>
          </div>

          {/* ── VENDOR INVOICE ── */}
          {isVendorInvoice && (<>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>🏢</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Vendor Details</p></div>
              <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                {[['Invoice No', 'INV-2026-0342'], ['Vendor', 'TechSupply FZE'], ['Submitted', '10 Apr 2026'], ['Due Date', '30 Apr 2026']].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center"><span style={{ fontSize: 11.5, color: labelColor }}>{k}</span><span className={k === 'Invoice No' ? 'font-mono font-bold' : 'font-semibold'} style={{ fontSize: 12, color: valueColor }}>{v}</span></div>
                ))}
              </div>
            </div>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>🧾</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Description</p></div>
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                <p style={{ fontSize: 12, color: descColor, lineHeight: 1.6 }}>Annual renewal for cloud infrastructure and software licences for Q2 2026. Includes 12-month support contract. Three competitive quotes obtained — TechSupply FZE selected as preferred vendor.</p>
              </div>
            </div>
            <div className="px-5 mb-4">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>💰</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Line Items</p></div>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
                {[['Cloud infrastructure renewal', '$7,400'], ['Software licences (x12)', '$4,200'], ['Support & maintenance', '$2,600']].map(([item, amt], i, arr) => (
                  <div key={item} className="flex justify-between items-center px-3.5 py-2.5" style={{ background: i % 2 === 0 ? 'rgba(var(--brand-primary-rgb),0.05)' : 'rgba(var(--brand-primary-rgb),0.03)', borderBottom: i < arr.length - 1 ? '1px solid rgba(var(--brand-primary-rgb),0.1)' : 'none' }}>
                    <span style={{ fontSize: 12, color: itemNameColor }}>{item}</span><span className="font-bold" style={{ fontSize: 12.5, color: valueColor }}>{amt}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-3.5 py-3" style={{ background: 'rgba(var(--brand-primary-rgb),0.12)', borderTop: '1px solid rgba(var(--brand-primary-rgb),0.25)' }}>
                  <span className="font-bold" style={{ fontSize: 12.5, color: 'var(--brand-primary)' }}>Total Payable</span><span className="font-bold" style={{ fontSize: 14, color: 'var(--brand-primary)' }}>$14,200</span>
                </div>
              </div>
            </div>
          </>)}

          {/* ── IT ACCESS ── */}
          {isITAccess && (<>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>👤</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Request Details</p></div>
              <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                {[['Request ID', 'EMP-2291'], ['Employee', 'Sara Al-Rashidi'], ['Department', 'Operations'], ['Start Date', '15 Apr 2026'], ['Manager', 'John Doe']].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center"><span style={{ fontSize: 11.5, color: labelColor }}>{k}</span><span className={k === 'Request ID' ? 'font-mono font-bold' : 'font-semibold'} style={{ fontSize: 12, color: valueColor }}>{v}</span></div>
                ))}
              </div>
            </div>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>🧾</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Justification</p></div>
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                <p style={{ fontSize: 12, color: descColor, lineHeight: 1.6 }}>New hire onboarding — Operations team. Access required to core business systems from day one. All requests reviewed and confirmed by department head.</p>
              </div>
            </div>
            <div className="px-5 mb-4">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>🔐</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Access Requested</p></div>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
                {[['Orchestrator Portal', 'Read Only'], ['UiPath Apps', 'Standard User'], ['VPN Access', 'Full'], ['SharePoint (Ops)', 'Contributor']].map(([sys, lvl], i, arr) => (
                  <div key={sys} className="flex justify-between items-center px-3.5 py-2.5" style={{ background: i % 2 === 0 ? 'rgba(var(--brand-primary-rgb),0.05)' : 'rgba(var(--brand-primary-rgb),0.03)', borderBottom: i < arr.length - 1 ? '1px solid rgba(var(--brand-primary-rgb),0.1)' : 'none' }}>
                    <span style={{ fontSize: 12, color: itemNameColor }}>{sys}</span><span className="font-semibold px-2 py-0.5 rounded-md" style={{ fontSize: 10.5, background: 'rgba(var(--brand-primary-rgb),0.15)', color: 'var(--brand-primary)' }}>{lvl}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* ── PROPERTY CLAIM ── */}
          {isHandwritten && (<>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>👤</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Policy Details</p></div>
              <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                {[['Policy No', 'HO5-2021-RC-4872'], ['Policyholder', 'John Doe']].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center"><span style={{ fontSize: 11.5, color: labelColor }}>{k}</span><span className={k === 'Policy No' ? 'font-mono font-bold' : 'font-semibold'} style={{ fontSize: 12, color: valueColor }}>{v}</span></div>
                ))}
              </div>
            </div>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>📍</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Incident Details</p></div>
              <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                {[['Date & Time', '06 Feb 2026 · 7:15 AM'], ['Location', 'Kitchen, Al Furjan, Dubai']].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center"><span style={{ fontSize: 11.5, color: labelColor }}>{k}</span><span className="font-semibold text-right" style={{ fontSize: 12, color: valueColor, maxWidth: '60%' }}>{v}</span></div>
                ))}
              </div>
            </div>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>🧾</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Description</p></div>
              <div className="rounded-2xl p-3.5" style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}>
                <p style={{ fontSize: 12, color: descColor, lineHeight: 1.6 }}>A burst pipe in the kitchen on 6 Feb 2026 (~7:15 AM) caused significant water damage to cabinets, flooring, and the dishwasher. Emergency water mitigation was completed immediately, and repair estimates are being arranged. Damaged items have been retained for inspection.</p>
              </div>
            </div>
            <div className="px-5 mb-3">
              <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>📦</span><p className="font-bold" style={{ fontSize: 12, color: 'rgba(var(--brand-primary-rgb),0.9)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Damaged Items</p></div>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
                {[['Kitchen cabinets', '$4,800'], ['Laminate flooring', '$3,300'], ['Dishwasher', '$1,500']].map(([item, amt], i, arr) => (
                  <div key={item} className="flex justify-between items-center px-3.5 py-2.5" style={{ background: i % 2 === 0 ? 'rgba(var(--brand-primary-rgb),0.05)' : 'rgba(var(--brand-primary-rgb),0.03)', borderBottom: i < arr.length - 1 ? '1px solid rgba(var(--brand-primary-rgb),0.1)' : 'none' }}>
                    <span style={{ fontSize: 12, color: itemNameColor }}>{item}</span><span className="font-bold" style={{ fontSize: 12.5, color: valueColor }}>{amt}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-3.5 py-3" style={{ background: 'rgba(var(--brand-primary-rgb),0.12)', borderTop: '1px solid rgba(var(--brand-primary-rgb),0.25)' }}>
                  <span className="font-bold" style={{ fontSize: 12.5, color: 'var(--brand-primary)' }}>Total Claimed</span>
                  <div className="text-right"><span className="font-bold" style={{ fontSize: 14, color: 'var(--brand-primary)' }}>$9,600</span><span style={{ fontSize: 10, color: 'rgba(var(--brand-primary-rgb),0.6)', marginLeft: 6 }}>– $1,000 ded.</span></div>
                </div>
              </div>
            </div>
            <div className="px-5 mb-4">
              <button onClick={() => setPdfOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-95 transition-transform" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}` }}>
                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(var(--brand-primary-rgb),0.12)', border: '1px solid rgba(var(--brand-primary-rgb),0.25)' }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M13 3v5a1 1 0 001 1h5"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h4"/></svg>
                </div>
                <div className="flex-1 text-left"><p className="font-semibold" style={{ fontSize: 12.5, color: valueColor }}>View Original Claim Form</p><p style={{ fontSize: 10.5, color: t.textMuted }}>Property Insurance · Handwritten · 4 pages</p></div>
                <span className="font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ fontSize: 9, background: 'rgba(var(--brand-primary-rgb),0.15)', color: 'var(--brand-primary)', border: '1px solid rgba(var(--brand-primary-rgb),0.3)' }}>PDF</span>
              </button>
            </div>
          </>)}

          {/* Notes */}
          <div className="px-5 mb-1 flex flex-col gap-2.5">
            {voiceNoteUrl && (
              <div className="rounded-2xl px-3.5 py-3 flex flex-col gap-2" style={{ background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.25)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(var(--brand-primary-rgb),0.2)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--brand-primary)"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0"><p className="font-semibold mb-1" style={{ fontSize: 11.5, color: 'var(--brand-primary)' }}>Voice Note</p><audio src={voiceNoteUrl} controls className="w-full" style={{ height: 28, accentColor: 'var(--brand-primary)' }} /></div>
                  <button onClick={() => setVoiceNoteUrl(null)} className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke={theme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.4)'} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                {voiceTranscript && (
                  <p className="italic leading-relaxed" style={{ fontSize: 12, color: descColor, paddingLeft: 44, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    &ldquo;{voiceTranscript}&rdquo;
                  </p>
                )}
              </div>
            )}
            {taskComment.length > 0 && !isRecording && (
              <div className="rounded-2xl px-3.5 py-3 flex items-start gap-3 min-w-0" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}` }}>
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </div>
                <p className="flex-1 leading-relaxed" style={{ fontSize: 12.5, color: descColor, wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 }}>{taskComment}</p>
                <button onClick={() => setTaskComment('')} className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke={theme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.4)'} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}
            {!taskDecision && (
              <div className="rounded-2xl overflow-hidden" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: isRecording ? '1px solid rgba(239,68,68,0.45)' : `1px solid ${t.border}` }}>
                {isRecording ? (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 1s infinite' }} />
                    <span className="flex-1 font-medium" style={{ fontSize: 13, color: valueColor }}>Recording…</span>
                    <span className="font-mono font-bold" style={{ fontSize: 13, color: '#ef4444' }}>{String(Math.floor(recordingSecs / 60)).padStart(2,'0')}:{String(recordingSecs % 60).padStart(2,'0')}</span>
                  </div>
                ) : (
                  <textarea value={taskComment} onChange={(e) => setTaskComment(e.target.value)} placeholder="Add a text note…" rows={2} className="w-full bg-transparent outline-none resize-none px-4 pt-3 pb-2" style={{ fontSize: 13, color: descColor, caretColor: 'var(--brand-primary)', lineHeight: 1.55 }} />
                )}
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <span style={{ fontSize: 10, color: t.textMuted }}>{isRecording ? 'Tap mic to stop' : 'Text note · optional'}</span>
                  <button onClick={isRecording ? stopRecording : startRecording} className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={isRecording ? { background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)' } : { background: 'rgba(var(--brand-primary-rgb),0.15)', border: '1px solid rgba(var(--brand-primary-rgb),0.3)' }}>
                    {isRecording ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--brand-primary)"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"/></svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Decision banner */}
          {taskDecision && (
            <div className="mx-5 mb-3 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: taskDecision === 'approved' ? 'rgba(var(--brand-primary-rgb),0.12)' : 'rgba(239,68,68,0.12)', border: taskDecision === 'approved' ? '1px solid rgba(var(--brand-primary-rgb),0.35)' : '1px solid rgba(239,68,68,0.35)' }}>
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: taskDecision === 'approved' ? 'rgba(var(--brand-primary-rgb),0.2)' : 'rgba(239,68,68,0.2)' }}>
                {taskDecision === 'approved' ? (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                ) : (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold" style={{ fontSize: 13, color: taskDecision === 'approved' ? 'var(--brand-primary)' : '#f87171' }}>{taskDecision === 'approved' ? 'Task Approved' : 'Task Rejected'}</p>
                <p style={{ fontSize: 11, color: t.textMuted }}>Decision submitted · Tap back to continue</p>
              </div>
            </div>
          )}

          {/* Approve / Reject */}
          <div className="px-5 flex gap-3 pb-2 pt-3">
            <button onClick={() => { setTaskDecision('approved'); setSuccessMsg('Task approved'); }} className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={taskDecision === 'approved' ? { background: 'linear-gradient(135deg,var(--brand-primary),#0d8f9e)', boxShadow: '0 0 20px rgba(var(--brand-primary-rgb),0.5)' } : { background: taskDecision === 'rejected' ? 'rgba(var(--brand-primary-rgb),0.08)' : 'linear-gradient(135deg,var(--brand-primary),#0d8f9e)', boxShadow: taskDecision ? 'none' : '0 0 20px rgba(var(--brand-primary-rgb),0.35)', opacity: taskDecision === 'rejected' ? 0.45 : 1, border: taskDecision === 'rejected' ? '1px solid rgba(var(--brand-primary-rgb),0.2)' : 'none' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span className="text-white">Approve</span>
            </button>
            <button onClick={() => { setTaskDecision('rejected'); setSuccessMsg('Task rejected'); }} className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={taskDecision === 'rejected' ? { background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.7)', boxShadow: '0 0 20px rgba(239,68,68,0.3)' } : { background: taskDecision === 'approved' ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', opacity: taskDecision === 'approved' ? 0.45 : 1 }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              <span style={{ color: '#f87171' }}>Reject</span>
            </button>
          </div>

        </div>{/* end scrollable */}
        </div>{/* end rounded sheet */}
      </div>
    );
  }

  /* ── Voice mode ─────────────────────────────────────────────────── */
  if (isListening) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#000' }}>
        <div className="flex justify-center pt-4 pb-3">
          <div className="px-5 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            Talking to {activeAgent?.name.trim() === 'Ask UiPath' ? 'Ask UiPath' : activeAgent?.name.replace(/_/g, ' ').split(' ')[0] ?? 'Agent'}
          </div>
        </div>
        <p className="text-center text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Go ahead, I'm listening...
        </p>
        <div className="flex-1 flex flex-col justify-center" style={{ background: '#000' }}>
          <VideoEl
            src="./mic-orb.mp4"
            autoPlay loop muted playsInline preload="auto"
            ref={(el) => { if (el && el.readyState >= 2) el.style.opacity = '1'; }}
            style={{ width: '100%', objectFit: 'cover', background: '#000', opacity: 0, transition: 'opacity 0.3s ease' }}
            onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
          />
          {transcript && (
            <p className="text-center px-10 mt-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {transcript}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-12 pb-14">
          {/* Cancel — stop listening and exit without submitting */}
          <button
            onClick={() => {
              const rec = speechRef.current;
              speechRef.current = null;
              rec?.stop();
              setIsListening(false);
              setTranscript('');
            }}
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.55)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Mic — toggle recording (primary recording affordance) */}
          <button onClick={toggleVoice} className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--brand-primary)', boxShadow: '0 0 32px rgba(var(--brand-primary-rgb),0.7)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* Submit — send transcript and open chat. Dim until transcript exists. */}
          <button
            onClick={() => {
              const text = transcript.trim();
              if (!text || !activeAgent) return;
              const rec = speechRef.current;
              speechRef.current = null;
              rec?.stop();
              setIsListening(false);
              setTranscript('');
              onStartChat(activeAgent, {
                agentName: activeAgent.name, summary: '', timeAgo: '', autoItems: [], reviewItems: [],
                prefill: text,
              });
            }}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
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

  /* ── Main home screen ───────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full relative" style={{ background: theme === 'light' ? '#e8ebed' : '#000' }}>
    {/* Video bootstrap (fetch + blob with corrected MIME) lives in index.html. */}
    <div className="flex flex-col h-full overflow-y-auto relative" style={{ background: theme === 'light' ? '#e8ebed' : '#000' }}>


      {/* Optional customer logo — pinned above the orb (admin → Branding),
          matching the welcome/login screens. No logo → nothing renders. */}
      {branding.logo && (
        <div className="flex justify-center flex-shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 32px)', paddingBottom: 4 }}>
          <img src={branding.logo} alt={branding.appName} style={{ ...LOGO_SIZES[branding.logoSize ?? 'large'], objectFit: 'contain' }} />
        </div>
      )}
      {/* Video — fixed height so layout never shifts when video loads */}
      <div className="relative flex-shrink-0" style={{ marginTop: branding.logo ? 8 : 40, height: 320 }}>
        {theme === 'light' ? (
          <LoopingVideo
            src={orbSrc}
            style={{ objectFit: 'cover', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
          />
        ) : (
          <video
            src={orbBlobSrc}
            key={orbBlobSrc}
            autoPlay loop muted playsInline preload="auto"
            ref={(el) => { if (el && el.readyState >= 2) el.style.opacity = '1'; }}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', opacity: 0, transition: 'opacity 0.3s ease' }}
            onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
          />
        )}
      </div>

      {/* Greeting — tight under video */}
      <div className="flex flex-col items-center relative z-10 flex-shrink-0" style={{ paddingTop: 0, paddingBottom: '2rem' }}>
        <h2 className="font-bold mb-1.5 tracking-tight" style={{ fontSize: 24, color: t.textPrimary }}>
          {branding.greeting}{userName ? `, ${userName}` : ''}
        </h2>
        <p className="text-sm" style={{ color: 'rgba(var(--brand-primary-rgb),0.7)' }}>{tr.howCanIHelp}</p>
      </div>

      {/* Input card — single compact row */}
      <div className="px-4 mb-4 relative z-10 flex-shrink-0">
        <div className="rounded-full px-3 flex items-center gap-2" style={{
          background: theme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(8,18,38,0.65)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.25)',
          backdropFilter: 'blur(20px)',
          height: 68,
        }}>
          {/* Camera */}
          <button className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}
            onClick={() => {
              if (activeAgent) onStartChat(activeAgent, { agentName: activeAgent.name, summary: '', timeAgo: '', autoItems: [], reviewItems: [], openCamera: true });
            }}>
            <svg style={{ width: 15, height: 15, color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </button>
          {/* Globe */}
          <button className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
            <svg style={{ width: 15, height: 15, color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            </svg>
          </button>
          {/* Mic */}
          <button onClick={toggleVoice} className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
            <svg style={{ width: 15, height: 15, color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Divider */}
          <div className="flex-shrink-0" style={{ width: 1, height: 22, background: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }} />

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim() && activeAgent) { onStartChat(activeAgent); setInput(''); }
            }}
            placeholder={tr.askAnything}
            className="flex-1 bg-transparent outline-none min-w-0"
            style={{ color: t.textBody, fontSize: 13.5, caretColor: 'var(--brand-primary)' }}
          />

          {/* Send button */}
          <button
            onClick={() => activeAgent && (input.trim() ? (onStartChat(activeAgent), setInput('')) : onStartChat(activeAgent))}
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{
              background: 'var(--brand-secondary)',
              boxShadow: '0 0 16px rgba(var(--brand-secondary-rgb),0.5)',
              transition: 'all 0.2s',
            }}
          >
            <svg style={{ width: 15, height: 15 }} className="text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>


      {/* Automation Showcase — scrolling carousel of all capability types */}
      {(() => {
        const ORANGE = branding.primaryColor;
        // Carousel items come from runtime config so admins can swap names,
        // categories, videos, and per-item accent colors per tenant.
        const showcaseItems = homeShowcase;
        const doubled = [...showcaseItems, ...showcaseItems];

        return (
          <div className="pb-5 relative z-10 flex-shrink-0">
            <style>{`
              @keyframes agentScroll {
                0%   { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
              }
              @keyframes fadeSlideUp {
                from { transform: translateX(-50%) translateY(12px); opacity: 0; }
                to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
              }
            `}</style>
            <p className="font-bold text-sm mb-3 px-4" style={{ color: t.textPrimary }}>{tr.recentlyActiveAgents}</p>
            <div className="relative overflow-hidden" style={{ paddingLeft: 16 }}>
              <div className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none" style={{ width: 16, background: theme === 'light' ? 'linear-gradient(to right, #e8ebed, transparent)' : 'linear-gradient(to right, #000, transparent)' }} />
              <div className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none" style={{ width: 32, background: theme === 'light' ? 'linear-gradient(to left, #e8ebed, transparent)' : 'linear-gradient(to left, #000, transparent)' }} />
              <div className="flex gap-3 pb-1" style={{ animation: 'agentScroll 60s linear infinite', width: 'max-content' }}>
                {doubled.map((item, i) => {
                  const isLight = theme === 'light';
                  const borderColor = item.color === ORANGE ? 'rgba(var(--brand-primary-rgb),0.35)' : 'rgba(var(--brand-primary-rgb),0.35)';
                  const cardBg = isLight ? '#ffffff' : '#070710';
                  const cardBorder = isLight
                    ? (item.color === ORANGE ? 'rgba(var(--brand-primary-rgb),0.22)' : 'rgba(var(--brand-primary-rgb),0.22)')
                    : borderColor;
                  const cardShadow = isLight
                    ? `0 1px 2px rgba(24,33,38,0.04), 0 4px 12px rgba(24,33,38,0.06)`
                    : 'none';
                  // Card accent follows the active theme (not the per-card color
                  // stored in config). Alternate primary / secondary so re-theming
                  // recolors these and the secondary brand color shows up subtly.
                  const cardColor = i % 2 === 0
                    ? branding.primaryColor
                    : (branding.secondaryColor || branding.primaryColor);
                  const badgeBg = isLight ? `${cardColor}1f` : `${cardColor}18`;
                  const badgeBorder = isLight ? `${cardColor}4d` : `${cardColor}30`;
                  const handleClick = () => {
                    if (item.chatAgentName) {
                      const matched = agents.find(a => a.name.trim() === item.chatAgentName);
                      if (matched) onStartChat(matched);
                    } else if (item.exploreCategory) {
                      onNavigateToExplore?.(item.exploreCategory);
                    }
                  };
                  return (
                    <button
                      key={`showcase-${i}`}
                      onClick={handleClick}
                      className="flex-shrink-0 rounded-2xl overflow-hidden flex flex-col text-left active:scale-95 transition-transform"
                      style={{ width: 130, background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                    >
                      {/* Video animation */}
                      <div className="relative overflow-hidden flex-shrink-0" style={{ height: 90, background: isLight ? '#f0f1f3' : '#070710' }}>
                        <VideoEl
                          src={
                            isLight && item.category === 'Chat Agent' ? './chat-agent-card.mp4' :
                            isLight && item.category === 'RPA' ? './rpa-card-light.mp4' :
                            (item.video ?? './agent-card.mp4')
                          }
                          autoPlay muted playsInline preload="auto"
                          poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
                          style={{ width: '100%', height: '100%', objectFit: isLight && (item.category === 'Chat Agent' || item.category === 'RPA') ? 'cover' : 'contain', objectPosition: isLight && item.category === 'RPA' ? 'center 85%' : 'center', opacity: 0, transition: 'opacity 0.5s ease', transform: isLight && item.category === 'RPA' ? 'scale(1.3)' : isLight && item.category === 'Chat Agent' ? 'scale(1.15)' : `scale(${item.videoScale ?? 1})` }}
                          onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                          onTimeUpdate={(e) => { const v = e.target as HTMLVideoElement; if (v.duration && v.currentTime >= v.duration - 0.15) v.currentTime = 0; }}
                          onEnded={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 0; v.play(); }}
                        />
                        {!isLight && (
                          <>
                            <span className="absolute top-2 left-2.5 w-1.5 h-1.5 rounded-full" style={{ background: cardColor, boxShadow: `0 0 5px ${cardColor}` }} />
                            <div className="absolute bottom-0 left-0 right-0" style={{ height: 24, background: 'linear-gradient(to bottom, transparent, #070710)' }} />
                          </>
                        )}
                      </div>
                      {/* Name + category */}
                      <div className="px-3 pb-2 pt-2">
                        <p className="font-bold text-left leading-tight" style={{ fontSize: 11.5, color: t.textPrimary, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </p>
                        <span className="inline-block rounded-md px-1.5 py-0.5 mt-0.5" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' as const, color: cardColor, background: badgeBg, border: `1px solid ${badgeBorder}` }}>{item.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Approvals — Mobile Approvals launcher */}
      {onOpenApprovals && (() => {
        const ap = approvalsPulse();
        return (
          <div className="px-4 pb-5 relative z-10 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 8px rgba(var(--brand-primary-rgb),0.7)' }} />
                <p className="font-bold" style={{ fontSize: 16, color: t.textPrimary, letterSpacing: -0.3 }}>Approvals</p>
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(var(--brand-primary-rgb),0.6)' }}>{tr.tapToView}</span>
            </div>
            <button type="button" onClick={onOpenApprovals} className="w-full text-left" style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(var(--brand-primary-rgb),0.4)' }}>
                <Icn name="check" size={24} color="#fff" strokeWidth={2.4} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.textPrimary }}>{ap.pending} pending your approval</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, fontSize: 12, color: t.textMuted }}>
                  <span>{money(ap.value)} awaiting</span>
                  {ap.breaching > 0 && <span style={{ color: '#E0904A', fontWeight: 600 }}>{ap.breaching} SLA breach</span>}
                </div>
              </div>
              <Icn name="chevron" size={18} color={t.chevron} />
            </button>
          </div>
        );
      })()}

      {/* Key Relationships — Customer 360 launcher (Option B entry) */}
      {onOpenCustomers && (() => {
        const p = branchPulse();
        return (
          <div className="px-4 pb-5 relative z-10 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 8px rgba(var(--brand-primary-rgb),0.7)' }} />
                <p className="font-bold" style={{ fontSize: 16, color: t.textPrimary, letterSpacing: -0.3 }}>Key Relationships</p>
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(var(--brand-primary-rgb),0.6)' }}>{tr.tapToView}</span>
            </div>
            <button type="button" onClick={onOpenCustomers} className="w-full text-left" style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex' }}>
                {customers.slice(0, 3).map((c, i) => (
                  <span key={c.id} style={{ marginLeft: i ? -12 : 0, border: `2px solid ${t.bgPrimary}`, borderRadius: 14 }}><Avatar initials={c.initials} size={38} /></span>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.textPrimary }}>{p.relationships} clients in your branch</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, fontSize: 12, color: t.textMuted }}>
                  <span style={{ color: '#E0904A', fontWeight: 600 }}>{p.atRisk} at-risk</span>
                  <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>✦ {p.nbas} actions</span>
                </div>
              </div>
              <Icn name="chevron" size={18} color={t.chevron} />
            </button>
          </div>
        );
      })()}

      {/* Agent Insights — completed run results */}
      <div className="px-4 pb-5 relative z-10 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 rounded-full" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 8px rgba(var(--brand-primary-rgb),0.7)' }} />
            <p className="font-bold" style={{ fontSize: 16, color: t.textPrimary, letterSpacing: -0.3 }}>{tr.agentInsights}</p>
          </div>
          <span className="text-xs font-medium" style={{ color: 'rgba(var(--brand-primary-rgb),0.6)' }}>{tr.tapToView}</span>
        </div>
        <div className="flex flex-col gap-3">
          {(demoContent.enabled ? demoContent.agentInsights : []).map((result) => {
            const autoCount = result.actions.filter(a => a.type === 'auto').length;
            const reviewCount = result.actions.filter(a => a.type === 'review').length;
            return (
              <button
                key={result.id}
                onClick={() => { setSelectedResult(result); setModalFilter(null); }}
                className="rounded-2xl px-4 py-3.5 text-left active:scale-95 transition-transform"
                style={{
                  background: t.bgCard,
                  border: reviewCount > 0 ? '1px solid rgba(251,146,60,0.25)' : `1px solid ${t.border}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: result.accentColor }} />
                    <span className="font-semibold" style={{ fontSize: 12.5, color: t.textPrimary }}>{result.agentName}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(var(--brand-primary-rgb),0.5)' }}>{result.timeAgo}</span>
                </div>
                <p className="leading-snug mb-2.5" style={{ fontSize: 13, color: t.textBody }}>
                  {result.summary}
                </p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: 'rgba(var(--brand-primary-rgb),0.12)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)', color: 'var(--brand-primary)' }}>
                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    {autoCount} {tr.autoHandled}
                  </span>
                  {reviewCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ fontSize: 10, background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#fb923c"><circle cx="12" cy="12" r="10"/><path fill="white" d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                      {reviewCount} {reviewCount === 1 ? tr.needsYou : tr.needYou}
                    </span>
                  )}
                  <div className="flex-1" />
                  <svg style={{ width: 13, height: 13, color: 'rgba(var(--brand-primary-rgb),0.4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Action Center — pending tasks ── */}
      {actionTasks.length > 0 && (
        <div className="px-4 pb-8 relative z-10 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 rounded-full" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 8px rgba(var(--brand-primary-rgb),0.7)' }} />
              <p className="font-bold" style={{ fontSize: 16, color: t.textPrimary, letterSpacing: -0.3 }}>{tr.onYourDesk}</p>
              <span className="px-2 py-0.5 rounded-full font-bold" style={{ fontSize: 10, background: 'rgba(var(--brand-primary-rgb),0.18)', border: '1px solid rgba(var(--brand-primary-rgb),0.4)', color: 'var(--brand-primary)' }}>
                {actionTasks.length} {tr.pendingLabel}
              </span>
            </div>
            <button onClick={() => onNavigateToTasks?.()} className="text-xs font-medium active:opacity-70 transition-opacity" style={{ color: 'rgba(var(--brand-primary-rgb),0.6)' }}>{tr.tapToViewAll}</button>
          </div>
          <div className="flex flex-col gap-3">
            {actionTasks.map((task) => {
              const createdAt = new Date(task.CreationTime);
              const diffMs = Date.now() - createdAt.getTime();
              const diffMin = Math.floor(diffMs / 60000);
              const timeAgo = diffMin < 1 ? 'just now' : diffMin < 60 ? `${diffMin}m ago` : `${Math.floor(diffMin / 60)}h ago`;

              return (
                <button
                  key={task.Id}
                  onClick={() => setSelectedActionTask(task)}
                  className="rounded-2xl px-4 py-3.5 text-left active:scale-95 transition-transform w-full"
                  style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 6px var(--brand-primary)' }} />
                      <span className="font-semibold" style={{ fontSize: 12.5, color: t.textPrimary }}>
                        {task.category ?? 'Claim App Task'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-semibold" style={{ fontSize: 9, background: 'rgba(var(--brand-primary-rgb),0.18)', border: '1px solid rgba(var(--brand-primary-rgb),0.35)', color: 'var(--brand-primary)' }}>
                        {tr.actionRequired}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: t.textMuted }}>{timeAgo}</span>
                  </div>
                  <p className="leading-snug mb-2.5" style={{ fontSize: 13, color: t.textBody }}>
                    {task.Title || 'A new action center task has been assigned and is awaiting your review.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ fontSize: 10, background: 'rgba(var(--brand-primary-rgb),0.13)', border: '1px solid rgba(var(--brand-primary-rgb),0.28)', color: 'var(--brand-primary)' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--brand-primary)"><circle cx="12" cy="12" r="10"/><path fill="white" d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                      {tr.needsYou}
                    </span>
                    <div className="flex-1" />
                    {task.AssignedToUser && (
                      <span style={{ fontSize: 10, color: t.textMuted }}>{task.AssignedToUser}</span>
                    )}
                    <svg style={{ width: 13, height: 13, color: 'rgba(var(--brand-primary-rgb),0.4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>

      {/* ── Action Center slide-down notification ── */}
      {notifTask && (
        <div
          ref={notifElRef}
          className="fixed left-0 right-0 z-[200] flex justify-center"
          style={{
            top: 0,
            padding: '12px 16px 0',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            transform: notifVisible ? 'translateY(0)' : 'translateY(-110%)',
            opacity: notifVisible ? 1 : 0,
            pointerEvents: notifVisible ? 'auto' : 'none',
          }}
          onTouchStart={(e) => { notifTouchStartY.current = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            const dy = e.touches[0].clientY - notifTouchStartY.current;
            if (dy < 0 && notifElRef.current) {
              notifElRef.current.style.transform = `translateY(${dy}px)`;
              notifElRef.current.style.opacity = String(Math.max(0, 1 + dy / 80));
            }
          }}
          onTouchEnd={(e) => {
            const dy = e.changedTouches[0].clientY - notifTouchStartY.current;
            if (dy < -40) {
              dismissNotif();
            } else if (notifElRef.current) {
              notifElRef.current.style.transform = 'translateY(0)';
              notifElRef.current.style.opacity = '1';
            }
          }}
        >
          <button
            onClick={() => { setSelectedActionTask(notifTask); dismissNotif(); }}
            className="w-full max-w-sm rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
            style={{
              background: theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(12,16,32,0.96)',
              border: '1px solid rgba(var(--brand-primary-rgb),0.45)',
              backdropFilter: 'blur(20px)',
              boxShadow: theme === 'light' ? '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(var(--brand-primary-rgb),0.1)' : '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(var(--brand-primary-rgb),0.1)',
            }}
          >
            {/* Icon */}
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(var(--brand-primary-rgb),0.18)', border: '1px solid rgba(var(--brand-primary-rgb),0.35)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold" style={{ fontSize: 12.5, color: t.textPrimary }}>{tr.onYourDesk}</span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand-primary)', boxShadow: '0 0 5px var(--brand-primary)' }} />
              </div>
              <p className="truncate" style={{ fontSize: 11.5, color: t.textBody }}>
                {notifTask.Title || 'Claim App Task — review required'}
              </p>
            </div>
            {/* Chevron */}
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(var(--brand-primary-rgb),0.6)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}


      {/* ── Success toast ── */}
      {successMsg && (
        <div className="fixed bottom-24 left-1/2 z-[110] flex items-center gap-2.5 px-4 py-3 rounded-2xl"
          style={{
            transform: 'translateX(-50%)',
            background: theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(10,20,40,0.95)',
            border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
            backdropFilter: 'blur(16px)',
            boxShadow: theme === 'light' ? '0 8px 32px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeSlideUp 0.3s ease',
          }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.2)' }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      {/* ── Confirmation bottom sheet ── */}
      {pendingAction && (() => {
        const { item, label } = pendingAction;
        const cfg = getConfirmConfig(label);
        const isSchedule = label.toLowerCase().includes('schedule') || label.toLowerCase().includes('snooze');
        const selDate = DATE_OPTIONS.find(d => d.key === scheduleDate) ?? DATE_OPTIONS[1];
        const selTime = TIME_OPTIONS.find(t => t.key === scheduleTime) ?? TIME_OPTIONS[1];

        return (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setPendingAction(null)}
          >
            <div
              className="w-full max-w-sm rounded-t-3xl px-5 pt-4 pb-10 flex flex-col gap-4"
              style={{ background: theme === 'light' ? '#ffffff' : '#0d1830', border: `1px solid ${t.border}`, animation: 'slideUp 0.25s ease' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full mx-auto mb-1" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }} />

              {/* Action header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isSchedule ? 'rgba(167,139,250,0.15)' : `${cfg.color}22`, border: isSchedule ? '1px solid rgba(167,139,250,0.3)' : `1px solid ${cfg.color}44` }}>
                  {isSchedule ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={2}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={cfg.color} strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: isSchedule ? '#a78bfa' : cfg.color }}>{label}</p>
                  <p className="text-xs" style={{ color: t.textMuted }}>
                    {isSchedule ? 'Pick a date and time' : 'Confirm your action'}
                  </p>
                </div>
              </div>

              {/* Item card */}
              <div className="rounded-2xl p-3.5" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}` }}>
                {(item.ref || item.amount) && (
                  <div className="flex items-center gap-2 mb-2">
                    {item.ref && <span className="px-2 py-0.5 rounded-md font-mono font-semibold"
                      style={{ fontSize: 10, background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>{item.ref}</span>}
                    {item.amount && <span className="font-bold" style={{ fontSize: 13, color: t.textPrimary }}>{item.amount}</span>}
                  </div>
                )}
                <p style={{ fontSize: 12.5, color: t.textBody, lineHeight: 1.5 }}>{item.text}</p>
              </div>

              {/* ── Schedule picker (only for schedule-type actions) ── */}
              {isSchedule ? (
                <>
                  {/* Date picker */}
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: t.textMuted }}>DATE</p>
                    <div className="flex gap-2">
                      {DATE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setScheduleDate(opt.key)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          style={scheduleDate === opt.key ? {
                            background: 'rgba(167,139,250,0.2)',
                            border: '1px solid rgba(167,139,250,0.55)',
                            color: theme === 'light' ? '#7c3aed' : '#c4b5fd',
                          } : {
                            background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${t.border}`,
                            color: t.textMuted,
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time picker */}
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: t.textMuted }}>TIME</p>
                    <div className="flex gap-2">
                      {TIME_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setScheduleTime(opt.key)}
                          className="flex-1 py-2.5 rounded-xl flex flex-col items-center gap-0.5 transition-all active:scale-95"
                          style={scheduleTime === opt.key ? {
                            background: 'rgba(167,139,250,0.2)',
                            border: '1px solid rgba(167,139,250,0.55)',
                          } : {
                            background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${t.border}`,
                          }}>
                          <span className="text-xs font-semibold"
                            style={{ color: scheduleTime === opt.key ? (theme === 'light' ? '#7c3aed' : '#c4b5fd') : t.textMuted }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: 10, color: scheduleTime === opt.key ? (theme === 'light' ? 'rgba(124,58,237,0.7)' : 'rgba(196,181,253,0.7)') : t.textMuted }}>
                            {opt.sub}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes (optional) */}
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: t.textMuted }}>NOTE <span style={{ fontWeight: 400, color: t.textMuted }}>(optional)</span></p>
                    <input
                      type="text"
                      value={scheduleNote}
                      onChange={(e) => setScheduleNote(e.target.value)}
                      placeholder="e.g. Gather additional docs before review"
                      className="w-full rounded-xl px-3.5 py-2.5 text-xs outline-none"
                      style={{
                        background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${t.border}`,
                        color: t.textBody,
                      }}
                    />
                  </div>

                  {/* Summary line */}
                  <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                    style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <p style={{ fontSize: 12, color: theme === 'light' ? 'rgba(124,58,237,0.9)' : 'rgba(196,181,253,0.85)' }}>
                      Scheduled · <strong>{selDate.label}</strong> at <strong>{selTime.sub}</strong>
                    </p>
                  </div>

                  {/* Confirm schedule */}
                  <button
                    onClick={confirmAction}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white active:opacity-80 transition-opacity"
                    style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}>
                    Confirm Schedule
                  </button>
                </>
              ) : (
                <>
                  {/* Warning note */}
                  <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
                    {label.toLowerCase().includes('reject') || label.toLowerCase().includes('cancel')
                      ? 'This action cannot be undone. Proceed?'
                      : label.toLowerCase().includes('approve')
                      ? 'You are confirming this decision as the responsible reviewer.'
                      : 'This will be actioned immediately on your behalf.'}
                  </p>
                  {/* Confirm */}
                  <button
                    onClick={confirmAction}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-white active:opacity-80 transition-opacity"
                    style={{ background: cfg.btnBg, border: `1px solid ${cfg.btnBorder}` }}>
                    {cfg.verb} — {label}
                  </button>
                </>
              )}

              <button
                onClick={() => setPendingAction(null)}
                className="w-full py-2.5 rounded-2xl text-sm font-semibold active:opacity-70"
                style={{ background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${t.border}`, color: t.textMuted }}>
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* Result detail modal */}
      {selectedResult && (() => {
        const reviewItems = selectedResult.actions.filter(a => a.type === 'review' && !resolvedActions.has(a.id));
        const decidedItems = selectedResult.actions.filter(a => a.type === 'review' && resolvedActions.has(a.id));
        const autoItems = selectedResult.actions.filter(a => a.type === 'auto');
        const matchedAgent = agents.find(a => a.name.replace(/_/g,' ') === selectedResult.agentName) ?? agents[0] ?? null;
        return (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center px-4"
            style={{
              background: theme === 'light'
                ? '#182126'
                : 'rgba(0,0,0,0.88)',
              backdropFilter: theme === 'light' ? 'none' : 'blur(10px)',
            }}
            onClick={() => setSelectedResult(null)}
          >
            <div
              className="w-full rounded-3xl flex flex-col"
              style={{
                background: theme === 'light'
                  ? 'linear-gradient(165deg, #fafcff 0%, #eef3f7 100%)'
                  : '#0b1220',
                border: theme === 'light' ? '1px solid rgba(var(--brand-primary-rgb),0.18)' : `1px solid ${t.border}`,
                boxShadow: theme === 'light'
                  ? '0 20px 60px rgba(24,33,38,0.28), 0 4px 16px rgba(24,33,38,0.1)'
                  : 'none',
                maxHeight: '88%',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top spacing */}
              <div className="pt-2" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <img src="./favicon.ico" alt="UiPath" className="w-10 h-10 rounded-full flex-shrink-0" style={{ objectFit: 'cover', background: '#fff' }} />
                  <div>
                    <p className="font-bold" style={{ fontSize: 15, color: t.textPrimary }}>{selectedResult.agentName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-primary)' }} />
                      <p style={{ fontSize: 11, color: 'rgba(var(--brand-primary-rgb),0.7)' }}>Completed · {selectedResult.timeAgo}</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedResult(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: t.bgCardStrong, border: `1px solid ${t.borderStrong}` }}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={t.textPrimary} strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats bar — tappable filters */}
              <div className="flex gap-2 px-5 pb-4 flex-shrink-0 items-stretch">
                <button
                  className="rounded-xl px-3 py-2.5 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                  onClick={() => setModalFilter(null)}
                  style={{
                    background: modalFilter === null ? 'rgba(var(--brand-primary-rgb),0.15)' : t.bgCard,
                    border: modalFilter === null ? '1px solid rgba(var(--brand-primary-rgb),0.4)' : `1px solid ${t.border}`,
                    minWidth: 40,
                  }}>
                  <p className="font-semibold text-xs" style={{ color: modalFilter === null ? 'rgba(var(--brand-primary-rgb),0.9)' : 'rgba(var(--brand-primary-rgb),0.6)' }}>All</p>
                </button>
                <button
                  className="flex-1 rounded-xl px-3 py-2.5 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                  onClick={() => setModalFilter(modalFilter === 'auto' ? null : 'auto')}
                  style={{
                    background: modalFilter === 'auto' ? 'rgba(var(--brand-primary-rgb),0.18)' : 'rgba(var(--brand-primary-rgb),0.08)',
                    border: modalFilter === 'auto' ? '1px solid rgba(var(--brand-primary-rgb),0.45)' : '1px solid rgba(var(--brand-primary-rgb),0.18)',
                  }}>
                  <p className="font-bold text-lg" style={{ color: 'var(--brand-primary)', lineHeight: 1 }}>{autoItems.length}</p>
                  <p style={{ fontSize: 10, color: 'rgba(var(--brand-primary-rgb),0.65)' }}>Agent handled</p>
                </button>
                <button
                  className="flex-1 rounded-xl px-3 py-2.5 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                  onClick={() => setModalFilter(modalFilter === 'review' ? null : 'review')}
                  style={{
                    background: modalFilter === 'review' ? 'rgba(251,146,60,0.2)' : (reviewItems.length > 0 ? 'rgba(251,146,60,0.1)' : 'rgba(var(--brand-primary-rgb),0.08)'),
                    border: modalFilter === 'review' ? '1px solid rgba(251,146,60,0.55)' : (reviewItems.length > 0 ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(var(--brand-primary-rgb),0.18)'),
                  }}>
                  <p className="font-bold text-lg" style={{ color: reviewItems.length > 0 ? '#fb923c' : 'var(--brand-primary)', lineHeight: 1 }}>{reviewItems.length}</p>
                  <p style={{ fontSize: 10, color: reviewItems.length > 0 ? 'rgba(251,146,60,0.65)' : 'rgba(var(--brand-primary-rgb),0.65)' }}>Need{reviewItems.length === 1 ? 's' : ''} your input</p>
                </button>
              </div>

              <div className="px-5 pb-6 flex flex-col gap-4">
                {/* ── REQUIRES YOUR INPUT ── */}
                {(modalFilter === null || modalFilter === 'review') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#fb923c"><circle cx="12" cy="12" r="10"/><path fill="white" d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                      <p className="text-xs font-semibold tracking-wider" style={{ color: '#fb923c' }}>REQUIRES YOUR INPUT</p>
                    </div>
                    {reviewItems.length === 0 ? (
                      <div className="rounded-2xl p-4 flex items-center gap-3"
                        style={{ background: 'rgba(var(--brand-primary-rgb),0.07)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(var(--brand-primary-rgb),0.15)' }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p style={{ fontSize: 13, color: 'rgba(var(--brand-primary-rgb),0.85)' }}>All items reviewed — great work!</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {reviewItems.map((action) => (
                          <div key={action.id} className="rounded-2xl p-4"
                            style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.28)' }}>
                            {/* Ref + amount */}
                            {(action.ref || action.amount) && (
                              <div className="flex items-center gap-2 mb-2">
                                {action.ref && (
                                  <span className="px-2 py-0.5 rounded-md font-mono font-semibold"
                                    style={{ fontSize: 10, background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>{action.ref}</span>
                                )}
                                {action.amount && (
                                  <span className="font-bold" style={{ fontSize: 13, color: t.textPrimary }}>{action.amount}</span>
                                )}
                              </div>
                            )}
                            <p style={{ fontSize: 13, color: theme === 'light' ? 'rgba(120,60,0,0.85)' : 'rgba(255,220,180,0.85)', lineHeight: 1.5 }}>{action.text}</p>
                            {/* Review action buttons */}
                            {action.reviewActions && (
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {action.reviewActions.map((label, i) => {
                                  const btnStyle = i === 0
                                    ? { background: 'var(--brand-primary)', color: 'white', boxShadow: '0 0 12px rgba(var(--brand-primary-rgb),0.35)' }
                                    : { background: t.bgCard, border: `1px solid ${t.border}`, color: t.textBody };
                                  return (
                                    <button key={label}
                                      onClick={(e) => { e.stopPropagation(); handleActionClick(action, label, i); }}
                                      className="px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                                      style={btnStyle}>
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── YOUR DECISIONS ── */}
                    {decidedItems.length > 0 && (
                      <div className="flex flex-col gap-2 mt-3">
                        <p className="text-xs font-semibold tracking-wider mb-1.5" style={{ color: 'rgba(var(--brand-primary-rgb),0.5)' }}>YOUR DECISIONS</p>
                        {decidedItems.map((action) => {
                          const decision = resolvedActions.get(action.id)!;
                          const isSchedule = decision.label.toLowerCase().includes('schedule');
                          const isReject = decision.label.toLowerCase().includes('reject') || decision.label.toLowerCase().includes('cancel');
                          const badgeColor = isSchedule ? '#a78bfa' : isReject ? '#f87171' : '#fb923c';
                          const badgeBg = isSchedule ? 'rgba(167,139,250,0.12)' : isReject ? 'rgba(248,113,113,0.12)' : 'rgba(251,146,60,0.12)';
                          const badgeBorder = isSchedule ? 'rgba(167,139,250,0.3)' : isReject ? 'rgba(248,113,113,0.25)' : 'rgba(251,146,60,0.25)';
                          return (
                            <div key={action.id} className="rounded-2xl p-3.5"
                              style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                              {(action.ref || action.amount) && (
                                <div className="flex items-center gap-2 mb-1.5">
                                  {action.ref && (
                                    <span className="px-2 py-0.5 rounded-md font-mono font-semibold"
                                      style={{ fontSize: 10, background: t.bgCard, color: t.textMuted }}>{action.ref}</span>
                                  )}
                                  {action.amount && (
                                    <span className="font-semibold" style={{ fontSize: 12, color: t.textMuted }}>{action.amount}</span>
                                  )}
                                </div>
                              )}
                              <p className="mb-2.5" style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {action.text}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
                                  style={{ background: badgeBg, border: `1px solid ${badgeBorder}` }}>
                                  {isSchedule ? (
                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={badgeColor} strokeWidth={2.5}>
                                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                  ) : isReject ? (
                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={badgeColor} strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                  ) : (
                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={badgeColor} strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                    </svg>
                                  )}
                                  <span className="font-semibold" style={{ fontSize: 11, color: badgeColor }}>{decision.label}</span>
                                </div>
                                {decision.scheduleInfo && (
                                  <span style={{ fontSize: 11, color: 'rgba(196,181,253,0.6)' }}>{decision.scheduleInfo}</span>
                                )}
                                <span style={{ fontSize: 10, color: 'rgba(var(--brand-primary-rgb),0.4)', marginLeft: 'auto' }}>
                                  {decision.decidedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── AGENT HANDLED ── */}
                {(modalFilter === null || modalFilter === 'auto') && <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    <p className="text-xs font-semibold tracking-wider" style={{ color: 'var(--brand-primary)' }}>HANDLED AUTONOMOUSLY</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {autoItems.map((action) => (
                      <div key={action.id} className="rounded-xl px-4 py-3 flex gap-3 items-start"
                        style={{ background: 'rgba(var(--brand-primary-rgb),0.05)', border: '1px solid rgba(var(--brand-primary-rgb),0.12)' }}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--brand-primary)" strokeWidth={2.5} className="flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        <div className="flex-1 min-w-0">
                          {(action.ref || action.amount) && (
                            <div className="flex items-center gap-2 mb-1">
                              {action.ref && <span className="font-mono text-xs font-semibold" style={{ color: 'rgba(var(--brand-primary-rgb),0.85)' }}>{action.ref}</span>}
                              {action.amount && <span className="text-xs font-semibold" style={{ color: t.textBody }}>{action.amount}</span>}
                            </div>
                          )}
                          <p style={{ fontSize: 12.5, color: t.textBody, lineHeight: 1.45 }}>{action.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>}

                {/* Discuss button */}
                <button
                  onClick={() => {
                    setSelectedResult(null);
                    if (matchedAgent) {
                      onStartChat(matchedAgent, {
                        agentName: selectedResult.agentName,
                        summary: selectedResult.summary,
                        timeAgo: selectedResult.timeAgo,
                        autoItems: selectedResult.actions.filter(a => a.type === 'auto').map(a => ({ ref: a.ref, amount: a.amount, text: a.text })),
                        reviewItems: selectedResult.actions.filter(a => a.type === 'review').map(a => ({ ref: a.ref, amount: a.amount, text: a.text })),
                      });
                    }
                  }}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
                  style={{ background: 'var(--brand-primary)', boxShadow: '0 0 20px rgba(var(--brand-primary-rgb),0.4)' }}
                >
                  Discuss with Agent
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
