/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        emerald: {
          300: '#34d399',
          400: '#10b981',
          700: '#047857',
          800: '#065f46'
        }
      }
    }
  },
  plugins: []
};