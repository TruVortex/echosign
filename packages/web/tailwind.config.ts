import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{tsx,ts}'],
  theme: {
    extend: {
      colors: {
        emergency: { red: '#DC2626', amber: '#F59E0B', green: '#16A34A' },
        dark: { 900: '#0A0A0A', 800: '#1A1A1A', 700: '#2A2A2A' },
      },
    },
  },
  plugins: [],
} satisfies Config;
