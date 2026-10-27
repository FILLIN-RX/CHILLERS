<template>
  <v-container class="pa-3 pa-sm-6 max-w-900 position-relative">
    <!-- Notification flottante en cas de but en direct (SSE) -->
    <GoalNotificationBanner :alert="store.activeGoalAlert" @close="store.dismissGoalAlert" />

    <!-- Top Action Bar -->
    <div class="d-flex align-center justify-space-between mb-3 mb-sm-4">
      <v-btn
        variant="tonal"
        color="surface-variant"
        rounded="xl"
        size="small"
        @click="goBack"
      >
        <v-icon start size="18">mdi-arrow-left</v-icon>
        Matchs
      </v-btn>

      

      <div class="d-flex align-center gap-2">
        <v-btn
          v-if="match"
          icon
          size="small"
          variant="tonal"
          :color="store.isFavorite(match.id) ? 'warning' : 'surface-variant'"
          @click="store.toggleFavorite(match.id)"
        >
          <v-icon size="18">
            {{ store.isFavorite(match.id) ? 'mdi-star' : 'mdi-star-outline' }}
          </v-icon>
        </v-btn>

        <v-btn
          icon="mdi-share-variant"
          size="small"
          variant="tonal"
          color="surface-variant"
          @click="shareMatch"
        />
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="isLoading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="text-caption text-zinc-400 mt-4">Chargement des données du match...</div>
    </div>

    <!-- Match introuvable -->
    <div v-else-if="!match" class="text-center py-16">
      <v-avatar color="surface-variant" size="64" class="mb-4">
        <v-icon size="32" color="zinc-500">mdi-alert-circle-outline</v-icon>
      </v-avatar>
      <div class="text-h6 font-weight-bold text-white">Match introuvable</div>
      <div class="text-caption text-zinc-400 mt-1">
        Ce match n'est pas disponible ou le lien a expiré.
      </div>
      <v-btn color="primary" class="mt-4 font-weight-bold" @click="goBack">
        Retour aux matchs
      </v-btn>
    </div>

    <!-- Contenu du Match -->
    <div v-else class="d-flex flex-column gap-5">
      <!-- ─── 1. Scoreboard Card (Vuetify natif) ─── -->
      <v-card color="surface" rounded="xl" class="match-score-card pa-4 pa-sm-5 position-relative overflow-hidden" elevation="0">
        <!-- Liseré vertical rouge gauche -->
        <span
          class="position-absolute"
          style="top: 0; bottom: 0; left: 0; width: 5px; background-color: #E50914;"
          aria-hidden="true"
        />

        <!-- En-tête Ligue (Cliquable pour ouvrir la page compétition) -->
        <div
          class="league-header d-flex align-center justify-center gap-2 mb-3 mb-sm-4 text-center cursor-pointer hover:opacity-80 transition-opacity"
          title="Voir les détails de la compétition"
          @click="router.push(`/competition/${encodeURIComponent(match.league.id || match.league.slug || 'eng.1')}`)"
        >
          <TeamLogo :src="match.league.logo || undefined" :name="match.league.name" :size="20" />
          <span class="text-caption font-weight-bold text-grey-lighten-1 text-uppercase tracking-wider text-truncate">
            {{ match.league.name }}
          </span>
          <v-icon size="14" color="grey" class="flex-shrink-0">mdi-chevron-right</v-icon>
        </div>

        <v-row align="center" justify="center" class="text-center my-1" no-gutters>
          <!-- Domicile -->
          <v-col cols="4" class="d-flex flex-column align-center">
            <TeamLogo :src="match.homeTeam.logo" :name="match.homeTeam.name" :size="xs ? 46 : 64" class="mb-2" />
            <span class="text-caption text-sm-subtitle-2 font-weight-bold text-white text-truncate score-team-name">
              {{ match.homeTeam.name }}
            </span>
          </v-col>

          <!-- Score / Heure & Statut central -->
          <v-col cols="4" class="d-flex flex-column align-center justify-center">
            <div
              v-if="match.status === 'live' || match.status === 'finished'"
              class="text-h4 text-sm-h3 font-weight-black font-mono text-white tracking-tight leading-none"
            >
              <span>{{ match.homeTeam.score ?? 0 }}</span>
              <span class="text-grey mx-2">–</span>
              <span>{{ match.awayTeam.score ?? 0 }}</span>
            </div>
            <div v-else class="text-h5 text-sm-h4 font-weight-bold font-mono text-white">
              {{ formatStartTime(match.startTime) }}
            </div>

            <!-- Statut en Vuetify -->
            <div class="mt-2">
              <v-chip
                v-if="isLive"
                :color="isHalfTime ? 'warning' : 'primary'"
                variant="flat"
                size="small"
                class="font-weight-black animate-pulse"
              >
                <v-icon start size="10">mdi-record</v-icon>
                {{ isHalfTime ? 'Mi-temps (MT)' : `${displayMinute} (${periodLabel})` }}
              </v-chip>
              <span v-else-if="isFinished" class="text-caption font-weight-bold text-grey text-uppercase tracking-wider">
                Terminé (FT)
              </span>
              <span v-else class="text-caption text-grey text-capitalize">
                {{ formatKickoffDay(match.startTime) }}
              </span>
            </div>

          </v-col>

          <!-- Extérieur -->
          <v-col cols="4" class="d-flex flex-column align-center">
            <TeamLogo :src="match.awayTeam.logo" :name="match.awayTeam.name" :size="xs ? 46 : 64" class="mb-2" />
            <span class="text-caption text-sm-subtitle-2 font-weight-bold text-white text-truncate score-team-name">
              {{ match.awayTeam.name }}
            </span>
          </v-col>
        </v-row>

        <div v-if="match.venue" class="text-caption text-grey mt-3 text-center text-truncate" style="max-width: 100%;">
          <v-icon size="12" class="mr-1">mdi-stadium</v-icon>
          {{ match.venue.split('(')[0]?.trim() }}
        </div>
      </v-card>

      <!-- ─── 2. Onglets de Détails (Flux, Résumé, Stats, Compos) ─── -->
      <v-card class="rounded-2xl overflow-hidden" color="surface">
        <v-tabs v-model="activeTab" grow :scroll-to-active="false" color="primary" bg-color="surface" class="match-tabs">
          <v-tab value="stream" class="font-weight-bold">
            <v-icon start size="16" color="error" class="d-none d-sm-flex">mdi-record</v-icon>
            <span class="d-none d-sm-inline">Direct Flux</span>
            <span class="d-sm-none">Direct</span>
          </v-tab>
          <v-tab value="summary" class="font-weight-bold">Résumé</v-tab>
          <v-tab value="stats" class="font-weight-bold">
            <span class="d-none d-sm-inline">Statistiques</span>
            <span class="d-sm-none">Stats</span>
          </v-tab>
          <v-tab value="lineups" class="font-weight-bold">
            <span class="d-none d-sm-inline">Compositions</span>
            <span class="d-sm-none">Compos</span>
          </v-tab>
          <v-tab value="analysis" class="font-weight-bold">
            <v-icon start size="16" color="primary" class="d-none d-sm-flex">mdi-chart-timeline-variant</v-icon>
            <span class="d-none d-sm-inline">Analyse & Cotes</span>
            <span class="d-sm-none">Analyse</span>
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="pa-3 pa-sm-6">
          <!-- ── TAB 0 : Flux Direct ── -->
          <v-window-item value="stream">
            <MatchStreamPlayer
              v-if="match"
              :match-id="match.id || matchId"
              :home-name="match.homeTeam.name"
              :away-name="match.awayTeam.name"
              :is-live="isLive"
              :minute="displayMinute"
              :league="match.league?.name"
              :sport="match.sport"
              :start-time="match.startTime"
            />
          </v-window-item>

          <!-- ── TAB 1 : Résumé (Événements / Commentaire) ── -->
          <v-window-item value="summary">
            <MatchSummaryPanel
              :summary="summary"
              :commentary="analysis?.commentary ?? []"
              :commentary-loading="isLoadingAnalysis"
              @load-commentary="loadAnalysis"
            />
          </v-window-item>

          <!-- ── TAB 2 : Statistiques comparatives ── -->
          <v-window-item value="stats">
            <MatchStats :match="match" :summary="summary" />
          </v-window-item>

          <!-- ── TAB 3 : Compositions ── -->
          <v-window-item value="lineups">
            <LineUp :match="match" :summary="summary" />
          </v-window-item>

          <!-- ── TAB 4 : Analyse Détaillée & Cotes (Phase 3) ── -->
          <v-window-item value="analysis">
            <div v-if="isLoadingAnalysis" class="text-center py-12">
              <v-progress-circular indeterminate color="primary" size="44" />
              <div class="text-caption text-zinc-400 mt-3">Analyse statistique approfondie en cours...</div>
            </div>

            <div v-else-if="!analysis" class="text-center py-12 text-zinc-400">
              Données d'analyse non disponibles pour ce match.
            </div>

            <div v-else class="d-flex flex-column gap-6">
              <!-- 1. Probabilité de Victoire (Win Probability) -->
              <v-card class="pa-5 rounded-2xl border-dark" color="surface-variant">
                <div class="d-flex align-center justify-space-between mb-3 mb-sm-4">
                  <div class="d-flex align-center gap-2">
                    <v-icon color="primary" size="20">mdi-chart-arc</v-icon>
                    <span class="text-subtitle-2 font-weight-black text-white">Probabilité de Victoire</span>
                  </div>
                  <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-bold">
                    Modèle Prédictif ESPN
                  </v-chip>
                </div>

                <div class="prob-bar-container rounded-pill overflow-hidden d-flex mb-3">
                  <div
                    class="prob-segment bg-primary"
                    :style="{ width: `${winProbHome}%` }"
                    v-tooltip="`${match.homeTeam.name}: ${winProbHome}%`"
                  ></div>
                  <div
                    class="prob-segment bg-zinc-600"
                    :style="{ width: `${winProbDraw}%` }"
                    v-tooltip="`Match Nul: ${winProbDraw}%`"
                  ></div>
                  <div
                    class="prob-segment bg-secondary"
                    :style="{ width: `${winProbAway}%` }"
                    v-tooltip="`${match.awayTeam.name}: ${winProbAway}%`"
                  ></div>
                </div>

                <v-row class="text-center">
                  <v-col cols="4">
                    <div class="text-caption text-zinc-400 text-truncate">{{ match.homeTeam.name }}</div>
                    <div class="text-h6 font-weight-black text-primary font-mono">{{ winProbHome }}%</div>
                  </v-col>
                  <v-col cols="4">
                    <div class="text-caption text-zinc-400">Match Nul</div>
                    <div class="text-h6 font-weight-black text-zinc-300 font-mono">{{ winProbDraw }}%</div>
                  </v-col>
                  <v-col cols="4">
                    <div class="text-caption text-zinc-400 text-truncate">{{ match.awayTeam.name }}</div>
                    <div class="text-h6 font-weight-black text-secondary font-mono">{{ winProbAway }}%</div>
                  </v-col>
                </v-row>
              </v-card>

              <!-- 2. Cotes des Bookmakers (Odds & Lines) -->
              <v-card v-if="analysis.odds" class="pa-5 rounded-2xl border-dark" color="surface-variant">
                <div class="d-flex align-center justify-space-between mb-3 mb-sm-4">
                  <div class="d-flex align-center gap-2">
                    <v-icon color="warning" size="20">mdi-cash-multiple</v-icon>
                    <span class="text-subtitle-2 font-weight-black text-white">Cotes Bookmakers</span>
                  </div>
                  <span v-if="analysis.odds.provider" class="text-caption text-zinc-400 font-weight-bold">
                    Fournisseur : {{ analysis.odds.provider }}
                  </span>
                </div>

                <v-row>
                  <v-col cols="4">
                    <div class="odd-box text-center pa-3 rounded-xl border-dark">
                      <div class="text-caption text-zinc-400 text-truncate mb-1">{{ match.homeTeam.name }} (1)</div>
                      <div class="text-h6 font-weight-black text-white font-mono">
                        {{ formatMoneyLine(analysis.odds.homeMoneyLine) }}
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="4">
                    <div class="odd-box text-center pa-3 rounded-xl border-dark">
                      <div class="text-caption text-zinc-400 mb-1">Nul (X)</div>
                      <div class="text-h6 font-weight-black text-white font-mono">
                        {{ formatMoneyLine(analysis.odds.drawMoneyLine) }}
                      </div>
                    </div>
                  </v-col>
                  <v-col cols="4">
                    <div class="odd-box text-center pa-3 rounded-xl border-dark">
                      <div class="text-caption text-zinc-400 text-truncate mb-1">{{ match.awayTeam.name }} (2)</div>
                      <div class="text-h6 font-weight-black text-white font-mono">
                        {{ formatMoneyLine(analysis.odds.awayMoneyLine) }}
                      </div>
                    </div>
                  </v-col>
                </v-row>

                <div v-if="analysis.odds.overUnder || analysis.odds.spread" class="d-flex flex-wrap justify-space-around gap-2 mt-4 pt-3 border-t-dark text-caption">
                  <span v-if="analysis.odds.overUnder" class="text-zinc-300">
                    Total Buts (Over/Under) : <strong class="text-white">{{ analysis.odds.overUnder }}</strong>
                  </span>
                  <span v-if="analysis.odds.spread" class="text-zinc-300">
                    Handicap (Spread) : <strong class="text-white">{{ analysis.odds.spread > 0 ? `+${analysis.odds.spread}` : analysis.odds.spread }}</strong>
                  </span>
                </div>
              </v-card>

              <!-- 3. Forme Récente (Recent Form) -->
              <v-card v-if="analysis.recentForm && analysis.recentForm.length > 0" class="pa-5 rounded-2xl border-dark" color="surface-variant">
                <div class="d-flex align-center gap-2 mb-4">
                  <v-icon color="info" size="20">mdi-history</v-icon>
                  <span class="text-subtitle-2 font-weight-black text-white">Forme Récente (5 derniers matchs)</span>
                </div>

                <v-row>
                  <v-col v-for="teamForm in analysis.recentForm" :key="teamForm.teamId" cols="12" md="6">
                    <div class="form-team-card pa-4 rounded-xl border-dark">
                      <div class="d-flex align-center justify-space-between mb-3">
                        <span class="text-caption font-weight-bold text-white">{{ teamForm.teamName }}</span>
                        <div class="d-flex gap-1">
                          <span
                            v-for="(f, fIdx) in parseFormArray(teamForm.form)"
                            :key="fIdx"
                            class="form-badge"
                            :class="getFormDotClass(f)"
                          >
                            {{ f }}
                          </span>
                        </div>
                      </div>

                      <div v-if="teamForm.matches && teamForm.matches.length > 0" class="d-flex flex-column gap-2 mt-2">
                        <div
                          v-for="m in teamForm.matches"
                          :key="m.id"
                          class="recent-match-row d-flex align-center justify-space-between pa-2 rounded-lg text-caption"
                        >
                          <div class="d-flex align-center gap-2 min-w-0">
                            <span class="form-dot-mini" :class="getFormDotClass(m.result)">{{ m.result }}</span>
                            <span class="text-zinc-300 text-truncate">{{ m.isHome ? 'vs' : '@' }} {{ m.opponentName }}</span>
                          </div>
                          <span class="font-mono font-weight-bold text-white">{{ m.score }}</span>
                        </div>
                      </div>
                    </div>
                  </v-col>
                </v-row>
              </v-card>

              <!-- 4. Face-à-Face Historique (Head-to-Head) -->
              <v-card v-if="analysis.headToHead && analysis.headToHead.length > 0" class="pa-5 rounded-2xl border-dark" color="surface-variant">
                <div class="d-flex align-center gap-2 mb-4">
                  <v-icon color="secondary" size="20">mdi-sword-cross</v-icon>
                  <span class="text-subtitle-2 font-weight-black text-white">Historique des Confrontations Directes</span>
                </div>

                <div class="d-flex flex-column gap-2">
                  <div
                    v-for="h2h in analysis.headToHead"
                    :key="h2h.id"
                    class="h2h-row d-flex align-center justify-space-between pa-3 rounded-xl border-dark"
                  >
                    <div class="text-caption text-zinc-400 font-mono h2h-date">
                      {{ formatH2HDate(h2h.date) }}
                    </div>

                    <div class="d-flex align-center gap-2 flex-1 justify-center h2h-main">
                      <span class="text-caption font-weight-bold text-white text-right text-truncate h2h-team">
                        {{ h2h.homeTeam.name }}
                      </span>
                      <div class="h2h-score font-mono font-weight-black text-white px-2 py-1 rounded bg-surface flex-shrink-0">
                        {{ h2h.homeTeam.score }} - {{ h2h.awayTeam.score }}
                      </div>
                      <span class="text-caption font-weight-bold text-white text-left text-truncate h2h-team">
                        {{ h2h.awayTeam.name }}
                      </span>
                    </div>

                    <div class="text-caption text-zinc-500 d-none d-sm-block text-right" style="min-width: 80px;">
                      {{ h2h.competition || '' }}
                    </div>
                  </div>
                </div>
              </v-card>

              <!-- 5. Commentaires en Direct (Live Commentary) -->
              <v-card v-if="analysis.commentary && analysis.commentary.length > 0" class="pa-5 rounded-2xl border-dark" color="surface-variant">
                <div class="d-flex align-center gap-2 mb-4">
                  <v-icon color="error" size="20">mdi-comment-text-multiple-outline</v-icon>
                  <span class="text-subtitle-2 font-weight-black text-white">Commentaires en direct</span>
                </div>

                <div class="commentary-scroll-box d-flex flex-column gap-2">
                  <div
                    v-for="comm in analysis.commentary"
                    :key="comm.sequence"
                    class="comm-item pa-3 rounded-xl border-dark d-flex gap-3"
                  >
                    <div class="comm-clock font-mono font-weight-bold text-caption text-primary flex-shrink-0">
                      {{ comm.clock || `${comm.period}e` }}
                    </div>
                    <div class="text-caption text-zinc-200">
                      {{ comm.text }}
                    </div>
                  </div>
                </div>
              </v-card>
            </div>
          </v-window-item>
        </v-window>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useMatchesStore } from '../stores/matches';
