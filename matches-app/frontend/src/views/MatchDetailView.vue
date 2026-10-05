<template>
  <v-container class="pa-4 pa-sm-6 max-w-900 position-relative">
    <!-- Notification flottante en cas de but en direct (SSE) -->
    <GoalNotificationBanner :alert="store.activeGoalAlert" @close="store.dismissGoalAlert" />

    <!-- Top Action Bar -->
    <div class="d-flex align-center justify-space-between mb-4">
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
      <v-card color="surface" rounded="xl" class="pa-5 position-relative overflow-hidden" elevation="0">
        <!-- Liseré vertical rouge gauche -->
        <span
          class="position-absolute"
          style="top: 0; bottom: 0; left: 0; width: 5px; background-color: #E50914;"
          aria-hidden="true"
        />

        <!-- En-tête Ligue (Cliquable pour ouvrir la page compétition) -->
        <div
          class="d-flex align-center justify-center gap-2 mb-4 text-center cursor-pointer hover:opacity-80 transition-opacity"
          title="Voir les détails de la compétition"
          @click="router.push(`/competition/${encodeURIComponent(match.league.id || match.league.slug || 'eng.1')}`)"
        >
          <TeamLogo :src="match.league.logo || undefined" :name="match.league.name" :size="20" />
          <span class="text-caption font-weight-bold text-grey-lighten-1 text-uppercase tracking-wider">
            {{ match.league.name }}
          </span>
          <v-icon size="14" color="grey">mdi-chevron-right</v-icon>
        </div>

        <v-row align="center" justify="center" class="text-center my-1">
          <!-- Domicile -->
          <v-col cols="4" class="d-flex flex-column align-center">
            <TeamLogo :src="match.homeTeam.logo" :name="match.homeTeam.name" :size="64" class="mb-2" />
            <span class="text-subtitle-2 font-weight-bold text-white text-truncate" style="max-width: 140px;">
              {{ match.homeTeam.name }}
            </span>
          </v-col>

          <!-- Score / Heure & Statut central -->
          <v-col cols="4" class="d-flex flex-column align-center justify-center">
            <div
              v-if="match.status === 'live' || match.status === 'finished'"
              class="text-h3 font-weight-black font-mono text-white tracking-tight leading-none"
            >
              <span>{{ match.homeTeam.score ?? 0 }}</span>
              <span class="text-grey mx-2">–</span>
              <span>{{ match.awayTeam.score ?? 0 }}</span>
            </div>
            <div v-else class="text-h4 font-weight-bold font-mono text-white">
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

            <div v-if="match.venue" class="text-caption text-grey mt-2 text-truncate" style="max-width: 180px;">
              <v-icon size="12" class="mr-1">mdi-stadium</v-icon>
              {{ match.venue.split('(')[0]?.trim() }}
            </div>
          </v-col>

          <!-- Extérieur -->
          <v-col cols="4" class="d-flex flex-column align-center">
            <TeamLogo :src="match.awayTeam.logo" :name="match.awayTeam.name" :size="64" class="mb-2" />
            <span class="text-subtitle-2 font-weight-bold text-white text-truncate" style="max-width: 140px;">
              {{ match.awayTeam.name }}
            </span>
          </v-col>
        </v-row>
      </v-card>

      <!-- ─── 2. Onglets de Détails (Flux, Résumé, Stats, Compos) ─── -->
      <v-card class="rounded-2xl overflow-hidden" color="surface">
        <v-tabs v-model="activeTab" grow color="primary" bg-color="surface">
          <v-tab value="stream" class="font-weight-bold">
            <v-icon start size="16" color="error">mdi-record</v-icon>
            Direct Flux
          </v-tab>
          <v-tab value="summary" class="font-weight-bold">Résumé</v-tab>
          <v-tab value="stats" class="font-weight-bold">Statistiques</v-tab>
          <v-tab value="lineups" class="font-weight-bold">Compositions</v-tab>
          <v-tab value="analysis" class="font-weight-bold">
            <v-icon start size="16" color="primary">mdi-chart-timeline-variant</v-icon>
            Analyse & Cotes
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="pa-4 pa-sm-6">
          <!-- ── TAB 0 : Flux Direct ── -->
          <v-window-item value="stream">
            <div v-if="isStreamLoading" class="text-center py-12">
              <v-progress-circular indeterminate color="primary" size="44" />
              <div class="text-caption text-zinc-400 mt-3">
                Résolution instantanée du flux direct (0 Playwright)...
              </div>
            </div>

            <div v-else-if="selectedServerUrl">
              <!-- En-tête des serveurs -->
              <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-4">
                <div class="d-flex align-center gap-2">
                  <v-icon size="18" color="error">mdi-television-play</v-icon>
                  <span class="text-subtitle-2 font-weight-bold text-white">Serveurs disponibles :</span>
                  <v-chip-group v-model="activeServerIndex" mandatory selected-class="text-primary font-weight-bold">
                    <v-chip
                      v-for="(server, idx) in streamData?.servers"
                      :key="server.name || idx"
                      :value="idx"
                      size="small"
                      variant="tonal"
                      @click="selectServer(server, idx)"
                    >
                      {{ server.name }}
                    </v-chip>
                  </v-chip-group>
                </div>

                <v-btn
                  variant="text"
                  size="small"
                  prepend-icon="mdi-refresh"
                  color="zinc-400"
                  @click="loadStream(true)"
                >
                  Rafraîchir
                </v-btn>
              </div>

              <!-- Conteneur Vidéo 16:9 -->
              <div class="video-container rounded-xl overflow-hidden position-relative">
                <iframe
                  v-if="selectedServerType === 'iframe'"
                  :src="selectedServerUrl"
                  class="video-iframe"
                  allowfullscreen
                  allow="autoplay; encrypted-media; picture-in-picture"
                  frameborder="0"
                ></iframe>
                <HlsVideo
                  v-else
                  class="video-element"
                  :src="selectedServerUrl"
                  :fallback-src="selectedServerFallbackUrl"
                />
              </div>

              <div class="d-flex align-center justify-space-between mt-3 text-caption text-zinc-400">
                <span class="d-flex align-center">
                  <v-icon size="14" color="success" class="mr-1">mdi-lightning-bolt</v-icon>
                  Flux résolu via Direct API en 150ms
                </span>
                <a
                  v-if="selectedServerType === 'iframe'"
                  :href="selectedServerUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-primary text-decoration-none font-weight-bold"
                >
                  Ouvrir le lecteur externe
                  <v-icon size="14" end>mdi-open-in-new</v-icon>
                </a>
              </div>
            </div>

            <!-- Aucun flux disponible -->
            <div v-else class="text-center py-12">
              <v-avatar color="surface-variant" size="56" class="mb-3">
                <v-icon size="28" color="zinc-400">mdi-television-off</v-icon>
              </v-avatar>
              <div class="text-subtitle-1 font-weight-bold text-white">Aucun flux vidéo direct pour l'instant</div>
              <div class="text-caption text-zinc-400 mt-1" style="max-width: 440px; margin: 0 auto;">
                Les flux en direct sont activés automatiquement par nos résolveurs 10 à 15 minutes avant le début du match.
              </div>
              <v-btn
                color="primary"
                variant="tonal"
                class="mt-4 font-weight-bold"
                prepend-icon="mdi-refresh"
                size="small"
                @click="loadStream(true)"
              >
                Vérifier à nouveau
              </v-btn>
            </div>
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
                <div class="d-flex align-center justify-space-between mb-4">
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
                <div class="d-flex align-center justify-space-between mb-4">
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

                <div v-if="analysis.odds.overUnder || analysis.odds.spread" class="d-flex justify-space-around mt-4 pt-3 border-t-dark text-caption">
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
                    <div class="text-caption text-zinc-400 font-mono" style="min-width: 80px;">
                      {{ formatH2HDate(h2h.date) }}
                    </div>

                    <div class="d-flex align-center gap-3 flex-1 justify-center">
                      <span class="text-caption font-weight-bold text-white text-right" style="width: 140px;">
                        {{ h2h.homeTeam.name }}
                      </span>
                      <div class="h2h-score font-mono font-weight-black text-white px-2 py-1 rounded bg-surface">
                        {{ h2h.homeTeam.score }} - {{ h2h.awayTeam.score }}
                      </div>
                      <span class="text-caption font-weight-bold text-white text-left" style="width: 140px;">
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
import { useMatchesStore } from '../stores/matches';
import { useLiveMinute } from '../composables/useLiveMinute';
import { liveSseClient } from '../services/sse.service';
import {
  fetchMatchById,
  fetchMatchSummary,
  fetchMatchStream,
  fetchMatchAnalysis,
  absoluteApiUrl,
  type StreamResolution,
} from '../services/api';
import type { SportMatch, MatchSummary, DetailedMatchAnalysis } from '../types/matches';
import TeamLogo from '../components/TeamLogo.vue';
import HlsVideo from '../components/HlsVideo.vue';
import GoalNotificationBanner from '../components/GoalNotificationBanner.vue';
import LineUp from '../components/detail_matche/LineUp.vue';
import MatchStats from '../components/detail_matche/MatchStats.vue';
import MatchSummaryPanel from '../components/detail_matche/MatchSummary.vue';

