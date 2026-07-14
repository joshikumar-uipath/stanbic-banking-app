import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useVideoBlob } from '../utils/useVideoBlob';

interface Props {
  src: string;
  style?: CSSProperties;
  className?: string;
  containerStyle?: CSSProperties;
  containerClassName?: string;
  crossfadeMs?: number;
}

/**
 * Renders a looping video that crossfades into a second copy of itself near
 * the end of each loop, hiding the hard-cut discontinuity that the browser's
 * native `loop` attribute produces on content not designed to loop seamlessly.
 */
export default function LoopingVideo({
  src,
  style,
  className,
  containerStyle,
  containerClassName,
  crossfadeMs = 600,
}: Props) {
  const blobSrc = useVideoBlob(src);
  const videoA = useRef<HTMLVideoElement | null>(null);
  const videoB = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState<'a' | 'b'>('a');
  const switchedRef = useRef(false);
  const [opacityLoaded, setOpacityLoaded] = useState(false);

  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return;
    let raf = 0;
    const crossfadeSec = crossfadeMs / 1000;
    const tick = () => {
      const current = active === 'a' ? a : b;
      const other = active === 'a' ? b : a;
      const dur = current.duration;
      if (dur && dur - current.currentTime <= crossfadeSec && !switchedRef.current) {
        switchedRef.current = true;
        other.currentTime = 0;
        other.play().catch(() => {});
        setActive(active === 'a' ? 'b' : 'a');
        window.setTimeout(() => { switchedRef.current = false; }, crossfadeMs + 50);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, crossfadeMs]);

  // iOS Low Power Mode denies unattended video.play(). On the first user gesture
  // anywhere in the document, retry playing the currently-active video — gestures
  // unconditionally satisfy the user-activation requirement.
  useEffect(() => {
    const tryPlay = () => {
      const target = active === 'a' ? videoA.current : videoB.current;
      target?.play().catch(() => {});
    };
    document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
    document.addEventListener('click', tryPlay, { once: true });
    return () => {
      document.removeEventListener('touchstart', tryPlay);
      document.removeEventListener('click', tryPlay);
    };
  }, [active]);

  const baseStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transition: `opacity ${crossfadeMs}ms ease`,
    opacity: opacityLoaded ? 1 : 0,
    ...style,
  };

  return (
    <div className={containerClassName} style={{ position: 'relative', width: '100%', height: '100%', ...containerStyle }}>
      <video
        ref={videoA}
        src={blobSrc}
        autoPlay muted playsInline preload="auto"
        className={className}
        style={{ ...baseStyle, opacity: opacityLoaded ? (active === 'a' ? 1 : 0) : 0 }}
        onCanPlay={(e) => {
          setOpacityLoaded(true);
          (e.target as HTMLVideoElement).play().catch(() => {});
        }}
        onLoadedData={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
      />
      <video
        ref={videoB}
        src={blobSrc}
        muted playsInline preload="auto"
        className={className}
        style={{ ...baseStyle, opacity: opacityLoaded ? (active === 'b' ? 1 : 0) : 0 }}
      />
    </div>
  );
}
