// A looping, muted film that plays only while it is on screen — and not at all
// when the phone asks for reduced motion (it shows its first frame instead).
//
// The phone mounts many short films (the orb, the Recently active strip,
// Explore), and screens stay mounted behind the tab bar. Without this every one
// of them decodes at once, which low-end phones can't keep up with.
//
// Two WebKit lessons baked in here (TestFlight build 3 shipped a blank orb):
//   - VideoEl swaps the src to a cached blob URL after mount. A src change
//     reloads the media element and leaves it PAUSED; the intersection observer
//     has already fired and won't fire again, so nothing restarted playback.
//     `autoPlay` plus a play() on every `loadeddata` covers every reload.
//   - iOS paints nothing for a paused video that has only metadata. Preload the
//     data and, when motion is reduced, seek a hair past zero to show a frame.
import { useEffect, useRef, type CSSProperties } from 'react';
import VideoEl from '../../components/VideoEl';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function LiveVideo({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  const onScreen = useRef(true);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = reduced();
    // React sets `muted` as a property only; WebKit's autoplay policy wants the attribute too.
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    const show = () => {
      if (still) { v.pause(); try { if (v.currentTime === 0) v.currentTime = 0.01; } catch { /* not seekable yet */ } return; }
      if (onScreen.current) void v.play().catch(() => {});
    };
    v.addEventListener('loadedmetadata', show);
    v.addEventListener('loadeddata', show);
    if (v.readyState >= 1) show();
    const io = new IntersectionObserver(([e]) => {
      onScreen.current = e.isIntersecting;
      if (still) return;
      if (e.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.15 });
    io.observe(v);
    return () => { io.disconnect(); v.removeEventListener('loadedmetadata', show); v.removeEventListener('loadeddata', show); };
  }, [src]);
  return (
    <VideoEl ref={ref} src={src} className={className} style={style}
      autoPlay={!reduced()} muted loop playsInline preload="auto" aria-hidden data-managed="" />
  );
}
