/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a25',
          600: '#222230',
          500: '#2a2a3a',
        },
        accent: {
          green: '#22c55e',
          yellow: '#eab308',
          orange: '#f97316',
          red: '#ef4444',
          blue: '#3b82f6',
          purple: '#a855f7',
          teal: '#14b8a6',
          pink: '#ec4899',
        },
      },
    },
  },
  plugins: [],
}
