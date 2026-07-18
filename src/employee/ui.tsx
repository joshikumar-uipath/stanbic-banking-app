// Shared primitives for the desk shell (/employee-web).
import type { ReactNode, CSSProperties } from 'react';

const P: Record<string, ReactNode> = {
  desk: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  idcard: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2.2" /><path d="M6 16c0-1.6 1.7-2.2 2.5-2.2S11 14.4 11 16" /><path d="M14 9.5h4M14 12.5h4M14 15h2.5" /></>,
  check: <><path d="M5 13l4 4L19 7" /></>,
  users: <><path d="M16 19a4 4 0 0 0-8 0" /><circle cx="12" cy="8" r="3.2" /><path d="M21 19a3.5 3.5 0 0 0-5-3.2M3 19a3.5 3.5 0 0 1 5-3.2" /></>,
  chat: <><path d="M21 12c0 4.4-4 8-9 8a10 10 0 0 1-4.3-.9L3 20l1.4-3.7A7.4 7.4 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8z" /></>,
  explore: <><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  out: <><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /><path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" /></>,
  chevron: <><path d="M9 6l6 6-6 6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  zap: <><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

export function I({ n, s = 16, w = 1.8, style }: { n: string; s?: number; w?: number; style?: CSSProperties }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      {P[n] ?? P.desk}
    </svg>
  );
}

export type Tone = 'good' | 'warn' | 'crit' | 'info' | 'idle';
const TAG: Record<Tone, string> = { good: 'green', warn: 'amber', crit: 'red', info: 'info', idle: '' };

export function Tag({ tone = 'idle', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`dk-tag ${TAG[tone]}`}>{children}</span>;
}

export function Dot({ tone = 'idle', live }: { tone?: Tone; live?: boolean }) {
  return <span className={`dk-dot ${tone}${live ? ' live' : ''}`} />;
}

export function Stat({ k, v, sub, tone }: { k: string; v: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="dk-stat">
      <div className="k">{tone && <i style={{ background: tone }} />}{k}</div>
      <div className="v"><b style={tone ? { color: tone } : undefined}>{v}</b>{sub && <s>{sub}</s>}</div>
    </div>
  );
}
