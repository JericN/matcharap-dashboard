/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#efe7d3', light: '#f3ecdb', card: '#f7f1e3', deep: '#e9e0c9' },
        kraft: '#e3d4b0',
        forest: '#3f5031',
        olive: { DEFAULT: '#56683f', soft: '#6f7f54' },
        brown: { DEFAULT: '#6b4f2f', soft: '#8a6c45' },
        matcha: { DEFAULT: '#8aa15a', bright: '#a7c06a', fill: '#a9c08a' },
        clay: '#b9542d',
        blush: '#d98a63',
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
        hard: '6px 7px 0 rgba(63,80,49,.16)',
        'hard-sm': '3px 4px 0 rgba(63,80,49,.16)',
        'hard-brown': '6px 7px 0 rgba(107,79,47,.18)',
      },
      borderColor: {
        ink: 'rgba(63,80,49,.30)',
      },
    },
  },
  plugins: [],
};
