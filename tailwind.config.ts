import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        // Theme-driven tokens: values come from CSS variables in index.css,
        // one set for day (warm paper) and one for night (charcoal amber).
        // The navy/deep names are legacy; they now follow the active theme.
        navy: {
          DEFAULT: 'rgb(var(--theme-bg) / <alpha-value>)',
          deep: 'rgb(var(--theme-surface) / <alpha-value>)',
        },
        surface: 'rgb(var(--theme-surface) / <alpha-value>)',
        line: 'rgb(var(--theme-border) / <alpha-value>)',
        ink: 'rgb(var(--theme-text) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--theme-accent) / <alpha-value>)',
          dim: 'rgb(var(--theme-accent-deep) / <alpha-value>)',
          dark: 'rgb(var(--theme-accent-deep) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--theme-on-accent) / <alpha-value>)',
        muted: 'rgb(var(--theme-muted) / <alpha-value>)',
        dimmed: 'rgb(var(--theme-dimmed) / <alpha-value>)',
        status: 'rgb(var(--theme-status) / <alpha-value>)',
        chip: 'rgb(var(--theme-chip) / <alpha-value>)',
      },
      boxShadow: {
        glass: '0 8px 32px rgb(var(--theme-text) / 0.12)',
        glow: '0 0 20px rgb(var(--theme-accent) / 0.15)',
        'glow-strong': '0 0 30px rgb(var(--theme-accent) / 0.3)',
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
