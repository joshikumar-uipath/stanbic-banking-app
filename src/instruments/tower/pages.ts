// Report page identity. Kept out of chrome.tsx so that file only exports
// components — otherwise fast refresh stops working for the whole module.
export type PageId = 'overview' | 'exceptions' | 'flow' | 'channels' | 'verification' | 'timing';
export const PAGES: { id: PageId; name: string }[] = [
  { id: 'overview', name: 'Overview' },
  { id: 'exceptions', name: 'Exceptions & SLA' },
  { id: 'flow', name: 'Flow' },
  { id: 'channels', name: 'Channels' },
  { id: 'verification', name: 'Verification' },
  { id: 'timing', name: 'Timing' },
];
