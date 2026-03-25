/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables easy toggle for dark mode
  theme: {
    extend: {
      colors: {
        crmDark:   '#0f172a',  // Slate 900
        crmCard:   '#1e293b',  // Slate 800
        crmAccent: '#7984EE',  // Shinso 400
        crmHover:  '#5560d4',  // Shinso 600
        shinso: {
          50:  '#f0f1fd',
          100: '#e0e3fb',
          200: '#c1c7f7',
          400: '#7984EE',
          600: '#5560d4',
          800: '#3a42a8',
          900: '#252a7c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
