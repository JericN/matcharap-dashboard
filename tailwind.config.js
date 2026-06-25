/** @type {import('tailwindcss').Config} */

// Colours are driven by CSS variables (RGB channel triplets) defined in
// src/app/globals.css :root. To reskin the whole site, edit that one block —
// every Tailwind utility, @apply rule, and component reads from these tokens.
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: c('--c-cream'), light: c('--c-cream-light'), card: c('--c-cream-card'), deep: c('--c-cream-deep') },
        kraft: c('--c-kraft'),
        forest: c('--c-forest'),
        olive: { DEFAULT: c('--c-olive'), soft: c('--c-olive-soft') },
        brown: { DEFAULT: c('--c-brown'), soft: c('--c-brown-soft') },
        matcha: { DEFAULT: c('--c-matcha'), bright: c('--c-matcha-bright'), fill: c('--c-matcha-fill') },
        clay: c('--c-clay'),
        star: c('--c-star'),
        onforest: { mut: c('--c-onforest-mut'), soft: c('--c-onforest-soft') },
        cat: { ph: c('--c-cat-ph'), jp: c('--c-cat-jp'), import: c('--c-cat-import') },
      },
      borderColor: {
        ink: 'rgb(var(--c-forest) / 0.30)',
      },
      fontFamily: {
        display: ['Caveat', 'Comic Sans MS', 'cursive'],
        doodle: ['"Shantell Sans"', 'Comic Sans MS', 'cursive'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
        body: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px 14px 20px 13px',
        soft: '14px 11px 15px 10px',
        cell: '11px 8px 12px 9px',
        pill: '20px',
      },
      boxShadow: {
        hard: '6px 7px 0 rgb(var(--c-forest) / 0.16)',
        'hard-sm': '3px 4px 0 rgb(var(--c-forest) / 0.16)',
        'hard-brown': '6px 7px 0 rgb(var(--c-brown) / 0.18)',
      },
    },
  },
  plugins: [],
};
