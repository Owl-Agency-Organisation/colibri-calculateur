import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9f8',
          100: '#e8f7f6',
          200: '#d2f0ee',
          500: '#007c7a',
          600: '#1e3a34', // Vert foncé premium de la landing
          700: '#152925',
        },
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        background: '#f9fbfb', // Fond de la landing
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;