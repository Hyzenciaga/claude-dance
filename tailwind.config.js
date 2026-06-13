/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#fbfbfa',          // main canvas
          panel: '#f3f3f1',         // sidebar
          inset: '#ffffff',         // input/card surfaces
          hover: 'rgba(0,0,0,0.04)',
          active: 'rgba(0,0,0,0.07)',
        },
        fg: {
          default: '#1f1f1e',
          muted: '#5d5d5b',
          subtle: '#8a8a87',
          faint: '#b3b3af',
        },
        line: {
          DEFAULT: 'rgba(0,0,0,0.08)',
          strong: 'rgba(0,0,0,0.14)',
        },
        accent: {
          DEFAULT: '#c2410c',       // warm orange — Anthropic-ish, distinctive on light
          hover: '#9a3412',
          muted: '#fed7aa',
          subtle: '#fff7ed',
        },
        bubble: {
          user: '#1f1f1e',          // dark bubble for user (high contrast)
          'user-fg': '#fbfbfa',
          assistant: '#ffffff',     // light card for assistant
          'assistant-border': 'rgba(0,0,0,0.08)',
        },
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
