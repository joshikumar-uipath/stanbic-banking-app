// ─────────────────────────────────────────────────────────────────────────────
// Global find — the desk's one search box.
// Real, not decorative: it looks across openings, approvals and clients at once,
// because a banker asking "where is Ngozi?" doesn't know or care which queue she
// is in. Enter opens the top hit.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OnboardingCase } from '../onboarding';
import { I, Tag } from './ui';
import type { Dest } from './DeskShell';
import { findHits, type Hit } from './findModel';

export default function Find({ cases, onNavigate, onOpenCase }: { cases: OnboardingCase[]; onNavigate: (d: Dest) => void; onOpenCase: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Click-away closes the results.
  useEffect(() => {
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

  const hits = useMemo<Hit[]>(() => findHits(q, cases, onNavigate, onOpenCase), [q, cases, onNavigate, onOpenCase]);

  const pick = (h: Hit) => { h.go(); setQ(''); setOpen(false); };

  return (
    <div className="dk-find" ref={box}>
      <span className="s"><I n="search" s={15} /></span>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) pick(hits[0]);
          if (e.key === 'Escape') { setQ(''); setOpen(false); }
        }}
        placeholder="Search customers, applications, references"
        aria-label="Search"
      />
      {open && q.trim().length >= 2 && (
        <div className="dk-hits">
          {hits.length ? hits.map((h) => (
            <button key={h.key} className="dk-hit" onClick={() => pick(h)}>
              <span className="hw">
                <b>{h.who}</b>
                <span>{h.sub}</span>
              </span>
              {h.maestro && <span className="dk-hit-live"><i />{h.maestro}</span>}
              <Tag tone={h.tone}>{h.kind}</Tag>
            </button>
          )) : <div className="dk-hit none">No match for “{q.trim()}”</div>}
        </div>
      )}
    </div>
  );
}
