// ─────────────────────────────────────────────────────────────────────────────
// The native kit — the building blocks of the employee phone app ("Ledger").
//
// Designed to the conventions phone users already know, rather than to the
// desk's layout:
//   • Large titles that collapse into a nav bar as you scroll.
//   • Lists as full-width rows divided by hairlines — content first, no boxes.
//   • One primary action per screen, docked in the thumb zone.
//   • Bottom sheets for detail and choice, so you never lose your place.
//   • Gestures for the frequent and the final: swipe a row to act on it, slide to
//     confirm what cannot be undone — each with a tappable fallback.
//   • Statuses told apart by shape as well as colour; 44pt minimum targets.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icn } from '../../components/customerUi';
import { useNk, C, haptic, initials } from './nk';
import './nkit.css';

// ── Focus ────────────────────────────────────────────────────────────────────
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let openDialogs = 0;

/** A modal surface: focus moves in, Tab stays inside, Escape closes, focus
 *  returns to where it was, and the app behind is inert while it's open. */
function useDialog(ref: RefObject<HTMLElement | null>, onClose?: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = document.activeElement as HTMLElement | null;
    const app = document.querySelector('.mw-app');
    openDialogs++;
    app?.setAttribute('inert', '');
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && close.current) { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      openDialogs = Math.max(0, openDialogs - 1);
      if (!openDialogs) app?.removeAttribute('inert');
      before?.focus?.({ preventScroll: true });
    };
  }, [ref]);
}

// ── Screen ───────────────────────────────────────────────────────────────────
export function NScreen({ title, eyebrow, onBack, backLabel, actions, lead, hero, heroOnly, tint, children, footer, header, flush, large = true }: {
  title: ReactNode;
  /** Small capitalised line above the large title (who, when, context). */
  eyebrow?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  /** Top-left content when there is no Back (the bank's mark on a home). */
  lead?: ReactNode;
  /** Above the large title, at the top of the scroll (a home's opening). */
  hero?: ReactNode;
  /** The hero replaces the large title (it carries its own greeting). */
  heroOnly?: boolean;
  /** The colour behind the nav bar while the hero is on screen. */
  tint?: string;
  children: ReactNode;
  /** Docked bottom area — the screen's primary action lives here. */
  footer?: ReactNode;
  /** Content between the large title and the scrolling body (search, segments). */
  header?: ReactNode;
  flush?: boolean;
  /** false: a compact title from the start (for pushed detail screens). */
  large?: boolean;
}) {
  const nk = useNk();
  const [scrolled, setScrolled] = useState(!large);
  // A screen that opens takes focus to its title, so a screen reader starts there.
  const titleRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const bigTitle = large && !heroOnly;
  useEffect(() => { if (onBack) (bigTitle ? h1Ref.current : titleRef.current)?.focus({ preventScroll: true }); }, [onBack, bigTitle]);
  return (
    <div className="nk-screen" style={{ background: nk.page, color: nk.ink, ['--sep' as string]: nk.sep }}>
      <div className={`nk-nav${!onBack && lead ? ' has-lead' : ''}`} style={{ background: scrolled || !tint ? nk.page : tint, borderColor: scrolled ? nk.sep : 'transparent' }}>
        <div className="nk-nav-l">
          {onBack && (
            <button type="button" className="nk-back" onClick={() => { haptic(); onBack(); }} style={{ color: nk.accent }} aria-label={backLabel ? `Back to ${backLabel}` : 'Back'}>
              <Icn name="back" size={22} strokeWidth={1.8} />
              {backLabel && <span>{backLabel}</span>}
            </button>
)}
          {!onBack && lead && <div className="nk-nav-lead">{lead}</div>}
        </div>
        <div className="nk-nav-t" ref={titleRef} tabIndex={-1} style={{ opacity: scrolled || !large ? 1 : 0, outline: 'none' }} aria-hidden={!scrolled && large ? true : undefined}>{title}</div>
        <div className="nk-nav-r">{actions}</div>
      </div>
      <div className="nk-scroll" onScroll={large ? (e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > (heroOnly ? 280 : 34)) : undefined}>
        {hero}
        {large && !heroOnly && (
          <div className="nk-large">
            {eyebrow && <div className="nk-eyebrow" style={{ color: nk.ink3 }}>{eyebrow}</div>}
            <h1 ref={h1Ref} tabIndex={-1} style={{ outline: 'none' }} className={`nk-h1${typeof title === 'string' && title.length > 22 ? ' long' : ''}`}>{title}</h1>
          </div>
        )}
        {header && <div className="nk-header">{header}</div>}
        <div className={flush ? 'nk-body flush' : 'nk-body'}>{children}</div>
      </div>
      {footer && <div className="nk-footer" style={{ background: nk.page, borderColor: nk.sep }}>{footer}</div>}
    </div>
  );
}

