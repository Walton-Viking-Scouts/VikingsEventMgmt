/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    { pattern: /^text-scout-/ },
    { pattern: /^border-scout-/ },
    { pattern: /^bg-scout-/ },
  ],
  plugins: [],
};
