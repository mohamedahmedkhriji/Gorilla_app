
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'background-secondary': 'rgb(var(--color-background-secondary) / <alpha-value>)',
        'section-background': 'rgb(var(--color-section-background) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-dark': 'rgb(var(--color-accent-dark) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft-bg) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        purple: 'rgb(var(--color-purple) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', '"Impact"', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 16px rgb(var(--color-accent) / 0.18)',
        card: '0 8px 22px rgb(7 12 24 / 0.14)',
        inset: 'inset 0 1px 0 rgb(255 255 255 / 0.05)',
      }
    },
  },
  plugins: [],
}