/** Covers the whole phone, tab bar included — for focus modes. */
export function NImmersive({ children, onClose, label }: { children: ReactNode; onClose?: () => void; label?: string }) {
  const nk = useNk();
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  const root = typeof document !== 'undefined' ? document.getElementById('root') : null;
  const node = <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="nk-immersive" style={{ ['--sep' as string]: nk.sep, outline: 'none' }}>{children}</div>;
  return root ? createPortal(node, root) : node;
}

export function NNavButton({ icon, label, onClick, badge }: { icon: string; label: string; onClick: () => void; badge?: boolean }) {
  const nk = useNk();
  return (
    <button type="button" className="nk-navbtn" onClick={() => { haptic(); onClick(); }} aria-label={label} style={{ color: nk.accent }}>
      <Icn name={icon} size={22} strokeWidth={1.7} />
      {badge && <i className="nk-navbtn-dot" />}
    </button>
  );
}

// ── Sections & lists ─────────────────────────────────────────────────────────
export function NSection({ title, action, aside, footer, children, style }: {
  title?: ReactNode; action?: { label: string; onClick: () => void }; aside?: ReactNode; footer?: ReactNode; children: ReactNode; style?: CSSProperties;
}) {
  const nk = useNk();
  return (
    <section className="nk-section" style={style}>
      {(title || action || aside) && (
        <div className="nk-section-h">
          {title && <h2 style={{ color: nk.ink3 }}>{title}</h2>}
          {aside && !action && <span className="nk-section-aside" style={{ color: nk.ink3 }}>{aside}</span>}
          {action && <button type="button" className="nk-link" style={{ color: nk.accent }} onClick={() => { haptic(); action.onClick(); }}>{action.label}</button>}
        </div>
      )}
      {children}
      {footer && <p className="nk-section-f" style={{ color: nk.ink3 }}>{footer}</p>}
    </section>
  );
}

