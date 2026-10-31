export interface AgentRunContext {
  agentName: string;
  summary: string;
  timeAgo: string;
  autoItems: { ref?: string; amount?: string; text: string }[];
  reviewItems: { ref?: string; amount?: string; text: string }[];
  prefill?: string;
  /** Whether the prefill was spoken (default) or typed — typed ones send without the voice marker. */
  prefillVoice?: boolean;
  openCamera?: boolean;
}
