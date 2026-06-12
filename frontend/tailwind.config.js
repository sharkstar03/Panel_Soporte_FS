/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--c-base) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        'border-bright': 'rgb(var(--c-border-bright) / <alpha-value>)',
        cyan: {
          DEFAULT: 'rgb(var(--c-cyan) / <alpha-value>)',
          dim: 'rgb(var(--c-cyan-dim) / <alpha-value>)',
          glow: '#00d4ff33',
        },
        green: {
          op: 'rgb(var(--c-green) / <alpha-value>)',
          'op-dim': 'rgb(var(--c-green-dim) / <alpha-value>)',
        },
        amber: {
          op: 'rgb(var(--c-amber) / <alpha-value>)',
        },
        red: {
          op: 'rgb(var(--c-red) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--c-text) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-2) / <alpha-value>)',
          muted: 'rgb(var(--c-text-3) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Oxanium', 'monospace'],
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 20px rgba(0,212,255,0.15)',
        'cyan-glow-lg': '0 0 40px rgba(0,212,255,0.25)',
        'green-glow': '0 0 20px rgba(0,230,118,0.15)',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan': 'scan 4s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
