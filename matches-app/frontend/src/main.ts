import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import './style.css';

const app = createApp(App);
const pinia = createPinia();

// Activation DevTools & performance monitoring
app.config.performance = true;

app.use(pinia);
app.use(router);
app.use(vuetify);

if (import.meta.env.DEV) {
  (window as any).__VUE_APP__ = app;
  (window as any).__PINIA__ = pinia;
}

app.mount('#app');
