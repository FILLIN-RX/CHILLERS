/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        // Couleur principale : rouge et noir adouci #111111
        primary: {
          DEFAULT: '#E50914',
          50: '#FEE2E2',
          100: '#FFC7C7',
          200: '#FFA0A0',
          300: '#F87171',
          400: '#EF4444',
          500: '#E50914',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          hover: '#F40612',
        },
        // Noir pas trop foncé
        dark: {
          DEFAULT: '#111111',
          bg: '#111111',
          base: '#111111',
        },
        background: '#111111',
        // Pour les cartes
        card: {
          DEFAULT: '#181818',
          hover: '#222222',
        },
        surface: {
          DEFAULT: '#181818',
          variant: '#202020',
        },
      },
      borderWidth: {
        DEFAULT: '1px',
        '0': '0px',
        '2': '2px',
        '3': '3px',
        '4': '4px',
        '5': '5px',
      },
      borderColor: {
        // Pas de couleur par défaut sur les borders (transparentes / neutres)
        DEFAULT: 'transparent',
      },
    },
  },
  plugins: [],
}
