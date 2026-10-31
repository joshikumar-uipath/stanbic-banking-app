import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../config';
import { agentLabel } from '../config/primaryAgent';
import type { ConversationalAgent, AgentGetResponse, ConversationGetResponse } from '@uipath/uipath-typescript/conversational-agent';

interface Props {
  onExplore: () => void;
  conversationalAgent: ConversationalAgent;
  onOpenChat: (agent: AgentGetResponse, conversationId?: string) => void;
}

function formatDateLabel(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'TODAY';
  if (sameDay(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function ChatHistoryTab({ onExplore, conversationalAgent, onOpenChat }: Props) {
  const { t, tr } = useTheme();
  const { agents: agentsConfig } = useConfig();
  const blockedProcessKeys = agentsConfig.blockedProcessKeys;
  const [conversations, setConversations] = useState<ConversationGetResponse[]>([]);
  const [agentMap, setAgentMap] = useState<Map<number, AgentGetResponse>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      conversationalAgent.getAll(),
      conversationalAgent.conversations.getAll(),
    ]).then(([allAgents, convsResult]) => {
      // Build agent map (id → agent), filtering blocked agents
      const map = new Map<number, AgentGetResponse>();
      const blocked = new Set(blockedProcessKeys);
      for (const agent of allAgents) {
        if (!blocked.has(agent.processKey)) {
          map.set(agent.id, agent);
        }
      }
      setAgentMap(map);

      // Show conversation history for the last 7 days, grouped by date, newest first.
      // Skip empty conversations — ones that were created but never exchanged a message.
      // Heuristic: lastActivityTime within 2s of createdTime means no activity happened after creation.
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const seen = new Set<string>();
      const hasActivity = (c: ConversationGetResponse) =>
        new Date(c.lastActivityTime).getTime() - new Date(c.createdTime).getTime() > 2000;
      const sorted = convsResult.items
        .filter((c) => c.agentId != null && map.has(c.agentId))
        .filter(hasActivity)
        .filter((c) => new Date(c.lastActivityTime).getTime() >= sevenDaysAgo)
        .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
        .sort((a, b) => new Date(b.lastActivityTime).getTime() - new Date(a.lastActivityTime).getTime());

      setConversations(sorted);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [conversationalAgent, blockedProcessKeys]);

  const filtered = search
    ? conversations.filter((c) => {
        const agent = c.agentId != null ? agentMap.get(c.agentId) : undefined;
        const agentName = agentLabel(agent, agentsConfig.displayNameOverrides);
        return (
          c.label.toLowerCase().includes(search.toLowerCase()) ||
          agentName.toLowerCase().includes(search.toLowerCase())
        );
      })
    : conversations;

  // Group by date label
  const groups: { label: string; items: ConversationGetResponse[] }[] = [];
  filtered.forEach((conv) => {
    const label = formatDateLabel(conv.lastActivityTime);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(conv);
    else groups.push({ label, items: [conv] });
  });

  return (
    <div className="flex flex-col h-full" style={{ background: t.bgPrimary }}>

      {/* Subtle centre glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 40% at 50% 38%, rgba(20,90,140,0.18) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <div className="px-5 pt-3 pb-5 flex-shrink-0 relative z-10">
        <h1 className="font-bold mb-5" style={{ fontSize: 22, color: t.textPrimary }}>{tr.yourConversation}</h1>

        {/* Search + new button */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 px-4 rounded-full"
            style={{ height: 48, background: t.bgInput, border: `1px solid ${t.borderStrong}` }}>
            <svg style={{ width: 16, height: 16, flexShrink: 0, color: t.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr.searchPlaceholder}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: t.textBody }}
            />
          </div>
          <button
            onClick={onExplore}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 48, height: 48, background: 'var(--brand-primary)', boxShadow: '0 0 20px rgba(var(--brand-primary-rgb),0.4)' }}>
            <svg style={{ width: 20, height: 20 }} className="text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-8 h-8 rounded-full" style={{
              background: 'radial-gradient(circle at 35% 25%,rgba(255,180,140,0.92) 0%,rgba(var(--brand-primary-rgb),0.9) 50%,rgba(120,25,5,1) 100%)',
              boxShadow: '0 0 20px rgba(var(--brand-primary-rgb),0.5)',
              animation: 'orb-breathe 2s ease-in-out infinite',
            }} />
            <p className="text-sm" style={{ color: t.textSecondary }}>Loading conversations...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <p className="font-medium text-sm" style={{ color: t.textMuted }}>{tr.noConversations}</p>
            <p className="text-xs" style={{ color: t.textMuted }}>{tr.startChatting}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold tracking-widest mb-2.5" style={{ color: t.textLabel }}>
                  {group.label === 'TODAY' ? tr.today : group.label === 'YESTERDAY' ? tr.yesterday : group.label}
                </p>
                <div className="rounded-2xl overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                  {group.items.map((conv, idx) => {
                    const agent = conv.agentId != null ? agentMap.get(conv.agentId) : undefined;
                    const agentName = agentLabel(agent, agentsConfig.displayNameOverrides) || 'Unknown Agent';
                    return (
                      <button
                        key={conv.id}
                        onClick={() => agent && onOpenChat(agent, conv.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:opacity-70"
                        style={{
                          ...(idx < group.items.length - 1 ? { borderBottom: `1px solid ${t.divider}` } : {}),
                          opacity: agent ? 1 : 0.4,
                        }}
                      >
                        {/* Icon */}
                        <div className="flex items-center justify-center rounded-full flex-shrink-0"
                          style={{ width: 34, height: 34, background: 'rgba(var(--brand-primary-rgb),0.12)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
                          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="rgba(var(--brand-primary-rgb),0.8)" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{conv.label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs truncate" style={{ color: t.textSecondary }}>{agentName}</p>
                            <span style={{ color: t.textMuted, fontSize: 10 }}>·</span>
                            <p className="text-xs flex-shrink-0" style={{ color: t.textMuted }}>{formatTime(conv.lastActivityTime)}</p>
                          </div>
                        </div>

                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={t.chevron} strokeWidth={2} className="flex-shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
