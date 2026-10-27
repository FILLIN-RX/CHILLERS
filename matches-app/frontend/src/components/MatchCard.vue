<template>
  <v-card
    color="surface"
    variant="flat"
    class="match-card cursor-pointer"
    :class="{
      'match-card-live': match.status === 'live',
      'match-card-goal': isRecentlyUpdated
    }"
    @click="$emit('select', match)"
  >
    <!-- Trait indicateur Live à gauche -->
    <span v-if="match.status === 'live'" class="live-strip" aria-hidden="true" />

    <!-- ─── 1. GRILLE COLONNE 1 : Temps / Statut (Largeur fixe) ─── -->
    <div class="grid-col-time">
      <div class="time-inner d-flex flex-column align-center justify-center">
        <div v-if="isLive" class="live-status-pill d-flex align-center justify-center gap-1">
          <span class="live-dot-pulse" aria-hidden="true" />
          <span class="live-period-tag font-weight-black">{{ periodLabel }}</span>
        </div>
        <span v-else class="day-label">{{ dayLabel }}</span>

        <span
          class="status-label"
          :class="{
            'status-live': isLive && !isHalfTime,
            'status-halftime': isHalfTime,
            'status-finished': isFinished,
            'status-upcoming': isUpcoming
          }"
        >
          {{ displayMinute }}
        </span>

        <span v-if="hasExtraTime" class="extra-label">
          {{ match.statusShort === 'TAB' ? 'TAB' : 'Prol.' }}
        </span>
      </div>
      <!-- Séparateur vertical intégré -->
      <div class="time-divider" aria-hidden="true"></div>
    </div>

    <!-- ─── 2. GRILLE COLONNE 2 : Équipes (1fr, min-width 0, texte tronqué, logos 24px) ─── -->
    <div class="grid-col-teams">
      <!-- Ligne 1 : Domicile -->
      <div class="team-line d-flex align-center min-w-0">
        <TeamLogo
          :src="match.homeTeam.logo"
          :name="match.homeTeam.name"
          :size="24"
          class="flex-shrink-0 mr-2-5 team-logo-hover"
        />
        <span
          class="team-title text-truncate"
          :class="{
            'team-winner': isHomeWinner || (isLive && isHomeLeading),
            'team-regular': !isHomeWinner && !(isLive && isHomeLeading)
          }"
        >
          {{ match.homeTeam.name }}
        </span>

        <!-- Badge discret Féminin / U-x / Intl -->
        <span
          v-if="categoryInfo.badgeLabel"
          class="cat-chip flex-shrink-0 ml-1-5"
          :style="{
            color: categoryInfo.badgeColor,
            backgroundColor: categoryInfo.badgeColor + '22'
          }"
        >
          {{ categoryInfo.badgeLabel }}
        </span>
      </div>

      <!-- Ligne 2 : Extérieur -->
      <div class="team-line d-flex align-center min-w-0 mt-1">
        <TeamLogo
          :src="match.awayTeam.logo"
          :name="match.awayTeam.name"
          :size="24"
          class="flex-shrink-0 mr-2-5 team-logo-hover"
        />
        <span
          class="team-title text-truncate"
          :class="{
            'team-winner': isAwayWinner || (isLive && isAwayLeading),
            'team-regular': !isAwayWinner && !(isLive && isAwayLeading)
          }"
        >
          {{ match.awayTeam.name }}
        </span>
      </div>
    </div>

    <!-- ─── 3. GRILLE COLONNE 3 : Scores & Actions (Largeur fixe, alignement strict) ─── -->
    <div class="grid-col-scores-actions">
      <!-- Badge But animé -->
      <span v-if="isRecentlyUpdated" class="goal-tag">BUT !</span>

      <!-- Sous-colonne Scores (Alignée strictement à droite) -->
      <div class="scores-box">
        <template v-if="hasScores">
          <!-- Score Domicile -->
          <div
            class="score-line font-mono"
            :class="{
              'score-highlight': isHomeWinner || isLive,
              'score-muted': !isHomeWinner && !isLive,
              'score-goal-pulse': isRecentlyUpdated
            }"
          >
            <span v-if="match.homeTeam.halfTimeScore !== undefined" class="score-ht mr-1">
              ({{ match.homeTeam.halfTimeScore }})
            </span>
            <span class="score-num">{{ match.homeTeam.score ?? 0 }}</span>
          </div>

          <!-- Score Extérieur -->
          <div
            class="score-line font-mono mt-1"
            :class="{
              'score-highlight': isAwayWinner || isLive,
              'score-muted': !isAwayWinner && !isLive,
              'score-goal-pulse': isRecentlyUpdated
            }"
          >
            <span v-if="match.awayTeam.halfTimeScore !== undefined" class="score-ht mr-1">
              ({{ match.awayTeam.halfTimeScore }})
            </span>
            <span class="score-num">{{ match.awayTeam.score ?? 0 }}</span>
          </div>
        </template>
        <div v-else class="scores-placeholder" aria-hidden="true">&nbsp;</div>
      </div>

      <!-- Sous-colonne Actions (Favori & Vidéo) -->
      <div class="actions-box d-flex align-center justify-end">
        <v-btn
          icon
          size="x-small"
          variant="text"
          :color="isFavorite ? 'warning' : 'zinc-600'"
          class="fav-btn"
          title="Ajouter aux favoris"
          @click.stop="$emit('toggle-favorite', match.id)"
        >
          <v-icon size="18">
            {{ isFavorite ? 'mdi-star' : 'mdi-star-outline' }}
          </v-icon>
        </v-btn>

        <v-btn
          v-if="isLive"
          icon
          size="x-small"
          variant="flat"
          color="primary"
          class="player-btn ml-1"
          title="Regarder le direct"
          @click.stop="$emit('select', match)"
        >
          <v-icon size="14">mdi-play</v-icon>
        </v-btn>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SportMatch } from '../types/matches';
