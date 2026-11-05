<template>
  <v-container class="pa-2 pa-sm-6 max-w-900 position-relative">
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
          <TeamLogo :src="match.league.logo || undefined" :name="match.league.name" :size="24" fallback-icon="mdi-trophy-outline" />
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
      <div class="match-detail-tabs">
        <v-tabs v-model="activeTab" grow :scroll-to-active="false" color="primary" bg-color="transparent" class="match-tabs">
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
          <v-tab value="table" class="font-weight-bold">
            <span class="d-none d-sm-inline">Table</span>
            <span class="d-sm-none">Table</span>
          </v-tab>
          <v-tab value="recent" class="font-weight-bold">
            <span class="d-none d-sm-inline">Récent</span>
            <span class="d-sm-none">Récent</span>
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="pa-2 pa-sm-6">
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

          <!-- ── TAB 4 : Table (Classement de la compétition) ── -->
          <v-window-item value="table">
            <div v-if="isLoadingStandings" class="text-center py-12">
              <v-progress-circular indeterminate color="primary" size="44" />
              <div class="text-caption text-zinc-400 mt-3">Chargement du classement...</div>
            </div>

            <div v-else-if="!standings || standings.length === 0" class="text-center py-12 text-zinc-400">
              Aucun classement disponible pour cette compétition.
            </div>

            <div v-else class="standings-wrap">
              <div v-for="group in standings" :key="group.id" class="standings-group">
                <div v-if="standings.length > 1" class="group-title">{{ group.name }}</div>
                <table class="standings-table w-100">
                  <thead>
                    <tr class="table-head-row text-[11px] text-zinc-400 text-uppercase">
                      <th class="text-center py-2 px-2" style="width: 40px;">#</th>
                      <th class="text-left py-2 px-2">Équipe</th>
                      <th class="text-center py-2 px-1" style="width: 40px;">J</th>
                      <th class="text-center py-2 px-1 d-none d-sm-table-cell" style="width: 40px;">G</th>
                      <th class="text-center py-2 px-1 d-none d-sm-table-cell" style="width: 40px;">N</th>
                      <th class="text-center py-2 px-1 d-none d-sm-table-cell" style="width: 40px;">P</th>
                      <th class="text-center py-2 px-1" style="width: 48px;">Diff</th>
                      <th class="text-center py-2 px-2 font-weight-black text-white" style="width: 50px;">Pts</th>
                    </tr>
                  </thead>
                  <tbody class="divide-dark">
                    <tr
                      v-for="entry in group.entries"
                      :key="entry.team.id"
                      class="table-body-row"
                      :class="{ 'is-match-team': entry.team.id === match.homeTeam.id || entry.team.id === match.awayTeam.id }"
                    >
                      <td class="text-center py-2 px-2 font-mono font-weight-bold text-caption text-zinc-300 position-relative">
                        <span
                          class="rank-indicator-strip"
                          :style="{ backgroundColor: getRankColor(entry.rank) }"
                          aria-hidden="true"
                        />
                        {{ entry.rank }}
                      </td>
                      <td class="py-2 px-2">
                        <div class="d-flex align-center gap-2 min-w-0">
                          <TeamLogo :src="entry.team.logo" :name="entry.team.name" :size="24" class="flex-shrink-0" />
                          <span class="text-body-2 font-weight-bold text-white text-truncate">{{ entry.team.name }}</span>
                        </div>
                      </td>
                      <td class="text-center py-2 px-1 font-mono text-caption text-zinc-300">{{ entry.gamesPlayed }}</td>
                      <td class="text-center py-2 px-1 font-mono text-caption text-zinc-300 d-none d-sm-table-cell">{{ entry.wins }}</td>
                      <td class="text-center py-2 px-1 font-mono text-caption text-zinc-400 d-none d-sm-table-cell">{{ entry.ties }}</td>
                      <td class="text-center py-2 px-1 font-mono text-caption text-zinc-400 d-none d-sm-table-cell">{{ entry.losses }}</td>
                      <td class="text-center py-2 px-1 font-mono text-caption" :class="entry.goalDifference > 0 ? 'text-emerald-400' : entry.goalDifference < 0 ? 'text-red-400' : 'text-zinc-400'">
                        {{ entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference }}
                      </td>
                      <td class="text-center py-2 px-2 font-mono font-weight-black text-white">{{ entry.points }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </v-window-item>

          <!-- ── TAB 5 : Récent (Matchs récents des 2 équipes) ── -->
          <v-window-item value="recent">
            <div v-if="isLoadingAnalysis" class="text-center py-12">
              <v-progress-circular indeterminate color="primary" size="44" />
              <div class="text-caption text-zinc-400 mt-3">Chargement des matchs récents...</div>
            </div>

            <div v-else-if="!analysis" class="text-center py-12 text-zinc-400">
              Aucune donnée de matchs récents disponible.
            </div>

            <div v-else class="recent-wrap">
              <!-- Sélecteur d'équipe -->
              <div class="recent-team-selector">
                <button
                  class="team-sel-btn"
                  :class="{ 'is-active': recentTab === 'h2h' }"
                  @click="recentTab = 'h2h'"
                >
                  H2H
                </button>
                <button
                  class="team-sel-btn"
                  :class="{ 'is-active': recentTab === 'home' }"
                  @click="recentTab = 'home'"
                >
                  <TeamLogo :src="match.homeTeam.logo" :name="match.homeTeam.name" :size="18" />
                  <span class="text-truncate">{{ match.homeTeam.shortName || match.homeTeam.name }}</span>
                </button>
                <button
                  class="team-sel-btn"
                  :class="{ 'is-active': recentTab === 'away' }"
                  @click="recentTab = 'away'"
                >
                  <TeamLogo :src="match.awayTeam.logo" :name="match.awayTeam.name" :size="18" />
                  <span class="text-truncate">{{ match.awayTeam.shortName || match.awayTeam.name }}</span>
                </button>
              </div>

              <!-- H2H : Confrontations directes -->
              <div v-if="recentTab === 'h2h'" class="recent-section">
                <div v-if="!analysis.headToHead || analysis.headToHead.length === 0" class="text-center py-8 text-zinc-400">
                  Aucune confrontation directe récente.
                </div>
                <div v-else>
                  <div class="h2h-summary">
                    <div class="h2h-side">
                      <strong>{{ h2hSummary.homeWins }}</strong>
                      <small>{{ match.homeTeam.shortName || match.homeTeam.name }}</small>
                    </div>
                    <div class="h2h-side h2h-draws">
                      <strong>{{ h2hSummary.draws }}</strong>
                      <small>Nuls</small>
                    </div>
                    <div class="h2h-side h2h-side-away">
                      <strong>{{ h2hSummary.awayWins }}</strong>
                      <small>{{ match.awayTeam.shortName || match.awayTeam.name }}</small>
                    </div>
                  </div>
                  <div class="h2h-bar">
                    <span class="h2h-seg h2h-seg-home" :style="{ width: `${h2hPct.home}%` }" />
                    <span class="h2h-seg h2h-seg-draw" :style="{ width: `${h2hPct.draw}%` }" />
                    <span class="h2h-seg h2h-seg-away" :style="{ width: `${h2hPct.away}%` }" />
                  </div>
                  <div class="d-flex flex-column gap-2">
                    <MatchCard
                      v-for="(sm, i) in h2hCards"
                      :key="sm.id || `h2h-${i}`"
                      :match="sm"
                      :is-favorite="store.isFavorite(sm.id)"
                      @select="openFromRecent"
                      @toggle-favorite="store.toggleFavorite"
                    />
                  </div>
                </div>
              </div>

              <!-- Équipe sélectionnée : matchs récents -->
              <div v-else class="recent-section">
                <div v-if="!selectedRecentForm || !selectedRecentForm.matches || selectedRecentForm.matches.length === 0" class="text-center py-8 text-zinc-400">
                  Aucun match récent disponible.
                </div>
                <div v-else>
                  <div class="recent-team-head">
                    <TeamLogo :src="selectedRecentForm.teamId === match.homeTeam.id ? match.homeTeam.logo : match.awayTeam.logo" :name="selectedRecentForm.teamName" :size="28" />
                    <span class="recent-team-name">{{ selectedRecentForm.teamName }}</span>
                    <div class="form-badges">
                      <span
                        v-for="(f, fIdx) in parseFormArray(selectedRecentForm.form)"
                        :key="fIdx"
                        class="form-badge"
                        :class="getFormDotClass(f)"
                      >{{ f }}</span>
                    </div>
                  </div>
                  <div class="d-flex flex-column gap-2">
                    <MatchCard
                      v-for="(sm, i) in recentFormCards"
                      :key="sm.id || `form-${i}`"
                      :match="sm"
                      :is-favorite="store.isFavorite(sm.id)"
                      @select="openFromRecent"
                      @toggle-favorite="store.toggleFavorite"
                    />
                  </div>
                </div>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </div>
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
  fetchStandings,
} from '../services/api';
import type { SportMatch, MatchSummary, DetailedMatchAnalysis, StandingGroup } from '../types/matches';
import TeamLogo from '../components/TeamLogo.vue';
import MatchCard from '../components/MatchCard.vue';
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
const standings = ref<StandingGroup[] | null>(null);
const standingsLoaded = ref(false);
const recentTab = ref<'h2h' | 'home' | 'away'>('h2h');
const isLoading = ref(true);
const isLoadingAnalysis = ref(false);
const isLoadingStandings = ref(false);
const activeTab = ref<'stream' | 'summary' | 'stats' | 'lineups' | 'table' | 'recent'>('summary');

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

