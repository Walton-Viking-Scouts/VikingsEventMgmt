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
        // Official Scout brand colors (2023) - Complete variants
        'scout-blue': '#006ddf',
        'scout-blue-light': '#3387e5',
        'scout-blue-dark': '#004fb3',
        
        'scout-red': '#ed3f23',
        'scout-red-light': '#f16749',
        'scout-red-dark': '#c4321d',
        
        'scout-orange': '#ff912a',
        'scout-orange-light': '#ffad5a',
        'scout-orange-dark': '#e67e1f',
        
        'scout-green': '#25b755',
        'scout-green-light': '#4fc470',
        'scout-green-dark': '#1e9544',
        
        'scout-pink': '#ffb4e5',
        'scout-pink-light': '#ffcbec',
        'scout-pink-dark': '#e591c9',
        
        'scout-yellow': '#ffe627',
        'scout-yellow-light': '#ffef5a',
        'scout-yellow-dark': '#e6c61f',
        
        'scout-forest-green': '#205b41',
        'scout-forest-green-light': '#3d7863',
        'scout-forest-green-dark': '#1a4a35',
        
        'scout-navy': '#003982',
        'scout-navy-light': '#004fb3',
        'scout-navy-dark': '#002f6f',
        
        // Non-official Scout colors (compatibility)
        'scout-purple': '#7413dc',
        'scout-purple-light': '#8f47e3',
        'scout-purple-dark': '#5e0fb5',
        
        'scout-teal': '#088486',
        'scout-teal-light': '#2da5a7',
        'scout-teal-dark': '#066769',
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