/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1E3A8A',
          dark: '#152a63',
          light: '#3B82F6',
        },
        accent: '#F59E0B',
      },
    },
  },
  plugins: [],
};
