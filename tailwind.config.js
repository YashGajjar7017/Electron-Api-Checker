module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        navy: '#0b1320',
        midnight: '#0f172a',
        cosmic: '#1f2937',
        violet: '#7c3aed',
        aurora: '#a78bfa',
      },
      boxShadow: {
        glow: '0 15px 40px rgba(124, 58, 237, 0.18)',
      },
    },
  },
  plugins: [],
};
