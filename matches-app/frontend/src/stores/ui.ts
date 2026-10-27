import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  // Tiroir latéral (menu hamburger) — ouvert sur mobile uniquement
  const navDrawer = ref(false);

  return { navDrawer };
});
