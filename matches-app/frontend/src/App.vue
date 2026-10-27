<template>
  <v-app class="chillers-app">
    <!-- Top App Bar -->
    <v-app-bar flat color="background" class="border-b-dark px-2 px-sm-6" height="64">
      <v-btn
        v-if="$route.name === 'matches'"
        icon="mdi-menu"
        variant="text"
        color="white"
        class="d-lg-none mr-1 flex-shrink-0"
        aria-label="Ouvrir le menu"
        @click="ui.navDrawer = !ui.navDrawer"
      />

      <router-link to="/" class="d-flex align-center text-decoration-none mr-2 mr-sm-4">
        <span class="text-h6 font-weight-black text-white brand-text">CHILLERS</span>
        <v-chip size="x-small" color="primary" variant="flat" class="ml-2 font-weight-bold">
          SPORTS
        </v-chip>
      </router-link>

      <!-- Recherche globale -->
      <v-text-field
        v-model="store.searchQuery"
        placeholder="Rechercher une équipe..."
        prepend-inner-icon="mdi-magnify"
        clearable
        density="compact"
        class="header-search mx-2 mx-sm-4"
        aria-label="Rechercher"
      />

      <v-spacer />

      <v-btn
        to="/"
        variant="text"
        size="small"
        class="font-weight-bold mr-1 d-none d-sm-inline-flex"
        :active="$route.name === 'matches'"
      >
        <v-icon start size="18">mdi-soccer</v-icon>
        Matchs
      </v-btn>

      <v-btn
        icon="mdi-refresh"
        size="small"
        variant="tonal"
        color="primary"
        :loading="store.isRefreshing"
        @click="store.loadMatches(true)"
      />
    </v-app-bar>

    <!-- Main Content -->
    <v-main class="bg-background">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useMatchesStore } from './stores/matches';
import { useUiStore } from './stores/ui';

const store = useMatchesStore();
const ui = useUiStore();
</script>

<style>
/* Global resets & typography */
html, body {
  background-color: #111111 !important;
  color: #f3f4f6;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif;
  margin: 0;
  padding: 0;
}

.chillers-app {
  background-color: #111111 !important;
}

.border-b-dark {
  border-bottom: 1px solid #1a1a1a !important;
}

.brand-text {
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-search {
  flex: 1 1 120px;
  min-width: 0;
  max-width: 380px;
}

.header-search .v-input__control {
  max-height: 40px;
}
</style>
