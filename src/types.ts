export interface AgentRunContext {
  agentName: string;
  summary: string;
  timeAgo: string;
  autoItems: { ref?: string; amount?: string; text: string }[];
  reviewItems: { ref?: string; amount?: string; text: string }[];
  prefill?: string;
  openCamera?: boolean;
}
