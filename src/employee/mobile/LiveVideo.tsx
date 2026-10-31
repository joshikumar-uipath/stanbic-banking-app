// A looping, muted film that plays only while it is on screen — and not at all
// when the phone asks for reduced motion (it shows its first frame instead).
//
// The phone mounts many short films (the orb, the Recently active strip,
// Explore), and screens stay mounted behind the tab bar. Without this every one
// of them decodes at once, which low-end phones can't keep up with.
import { useEffect, useRef, type CSSProperties } from 'react';
import VideoEl from '../../components/VideoEl';

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function LiveVideo({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduced()) { v.pause(); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.15 });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return (
    <VideoEl ref={ref} src={src} className={className} style={style}
      muted loop playsInline preload="metadata" aria-hidden data-managed="" />
  );
}
