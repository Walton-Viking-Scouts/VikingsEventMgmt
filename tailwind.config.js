/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Dynamic scout color patterns used in SectionFilter.jsx
    { pattern: /^text-scout-/ },
    { pattern: /^border-scout-/ },
    { pattern: /^bg-scout-/ },
  ],
  theme: {
    extend: {
      colors: {
        'scout-blue': '#006ddf',
        'scout-blue-dark': '#004fb3',
        'scout-red': '#ed3f23',
        'scout-orange': '#ff912a',
        'scout-green': '#25b755',
        'scout-pink': '#ffb4e5',
        'scout-yellow': '#ffe627',
        'scout-forest-green': '#205b41',
        'scout-navy': '#1e3a8a',
        'scout-purple': '#7c3aed',
        'scout-teal': '#0d9488',
        'blue': {
          25: '#f0f8ff',
        },
        'red': {
          25: '#fef2f2',
        },
        'orange': {
          25: '#fff7ed',
        },
        'green': {
          25: '#f0fdf4',
        },
      },
      maxWidth: {
        '32': '8rem',
      },
    },
  },
  plugins: [],
};