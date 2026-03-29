import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1a1f37',
          900: '#111427',
          950: '#0b0e1a',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
