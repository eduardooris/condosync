import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'ds-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'ds-slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'ds-scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'ds-bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'ds-fade-in': 'ds-fade-in 0.45s ease-out both',
        'ds-slide-up': 'ds-slide-up 0.42s cubic-bezier(0.25, 0.1, 0.25, 1) both',
        'ds-scale-in': 'ds-scale-in 0.32s cubic-bezier(0.25, 0.1, 0.25, 1) both',
        'ds-bounce-soft': 'ds-bounce-soft 1.8s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Code', 'Source Code Pro', 'Menlo', 'monospace'],
      },
      fontSize: {
        'ds-xs': ['var(--ds-font-size-xs)', { lineHeight: '1.45' }],
        'ds-sm': ['var(--ds-font-size-sm)', { lineHeight: '1.5' }],
        'ds-md': ['var(--ds-font-size-md)', { lineHeight: '1.55' }],
        'ds-lg': ['var(--ds-font-size-lg)', { lineHeight: '1.4' }],
        'ds-xl': ['var(--ds-font-size-xl)', { lineHeight: '1.3' }],
        'ds-2xl': ['var(--ds-font-size-2xl)', { lineHeight: '1.2' }],
        'ds-display': ['var(--ds-font-size-display)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        'ds-sm': 'var(--ds-radius-sm)',
        'ds-md': 'var(--ds-radius-md)',
        'ds-lg': 'var(--ds-radius-lg)',
        'ds-xl': 'var(--ds-radius-xl)',
        'ds-2xl': 'var(--ds-radius-2xl)',
        'ds-3xl': 'var(--ds-radius-3xl)',
        'ds-pill': 'var(--ds-radius-pill)',
      },
      boxShadow: {
        'ds-sm': 'var(--ds-shadow-sm)',
        'ds-md': 'var(--ds-shadow-md)',
        'ds-elev': 'var(--ds-shadow-elev)',
        'ds-card': 'var(--ds-shadow-card)',
        'ds-glow': 'var(--ds-shadow-glow)',
      },
      screens: {
        'ds-sm': '480px',
        'ds-md': '768px',
        'ds-lg': '1024px',
        'ds-xl': '1280px',
      },
      colors: {
        brand: {
          50: '#eef3ff',
          100: '#dbe6ff',
          200: '#b3c8ff',
          300: '#7fa3fa',
          400: '#5582f5',
          500: '#4f7df0',
          600: '#3a63d4',
          700: '#2a4aa3',
          800: '#1d3471',
          900: '#0f1f4a',
        },
        status: {
          pending: '#f0b840',
          paid: '#2ec886',
          overdue: '#f05050',
          exempt: '#7a7a8a',
        },
        ds: {
          canvas: 'var(--ds-color-bg-default)',
          deep: 'var(--ds-color-bg-deep)',
          surface: 'var(--ds-color-bg-surface)',
          elevated: 'var(--ds-color-bg-elevated)',
          overlay: 'var(--ds-color-bg-overlay)',
          body: 'var(--ds-color-text-primary)',
          dim: 'var(--ds-color-text-secondary)',
          subtle: 'var(--ds-color-text-muted)',
          inverse: 'var(--ds-color-text-inverse)',
          stroke: 'var(--ds-color-border-default)',
          'stroke-subtle': 'var(--ds-color-border-subtle)',
          'stroke-strong': 'var(--ds-color-border-strong)',
          action: 'var(--ds-color-action-primary)',
          'action-h': 'var(--ds-color-action-primary-hover)',
          'on-primary': 'var(--ds-color-on-primary)',
          success: 'var(--ds-color-feedback-success)',
          warning: 'var(--ds-color-feedback-warning)',
          danger: 'var(--ds-color-feedback-danger)',
          info: 'var(--ds-color-feedback-info)',
          focus: 'var(--ds-color-focus-ring)',
        },
      },
    },
  },
  plugins: [animate],
} satisfies Config;
