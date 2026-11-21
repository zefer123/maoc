/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#07090e',
        gold: '#f6c94d',
        neon: {
          cyan: '#22d3ee',
          purple: '#a855f7',
          green: '#34d399',
          red: '#f87171',
          blue: '#60a5fa',
          amber: '#fbbf24'
        }
      },
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace'
        ]
      },
      boxShadow: {
        'glow-gold': '0 0 24px rgba(246,201,77,0.28)',
        'glow-purple': '0 0 24px rgba(168,85,247,0.28)',
        'glow-cyan': '0 0 24px rgba(34,211,238,0.28)',
        'glow-green': '0 0 24px rgba(52,211,153,0.28)',
        'glow-red': '0 0 24px rgba(248,113,113,0.28)'
      },
      animation: {
        'pulse-fast': 'pulse 1.1s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: []
};