/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Scout-themed colors matching existing CSS variables
        'scout-red': {
          DEFAULT: '#ed3f23',
          light: '#f16749',
          dark: '#c4321d',
        },
        'scout-blue': {
          DEFAULT: '#006ddf',
          light: '#3387e5',
          dark: '#004fb3',
        },
        'scout-blue-dark': {
          DEFAULT: '#004fb3',
          light: '#006ddf',
          dark: '#003f8f',
        },
        'scout-orange': {
          DEFAULT: '#ff912a',
          light: '#ffad5a',
          dark: '#e67e1f',
        },
        'scout-green': {
          DEFAULT: '#25b755',
          light: '#4fc470',
          dark: '#1e9544',
        },
        'scout-pink': {
          DEFAULT: '#ffb4e5',
          light: '#ffcbec',
          dark: '#e591c9',
        },
        'scout-yellow': {
          DEFAULT: '#ffe627',
          light: '#ffef5a',
          dark: '#e6c61f',
        },
        'scout-forest-green': {
          DEFAULT: '#205b41',
          light: '#3d7863',
          dark: '#1a4a35',
        },
        'scout-purple': {
          DEFAULT: '#7413dc',
          light: '#8f47e3',
          dark: '#5e0fb5',
        },
        'scout-teal': {
          DEFAULT: '#088486',
          light: '#2da5a7',
          dark: '#066769',
        },
        'scout-navy': {
          DEFAULT: '#003f8f',
          light: '#004fb3',
          dark: '#002f6f',
        },
        // Standard design system colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#006ddf',  // Using scout-blue as primary
          600: '#004fb3',
          700: '#003f8f',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        success: '#25b755',  // Using scout-green
        warning: '#ff912a',  // Using scout-orange
        error: '#ed3f23',    // Using scout-red
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'soft': '0 2px 15px 0 rgba(0, 0, 0, 0.1)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}