/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#070b14',
        panel: '#0d1422',
        surface: '#111c2e',
        elevated: '#162236',
        border: '#1a2a40',
        'border-bright': '#274060',
        cyan: {
          DEFAULT: '#00d4ff',
          dim: '#0096b3',
          glow: '#00d4ff33',
        },
        green: {
          op: '#00e676',
          'op-dim': '#00a854',
        },
        amber: {
          op: '#ffab00',
        },
        red: {
          op: '#ff4757',
        },
        text: {
          primary: '#e2eaf4',
          secondary: '#8896a8',
          muted: '#3d5068',
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
