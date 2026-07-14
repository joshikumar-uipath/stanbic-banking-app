import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import type { AgentGetResponse } from '@uipath/uipath-typescript/conversational-agent';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../config';
import { useAuth } from '../hooks/useAuth';
import VideoEl from './VideoEl';

const ORG_NAME = import.meta.env.VITE_UIPATH_ORG_NAME;
const TENANT_NAME = import.meta.env.VITE_UIPATH_TENANT_NAME;
// In dev, use relative URL (Vite proxy). In production, use the .api. subdomain (CORS-enabled).
const API_BASE = import.meta.env.DEV
  ? `/${ORG_NAME}/${TENANT_NAME}/orchestrator_`
  : `https://staging.api.uipath.com/${ORG_NAME}/${TENANT_NAME}/orchestrator_`;
// Folder: Insurance / CX - Insurance in WhatsApp
const INSURANCE_FOLDER_ID = '2683975';

interface ProcessRelease {
  Name: string;
  Description?: string | null;
  ProcessKey: string;
  ProcessVersion?: string | null;
  ProcessType?: string | null;
  Key?: string | null;
}

interface OrchestratorJob {
  Id: number;
  Key: string;
  State: string;
  CreationTime: string;
  StartTime?: string | null;
  EndTime?: string | null;
  ReleaseName: string;
  HostMachineName?: string | null;
  Source?: string | null;
  Info?: string | null;
}

interface ActionCenterTask {
  Id: number;
  Title: string;
  CreationTime: string;
  Status: string;
  Priority?: string | null;
  DueDate?: string | null;
  TaskAssigneeName?: string | null;
  AssignedToUserId?: number | null;
  IsDeleted: boolean;
  Type?: string | null;
  OrganizationUnitId?: number | null;
  CompletionTime?: string | null;
}


function getDisplayName(agent: AgentGetResponse): string {
  const raw = agent.name.trim();
  const GENERIC = ['agent', 'assistant', 'bot', 'ai'];
  if (!GENERIC.includes(raw.toLowerCase()) && raw.length > 0) return raw;
  if (!agent.processKey) return raw;
  const parts = agent.processKey.split('.');
  const nonGenericParts = parts.filter(p => !GENERIC.includes(p.toLowerCase()) && p.length > 2);
  if (nonGenericParts.length === 0) return raw;
  const first = nonGenericParts[0];
  const last = nonGenericParts[nonGenericParts.length - 1];
  return (first === last ? first : `${first} · ${last}`).replace(/_/g, ' ');
}

type TimeFilter = 'all' | 'last_hour' | 'today' | 'last_24h' | 'last_7d' | 'last_2w' | 'last_30d' | 'last_6m' | 'custom';

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'last_hour', label: 'Last hour' },
  { value: 'today', label: 'Today' },
  { value: 'last_24h', label: 'Last 24 hours' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_2w', label: 'Last 2 weeks' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_6m', label: 'Last 6 months' },
  { value: 'custom', label: 'Custom' },
];

function filterJobsByTime<T extends { CreationTime?: string }>(jobs: T[], filter: TimeFilter): T[] {
  if (filter === 'all' || filter === 'custom') return jobs;
  const now = Date.now();
  let cutoff: number;
  switch (filter) {
    case 'last_hour': cutoff = now - 60 * 60 * 1000; break;
    case 'today': { const d = new Date(); d.setHours(0, 0, 0, 0); cutoff = d.getTime(); break; }
    case 'last_24h': cutoff = now - 24 * 60 * 60 * 1000; break;
    case 'last_7d': cutoff = now - 7 * 24 * 60 * 60 * 1000; break;
    case 'last_2w': cutoff = now - 14 * 24 * 60 * 60 * 1000; break;
    case 'last_30d': cutoff = now - 30 * 24 * 60 * 60 * 1000; break;
    case 'last_6m': cutoff = now - 180 * 24 * 60 * 60 * 1000; break;
    default: return jobs;
  }
  return jobs.filter(j => j.CreationTime && new Date(j.CreationTime).getTime() >= cutoff);
}

const CARD_GRADIENTS = [
  'linear-gradient(145deg,#0d1a20 0%,#182126 100%)',
  'linear-gradient(145deg,#1a0a04 0%,#5c1a08 100%)',
  'linear-gradient(145deg,#041a1e 0%,#063d47 100%)',
  'linear-gradient(145deg,#0d1420 0%,#0c2d40 100%)',
  'linear-gradient(145deg,#1c0e06 0%,#6e2808 100%)',
  'linear-gradient(145deg,#041820 0%,#073040 100%)',
  'linear-gradient(145deg,#18100a 0%,#4a1c08 100%)',
  'linear-gradient(145deg,#041c20 0%,#084550 100%)',
];
const CARD_GLOWS = [
  'rgba(255,51,51,0.35)', 'rgba(255,51,51,0.35)', 'rgba(255,51,51,0.3)',
  'rgba(30,100,130,0.35)', 'rgba(255,51,51,0.3)', 'rgba(255,51,51,0.3)',
  'rgba(163,34,0,0.3)', 'rgba(255,51,51,0.3)',
];

// Only these chat agents should appear in the Chat Agents section, in this exact display order.
// All other conversational agents are excluded from the UI.
const ALLOWED_CHAT_AGENT_ORDER = [
  'HR Assistant',
  'FinSight Agent',
  'Cheque Processing Agent',
  'Claims Adjuster Agent',
];
const ALLOWED_CHAT_AGENT_NAMES = new Set(ALLOWED_CHAT_AGENT_ORDER);


// UiPath brand colors
const TEAL = '#FF3333';
const ORANGE = '#FF3333';

const CAPABILITIES = [
  {
    id: 'agents',
    label: 'Agents',
    subtitle: 'AI agents, always on',
    videoSrc: undefined as string | undefined,
    gradient: 'linear-gradient(145deg,#03131a 0%,#072838 100%)',
    accentColor: TEAL,
    glowColor: 'rgba(255,51,51,0.55)',
    hasVideo: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        <circle cx="9" cy="7" r="0.5" fill="currentColor"/>
        <circle cx="15" cy="7" r="0.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'rpa',
    label: 'RPA Workflow',
    subtitle: 'Robotic process automation',
    videoSrc: './rpa-card.mp4',
    videoScale: 3.7,
    gradient: 'linear-gradient(145deg,#160804 0%,#3d1106 100%)',
    accentColor: ORANGE,
    glowColor: 'rgba(255,51,51,0.5)',
    hasVideo: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: 'maestro',
    label: 'Maestro',
    subtitle: 'Orchestrate at scale',
    videoSrc: './maestro-card.mp4',
    videoScale: 2.5,
    gradient: 'linear-gradient(145deg,#03131a 0%,#072838 100%)',
    accentColor: TEAL,
    glowColor: 'rgba(255,51,51,0.45)',
    hasVideo: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.35"/>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
      </svg>
    ),
  },
  {
    id: 'case',
    label: 'Case Management',
    subtitle: 'Track & resolve cases',
    videoSrc: './case-card.mp4',
    videoScale: 1.4,
    gradient: 'linear-gradient(145deg,#160804 0%,#3d1106 100%)',
    accentColor: ORANGE,
    glowColor: 'rgba(255,51,51,0.4)',
    hasVideo: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <path d="M9 13l2.5 2.5L16 11"/>
      </svg>
    ),
  },
  {
    id: 'delegate',
    label: 'Delegate',
    subtitle: 'Assign & hand off work',
    videoSrc: './delegate-card.mp4',
    videoScale: 1.4,
    gradient: 'linear-gradient(145deg,#03131a 0%,#072838 100%)',
    accentColor: TEAL,
    glowColor: 'rgba(255,51,51,0.45)',
    hasVideo: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="8" r="3"/>
        <circle cx="17" cy="16" r="3"/>
        <path d="M10 8h5a1 1 0 0 1 1 1v4"/>
        <path d="M14 13l3 3-3 3"/>
      </svg>
    ),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    subtitle: 'Human-in-the-loop actions',
    videoSrc: './tasks-card.mp4',
    videoScale: 1.2,
    gradient: 'linear-gradient(145deg,#160804 0%,#3d1106 100%)',
    accentColor: ORANGE,
    glowColor: 'rgba(255,51,51,0.45)',
    hasVideo: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
];

interface Props {
  conversationalAgent: ConversationalAgent;
  onSelectAgent: (agent: AgentGetResponse) => void;
  initialCapability?: string | null;
}

