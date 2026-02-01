/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Catppuccin colors using CSS variables (auto-switches between dark/light)
        // Format supports Tailwind opacity modifiers like bg-ctp-base/80
        ctp: {
          rosewater: 'rgb(var(--color-rosewater) / <alpha-value>)',
          flamingo: 'rgb(var(--color-flamingo) / <alpha-value>)',
          pink: 'rgb(var(--color-pink) / <alpha-value>)',
          mauve: 'rgb(var(--color-mauve) / <alpha-value>)',
          red: 'rgb(var(--color-red) / <alpha-value>)',
          maroon: 'rgb(var(--color-maroon) / <alpha-value>)',
          peach: 'rgb(var(--color-peach) / <alpha-value>)',
          yellow: 'rgb(var(--color-yellow) / <alpha-value>)',
          green: 'rgb(var(--color-green) / <alpha-value>)',
          teal: 'rgb(var(--color-teal) / <alpha-value>)',
          sky: 'rgb(var(--color-sky) / <alpha-value>)',
          sapphire: 'rgb(var(--color-sapphire) / <alpha-value>)',
          blue: 'rgb(var(--color-blue) / <alpha-value>)',
          lavender: 'rgb(var(--color-lavender) / <alpha-value>)',
          text: 'rgb(var(--color-text) / <alpha-value>)',
          subtext1: 'rgb(var(--color-subtext1) / <alpha-value>)',
          subtext0: 'rgb(var(--color-subtext0) / <alpha-value>)',
          overlay2: 'rgb(var(--color-overlay2) / <alpha-value>)',
          overlay1: 'rgb(var(--color-overlay1) / <alpha-value>)',
          overlay0: 'rgb(var(--color-overlay0) / <alpha-value>)',
          surface2: 'rgb(var(--color-surface2) / <alpha-value>)',
          surface1: 'rgb(var(--color-surface1) / <alpha-value>)',
          surface0: 'rgb(var(--color-surface0) / <alpha-value>)',
          base: 'rgb(var(--color-base) / <alpha-value>)',
          mantle: 'rgb(var(--color-mantle) / <alpha-value>)',
          crust: 'rgb(var(--color-crust) / <alpha-value>)',
        },
      },
      borderRadius: {
        xl: '1rem', // 16px
        '2xl': '1.25rem', // 20px
        '3xl': '1.5rem', // 24px
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'soft-md': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'soft-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
