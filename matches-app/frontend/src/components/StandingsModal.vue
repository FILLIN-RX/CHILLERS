<template>
  <v-dialog
    :model-value="modelValue"
    max-width="960"
    scrollable
    transition="dialog-bottom-transition"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="standings-dialog-card rounded-2xl overflow-hidden" color="surface">
      <!-- En-tête de la modale -->
      <v-card-title class="d-flex align-center justify-space-between px-6 py-4 border-b-dark bg-surface-header">
        <div class="d-flex align-center gap-3">
          <TeamLogo :src="leagueLogo" :name="leagueName" :size="36" />
          <div>
            <div class="text-h6 font-weight-black text-white leading-tight">
              {{ leagueName }}
            </div>
            <div class="text-caption text-zinc-400">
              Statistiques officielles & Classements
            </div>
          </div>
        </div>

        <div class="d-flex align-center gap-3">
          <!-- Sélecteur de saison / archive -->
          <v-select
            v-if="seasons.length > 0"
            v-model="selectedSeason"
            :items="seasons"
            item-title="displayName"
            item-value="year"
            density="compact"
            variant="outlined"
            hide-details
            class="season-select"
            @update:model-value="loadStandingsData"
          >
            <template #prepend-inner>
              <v-icon size="16" color="primary">mdi-calendar-clock</v-icon>
            </template>
          </v-select>

          <v-btn
            icon="mdi-close"
            variant="tonal"
            color="surface-variant"
            size="small"
            rounded="circle"
            @click="$emit('update:modelValue', false)"
          />
        </div>
      </v-card-title>

      <!-- Navigation par Onglets (Classement, Buteurs/Passeurs, Équipes) -->
      <v-tabs
        v-model="activeTab"
        grow
        color="primary"
        bg-color="surface"
        class="border-b-dark"
      >
        <v-tab value="standings" class="font-weight-bold">
          <v-icon start size="18">mdi-trophy-outline</v-icon>
          Classement
        </v-tab>
        <v-tab value="leaders" class="font-weight-bold">
          <v-icon start size="18">mdi-soccer</v-icon>
          Meilleurs Buteurs & Passeurs
        </v-tab>
        <v-tab value="teams" class="font-weight-bold">
          <v-icon start size="18">mdi-shield-account-outline</v-icon>
          Clubs & Effectifs
        </v-tab>
      </v-tabs>

      <!-- Contenu Déroulant -->
      <v-card-text class="pa-4 pa-sm-6 dialog-body">
        <!-- ── TAB 1 : CLASSEMENT OFFICIEL ── -->
        <div v-if="activeTab === 'standings'">
          <div v-if="isLoadingStandings" class="text-center py-12">
            <v-progress-circular indeterminate color="primary" size="44" />
            <div class="text-caption text-zinc-400 mt-3">Chargement du classement officiel...</div>
          </div>

          <div v-else-if="standingGroups.length === 0" class="text-center py-12">
            <v-avatar color="surface-variant" size="56" class="mb-3">
              <v-icon size="28" color="zinc-400">mdi-trophy-broken</v-icon>
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold text-white">Classement non disponible</div>
            <div class="text-caption text-zinc-400 mt-1">
              Les données de classement ne sont pas disponibles pour cette saison.
            </div>
          </div>

          <div v-else class="d-flex flex-column gap-5">
            <div v-for="(group, gIdx) in standingGroups" :key="gIdx" class="standings-table-wrapper rounded-xl overflow-hidden border-dark">
              <div v-if="group.name && group.name !== 'Standings'" class="px-4 py-2 bg-surface-variant text-caption font-weight-bold text-primary">
                {{ group.name }}
              </div>

              <v-table density="compact" class="standings-table bg-surface">
                <thead>
                  <tr class="table-head-row">
                    <th class="text-center th-rank">#</th>
                    <th class="text-left th-club">Club</th>
                    <th class="text-center th-stat">MJ</th>
                    <th class="text-center th-stat">V</th>
                    <th class="text-center th-stat">N</th>
                    <th class="text-center th-stat">D</th>
                    <th class="text-center th-stat d-none d-sm-table-cell">BP</th>
                    <th class="text-center th-stat d-none d-sm-table-cell">BC</th>
                    <th class="text-center th-diff">Diff</th>
                    <th class="text-center th-pts">Pts</th>
                    <th class="text-center th-form d-none d-md-table-cell">Forme</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in group.entries"
                    :key="entry.team.id"
                    class="standing-row cursor-pointer"
                    @click="openTeamRoster(entry.team.id, entry.team.name, entry.team.logo)"
                  >
                    <!-- Rang avec indicateur couleur de qualification -->
                    <td class="text-center font-weight-bold rank-cell">
                      <span :class="getRankBadgeClass(entry.rank)">
                        {{ entry.rank }}
                      </span>
                    </td>

                    <!-- Club -->
                    <td class="club-cell">
                      <div class="d-flex align-center gap-2">
                        <TeamLogo :src="entry.team.logo" :name="entry.team.name" :size="24" />
                        <span class="text-body-2 font-weight-bold text-white text-truncate" style="max-width: 180px;">
                          {{ entry.team.name }}
                        </span>
                      </div>
                    </td>

                    <!-- Stats -->
                    <td class="text-center text-caption text-zinc-300">{{ entry.gamesPlayed }}</td>
                    <td class="text-center text-caption text-zinc-300">{{ entry.wins }}</td>
                    <td class="text-center text-caption text-zinc-300">{{ entry.ties }}</td>
                    <td class="text-center text-caption text-zinc-300">{{ entry.losses }}</td>
                    <td class="text-center text-caption text-zinc-400 d-none d-sm-table-cell">{{ entry.goalsFor }}</td>
                    <td class="text-center text-caption text-zinc-400 d-none d-sm-table-cell">{{ entry.goalsAgainst }}</td>
                    <td class="text-center text-caption font-weight-bold" :class="getDiffClass(entry.goalDifference)">
                      {{ entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference }}
                    </td>
                    <td class="text-center text-subtitle-2 font-weight-black text-primary font-mono pts-cell">
                      {{ entry.points }}
                    </td>

                    <!-- Forme (5 derniers matchs) -->
                    <td class="text-center d-none d-md-table-cell">
                      <div v-if="entry.form" class="d-flex justify-center gap-1">
                        <span
                          v-for="(f, fIdx) in entry.form.split('').slice(-5)"
                          :key="fIdx"
                          class="form-dot"
                          :class="getFormDotClass(f)"
                        >
                          {{ f }}
                        </span>
                      </div>
                      <span v-else class="text-caption text-zinc-600">-</span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>
        </div>

        <!-- ── TAB 2 : BUTEURS & PASSEURS ── -->
        <div v-else-if="activeTab === 'leaders'">
          <div v-if="isLoadingLeaders" class="text-center py-12">
            <v-progress-circular indeterminate color="primary" size="44" />
            <div class="text-caption text-zinc-400 mt-3">Chargement des meilleurs buteurs et passeurs...</div>
          </div>

          <div v-else-if="leaders.length === 0" class="text-center py-12">
            <v-avatar color="surface-variant" size="56" class="mb-3">
              <v-icon size="28" color="zinc-400">mdi-account-star-outline</v-icon>
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold text-white">Classements individuels non disponibles</div>
            <div class="text-caption text-zinc-400 mt-1">
              Les statistiques individuelles ne sont pas encore disponibles pour ce championnat.
            </div>
          </div>

          <div v-else class="d-flex flex-column gap-6">
            <v-row>
              <v-col
                v-for="cat in leaders"
                :key="cat.name"
                cols="12"
                md="6"
              >
                <v-card class="pa-4 rounded-xl border-dark" color="surface-variant">
                  <div class="d-flex align-center justify-space-between mb-3 pb-2 border-b-dark">
                    <div class="d-flex align-center gap-2">
                      <v-avatar color="primary" size="28">
                        <v-icon size="16" color="white">{{ cat.name === 'goals' ? 'mdi-soccer' : 'mdi-shoe-cleat' }}</v-icon>
                      </v-avatar>
                      <span class="text-subtitle-2 font-weight-black text-white">
                        {{ cat.displayName }}
                      </span>
                    </div>
                  </div>

                  <div class="d-flex flex-column gap-2">
                    <div
                      v-for="(leader, lIdx) in cat.leaders"
                      :key="leader.athlete.id || lIdx"
                      class="leader-row d-flex align-center justify-space-between pa-2 rounded-lg"
                      @click="showPlayerDetails(leader.athlete.id)"
                    >
                      <div class="d-flex align-center gap-3">
                        <div class="leader-rank font-mono font-weight-bold text-caption text-zinc-400">
                          {{ lIdx + 1 }}
                        </div>
                        <v-avatar size="34" color="surface" class="border-dark">
                          <img
                            v-if="leader.athlete.headshot"
                            :src="leader.athlete.headshot"
                            :alt="leader.athlete.displayName"
                            class="w-100 h-100 object-cover"
                          />
                          <v-icon v-else size="18" color="zinc-500">mdi-account</v-icon>
                        </v-avatar>
                        <div>
                          <div class="text-caption font-weight-bold text-white text-truncate" style="max-width: 170px;">
                            {{ leader.athlete.displayName }}
                          </div>
                          <div v-if="leader.team" class="text-caption text-zinc-400 text-truncate" style="max-width: 170px;">
                            {{ leader.team.name }}
                          </div>
                        </div>
                      </div>

                      <div class="text-right">
                        <span class="text-subtitle-1 font-weight-black text-primary font-mono">
                          {{ leader.displayValue || leader.value }}
                        </span>
                        <div class="text-caption text-zinc-500 font-weight-medium">
                          {{ cat.name === 'goals' ? 'buts' : 'passes' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </div>

        <!-- ── TAB 3 : CLUBS & EFFECTIFS ── -->
        <div v-else-if="activeTab === 'teams'">
          <div v-if="isLoadingTeams" class="text-center py-12">
            <v-progress-circular indeterminate color="primary" size="44" />
            <div class="text-caption text-zinc-400 mt-3">Chargement des équipes du championnat...</div>
          </div>

          <!-- Si une équipe est sélectionnée, on affiche son effectif complet -->
          <div v-else-if="selectedTeamId">
            <div class="d-flex align-center justify-space-between mb-4">
              <v-btn
                variant="tonal"
                color="surface-variant"
                size="small"
                rounded="pill"
                prepend-icon="mdi-arrow-left"
                @click="selectedTeamId = null"
              >
                Toutes les équipes
              </v-btn>

              <div class="d-flex align-center gap-2">
                <TeamLogo :src="selectedTeamLogo" :name="selectedTeamName" :size="28" />
                <span class="text-subtitle-1 font-weight-black text-white">{{ selectedTeamName }}</span>
              </div>
            </div>

            <div v-if="isLoadingRoster" class="text-center py-12">
              <v-progress-circular indeterminate color="primary" size="36" />
              <div class="text-caption text-zinc-400 mt-2">Chargement de l'effectif...</div>
            </div>

            <div v-else-if="teamRosterGroups.length === 0" class="text-center py-12 text-zinc-400">
              Aucun joueur répertorié pour cette équipe.
            </div>

            <div v-else class="d-flex flex-column gap-5">
              <div
                v-for="group in teamRosterGroups"
                :key="group.position"
                class="roster-group"
              >
                <div class="text-caption font-weight-black text-uppercase text-primary mb-2 d-flex align-center gap-2">
                  <v-icon size="14">mdi-account-group</v-icon>
                  {{ group.position }} ({{ group.players.length }})
                </div>

                <v-row>
                  <v-col
                    v-for="athlete in group.players"
                    :key="athlete.id"
                    cols="12"
                    sm="6"
                    md="4"
                  >
                    <v-card
                      class="pa-3 rounded-xl border-dark athlete-card"
                      color="surface-variant"
                      @click="showPlayerDetails(athlete.id)"
                    >
                      <div class="d-flex align-center gap-3">
                        <v-avatar size="40" color="surface" class="border-dark">
                          <img
                            v-if="athlete.photo"
                            :src="athlete.photo"
                            :alt="athlete.displayName"
                            class="w-100 h-100 object-cover"
                          />
                          <v-icon v-else size="20" color="zinc-500">mdi-account</v-icon>
                        </v-avatar>

                        <div class="flex-1 min-w-0">
                          <div class="text-caption font-weight-bold text-white text-truncate">
                            {{ athlete.displayName }}
                          </div>
                          <div class="text-caption text-zinc-400 d-flex align-center gap-2">
                            <span v-if="athlete.jersey" class="font-mono text-primary font-weight-bold">
                              #{{ athlete.jersey }}
                            </span>
                            <span>{{ athlete.position?.displayName || athlete.position?.name || athlete.position }}</span>
                            <span v-if="athlete.age">({{ athlete.age }} ans)</span>
                          </div>
                        </div>
                      </div>
                    </v-card>
                  </v-col>
                </v-row>
              </div>
            </div>
          </div>

          <!-- Liste des Équipes de la Ligue -->
          <div v-else>
            <div class="text-caption text-zinc-400 mb-3">
              Sélectionnez une équipe pour consulter son effectif complet et les statistiques des joueurs :
            </div>
            <v-row>
              <v-col
                v-for="t in leagueTeams"
                :key="t.id"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card
                  class="pa-4 rounded-xl border-dark team-select-card cursor-pointer"
                  color="surface-variant"
                  @click="openTeamRoster(t.id, t.name, t.logo)"
                >
                  <div class="d-flex align-center gap-3">
                    <TeamLogo :src="t.logo" :name="t.name" :size="36" />
                    <div class="flex-1 min-w-0">
                      <div class="text-body-2 font-weight-bold text-white text-truncate">
                        {{ t.name }}
                      </div>
                      <div v-if="t.shortDisplayName" class="text-caption text-zinc-400">
                        {{ t.shortDisplayName }}
                      </div>
                    </div>
                    <v-icon size="18" color="zinc-400">mdi-chevron-right</v-icon>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Dialog Fiche Joueur détaillée (Phase 4) -->
    <v-dialog v-model="playerDialog" max-width="500">
      <v-card v-if="selectedPlayer" class="pa-6 rounded-2xl border-dark" color="surface">
        <div class="d-flex justify-space-between align-center mb-4">
          <span class="text-caption font-weight-black text-uppercase text-primary">Fiche Joueur</span>
          <v-btn icon="mdi-close" variant="tonal" size="x-small" @click="playerDialog = false" />
        </div>

        <div class="d-flex align-center gap-4 mb-4">
          <v-avatar size="64" color="surface-variant" class="border-dark">
            <img
              v-if="selectedPlayer.photo"
              :src="selectedPlayer.photo"
              :alt="selectedPlayer.displayName"
              class="w-100 h-100 object-cover"
            />
            <v-icon v-else size="32" color="zinc-500">mdi-account</v-icon>
          </v-avatar>
          <div>
            <div class="text-h6 font-weight-black text-white leading-tight">
              {{ selectedPlayer.displayName }}
            </div>
            <div class="text-caption text-zinc-400 d-flex align-center gap-2 mt-1">
              <span v-if="selectedPlayer.jersey" class="text-primary font-weight-bold font-mono">#{{ selectedPlayer.jersey }}</span>
              <span>{{ selectedPlayer.position?.displayName || selectedPlayer.position?.name }}</span>
              <span v-if="selectedPlayer.team">• {{ selectedPlayer.team.name }}</span>
            </div>
          </div>
        </div>

        <v-divider class="border-dark mb-4" />

        <div class="d-flex flex-column gap-2 text-caption">
          <div v-if="selectedPlayer.citizenship" class="d-flex justify-space-between">
            <span class="text-zinc-400">Nationalité :</span>
            <span class="text-white font-weight-bold">{{ selectedPlayer.citizenship }}</span>
          </div>
          <div v-if="selectedPlayer.age" class="d-flex justify-space-between">
            <span class="text-zinc-400">Âge :</span>
            <span class="text-white font-weight-bold">{{ selectedPlayer.age }} ans</span>
          </div>
          <div v-if="selectedPlayer.displayHeight" class="d-flex justify-space-between">
            <span class="text-zinc-400">Taille :</span>
            <span class="text-white font-weight-bold">{{ selectedPlayer.displayHeight }}</span>
          </div>
          <div v-if="selectedPlayer.displayWeight" class="d-flex justify-space-between">
            <span class="text-zinc-400">Poids :</span>
            <span class="text-white font-weight-bold">{{ selectedPlayer.displayWeight }}</span>
          </div>
        </div>

        <!-- Statistiques de saison du joueur si disponibles -->
        <div v-if="selectedPlayer.statsSummary && selectedPlayer.statsSummary.length > 0" class="mt-4">
          <div class="text-caption font-weight-black text-uppercase text-zinc-400 mb-2">Statistiques Saison</div>
          <div class="d-flex flex-wrap gap-2">
            <v-chip
              v-for="st in selectedPlayer.statsSummary"
              :key="st.name"
              size="small"
              color="surface-variant"
              variant="flat"
            >
              <span class="text-zinc-400 mr-1">{{ st.displayName }}:</span>
              <span class="font-weight-bold text-white font-mono">{{ st.value }}</span>
            </v-chip>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import TeamLogo from './TeamLogo.vue';
import {
  fetchStandings,
  fetchSeasons,
  fetchCompetitionLeaders,
  fetchLeagueTeams,
  fetchTeamRoster,
  fetchPlayerProfile,
} from '../services/api';
import type {
  StandingGroup,
  CompetitionSeason,
  CompetitionLeadersCategory,
  TeamDetails,
  TeamRosterGroup,
  PlayerProfile,
} from '../types/matches';

const props = defineProps<{
  modelValue: boolean;
  leagueId: string;
  leagueName: string;
  leagueLogo?: string;
}>();

defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const activeTab = ref<'standings' | 'leaders' | 'teams'>('standings');
const seasons = ref<CompetitionSeason[]>([]);
const selectedSeason = ref<number | undefined>(undefined);

// Standings
const standingGroups = ref<StandingGroup[]>([]);
const isLoadingStandings = ref(false);

// Leaders
const leaders = ref<CompetitionLeadersCategory[]>([]);
const isLoadingLeaders = ref(false);

// Teams & Rosters
const leagueTeams = ref<TeamDetails[]>([]);
const isLoadingTeams = ref(false);
const selectedTeamId = ref<string | null>(null);
const selectedTeamName = ref<string>('');
const selectedTeamLogo = ref<string | undefined>(undefined);
const teamRosterGroups = ref<TeamRosterGroup[]>([]);
const isLoadingRoster = ref(false);

// Player Details Dialog
const playerDialog = ref(false);
const selectedPlayer = ref<PlayerProfile | null>(null);

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen && props.leagueId) {
      loadSeasons();
      loadStandingsData();
      loadLeadersData();
      loadTeamsData();
    }
  }
);