import { useLiveMinute } from '../composables/useLiveMinute';
import { liveSseClient } from '../services/sse.service';
import {
  fetchMatchById,
  fetchMatchSummary,
  fetchMatchAnalysis,
} from '../services/api';
import type { SportMatch, MatchSummary, DetailedMatchAnalysis } from '../types/matches';
import TeamLogo from '../components/TeamLogo.vue';
import MatchStreamPlayer from '../components/MatchStreamPlayer.vue';
import GoalNotificationBanner from '../components/GoalNotificationBanner.vue';
import LineUp from '../components/detail_matche/LineUp.vue';
import MatchStats from '../components/detail_matche/MatchStats.vue';
import MatchSummaryPanel from '../components/detail_matche/MatchSummary.vue';

const route = useRoute();
const router = useRouter();
const store = useMatchesStore();
const { xs } = useDisplay();

const matchId = computed(() => String(route.params.id || ''));
const leagueParam = computed(() => String(route.query.league || 'all'));

const match = ref<SportMatch | null>(null);
const summary = ref<MatchSummary | null>(null);
const analysis = ref<DetailedMatchAnalysis | null>(null);
const isLoading = ref(true);
const isLoadingAnalysis = ref(false);
const activeTab = ref<'stream' | 'summary' | 'stats' | 'lineups' | 'analysis'>('summary');

