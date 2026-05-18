import type { Config } from 'tailwindcss';

/**
 * Design system do back-office: foco em densidade e legibilidade.
 * Paleta zinc/stone (cinzas neutros) + accent azul discreto.
 * NÃO usar glass/blur/gradiente como no app — fica visualmente cansativo
 * em telas com muitas linhas de dados.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0b',
          surface: '#111113',
          elevated: '#18181b',
          subtle: '#27272a',
        },
        border: { DEFAULT: '#27272a', strong: '#3f3f46' },
        fg: {
          DEFAULT: '#fafafa',
          dim: '#a1a1aa',
          subtle: '#71717a',
        },
        accent: { DEFAULT: '#3b82f6', strong: '#2563eb' },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.55' }],
        lg: ['16px', { lineHeight: '1.4' }],
        xl: ['20px', { lineHeight: '1.3' }],
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