watch(
  () => props.leagueId,
  () => {
    if (props.modelValue) {
      selectedTeamId.value = null;
      loadSeasons();
      loadStandingsData();
      loadLeadersData();
      loadTeamsData();
    }
  }
);

async function loadSeasons() {
  try {
    const list = await fetchSeasons(props.leagueId);
    seasons.value = list;
    if (list.length > 0 && !selectedSeason.value) {
      selectedSeason.value = list[0].year;
    }
  } catch (err) {
    console.error('Erreur chargement saisons:', err);
  }
}

async function loadStandingsData() {
  if (!props.leagueId) return;
  isLoadingStandings.value = true;
  try {
    const res = await fetchStandings(props.leagueId, selectedSeason.value);
    standingGroups.value = res;
  } catch (err) {
    console.error('Erreur chargement classement:', err);
    standingGroups.value = [];
  } finally {
    isLoadingStandings.value = false;
  }
}

async function loadLeadersData() {
  if (!props.leagueId) return;
  isLoadingLeaders.value = true;
  try {
    const res = await fetchCompetitionLeaders(props.leagueId);
    leaders.value = res;
  } catch (err) {
    console.error('Erreur chargement leaders:', err);
    leaders.value = [];
  } finally {
    isLoadingLeaders.value = false;
  }
}

