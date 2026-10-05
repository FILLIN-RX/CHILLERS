<template>
  <v-card
    class="hero-card pa-4 pa-sm-6 rounded-2xl cursor-pointer"
    elevation="4"
    @click="$emit('select', match)"
  >
    <div class="hero-glow-1"></div>
    <div class="hero-glow-2"></div>

    <div class="d-flex align-center justify-space-between mb-3 position-relative z-1">
      <div class="d-flex align-center gap-2">
        <v-icon size="14" color="primary">mdi-circle</v-icon>
        <span class="text-caption font-weight-bold text-uppercase text-indigo-lighten-4 text-truncate" style="max-width: 200px;">
          {{ match.league.name }}
        </span>
      </div>

      <div class="d-flex align-center gap-2">
        <v-chip
          v-if="isLive"
          :color="isHalfTime ? 'warning' : 'error'"
          variant="flat"
          size="small"
          class="font-weight-black animate-pulse"
        >
          <v-icon start size="12">mdi-record</v-icon>
          {{ isHalfTime ? 'MI-TEMPS (HT)' : `EN DIRECT (${displayMinute})` }}
        </v-chip>
        <v-chip
          v-else
          color="surface-variant"
          variant="flat"
          size="small"
          class="font-weight-bold text-zinc-300"
        >
          {{ isFinished ? 'Terminé (FT)' : 'À venir' }}
        </v-chip>
      </div>
    </div>

    <!-- Scoreboard -->
    <v-row align="center" justify="center" class="text-center position-relative z-1 my-1 my-sm-2">
      <!-- Domicile -->
      <v-col cols="4" class="d-flex flex-column align-center px-1">
        <TeamLogo :src="match.homeTeam.logo" :name="match.homeTeam.name" :size="52" class="mb-2 logo-responsive" />
        <span class="text-caption text-sm-subtitle-2 font-weight-bold text-white text-truncate text-center" style="max-width: 120px;">
          {{ match.homeTeam.name }}
        </span>
      </v-col>

      <!-- Score / Heure -->
      <v-col cols="4" class="d-flex flex-column align-center justify-center px-1">
        <div
          v-if="isLive || isFinished"
          class="text-h4 text-sm-h3 font-weight-black font-mono text-white tracking-tight"
        >
          <span>{{ match.homeTeam.score ?? 0 }}</span>
          <span class="text-primary mx-1 mx-sm-2">:</span>
          <span>{{ match.awayTeam.score ?? 0 }}</span>
        </div>
        <div v-else class="text-h6 text-sm-h5 font-weight-black font-mono text-primary">
          {{ formatStartTime(match.startTime) }}
        </div>

        <span class="text-[11px] text-sm-caption text-zinc-400 mt-1 text-truncate">
          {{ isLive ? (isHalfTime ? 'Mi-temps' : `En direct • ${displayMinute}`) : isFinished ? 'Score final (FT)' : 'Coup d\'envoi' }}
        </span>

        <span v-if="match.venue" class="text-[10px] text-zinc-500 mt-1 text-truncate" style="max-width: 140px;">
          <v-icon size="11" class="mr-1">mdi-map-marker</v-icon>
          {{ match.venue.split('(')[0]?.trim() }}
        </span>

        <!-- Bouton Regarder en direct -->
        <v-btn
          v-if="match.status === 'live'"
          color="error"
          rounded="xl"
          size="x-small"
          class="font-weight-bold mt-2 px-3 animate-pulse"
          prepend-icon="mdi-play-circle"
          @click.stop="$emit('watch-stream', match)"
        >
          Regarder
        </v-btn>
      </v-col>

      <!-- Extérieur -->
      <v-col cols="4" class="d-flex flex-column align-center px-1">
        <TeamLogo :src="match.awayTeam.logo" :name="match.awayTeam.name" :size="52" class="mb-2 logo-responsive" />
        <span class="text-caption text-sm-subtitle-2 font-weight-bold text-white text-truncate text-center" style="max-width: 120px;">
          {{ match.awayTeam.name }}
        </span>
      </v-col>
    </v-row>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SportMatch } from '../types/matches';
import TeamLogo from './TeamLogo.vue';
import { useLiveMinute } from '../composables/useLiveMinute';

const props = defineProps<{
  match: SportMatch;
}>();

defineEmits<{
  (e: 'select', match: SportMatch): void;
  (e: 'watch-stream', match: SportMatch): void;
}>();

const { displayMinute, isLive, isHalfTime, isFinished } = useLiveMinute(computed(() => props.match));

function formatStartTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}
</script>

<style scoped>
.hero-card {
  background: linear-gradient(135deg, #181818 0%, #151515 100%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  border-radius: 20px !important;
  transition: transform 0.2s ease, border-color 0.2s ease;
  width: 100%;
}

.hero-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.1);
}

.hero-glow-1 {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(229, 9, 20, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.hero-glow-2 {
  position: absolute;
  bottom: -80px;
  left: -80px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(229, 9, 20, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.z-1 {
  z-index: 1;
}

.font-mono {
  font-family: monospace;
}

@media (min-width: 600px) {
  :deep(.logo-responsive) {
    width: 64px !important;
    height: 64px !important;
  }
}
</style>