export function NGroup({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const nk = useNk();
  return <div className="nk-group" style={{ ['--sep' as string]: nk.sep, ...style }}>{children}</div>;
}

export interface SwipeAction { label: string; icon: string; color: string; run: () => void }

/** One row. Optional swipe: drag right for `lead`, left for `trail`. */
export function NRow({ icon, avatar, title, subtitle, detail, value, onClick, chevron = true, lead, trail, tone, children }: {
  icon?: { name: string; color: string };
  avatar?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  lead?: SwipeAction;
  trail?: SwipeAction;
  /** A status mark before the title (its shape follows the colour). */
  tone?: string;
  children?: ReactNode;
}) {
  const nk = useNk();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const swiped = useRef(false);
  const LIMIT = 96;

  const onDown = (e: React.PointerEvent) => {
    if (!lead && !trail) return;
    start.current = { x: e.clientX, y: e.clientY, on: false };
    swiped.current = false;
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4) { s.on = true; setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
      else return;
    }
    let v = mx;
    if (v > 0 && !lead) v = 0;
    if (v < 0 && !trail) v = 0;
    setDx(Math.max(-140, Math.min(140, v)));
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.on) return;
    setDragging(false);
    swiped.current = true;
    if (dx > LIMIT && lead) { haptic('success'); lead.run(); }
    else if (dx < -LIMIT && trail) { haptic('success'); trail.run(); }
    setDx(0);
  };

  const body = (
    <>
      {icon && <span className="nk-row-ic"><Icn name={icon.name} size={20} color={icon.color === C.gray ? nk.ink2 : icon.color} strokeWidth={1.7} /></span>}
      <span className="nk-row-b">
        <span className="nk-row-t" style={{ color: nk.ink }}>
          {tone && <Glyph color={tone} />}
          <span className="nk-row-tt">{title}</span>
        </span>
        {subtitle && <span className="nk-row-s" style={{ color: nk.ink2 }}>{subtitle}</span>}
        {detail && <span className="nk-row-d" style={{ color: nk.ink3 }}>{detail}</span>}
        {children}
      </span>
      {value !== undefined && <span className="nk-row-v" style={{ color: nk.ink2 }}>{value}</span>}
      {onClick && chevron && <Icn name="chevron" size={16} color={nk.ink3} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
    </>
  );

  return (
    <div className="nk-row-wrap" style={{ ['--sep' as string]: nk.sep }}>
      {(lead || trail) && dx !== 0 && (
        <div className="nk-row-under" style={{ background: dx > 0 ? lead?.color : trail?.color, justifyContent: dx > 0 ? 'flex-start' : 'flex-end' }}>
          {(() => { const a = dx > 0 ? lead : trail; return a ? <span className={`nk-row-act${Math.abs(dx) > LIMIT ? ' go' : ''}`}><Icn name={a.icon} size={18} color="#fff" strokeWidth={2} />{a.label}</span> : null; })()}
        </div>
      )}
      <div
        className={`nk-row${onClick ? ' tap' : ''}${avatar === undefined ? ' wraps' : ''}`}
        style={{ background: nk.page, transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? 'none' : 'transform .25s cubic-bezier(.2,.9,.3,1)' }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        onClick={onClick ? () => { if (swiped.current) { swiped.current = false; return; } haptic(); onClick(); } : undefined}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        {body}
      </div>
      {/* The swipe actions as real buttons too — reachable by keyboard and
          screen reader, and shown when focused. */}
      {(lead || trail) && (
        <span className="nk-row-alt">
          {lead && <button type="button" onClick={() => { haptic('success'); lead.run(); }} style={{ background: lead.color }}>{lead.label}</button>}
          {trail && <button type="button" onClick={() => { haptic('success'); trail.run(); }} style={{ background: trail.color }}>{trail.label}</button>}
        </span>
      )}
    </div>
  );
}

// ── Cards & marks ────────────────────────────────────────────────────────────
export function NCard({ children, onClick, style, pad = 16 }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; pad?: number }) {
  const nk = useNk();
  const s: CSSProperties = { background: nk.page, padding: pad, ['--sep' as string]: nk.sep, borderColor: nk.sep, ...style };
  return onClick
    ? <button type="button" className="nk-card tap" style={s} onClick={() => { haptic(); onClick(); }}>{children}</button>
    : <div className="nk-card" style={s}>{children}</div>;
}

/** Initials in a circle — quiet in lists, the bank's navy when it is you. */
export function NAvatar({ name, size = 40, solid }: { name: string; size?: number; solid?: boolean; ring?: string }) {
  const nk = useNk();
  return (
    <span className="nk-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: solid ? nk.brandFill : nk.fill, color: solid ? '#fff' : nk.accent }}>
      {initials(name)}
    </span>
  );
}

/**
 * The status mark. Shape follows meaning so colour is never the only cue:
 * ■ needs you · □ waiting on someone · ◧ moving on its own · ✓ done · ○ other.
 */
