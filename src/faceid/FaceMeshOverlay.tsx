/**
 * Decorative face-mesh overlay (points + connecting lines) drawn on top of the
 * live camera during the pre-screen. Purely aesthetic — it does NOT track the
 * real face; it's a stylized constellation positioned over the centered face.
 */

// Normalized points in a 100 x 120 viewBox, roughly over a frontal face.
const P: [number, number][] = [
  [30, 38], [44, 36], [56, 36], [70, 38], // brows
  [32, 46], [44, 45], [56, 45], [68, 46], // eye corners
  [38, 46], [62, 46], // pupils
  [50, 30], // forehead
  [50, 44], [50, 52], [50, 62], [44, 64], [56, 64], // nose
  [26, 48], [74, 48], // temples
  [28, 60], [72, 60], // cheeks
  [40, 76], [60, 76], [50, 73], [50, 80], // mouth
  [34, 82], [66, 82], // jaw upper
  [40, 92], [60, 92], [50, 100], // jaw lower + chin
];

const L: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [3, 7], [1, 5], [2, 6], [10, 1], [10, 2],
  [4, 8], [8, 5], [6, 9], [9, 7], [4, 16], [7, 17], [10, 11],
  [11, 12], [12, 13], [12, 14], [13, 14], [11, 13], [11, 14], [11, 5], [11, 6],
  [16, 18], [17, 19], [18, 14], [19, 15], [18, 24], [19, 25], [18, 4], [19, 7],
  [13, 20], [14, 21], [20, 22], [21, 22], [20, 24], [21, 25], [22, 23],
  [24, 26], [25, 27], [26, 28], [27, 28], [20, 26], [21, 27], [22, 28],
  [10, 0], [10, 3],
];

export function FaceMeshOverlay() {
  return (
    <svg className="face-mesh" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g className="fm-lines">
        {L.map(([a, b], i) => (
          <line
            key={i}
            x1={P[a][0]}
            y1={P[a][1]}
            x2={P[b][0]}
            y2={P[b][1]}
            style={{ animationDelay: `${(i % 12) * 0.13}s` }}
          />
        ))}
      </g>
      <g className="fm-dots">
        {P.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.2} style={{ animationDelay: `${(i % 10) * 0.12}s` }} />
        ))}
      </g>
    </svg>
  );
}