// Minute / statut en direct en temps réel (composable partagé)
const { displayMinute, periodLabel, isLive, isHalfTime, isFinished } = useLiveMinute(computed(() => match.value));

async function loadAnalysis() {
  if (analysis.value) return;
  isLoadingAnalysis.value = true;
  try {
    const res = await fetchMatchAnalysis(matchId.value, leagueParam.value);
    analysis.value = res;
  } catch (err) {
    console.warn('[MatchDetailView] Erreur de chargement analyse:', err);
  } finally {
    isLoadingAnalysis.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'analysis' && !analysis.value) {
    loadAnalysis();
  }
});

async function loadMatchData() {
  if (!matchId.value) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  match.value = null;
  summary.value = null;
  analysis.value = null;
  activeTab.value = 'summary';

  try {
    const [matchData, summaryData, analysisData] = await Promise.allSettled([
      fetchMatchById(matchId.value),
      fetchMatchSummary(matchId.value, leagueParam.value),
      fetchMatchAnalysis(matchId.value, leagueParam.value),
    ]);

    if (summaryData.status === 'fulfilled' && summaryData.value) {
      summary.value = summaryData.value;
      if (!match.value) {
        const s = summaryData.value;
        match.value = {
          id: s.id,
          title: s.title,
          homeTeam: s.homeTeam,
          awayTeam: s.awayTeam,
          status: s.status,
          statusText: s.statusText,
          minute: s.minute,
          startTime: s.startTime,
          startTimestamp: new Date(s.startTime).getTime() || Date.now(),
          league: s.league,
          venue: s.venue,
          broadcast: s.broadcasts,
          sport: 'football',
        };
      }
    }

    if (matchData.status === 'fulfilled' && matchData.value) {
      match.value = matchData.value;
    }

    if (analysisData.status === 'fulfilled' && analysisData.value) {
      analysis.value = analysisData.value;
    }

    // Si le match est en direct ou demandé dans l'URL ?tab=stream, ouvrir l'onglet stream
    if (route.query.tab === 'stream' || match.value?.status === 'live') {
      activeTab.value = 'stream';
    } else if (route.query.tab === 'analysis') {
      activeTab.value = 'analysis';
    } else if (route.query.tab && ['summary', 'stats', 'lineups'].includes(String(route.query.tab))) {
      activeTab.value = route.query.tab as typeof activeTab.value;
    }
  } catch (err) {
    console.error('[MatchDetailView] Error:', err);
  } finally {
    isLoading.value = false;
  }
}