export function Glyph({ color, size = 8 }: { color: string; size?: number }) {
  const base: CSSProperties = { width: size, height: size };
  if (color === C.red) return <i className="nk-glyph" aria-hidden style={{ ...base, background: color }} />;
  if (color === C.orange) return <i className="nk-glyph" aria-hidden style={{ ...base, border: `1.5px solid ${color}` }} />;
  if (color === C.blue) return <i className="nk-glyph" aria-hidden style={{ ...base, border: `1.5px solid ${color}`, background: `linear-gradient(90deg, ${color} 50%, transparent 50%)` }} />;
  if (color === C.green) return (
    <svg width={size + 1} height={size + 1} viewBox="0 0 10 10" aria-hidden style={{ flex: '0 0 auto' }}>
      <path d="M1.2 5.3 4 8 8.8 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return <i className="nk-glyph" aria-hidden style={{ ...base, border: `1.5px solid ${color}`, borderRadius: '50%' }} />;
}

/** Status in words with its mark — never colour alone. */
export function NStatus({ color, children }: { color: string; children: ReactNode; strong?: boolean }) {
  return <span className="nk-status" style={{ color }}><Glyph color={color} />{children}</span>;
}

/** A small outlined code (PND, a channel, a type). */
export function NTag({ children }: { children: ReactNode }) {
  const nk = useNk();
  return <span className="nk-tag" style={{ color: nk.ink2, borderColor: nk.line }}>{children}</span>;
}

/** The key number of a screen. */
export function NBig({ children, mark = true }: { children: ReactNode; mark?: boolean }) {
  return <span className="nk-big" style={mark ? undefined : { borderBottomColor: 'transparent' }}>{children}</span>;
}

export function NRing({ value, size = 72, stroke = 4, color = C.green, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const nk = useNk();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="nk-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={nk.sep} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={len} strokeDashoffset={len * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.9,.3,1)' }} />
      </svg>
      <span className="nk-ring-c">{children}</span>
    </span>
  );
}

export function NBar({ value, color = C.blue }: { value: number; color?: string }) {
  const nk = useNk();
  return <span className="nk-bar" style={{ background: nk.sep }}><i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></span>;
}

// ── Controls ─────────────────────────────────────────────────────────────────
type Kind = 'primary' | 'secondary' | 'tinted' | 'destructive' | 'plain' | 'success';
export function NButton({ kind = 'primary', children, onClick, disabled, icon, small, full = true, href, style }: {
  kind?: Kind; children: ReactNode; onClick?: () => void; disabled?: boolean; icon?: string; small?: boolean; full?: boolean; href?: string; style?: CSSProperties;
}) {
  const nk = useNk();
  const look: Record<Kind, CSSProperties> = {
    primary: { background: nk.brandFill, color: '#fff' },
    success: { background: C.green, color: nk.dark ? '#0B0F14' : '#fff' },
    secondary: { background: nk.page, color: nk.accent, borderColor: nk.line },
    tinted: { background: nk.fill, color: nk.accent },
    destructive: { background: nk.page, color: C.red, borderColor: nk.sep },
    plain: { background: 'transparent', color: nk.accent, padding: small ? '0 4px' : undefined },
  };
  const s: CSSProperties = { ...look[kind], width: full ? '100%' : undefined, ...(disabled ? { background: nk.sep, color: nk.ink2, borderColor: 'transparent' } : {}), ...style };
  const cls = `nk-btn tap${small ? ' sm' : ''}`;
  const inner = <>{icon && <Icn name={icon} size={small ? 16 : 19} color="currentColor" strokeWidth={1.8} />}<span>{children}</span></>;
  if (href) return <a className={cls} style={s} href={href} target="_blank" rel="noreferrer" onClick={() => haptic()}>{inner}</a>;
  return <button type="button" className={cls} style={s} disabled={disabled} onClick={() => { if (disabled) return; haptic(); onClick?.(); }}>{inner}</button>;
}

/** One of a ruled strip of contact-card actions (wrap them in .mw-quicks). */
export function NQuick({ icon, label, onClick, disabled, href }: { icon: string; label: string; onClick?: () => void; disabled?: boolean; href?: string }) {
  const nk = useNk();
  const inner = (
    <>
      <span className="nk-quick-c" style={{ color: nk.accent }}><Icn name={icon} size={20} color="currentColor" strokeWidth={1.6} /></span>
      <span className="nk-quick-l" style={{ color: nk.accent }}>{label}</span>
    </>
  );
  const s: CSSProperties = { opacity: disabled ? 0.4 : 1, ['--sep' as string]: nk.sep };
  if (href) return <a className="nk-quick tap" href={href} onClick={() => haptic()} style={s}>{inner}</a>;
  return <button type="button" className="nk-quick tap" disabled={disabled} onClick={() => { haptic(); onClick?.(); }} style={s}>{inner}</button>;
}

export function NSegment<T extends string>({ options, value, onChange }: { options: { id: T; label: string; count?: number; color?: string }[]; value: T; onChange: (v: T) => void }) {
  const nk = useNk();
  return (
    <div className="nk-seg" style={{ background: nk.fill }} role="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="tab" aria-selected={on} className="nk-seg-b"
            onClick={() => { haptic(); onChange(o.id); }}
            style={{ background: on ? (nk.dark ? '#262E39' : '#fff') : 'transparent', color: on ? nk.ink : nk.ink2, fontWeight: on ? 600 : 500, boxShadow: on ? `0 0 0 1px ${nk.sep}` : 'none' }}>
            {o.label}{o.count !== undefined && <span className="mono" style={{ color: o.color ?? nk.ink3, marginLeft: 4 }}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function NChips<T extends string>({ options, value, onChange }: { options: { id: T; label: string; count?: number; color?: string }[]; value: T; onChange: (v: T) => void }) {
  const nk = useNk();
  return (
    <div className="nk-chips">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" className="nk-chip tap" aria-pressed={on} onClick={() => { haptic(); onChange(o.id); }}
            style={{ background: on ? nk.brandFill : nk.page, borderColor: on ? 'transparent' : nk.sep, color: on ? '#fff' : nk.ink }}>
            {o.color && !on && <Glyph color={o.color} />}
            {o.label}{o.count !== undefined && <b style={{ opacity: on ? 0.85 : 0.6 }}>{o.count}</b>}
          </button>
        );
      })}
    </div>
  );
}