export default function ExploreTab({ conversationalAgent, onSelectAgent, initialCapability }: Props) {
  const { theme, t, tr } = useTheme();
  const { branding } = useConfig();
  // Subtle/secondary brand color used for the Agents-screen tabs, loading orbs, etc.
  const brandSecondary = branding.secondaryColor || branding.primaryColor;
  // Theme the capability tiles: even tiles (the original teal-role ones) take
  // the secondary color, odd tiles take primary — so re-theming recolors the
  // Explore badges/icons/glows instead of leaving them on the bundled default.
  const themedCaps = useMemo(
    () => CAPABILITIES.map((c, i) => {
      const useSecondary = i % 2 === 0;
      return {
        ...c,
        accentColor: useSecondary ? (branding.secondaryColor || branding.primaryColor) : branding.primaryColor,
        glowColor: useSecondary ? 'rgba(var(--brand-secondary-rgb),0.5)' : 'rgba(var(--brand-primary-rgb),0.5)',
      };
    }),
    [branding.primaryColor, branding.secondaryColor]
  );
  const isLight = theme === 'light';
  // Common light-aware style helpers (hoisted here so all branches can use them)
  const backBtnStyle = { background: t.backBtnBg, border: `1px solid ${t.border}` } as const;
  const backBtnStroke = t.backBtnIcon;
  const iconBtnStyle = { background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', border: `1px solid ${t.border}` } as const;
  const iconStrokeMuted = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const cardBgSubtle = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';
  const cardBgSubtleBorder = t.border;
  const textOnCard = t.textBody;
  const textMutedStrong = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
  const dividerColor = t.divider;
  const { sdk } = useAuth();
  const [agents, setAgents] = useState<AgentGetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(initialCapability ?? null);
  const [tasks, setTasks] = useState<ActionCenterTask[]>([]);
  const tasksRef = useRef<ActionCenterTask[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [releases, setReleases] = useState<ProcessRelease[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [agentTab, setAgentTab] = useState<'all' | 'agents' | 'convo'>('all');
  const [selectedRelease, setSelectedRelease] = useState<ProcessRelease | null>(null);
  const [releaseJobs, setReleaseJobs] = useState<OrchestratorJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobTab, setJobTab] = useState<'running' | 'history'>('running');
  const [stoppingJobs, setStoppingJobs] = useState<Set<number>>(new Set());
  const [startingJob, setStartingJob] = useState(false);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('last_7d');
  const [timeFilterOpen, setTimeFilterOpen] = useState(false);
  const [selectedTaskDate, setSelectedTaskDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [taskWeekOffset, setTaskWeekOffset] = useState(0);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  // Claim card — PDF, notes, voice (persisted to localStorage)
  const [claimPdfOpen, setClaimPdfOpen] = useState(false);
  const [claimPdfUrl, setClaimPdfUrl] = useState<string | null>(null);
  const [claimNotes, setClaimNotes] = useState<Map<number, { comment: string; voiceUrl: string | null; voiceTranscript: string | null }>>(() => {
    try {
      const stored = localStorage.getItem('claimNotes');
      if (stored) {
        const parsed: [number, { comment: string; voiceUrl: string | null; voiceTranscript?: string | null }][] = JSON.parse(stored);
        return new Map(parsed.map(([k, v]) => [k, { comment: v.comment, voiceUrl: v.voiceUrl, voiceTranscript: v.voiceTranscript ?? null }]));
      }
    } catch { /* ignore */ }
    return new Map();
  });
  const [claimRecording, setClaimRecording] = useState(false);
  const [claimRecSecs, setClaimRecSecs] = useState(0);
  const claimMediaRef = useRef<MediaRecorder | null>(null);
  const claimChunksRef = useRef<Blob[]>([]);
  const claimTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const claimTaskIdRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claimSpeechRef = useRef<any>(null);
  const claimFinalTranscriptRef = useRef<string>('');

  // Persist claim notes to localStorage whenever they change
  useEffect(() => {
    try {
      const entries = Array.from(claimNotes.entries());
      localStorage.setItem('claimNotes', JSON.stringify(entries));
    } catch { /* storage full */ }
  }, [claimNotes]);

  // Fetch PDF as blob with correct MIME type when viewer is opened
  useEffect(() => {
    if (!claimPdfOpen) return;
    let revoke: string | null = null;
    fetch('./property-claim-form.pdf')
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        revoke = url;
        setClaimPdfUrl(url);
      })
      .catch(() => setClaimPdfUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); setClaimPdfUrl(null); };
  }, [claimPdfOpen]);

  const startClaimRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS WKWebView's MediaRecorder emits audio/mp4, not WebM. Pick a MIME
      // the browser actually supports so the Blob we build in onstop matches
      // the bytes — mismatched MIME makes <audio> fire onError.
      const preferredTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      const pickedType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, pickedType ? { mimeType: pickedType } : undefined);
      claimChunksRef.current = [];
      claimFinalTranscriptRef.current = '';

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
          claimFinalTranscriptRef.current = (finalizedText + ' ' + runningInterim).replace(/\s+/g, ' ').trim();
        };
        rec.onerror = () => { /* best-effort */ };
        try { rec.start(); claimSpeechRef.current = rec; } catch { /* already started */ }
      }

      mr.ondataavailable = (e) => { if (e.data.size > 0) claimChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(claimChunksRef.current, { type: mr.mimeType || pickedType || 'audio/mp4' });
        // Convert blob to base64 data URL for localStorage persistence.
        // Small delay gives the speech recognizer a moment to flush any pending
        // final result triggered by rec.stop() before we snapshot the transcript.
        setTimeout(() => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const tid = claimTaskIdRef.current;
            const transcript = claimFinalTranscriptRef.current.trim() || null;
            if (tid !== null) {
              setClaimNotes(prev => { const n = new Map(prev); n.set(tid, { comment: prev.get(tid)?.comment ?? '', voiceUrl: dataUrl, voiceTranscript: transcript }); return n; });
            }
          };
          reader.readAsDataURL(blob);
        }, 250);
        stream.getTracks().forEach(t => t.stop());
        if (claimTimerRef.current) clearInterval(claimTimerRef.current);
        setClaimRecording(false);
      };
      mr.start();
      claimMediaRef.current = mr;
      setClaimRecSecs(0);
      setClaimRecording(true);
      claimTimerRef.current = setInterval(() => setClaimRecSecs(s => s + 1), 1000);
    } catch { /* mic permission denied */ }
  }, []);

  const stopClaimRecording = useCallback(() => {
    // Stop speech recognition first so it can flush its final result
    // before MediaRecorder's onstop snapshots the transcript.
    try { claimSpeechRef.current?.stop(); } catch { /* already stopped */ }
    claimSpeechRef.current = null;
    claimMediaRef.current?.stop();
    if (claimTimerRef.current) clearInterval(claimTimerRef.current);
  }, []);
  const [selectedTask, setSelectedTask] = useState<ActionCenterTask | null>(null);
  const [taskActioning, setTaskActioning] = useState<'approve' | 'reject' | null>(null);
  const [assigningSelf, setAssigningSelf] = useState(false);

  useEffect(() => {
    conversationalAgent.getAll()
      .then((all) => {
        const byKey = new Map<string, AgentGetResponse>();
        for (const agent of all) {
          // Only allow the 5 designated chat agents
          if (!ALLOWED_CHAT_AGENT_NAMES.has(agent.name.trim())) continue;
          const existing = byKey.get(agent.processKey);
          if (!existing) { byKey.set(agent.processKey, agent); continue; }
          const existingTime = existing.createdTime ? new Date(existing.createdTime).getTime() : 0;
          const newTime = agent.createdTime ? new Date(agent.createdTime).getTime() : 0;
          if (newTime > existingTime) byKey.set(agent.processKey, agent);
        }
        const sorted = Array.from(byKey.values()).sort((a, b) => {
          const ai = ALLOWED_CHAT_AGENT_ORDER.indexOf(a.name.trim());
          const bi = ALLOWED_CHAT_AGENT_ORDER.indexOf(b.name.trim());
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setAgents(sorted);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load agents'))
      .finally(() => setIsLoading(false));
  }, [conversationalAgent]);

  // ── Fetch tasks when Tasks tile is opened (or refreshed) ──────────────────
  useEffect(() => {
    if (selectedCapability !== 'tasks') return;
    let mounted = true;
    // Show spinner + clear list only when there's nothing to show yet.
    // Refreshes after approve/reject update tasks in place so the UI doesn't flash empty.
    const isInitialLoad = tasksRef.current.length === 0;
    if (isInitialLoad) {
      setTasksLoading(true);
      setTasks([]);
    }
    setTasksError(null);

    const run = async () => {
      const token = sdk.getToken();
      if (!token) { if (mounted) { setTasksError('Not authenticated'); setTasksLoading(false); } return; }

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const base = API_BASE;

        // Fetch current user ID and tasks in parallel
        const [userRes, tasksRes] = await Promise.all([
          fetch(`${base}/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUser`, { headers }),
          fetch(`${base}/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders?$top=50&$orderby=CreationTime desc`, { headers }),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          if (mounted) {
            setCurrentUserId(userData.Id ?? null);
            const fullName = [userData.Name, userData.Surname].filter(Boolean).join(' ').trim();
            setCurrentUserName(fullName || userData.UserName || userData.EmailAddress || null);
          }
        }

        if (!tasksRes.ok) throw new Error(`HTTP ${tasksRes.status}`);
        const data = await tasksRes.json();
        const all: ActionCenterTask[] = data.value || [];
        const nonDeleted = all.filter(t => !t.IsDeleted);
        if (mounted) setTasks(nonDeleted);
      } catch (e) {
        if (mounted) setTasksError('Could not load tasks');
      } finally {
        if (mounted) setTasksLoading(false);
      }
    };

    run();
    return () => { mounted = false; };
  }, [selectedCapability, sdk, tasksRefreshKey]);

  // ── Fetch jobs when a release is selected ────────────────────────────────────
  useEffect(() => {
    if (!selectedRelease) return;
    let mounted = true;
    setJobsLoading(true);
    setJobsError(null);
    setReleaseJobs([]);

    const run = async () => {
      const token = sdk.getToken();
      if (!token) { if (mounted) { setJobsError('Not authenticated'); setJobsLoading(false); } return; }
      try {
        const name = selectedRelease.Name.replace(/'/g, "''");
        const url = `${API_BASE}/odata/Jobs?$filter=ReleaseName eq '${name}'&$top=30&$orderby=CreationTime desc`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-UIPATH-OrganizationUnitId': INSURANCE_FOLDER_ID },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setReleaseJobs(data.value || []);
      } catch (e) {
        if (mounted) setJobsError('Could not load job history');
      } finally {
        if (mounted) setJobsLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [selectedRelease, sdk, jobsRefreshKey]);

  // ── Stop a running job ────────────────────────────────────────────────────────
  const stopJob = async (jobId: number) => {
    const token = sdk.getToken();
    if (!token) return;
    setStoppingJobs(prev => new Set(prev).add(jobId));
    try {
      await fetch(`${API_BASE}/odata/Jobs(${jobId})/UiPath.Server.Configuration.OData.StopJob`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-UIPATH-OrganizationUnitId': INSURANCE_FOLDER_ID },
        body: JSON.stringify({ strategy: 'SoftStop' }),
      });
      setReleaseJobs(prev => prev.map(j => j.Id === jobId ? { ...j, State: 'Stopping' } : j));
    } finally {
      setStoppingJobs(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    }
  };

  // ── Start a new job ───────────────────────────────────────────────────────────
  const startJob = async (release: ProcessRelease) => {
    const token = sdk.getToken();
    if (!token || !release.Key) return;
    setStartingJob(true);
    try {
      const res = await fetch(`${API_BASE}/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-UIPATH-OrganizationUnitId': INSURANCE_FOLDER_ID },
        body: JSON.stringify({ startInfo: { ReleaseKey: release.Key, Strategy: 'ModernJobsCount', Source: 'Manual', JobsCount: 1 } }),
      });
      if (res.ok) {
        const data = await res.json();
        const newJobs: OrchestratorJob[] = data.value || [];
        setReleaseJobs(prev => [...newJobs, ...prev]);
        setJobTab('running');
      } else {
        const err = await res.json().catch(() => ({}));
        setJobsError(err.message || `Failed to start job (${res.status})`);
      }
    } finally {
      setStartingJob(false);
    }
  };

  // ── Assign an Action Center task to the current user ─────────────────────────
  const assignTaskToMe = async (task: ActionCenterTask) => {
    const token = sdk.getToken();
    if (!token) return;
    setAssigningSelf(true);
    try {
      // If the upfront GetCurrentUser fetch failed (e.g. CORS/ATS on iOS hitting
      // staging.api.uipath.com directly), retry lazily on click so the button
      // still works after the first failure rather than being permanently hidden.
      let userId = currentUserId;
      let userName = currentUserName;
      if (userId == null) {
        try {
          const userRes = await fetch(`${API_BASE}/odata/Users/UiPath.Server.Configuration.OData.GetCurrentUser`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            userId = userData.Id ?? null;
            const fullName = [userData.Name, userData.Surname].filter(Boolean).join(' ').trim();
            userName = fullName || userData.UserName || userData.EmailAddress || null;
            setCurrentUserId(userId);
            setCurrentUserName(userName);
          }
        } catch { /* fall through to guard below */ }
      }
      if (userId == null) {
        alert('Could not determine current user. Please try again.');
        return;
      }
      const folderId = task.OrganizationUnitId ? String(task.OrganizationUnitId) : INSURANCE_FOLDER_ID;
      const res = await fetch(`${API_BASE}/odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-UIPATH-OrganizationUnitId': folderId },
        body: JSON.stringify({ taskAssignments: [{ TaskId: task.Id, UserId: userId }] }),
      });
      if (res.ok || res.status === 204) {
        const patch = (t: ActionCenterTask): ActionCenterTask => ({
          ...t,
          AssignedToUserId: userId,
          TaskAssigneeName: userName ?? t.TaskAssigneeName ?? 'Me',
          Status: t.Status === 'Unassigned' ? 'Pending' : t.Status,
        });
        setTasks(prev => prev.map(t => t.Id === task.Id ? patch(t) : t));
        setSelectedTask(prev => prev && prev.Id === task.Id ? patch(prev) : prev);
      } else {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        alert(`Failed to assign: ${err.message || err.errorMessage || `HTTP ${res.status}`}`);
      }
    } finally {
      setAssigningSelf(false);
    }
  };

  // ── Complete (approve/reject) an Action Center task ───────────────────────────
  // Routes to the correct Orchestrator endpoint based on task.Type — AppTasks/CompleteAppTask
  // rejects non-App tasks with "This operation is allowed only for the action types".
  const completeTask = async (task: ActionCenterTask, action: 'approve' | 'reject') => {
    const token = sdk.getToken();
    if (!token) return;
    setTaskActioning(action);
    try {
      const base = API_BASE;
      const taskAction = action === 'approve' ? 'Approve' : 'Reject';
      const folderId = task.OrganizationUnitId ? String(task.OrganizationUnitId) : INSURANCE_FOLDER_ID;
      let endpoint: string;
      let body: Record<string, unknown>;
      switch (task.Type) {
        case 'FormTask':
          endpoint = `${base}/forms/TaskForms/CompleteTask`;
          body = { taskId: task.Id, action: taskAction, data: {} };
          break;
        case 'AppTask':
          endpoint = `${base}/tasks/AppTasks/CompleteAppTask`;
          body = { taskId: task.Id, action: taskAction, data: {} };
          break;
        default:
          endpoint = `${base}/tasks/GenericTasks/CompleteTask`;
          body = { taskId: task.Id, data: { action: taskAction } };
          break;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-UIPATH-OrganizationUnitId': folderId },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 204) {
        setTasks(prev => prev.map(t => t.Id === task.Id ? { ...t, Status: 'Completed', CompletionTime: new Date().toISOString() } : t));
        setSelectedTask(null);
        setTasksRefreshKey(k => k + 1);
      } else {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        alert(`Failed: ${err.message || err.errorMessage || `HTTP ${res.status}`}`);
      }
    } finally {
      setTaskActioning(null);
    }
  };

  // ── Fetch releases when RPA / Maestro / Case tile is opened ─────────────────
  useEffect(() => {
    if (!['agents', 'rpa', 'maestro', 'case'].includes(selectedCapability || '')) return;
    let mounted = true;
    setReleasesLoading(true);
    setReleasesError(null);
    setReleases([]);

    const run = async () => {
      const token = sdk.getToken();
      if (!token) { if (mounted) { setReleasesError('Not authenticated'); setReleasesLoading(false); } return; }
      try {
        const url = `${API_BASE}/odata/Releases?$top=50&$orderby=Name asc`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, 'X-UIPATH-OrganizationUnitId': INSURANCE_FOLDER_ID },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setReleases(data.value || []);
      } catch (e) {
        if (mounted) setReleasesError('Could not load automations');
      } finally {
        if (mounted) setReleasesLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [selectedCapability, sdk]);

  // ── Job detail panel ─────────────────────────────────────────────────────────
  if (selectedRelease) {
    const filteredJobs = filterJobsByTime(releaseJobs, timeFilter);
    const runningJobs = filteredJobs.filter(j => ['Running', 'Pending', 'Stopping', 'Resuming'].includes(j.State));
    const historyJobs = filteredJobs.filter(j => !['Running', 'Pending', 'Stopping', 'Resuming'].includes(j.State));
    const displayJobs = jobTab === 'running' ? runningJobs : historyJobs;

    const jobStateColor = (state: string) => {
      switch (state) {
        case 'Successful': return '#22c55e';
        case 'Running': return TEAL;
        case 'Pending': case 'Resuming': return '#f59e0b';
        case 'Faulted': return '#ef4444';
        case 'Stopping': case 'Stopped': return ORANGE;
        default: return 'rgba(255,255,255,0.4)';
      }
    };

    const jobStateDot = (state: string) => {
      const color = jobStateColor(state);
      const pulse = ['Running', 'Pending', 'Stopping'].includes(state);
      return (
        <span className="relative flex-shrink-0" style={{ width: 8, height: 8 }}>
          {pulse && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.4 }} />}
          <span className="relative block w-2 h-2 rounded-full" style={{ background: color }} />
        </span>
      );
    };

    const formatDuration = (start?: string | null, end?: string | null) => {
      if (!start) return null;
      const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
      const s = Math.floor(ms / 1000);
      if (s < 60) return `${s}s`;
      if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
      return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    };

    const formatJobTime = (iso: string) => {
      const d = new Date(iso);
      const minsAgo = Math.round((Date.now() - d.getTime()) / 60000);
      const rel = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`;
      const abs = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${rel} · ${abs}`;
    };

    const cap = themedCaps.find(c => c.id === selectedCapability) ?? themedCaps[0];

    return (
      <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
        {/* Row 1 — back + name */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 flex items-start gap-3">
          <button onClick={() => setSelectedRelease(null)} className="flex items-center justify-center rounded-xl active:scale-95 transition-transform flex-shrink-0"
            style={{ width: 36, height: 36, ...backBtnStyle }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate" style={{ fontSize: 20, color: t.textPrimary }}>{selectedRelease.Name}</h1>
            <p className="mt-1 leading-snug pr-2" style={{ fontSize: 13, color: t.textSecondary }}>{selectedRelease.Description || cap.label}</p>
          </div>
        </div>

        {/* Row 2 — actions + stats */}
        <div className="px-4 pb-2 pt-2 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => startJob(selectedRelease)}
            disabled={startingJob}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 active:scale-95 transition-transform"
            style={{ background: `${cap.accentColor}22`, border: `1px solid ${cap.accentColor}55`, opacity: startingJob ? 0.6 : 1 }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill={cap.accentColor}><polygon points="2,1 11,6 2,11"/></svg>
            <span className="font-semibold" style={{ fontSize: 11, color: cap.accentColor }}>{startingJob ? 'Starting…' : 'Run Now'}</span>
          </button>
          <button
            onClick={() => { setJobsRefreshKey(k => k + 1); }}
            disabled={jobsLoading}
            className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ width: 34, height: 34, ...iconBtnStyle, opacity: jobsLoading ? 0.5 : 1 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={iconStrokeMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={jobsLoading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
          {/* Inline stats */}
          <div className="flex-1 flex items-center justify-end gap-2.5">
            <span className="font-bold" style={{ fontSize: 13, color: TEAL }}>{runningJobs.length} run</span>
            <span style={{ color: t.textMuted, fontSize: 13 }}>·</span>
            <span className="font-bold" style={{ fontSize: 13, color: '#22c55e' }}>{historyJobs.filter(j => j.State === 'Successful').length} pass</span>
            <span style={{ color: t.textMuted, fontSize: 13 }}>·</span>
            <span className="font-bold" style={{ fontSize: 13, color: '#ef4444' }}>{historyJobs.filter(j => j.State === 'Faulted').length} fail</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}>
            {(['running', 'history'] as const).map(tab => {
              const active = jobTab === tab;
              const count = tab === 'running' ? runningJobs.length : historyJobs.length;
              return (
                <button key={tab} onClick={() => setJobTab(tab)} className="flex-1 rounded-lg font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  style={{ fontSize: 12, padding: '6px 0', background: active ? cap.accentColor : 'transparent', color: active ? '#fff' : textMutedStrong, boxShadow: active ? `0 0 12px ${cap.accentColor}55` : 'none' }}>
                  {tab === 'running' ? 'Running' : 'History'}
                  {count > 0 && (
                    <span className="rounded-full px-1.5" style={{ fontSize: 9, background: active ? 'rgba(255,255,255,0.25)' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'), color: active ? '#fff' : t.textMuted }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time filter — Creation Time dropdown */}
        <div className="flex-shrink-0 px-4 pb-2 flex justify-end relative" style={{ zIndex: 20 }}>
          <button
            onClick={() => setTimeFilterOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 active:scale-95 transition-transform"
            style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}
          >
            <span style={{ fontSize: 11, color: t.textMuted }}>Creation Time:</span>
            <span className="font-semibold" style={{ fontSize: 11, color: t.textBody }}>
              {TIME_FILTERS.find(f => f.value === timeFilter)?.label ?? 'All'}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: timeFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {timeFilterOpen && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 29 }} onClick={() => setTimeFilterOpen(false)} />
              <div
                className="absolute right-4 rounded-xl overflow-hidden"
                style={{
                  top: '100%',
                  marginTop: 4,
                  minWidth: 160,
                  background: t.dropdownBg,
                  border: `1px solid ${t.borderStrong}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  zIndex: 30,
                }}
              >
                {TIME_FILTERS.map((opt, i) => {
                  const active = timeFilter === opt.value;
                  const isCustom = opt.value === 'custom';
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setTimeFilter(opt.value); setTimeFilterOpen(false); }}
                      className="block w-full text-left active:opacity-80"
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        color: active ? cap.accentColor : t.textBody,
                        background: active ? `${cap.accentColor}15` : 'transparent',
                        fontWeight: active ? 600 : 400,
                        borderTop: isCustom ? `1px solid ${t.border}` : (i === 0 ? 'none' : 'none'),
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2">
          {jobsLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-9 h-9 rounded-full" style={{ background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.85) 0%, ${brandSecondary} 60%, rgba(0,0,0,0.55) 100%)`, boxShadow: `0 0 20px ${brandSecondary}88`, animation: 'orb-breathe 2s ease-in-out infinite' }} />
              <p className="text-sm" style={{ color: t.textSecondary }}>Loading job history…</p>
            </div>
          ) : jobsError ? (
            <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>{jobsError}</div>
          ) : displayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              {jobTab === 'running' ? (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z" fill={TEAL}/>
                  </svg>
                  <p className="text-sm" style={{ color: t.textMuted }}>No jobs running</p>
                </>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
                  </svg>
                  <p className="text-sm" style={{ color: t.textMuted }}>No job history yet</p>
                </>
              )}
            </div>
          ) : (
            displayJobs.map(job => {
              const color = jobStateColor(job.State);
              const duration = formatDuration(job.StartTime, job.EndTime ?? (job.State === 'Running' ? undefined : job.EndTime));
              const isRunning = ['Running', 'Pending', 'Stopping', 'Resuming'].includes(job.State);
              const isStopping = stoppingJobs.has(job.Id) || job.State === 'Stopping';
              return (
                <div key={job.Id} className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
                  style={{ background: cardBgSubtle, border: `1px solid ${isRunning ? color + '30' : t.border}` }}>
                  {/* Top row: status + duration + stop */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {jobStateDot(job.State)}
                      <span className="font-semibold" style={{ fontSize: 12, color }}>{job.State}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {duration && <span style={{ fontSize: 11, color: t.textMuted }}>{duration}</span>}
                      {isRunning && (
                        <button
                          onClick={() => stopJob(job.Id)}
                          disabled={isStopping}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 active:scale-95 transition-transform"
                          style={{ background: `${ORANGE}20`, border: `1px solid ${ORANGE}40`, opacity: isStopping ? 0.5 : 1 }}>
                          <svg width="8" height="8" viewBox="0 0 10 10" fill={ORANGE}>
                            <rect x="1" y="1" width="8" height="8" rx="1"/>
                          </svg>
                          <span style={{ fontSize: 10, color: ORANGE, fontWeight: 600 }}>{isStopping ? 'Stopping…' : 'Stop'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Job meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 10, color: t.textMuted }}>#{job.Id}</span>
                    {job.HostMachineName && (
                      <>
                        <span style={{ color: t.textMuted, fontSize: 10 }}>·</span>
                        <span style={{ fontSize: 10, color: t.textMuted }}>{job.HostMachineName}</span>
                      </>
                    )}
                    {job.Source && (
                      <>
                        <span style={{ color: t.textMuted, fontSize: 10 }}>·</span>
                        <span style={{ fontSize: 10, color: t.textMuted }}>{job.Source}</span>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: t.textMuted }}>{formatJobTime(job.CreationTime)}</span>
                  {job.Info && job.State === 'Faulted' && (
                    <p className="rounded-lg px-2 py-1.5" style={{ fontSize: 10, color: '#fca5a5', background: 'rgba(239,68,68,0.08)', lineHeight: 1.4 }}>{job.Info}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Agents drill-in ───────────────────────────────────────────────────────
  if (selectedCapability === 'agents') {
    const agentReleases = releases.filter(r => r.ProcessType === 'Agent');
    const sectionLabel = (text: string) => (
      <p style={{ fontSize: 10, fontWeight: 700, color: t.textLabel, letterSpacing: 1.2, textTransform: 'uppercase' as const, paddingTop: 4, paddingBottom: 2 }}>
        {text}
      </p>
    );

    const loadingBoth = isLoading || releasesLoading;
    const subtitleText = loadingBoth
      ? 'Loading…'
      : `${agentReleases.length} autonomous · ${agents.length} chat`;

    return (
      <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
        <div className="px-5 pt-3 pb-4 flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => { setSelectedCapability(null); setAgentTab('all'); }}
            className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ width: 36, height: 36, ...backBtnStyle }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="font-bold" style={{ fontSize: 24, color: t.textPrimary }}>Agents</h1>
            <p className="text-sm" style={{ color: t.textSecondary }}>{subtitleText}</p>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}>
            {(['all', 'agents', 'convo'] as const).map(tab => {
              const active = agentTab === tab;
              const label = tab === 'all' ? 'All' : tab === 'agents' ? 'Autonomous' : 'Chat';
              return (
                <button
                  key={tab}
                  onClick={() => setAgentTab(tab)}
                  className="flex-1 rounded-lg font-semibold transition-all active:scale-95"
                  style={{
                    fontSize: 12,
                    padding: '6px 0',
                    background: active ? brandSecondary : 'transparent',
                    color: active ? '#fff' : textMutedStrong,
                    boxShadow: active ? `0 0 12px ${brandSecondary}55` : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2">
          {(() => {
            const isLight = theme === 'light';

            const renderAutonomousCard = (r: typeof agentReleases[number]) => {
              if (isLight) {
                return (
                  <button
                    key={r.ProcessKey}
                    onClick={() => { setSelectedRelease(r); setJobTab('running'); }}
                    className="rounded-2xl overflow-hidden text-left active:scale-95 transition-transform flex flex-col"
                    style={{ background: '#ffffff', border: `1px solid ${TEAL}40`, boxShadow: '0 1px 2px rgba(24,33,38,0.04), 0 6px 16px rgba(24,33,38,0.07)' }}
                  >
                    <div className="relative overflow-hidden flex-shrink-0" style={{ height: 110, background: '#070710' }}>
                      <VideoEl
                        src="./agent-card.mp4"
                        autoPlay muted playsInline preload="auto"
                        poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
                        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', opacity: 0, transition: 'opacity 0.5s ease' }}
                        onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                        onTimeUpdate={(e) => {
                          const v = e.target as HTMLVideoElement;
                          if (v.duration && v.currentTime >= v.duration - 0.15) v.currentTime = 0;
                        }}
                        onEnded={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 0; v.play(); }}
                      />
                      <span className="absolute top-2 left-2.5 w-1.5 h-1.5 rounded-full" style={{ background: TEAL, boxShadow: `0 0 5px ${TEAL}` }} />
                      <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 5px rgba(34,197,94,0.65)' }} />
                      <div className="absolute top-0 right-0 pointer-events-none" style={{ width: '60%', height: '60%', background: `radial-gradient(ellipse at 85% 10%, rgba(255,51,51,0.35) 0%, transparent 70%)` }} />
                      <div className="absolute bottom-0 left-0 right-0" style={{ height: 28, background: `linear-gradient(to bottom, transparent, #070710)` }} />
                    </div>
                    <div className="px-3 pb-2.5 pt-2">
                      <p className="font-bold leading-snug" style={{ fontSize: 13, color: t.textPrimary, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {r.Name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />
                        <span className="text-xs font-medium" style={{ color: TEAL }}>{tr.ready}</span>
                      </div>
                    </div>
                    <p style={{ display: 'none' }}>{r.ProcessKey}</p>
                  </button>
                );
              }
              return (
                <button
                  key={r.ProcessKey}
                  onClick={() => { setSelectedRelease(r); setJobTab('running'); }}
                  className="rounded-2xl overflow-hidden text-left active:scale-95 transition-transform flex flex-col"
                  style={{
                    backgroundImage: `radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(160deg, #07090e 0%, #0c1519 100%)`,
                    backgroundSize: '14px 14px, auto',
                    border: `1px solid ${TEAL}1e`,
                  }}
                >
                  <div className="relative overflow-hidden flex-shrink-0" style={{ height: 110, background: '#070710' }}>
                    <VideoEl
                      src="./agent-card.mp4"
                      autoPlay muted playsInline preload="auto"
                      poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
                      style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', opacity: 0, transition: 'opacity 0.5s ease' }}
                      onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                      onTimeUpdate={(e) => {
                        const v = e.target as HTMLVideoElement;
                        if (v.duration && v.currentTime >= v.duration - 0.15) v.currentTime = 0;
                      }}
                      onEnded={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 0; v.play(); }}
                    />
                    <span className="absolute top-2 left-2.5 w-1.5 h-1.5 rounded-full" style={{ background: TEAL, boxShadow: `0 0 5px ${TEAL}` }} />
                    <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 5px rgba(34,197,94,0.65)' }} />
                    <div className="absolute top-0 right-0 pointer-events-none" style={{ width: '60%', height: '60%', background: `radial-gradient(ellipse at 85% 10%, rgba(255,51,51,0.35) 0%, transparent 70%)` }} />
                    <div className="absolute bottom-0 left-0 right-0" style={{ height: 28, background: `linear-gradient(to bottom, transparent, #070710)` }} />
                  </div>
                  <div className="px-3 pb-2.5 pt-2">
                    <p className="font-bold leading-snug" style={{ fontSize: 13, color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {r.Name}
                    </p>
                    <span className="inline-block mt-1.5" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase' as const, color: `${TEAL}70` }}>Agent</span>
                  </div>
                  <p style={{ display: 'none' }}>{r.ProcessKey}</p>
                </button>
              );
            };

            const renderChatCard = (agent: typeof agents[number], i: number) => {
              const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
              const glow = CARD_GLOWS[i % CARD_GLOWS.length];
              const displayName = getDisplayName(agent);
              const cardBackground = isLight ? '#ffffff' : gradient;
              const cardBorder = isLight ? `${TEAL}40` : 'rgba(255,255,255,0.09)';
              const cardShadow = isLight
                ? '0 1px 2px rgba(24,33,38,0.04), 0 6px 16px rgba(24,33,38,0.07)'
                : 'none';
              const nameColor = isLight ? t.textPrimary : '#fff';
              const videoSrc = './chat-agent-card.mp4';
              const videoFadeBg = gradient.match(/#[0-9a-f]{6}/gi)?.[1] ?? '#0c1a42';
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent)}
                  className="rounded-2xl overflow-hidden text-left active:scale-95 transition-transform flex flex-col"
                  style={{ background: cardBackground, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
                >
                  <div className="relative overflow-hidden flex-shrink-0" style={{ height: 110, background: '#070710' }}>
                    <VideoEl
                      src={videoSrc}
                      autoPlay muted playsInline preload="auto"
                      poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0, transition: 'opacity 0.5s ease', transform: 'scale(1.15)' }}
                      onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                      onTimeUpdate={(e) => {
                        const v = e.target as HTMLVideoElement;
                        if (v.duration && v.currentTime >= v.duration - 0.15) v.currentTime = 0;
                      }}
                    />
                    <span className="absolute top-2 left-2.5 w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />
                    {!isLight && (
                      <>
                        <div className="absolute top-0 right-0 pointer-events-none" style={{ width: '45%', height: '45%', opacity: 0.45, background: `radial-gradient(ellipse at 90% 0%, ${glow} 0%, transparent 70%)` }} />
                        <div className="absolute bottom-0 left-0 right-0" style={{ height: 14, background: `linear-gradient(to bottom, transparent, ${videoFadeBg})`, opacity: 0.6 }} />
                      </>
                    )}
                  </div>
                  <div className="px-3 pb-3 pt-2">
                    <p className="font-bold text-sm leading-snug mb-0.5" style={{ color: nameColor, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {displayName}
                    </p>
                    {agent.processKey && (
                      <p className="text-xs truncate" style={{ color: 'rgba(255,51,51,0.55)', fontSize: 10, display: 'none' }}>{agent.processKey}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />
                      <span className="text-xs font-medium" style={{ color: TEAL }}>{tr.ready}</span>
                    </div>
                  </div>
                </button>
              );
            };

            const chatLoading = isLoading;
            const chatError = error;

            // ── All tab: combined, alphabetical, no section labels ──
            if (agentTab === 'all') {
              if (releasesLoading || chatLoading) {
                return (
                  <div className="flex flex-col items-center justify-center gap-3 h-36">
                    <div className="w-11 h-11 rounded-full" style={{
                      background: `radial-gradient(circle at 35% 25%,rgba(255,255,255,0.85) 0%,${brandSecondary} 55%,rgba(0,0,0,0.55) 100%)`,
                      boxShadow: `0 0 28px ${brandSecondary}88`,
                      animation: 'orb-breathe 2s ease-in-out infinite',
                    }} />
                    <p className="text-sm" style={{ color: t.textSecondary }}>{tr.fetchingAgents}</p>
                  </div>
                );
              }
              type Combined = { kind: 'agent'; data: typeof agentReleases[number]; name: string } | { kind: 'chat'; data: typeof agents[number]; idx: number; name: string };
              const combined: Combined[] = [
                ...agentReleases.map(r => ({ kind: 'agent' as const, data: r, name: r.Name ?? '' })),
                ...agents.map((a, i) => ({ kind: 'chat' as const, data: a, idx: i, name: getDisplayName(a) })),
              ].sort((a, b) => a.name.localeCompare(b.name));

              if (combined.length === 0) {
                return <p className="text-sm py-2" style={{ color: t.textMuted }}>No agents found</p>;
              }
              return (
                <div className="grid grid-cols-2 gap-3">
                  {combined.map(item => item.kind === 'agent' ? renderAutonomousCard(item.data) : renderChatCard(item.data, item.idx))}
                </div>
              );
            }

            // ── Autonomous tab ──
            if (agentTab === 'agents') {
              return (
                <>
                  {sectionLabel('Autonomous Agents')}
                  {releasesLoading ? null : agentReleases.length === 0 ? (
                    <p className="text-sm py-2" style={{ color: t.textMuted }}>No agents found</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {agentReleases.map(renderAutonomousCard)}
                    </div>
                  )}
                </>
              );
            }

            // ── Chat tab ──
            return (
              <>
                {sectionLabel('Chat Agents')}
                {chatLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-36">
                    <div className="w-11 h-11 rounded-full" style={{
                      background: `radial-gradient(circle at 35% 25%,rgba(255,255,255,0.85) 0%,${brandSecondary} 55%,rgba(0,0,0,0.55) 100%)`,
                      boxShadow: `0 0 28px ${brandSecondary}88`,
                      animation: 'orb-breathe 2s ease-in-out infinite',
                    }} />
                    <p className="text-sm" style={{ color: t.textSecondary }}>{tr.fetchingAgents}</p>
                  </div>
                ) : chatError ? (
                  <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                    {chatError}
                  </div>
                ) : agents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 h-24">
                    <p className="text-sm" style={{ color: t.textMuted }}>{tr.noAgentsFound}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {agents.map((agent, i) => renderChatCard(agent, i))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── Tasks drill-in — real Action Center tasks ─────────────────────────────
  if (selectedCapability === 'tasks') {
    // Sort: pending first (descending by creation), then completed (descending by creation)
    const sortPendingFirst = (a: ActionCenterTask, b: ActionCenterTask) => {
      const aDone = a.Status === 'Completed' ? 1 : 0;
      const bDone = b.Status === 'Completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.CreationTime).getTime() - new Date(a.CreationTime).getTime();
    };

    // If GetCurrentUser succeeded, match by exact user ID.
    // Fallback: if user ID unknown, treat tasks with an assignee (non-Unassigned) as "My Tasks".
    const isMyTask = (t: ActionCenterTask) =>
      currentUserId != null
        ? t.AssignedToUserId === currentUserId
        : t.AssignedToUserId != null && t.Status !== 'Unassigned';

    const myTasks = tasks.filter(isMyTask).sort(sortPendingFirst);
    const otherTasks = tasks.filter(t => !isMyTask(t)).sort(sortPendingFirst);

    // ── PDF viewer for claim form ──
    if (claimPdfOpen) {
      return (
        <div className="flex flex-col h-full" style={{ background: '#080d1a' }}>
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: '#0c1526', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setClaimPdfOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ fontSize: 13.5, color: '#fff' }}>Property Claim Form</p>
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>HO5-2021-RC-4872 · Handwritten · 4 pages</p>
            </div>
            <span className="font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ fontSize: 9, background: 'rgba(255,51,51,0.15)', color: '#FF3333', border: '1px solid rgba(255,51,51,0.3)' }}>PDF</span>
          </div>
          {claimPdfUrl
            ? <iframe src={claimPdfUrl} className="flex-1 w-full" style={{ border: 'none', background: '#fff' }} title="Property Claim Form" />
            : <div className="flex-1 flex items-center justify-center"><p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading PDF…</p></div>
          }
        </div>
      );
    }

    // ── Task detail panel (shown when a task is tapped) ──
    if (selectedTask) {
      const isDone = selectedTask.Status === 'Completed';
      const createdAt = new Date(selectedTask.CreationTime);
      const priorityColor = selectedTask.Priority === 'Critical' ? '#ff2d2d'
        : selectedTask.Priority === 'High' ? '#fb923c'
        : selectedTask.Priority === 'Medium' ? '#f59e0b' : null;
      const isClaimVerification = selectedTask.Title.includes('Claim Data Verification');

      // ── Rich Claim Data Verification card ──
      if (isClaimVerification) {
        const timeStr = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return (
          <div className="flex flex-col h-full" style={{ background: theme === 'light' ? '#ffffff' : t.bgPrimary }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
              <button onClick={() => setSelectedTask(null)} className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={backBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ fontSize: 13.5, color: ORANGE }}>Property Claim Review</p>
                <p className="truncate" style={{ fontSize: 10.5, color: t.textMuted }}>Extracted from handwritten form · {timeStr}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0" style={{ background: isDone ? 'rgba(34,197,94,0.15)' : 'rgba(255,51,51,0.15)', border: `1px solid ${isDone ? 'rgba(34,197,94,0.35)' : 'rgba(255,51,51,0.35)'}`, color: isDone ? '#22c55e' : ORANGE }}>
                {isDone ? 'Completed' : selectedTask.Status || 'Pending'}
              </span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Handwritten OCR tag */}
              <div className="px-5 pt-4 mb-4">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,51,51,0.06)', border: '1px solid rgba(255,51,51,0.18)' }}>
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,51,51,0.15)' }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={ORANGE} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8L2 22M17.5 15H9"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold" style={{ fontSize: 11.5, color: ORANGE }}>Handwritten</p>
                    <p style={{ fontSize: 10.5, color: t.textMuted }}>OCR extracted · Field form</p>
                  </div>
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full font-bold tracking-wide" style={{ fontSize: 8.5, background: 'rgba(255,51,51,0.15)', color: ORANGE, border: '1px solid rgba(255,51,51,0.3)' }}>HAND-WRITTEN</span>
                </div>
              </div>

              {/* Policy Details */}
              <div className="px-5 mb-3">
                <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>&#128100;</span><p className="font-bold" style={{ fontSize: 12, color: `${TEAL}dd`, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Policy Details</p></div>
                <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: `${TEAL}0a`, border: `1px solid ${TEAL}22` }}>
                  {([['Policy No', 'HO5-2021-RC-4872'], ['Policyholder', 'Joshi Kumar']] as const).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center"><span style={{ fontSize: 11.5, color: textMutedStrong }}>{k}</span><span className={k === 'Policy No' ? 'font-mono font-bold' : 'font-semibold'} style={{ fontSize: 12, color: textOnCard }}>{v}</span></div>
                  ))}
                </div>
              </div>

              {/* Incident Details */}
              <div className="px-5 mb-3">
                <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>&#128205;</span><p className="font-bold" style={{ fontSize: 12, color: `${TEAL}dd`, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Incident Details</p></div>
                <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: `${TEAL}0a`, border: `1px solid ${TEAL}22` }}>
                  {([['Date & Time', '06 Feb 2026 · 7:15 AM'], ['Location', 'Kitchen, Al Furjan, Dubai']] as const).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center"><span style={{ fontSize: 11.5, color: textMutedStrong }}>{k}</span><span className="font-semibold text-right" style={{ fontSize: 12, color: textOnCard, maxWidth: '60%' }}>{v}</span></div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="px-5 mb-3">
                <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>&#129534;</span><p className="font-bold" style={{ fontSize: 12, color: `${TEAL}dd`, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Description</p></div>
                <div className="rounded-2xl p-3.5" style={{ background: `${TEAL}0a`, border: `1px solid ${TEAL}22` }}>
                  <p style={{ fontSize: 12, color: isLight ? 'rgba(24,33,38,0.78)' : 'rgba(200,218,245,0.7)', lineHeight: 1.6 }}>
                    A burst pipe in the kitchen on 6 Feb 2026 (~7:15 AM) caused significant water damage to cabinets, flooring, and the dishwasher. Emergency water mitigation was completed immediately, and repair estimates are being arranged. Damaged items have been retained for inspection.
                  </p>
                </div>
              </div>

              {/* Damaged Items */}
              <div className="px-5 mb-3">
                <div className="flex items-center gap-2 mb-2.5"><span style={{ fontSize: 11 }}>&#128230;</span><p className="font-bold" style={{ fontSize: 12, color: `${ORANGE}dd`, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Damaged Items</p></div>
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ORANGE}33` }}>
                  {([['Kitchen cabinets', '$4,800'], ['Laminate flooring', '$3,300'], ['Dishwasher', '$1,500']] as const).map(([item, amt], i, arr) => (
                    <div key={item} className="flex justify-between items-center px-3.5 py-2.5" style={{ background: i % 2 === 0 ? `${ORANGE}0d` : `${ORANGE}08`, borderBottom: i < arr.length - 1 ? `1px solid ${ORANGE}1a` : 'none' }}>
                      <span style={{ fontSize: 12, color: isLight ? 'rgba(24,33,38,0.78)' : 'rgba(215,228,252,0.7)' }}>{item}</span>
                      <span className="font-bold" style={{ fontSize: 12.5, color: textOnCard }}>{amt}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-3.5 py-3" style={{ background: `${ORANGE}1f`, borderTop: `1px solid ${ORANGE}40` }}>
                    <span className="font-bold" style={{ fontSize: 12.5, color: ORANGE }}>Total Claimed</span>
                    <div className="text-right">
                      <span className="font-bold" style={{ fontSize: 14, color: ORANGE }}>$9,600</span>
                      <span style={{ fontSize: 10, color: `${ORANGE}99`, marginLeft: 6 }}>- $1,000 ded.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Original Claim Form — opens PDF viewer */}
              <div className="px-5 mb-4">
                <button onClick={() => setClaimPdfOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-95 transition-transform" style={{ background: cardBgSubtle, border: `1px solid ${cardBgSubtleBorder}` }}>
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${ORANGE}1f`, border: `1px solid ${ORANGE}40` }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={ORANGE} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold" style={{ fontSize: 12.5, color: textOnCard }}>View Original Claim Form</p>
                    <p style={{ fontSize: 10.5, color: t.textMuted }}>Property Insurance · Handwritten · 4 pages</p>
                  </div>
                  <span className="font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ fontSize: 9, background: `${ORANGE}22`, color: ORANGE, border: `1px solid ${ORANGE}4d` }}>PDF</span>
                </button>
              </div>

              {/* Text note + voice recording — saved locally only */}
              {(() => {
                claimTaskIdRef.current = selectedTask.Id;
                const noteData = claimNotes.get(selectedTask.Id);
                const comment = noteData?.comment ?? '';
                const voiceUrl = noteData?.voiceUrl ?? null;
                const voiceTranscript = noteData?.voiceTranscript ?? null;
                const setComment = (val: string) => setClaimNotes(prev => { const n = new Map(prev); const cur = n.get(selectedTask.Id); n.set(selectedTask.Id, { comment: val, voiceUrl: cur?.voiceUrl ?? null, voiceTranscript: cur?.voiceTranscript ?? null }); return n; });

                return (
                  <div className="px-5 mb-4 flex flex-col gap-2.5">
                    {/* Saved voice note playback */}
                    {voiceUrl && (
                      <div className="rounded-2xl px-3.5 py-3 flex flex-col gap-2" style={{ background: `${TEAL}14`, border: `1px solid ${TEAL}40` }}>
                        <audio src={voiceUrl} controls className="w-full" style={{ height: 28, accentColor: TEAL }} />
                        {voiceTranscript && (
                          <p className="italic leading-relaxed" style={{ fontSize: 12, color: textOnCard, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            &ldquo;{voiceTranscript}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                    {/* Saved text note display */}
                    {comment.length > 0 && !claimRecording && (
                      <div className="rounded-2xl px-3.5 py-3 flex items-start gap-3 min-w-0" style={{ background: cardBgSubtle, border: `1px solid ${cardBgSubtleBorder}` }}>
                        <p className="flex-1 leading-relaxed" style={{ fontSize: 12.5, color: textOnCard, wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 }}>{comment}</p>
                      </div>
                    )}
                    {/* Input area — text or recording */}
                    {!isDone && (
                      <div className="rounded-2xl overflow-hidden" style={{ background: cardBgSubtle, border: claimRecording ? '1px solid rgba(239,68,68,0.45)' : `1px solid ${cardBgSubtleBorder}` }}>
                        {claimRecording ? (
                          <div className="flex items-center gap-3 px-4 py-3.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 1s infinite' }} />
                            <span className="flex-1 font-medium" style={{ fontSize: 13, color: textOnCard }}>Recording…</span>
                            <span className="font-mono font-bold" style={{ fontSize: 13, color: '#ef4444' }}>{String(Math.floor(claimRecSecs / 60)).padStart(2, '0')}:{String(claimRecSecs % 60).padStart(2, '0')}</span>
                          </div>
                        ) : (
                          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a text note…" rows={2}
                            className="w-full bg-transparent outline-none resize-none px-4 pt-3 pb-2" style={{ fontSize: 13, color: textOnCard, caretColor: TEAL, lineHeight: 1.55 }} />
                        )}
                        <div className="flex items-center justify-between px-3 pb-2.5">
                          <span style={{ fontSize: 10, color: t.textMuted }}>{claimRecording ? 'Tap mic to stop' : 'Text note · optional'}</span>
                          <button onClick={claimRecording ? stopClaimRecording : startClaimRecording}
                            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                            style={claimRecording ? { background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)' } : { background: `${TEAL}22`, border: `1px solid ${TEAL}4d` }}>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={claimRecording ? '#f87171' : TEAL} strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Approve / Reject */}
              {!isDone ? (
                <div className="px-5 pb-6 flex gap-3">
                  <button
                    onClick={() => completeTask(selectedTask, 'approve')}
                    disabled={taskActioning !== null}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg,#FF3333,#0d8f9e)', boxShadow: '0 0 20px rgba(255,51,51,0.35)', opacity: taskActioning ? 0.6 : 1 }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    <span className="text-white">{taskActioning === 'approve' ? 'Approving…' : 'Approve'}</span>
                  </button>
                  <button
                    onClick={() => completeTask(selectedTask, 'reject')}
                    disabled={taskActioning !== null}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', opacity: taskActioning ? 0.6 : 1 }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    <span style={{ color: '#f87171' }}>{taskActioning === 'reject' ? 'Rejecting…' : 'Reject'}</span>
                  </button>
                </div>
              ) : (
                <div className="px-5 pt-2 pb-6">
                  <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    <span className="font-semibold" style={{ fontSize: 13, color: '#22c55e' }}>Extracted Claim Data has been verified</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      // ── Generic task detail panel (non-claim tasks) ──
      return (
        <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
          {/* Header */}
          <div className="px-4 pt-3 pb-3 flex-shrink-0 flex items-start gap-3">
            <button onClick={() => setSelectedTask(null)} className="flex items-center justify-center rounded-xl active:scale-95 transition-transform flex-shrink-0"
              style={{ width: 36, height: 36, ...backBtnStyle }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold leading-snug" style={{ fontSize: 20, color: t.textPrimary }}>{selectedTask.Title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="rounded px-1.5 py-0.5 font-bold" style={{ fontSize: 9, background: isDone ? 'rgba(34,197,94,0.15)' : 'rgba(255,51,51,0.15)', color: isDone ? '#22c55e' : TEAL, border: `1px solid ${isDone ? 'rgba(34,197,94,0.35)' : 'rgba(255,51,51,0.35)'}` }}>
                  {selectedTask.Status.toUpperCase()}
                </span>
                {priorityColor && (
                  <span className="rounded px-1.5 py-0.5 font-bold" style={{ fontSize: 9, background: `${priorityColor}18`, color: priorityColor, border: `1px solid ${priorityColor}40` }}>
                    {selectedTask.Priority!.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Task details */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
            {/* Info card */}
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: t.textMuted }}>Created</span>
                <span style={{ fontSize: 12, color: t.textPrimary, fontWeight: 600 }}>{createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {selectedTask.DueDate && (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: t.textMuted }}>Due Date</span>
                  <span style={{ fontSize: 12, color: new Date(selectedTask.DueDate).getTime() < Date.now() ? '#ef4444' : t.textPrimary, fontWeight: 600 }}>
                    {new Date(selectedTask.DueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
              {selectedTask.TaskAssigneeName && (
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: t.textMuted }}>Assigned To</span>
                  <span style={{ fontSize: 12, color: t.textPrimary, fontWeight: 600 }}>{selectedTask.TaskAssigneeName}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: t.textMuted }}>Task ID</span>
                <span style={{ fontSize: 12, color: textMutedStrong }}>#{selectedTask.Id}</span>
              </div>
            </div>

            {/* Notes — voice note + text note (shares claimNotes store, keyed by task id) */}
            {(() => {
              claimTaskIdRef.current = selectedTask.Id;
              const noteData = claimNotes.get(selectedTask.Id);
              const comment = noteData?.comment ?? '';
              const voiceUrl = noteData?.voiceUrl ?? null;
              const voiceTranscript = noteData?.voiceTranscript ?? null;
              const setComment = (val: string) => setClaimNotes(prev => { const n = new Map(prev); const cur = n.get(selectedTask.Id); n.set(selectedTask.Id, { comment: val, voiceUrl: cur?.voiceUrl ?? null, voiceTranscript: cur?.voiceTranscript ?? null }); return n; });
              const setVoiceUrl = (url: string | null) => setClaimNotes(prev => { const n = new Map(prev); const cur = n.get(selectedTask.Id); n.set(selectedTask.Id, { comment: cur?.comment ?? '', voiceUrl: url, voiceTranscript: url === null ? null : cur?.voiceTranscript ?? null }); return n; });
              return (
                <div className="flex flex-col gap-2.5">
                  {voiceUrl && (
                    <div className="rounded-2xl px-3.5 py-3 flex flex-col gap-2" style={{ background: `${TEAL}14`, border: `1px solid ${TEAL}40` }}>
                      <div className="flex items-center gap-2">
                        <audio src={voiceUrl} controls className="flex-1" style={{ height: 28, accentColor: TEAL }} />
                        {!isDone && (
                          <button onClick={() => setVoiceUrl(null)} className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: t.border }}>
                            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke={t.textMuted} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                      {voiceTranscript && (
                        <p className="italic leading-relaxed" style={{ fontSize: 12, color: t.textPrimary, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          &ldquo;{voiceTranscript}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                  {comment.length > 0 && !claimRecording && (
                    <div className="rounded-2xl px-3.5 py-3" style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}>
                      <p className="leading-relaxed" style={{ fontSize: 12.5, color: t.textPrimary, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{comment}</p>
                    </div>
                  )}
                  {!isDone && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: cardBgSubtle, border: claimRecording ? '1px solid rgba(239,68,68,0.45)' : `1px solid ${t.border}` }}>
                      {claimRecording ? (
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 1s infinite' }} />
                          <span className="flex-1 font-medium" style={{ fontSize: 13, color: t.textPrimary }}>Recording…</span>
                          <span className="font-mono font-bold" style={{ fontSize: 13, color: '#ef4444' }}>{String(Math.floor(claimRecSecs / 60)).padStart(2,'0')}:{String(claimRecSecs % 60).padStart(2,'0')}</span>
                        </div>
                      ) : (
                        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a text note…" rows={2}
                          className="w-full bg-transparent outline-none resize-none px-4 pt-3 pb-2" style={{ fontSize: 13, color: t.textPrimary, caretColor: TEAL, lineHeight: 1.55 }} />
                      )}
                      <div className="flex items-center justify-between px-3 pb-2.5">
                        <span style={{ fontSize: 10, color: t.textMuted }}>{claimRecording ? 'Tap mic to stop' : 'Text note · optional'}</span>
                        <button onClick={claimRecording ? stopClaimRecording : startClaimRecording}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                          style={claimRecording ? { background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)' } : { background: `${TEAL}22`, border: `1px solid ${TEAL}4d` }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={claimRecording ? '#f87171' : TEAL} strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Assign to me — only for unassigned, non-completed tasks.
             * (Don't gate on currentUserId — fetched lazily in assignTaskToMe
             * so the button still appears if the upfront GetCurrentUser call
             * failed, e.g. CORS/ATS on iOS hitting the staging API directly.) */}
            {!isDone && selectedTask.AssignedToUserId == null && (
              <button
                onClick={() => assignTaskToMe(selectedTask)}
                disabled={assigningSelf}
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform"
                style={{ background: `${TEAL}18`, border: `1px solid ${TEAL}55`, opacity: assigningSelf ? 0.6 : 1 }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={TEAL} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6M22 11h-6"/></svg>
                <span style={{ color: TEAL }}>{assigningSelf ? 'Assigning…' : 'Assign to me'}</span>
              </button>
            )}

            {/* Action buttons — only for non-completed tasks */}
            {!isDone && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => completeTask(selectedTask, 'approve')}
                  disabled={taskActioning !== null || assigningSelf}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg,#FF3333,#0d8f9e)', boxShadow: '0 0 20px rgba(255,51,51,0.35)', opacity: taskActioning || assigningSelf ? 0.6 : 1 }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <span className="text-white">{taskActioning === 'approve' ? 'Approving…' : 'Approve'}</span>
                </button>
                <button
                  onClick={() => completeTask(selectedTask, 'reject')}
                  disabled={taskActioning !== null || assigningSelf}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', opacity: taskActioning || assigningSelf ? 0.6 : 1 }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  <span style={{ color: '#f87171' }}>{taskActioning === 'reject' ? 'Rejecting…' : 'Reject'}</span>
                </button>
              </div>
            )}

            {/* Completed message */}
            {isDone && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <span className="font-semibold" style={{ fontSize: 13, color: '#22c55e' }}>This task has been completed</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    const renderTask = (task: ActionCenterTask) => {
      const createdAt = new Date(task.CreationTime);
      const minsAgo = Math.round((Date.now() - createdAt.getTime()) / 60000);
      const relativeStr = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`;
      const isDone = task.Status === 'Completed';

      // Due-date urgency (only for non-completed tasks)
      const dueSoon = !isDone && task.DueDate ? (() => {
        const due = new Date(task.DueDate!);
        const hoursLeft = (due.getTime() - Date.now()) / 3600000;
        if (hoursLeft < 0) return { label: 'Overdue', color: '#ef4444' };
        if (hoursLeft < 24) return { label: 'Due today', color: ORANGE };
        if (hoursLeft < 72) return { label: `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, color: '#f59e0b' };
        return null;
      })() : null;

      // Priority badge — distinct colors per level (only for non-completed)
      const priorityColor = !isDone && task.Priority === 'Critical' ? '#ff2d2d'
        : !isDone && task.Priority === 'High' ? '#fb923c'
        : !isDone && task.Priority === 'Medium' ? '#f59e0b'
        : null;

      if (isDone) {
        // Completed task — green accent, checkmark, strikethrough, "Done" badge
        return (
          <button key={task.Id} onClick={() => setSelectedTask(task)} className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2.5 active:opacity-70 transition-opacity"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight" style={{ fontSize: 13, color: t.textMuted, textDecoration: 'line-through' }}>{task.Title}</p>
              <span style={{ fontSize: 11, color: t.textMuted }}>
                {task.TaskAssigneeName || 'Completed'} · {relativeStr}
              </span>
            </div>
            <span className="rounded px-1.5 py-0.5 font-bold flex-shrink-0" style={{ fontSize: 9, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}>
              DONE
            </span>
          </button>
        );
      }

      // Active task — clickable
      return (
        <button key={task.Id} onClick={() => setSelectedTask(task)} className="w-full text-left rounded-xl px-3 py-2.5 flex flex-col gap-1 active:opacity-70 transition-opacity"
          style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold leading-tight flex-1" style={{ fontSize: 13, color: t.textPrimary }}>{task.Title}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="rounded px-1.5 py-0.5 font-bold" style={{ fontSize: 9, background: 'rgba(255,51,51,0.15)', color: TEAL, border: '1px solid rgba(255,51,51,0.35)' }}>
                {task.Status.toUpperCase()}
              </span>
              {priorityColor && (
                <span className="rounded px-1.5 py-0.5 font-bold" style={{ fontSize: 8, background: `${priorityColor}18`, color: priorityColor, border: `1px solid ${priorityColor}40` }}>
                  {task.Priority!.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 11, color: textMutedStrong }}>
              {task.TaskAssigneeName ? `${task.TaskAssigneeName} · ` : ''}{relativeStr}
            </span>
            {dueSoon && (
              <span className="font-semibold" style={{ fontSize: 10, color: dueSoon.color }}>{dueSoon.label}</span>
            )}
          </div>
        </button>
      );
    };

    const sectionLabel = (text: string) => (
      <p style={{ fontSize: 10, fontWeight: 700, color: t.textLabel, letterSpacing: 1.2, textTransform: 'uppercase' as const, paddingTop: 4, paddingBottom: 2 }}>
        {text}
      </p>
    );

    const subtitleText = tasksLoading ? 'Loading…'
      : myTasks.length > 0
        ? `${myTasks.length} assigned to you · ${otherTasks.length} pending`
        : `${tasks.length} pending task${tasks.length !== 1 ? 's' : ''}`;

    const backBtn = (
      <button onClick={() => setSelectedCapability(null)} className="flex items-center justify-center rounded-xl active:scale-95 transition-transform flex-shrink-0"
        style={{ width: 36, height: 36, ...backBtnStyle }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
    );

    return (
      <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
        <div className="px-5 pt-3 pb-4 flex-shrink-0 flex items-center gap-3">
          {backBtn}
          <div className="flex-1">
            <h1 className="font-bold" style={{ fontSize: 24, color: t.textPrimary }}>Tasks</h1>
            <p className="text-sm" style={{ color: t.textSecondary }}>{subtitleText}</p>
          </div>
          <button
            onClick={() => setTasksRefreshKey(k => k + 1)}
            disabled={tasksLoading}
            className="flex items-center justify-center rounded-xl active:scale-95 transition-transform flex-shrink-0"
            style={{ width: 36, height: 36, ...backBtnStyle, opacity: tasksLoading ? 0.5 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconStrokeMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={tasksLoading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>
        {/* ── Calendar header + 7-day date slider with arrows ── */}
        {(() => {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          // Compute the 7-day window based on offset (0 = current week ending today)
          const endDay = new Date(today);
          endDay.setDate(today.getDate() + taskWeekOffset * 7);
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(endDay);
            d.setDate(endDay.getDate() - (6 - i));
            return d;
          });
          const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          // Month label from the middle of the visible week
          const midDay = days[3];
          const monthName = midDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

          return (
            <div className="flex-shrink-0 px-4 pb-3">
              {/* Month header with arrows */}
              <div className="flex items-center justify-between pb-2.5">
                <button
                  onClick={() => setTaskWeekOffset(w => w - 1)}
                  className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                  style={{ width: 30, height: 30, ...iconBtnStyle }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStrokeMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
                  </svg>
                  <span className="font-bold" style={{ fontSize: 14, color: t.textPrimary }}>{monthName}</span>
                </div>
                <button
                  onClick={() => { if (taskWeekOffset < 0) setTaskWeekOffset(w => w + 1); }}
                  className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                  style={{ width: 30, height: 30, ...iconBtnStyle, opacity: taskWeekOffset < 0 ? 1 : 0.3 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStrokeMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
              {/* Date pills */}
              <div className="flex rounded-xl p-1 gap-0.5" style={{ background: cardBgSubtle, border: `1px solid ${t.border}` }}>
                {days.map(d => {
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const active = selectedTaskDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedTaskDate(dateStr)}
                      className="flex-1 flex flex-col items-center rounded-lg py-1.5 transition-all active:scale-95"
                      style={{
                        background: active ? ORANGE : 'transparent',
                        boxShadow: active ? `0 0 12px ${ORANGE}55` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 600, color: active ? '#fff' : t.textMuted, lineHeight: 1.2 }}>
                        {isToday ? 'Today' : dayLabels[d.getDay()]}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: active ? '#fff' : isToday ? ORANGE : (isLight ? 'rgba(24,33,38,0.6)' : 'rgba(255,255,255,0.5)'), lineHeight: 1.3 }}>
                        {d.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Task list filtered by selected date ── */}
        {(() => {
          const now = new Date();
          const isToday = selectedTaskDate === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

          // Show tasks relevant to the selected date:
          // - Completed tasks: only on the day they were completed
          // - Pending tasks: on the day they were created, or all pending on today
          const toLocalDate = (iso: string) => {
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          };
          const filterByDate = (task: ActionCenterTask) => {
            if (task.Status === 'Completed') {
              // Completed tasks only show on the day they were completed
              const completedDate = task.CompletionTime ? toLocalDate(task.CompletionTime) : null;
              return completedDate === selectedTaskDate;
            }
            // Pending/active tasks
            const created = toLocalDate(task.CreationTime);
            if (created === selectedTaskDate) return true;
            if (task.DueDate && toLocalDate(task.DueDate) === selectedTaskDate) return true;
            // For today: show all active/pending tasks
            if (isToday) return true;
            return false;
          };

          const filteredMy = myTasks.filter(filterByDate);
          const filteredOther = otherTasks.filter(filterByDate);
          const allFiltered = [...filteredMy, ...filteredOther];
          const totalFiltered = allFiltered.length;
          const pendingCount = allFiltered.filter(t => t.Status !== 'Completed').length;
          const doneCount = allFiltered.filter(t => t.Status === 'Completed').length;
          const selDate = new Date(selectedTaskDate + 'T00:00');
          const dateSummary = isToday ? 'Today' : selDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

          return (
            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2">
              {/* Date summary */}
              {!tasksLoading && !tasksError && totalFiltered > 0 && (
                <div className="flex items-center gap-2 pb-1">
                  <span className="font-bold" style={{ fontSize: 13, color: t.textPrimary }}>{dateSummary}</span>
                  {pendingCount > 0 && <span className="font-bold" style={{ fontSize: 11, color: ORANGE }}>{pendingCount} pending</span>}
                  {doneCount > 0 && <span className="font-bold" style={{ fontSize: 11, color: '#22c55e' }}>{doneCount} done</span>}
                </div>
              )}
              {tasksLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="w-10 h-10 rounded-full" style={{ background: `radial-gradient(circle at 35% 25%, rgba(250,120,80,0.9) 0%, ${ORANGE} 60%, rgba(120,25,5,1) 100%)`, boxShadow: `0 0 24px rgba(255,51,51,0.5)`, animation: 'orb-breathe 2s ease-in-out infinite' }} />
                  <p className="text-sm" style={{ color: t.textSecondary }}>Fetching from Action Center…</p>
                </div>
              ) : tasksError ? (
                <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>{tasksError}</div>
              ) : totalFiltered === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <p className="text-sm" style={{ color: t.textMuted }}>
                    {isToday ? 'No pending tasks' : `No tasks on ${new Date(selectedTaskDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </p>
                </div>
              ) : (
                <>
                  {filteredMy.length > 0 && (
                    <>
                      {sectionLabel('My Tasks')}
                      {filteredMy.map(renderTask)}
                    </>
                  )}
                  {filteredOther.length > 0 && (
                    <>
                      {filteredMy.length > 0 && (
                        <div style={{ height: 1, background: dividerColor, margin: '4px 0 2px' }} />
                      )}
                      {sectionLabel(isToday ? 'Pending Tasks' : 'Tasks')}
                      {filteredOther.map(renderTask)}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Shared release list renderer ─────────────────────────────────────────
  const renderReleaseList = (
    capId: 'rpa' | 'maestro' | 'case',
    filterFn: (r: ProcessRelease) => boolean,
    emptyMsg: string,
    loadingMsg: string,
    accentColor: string,
  ) => {
    const cap = themedCaps.find(c => c.id === capId)!;
    const filtered = releases.filter(filterFn);
    const subtitle = releasesLoading ? 'Loading…'
      : releasesError ? 'Error loading'
      : `${filtered.length} automation${filtered.length !== 1 ? 's' : ''}`;

    return (
      <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
        <div className="px-5 pt-3 pb-4 flex-shrink-0 flex items-center gap-3">
          <button onClick={() => setSelectedCapability(null)} className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ width: 36, height: 36, ...backBtnStyle }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="font-bold" style={{ fontSize: 24, color: t.textPrimary }}>{cap.label}</h1>
            <p className="text-sm" style={{ color: t.textSecondary }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2">
          {releasesLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-10 h-10 rounded-full" style={{
                background: accentColor === ORANGE
                  ? `radial-gradient(circle at 35% 25%, rgba(250,150,80,0.9) 0%, ${ORANGE} 60%, rgba(120,25,5,1) 100%)`
                  : `radial-gradient(circle at 35% 25%, rgba(100,220,230,0.9) 0%, ${TEAL} 60%, rgba(4,50,60,1) 100%)`,
                boxShadow: `0 0 24px ${accentColor}88`,
                animation: 'orb-breathe 2s ease-in-out infinite',
              }} />
              <p className="text-sm" style={{ color: t.textSecondary }}>{loadingMsg}</p>
            </div>
          ) : releasesError ? (
            <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              {releasesError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-sm" style={{ color: t.textMuted }}>{emptyMsg}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
            {filtered.map((r) => {
              const typeLabel = capId === 'rpa' ? 'Process' : capId === 'maestro' ? 'Maestro' : 'Case';
              const iconEl = capId === 'rpa' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                  <path d="M7 10l2.5 2.5L15 7"/>
                </svg>
              ) : capId === 'maestro' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 7v5l3 3"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <path d="M9 13l2.5 2.5L16 11"/>
                </svg>
              );
              return (
                <button
                  key={r.ProcessKey}
                  onClick={() => { setSelectedRelease(r); setJobTab('running'); }}
                  className="w-full text-left rounded-2xl active:opacity-70 transition-opacity"
                  style={{
                    background: `linear-gradient(to right, ${accentColor}0e 0%, ${isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'} 35%)`,
                    border: `1px solid ${t.border}`,
                    borderLeft: `3px solid ${accentColor}55`,
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Icon */}
                    <div
                      className="flex-shrink-0 rounded-xl flex items-center justify-center"
                      style={{ width: 40, height: 40, background: `${accentColor}14`, border: `1px solid ${accentColor}28` }}
                    >
                      {iconEl}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-snug" style={{ fontSize: 14, color: t.textPrimary }}>{r.Name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded-full flex-shrink-0" style={{ width: 5, height: 5, background: '#22c55e', boxShadow: '0 0 4px rgba(34,197,94,0.6)' }} />
                        <span style={{ fontSize: 11, color: t.textMuted, letterSpacing: 0.2 }}>Ready · {typeLabel}</span>
                      </div>
                    </div>

                    {/* Run indicator */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{ width: 32, height: 32, background: `${accentColor}1a`, border: `1px solid ${accentColor}38` }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill={accentColor}><polygon points="2,1 11,6 2,11"/></svg>
                    </div>
                  </div>
                  {/* ProcessKey — kept for reference, hidden from UI */}
                  <p style={{ display: 'none' }}>{r.ProcessKey}</p>
                </button>
              );
            })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── RPA Workflow drill-in ─────────────────────────────────────────────────
  if (selectedCapability === 'rpa') {
    return renderReleaseList(
      'rpa',
      r => r.ProcessType === 'Process',
      'No RPA workflows found',
      'Fetching workflows…',
      ORANGE,
    );
  }

  // ── Maestro drill-in ──────────────────────────────────────────────────────
  if (selectedCapability === 'maestro') {
    return renderReleaseList(
      'maestro',
      r => r.ProcessType === 'ProcessOrchestration',
      'No Maestro processes found',
      'Fetching processes…',
      TEAL,
    );
  }

  // ── Case Management drill-in ──────────────────────────────────────────────
  if (selectedCapability === 'case') {
    return renderReleaseList(
      'case',
      r => r.ProcessType === 'CaseManagement',
      'No case management processes found',
      'Fetching cases…',
      ORANGE,
    );
  }

  // ── Other capability placeholder ──────────────────────────────────────────
  if (selectedCapability && selectedCapability !== 'agents') {
    const cap = themedCaps.find(c => c.id === selectedCapability)!;
    return (
      <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>
        <div className="px-5 pt-3 pb-4 flex-shrink-0 flex items-center gap-3">
          <button onClick={() => setSelectedCapability(null)} className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
            style={{ width: 36, height: 36, ...backBtnStyle }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={backBtnStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="font-bold" style={{ fontSize: 24, color: t.textPrimary }}>{cap.label}</h1>
            <p className="text-sm" style={{ color: t.textSecondary }}>{cap.subtitle}</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="rounded-3xl flex items-center justify-center" style={{ width: 72, height: 72, background: cap.gradient, border: `1px solid ${cap.accentColor}33`, color: cap.accentColor, boxShadow: `0 0 32px ${cap.glowColor}` }}>
            {cap.icon}
          </div>
          <p className="text-center text-sm" style={{ color: t.textMuted }}>{cap.label} capabilities coming soon.</p>
        </div>
      </div>
    );
  }

  // ── Root capability grid ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>

      {/* Header — centered logo + tagline + Explore title */}
      <div className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 px-5">
        <img
          src={theme === 'light' ? './uipath-logo-light.png' : './uipath-logo.png'}
          alt="UiPath"
          style={{ height: 22, objectFit: 'contain' }}
        />
        <p style={{ fontSize: 10.5, color: TEAL, marginTop: 3, letterSpacing: 0.3, textAlign: 'center', fontStyle: 'italic' }}>
          Agentic AI · Built for the enterprise
        </p>
        <div className="flex items-center gap-3 w-full mt-2">
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
          <span className="font-bold" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1 }}>EXPLORE</span>
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
        </div>
      </div>

      {/* Grid — 3 rows sized to fill remaining height so all six cards are
       * visible without scrolling. A small minmax floor keeps them looking
       * fine on shorter viewports. */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ padding: '0 16px 12px' }}>
        <div className="grid grid-cols-2 gap-2" style={{ gridTemplateRows: 'repeat(3, minmax(0, 1fr))', height: '100%' }}>
          {themedCaps.map((cap) => {
            const isLight = theme === 'light';
            const videoFadeBg = cap.gradient.match(/#[0-9a-f]{6}/gi)?.[1] ?? '#041a20';
            const cardBackground = isLight ? '#ffffff' : cap.gradient;
            const cardBorder = isLight ? `${cap.accentColor}40` : `${cap.accentColor}22`;
            const cardShadow = isLight
              ? '0 1px 2px rgba(24,33,38,0.04), 0 6px 16px rgba(24,33,38,0.07)'
              : 'none';
            const labelColor = isLight ? t.textPrimary : '#fff';
            const subtitleColor = isLight ? 'rgba(24,33,38,0.55)' : 'rgba(255,255,255,0.4)';
            const badgeBg = isLight ? `${cap.accentColor}1f` : `${cap.accentColor}18`;
            const badgeBorder = isLight ? `${cap.accentColor}4d` : `${cap.accentColor}28`;
            const arrowOpacity = isLight ? 0.85 : 0.65;
            return (
              <button
                key={cap.id}
                onClick={() => setSelectedCapability(cap.id)}
                className="rounded-2xl overflow-hidden text-left active:scale-95 transition-transform flex flex-col"
                style={{ background: cardBackground, border: `1px solid ${cardBorder}`, boxShadow: cardShadow }}
              >
                {/* Video — fills ~60% of card height */}
                <div className="relative overflow-hidden flex-shrink-0" style={{ flex: '0 0 62%', background: '#050d12' }}>
                  <VideoEl
                    src={
                      isLight && cap.id === 'agents' ? './chat-agent-card.mp4' :
                      isLight && cap.id === 'rpa' ? './rpa-card-light.mp4' :
                      (cap.videoSrc ?? './agent-card.mp4')
                    }
                    autoPlay muted playsInline preload="auto"
                    poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
                    style={{ width: '100%', height: '100%', objectFit: isLight && (cap.id === 'agents' || cap.id === 'rpa') ? 'cover' : 'contain', objectPosition: isLight && cap.id === 'rpa' ? 'center 85%' : 'center', opacity: 0, transition: 'opacity 0.5s ease', transform: isLight && cap.id === 'rpa' ? 'scale(1.3)' : isLight && cap.id === 'agents' ? 'scale(1.15)' : `scale(${'videoScale' in cap && cap.videoScale ? cap.videoScale : 1})` }}
                    onCanPlay={(e) => { (e.target as HTMLVideoElement).style.opacity = '1'; }}
                    onTimeUpdate={(e) => {
                      const v = e.target as HTMLVideoElement;
                      if (v.duration && v.currentTime >= v.duration - 0.15) v.currentTime = 0;
                    }}
                    onEnded={(e) => { const v = e.target as HTMLVideoElement; v.currentTime = 0; v.play(); }}
                  />
                  {!isLight && (() => {
                    const isReduced = cap.id === 'delegate' || cap.id === 'tasks';
                    return (
                      <>
                        <span className="absolute top-2 left-2.5 w-1.5 h-1.5 rounded-full" style={{ background: cap.accentColor, boxShadow: `0 0 6px ${cap.accentColor}` }} />
                        <div className="absolute top-0 right-0 pointer-events-none" style={{ width: isReduced ? '45%' : '65%', height: isReduced ? '45%' : '65%', opacity: isReduced ? 0.45 : 1, background: `radial-gradient(ellipse at 90% 5%, ${cap.glowColor} 0%, transparent 70%)` }} />
                        <div className="absolute bottom-0 left-0 right-0" style={{ height: isReduced ? 14 : 28, opacity: isReduced ? 0.6 : 1, background: `linear-gradient(to bottom, transparent, ${videoFadeBg})` }} />
                      </>
                    );
                  })()}
                </div>

                {/* Card body — tightly stacked */}
                <div className="flex flex-col justify-between flex-1 px-3 pt-2 pb-2.5">
                  <div>
                    <p className="font-bold leading-tight" style={{ fontSize: 13, color: labelColor }}>{cap.label}</p>
                    <p className="leading-snug" style={{ fontSize: 10.5, color: subtitleColor, marginTop: 2 }}>{cap.subtitle}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="rounded px-1.5 py-0.5 font-bold" style={{ fontSize: 8.5, background: badgeBg, color: cap.accentColor, border: `1px solid ${badgeBorder}`, letterSpacing: 0.5 }}>
                      {cap.id === 'agents' ? 'AGENTIC AI' : cap.id === 'rpa' ? 'AUTOMATION' : cap.id === 'maestro' ? 'ORCHESTRATION' : cap.id === 'case' ? 'CASE MANAGEMENT' : cap.id === 'delegate' ? 'DELEGATION' : 'TASK MANAGEMENT'}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={cap.accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: arrowOpacity }}>
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
