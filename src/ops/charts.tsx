// ─────────────────────────────────────────────────────────────────────────────
// Small dependency-free SVG chart kit for the Operations Workbench.
// Sparkline · donut · semicircle gauge · avatar · validation dots · nav icons.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingCase } from '../onboarding';
import { VALIDATION_KINDS } from '../onboarding';
import { valOf, hash } from './derive';

export function Spark({ data, color, w = 70, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data), rng = (max - min) || 1;
  const x = (i: number) => (i / (data.length - 1)) * (w - 2) + 1;
  const y = (v: number) => h - 2 - ((v - min) / rng) * (h - 6);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${h} L ${x(0).toFixed(1)} ${h} Z`;
  const gid = `sg-${color.replace('#', '')}`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}

export function Donut({ segments, size = 96, stroke = 14 }: { segments: { label: string; value: number; color: string }[]; size?: number; stroke?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EAEFF6" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-off} />;
          off += len; return el;
        })}
      </g>
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="'Poppins',sans-serif" fontWeight="700" fontSize="21" fill="#0C1826">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="8.5" letterSpacing="0.08em" fill="#93A2B4">CASES</text>
    </svg>
  );
}

export function Gauge({ pct, color, size = 132 }: { pct: number; color: string; size?: number }) {
  const r = (size - 18) / 2, cy = size / 2 + r / 2, circ = Math.PI * r;
  const d = `M ${9} ${cy} A ${r} ${r} 0 0 1 ${size - 9} ${cy}`;
  return (
    <svg width={size} height={cy + 12} viewBox={`0 0 ${size} ${cy + 12}`} aria-hidden="true">
      <path d={d} fill="none" stroke="#EAEFF6" strokeWidth="12" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} />
    </svg>
  );
}

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#2563EB', '#0F8A57', '#B5730E', '#6D4BD8', '#C0392B', '#0E7490'];
  const c = colors[hash(name) % colors.length];
  return <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: c }}>{initials}</span>;
}

const VCOLORS: Record<string, string> = { passed: '#0F8A57', running: '#2563EB', pending: '#CBD5E1', failed: '#D0392C', timeout: '#D0392C', retrying: '#B5730E' };
export function ValidationDots({ c }: { c: OnboardingCase }) {
  return (
    <span className="vdots">
      {VALIDATION_KINDS.map((k) => { const st = valOf(c, k); return <span key={k} title={`${k}: ${st}`} style={{ background: VCOLORS[st] }} />; })}
    </span>
  );
}

// ── Nav / misc icons ──
const IPATHS: Record<string, string> = {
  dashboard: 'M4 4h6v7H4z M14 4h6v4h-6z M14 12h6v8h-6z M4 15h6v5H4z',
  layers: 'm12 2 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 17l9 5 9-5',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6',
  landmark: 'M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M20 10v11 M9 14v3 M15 14v3',
  alert: 'm10.3 3.1-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-2.9l-8-14a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01',
  package: 'M16 3 4 9v6l8 6 8-6V9L16 3Z M4 9l8 4 8-4 M12 13v8',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
};
export function NavIcon({ name, size = 17 }: { name: string; size?: number }) {
  const path = IPATHS[name] ?? IPATHS.list;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
    </svg>
  );
}
