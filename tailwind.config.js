/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'rgb(13 13 14)',
          panel: 'rgb(23 23 23)',
          inset: 'rgb(28 28 30)',
          hover: 'rgb(38 38 40)',
          active: 'rgb(48 48 50)',
        },
        fg: {
          default: 'rgb(237 237 240)',
          muted: 'rgb(161 161 170)',
          subtle: 'rgb(113 113 122)',
          faint: 'rgb(82 82 91)',
        },
        line: {
          DEFAULT: 'rgb(38 38 42)',
          strong: 'rgb(58 58 62)',
        },
        accent: {
          DEFAULT: 'rgb(59 130 246)',
          hover: 'rgb(96 165 250)',
          muted: 'rgb(30 58 138)',
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
