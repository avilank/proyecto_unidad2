import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': 'var(--color-bg-deep)',
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        ink: 'var(--color-ink)',
        'ink-soft': 'var(--color-ink-soft)',
        'ink-muted': 'var(--color-ink-muted)',
        'ink-muted-soft': 'var(--color-ink-muted-soft)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          2: 'var(--color-accent-2)',
          deep: 'var(--color-accent-deep)',
          soft: 'var(--color-accent-soft)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          soft: 'var(--color-border-soft)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
        },
        info: 'var(--color-info)',
        risk: {
          low: 'var(--color-risk-low)',
          medium: 'var(--color-risk-medium)',
          high: 'var(--color-risk-high)',
          critical: 'var(--color-risk-critical)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1220px',
      },
      keyframes: {
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-28px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'value-flash': {
          '0%': { backgroundColor: 'rgba(48, 156, 228, 0.35)', transform: 'scale(1.04)' },
          '100%': { backgroundColor: 'transparent', transform: 'scale(1)' },
        },
        'border-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(48, 156, 228, 0.4)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(48, 156, 228, 0.25)' },
        },
      },
      animation: {
        'slide-in-left': 'slide-in-left 0.45s ease-out both',
        'value-flash': 'value-flash 0.65s ease-out',
        'border-pulse': 'border-pulse 0.8s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
