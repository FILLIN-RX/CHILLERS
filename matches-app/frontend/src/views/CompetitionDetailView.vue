<template>
  <v-container class="competition-view pa-4 pa-sm-6 max-w-1100 position-relative">
    <!-- ─── 1. Fil d'Ariane (Breadcrumbs) façon LiveScore ─── -->
    <nav class="d-flex align-center gap-2 mb-4 text-caption text-zinc-400 font-weight-medium">
      <router-link to="/" class="crumb-link text-zinc-400 hover:text-white transition-colors">
        Accueil
      </router-link>
      <v-icon size="14" color="zinc-600">mdi-chevron-right</v-icon>
      <span class="text-zinc-400">{{ competitionSport }}</span>
      <v-icon size="14" color="zinc-600">mdi-chevron-right</v-icon>
      <span class="text-zinc-400">{{ competitionCountry }}</span>
      <v-icon size="14" color="zinc-600">mdi-chevron-right</v-icon>
      <span class="text-white font-weight-bold">{{ competitionName }}</span>
    </nav>

    <!-- ─── 2. En-tête Héros de la Compétition ─── -->
    <v-card color="#161618" rounded="2xl" class="pa-5 pa-sm-6 mb-6 header-card position-relative overflow-hidden" elevation="0">
      <div class="header-glow" aria-hidden="true" />

      <div class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between gap-4 position-relative z-1">
        <!-- Logo & Titre de la Ligue -->
        <div class="d-flex align-center gap-4 min-w-0">
          <div class="league-logo-wrapper d-flex align-center justify-center flex-shrink-0">
            <span v-if="leagueFlag && !leagueLogo" class="emoji-flag">{{ leagueFlag }}</span>
            <TeamLogo
              v-else
              :src="leagueLogo"
              :name="competitionName"
              :size="56"
              class="league-logo-img"
            />
          </div>

          <div class="min-w-0">
            <div class="d-flex align-center flex-wrap gap-2 mb-1">
              <h1 class="text-h5 text-sm-h4 font-weight-black text-white tracking-tight text-truncate">
                {{ competitionName }}
              </h1>
              <span v-if="leagueFlag" class="country-flag-icon" :title="competitionCountry">{{ leagueFlag }}</span>
            </div>

            <div class="d-flex align-center flex-wrap gap-2 text-caption text-zinc-400">
              <span class="font-weight-medium text-zinc-300">{{ competitionCountry }}</span>
              <span>•</span>
              <span class="text-zinc-400">{{ competitionSport }}</span>
              <span v-if="currentSeasonLabel">•</span>
              <span v-if="currentSeasonLabel" class="text-primary font-weight-bold font-mono">
                Saison {{ currentSeasonLabel }}
              </span>
            </div>
          </div>
        </div>

        <!-- Actions : Favori & Sélecteur de Saison -->
        <div class="d-flex align-center gap-2 align-self-end align-self-sm-center flex-shrink-0">
          <!-- Sélecteur de Saison si disponible -->
          <v-select
            v-if="availableSeasons.length > 1"
            v-model="selectedSeason"
            :items="availableSeasons"
            item-title="displayName"
            item-value="year"
            density="compact"
            variant="outlined"
            hide-details
            rounded="xl"
            class="season-select"
            bg-color="#1f1f23"
            style="min-width: 140px;"
            @update:model-value="onSeasonChange"
          />

          <!-- Bouton Favori Compétition -->
          <v-btn
            icon
            variant="tonal"
            :color="isLeagueFavorite ? 'warning' : 'zinc-600'"
            size="small"
            rounded="xl"
            class="fav-league-btn"
            title="Ajouter aux compétitions favorites"
            @click="toggleLeagueFavorite"
          >
            <v-icon size="20">{{ isLeagueFavorite ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
          </v-btn>

          <!-- Bouton Retour -->
          <v-btn
            variant="tonal"
            color="surface-variant"
            rounded="xl"
            size="small"
            class="font-weight-bold"
            @click="goBack"
          >
            <v-icon start size="16">mdi-arrow-left</v-icon>
            Matchs
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ─── 3. Navigation par Onglets (Façon LiveScore) ─── -->
    <div class="tabs-container mb-6">
      <div class="d-flex align-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <v-btn
          v-for="tab in TABS"
          :key="tab.id"
          :variant="activeTab === tab.id ? 'flat' : 'text'"
          :color="activeTab === tab.id ? 'primary' : 'zinc-400'"
          rounded="xl"
          size="small"
          class="font-weight-bold text-capitalize px-4 flex-shrink-0 tab-btn"
          @click="activeTab = tab.id"
        >
          <v-icon start size="16">{{ tab.icon }}</v-icon>
          {{ tab.label }}
          <span
            v-if="tab.id === 'fixtures' && upcomingMatches.length > 0"
            class="tab-count-pill ml-1.5 font-mono text-[10px]"
          >
            {{ upcomingMatches.length }}
          </span>
        </v-btn>
      </div>
    </div>

    <!-- ─── 4. État de Chargement Général ─── -->
    <div v-if="isLoading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="text-caption text-zinc-400 mt-4">Chargement de la compétition...</div>
    </div>

    <!-- ─── 5. Contenu des Onglets ─── -->
    <div v-else>
      <!-- ═══════════════ ONGLET 1 : APERÇU (OVERVIEW) ═══════════════ -->
      <div v-if="activeTab === 'overview'" class="d-flex flex-column gap-6">
        <!-- Section A : Rencontres clés à venir -->
        <v-card color="#161618" rounded="2xl" class="section-card overflow-hidden" elevation="0">
          <div class="section-header d-flex align-center justify-space-between px-5 py-4">
            <div>
              <div class="d-flex align-center gap-2">
                <v-icon size="18" color="primary">mdi-calendar-clock</v-icon>
                <h2 class="text-subtitle-1 font-weight-black text-white">Rencontres</h2>
              </div>
              <div class="text-caption text-zinc-400 mt-0.5">
                Rencontres clés à venir de la {{ competitionName }}
              </div>
            </div>

            <v-btn
              v-if="upcomingMatches.length > 5"
              variant="text"
              color="primary"
              size="small"
              class="font-weight-bold"
              @click="activeTab = 'fixtures'"
            >
              Voir tout ({{ upcomingMatches.length }})
            </v-btn>
          </div>

          <v-divider color="rgba(255, 255, 255, 0.05)" />

          <!-- Liste des matchs à venir -->
          <div v-if="upcomingMatches.length === 0" class="pa-8 text-center text-caption text-zinc-500">
            Aucune rencontre programmée pour le moment.
          </div>
          <div v-else class="d-flex flex-column gap-2 pa-3">
            <MatchCard
              v-for="m in overviewUpcoming"
              :key="m.id"
              :match="m"
              :is-favorite="isMatchFavorite(m.id)"
              @select="goToMatch(m.id)"
              @toggle-favorite="toggleMatchFavorite"
            />
          </div>

          <!-- Bouton voir d'autres rencontres -->
          <div v-if="upcomingMatches.length > 5" class="pa-3 text-center bg-surface-darken">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              rounded="xl"
              class="font-weight-bold"
              @click="activeTab = 'fixtures'"
            >
              Voir d'autres rencontres à venir
              <v-icon end size="16">mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </v-card>

        <!-- Section B : Derniers Résultats -->
        <v-card color="#161618" rounded="2xl" class="section-card overflow-hidden" elevation="0">
          <div class="section-header d-flex align-center justify-space-between px-5 py-4">
            <div>
              <div class="d-flex align-center gap-2">
                <v-icon size="18" color="success">mdi-check-circle-outline</v-icon>
                <h2 class="text-subtitle-1 font-weight-black text-white">Résultats</h2>
              </div>
              <div class="text-caption text-zinc-400 mt-0.5">
                Rattraper les dernières actions de la {{ competitionName }}
              </div>
            </div>

            <v-btn
              v-if="finishedMatches.length > 5"
              variant="text"
              color="primary"
              size="small"
              class="font-weight-bold"
              @click="activeTab = 'results'"
            >
              Voir tout ({{ finishedMatches.length }})
            </v-btn>
          </div>

          <v-divider color="rgba(255, 255, 255, 0.05)" />

          <!-- Liste des résultats passés -->
          <div v-if="finishedMatches.length === 0" class="pa-8 text-center text-caption text-zinc-500">
            Aucun match terminé récent disponible.
          </div>
          <div v-else class="d-flex flex-column gap-2 pa-3">
            <MatchCard
              v-for="m in overviewFinished"
              :key="m.id"
              :match="m"
              :is-favorite="isMatchFavorite(m.id)"
              @select="goToMatch(m.id)"
              @toggle-favorite="toggleMatchFavorite"
            />
          </div>

          <!-- Bouton voir tous les résultats -->
          <div v-if="finishedMatches.length > 5" class="pa-3 text-center bg-surface-darken">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              rounded="xl"
              class="font-weight-bold"
              @click="activeTab = 'results'"
            >
              Voir tous les résultats
              <v-icon end size="16">mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </v-card>

        <!-- Section C : Mini-Tableau de Classement (Top 5) -->
        <v-card v-if="hasStandings" color="#161618" rounded="2xl" class="section-card overflow-hidden" elevation="0">
          <div class="section-header d-flex align-center justify-space-between px-5 py-4">
            <div>
              <div class="d-flex align-center gap-2">
                <v-icon size="18" color="amber">mdi-format-list-numbered</v-icon>
                <h2 class="text-subtitle-1 font-weight-black text-white">Classement</h2>
              </div>
              <div class="text-caption text-zinc-400 mt-0.5">
                Tableau de la {{ competitionName }} (Top 5)
              </div>
            </div>

            <v-btn
              variant="text"
              color="primary"
              size="small"
              class="font-weight-bold"
              @click="activeTab = 'standings'"
            >
              Classement complet
            </v-btn>
          </div>

          <v-divider color="rgba(255, 255, 255, 0.05)" />

          <!-- Table mini classement -->
          <div class="table-responsive">
            <table class="standings-table w-100">
              <thead>
                <tr class="table-head-row text-[11px] text-zinc-400 text-uppercase">
                  <th class="text-center py-2 px-3" style="width: 44px;">#</th>
                  <th class="text-left py-2 px-3">Équipe</th>
                  <th class="text-center py-2 px-2" style="width: 44px;">J</th>
                  <th class="text-center py-2 px-2" style="width: 44px;">Diff</th>
                  <th class="text-center py-2 px-3 font-weight-black text-white" style="width: 50px;">Pts</th>
                </tr>
              </thead>
              <tbody class="divide-dark">
                <tr
                  v-for="entry in topFiveStandings"
                  :key="entry.team.id"
                  class="table-body-row hover:bg-white/5 transition-colors"
                >
                  <td class="text-center py-2.5 px-3 font-mono font-weight-bold text-caption text-zinc-300">
                    <span class="rank-badge" :style="{ backgroundColor: getRankColor(entry.rank) }">
                      {{ entry.rank }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3">
                    <div class="d-flex align-center gap-2.5 min-w-0">
                      <TeamLogo :src="entry.team.logo" :name="entry.team.name" :size="20" class="flex-shrink-0" />
                      <span class="text-body-2 font-weight-bold text-white text-truncate">{{ entry.team.name }}</span>
                    </div>
                  </td>
                  <td class="text-center py-2.5 px-2 font-mono text-caption text-zinc-300">{{ entry.gamesPlayed }}</td>
                  <td class="text-center py-2.5 px-2 font-mono text-caption" :class="entry.goalDifference > 0 ? 'text-success' : entry.goalDifference < 0 ? 'text-error' : 'text-zinc-400'">
                    {{ entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference }}
                  </td>
                  <td class="text-center py-2.5 px-3 font-mono font-weight-black text-body-2 text-primary">
                    {{ entry.points }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pa-3 text-center bg-surface-darken">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              rounded="xl"
              class="font-weight-bold"
              @click="activeTab = 'standings'"
            >
              Voir le classement complet
              <v-icon end size="16">mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </v-card>
      </div>

      <!-- ═══════════════ ONGLET 2 : RENCONTRES (FIXTURES) ═══════════════ -->
      <div v-else-if="activeTab === 'fixtures'" class="d-flex flex-column gap-5">
        <div v-if="upcomingMatches.length === 0" class="text-center py-16">
          <v-icon size="48" color="zinc-600" class="mb-3">mdi-calendar-blank</v-icon>
          <div class="text-h6 font-weight-bold text-white">Aucun match à venir</div>
          <div class="text-caption text-zinc-400 mt-1">
            Les dates des prochaines journées n'ont pas encore été annoncées.
          </div>
        </div>

        <div v-else class="d-flex flex-column gap-4">
          <!-- Matchs groupés par date -->
          <div
            v-for="(group, dateKey) in groupedUpcomingMatches"
            :key="dateKey"
            class="date-group-card"
          >
            <div class="date-header d-flex align-center gap-2 px-4 py-2.5 rounded-t-xl bg-[#1a1a1e]">
              <v-icon size="16" color="primary">mdi-calendar</v-icon>
              <span class="text-caption font-weight-black text-white text-capitalize">
                {{ formatFullDate(dateKey) }}
              </span>
              <span class="text-caption text-zinc-500 font-mono">
                ({{ group.length }} {{ group.length > 1 ? 'matchs' : 'match' }})
              </span>
            </div>

            <v-card color="#161618" rounded="b-2xl" class="pa-3" elevation="0">
              <div class="d-flex flex-column gap-2">
                <MatchCard
                  v-for="m in group"
                  :key="m.id"
                  :match="m"
                  :is-favorite="isMatchFavorite(m.id)"
                  @select="goToMatch(m.id)"
                  @toggle-favorite="toggleMatchFavorite"
                />
              </div>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ═══════════════ ONGLET 3 : RÉSULTATS (RESULTS) ═══════════════ -->
      <div v-else-if="activeTab === 'results'" class="d-flex flex-column gap-5">
        <div v-if="finishedMatches.length === 0" class="text-center py-16">
          <v-icon size="48" color="zinc-600" class="mb-3">mdi-scoreboard-outline</v-icon>
          <div class="text-h6 font-weight-bold text-white">Aucun résultat disponible</div>
          <div class="text-caption text-zinc-400 mt-1">
            Aucun match terminé n'a été enregistré récemment pour cette ligue.
          </div>
        </div>

        <div v-else class="d-flex flex-column gap-4">
          <!-- Matchs terminés groupés par date -->
          <div
            v-for="(group, dateKey) in groupedFinishedMatches"
            :key="dateKey"
            class="date-group-card"
          >
            <div class="date-header d-flex align-center gap-2 px-4 py-2.5 rounded-t-xl bg-[#1a1a1e]">
              <v-icon size="16" color="success">mdi-calendar-check</v-icon>
              <span class="text-caption font-weight-black text-white text-capitalize">
                {{ formatFullDate(dateKey) }}
              </span>
              <span class="text-caption text-zinc-500 font-mono">
                ({{ group.length }} {{ group.length > 1 ? 'matchs' : 'match' }})
              </span>
            </div>

            <v-card color="#161618" rounded="b-2xl" class="pa-3" elevation="0">
              <div class="d-flex flex-column gap-2">
                <MatchCard
                  v-for="m in group"
                  :key="m.id"
                  :match="m"
                  :is-favorite="isMatchFavorite(m.id)"
                  @select="goToMatch(m.id)"
                  @toggle-favorite="toggleMatchFavorite"
                />
              </div>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ═══════════════ ONGLET 4 : CLASSEMENT COMPLET ═══════════════ -->
      <div v-else-if="activeTab === 'standings'" class="d-flex flex-column gap-5">
        <v-card color="#161618" rounded="2xl" class="overflow-hidden" elevation="0">
          <div class="px-5 py-4 d-flex align-center justify-space-between flex-wrap gap-3">
            <div>
              <h2 class="text-h6 font-weight-black text-white">Classement complet</h2>
              <div class="text-caption text-zinc-400 mt-0.5">
                {{ competitionName }} • Saison {{ currentSeasonLabel }}
              </div>
            </div>

            <!-- Légende rapide -->
            <div class="d-flex align-center flex-wrap gap-3 text-[11px] text-zinc-400">
              <span class="d-flex align-center gap-1.5">
                <span class="legend-dot" style="background-color: #3b82f6;"></span>
                Champions League
              </span>
              <span class="d-flex align-center gap-1.5">
                <span class="legend-dot" style="background-color: #f97316;"></span>
                Europa League
              </span>
              <span class="d-flex align-center gap-1.5">
                <span class="legend-dot" style="background-color: #ef4444;"></span>
                Relégation
              </span>
            </div>
          </div>

          <v-divider color="rgba(255, 255, 255, 0.05)" />

          <!-- Standings Table -->
          <div v-if="allStandingsEntries.length === 0" class="pa-12 text-center text-caption text-zinc-500">
            Aucun classement disponible pour cette compétition ou cette saison.
          </div>
          <div v-else class="table-responsive">
            <table class="standings-table w-100">
              <thead>
                <tr class="table-head-row text-[11px] text-zinc-400 text-uppercase">
                  <th class="text-center py-3 px-3" style="width: 48px;">#</th>
                  <th class="text-left py-3 px-3">Équipe</th>
                  <th class="text-center py-3 px-2" style="width: 44px;">J</th>
                  <th class="text-center py-3 px-2" style="width: 44px;">G</th>
                  <th class="text-center py-3 px-2" style="width: 44px;">N</th>
                  <th class="text-center py-3 px-2" style="width: 44px;">P</th>
                  <th class="text-center py-3 px-2 d-none d-sm-table-cell" style="width: 44px;">BP</th>
                  <th class="text-center py-3 px-2 d-none d-sm-table-cell" style="width: 44px;">BC</th>
                  <th class="text-center py-3 px-2" style="width: 48px;">Diff</th>
                  <th class="text-center py-3 px-3 font-weight-black text-white" style="width: 54px;">Pts</th>
                </tr>
              </thead>
              <tbody class="divide-dark">
                <tr
                  v-for="entry in allStandingsEntries"
                  :key="entry.team.id"
                  class="table-body-row hover:bg-white/5 transition-colors"
                >
                  <!-- Position avec couleur de zone -->
                  <td class="text-center py-3 px-3 font-mono font-weight-bold text-caption text-zinc-300 position-relative">
                    <span
                      class="rank-indicator-strip"
                      :style="{ backgroundColor: getRankColor(entry.rank) }"
                      aria-hidden="true"
                    />
                    {{ entry.rank }}
                  </td>

                  <!-- Nom et Logo Équipe -->
                  <td class="py-3 px-3">
                    <div class="d-flex align-center gap-2.5 min-w-0">
                      <TeamLogo :src="entry.team.logo" :name="entry.team.name" :size="24" class="flex-shrink-0" />
                      <span class="text-body-2 font-weight-bold text-white text-truncate">{{ entry.team.name }}</span>
                    </div>
                  </td>

                  <td class="text-center py-3 px-2 font-mono text-caption text-zinc-300">{{ entry.gamesPlayed }}</td>
                  <td class="text-center py-3 px-2 font-mono text-caption text-zinc-300">{{ entry.wins }}</td>
                  <td class="text-center py-3 px-2 font-mono text-caption text-zinc-400">{{ entry.ties }}</td>
                  <td class="text-center py-3 px-2 font-mono text-caption text-zinc-400">{{ entry.losses }}</td>
                  <td class="text-center py-3 px-2 font-mono text-caption text-zinc-400 d-none d-sm-table-cell">{{ entry.goalsFor }}</td>
                  <td class="text-center py-3 px-2 font-mono text-caption text-zinc-400 d-none d-sm-table-cell">{{ entry.goalsAgainst }}</td>
                  <td
                    class="text-center py-3 px-2 font-mono text-caption font-weight-bold"
                    :class="entry.goalDifference > 0 ? 'text-success' : entry.goalDifference < 0 ? 'text-error' : 'text-zinc-400'"
                  >
                    {{ entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference }}
                  </td>
                  <td class="text-center py-3 px-3 font-mono font-weight-black text-body-1 text-primary">
                    {{ entry.points }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </v-card>
      </div>

      <!-- ═══════════════ ONGLET 5 : STATS & BUTEURS (LEADERS) ═══════════════ -->
      <div v-else-if="activeTab === 'stats'" class="d-flex flex-column gap-6">
        <div v-if="leadersCategories.length === 0" class="text-center py-16">
          <v-icon size="48" color="zinc-600" class="mb-3">mdi-chart-bar</v-icon>
          <div class="text-h6 font-weight-bold text-white">Aucune statistique disponible</div>
          <div class="text-caption text-zinc-400 mt-1">
            Les statistiques des joueurs ne sont pas encore publiées pour cette compétition.
          </div>
        </div>

        <div v-else class="d-flex flex-column gap-6">
          <!-- Cartes par catégorie de stats (Buteurs, Passeurs...) -->
          <v-card
            v-for="cat in leadersCategories"
            :key="cat.name"
            color="#161618"
            rounded="2xl"
            class="overflow-hidden"
            elevation="0"
          >
            <div class="section-header px-5 py-4 d-flex align-center justify-space-between">
              <div class="d-flex align-center gap-2">
                <v-icon size="20" color="primary">mdi-soccer</v-icon>
                <h3 class="text-h6 font-weight-black text-white">{{ cat.displayName }}</h3>
              </div>
              <span class="text-caption text-zinc-400 font-weight-medium">
                {{ cat.leaders.length }} joueurs
              </span>
            </div>

            <v-divider color="rgba(255, 255, 255, 0.05)" />

            <!-- Liste des leaders -->
            <div class="divide-dark">
              <div
                v-for="leader in cat.leaders.slice(0, 15)"
                :key="leader.athlete.id"
                class="d-flex align-center justify-space-between px-5 py-3 hover:bg-white/5 transition-colors"
              >
                <!-- Rang & Joueur -->
                <div class="d-flex align-center gap-3 min-w-0">
                  <span
                    class="font-mono font-weight-black text-caption text-center"
                    style="width: 28px;"
                    :class="leader.rank === 1 ? 'text-amber-darken-1' : leader.rank === 2 ? 'text-zinc-300' : leader.rank === 3 ? 'text-amber-darken-3' : 'text-zinc-500'"
                  >
                    {{ leader.rank }}
                  </span>

                  <!-- Avatar / Photo Joueur -->
                  <v-avatar size="36" color="#202024" class="flex-shrink-0">
                    <v-img
                      v-if="leader.athlete.headshot"
                      :src="leader.athlete.headshot"
                      :alt="leader.athlete.displayName"
                    />
                    <v-icon v-else size="18" color="zinc-500">mdi-account</v-icon>
                  </v-avatar>

                  <div class="min-w-0">
                    <div class="text-body-2 font-weight-bold text-white text-truncate">
                      {{ leader.athlete.displayName }}
                    </div>
                    <div class="text-caption text-zinc-400 text-truncate">
                      {{ leader.displayValue || `Rang #${leader.rank}` }}
                    </div>
                  </div>
                </div>

                <!-- Buts / Valeur -->
                <div class="text-right flex-shrink-0 font-mono font-weight-black text-h6 text-primary">
                  {{ leader.value }}
                </div>
              </div>
            </div>
          </v-card>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchCompetitionDetails,
  fetchCompetitionMatches,
  fetchCompetitionLeaders,
} from '../services/api';
import type {
  CompetitionDetails,
  CompetitionSeason,
  StandingEntry,
  SportMatch,
  CompetitionLeadersCategory,
} from '../types/matches';
import TeamLogo from '../components/TeamLogo.vue';
import MatchCard from '../components/MatchCard.vue';

const route = useRoute();
const router = useRouter();

const leagueId = computed(() => String(route.params.id || ''));

// État
const isLoading = ref<boolean>(true);
const competitionData = ref<CompetitionDetails | null>(null);
const allMatches = ref<SportMatch[]>([]);
const leadersCategories = ref<CompetitionLeadersCategory[]>([]);
const selectedSeason = ref<number | string>('');

// Onglet actif
type TabId = 'overview' | 'fixtures' | 'results' | 'standings' | 'stats';
const activeTab = ref<TabId>('overview');

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'overview', label: 'Aperçu', icon: 'mdi-view-dashboard-outline' },
  { id: 'fixtures', label: 'Rencontres', icon: 'mdi-calendar-clock' },
  { id: 'results', label: 'Résultats', icon: 'mdi-check-circle-outline' },
  { id: 'standings', label: 'Classement', icon: 'mdi-format-list-numbered' },
  { id: 'stats', label: 'Buteurs & Stats', icon: 'mdi-chart-bar' },
];

// Favoris ligues dans localStorage
const FAVORITE_LEAGUES_KEY = 'chillers_favorite_leagues';
const favoriteLeagues = ref<string[]>([]);
try {
  const saved = localStorage.getItem(FAVORITE_LEAGUES_KEY);
  if (saved) favoriteLeagues.value = JSON.parse(saved);
} catch {}

const isLeagueFavorite = computed(() => favoriteLeagues.value.includes(leagueId.value));

function toggleLeagueFavorite() {
  if (isLeagueFavorite.value) {
    favoriteLeagues.value = favoriteLeagues.value.filter((id) => id !== leagueId.value);
  } else {
    favoriteLeagues.value.push(leagueId.value);
  }
  try {
    localStorage.setItem(FAVORITE_LEAGUES_KEY, JSON.stringify(favoriteLeagues.value));
  } catch {}
}

// Favoris matchs dans localStorage
const FAVORITE_MATCHES_KEY = 'chillers_matches_favorites';
const favoriteMatches = ref<string[]>([]);
try {
  const saved = localStorage.getItem(FAVORITE_MATCHES_KEY);
  if (saved) favoriteMatches.value = JSON.parse(saved);
} catch {}

function isMatchFavorite(id: string): boolean {
  return favoriteMatches.value.includes(id);
}

function toggleMatchFavorite(id: string) {
  if (isMatchFavorite(id)) {
    favoriteMatches.value = favoriteMatches.value.filter((mId) => mId !== id);
  } else {
    favoriteMatches.value.push(id);
  }
  try {
    localStorage.setItem(FAVORITE_MATCHES_KEY, JSON.stringify(favoriteMatches.value));
  } catch {}
}

// Métadonnées de la compétition
const competitionName = computed(() => {
  return competitionData.value?.league?.name || leagueId.value.toUpperCase();
});

const competitionCountry = computed(() => {
  return competitionData.value?.league?.country || 'International';
});

const competitionSport = computed(() => {
  return competitionData.value?.league?.sport === 'basketball' ? 'Basketball' : 'Football';
});

const leagueLogo = computed(() => {
  return competitionData.value?.league?.logo;
});

const leagueFlag = computed(() => {
  return competitionData.value?.league?.flag;
});

const hasStandings = computed(() => {
  return Boolean(competitionData.value?.hasStandings && allStandingsEntries.value.length > 0);
});

const availableSeasons = computed<CompetitionSeason[]>(() => {
  return competitionData.value?.seasons || [];
});

const currentSeasonLabel = computed(() => {
  const s = availableSeasons.value.find((season) => season.year === selectedSeason.value);
  return s?.displayName || selectedSeason.value || '';
});

// Classement aplati
const allStandingsEntries = computed<StandingEntry[]>(() => {
  const groups = competitionData.value?.standings || [];
  return groups.flatMap((g) => g.entries || []);
});

const topFiveStandings = computed(() => {
  return allStandingsEntries.value.slice(0, 5);
});

// Matchs filtrés
const upcomingMatches = computed(() => {
  return allMatches.value.filter((m) => m.status === 'upcoming' || m.status === 'live');
});

const finishedMatches = computed(() => {
  return allMatches.value.filter((m) => m.status === 'finished');
});

const overviewUpcoming = computed(() => {
  return upcomingMatches.value.slice(0, 5);
});

const overviewFinished = computed(() => {
  return finishedMatches.value.slice(0, 5);
});

// Groupement des matchs par date
const groupedUpcomingMatches = computed(() => {
  const groups: Record<string, SportMatch[]> = {};
  for (const m of upcomingMatches.value) {
    const key = m.startTime ? m.startTime.slice(0, 10) : 'Date à confirmer';
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
});

const groupedFinishedMatches = computed(() => {
  const groups: Record<string, SportMatch[]> = {};
  for (const m of finishedMatches.value) {
    const key = m.startTime ? m.startTime.slice(0, 10) : 'Date à confirmer';
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
});

// Chargement des données
async function loadCompetition() {
  isLoading.value = true;
  try {
    const [details, matches, leaders] = await Promise.all([
      fetchCompetitionDetails(leagueId.value, selectedSeason.value || undefined),
      fetchCompetitionMatches(leagueId.value, { season: selectedSeason.value || undefined }),
      fetchCompetitionLeaders(leagueId.value),
    ]);

    competitionData.value = details;
    allMatches.value = matches;
    leadersCategories.value = leaders;

    if (!selectedSeason.value && details?.currentSeason) {
      selectedSeason.value = details.currentSeason;
    }
  } catch (err) {
    console.error('[CompetitionDetailView] Error loading competition data:', err);
  } finally {
    isLoading.value = false;
  }
}

function onSeasonChange(newSeason: number | string) {
  selectedSeason.value = newSeason;
  loadCompetition();
}

function goToMatch(id: string) {
  router.push(`/match/${encodeURIComponent(id)}?league=${encodeURIComponent(leagueId.value)}`);
}

function goBack() {
  router.push('/');
}

// Formatage Date / Heure
function formatFullDate(isoOrKey: string): string {
  try {
    const d = new Date(isoOrKey);
    if (isNaN(d.getTime())) return isoOrKey;
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoOrKey;
  }
}

// Couleurs zones de classement
function getRankColor(rank: number): string {
  if (rank <= 4) return '#3b82f6'; // Ligue des Champions
  if (rank === 5) return '#f97316'; // Europa League
  if (rank === 6) return '#10b981'; // Conférence League
  if (rank >= 18) return '#ef4444'; // Relégation
  return 'transparent';
}

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      selectedSeason.value = '';
      loadCompetition();
    }
  }
);

onMounted(() => {
  loadCompetition();
});
</script>

<style scoped>
.competition-view {
  min-height: calc(100vh - 80px);
}

.max-w-1100 {
  max-width: 1100px;
  margin: 0 auto;
}

/* 1. Header Card */
.header-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.header-glow {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(229, 9, 20, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.league-logo-wrapper {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
}

.emoji-flag {
  font-size: 34px;
}

.country-flag-icon {
  font-size: 20px;
  vertical-align: middle;
}

/* 2. Tabs */
.tabs-container {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 4px;
}

.tab-btn {
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
}

.tab-count-pill {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 10px;
}

/* 3. Section Cards & Match Rows */
.section-card {
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.match-row-item {
  transition: background-color 0.15s ease;
}

.match-row-item:hover {
  background-color: rgba(255, 255, 255, 0.035);
}

.row-divider {
  width: 1px;
  height: 28px;
  background-color: rgba(255, 255, 255, 0.08);
}

.divide-dark > *:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
}

.bg-surface-darken {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 4. Standings Table */
.standings-table {
  border-collapse: collapse;
}

.table-head-row {
  background-color: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.table-body-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
  color: #fff;
}

.rank-indicator-strip {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3.5px;
  border-radius: 0 2px 2px 0;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.table-responsive {
  overflow-x: auto;
}

/* Utilitaires */
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.gap-6 { gap: 24px; }

.crumb-link {
  text-decoration: none;
}

.crumb-link:hover {
  color: #fff !important;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
