// ─────────────────────────────────────────────────────────────────────────────
// Demo instruments — the bank's own systems, stood in for.
//
// Kafka (/kafka) and Finacle (/finacle) are "behind the scenes" consoles. They
// read the SAME shared store every other surface writes to, so they light up
// live from actions taken elsewhere: capture on the desk, resolve in Ops, and
// the event stream and the core-banking ledger update on their own.
//
// Standalone routes with no host app, so — like the front door and the KYC link
// — they wrap themselves in the tenant config and push branding into CSS vars.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, type ReactNode } from 'react';
import { ConfigProvider, useConfig, loadLocalConfig, stanbicConfig, brandMark } from '../config';
import './instruments.css';

/** Admin's profile wins; Stanbic is the fallback when nothing is configured. */
export function InstrumentProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadLocalConfig() ?? stanbicConfig, []);
  return <ConfigProvider initialOverride={initial}>{children}</ConfigProvider>;
}

/** The navy bar shared by both consoles: bank identity + the system's name. */
export function TopBar({ system, sub }: { system: string; sub: string }) {
  const { branding } = useConfig();
  const mark = brandMark(branding);
  return (
    <header className="inst-top">
      <div className="logo">
        <span className="mark"><img src={mark} alt="" /></span>
        <span className="wm"><b>{branding.appName}</b><em>{sub}</em></span>
      </div>
      <span className="sys">{system}</span>
      <span className="live"><i />Live</span>
      <a className="back" href="/">← Launcher</a>
    </header>
  );
}
