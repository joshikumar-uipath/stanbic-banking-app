// ─────────────────────────────────────────────────────────────────────────────
// Customer App form kit — the primitives the legacy consumer scaffold lacked
// (Button, Field, Input, Note, Chip, Rail). Class-based so hover/focus states
// actually exist; see customer.css.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode, type InputHTMLAttributes } from 'react';
import { useConfig } from '../config';
import Icon from './icons';

export function Button({ children, variant = 'primary', size, ...rest }: { children: ReactNode; variant?: 'primary' | 'ghost' | 'sky'; size?: 'sm' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['cx-btn', variant === 'ghost' ? 'ghost' : variant === 'sky' ? 'sky' : '', size === 'sm' ? 'sm' : ''].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string; hint?: string; error?: string;
}
export function Field({ label, hint, error, ...input }: FieldProps) {
  return (
    <div className="cx-field">
      <label htmlFor={input.id ?? input.name}>{label}</label>
      <input className={`cx-input ${error ? 'bad' : ''}`} id={input.id ?? input.name} {...input} />
      {error ? <div className="cx-err">{error}</div> : hint ? <div className="cx-hint">{hint}</div> : null}
    </div>
  );
}

export function Note({ tone = 'info', icon = 'info', children }: { tone?: 'info' | 'warn' | 'good'; icon?: string; children: ReactNode }) {
  return <div className={`cx-note ${tone}`}><Icon name={icon} size={16} /><div>{children}</div></div>;
}

export function Chip({ tone = 'idle', children }: { tone?: 'good' | 'warn' | 'crit' | 'info' | 'idle'; children: ReactNode }) {
  return <span className={`cx-chip ${tone}`}><i />{children}</span>;
}

export function Rail({ step, total }: { step: number; total: number }) {
  return (
    <>
      <div className="cx-rail">{Array.from({ length: total }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <div className="cx-step-n">Step {step + 1} of {total}</div>
    </>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return <div className="cx-kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

/** Brand lockup — name/logo come from the active tenant config, never hardcoded,
 *  so changing the preset in /admin re-brands the whole flow. */
export function Brand({ sub = 'Open an account' }: { sub?: string }) {
  const { branding } = useConfig();
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(branding.logo) && !failed;
  const initial = (branding.appName || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="cx-brand">
      {showLogo
        ? <img className="cx-logo" src={branding.logo} alt={branding.appName} onError={() => setFailed(true)} />
        : <span className="cx-mark">{initial}</span>}
      <div>
        {!showLogo && <b>{branding.appName}</b>}
        <em>{sub.toUpperCase()}</em>
      </div>
    </div>
  );
}