import TeamLogo from './TeamLogo.vue';
import { classifyMatch } from '../utils/matchClassifier';
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

const categoryInfo = computed(() => classifyMatch(props.match));

// Minute calculée en temps réel avec tic-tac régulier
const {
  displayMinute,
  periodLabel,
  isLive,
  isHalfTime,
  isFinished,
  isUpcoming,
} = useLiveMinute(computed(() => props.match));

const hasScores = computed(() => {
  if (isUpcoming.value) return false;
  return isLive.value || isFinished.value;
});

// Formatage Date abrégée (ex: 04 OCT)
const dayLabel = computed(() => {
  try {
    return new Date(props.match.startTime)
      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      .toUpperCase()
      .replace('.', '');
  } catch {
    return '--';
  }
});

const hasExtraTime = computed(() => {
  const s = (props.match.statusShort || '').toUpperCase();
  return s === 'ET' || s === 'TAB' || s === 'AET';
});

const isHomeWinner = computed(() => Boolean(props.match.homeTeam.isWinner));
const isAwayWinner = computed(() => Boolean(props.match.awayTeam.isWinner));

const isHomeLeading = computed(() => {
  const h = props.match.homeTeam.score ?? 0;
  const a = props.match.awayTeam.score ?? 0;
  return h > a;
});

const isAwayLeading = computed(() => {
  const h = props.match.homeTeam.score ?? 0;
  const a = props.match.awayTeam.score ?? 0;
  return a > h;
});
</script>

<style scoped>
/* ─── Carte de Match en 3 GRILLES CSS STRICTES ─── */
.match-card {
  position: relative;
  display: grid !important;
  grid-template-columns: 58px 1fr 76px;
  align-items: center;
  column-gap: 10px;
  padding: 0 10px 0 10px !important;
  height: 68px;
  min-height: 68px;
  max-height: 68px;
  border: 1px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  transition: transform 0.15s ease, background-color 0.15s ease;
  user-select: none;
  box-sizing: border-box;
}

@media (min-width: 600px) {
  .match-card {
    grid-template-columns: 62px 1fr 82px;
    column-gap: 14px;
    padding: 0 14px 0 14px !important;
  }
}

.match-card:hover {
  background-color: #202020 !important;
}

.match-card:active {
  transform: scale(0.992);
}

/* Liseré rouge Live */
.live-strip {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  width: 4px;
  background-color: #E50914;
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
  box-shadow: 0 0 8px rgba(229, 9, 20, 0.6);
}

.match-card-live {
  background: linear-gradient(90deg, rgba(229, 9, 20, 0.06) 0%, rgba(24, 24, 24, 1) 35%) !important;
}

/* Animation But */
.match-card-goal {
  border-color: #E50914 !important;
  box-shadow: 0 0 18px rgba(229, 9, 20, 0.65), inset 0 0 10px rgba(229, 9, 20, 0.15) !important;
  animation: cardGoalPulse 1.6s infinite ease-in-out;
}

