<template>
  <v-card class="pa-4 rounded-2xl sidebar-card" color="surface">
    <div class="d-flex align-center justify-space-between pb-3 mb-3 sidebar-divider">
      <div class="d-flex align-center gap-2">
        <v-avatar color="primary" size="32" class="elevation-2">
          <v-icon size="18" color="white">mdi-trophy</v-icon>
        </v-avatar>
        <div>
          <div class="text-caption font-weight-black text-uppercase text-white">CHILLERS Sports</div>
          <div class="text-caption text-zinc-400">Scores & Directs</div>
        </div>
      </div>
      <v-chip size="x-small" color="surface-variant" variant="flat" class="font-weight-bold">
        {{ leagues.length }} Ligues
      </v-chip>
    </div>

    <!-- Filtre par Pays -->
    <div class="mb-3">
      <div class="text-caption text-zinc-400 font-weight-bold mb-1">Filtrer par Pays :</div>
      <v-select
        v-model="selectedCountry"
        :items="[{ id: 'all', name: '🌍 Tous les pays' }, ...countries]"
        item-title="name"
        item-value="id"
        density="compact"
        variant="outlined"
        hide-details
        class="mb-2"
        @update:model-value="onCountryChange"
      />
    </div>

    <v-list density="compact" nav class="bg-transparent pa-0">
      <v-list-item
        v-for="league in leagues"
        :key="league.id"
        :active="selectedLeague === league.id"
        color="primary"
        rounded="xl"
        class="mb-1"
        @click="setLeague(league.id)"
      >
        <template #prepend>
          <TeamLogo :src="league.logo || undefined" :name="league.name" :size="24" class="mr-2" />
        </template>
        <v-list-item-title class="text-caption font-weight-bold">
          {{ league.name }}
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption text-zinc-500">
          {{ league.country }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-trophy-outline"
            variant="text"
            size="x-small"
            color="zinc-400"
            class="ml-1"
            title="Voir classement"
            @click.stop="$emit('openStandings', league.id, league.name, league.logo)"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useMatchesStore } from '../stores/matches';
import TeamLogo from './TeamLogo.vue';

defineEmits<{
  (e: 'openStandings', id: string, name: string, logo?: string): void;
}>();

const store = useMatchesStore();
const { leagues, countries, selectedCountry, selectedLeague } = storeToRefs(store);

function onCountryChange(countryId: string) {
  store.setCountry(countryId);
}

function setLeague(leagueId: string) {
  selectedLeague.value = leagueId;
  store.loadMatches();
}
</script>

<style scoped>
.sidebar-divider {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
}

.sidebar-card {
  max-height: 100%;
}

@media (min-width: 1024px) {
  .sidebar-card {
    position: sticky;
    top: 80px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
}
</style>
