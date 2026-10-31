import { getSetting, setSetting, useSetting } from './settingsStore';

// How the Architecture Relay renders its components:
//  - 'consolidated' (default, original): every component box is always on screen;
//    Play just highlights the active ones.
//  - 'stacked': the group boxes / bands / structure stay, but component boxes are
//    hidden until the simulation reaches them - each one appears as it's navigated
//    and stays, so the architecture builds up step by step.
// The choice persists in Data Fabric (shared across viewers), not localStorage.
export type RelayView = 'consolidated' | 'stacked';
const KEY = 'relayView';

export function getRelayView(): RelayView {
  const v = getSetting(KEY);
  return v === 'consolidated' || v === 'stacked' ? v : 'consolidated';
}

export function setRelayView(v: RelayView): void {
  void setSetting(KEY, v);
}

// React hook - re-renders any subscriber when the view changes anywhere (the Admin page
// and the relay live on different routes; the shared Data Fabric cache + window event
// keep them in sync).
export function useRelayView() {
  const raw = useSetting(KEY);
  const relayView: RelayView = raw === 'consolidated' || raw === 'stacked' ? raw : 'consolidated';
  return { relayView, setRelayView };
}