const route = useRoute();
const router = useRouter();
const store = useMatchesStore();

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

// Flux Vidéo Direct
const streamData = ref<StreamResolution | null>(null);
const isStreamLoading = ref(false);
/** URL réellement jouée (relay HLS quand il existe, sinon le flux distant). */
const selectedServerUrl = ref<string>('');
/** URL d'origine, repassée au player si le relay échoue. */
const selectedServerFallbackUrl = ref<string | null>(null);
const selectedServerType = ref<'hls' | 'iframe'>('iframe');
const activeServerIndex = ref(0);

async function loadStream(force = false) {
  if (streamData.value && !force && selectedServerUrl.value) return;
  isStreamLoading.value = true;
  try {
    const res = await fetchMatchStream(
      matchId.value,
      match.value?.homeTeam?.name,
      match.value?.awayTeam?.name
    );
    streamData.value = res;
    if (res && res.servers && res.servers.length > 0) {
      selectServer(res.servers[0], 0);
    } else if (res?.url) {
      applyServer({ url: res.url, type: res.type, relayUrl: res.relayUrl });
    } else {
      clearServer();
    }
  } catch (err) {
    console.warn('[MatchDetailView] Erreur de chargement du flux:', err);
    clearServer();
  } finally {
    isStreamLoading.value = false;
  }
}

