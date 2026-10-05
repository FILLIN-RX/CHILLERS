<template>
  <v-container fluid class="pa-3 pa-sm-5 max-w-matches position-relative">

    <!-- ─── Tiroir mobile (menu ☰) : mêmes championnats que la colonne de gauche ─── -->
    <v-navigation-drawer
      v-model="ui.navDrawer"
      temporary
      location="left"
      width="316"
      color="surface"
      class="d-lg-none"
    >
      <LeagueSidebar @open-standings="openStandingsFromDrawer" />
    </v-navigation-drawer>
    <!-- ─── Bannières des 5 Grands Championnats ─── -->
    <v-row class="mb-4">
      <v-col cols="12">
        <FiveLeague @select="handleLeagueSelect" />
      </v-col>
    </v-row>
    <v-row>
      <!-- ─── Sidebar Gauche (Desktop) : Championnats ─── -->
      <v-col cols="12" lg="4" xl="4" class="d-none d-lg-block">
        <LeagueSidebar @open-standings="openStandings" />
      </v-col>

            <!-- ─── Contenu Principal ─── -->
      <v-col cols="12" lg="8" xl="8">
        <div class="d-flex flex-column gap-5">
          <!-- 1. Calendrier (sélecteur de date) -->
          <CalendarStrip
            :selected-date="selectedDate"
            :direct-active="statusFilter === 'live'"
            @update:selected-date="onDateChange"
            @direct="statusFilter = 'live'"
          />

          <!-- 2. Filtres (statut de la rencontre) -->
          <div class="d-flex flex-column flex-sm-row gap-3 align-stretch align-sm-center">
            <!-- Boutons de filtre (Tous, En direct, Favoris) -->
            <v-btn-toggle
              v-model="statusFilter"
              mandatory
              density="compact"
              color="primary"
              variant="flat"
              class="rounded-xl bg-surface"
            >
              <v-btn value="all" size="small" class="font-weight-bold">Tous</v-btn>
              <v-btn value="live" size="small" class="font-weight-bold" :color="liveCount > 0 ? 'error' : undefined">
                En direct {{ liveCount > 0 ? `(${liveCount})` : '' }}
              </v-btn>
              <v-btn value="favorites" size="small" class="font-weight-bold">
                <v-icon start size="14">mdi-star</v-icon> Favoris
              </v-btn>
            </v-btn-toggle>
          </div>


          <!-- 3. Liste des Matchs par Compétition & Poules -->
          <div v-if="isLoading" class="d-flex flex-column gap-4 py-8">
            <v-skeleton-loader
              v-for="i in 3"
              :key="i"
              type="card"
              color="surface"
              class="rounded-2xl"
            />
          </div>

          <div v-else-if="displayedCompetitionSections.length === 0" class="text-center py-16">
            <v-avatar color="surface-variant" size="64" class="mb-4">
              <v-icon size="32" color="zinc-500">mdi-trophy-outline</v-icon>
            </v-avatar>
            <div class="text-h6 font-weight-bold text-white">Aucun match trouvé</div>
            <div class="text-caption text-zinc-400 mt-1">
              {{ statusFilter === 'favorites' ? 'Vous n\'avez aucun match favori.' : 'Pas de match pour cette sélection.' }}
            </div>
            <v-btn
              color="primary"
              class="mt-4 font-weight-bold"
              @click="resetFilters"
            >
              Réinitialiser les filtres
            </v-btn>
          </div>

          <div v-else class="d-flex flex-column gap-6">
            <!-- ─── LES COMPÉTITIONS SERVENT DIRECTEMENT D'EN-TÊTES PRINCIPAUX ─── -->
            <div
              v-for="compSection in displayedCompetitionSections"
              :id="`competition-${compSection.id}`"
              :key="compSection.id"
              class="competition-block d-flex flex-column gap-2"
            >
              <!-- En-tête de Compétition Principal -->
              <div
                class="competition-header d-flex align-center justify-space-between px-1 py-2 cursor-pointer"
                @click="toggleCollapse(compSection.id)"
              >
                <div class="d-flex align-center gap-3 min-w-0">
                  <TeamLogo
                    :src="compSection.league.logo || undefined"
                    :flag="compSection.flag"
                    :name="compSection.league.name"
                    :size="24"
                    class="flex-shrink-0"
                  />
                  <div class="min-w-0">
                    <div class="d-flex align-center flex-wrap gap-2">
                      <span class="text-subtitle-2 text-white text-truncate font-normal">
                        {{ compSection.league.name }}<template v-if="compSection.stageName"><span class="text-zinc-400"> - {{ compSection.stageName }}</span></template>
                      </span>

                      <!-- Badge Euro & International -->
                      <v-chip
                        v-if="compSection.isEuroOrIntl"
                        size="x-small"
                        color="#3b82f6"
                        variant="flat"
                        class="text-[10px] px-1-5"
                      >
                        <v-icon start size="11">mdi-earth</v-icon>
                        {{ compSection.badgeLabel || 'EURO' }}
                      </v-chip>

                      <!-- Badge Deuxième Division / Liga 2 -->
                      <v-chip
                        v-if="compSection.isSecondDivision"
                        size="x-small"
                        color="#8b5cf6"
                        variant="flat"
                        class="text-[10px] px-1-5"
                      >
                        {{ compSection.badgeLabel || 'LIGA 2' }}
                      </v-chip>

                      <!-- Badge Coupes Nationales -->
                      <v-chip
                        v-if="compSection.category === 'cup'"
                        size="x-small"
                        color="#10b981"
                        variant="flat"
                        class="text-[10px] px-1-5"
                      >
                        COUPE
                      </v-chip>

                      <!-- Badge Matchs Amicaux -->
                      <v-chip
                        v-if="compSection.isFriendly"
                        size="x-small"
                        color="#f59e0b"
                        variant="flat"
                        class="text-[10px] px-1-5"
                      >
                        AMICAL
                      </v-chip>

                      <!-- Badge Féminin -->
                      <v-chip
                        v-if="compSection.isWomen"
                        size="x-small"
                        color="#f43f5e"
                        variant="flat"
                        class="text-[10px] px-1-5"
                      >
                        <v-icon start size="11">mdi-gender-female</v-icon>
                        FÉMININ
                      </v-chip>

                      <!-- Badge U-x / Jeunes -->
                      <v-chip
                        v-if="compSection.isYouth"
                        size="x-small"
                        color="#06b6d4"
                        variant="flat"
                        class="text-[10px] px-1-5"
                      >
                        <v-icon start size="11">mdi-school</v-icon>
                        {{ compSection.youthLabel || 'JEUNES' }}
                      </v-chip>
                    </div>
                  </div>
                </div>

                <div class="d-flex align-center gap-2 flex-shrink-0">
                  <v-btn
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    append-icon="mdi-arrow-right"
                    title="Voir les détails de la compétition"
                    @click.stop="goToLeague(compSection.league.id || compSection.league.slug || compSection.league.name)"
                  >
                    Détails
                  </v-btn>

                  <v-icon color="zinc-400" size="18">
                    {{ isCollapsed(compSection.id) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                  </v-icon>
                </div>
              </div>

              <!-- Contenu de la compétition (Poules ou Liste Directe) -->
              <v-expand-transition>
                <div v-show="!isCollapsed(compSection.id)" class="d-flex flex-column gap-3 pl-1">
                  
                  <!-- CAS 1 : Compétition Internationale / Tournoi subdivisé par Poules / Groupes -->
                  <template v-if="compSection.hasPoules">
                    <div
                      v-for="poule in compSection.poules"
                      :key="poule.name"
                      class="poule-group d-flex flex-column gap-2"
                    >
                      <!-- Sous-titre Poule / Groupe -->
                      <div class="poule-header d-flex align-center justify-space-between px-3 py-1-5 rounded-lg">
                        <div class="d-flex align-center gap-2 min-w-0">
                          <v-icon size="14" color="#3b82f6" class="flex-shrink-0">mdi-shield-outline</v-icon>
                          <span class="text-caption font-mono text-zinc-200 font-normal text-truncate">{{ poule.name }}</span>
                        </div>
                        <span class="text-[11px] font-mono text-zinc-500 flex-shrink-0">
                          {{ poule.matches.length }} {{ poule.matches.length > 1 ? 'matchs' : 'match' }}
                        </span>
                      </div>

                      <!-- Matchs de cette Poule -->
                      <div class="d-flex flex-column gap-2">
                        <MatchCard
                          v-for="match in poule.matches"
                          :key="match.id"
                          :match="match"
                          :is-favorite="store.isFavorite(match.id)"
                          :is-recently-updated="Boolean(updatedMatchIds[match.id])"
                          @select="goToMatch"
                          @toggle-favorite="store.toggleFavorite"
                        />
                      </div>
                    </div>
                  </template>

                  <!-- CAS 2 : Compétition régulière sans poules (Liga 2, Premier League, etc.) -->
                  <template v-else>
                    <div class="d-flex flex-column gap-2">
                      <MatchCard
                        v-for="match in compSection.matches"
                        :key="match.id"
                        :match="match"
                        :is-favorite="store.isFavorite(match.id)"
                        :is-recently-updated="Boolean(updatedMatchIds[match.id])"
                        @select="goToMatch"
                        @toggle-favorite="store.toggleFavorite"
                      />
                    </div>
                  </template>

                </div>
              </v-expand-transition>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Modale Classements & Statistiques (Phase 2 & 4) -->
    <StandingsModal
      v-model="isStandingsOpen"
      :league-id="standingsLeagueId"
      :league-name="standingsLeagueName"
      :league-logo="standingsLeagueLogo"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useMatchesStore } from '../stores/matches';
import { useUiStore } from '../stores/ui';
import type { SportMatch, MatchLeague } from '../types/matches';
import { extractMatchGroup, type CompetitionCategory } from '../utils/matchClassifier';
import CalendarStrip from '../components/CalendarStrip.vue';
import MatchCard from '../components/MatchCard.vue';
import TeamLogo from '../components/TeamLogo.vue';
import FiveLeague from '@/components/FiveLeague.vue';
import StandingsModal from '../components/StandingsModal.vue';
import LeagueSidebar from '../components/LeagueSidebar.vue';

const router = useRouter();
const store = useMatchesStore();
const ui = useUiStore();

const {
  selectedCountry,
  selectedDate,
  selectedLeague,
  searchQuery,
  statusFilter,
  isLoading,
  updatedMatchIds,
  liveCount,
  groupedByLeague,
  filteredMatches,
} = storeToRefs(store);

const collapsedLeagues = ref<Record<string, boolean>>({});

const displayedLeagueGroups = computed(() => groupedByLeague.value);

const daySummary = computed(() => {
  const currentList = filteredMatches.value;
  const countriesMap = new Map<string, { id: string; name: string; flag?: string; count: number }>();
  const compsMap = new Map<string, { id: string; name: string; logo?: string; flag?: string; count: number }>();

  for (const m of currentList) {
    const rawCountry = m.league.country || 'International';
    const cKey = rawCountry.toLowerCase();
    if (!countriesMap.has(cKey)) {
      countriesMap.set(cKey, {
        id: cKey,
        name: rawCountry,
        flag: m.league.flag || '🌍',
        count: 0,
      });
    }
    countriesMap.get(cKey)!.count += 1;

    const compId = m.league.id || m.league.name;
    if (!compsMap.has(compId)) {
      compsMap.set(compId, {
        id: compId,
        name: m.league.name,
        logo: m.league.logo,
        flag: m.league.flag,
        count: 0,
      });
    }
    compsMap.get(compId)!.count += 1;
  }

  const countriesList = Array.from(countriesMap.values()).sort((a, b) => b.count - a.count);
  const competitionsList = Array.from(compsMap.values()).sort((a, b) => b.count - a.count);

  return {
    countriesCount: countriesList.length,
    competitionsCount: competitionsList.length,
    totalMatchesCount: currentList.length,
    countriesList,
    competitionsList,
  };
});

// ─── Classification : Les Compétitions comme En-têtes Principaux avec Sous-division par Poules ───
export interface PouleSection {
  name: string;
  matches: SportMatch[];
}

export interface CompetitionSection {
  id: string;
  league: MatchLeague;
  stageName?: string;
  countryName: string;
  flag?: string;
  category: CompetitionCategory;
  categoryLabel: string;
  badgeLabel?: string;
  badgeColor?: string;
  isWomen: boolean;
  isYouth: boolean;
  youthLabel?: string;
  isFriendly: boolean;
  isSecondDivision: boolean;
  isEuroOrIntl: boolean;
  priority: number;
  totalMatches: number;
  hasPoules: boolean;
  poules: PouleSection[];
  matches: SportMatch[];
}

const displayedCompetitionSections = computed<CompetitionSection[]>(() => {
  const sections: CompetitionSection[] = [];

  // Modèle LiveScore : UNE section plate par « Compétition - Phase/Poule »
  // (ex: "UEFA Nations League - League A: Group 1", "LaLiga 2").
  // Aucune imbrication : chaque en-tête ne contient que ses propres matchs.
  for (const group of displayedLeagueGroups.value) {
    const compId = group.league.id || group.league.slug || group.league.name;
    const countryName = group.league.country || 'International';
    const flag = group.league.flag || (group.isFriendly ? '🤝' : '🌍');

    const sortedMatches = [...group.matches].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Découpage par poule (normalisée "League B, Group B" -> "League B: Group B")
    const stageMap = new Map<string, SportMatch[]>();
    for (const match of sortedMatches) {
      const raw = extractMatchGroup(match) || '';
      const stageName = raw.replace(/\s*,\s*/g, ': ').trim();
      if (!stageMap.has(stageName)) stageMap.set(stageName, []);
      stageMap.get(stageName)!.push(match);
    }

    const stageNames = Array.from(stageMap.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    for (const stageName of stageNames) {
      const stageMatches = stageMap.get(stageName)!;
      sections.push({
        id: stageName ? `${compId}__${stageName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : compId,
        league: group.league,
        stageName: stageName || undefined,
        countryName,
        flag,
        category: group.category,
        categoryLabel: group.categoryLabel,
        badgeLabel: group.badgeLabel,
        badgeColor: group.badgeColor,
        isWomen: group.isWomen,
        isYouth: group.isYouth,
        youthLabel: group.youthLabel,
        isFriendly: group.isFriendly,
        isSecondDivision: group.isSecondDivision,
        isEuroOrIntl: group.isEuroOrIntl,
        priority: group.priority,
        totalMatches: stageMatches.length,
        hasPoules: false,
        poules: [],
        matches: stageMatches,
      });
    }
  }

  // Tri des compétitions : Euro/Intl (5) -> Majeures (10) -> Coupes (15) -> D1 (20) -> D2 (25) -> Amicaux (50)
  sections.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const byLeague = a.league.name.localeCompare(b.league.name);
    if (byLeague !== 0) return byLeague;
    return (a.stageName || '').localeCompare(b.stageName || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  return sections;
});

const selectedCompJump = ref<string | null>(null);

function scrollToCompetition(compId: string) {
  selectedCompJump.value = compId;
  // Une compétition peut avoir plusieurs sections (une par poule) : on vise la première
  const firstSection = displayedCompetitionSections.value.find(
    (s) => s.id === compId || s.id.startsWith(`${compId}__`)
  );
  const targetId = firstSection?.id || compId;
  collapsedLeagues.value[targetId] = false;
  setTimeout(() => {
    const el = document.getElementById(`competition-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('highlight-section');
      setTimeout(() => el.classList.remove('highlight-section'), 2000);
    }
  }, 50);
}

function setCountryFilter(countryId: string) {
  selectedCountry.value = countryId;
  store.setCountry(countryId);
}

// Standings Modal state
const isStandingsOpen = ref(false);
const standingsLeagueId = ref('');
const standingsLeagueName = ref('');
const standingsLeagueLogo = ref<string | undefined>(undefined);

function openStandingsFromDrawer(id: string, name: string, logo?: string) {
  openStandings(id, name, logo);
  ui.navDrawer = false;
}

function openStandings(id: string, name: string, logo?: string) {
  standingsLeagueId.value = id;
  standingsLeagueName.value = name;
  standingsLeagueLogo.value = logo;
  isStandingsOpen.value = true;
}

const goToLeague = (leagueId: string) => {
  router.push(`/competition/${encodeURIComponent(leagueId)}`);
};

const handleLeagueSelect = (leagueId: string) => {
  goToLeague(leagueId);
};
onMounted(() => {
  store.loadCountries();
  store.loadLeagues();
  store.loadMatches();
  // Connexion au flux SSE en temps réel
  store.startLiveStream();
});

onUnmounted(() => {
  // Déconnexion propre du flux SSE
  store.stopLiveStream();
});

function onDateChange(date: string) {
  selectedDate.value = date;
  store.loadMatches();
}

function resetFilters() {
  statusFilter.value = 'all';
  searchQuery.value = '';
  selectedLeague.value = 'all';
  selectedDate.value = new Date().toISOString().split('T')[0];
  store.loadMatches();
}

function toggleCollapse(key: string) {
  collapsedLeagues.value[key] = !collapsedLeagues.value[key];
}

function isCollapsed(key: string): boolean {
  return Boolean(collapsedLeagues.value[key]);
}

function goToMatch(match: SportMatch, tab?: string) {
  router.push({
    name: 'match-detail',
    params: { id: match.id },
    query: {
      league: match.league.slug || match.league.id || 'all',
      ...(tab ? { tab } : {}),
    },
  });
}
</script>

<style scoped>
.max-w-matches {
  max-width: 1280px;
  margin: 0 auto;
}

.border-b-dark {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
}

.border-dark {
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
}

.divide-dark > *:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
}

.league-card {
  border: 1px solid rgba(255, 255, 255, 0.04) !important;
  background-color: #181818 !important;
}

.league-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.15s ease;
}

.league-header:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.gap-5 { gap: 20px; }

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ─── Styles Synthèse Journée & Puces Compétitions ─── */
.daily-overview-card {
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(24, 24, 27, 0.7) !important;
  backdrop-filter: blur(12px);
}

.country-mini-pill {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.country-mini-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.competitions-strip {
  scrollbar-width: thin;
}

.competition-jump-chip {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
  transition: all 0.2s ease;
  font-size: 12px;
}

.competition-jump-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.active-comp-chip {
  background: rgba(229, 9, 20, 0.15) !important;
  border-color: rgba(229, 9, 20, 0.4) !important;
}

.comp-badge-pill {
  background: rgba(255, 255, 255, 0.08);
}

/* ─── Bloc Compétition & Poules ─── */
.competition-block {
  border-radius: 16px;
  transition: box-shadow 0.3s ease;
}

.highlight-section {
  animation: highlightGlow 2s ease-out;
}

@keyframes highlightGlow {
  0% {
    box-shadow: 0 0 0 2px #e50914, 0 0 20px rgba(229, 9, 20, 0.4);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.competition-header {
  background: transparent;
  border: none;
  transition: opacity 0.2s ease;
}

.competition-header:hover {
  opacity: 0.85;
}

.country-subtag {
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
}

.poule-header {
  background: rgba(255, 255, 255, 0.02);
  border-left: 2px solid #3b82f6;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
</style>
