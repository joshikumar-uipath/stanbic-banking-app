import { useState, useEffect } from 'react';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';
import type { AgentGetResponse } from '@uipath/uipath-typescript/conversational-agent';

const AGENT_COLORS = [
  'bg-orange-600', 'bg-teal-500', 'bg-orange-500', 'bg-teal-600',
  'bg-orange-700', 'bg-teal-400', 'bg-orange-400', 'bg-teal-700',
];

function getAgentColor(id: number) {
  return AGENT_COLORS[id % AGENT_COLORS.length];
}

function getAgentInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface Props {
  conversationalAgent: ConversationalAgent;
  onSelectAgent: (agent: AgentGetResponse) => void;
  onLogout: () => void;
}

export default function AgentGrid({ conversationalAgent, onSelectAgent, onLogout }: Props) {
  const [agents, setAgents] = useState<AgentGetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    conversationalAgent.getAll()
      .then(setAgents)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load agents'))
      .finally(() => setIsLoading(false));
  }, [conversationalAgent]);

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <div className="px-5 pt-3 pb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Agents</h1>
          {!isLoading && (
            <p className="text-slate-400 text-sm mt-0.5">
              {agents.length} {agents.length === 1 ? 'agent' : 'agents'} available
            </p>
          )}
        </div>
        <button
          onClick={onLogout}
          className="text-slate-400 text-sm hover:text-white transition-colors pb-0.5"
        >
          Sign out
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : error ? (
          <div className="bg-red-900/30 border border-red-800 rounded-2xl p-4 text-red-400 text-sm">
            {error}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center mt-20 px-4">
            <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-300">No agents found</p>
            <p className="text-slate-500 text-sm mt-1">Create Conversational Agents in UiPath Studio to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className="bg-slate-800 rounded-2xl p-4 text-left flex flex-col gap-3 hover:bg-slate-750 active:scale-95 transition-all border border-slate-700/50 hover:border-slate-600"
              >
                <div className={`w-12 h-12 rounded-xl ${getAgentColor(agent.id)} flex items-center justify-center shadow-lg`}>
                  <span className="text-white font-bold text-lg">{getAgentInitials(agent.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm leading-snug truncate">{agent.name}</div>
                  {agent.description && (
                    <div className="text-slate-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                      {agent.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-primary)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--brand-primary)' }}>Ready</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
