/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101822',
        mist: '#e8f1f5',
        ember: '#ff6a3d',
        aqua: '#0fa3b1',
        sand: '#f2efe9',
      },
      boxShadow: {
        float: '0 24px 60px -28px rgba(9, 30, 66, 0.45)',
      },
    },
  },
  plugins: [],
};
