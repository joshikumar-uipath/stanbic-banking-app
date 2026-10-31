// ─────────────────────────────────────────────────────────────────────────────
// WelcomeScreen — first screen shown to non-authenticated users.
//
// Apple guideline 5.1.1(i) requires non-account features (chat) to be reachable
// without login. The flow is now:
//
//   Welcome  ──"Check out Aura's Magic"──▶  GuestChat (Ask Pulse)
//   GuestChat ──"Sign in"──▶ Login (preserved in App.tsx, untouched)
//
// This screen is a CLONE of the visual layout of the login screen in App.tsx
// — it deliberately reproduces the orb, "Aura" title, and tagline so the
// branding feels continuous. The original login screen and all its sign-in
// functionality remain intact in App.tsx; nothing here authenticates anything.
// ─────────────────────────────────────────────────────────────────────────────

import { useTheme } from '../contexts/ThemeContext';
import { useConfig, LOGO_SIZES } from '../config';
import { useVideoBlob } from '../utils/useVideoBlob';
import LoopingVideo from './LoopingVideo';

interface Props {
  /** Tapping the primary CTA → reveals the GuestChat screen. */
  onContinue: () => void;
}

export default function WelcomeScreen({ onContinue }: Props) {
  const { theme, isRtl } = useTheme();
  const { branding } = useConfig();
  const orbSrc = theme === 'light' ? './orb-light.mp4' : './orb.mp4';
  const orbBlobSrc = useVideoBlob(orbSrc);

  return (
    <div className="flex flex-col h-full relative" style={{ background: theme === 'light' ? '#e8ebed' : '#000' }}>
      {/* Optional customer logo — pinned near the top when configured (admin →
       *  Branding). No logo → nothing renders, keeping the original view. */}
      {branding.logo && (
        <div className="flex justify-center flex-shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: 8 }}>
          <img
            src={branding.logo}
            alt={branding.appName}
            style={{ ...LOGO_SIZES[branding.logoSize === 'small' ? 'small' : 'medium'], objectFit: 'contain' }}
          />
        </div>
      )}
      {theme === 'light' && <div style={{ flex: 1, minHeight: 0 }} />}
      {/* Video — fills remaining space above the text/button block. Mirrors the
       * login-screen orb at full 320px height for consistent branding. */}
      <div
        className={theme === 'light' ? 'flex-shrink-0' : 'flex-1 min-h-0'}
        style={theme === 'light' ? { height: 320 } : undefined}
      >
        {theme === 'light' ? (
          <LoopingVideo
            src={orbSrc}
            style={{
              objectFit: 'cover',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
              maskImage:
                'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            }}
          />
        ) : (
          <video
            src={orbBlobSrc}
            key={orbBlobSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            // Same Low Power Mode autoplay-recovery pattern used on the login screen.
            ref={(el) => {
              if (!el) return;
              el.play().catch(() => {});
              if (el.readyState >= 2) el.style.opacity = '1';
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: 0,
              transition: 'opacity 0.3s ease',
            }}
            onCanPlay={(e) => {
              const v = e.target as HTMLVideoElement;
              v.style.opacity = '1';
              v.play().catch(() => {});
            }}
            onLoadedData={(e) => {
              (e.target as HTMLVideoElement).play().catch(() => {});
            }}
          />
        )}
      </div>

      {/* Small fixed gap below the orb. Was a flex-1 spacer, which created a
       * huge empty stretch between the orb and "Aura". A flex-1 BOTTOM spacer
       * (further down) now absorbs the residual space instead, which moves the
       * title+button block up close to the orb while preserving bottom margin. */}
      <div className="flex-shrink-0" style={{ height: 56 }} />

      {/* App title + CTA */}
      <div
        className="flex flex-col items-center px-6 gap-3 flex-shrink-0"
        style={{ paddingBottom: 8, paddingTop: 8 }}
      >
        {/* App name */}
        <div className="flex items-center gap-2 mb-1">
          <span
            style={{
              fontFamily: "'Poppins', Arial, sans-serif",
              fontWeight: 600,
              fontSize: 36,
              color: theme === 'light' ? '#182126' : '#ffffff',
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            {branding.appName}
          </span>
        </div>
        <p
          className="text-sm text-center"
          style={{
            color: 'rgba(var(--brand-primary-rgb),0.8)',
            fontFamily: "'Inter', Arial, sans-serif",
          }}
        >
          {branding.tagline}
        </p>

        {/* Primary CTA — sends users into the guest chat experience. */}
        <button
          onClick={onContinue}
          className="w-full py-3.5 rounded-2xl text-white text-[15px] flex items-center justify-center gap-2.5 active:scale-95 transition-transform"
          style={{
            fontFamily: "'Poppins', Arial, sans-serif",
            fontWeight: 600,
            background: 'var(--brand-primary)',
            boxShadow: '0 0 20px rgba(var(--brand-primary-rgb),0.3)',
            letterSpacing: -0.3,
          }}
        >
          Ask {branding.appName} Anything
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom flex spacer — smaller than the top spacer (0.5 vs 1) so the
       * title + button sit lower with a comfortable margin instead of a big
       * awkward gap below the button. */}
      {theme === 'light' && <div style={{ flex: 0.5, minHeight: 0 }} />}
    </div>
  );
}
