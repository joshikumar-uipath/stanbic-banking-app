/** Decorative face-scan mesh icon used on the intro screen. */
export function FaceMeshIcon({ size = 120 }: { size?: number }) {
  const c = "#39d4e6";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* corner brackets */}
      <path d="M14 34V20a6 6 0 0 1 6-6h14" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M106 34V20a6 6 0 0 0-6-6H86" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 86v14a6 6 0 0 0 6 6h14" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M106 86v14a6 6 0 0 1-6 6H86" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      {/* face outline */}
      <ellipse cx="60" cy="58" rx="26" ry="32" stroke={c} strokeWidth="1.6" opacity="0.9" />
      {/* mesh lines */}
      <path d="M60 26v64M34 58h52M42 40c12 8 24 8 36 0M42 76c12-8 24-8 36 0" stroke={c} strokeWidth="1" opacity="0.5" />
      <path d="M48 48c4 3 20 3 24 0M48 68c4-3 20-3 24 0" stroke={c} strokeWidth="1" opacity="0.5" />
      {/* eyes + nose hints */}
      <circle cx="50" cy="52" r="2" fill={c} />
      <circle cx="70" cy="52" r="2" fill={c} />
      <path d="M60 56v8M56 66h8" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
