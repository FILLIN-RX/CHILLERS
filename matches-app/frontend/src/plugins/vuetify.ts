import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify, type ThemeDefinition } from 'vuetify';
import { fr } from 'vuetify/locale';

const chillersDarkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#111111',
    surface: '#181818',
    'surface-bright': '#222222',
    'surface-variant': '#1a1a1a',
    'on-surface-variant': '#AEAEB2',
    primary: '#E50914',
    'primary-darken-1': '#B91C1C',
    secondary: '#EF4444',
    'secondary-darken-1': '#DC2626',
    error: '#FF453A',
    info: '#0A84FF',
    success: '#30D158',
    warning: '#FFD60A',
  },
};

export default createVuetify({
  locale: {
    locale: 'fr',
    fallback: 'fr',
    messages: { fr },
  },
  theme: {
    defaultTheme: 'chillersDarkTheme',
    themes: {
      chillersDarkTheme,
    },
  },
  defaults: {
    VCard: {
      rounded: 'xl',
      elevation: 0,
      color: 'surface',
    },
    VBtn: {
      rounded: 'xl',
      elevation: 0,
    },
    VChip: {
      rounded: 'xl',
    },
    VTextField: {
      variant: 'solo-filled',
      rounded: 'xl',
      density: 'comfortable',
      hideDetails: true,
    },
  },
});