export function NSearchField({ value, onChange, placeholder, autoFocus, onFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; onFocus?: () => void }) {
  const nk = useNk();
  return (
    <label className="nk-search" style={{ background: nk.fill }}>
      <Icn name="search" size={18} color={nk.ink2} strokeWidth={1.6} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} onFocus={onFocus} style={{ color: nk.ink }} aria-label={placeholder} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear" className="nk-search-x" style={{ background: nk.ink3 }}><Icn name="close" size={10} color={nk.page} strokeWidth={3} /></button>}
    </label>
  );
}

export function NField({ label, hint, required, children }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  const nk = useNk();
  return (
    <label className="nk-field" style={{ ['--f-bg' as string]: nk.fill, ['--f-ink' as string]: nk.ink, ['--f-sep' as string]: nk.sep }}>
      <span className="nk-field-l" style={{ color: nk.ink3 }}>{label}{required && <em style={{ color: C.red }}> · required</em>}</span>
      {children}
      {hint && <span className="nk-field-h" style={{ color: nk.ink2 }}>{hint}</span>}
    </label>
  );
}

export function NToggle({ on, onChange, label, sub, disabled }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode; disabled?: boolean }) {
  const nk = useNk();
  return (
    <button type="button" role="switch" className="nk-toggle tap" disabled={disabled} aria-checked={on} onClick={() => { haptic(); onChange(!on); }} style={{ opacity: disabled ? 0.5 : 1 }}>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 16, color: nk.ink }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 13, color: nk.ink2, marginTop: 2, lineHeight: 1.35 }}>{sub}</span>}
      </span>
      <span className="nk-switch" style={{ background: on ? nk.brandFill : nk.sep }}><i style={{ transform: on ? 'translateX(20px)' : 'none' }} /></span>
    </button>
  );
}

/**
 * Slide to confirm — for the step that cannot be undone (opening accounts,
 * bulk-resolving an incident). Deliberate by construction, so it is never
 * fired by a stray tap; Enter on the focused handle confirms for keyboard users.
 */