/** Privilégie le relay backend (referer/IP côté serveur) pour les flux HLS. */
function applyServer(server: { url: string; type?: 'hls' | 'iframe'; relayUrl?: string }) {
  selectedServerType.value = server.type || 'iframe';
  const relay = server.type === 'hls' ? absoluteApiUrl(server.relayUrl) : undefined;
  if (relay && relay !== server.url) {
    selectedServerUrl.value = relay;
    selectedServerFallbackUrl.value = server.url;
  } else {
    selectedServerUrl.value = server.url;
    selectedServerFallbackUrl.value = null;
  }
}

function clearServer() {
  selectedServerUrl.value = '';
  selectedServerFallbackUrl.value = null;
  selectedServerType.value = 'iframe';
}

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

function selectServer(server: { url: string; type?: 'hls' | 'iframe'; relayUrl?: string }, idx?: number) {
  applyServer(server);
  if (typeof idx === 'number') activeServerIndex.value = idx;
}

watch(activeTab, (tab) => {
  if (tab === 'stream' && !streamData.value) {
    loadStream();
  } else if (tab === 'analysis' && !analysis.value) {
    loadAnalysis();
  }
});

async function loadMatchData() {
  console.log('[DEBUG] loadMatchData start', matchId.value, new Error().stack);
  if (!matchId.value) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  match.value = null;
  summary.value = null;
  analysis.value = null;
  streamData.value = null;
  clearServer();
  activeServerIndex.value = 0;
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
      loadStream();
    } else if (route.query.tab === 'analysis') {
      activeTab.value = 'analysis';
    } else if (route.query.tab && ['summary', 'stats', 'lineups'].includes(String(route.query.tab))) {
      activeTab.value = route.query.tab as typeof activeTab.value;
    }
  } catch (err) {
    console.error('[MatchDetailView] Error:', err);
  } finally {
    console.log('[DEBUG] loadMatchData end, isLoading=', isLoading.value, 'match=', match.value?.title);
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

