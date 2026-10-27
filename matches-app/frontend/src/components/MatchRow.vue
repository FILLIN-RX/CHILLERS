<template>
  <div
    class="match-row d-flex align-center justify-space-between px-4 py-3"
    :class="{ 'match-row-flash': isRecentlyUpdated }"
    @click="$emit('select', match)"
  >
    <!-- Équipe Domicile -->
    <div class="team-col d-flex align-center gap-3 flex-1 min-w-0 pr-2">
      <TeamLogo :src="match.homeTeam.logo" :name="match.homeTeam.name" :size="32" />
      <span
        class="text-body-2 text-truncate"
        :class="match.homeTeam.isWinner ? 'font-weight-bold text-white' : 'font-weight-medium text-zinc-300'"
      >
        {{ match.homeTeam.name }}
      </span>
    </div>

    <!-- Centre : Score ou Heure -->
    <div class="center-col d-flex flex-column align-center justify-center px-3 flex-shrink-0">
      <div
        v-if="match.status === 'live' || match.status === 'finished'"
        class="score-pill px-3 py-1 rounded-lg"
        :class="{ 'score-pill-flash': isRecentlyUpdated }"
      >
        <span :class="match.homeTeam.isWinner ? 'text-white' : 'text-zinc-300'">{{ match.homeTeam.score ?? 0 }}</span>
        <span class="text-zinc-500 mx-1">:</span>
        <span :class="match.awayTeam.isWinner ? 'text-white' : 'text-zinc-300'">{{ match.awayTeam.score ?? 0 }}</span>
      </div>
      <div v-else class="time-pill px-3 py-1 rounded-lg text-caption font-weight-bold text-zinc-300">
        {{ formatTime(match.startTime) }}
      </div>

      <span v-if="isLive" class="live-indicator text-caption font-weight-bold mt-1" :class="{ 'live-ht': isHalfTime }">
        <span class="live-dot" :class="{ 'live-dot-ht': isHalfTime }"></span>
        {{ isHalfTime ? 'Mi-temps' : displayMinute }}
      </span>
      <span v-else-if="match.status === 'finished'" class="text-caption text-zinc-500 mt-1">
        Terminé (FT)
      </span>
      <span v-else-if="match.venue" class="text-caption text-zinc-500 mt-1 text-truncate" style="max-width: 120px;">
        {{ match.venue.split('(')[0]?.trim() }}
      </span>
    </div>

    <!-- Équipe Extérieur -->
    <div class="team-col d-flex align-center justify-end gap-3 flex-1 min-w-0 pl-2">
      <span
        class="text-body-2 text-truncate text-right"
        :class="match.awayTeam.isWinner ? 'font-weight-bold text-white' : 'font-weight-medium text-zinc-300'"
      >
        {{ match.awayTeam.name }}
      </span>
      <TeamLogo :src="match.awayTeam.logo" :name="match.awayTeam.name" :size="32" />
    </div>

    <!-- Bouton Favori -->
    <div class="favorite-col pl-2 flex-shrink-0" @click.stop="$emit('toggle-favorite', match.id)">
      <v-btn
        icon
        size="x-small"
        variant="text"
        :color="isFavorite ? 'warning' : 'zinc-600'"
      >
        <v-icon size="18">{{ isFavorite ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SportMatch } from '../types/matches';
import TeamLogo from './TeamLogo.vue';
import { useLiveMinute } from '../composables/useLiveMinute';

const props = defineProps<{
  match: SportMatch;
  isFavorite: boolean;
  isRecentlyUpdated?: boolean;
}>();

defineEmits<{
  (e: 'select', match: SportMatch): void;
  (e: 'toggle-favorite', matchId: string): void;
}>();

const { displayMinute, isLive, isHalfTime } = useLiveMinute(computed(() => props.match));

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}
</script>

<style scoped>
.match-row {
  cursor: pointer;
  transition: background-color 0.25s ease;
  user-select: none;
}
.match-row:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.match-row-flash {
  animation: flashRowBg 3.5s ease-out;
}

@keyframes flashRowBg {
  0% {
    background-color: rgba(255, 179, 0, 0.25);
  }
  30% {
    background-color: rgba(255, 179, 0, 0.15);
  }
  100% {
    background-color: transparent;
  }
}

.score-pill {
  background-color: #161420;
  border: 1px solid #201d2c;
  color: #fff;
  font-family: monospace;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.05em;
  transition: all 0.3s ease;
}

.score-pill-flash {
  animation: flashPill 3s ease-out;
  border-color: #ffb300 !important;
  color: #ffb300 !important;
}

@keyframes flashPill {
  0% {
    transform: scale(1.18);
    background-color: rgba(255, 179, 0, 0.35);
    box-shadow: 0 0 12px rgba(255, 179, 0, 0.5);
  }
  20% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    background-color: #161420;
    box-shadow: none;
  }
}

.time-pill {
  background-color: #161420;
  border: 1px solid #201d2c;
  font-family: monospace;
  font-size: 12px;
}

.live-indicator {
  color: #ff453a;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.live-ht {
  color: #ff9f0a !important;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #ff453a;
  animation: pulse 1.5s infinite;
}

.live-dot-ht {
  background-color: #ff9f0a !important;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
}

.gap-3 {
  gap: 12px;
}
</style>
