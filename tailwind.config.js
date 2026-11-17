const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        card: v('card'),
        card2: v('card2'),
        label: v('label'),
        secondary: v('secondary'),
        tertiary: v('tertiary'),
        sep: v('sep'),
        fill: v('fill'),
        accent: v('accent'),
        ok: v('ok'),
        warn: v('warn'),
        danger: v('danger'),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '20px' },
      fontSize: {
        large: ['34px', { lineHeight: '41px', letterSpacing: '0.01em', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
