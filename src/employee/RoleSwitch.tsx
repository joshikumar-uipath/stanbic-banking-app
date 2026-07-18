// ─────────────────────────────────────────────────────────────────────────────
// Role switcher — the rail's identity block.
//
// Answers "which tool am I in?" and, more importantly, "why does the other one
// look the same?" — because it IS the same workspace; only the job changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { ROLES, roleById } from './roles';
import { I } from './ui';

export default function RoleSwitch({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const me = roleById(active);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="dk-app" ref={box}>
      <button className="dk-role" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span className="t">
          <b>{me.name}</b>
          <em>{me.sub}</em>
        </span>
        <span className={`cv${open ? ' up' : ''}`}><I n="chevron" s={14} /></span>
      </button>

      {open && (
        <div className="dk-roles" role="menu">
          <div className="hd">Same workspace — different job</div>
          {ROLES.map((r) => (
            <a key={r.id} className={`dk-role-i${r.id === active ? ' on' : ''}`} href={r.href} role="menuitem">
              <span className="ck">{r.id === active ? <I n="check" s={13} w={2.6} /> : null}</span>
              <span className="t">
                <b>{r.name}</b>
                <span>{r.blurb}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
