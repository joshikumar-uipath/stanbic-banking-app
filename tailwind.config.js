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
