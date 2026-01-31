import { flavors } from '@catppuccin/palette';

// Extract colors from Catppuccin palette
const mocha = flavors.mocha.colors;
const latte = flavors.latte.colors;

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
        // Catppuccin Mocha (dark theme - default)
        ctp: {
          rosewater: mocha.rosewater.hex,
          flamingo: mocha.flamingo.hex,
          pink: mocha.pink.hex,
          mauve: mocha.mauve.hex,
          red: mocha.red.hex,
          maroon: mocha.maroon.hex,
          peach: mocha.peach.hex,
          yellow: mocha.yellow.hex,
          green: mocha.green.hex,
          teal: mocha.teal.hex,
          sky: mocha.sky.hex,
          sapphire: mocha.sapphire.hex,
          blue: mocha.blue.hex,
          lavender: mocha.lavender.hex,
          text: mocha.text.hex,
          subtext1: mocha.subtext1.hex,
          subtext0: mocha.subtext0.hex,
          overlay2: mocha.overlay2.hex,
          overlay1: mocha.overlay1.hex,
          overlay0: mocha.overlay0.hex,
          surface2: mocha.surface2.hex,
          surface1: mocha.surface1.hex,
          surface0: mocha.surface0.hex,
          base: mocha.base.hex,
          mantle: mocha.mantle.hex,
          crust: mocha.crust.hex,
        },
        // Catppuccin Latte (light theme)
        'ctp-latte': {
          rosewater: latte.rosewater.hex,
          flamingo: latte.flamingo.hex,
          pink: latte.pink.hex,
          mauve: latte.mauve.hex,
          red: latte.red.hex,
          maroon: latte.maroon.hex,
          peach: latte.peach.hex,
          yellow: latte.yellow.hex,
          green: latte.green.hex,
          teal: latte.teal.hex,
          sky: latte.sky.hex,
          sapphire: latte.sapphire.hex,
          blue: latte.blue.hex,
          lavender: latte.lavender.hex,
          text: latte.text.hex,
          subtext1: latte.subtext1.hex,
          subtext0: latte.subtext0.hex,
          overlay2: latte.overlay2.hex,
          overlay1: latte.overlay1.hex,
          overlay0: latte.overlay0.hex,
          surface2: latte.surface2.hex,
          surface1: latte.surface1.hex,
          surface0: latte.surface0.hex,
          base: latte.base.hex,
          mantle: latte.mantle.hex,
          crust: latte.crust.hex,
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