function connectSse() {
  // Connexion SSE dédiée au match en cours
  liveSseClient.connect({
    onMatchSummary: (data) => {
      if (data.matchId === matchId.value && data.summary) {
        summary.value = data.summary;
        if (match.value) {
          match.value.homeTeam.score = data.summary.homeTeam.score;
          match.value.awayTeam.score = data.summary.awayTeam.score;
          match.value.status = data.summary.status;
          match.value.minute = data.summary.minute;
        }
      }
    },
    onMatchUpdate: (data) => {
      if (data.match.id === matchId.value) {
        match.value = data.match;
      }
    },
    onGoal: (goalData) => {
      if (goalData.matchId === matchId.value) {
        store.handleGoal(goalData);
        fetchMatchSummary(matchId.value, leagueParam.value).then((s) => {
          if (s) summary.value = s;
        });
      }
    },
  }, matchId.value);
}

onMounted(async () => {
  await loadMatchData();
  connectSse();
});

// Navigation vers un autre match sans démounter la vue
watch(matchId, async () => {
  await loadMatchData();
  liveSseClient.disconnect();
  connectSse();
});

onUnmounted(() => {
  liveSseClient.disconnect();
});

// Probabilités de victoire calculées
const winProbHome = computed(() => {
  if (analysis.value?.currentWinProbability) return analysis.value.currentWinProbability.home;
  if (analysis.value?.odds?.homeWinProbability) return analysis.value.odds.homeWinProbability;
  return 45;
});