async function loadStandings() {
  if (standingsLoaded.value) return;
  const candidates = [
    summary.value?.league?.slug,
    summary.value?.league?.id,
    match.value?.league?.id,
    match.value?.league?.slug,
    leagueParam.value,
  ].filter((v): v is string => Boolean(v) && v !== 'all' && v !== 'football');
  if (candidates.length === 0) return;

  isLoadingStandings.value = true;
  try {
    let result: StandingGroup[] = [];
    for (const id of [...new Set(candidates)]) {
      const res = await fetchStandings(id);
      if (res && res.length > 0) {
        result = res;
        break;
      }
    }
    standings.value = result;
    standingsLoaded.value = true;
  } catch (err) {
    console.warn('[MatchDetailView] Erreur de chargement classement:', err);
    standings.value = [];
    standingsLoaded.value = true;
  } finally {
    isLoadingStandings.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'recent' && !analysis.value) {
    loadAnalysis();
  }
  if (tab === 'table' && !standingsLoaded.value) {
    loadStandings();
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
  standings.value = null;
  standingsLoaded.value = false;
  recentTab.value = 'h2h';
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

    // L'onglet demandé dans l'URL est prioritaire (même pour un match en direct)
    const requestedTab = String(route.query.tab || '');
    if (requestedTab === 'stream' || requestedTab === 'recent' || requestedTab === 'table') {
      activeTab.value = requestedTab as typeof activeTab.value;
      if (requestedTab === 'recent') loadAnalysis();
      if (requestedTab === 'table') loadStandings();
    } else if (['summary', 'stats', 'lineups'].includes(requestedTab)) {
      activeTab.value = requestedTab as typeof activeTab.value;
    } else if (match.value?.status === 'live') {
      activeTab.value = 'stream';
    }
  } catch (err) {
    console.error('[MatchDetailView] Error:', err);
  } finally {
    isLoading.value = false;
  }

  // Préchargement en arrière-plan : l'onglet Table s'affiche instantanément
  if (!standingsLoaded.value && !isLoadingStandings.value) loadStandings();
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
const selectedRecentForm = computed(() => {
  if (!analysis.value?.recentForm || !match.value) return null;
  const wantedId = recentTab.value === 'home' ? match.value.homeTeam.id : match.value.awayTeam.id;
  return analysis.value.recentForm.find((t) => t.teamId === wantedId) || null;
});

function getRankColor(rank: number): string {
  if (rank <= 4) return '#3b82f6';
  if (rank === 5) return '#f97316';
  if (rank === 6) return '#10b981';
  if (rank >= 18) return '#ef4444';
  return 'transparent';
}

const h2hSummary = computed(() => {
  const list = analysis.value?.headToHead || [];
  const homeId = match.value?.homeTeam.id;
  const awayId = match.value?.awayTeam.id;
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  for (const h2h of list) {
    if (h2h.winnerId && h2h.winnerId === homeId) homeWins += 1;
    else if (h2h.winnerId && h2h.winnerId === awayId) awayWins += 1;
    else draws += 1;
  }

  return { total: list.length, homeWins, awayWins, draws };
});

const h2hPct = computed(() => {
  const { total, homeWins, awayWins, draws } = h2hSummary.value;
  if (!total) return { home: 0, draw: 0, away: 0 };
  return {
    home: Math.round((homeWins / total) * 100),
    draw: Math.round((draws / total) * 100),
    away: Math.round((awayWins / total) * 100),
  };
});

// ─── Onglet Récent : conversion vers des cartes de match standardisées ───
const h2hCards = computed<SportMatch[]>(() => {
  const cur = match.value;
  if (!cur || !analysis.value?.headToHead?.length) return [];
  return analysis.value.headToHead.map((h) => ({
    id: h.id,
    title: `${h.homeTeam.name} vs ${h.awayTeam.name}`,
    homeTeam: {
      id: h.homeTeam.id,
      name: h.homeTeam.name,
      logo: h.homeTeam.logo,
      score: h.homeTeam.score,
      isWinner: Boolean(h.winnerId) && h.winnerId === h.homeTeam.id,
    },
    awayTeam: {
      id: h.awayTeam.id,
      name: h.awayTeam.name,
      logo: h.awayTeam.logo,
      score: h.awayTeam.score,
      isWinner: Boolean(h.winnerId) && h.winnerId === h.awayTeam.id,
    },
    status: 'finished',
    startTime: h.date,
    startTimestamp: new Date(h.date).getTime() || Date.now(),
    league: { ...cur.league, name: h.competition || cur.league.name },
    sport: 'football',
  }));
});

const recentFormCards = computed<SportMatch[]>(() => {
  const cur = match.value;
  const form = selectedRecentForm.value;
  if (!cur || !form?.matches?.length) return [];
  const teamIsHome = form.teamId === cur.homeTeam.id;
  const teamLogo = teamIsHome ? cur.homeTeam.logo : cur.awayTeam.logo;
  const teamId = form.teamId || (teamIsHome ? cur.homeTeam.id : cur.awayTeam.id);

  return form.matches.map((m, idx) => {
    const [teamRaw, oppRaw] = (m.score || '0-0').split('-');
    const teamScore = Number(teamRaw) || 0;
    const oppScore = Number(oppRaw) || 0;
    const team = { id: teamId, name: form.teamName, logo: teamLogo };
    const opp = { id: `opp-${idx}`, name: m.opponentName, logo: m.opponentLogo };

    const homeTeam = m.isHome
      ? { ...team, score: teamScore, isWinner: m.result === 'W' }
      : { ...opp, score: oppScore, isWinner: m.result === 'L' };
    const awayTeam = m.isHome
      ? { ...opp, score: oppScore, isWinner: m.result === 'L' }
      : { ...team, score: teamScore, isWinner: m.result === 'W' };

    return {
      id: m.id,
      title: `${homeTeam.name} vs ${awayTeam.name}`,
      homeTeam,
      awayTeam,
      status: 'finished' as const,
      startTime: m.date,
      startTimestamp: new Date(m.date).getTime() || Date.now(),
      league: { ...cur.league, name: m.competition || cur.league.name },
      sport: 'football' as const,
    };
  });
});

function openFromRecent(sm: SportMatch) {
  if (!sm.id) return;
  router.push({
    name: 'match-detail',
    params: { id: sm.id },
    query: { league: sm.league.slug || sm.league.id || 'all' },
  });
}

function parseFormArray(formStr?: string): string[] {
  if (!formStr) return [];
  if (formStr.includes(',')) return formStr.split(',').filter(Boolean).slice(-5);
  return formStr.split('').slice(-5);
}

function getFormDotClass(form?: string): string {
  const f = (form || '').toUpperCase();
  if (f === 'W' || f === 'V') return 'form-win';
  if (f === 'D' || f === 'N') return 'form-draw';
  if (f === 'L') return 'form-loss';
  return 'form-draw';
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
}



.border-t-dark {
  border-top: 1px solid #333333;
}

.border-dark {
  border: 1px solid #333333;
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
  background-color: #1F1F1F;
  border: 1px solid #333333;
}

.video-iframe,
.video-element {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* ─── Table (Classement) ─── */
.standings-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.standings-group {
  border: 1px solid #333333;
  border-radius: 14px;
  overflow: hidden;
  background: #1f1f1f;
}

.group-title {
  padding: 10px 14px 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a1a1aa;
  background: #262626;
  border-bottom: 1px solid #333333;
}

.standings-table {
  border-collapse: collapse;
  width: 100%;
}

.table-head-row {
  background: #262626;
  border-bottom: 1px solid #333333;
}

.table-head-row th {
  font-weight: 700;
  color: #8a8a93;
}

.table-body-row {
  border-bottom: 1px solid #2c2c2c;
}

.table-body-row:last-child {
  border-bottom: none;
}

.table-body-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.table-body-row.is-match-team {
  background: rgba(229, 9, 20, 0.08);
}

.rank-indicator-strip {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  border-radius: 0 3px 3px 0;
}

.divide-dark > *:not(:last-child) {
  border-bottom: 1px solid #2c2c2c;
}

/* ─── Récent (matchs récents / H2H) ─── */
.recent-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recent-team-selector {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: #1f1f1f;
  border: 1px solid #333333;
}

.team-sel-btn {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #a1a1aa;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.team-sel-btn span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-sel-btn.is-active {
  background: #333333;
  color: #fafafa;
}

.recent-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-team-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #262626;
  border: 1px solid #333333;
}

.recent-team-name {
  font-size: 13px;
  font-weight: 800;
  color: #fafafa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 0;
  min-width: 0;
}

.form-badges {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.form-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 900;
  color: #ffffff;
}

.form-win { background-color: #10b981; }
.form-draw { background-color: #6b7280; }
.form-loss { background-color: #ef4444; }

/* Confrontations directes */
.h2h-summary {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #1f1f1f;
  border: 1px solid #333333;
}

.h2h-side {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.h2h-side strong {
  font-size: 20px;
  font-weight: 800;
  color: #e50914;
  line-height: 1;
}

.h2h-side small {
  font-size: 10px;
  color: #8a8a93;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.h2h-draws {
  align-items: center;
}

.h2h-draws strong {
  color: #d4d4d8;
}

.h2h-side-away {
  align-items: flex-end;
  text-align: right;
}

.h2h-side-away strong {
  color: #3b82f6;
}

.h2h-bar {
  display: flex;
  height: 7px;
  margin: 10px 0 4px;
  border-radius: 999px;
  overflow: hidden;
  background: #1a1a1a;
}

.h2h-seg {
  height: 100%;
}

.h2h-seg-home { background: #e50914; }
.h2h-seg-draw { background: #5c5c66; }
.h2h-seg-away { background: #3b82f6; }

@media (max-width: 600px) {
  .team-sel-btn {
    font-size: 11px;
    padding: 7px 6px;
  }
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

