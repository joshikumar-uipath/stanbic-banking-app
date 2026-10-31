// ─────────────────────────────────────────────────────────────────────────────
// The bank's own conversational agent — the one every chat opens on.
//
// Stanbic_Convo_Agent lives in Orchestrator folder "Banking/Stanbic_Convo_Agent"
// (mea / DefaultTenant, staging). It replaced the generic "Ask UiPath" agent
// (All.in.One.Agent.agent.Agent) and shows to users as "Ask Pulse".
//
// Matched by processKey, not name, so a rename in Orchestrator doesn't break
// it. The label is applied here as well as through `displayNameOverrides`, so
// a config saved before the switch (local profile, Data Service) still shows
// "Ask Pulse".
// ─────────────────────────────────────────────────────────────────────────────
import type { AgentGetResponse } from '@uipath/uipath-typescript/conversational-agent';

export const PRIMARY_AGENT_PROCESS_KEY = 'Stanbic_Convo_Agent.agent.Stanbic_Convo_Agent';
export const PRIMARY_AGENT_LABEL = 'Ask Pulse';

export const isPrimaryAgent = (a: Pick<AgentGetResponse, 'processKey'> | null | undefined) =>
  a?.processKey === PRIMARY_AGENT_PROCESS_KEY;

/** The primary agent from a list, or null if this tenant doesn't have it. */
export const findPrimaryAgent = <T extends Pick<AgentGetResponse, 'processKey'>>(agents: T[]): T | null =>
  agents.find(isPrimaryAgent) ?? null;

/** What to call an agent on screen: the primary agent's label, then any admin
 *  override, then its Orchestrator name with underscores as spaces. */
export function agentLabel(
  agent: Pick<AgentGetResponse, 'name' | 'processKey'> | null | undefined,
  overrides: Record<string, string> = {},
): string {
  if (!agent) return '';
  if (isPrimaryAgent(agent)) return PRIMARY_AGENT_LABEL;
  return overrides[agent.name.trim()] ?? agent.name.replace(/_/g, ' ');
}
