/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'scout-blue': '#003f7f',
        'scout-blue-dark': '#002a5c',
        'scout-forest-green': '#228b22',
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