// ─────────────────────────────────────────────────────────────────────────────
// Role switcher — the rail's identity block.
//
// Answers "which tool am I in?" and, more importantly, "why does the other one
// look the same?" — because it IS the same workspace; only the job changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { ROLES, roleById, personaById } from './roles';
import { I } from './ui';

export default function RoleSwitch({ active, persona }: { active: string; persona?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // A persona narrows the tool: still the desk, but a different job on it. The
  // rail shows the job, because that is what decides what the screens will let
  // you do — see roles.ts on why maker and checker are personas, not tools.
  const me = persona && persona !== 'rm' ? personaById(persona) : roleById(active);

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
            // "./#ops", not "/ops": under the coded-app host the app lives at /<slug>/,
            // and a leading "/" leaves it. The hash is how detectRoute picks the surface.
            <a key={r.id} className={`dk-role-i${r.id === active ? ' on' : ''}`} href={'./#' + r.href.replace(/^\/+/, '')} role="menuitem">
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
