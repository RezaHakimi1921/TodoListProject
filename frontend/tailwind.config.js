/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#12110e',
          900: '#1b1914',
          800: '#26231c',
          700: '#353128',
        },
        paper: '#f4efe4',
        ember: '#d97706',
        moss: '#3f6f5b',
      },
    },
  },
  plugins: [],
}
