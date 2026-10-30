/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#0b1f3a', 900: '#12294b', 800: '#1b3a66', 700: '#27508a', 100: '#e3e9f3' },
        surface: '#f4f6fa',
        gain: '#12805c',
        loss: '#c4302b',
        warn: '#d97706',
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
