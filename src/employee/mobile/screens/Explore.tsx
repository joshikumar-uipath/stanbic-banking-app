// Explore — start something, see what you can open, and see how it works
// behind the scenes (the platform's six showcase films, captioned for a bank).
import { useState } from 'react';
import { Icn } from '../../../components/customerUi';
import LiveVideo from '../LiveVideo';
import { useNav, type Route } from '../nav';
import { NScreen, NSection, NGroup, NRow, NSheet, NButton } from '../nkit';
import { useNk, haptic } from '../nk';

const STARTS: { icon: string; label: string; go: 'capture' | 'newBatch' | 'find' | 'branches' }[] = [
  { icon: 'scanLine', label: 'Scan a form', go: 'capture' },
  { icon: 'layers', label: 'Bulk opening', go: 'newBatch' },
  { icon: 'search', label: 'Find a customer', go: 'find' },
  { icon: 'building', label: 'Branch & ATM finder', go: 'branches' },
];

const PRODUCTS: { name: string; tag?: string; needs: string }[] = [
  { name: 'Savings', needs: 'BVN or NIN, photo ID, utility bill' },
  { name: 'Current', needs: 'BVN, photo ID, utility bill, two references' },
  { name: 'Domiciliary', tag: 'USD · GBP · EUR', needs: 'BVN, photo ID, utility bill' },
  { name: 'Business (SME)', needs: 'CAC certificate, directors’ IDs and BVNs' },
];

interface Film { id: string; title: string; line: string; more: string; src: string }
const FILMS: Film[] = [
  { id: 'agents', title: 'Agents', line: 'Read every form and draft every customer message', src: './agent-card.mp4',
    more: 'AI agents read handwritten forms and IDs, flag the fields they are unsure of for a maker, and draft the SMS or email a customer needs next — in plain language.' },
  { id: 'rpa', title: 'Robots', line: 'Key approved accounts into core banking', src: './rpa-card.mp4',
    more: 'Once an application is approved, robots create the customer and the account in core banking exactly as a teller would — no re-keying, no typos.' },
  { id: 'maestro', title: 'Maestro', line: 'Runs each application from capture to account', src: './maestro-card.mp4',
    more: 'Maestro orchestrates every step — BVN and NIN checks, screening, decisions, account creation — and waits for a person only where a person is needed.' },
  { id: 'case', title: 'Case management', line: 'Every exception tracked until it’s resolved', src: './case-card.mp4',
    more: 'When something stops, it becomes a case with an owner, an SLA and a history, so nothing is lost between the branch, Operations and Compliance.' },
  { id: 'delegate', title: 'Delegate', line: 'Hand a case to Operations or Compliance in one tap', src: './delegate-card.mp4',
    more: 'Hand a case on with its context attached — the right team picks it up from their queue, and you see it move.' },
  { id: 'tasks', title: 'Tasks', line: 'A person signs off wherever policy says so', src: './tasks-card.mp4',
    more: 'Maker–checker approvals, four-eyes account opening and compliance reviews arrive as tasks, each with the evidence needed to decide.' },
];

export default function Explore() {
  const nav = useNav();
  const nk = useNk();
  const [film, setFilm] = useState<Film | null>(null);

  const start = (go: (typeof STARTS)[number]['go']) => {
    haptic();
    if (go === 'branches') { window.open('https://www.google.com/maps/search/FirstBank+branch+near+me', '_blank', 'noreferrer'); return; }
    nav.open({ k: go } as Route);
  };

  return (
    <NScreen title="Explore">
      <NSection title="Start something">
        <div className="mw-starts">
          {STARTS.filter((s) => nav.role === 'rm' || s.go === 'find' || s.go === 'branches').map((s) => (
            <button key={s.go} type="button" className="mw-starts-b tap" onClick={() => start(s.go)} style={{ color: nk.ink }}>
              <span className="mw-starts-c" style={{ borderColor: nk.sep, color: nk.accent }}><Icn name={s.icon} size={22} color="currentColor" strokeWidth={1.6} /></span>
              {s.label}
            </button>
          ))}
        </div>
      </NSection>

      <NSection title="How it works behind the scenes">
        <div className="mw-films">
          {FILMS.map((f) => (
            <button key={f.id} type="button" className="mw-film tap" onClick={() => { haptic(); setFilm(f); }}>
              <span className="mw-film-v" style={{ background: nk.fill }}>
                <LiveVideo src={f.src} />
              </span>
              <span className="mw-film-t" style={{ color: nk.ink }}>{f.title}</span>
              <span className="mw-film-s" style={{ color: nk.ink2 }}>{f.line}</span>
            </button>
          ))}
        </div>
      </NSection>

      <NSection title="Accounts you can open">
        <NGroup>
          {PRODUCTS.map((p) => (
            <NRow key={p.name}
              title={<>{p.name}{p.tag && <span className="mono" style={{ fontSize: 12, color: nk.ink2, marginLeft: 8 }}>{p.tag}</span>}</>}
              subtitle={p.needs} onClick={nav.role === 'rm' ? () => nav.open({ k: 'capture' }) : undefined} />
          ))}
        </NGroup>
      </NSection>

      {film && (
        <NSheet title={film.title} subtitle={film.line} onClose={() => setFilm(null)}
          footer={<NButton kind="secondary" onClick={() => setFilm(null)}>Done</NButton>}>
          <span className="mw-film-big" style={{ background: nk.fill }}><LiveVideo src={film.src} /></span>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: nk.ink }}>{film.more}</p>
        </NSheet>
      )}
    </NScreen>
  );
}
