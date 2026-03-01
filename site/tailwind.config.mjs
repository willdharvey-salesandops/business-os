/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#115e59',
          hover: '#0d4a46',
          light: '#f3f3f1',
          bright: '#2dd4bf',
          glow: 'rgba(45, 212, 191, 0.12)',
        },
        ink: '#111111',
        bg: '#fafaf9',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
