/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        purple: {
          100: '#EDE9FE',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
        },
        blue: {
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        green: {
          400: '#4ADE80',
          500: '#22C55E',
        },
      },
    },
  },
  plugins: [],
};