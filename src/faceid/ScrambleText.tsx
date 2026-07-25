import { useEffect, useState } from "react";

/**
 * "Digital airport board / Matrix" text reveal: every character flickers through
 * random katakana glyphs and locks into the final letter left-to-right.
 * Half-width katakana keeps the width close to Latin so the line doesn't jitter.
 */
const GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";

const rnd = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

export function ScrambleText({
  text,
  className,
  speed = 0.4, // < 1 = slower
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const [out, setOut] = useState<{ ch: string; locked: boolean }[]>(
    () => text.split("").map((c) => ({ ch: c === " " ? " " : "", locked: false }))
  );

  useEffect(() => {
    const chars = text.split("");
    const lockAt = chars.map((_, i) => Math.round((10 + i * 4 + Math.random() * 8) / speed));
    const last = Math.max(...lockAt, 0);
    const cur = chars.map(() => rnd()); // current flicker glyph per position
    let frame = 0;
    let raf = 0;

    const tick = () => {
      // Re-randomize unlocked glyphs only every 3 frames → slower flicker.
      if (frame % 3 === 0) {
        for (let i = 0; i < chars.length; i++) {
          if (chars[i] !== " " && frame < lockAt[i]) cur[i] = rnd();
        }
      }
      setOut(
        chars.map((c, i) => {
          if (c === " ") return { ch: " ", locked: true };
          if (frame >= lockAt[i]) return { ch: c, locked: true };
          return { ch: cur[i], locked: false };
        })
      );
      frame += 1;
      if (frame <= last + 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, speed]);

  return (
    <span className={className} aria-label={text}>
      {out.map((o, i) => (
        <span key={i} className={o.locked ? "scr-locked" : "scr-flick"} aria-hidden>
          {o.ch}
        </span>
      ))}
    </span>
  );
}