const winProbDraw = computed(() => {
  if (analysis.value?.currentWinProbability) return analysis.value.currentWinProbability.draw;
  if (analysis.value?.odds?.drawProbability) return analysis.value.odds.drawProbability;
  return 25;
});

const winProbAway = computed(() => {
  if (analysis.value?.currentWinProbability) return analysis.value.currentWinProbability.away;
  if (analysis.value?.odds?.awayWinProbability) return analysis.value.odds.awayWinProbability;
  return 30;
});

function formatMoneyLine(val?: number): string {
  if (val === undefined || val === null) return '-';
  return val > 0 ? `+${val}` : `${val}`;
}

function parseFormArray(formStr?: string): string[] {
  if (!formStr) return [];
  if (formStr.includes(',')) return formStr.split(',');
  return formStr.split('').slice(-5);
}

function getFormDotClass(form?: string): string {
  const f = (form || '').toUpperCase();
  if (f === 'W' || f === 'V') return 'form-win';
  if (f === 'D' || f === 'N') return 'form-draw';
  if (f === 'L') return 'form-loss';
  return 'form-draw';
}

function formatH2HDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso;
  }
}

function formatStartTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatKickoffDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push({ name: 'matches' });
}

async function shareMatch() {
  const url = window.location.href;
  try {
    if (navigator.share) await navigator.share({ title: match.value?.title, url });
    else await navigator.clipboard?.writeText(url);
  } catch {}
}
</script>

