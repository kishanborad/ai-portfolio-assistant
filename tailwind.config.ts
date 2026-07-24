import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#050816',
          deep: '#0a0a1a',
        },
        accent: {
          DEFAULT: '#818cf8',
          dim: '#6366f1',
          dark: '#4f46e5',
        },
        muted: '#aaa6c3',
        dimmed: '#64648a',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(99, 102, 241, 0.15)',
        'glow-strong': '0 0 30px rgba(99, 102, 241, 0.3)',
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
