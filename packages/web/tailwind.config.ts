import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable dark mode based on class
  theme: {
    extend: {
      colors: {
        // Define brand colors used in App.tsx
        'brand-bg-light': '#F5F7FA', // Example light background
        'brand-bg-dark': '#0F172A', // Example dark background (slate-900)
        'brand-card-light': '#FFFFFF', // Example light card background
        'brand-card-dark': '#1E293B', // Example dark card background (slate-800)
        'brand-border': '#334155', // Example border color (slate-700)
        'brand-dark': '#CBD5E1', // Example for dark text on dark background (slate-300)

        // Define primary color used in App.tsx
        primary: {
          DEFAULT: '#3B82F6', // Blue-500
        },
      },
      borderRadius: {
        'button': '20px', // As seen in App.tsx navigation buttons
      }
    },
  },
  plugins: [],
} satisfies Config;