<style scoped>
.max-w-900 {
  max-width: 900px;
  margin: 0 auto;
}

.score-team-name {
  max-width: 100%;
  width: 100%;
}

.league-header {
  max-width: 100%;
  min-width: 0;
}

.match-tabs :deep(.v-tab) {
  min-width: 0;
  padding-inline: 10px;
}

.h2h-date {
  min-width: 80px;
}

.h2h-team {
  width: 140px;
}

@media (max-width: 600px) {
  .match-tabs :deep(.v-tab) {
    padding-inline: 3px;
    font-size: 11px;
    letter-spacing: 0;
  }

  .match-score-card :deep(.text-h4),
  .match-score-card :deep(.text-h5) {
    line-height: 1;
  }

  .h2h-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .h2h-date {
    min-width: 0;
    width: 100%;
    text-align: center;
  }

  .h2h-main {
    width: 100%;
  }

  .h2h-team {
    width: auto;
    flex: 1 1 0;
    font-size: 11px;
  }
}



.border-t-dark {
  border-top: 1px solid #1a1824;
}

.border-dark {
  border: 1px solid #1a1824;
}

.jersey-num {
  width: 20px;
  text-align: center;
  display: inline-block;
}

.font-mono {
  font-family: monospace;
}

.video-container {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #0b0a10;
  border: 1px solid #1a1824;
}

