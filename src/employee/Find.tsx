// ─────────────────────────────────────────────────────────────────────────────
// Global find — the desk's one search box.
// Real, not decorative: it looks across openings, approvals and clients at once,
// because a banker asking "where is Ngozi?" doesn't know or care which queue she
// is in. Enter opens the top hit.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { fullName, stateMeta, type OnboardingCase } from '../onboarding';
import { approvals, money } from '../approvalsData';
import { customers } from '../customersData';
import { I, Tag, type Tone } from './ui';
import type { Dest } from './DeskShell';

type Hit = { key: string; who: string; sub: string; kind: string; tone: Tone; go: () => void };

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

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: Hit[] = [];
    for (const c of cases) {
      const n = fullName(c).trim();
      if (n.toLowerCase().includes(t) || c.id.toLowerCase().includes(t) || (c.accountNumber ?? '').includes(t)) {
        const m = stateMeta(c.state);
        out.push({ key: `c-${c.id}`, who: n || 'Unnamed applicant', sub: c.id, kind: m.label,
          tone: m.tone === 'exception' ? 'crit' : m.tone === 'pending' ? 'warn' : m.tone === 'good' ? 'good' : 'info',
          go: () => onOpenCase(c.id) });
      }
    }
    for (const a of approvals) {
      if (a.customer.toLowerCase().includes(t) || a.title.toLowerCase().includes(t)) {
        out.push({ key: `a-${a.id}`, who: a.customer, sub: `${a.title}${a.amount ? ` · ${money(a.amount)}` : ''}`, kind: 'Approval',
          tone: a.slaBreaching ? 'crit' : 'info', go: () => onNavigate('approvals') });
      }
    }
    for (const c of customers) {
      if (c.name.toLowerCase().includes(t) || c.maskedId.toLowerCase().includes(t)) {
        out.push({ key: `k-${c.id}`, who: c.name, sub: `${c.maskedId} · ${c.segment}`, kind: 'Client',
          tone: c.headlineTone === 'warn' ? 'warn' : 'idle', go: () => onNavigate('customers') });
      }
    }
    return out.slice(0, 8);
  }, [q, cases, onNavigate, onOpenCase]);

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
              <Tag tone={h.tone}>{h.kind}</Tag>
            </button>
          )) : <div className="dk-hit none">No match for “{q.trim()}”</div>}
        </div>
      )}
    </div>
  );
}
