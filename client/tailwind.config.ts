import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans',        'system-ui', 'sans-serif'],
        serif: ['Fraunces',       'Georgia',   'serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg:       'var(--fg-bg)',
        surface:  'var(--fg-surface)',
        elevated: 'var(--fg-elevated)',
        border: {
          DEFAULT: 'var(--fg-border)',
          strong:  'var(--fg-border-2)',
        },
        t1:    'var(--fg-t1)',
        t2:    'var(--fg-t2)',
        t3:    'var(--fg-t3)',
        t4:    'var(--fg-t4)',
        amber: {
          DEFAULT: 'var(--fg-amber)',
          bg:      'var(--fg-amber-bg)',
          border:  'var(--fg-amber-bdr)',
        },
        jade: {
          DEFAULT: 'var(--fg-jade)',
          bg:      'var(--fg-jade-bg)',
          border:  'var(--fg-jade-bdr)',
        },
        rust: {
          DEFAULT: 'var(--fg-rust)',
          bg:      'var(--fg-rust-bg)',
          border:  'var(--fg-rust-bdr)',
        },
        slate: {
          DEFAULT: 'var(--fg-slate)',
          bg:      'var(--fg-slate-bg)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