export function NSlide({ label, onConfirm, disabled, color: colorProp, resetKey }: {
  label: string; onConfirm: () => void; disabled?: boolean; color?: string;
  /** Change it to put the handle back (after the action failed, to try again). */
  resetKey?: number;
}) {
  const nk = useNk();
  const color = colorProp ?? nk.brandFill;
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const [max, setMax] = useState(1);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ start: number; max: number } | null>(null);
  const KNOB = 52;

  // Disabling resets the handle (adjusted while rendering, not in an effect).
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (wasDisabled !== disabled) {
    setWasDisabled(disabled);
    if (disabled) { setX(0); setDone(false); }
  }
  const [wasKey, setWasKey] = useState(resetKey);
  if (wasKey !== resetKey) { setWasKey(resetKey); setX(0); setDone(false); }

  const down = (e: React.PointerEvent) => {
    if (disabled || done || !track.current) return;
    drag.current = { start: e.clientX - x, max: track.current.clientWidth - KNOB - 8 };
    setMax(drag.current.max);
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setX(Math.max(0, Math.min(d.max, e.clientX - d.start)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (x >= d.max * 0.88) { setX(d.max); setDone(true); haptic('success'); onConfirm(); }
    else setX(0);
  };
  const ink = disabled ? nk.ink3 : color;
  return (
    <div ref={track} className="nk-slide" style={{ background: disabled ? nk.sep : color }}>
      <span className="nk-slide-fill" style={{ width: x + KNOB + 4 }} />
      <span className="nk-slide-l" style={{ color: disabled ? nk.ink2 : '#fff', opacity: 1 - Math.min(1, x / (max * 0.6)) }}>{label}</span>
      {!disabled && (
        <span className="nk-slide-chev" aria-hidden style={{ opacity: 1 - Math.min(1, x / (max * 0.5)) }}>
          <svg width="10" height="14" viewBox="0 0 10 14"><path d="M2 2l5 5-5 5" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <svg width="10" height="14" viewBox="0 0 10 14"><path d="M2 2l5 5-5 5" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      <button type="button" className="nk-slide-k" aria-label={label} disabled={disabled}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform .3s cubic-bezier(.2,.9,.3,1)', background: disabled ? nk.page : '#fff' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === 'Enter' && !disabled && !done) { setDone(true); haptic('success'); onConfirm(); } }}>
        <Icn name={done ? 'check' : 'arrow'} size={22} color={ink} strokeWidth={1.9} />
      </button>
    </div>
  );
}

// ── Overlays ─────────────────────────────────────────────────────────────────
export function NSheet({ title, subtitle, onClose, children, footer }: { title?: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const nk = useNk();
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useDialog(ref, onClose);
  const root = typeof document !== 'undefined' ? document.getElementById('root') : null;
  const node = (
    <div className="nk-sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title ? tid : undefined} className="nk-sheet" style={{ background: nk.page, color: nk.ink, ['--sep' as string]: nk.sep, outline: 'none' }}>
        <div className="nk-sheet-grip" style={{ background: nk.ink3 }} />
        {(title || subtitle) && (
          <div className="nk-sheet-h">
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <div className="nk-sheet-t" id={tid}>{title}</div>}
              {subtitle && <div className="nk-sheet-s" style={{ color: nk.ink2 }}>{subtitle}</div>}
            </div>
            <button type="button" className="nk-sheet-x" onClick={onClose} aria-label="Close" style={{ background: nk.fill }}>
              <Icn name="close" size={13} color={nk.ink2} strokeWidth={2.4} />
            </button>
          </div>
        )}
        <div className="nk-sheet-body">{children}</div>
        {footer && <div className="nk-sheet-f">{footer}</div>}
      </div>
    </div>
  );
  return root ? createPortal(node, root) : node;
}

/** An action sheet: a list of choices. */
export function NActions({ title, actions, onClose }: { title?: string; actions: { label: string; icon?: string; danger?: boolean; run: () => void }[]; onClose: () => void }) {
  const nk = useNk();
  return (
    <NSheet title={title} onClose={onClose}>
      <NGroup>
        {actions.map((a) => (
          <button key={a.label} type="button" className="nk-action tap" style={{ color: a.danger ? C.red : nk.accent, borderColor: nk.sep }}
            onClick={() => { haptic(); onClose(); a.run(); }}>
            {a.icon && <Icn name={a.icon} size={20} color="currentColor" strokeWidth={1.6} />}
            <span>{a.label}</span>
          </button>
        ))}
      </NGroup>
    </NSheet>
  );
}

/** A short confirmation (or, with tone 'error', a failure). The live region
 *  stays mounted so screen readers announce each new message. */
export function NToast({ text, tone }: { text: string | null; tone?: 'error' }) {
  return (
    <div role="status" aria-live="polite" className="nk-toast-live">
      {text && (
        <div className={`nk-toast${tone === 'error' ? ' err' : ''}`}>
          <Icn name={tone === 'error' ? 'alert' : 'check'} size={16} color="currentColor" strokeWidth={2.2} />{text}
        </div>
      )}
    </div>
  );
}

export function NEmpty({ icon = 'check', title, children, action, color = C.green }: { icon?: string; title: ReactNode; children?: ReactNode; action?: ReactNode; color?: string }) {
  const nk = useNk();
  return (
    <div className="nk-empty" style={{ ['--sep' as string]: nk.sep }}>
      <span className="nk-empty-i" style={{ color }}><Icn name={icon} size={24} color="currentColor" strokeWidth={1.8} /></span>
      <div className="nk-empty-t" style={{ color: nk.ink }}>{title}</div>
      {children && <div className="nk-empty-b" style={{ color: nk.ink2 }}>{children}</div>}
      {action && <div style={{ marginTop: 18, width: '100%' }}>{action}</div>}
    </div>
  );
}

/** The beat between one job and the next. */
export function NSuccess({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="nk-success" role="status">
      <span className="nk-success-c"><Icn name="check" size={28} color="#fff" strokeWidth={2} /></span>
      <div className="nk-success-t">{title}</div>
      {sub && <div className="nk-success-s">{sub}</div>}
    </div>
  );
}