async function loadTeamsData() {
  if (!props.leagueId) return;
  isLoadingTeams.value = true;
  try {
    const res = await fetchLeagueTeams(props.leagueId);
    leagueTeams.value = res;
  } catch (err) {
    console.error('Erreur chargement équipes:', err);
    leagueTeams.value = [];
  } finally {
    isLoadingTeams.value = false;
  }
}

async function openTeamRoster(teamId: string, teamName: string, teamLogo?: string) {
  activeTab.value = 'teams';
  selectedTeamId.value = teamId;
  selectedTeamName.value = teamName;
  selectedTeamLogo.value = teamLogo;
  isLoadingRoster.value = true;
  try {
    const roster = await fetchTeamRoster(teamId, props.leagueId);
    teamRosterGroups.value = roster;
  } catch (err) {
    console.error('Erreur chargement effectif:', err);
    teamRosterGroups.value = [];
  } finally {
    isLoadingRoster.value = false;
  }
}

async function showPlayerDetails(playerId: string) {
  try {
    const profile = await fetchPlayerProfile(playerId);
    if (profile) {
      selectedPlayer.value = profile;
      playerDialog.value = true;
    }
  } catch (err) {
    console.error('Erreur chargement joueur:', err);
  }
}

function getRankBadgeClass(rank: number): string {
  if (rank <= 4) return 'rank-ucl';
  if (rank === 5) return 'rank-uel';
  if (rank >= 18) return 'rank-rel';
  return 'rank-mid';
}

