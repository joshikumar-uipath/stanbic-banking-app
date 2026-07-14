// In-app navigation for the consumer app: 4 bottom tabs + a push/pop screen
// stack for sub-screens + a digibot modal. No router dependency — keeps the
// whole consumer app self-contained and isolated from the enterprise app.
import { createContext, useContext } from 'react';

export type TabId = 'home' | 'pay' | 'wealth' | 'more';

/** A pushed sub-screen (rendered over the active tab, with a back button). */
export interface ScreenRoute {
  name: string;
  title?: string;
  params?: Record<string, unknown>;
}

export interface NavApi {
  tab: TabId;
  stack: ScreenRoute[];
  digibotOpen: boolean;
  hideBalances: boolean;
  setTab: (t: TabId) => void;
  push: (s: ScreenRoute) => void;
  pop: () => void;
  resetTo: (t: TabId) => void;
  openDigibot: () => void;
  closeDigibot: () => void;
  toggleBalances: () => void;
}

export const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within the consumer NavContext');
  return ctx;
}