.video-iframe,
.video-element {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* Probabilités & Cotes */
.prob-bar-container {
  height: 10px;
  width: 100%;
  background-color: #181622;
}

.prob-segment {
  height: 100%;
  transition: width 0.3s ease;
}

.odd-box {
  background-color: #161420;
}

.form-team-card {
  background-color: #14131d;
}

.form-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 900;
  color: #ffffff;
}

.form-dot-mini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 900;
  color: #ffffff;
}

.form-win {
  background-color: #10b981;
}

.form-draw {
  background-color: #6b7280;
}

.form-loss {
  background-color: #ef4444;
}

.recent-match-row {
  background-color: #191724;
}

.h2h-row {
  background-color: #161420;
}

.comm-item {
  background-color: #161420;
}

.commentary-scroll-box {
  max-height: 380px;
  overflow-y: auto;
}

.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.gap-5 { gap: 20px; }
.gap-6 { gap: 24px; }

/* ─── Styles SSE Flux direct ─── */
.sse-badge {
  font-size: 11px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  user-select: none;
}

.sse-connected {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.25);
  color: #4ade80;
}

.sse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.sse-connected .sse-dot {
  background-color: #22c55e;
}

.pulse-dot {
  animation: ssePulse 1.8s infinite;
}

@keyframes ssePulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}
</style>