function getDiffClass(diff: number): string {
  if (diff > 0) return 'text-success';
  if (diff < 0) return 'text-error';
  return 'text-zinc-400';
}

function getFormDotClass(form: string): string {
  const f = form.toUpperCase();
  if (f === 'W' || f === 'V') return 'form-win';
  if (f === 'D' || f === 'N') return 'form-draw';
  if (f === 'L') return 'form-loss';
  return 'form-draw';
}
</script>

<style scoped>
.standings-dialog-card {
  border: 1px solid #1f1d2b;
  max-height: 85vh;
}

.bg-surface-header {
  background-color: #12111a;
}

.season-select {
  max-width: 150px;
}

.border-b-dark {
  border-bottom: 1px solid #1a1824;
}

.border-dark {
  border: 1px solid #1a1824;
}

.dialog-body {
  overflow-y: auto;
}

.table-head-row th {
  color: #71717a !important;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  border-bottom: 1px solid #1a1824 !important;
  padding: 8px 6px !important;
}

.standing-row {
  transition: background-color 0.15s ease;
  border-bottom: 1px solid #161420;
}

.standing-row:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.standing-row td {
  padding: 8px 6px !important;
}

.rank-cell {
  width: 36px;
}

.rank-ucl, .rank-uel, .rank-rel, .rank-mid {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
}

.rank-ucl {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.rank-uel {
  background-color: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.rank-rel {
  background-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.rank-mid {
  color: #a1a1aa;
}

.th-pts, .pts-cell {
  font-weight: 900;
}

.form-dot {
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

.form-win {
  background-color: #10b981;
}

.form-draw {
  background-color: #6b7280;
}

.form-loss {
  background-color: #ef4444;
}

.leader-row {
  background-color: #161420;
  border: 1px solid #1f1c2b;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.leader-row:hover {
  background-color: #1c1a29;
  transform: translateX(2px);
}

.team-select-card {
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.team-select-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.15);
}

.athlete-card {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.athlete-card:hover {
  background-color: #1c1a29;
}

.font-mono {
  font-family: monospace;
}

.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.gap-5 { gap: 20px; }
.gap-6 { gap: 24px; }
</style>
