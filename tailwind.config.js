/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // UiPath brand typefaces
        poppins: ['Poppins', 'Arial', 'sans-serif'],
        inter:   ['Inter', 'Arial', 'sans-serif'],
      },
      colors: {
        // Slate resolves to CSS variables rather than fixed hexes, so a subtree
        // can re-theme it — the architecture relays run under
        // [data-relay-theme='light'] (see index.css). :root holds Tailwind's own
        // stock values, so every other slate use renders exactly as before. The
        // <alpha-value> form keeps bg-slate-900/40 etc. working.
        slate: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
            .map((n) => [n, `rgb(var(--c-slate-${n}) / <alpha-value>)`]),
        ),
        // UiPath primary palette
        'uip-orange':       '#FA4616',
        'uip-teal':         '#0BA2B3',
        'uip-deep-blue':    '#182126',
        'uip-white':        '#FFFFFF',
        // UiPath secondary palette
        'uip-dark-blue':    '#1E6482',
        'uip-offset-orange':'#A32200',
        'uip-bright-blue':  '#CCF2FF',
        'uip-black':        '#000000',
        'uip-offset-grey':  '#D9D9D9',
      },
    },
  },
  plugins: [],
}