@keyframes cardGoalPulse {
  0% {
    box-shadow: 0 0 10px rgba(229, 9, 20, 0.4), inset 0 0 6px rgba(229, 9, 20, 0.1);
  }
  50% {
    box-shadow: 0 0 24px rgba(229, 9, 20, 0.85), inset 0 0 14px rgba(229, 9, 20, 0.25);
  }
  100% {
    box-shadow: 0 0 10px rgba(229, 9, 20, 0.4), inset 0 0 6px rgba(229, 9, 20, 0.1);
  }
}

.goal-tag {
  position: absolute;
  top: -8px;
  right: 50px;
  background-color: #E50914;
  color: #ffffff;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 4px;
  box-shadow: 0 0 8px rgba(229, 9, 20, 0.6);
  animation: bounceGoal 0.5s infinite alternate ease-in-out;
  z-index: 5;
}

@keyframes bounceGoal {
  from { transform: translateY(0); }
  to { transform: translateY(-3px); }
}

.score-goal-pulse {
  color: #ff3344 !important;
  transform: scale(1.15);
  transition: transform 0.2s ease;
}

/* ─── 1. Grille Colonne 1 : Temps / Statut ─── */
.grid-col-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.time-inner {
  flex: 1;
  text-align: center;
  line-height: 1;
}

.time-divider {
  width: 1px;
  height: 36px;
  background-color: rgba(255, 255, 255, 0.08);
  margin-left: 6px;
  flex-shrink: 0;
}

.day-label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #8E8E93;
  line-height: 1;
}

.live-status-pill {
  line-height: 1;
  margin-bottom: 2px;
}

.live-dot-pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: #E50914;
  box-shadow: 0 0 6px rgba(229, 9, 20, 0.8);
  animation: pulseDot 1.4s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

@keyframes pulseDot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.85);
  }
}

.live-period-tag {
  color: #ff453a;
  font-size: 8.5px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1;
}

.status-label {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-top: 3px;
  line-height: 1;
}

.status-live {
  color: #E50914;
  font-weight: 900;
  animation: pulse 1.6s infinite ease-in-out;
}

.status-halftime {
  color: #ff9f0a !important;
  font-weight: 900;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.45; }
  100% { opacity: 1; }
}

.status-finished {
  color: #8E8E93;
}

.status-upcoming {
  color: #ffffff;
}

.extra-label {
  font-size: 9px;
  color: #71717a;
  font-family: monospace;
  margin-top: 2px;
}

/* ─── 2. Grille Colonne 2 : Équipes ─── */
.grid-col-teams {
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.team-line {
  height: 24px;
  min-width: 0;
}

.mr-2-5 {
  margin-right: 8px;
}

.team-title {
  font-size: 14px;
  letter-spacing: -0.01em;
  min-width: 0;
}

.team-winner {
  font-weight: 700;
  color: #ffffff;
}

.team-regular {
  font-weight: 500;
  color: #D1D1D6;
}

.cat-chip {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 4px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.ml-1-5 {
  margin-left: 6px;
}

/* ─── 3. Grille Colonne 3 : Scores & Actions ─── */
.grid-col-scores-actions {
  display: grid;
  grid-template-columns: 38px 1fr;
  align-items: center;
  column-gap: 6px;
  width: 100%;
  position: relative;
}

.scores-box {
  width: 38px;
  min-width: 38px;
  max-width: 38px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
}

.scores-placeholder {
  height: 42px;
  width: 100%;
}

.score-line {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  width: 100%;
}

.score-num {
  display: inline-block;
  min-width: 14px;
  text-align: right;
  font-weight: 800;
}

.score-highlight {
  color: #ffffff;
}

.score-muted {
  color: #8E8E93;
}

.score-ht {
  font-size: 10px;
  color: #71717a;
  font-weight: 500;
}

.actions-box {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.fav-btn {
  width: 26px !important;
  height: 26px !important;
  opacity: 0.85;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fav-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.player-btn {
  width: 24px !important;
  height: 24px !important;
  min-width: 24px !important;
  border-radius: 6px !important;
  box-shadow: 0 0 10px rgba(229, 9, 20, 0.5);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.player-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 0 14px rgba(229, 9, 20, 0.7);
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
