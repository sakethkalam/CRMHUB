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
        crmDark: '#0f172a',  // Slate 900
        crmCard: '#1e293b',  // Slate 800
        crmAccent: '#3b82f6', // Blue 500
        crmHover: '#2563eb'   // Blue 600
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
