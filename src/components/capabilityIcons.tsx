// Static registry for the SVG icons rendered inside each Explore tile.
// Keyed by Capability.id from the runtime config — admins edit the
// surrounding label/video/colors per tile, but the icon shape itself
// requires a code change. Adding a new id without registering an icon
// shows a generic dot fallback.

import type { ReactNode } from 'react';

const CAPABILITY_ICONS: Record<string, ReactNode> = {
  agents: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2z" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <circle cx="9" cy="7" r="0.5" fill="currentColor" />
      <circle cx="15" cy="7" r="0.5" fill="currentColor" />
    </svg>
  ),
  rpa: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  ),
  maestro: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.35" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  ),
  case: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M9 13l2.5 2.5L16 11" />
    </svg>
  ),
  delegate: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="8" r="3" />
      <circle cx="17" cy="16" r="3" />
      <path d="M10 8h5a1 1 0 0 1 1 1v4" />
      <path d="M14 13l3 3-3 3" />
    </svg>
  ),
  tasks: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
};

const FALLBACK_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);

export function getCapabilityIcon(id: string): ReactNode {
  return CAPABILITY_ICONS[id] ?? FALLBACK_ICON;
}
