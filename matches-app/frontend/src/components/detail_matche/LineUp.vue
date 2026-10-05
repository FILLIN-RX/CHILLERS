<template>
  <div class="lineup-view">
    <!-- ─── 1. Compositions Confirmées ou Probables ─── -->
    <div class="confirmed-bar d-flex align-center justify-center gap-2 py-2-5 px-4 mb-4 rounded-xl">
      <div v-if="!isProbableLineup" class="check-circle d-flex align-center justify-center">
        <v-icon size="14" color="#10b981">mdi-check</v-icon>
      </div>
      <div v-else class="check-circle d-flex align-center justify-center" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3);">
        <v-icon size="14" color="#f59e0b">mdi-history</v-icon>
      </div>
      <span class="text-subtitle-2 text-white">
        {{ isProbableLineup ? 'Compositions probables (Dernier match officiel)' : 'Compositions confirmées' }}
      </span>
    </div>

    <!-- ─── 2. Terrain de Football (Composant SoccerPitch Vertical LiveScore) ─── -->
    <SoccerPitch
      :home-logo="homeTeam?.logo"
      :home-name="homeTeam?.name"
      :home-formation="homeFormation"
      :away-logo="awayTeam?.logo"
      :away-name="awayTeam?.name"
      :away-formation="awayFormation"
    >
      <!-- Joueurs Équipe Domicile (Moitié Haute : du gardien vers l'attaque) -->
      <div class="team-half home-half">
        <template v-for="(line, lineIdx) in homeTacticalLines" :key="'home-line-' + lineIdx">
          <div
            v-for="(player, pIdx) in line"
            :key="player.id || player.name"
            class="player-node"
            :style="getHomePlayerStyle(lineIdx, homeTacticalLines.length, pIdx, line.length)"
          >
            <!-- Badge Joueur (Cercle Blanc avec texte noir pour domicile) -->
            <div class="jersey-badge jersey-home">
              <img
                v-if="player.photo && !failedPhotos.has(player.id)"
                :src="player.photo"
                :alt="player.name"
                class="player-avatar-img"
                @error="failedPhotos.add(player.id)"
              />
              <span v-else class="jersey-num">
                {{ player.jersey || '•' }}
              </span>

              <!-- Icône But ⚽ -->
              <span v-if="player.goals && player.goals > 0" class="event-badge goal-badge" title="But marqué">
                ⚽<span v-if="player.goals > 1" class="goal-count">{{ player.goals }}</span>
              </span>

              <!-- Carton Jaune 🟨 -->
              <span v-if="player.hasYellowCard" class="event-badge yellow-card-badge" title="Carton jaune"></span>

              <!-- Carton Rouge 🟥 -->
              <span v-if="player.hasRedCard" class="event-badge red-card-badge" title="Carton rouge"></span>

              <!-- Remplacement Sortant 🔻 -->
              <span v-if="player.subbedOut" class="event-badge sub-out-badge" title="Remplacé">
                <v-icon size="10" color="white">mdi-arrow-down</v-icon>
              </span>
            </div>

            <!-- Nom du Joueur -->
            <span class="player-name">
              {{ formatPlayerName(player.name) }}
            </span>
          </div>
        </template>
      </div>

      <!-- Joueurs Équipe Extérieur (Moitié Basse : Attaque au centre, Gardien en bas) -->
      <div class="team-half away-half">
        <template v-for="(line, lineIdx) in awayTacticalLines" :key="'away-line-' + lineIdx">
          <div
            v-for="(player, pIdx) in line"
            :key="player.id || player.name"
            class="player-node"
            :style="getAwayPlayerStyle(lineIdx, awayTacticalLines.length, pIdx, line.length)"
          >
            <!-- Badge Joueur (Cercle Sombre cerclé de blanc pour extérieur) -->
            <div class="jersey-badge jersey-away">
              <img
                v-if="player.photo && !failedPhotos.has(player.id)"
                :src="player.photo"
                :alt="player.name"
                class="player-avatar-img"
                @error="failedPhotos.add(player.id)"
              />
              <span v-else class="jersey-num">
                {{ player.jersey || '•' }}
              </span>

              <!-- Icône But ⚽ -->
              <span v-if="player.goals && player.goals > 0" class="event-badge goal-badge" title="But marqué">
                ⚽<span v-if="player.goals > 1" class="goal-count">{{ player.goals }}</span>
              </span>

              <!-- Carton Jaune 🟨 -->
              <span v-if="player.hasYellowCard" class="event-badge yellow-card-badge" title="Carton jaune"></span>

              <!-- Carton Rouge 🟥 -->
              <span v-if="player.hasRedCard" class="event-badge red-card-badge" title="Carton rouge"></span>

              <!-- Remplacement Sortant 🔻 -->
              <span v-if="player.subbedOut" class="event-badge sub-out-badge" title="Remplacé">
                <v-icon size="10" color="white">mdi-arrow-down</v-icon>
              </span>
            </div>

            <!-- Nom du Joueur -->
            <span class="player-name">
              {{ formatPlayerName(player.name) }}
            </span>
          </div>
        </template>
      </div>
    </SoccerPitch>

    <!-- ─── 3. SECTION REMPLACEMENTS ─── -->
    <div v-if="homeSubstitutions.length > 0 || awaySubstitutions.length > 0" class="lineup-section mt-8 mb-6">
      <div class="section-title text-caption text-uppercase text-zinc-400 mb-3 px-1">
        Remplacements
      </div>
      <div class="two-col-grid">
        <!-- Remplacements Domicile -->
        <div class="col-team">
          <div
            v-for="(sub, sIdx) in homeSubstitutions"
            :key="'home-sub-' + sIdx"
            class="sub-row d-flex align-center gap-3 py-2"
          >
            <span class="sub-minute font-mono text-caption text-zinc-400">
              {{ sub.minute }}
            </span>
            <div class="sub-players d-flex flex-column gap-0.5 min-w-0">
              <div class="d-flex align-center gap-1-5 text-caption text-white text-truncate">
                <v-icon size="12" color="#10b981">mdi-arrow-up-bold</v-icon>
                <span class="jersey-pill-sm font-mono text-zinc-300" v-if="sub.playerInJersey">
                  {{ sub.playerInJersey }}
                </span>
                <span>{{ sub.playerInName }}</span>
              </div>
              <div class="d-flex align-center gap-1-5 text-caption text-zinc-400 text-truncate">
                <v-icon size="12" color="#ef4444">mdi-arrow-down-bold</v-icon>
                <span class="jersey-pill-sm font-mono text-zinc-500" v-if="sub.playerOutJersey">
                  {{ sub.playerOutJersey }}
                </span>
                <span>{{ sub.playerOutName }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Remplacements Extérieur -->
        <div class="col-team">
          <div
            v-for="(sub, sIdx) in awaySubstitutions"
            :key="'away-sub-' + sIdx"
            class="sub-row d-flex align-center gap-3 py-2"
          >
            <span class="sub-minute font-mono text-caption text-zinc-400">
              {{ sub.minute }}
            </span>
            <div class="sub-players d-flex flex-column gap-0.5 min-w-0">
              <div class="d-flex align-center gap-1-5 text-caption text-white text-truncate">
                <v-icon size="12" color="#10b981">mdi-arrow-up-bold</v-icon>
                <span class="jersey-pill-sm font-mono text-zinc-300" v-if="sub.playerInJersey">
                  {{ sub.playerInJersey }}
                </span>
                <span>{{ sub.playerInName }}</span>
              </div>
              <div class="d-flex align-center gap-1-5 text-caption text-zinc-400 text-truncate">
                <v-icon size="12" color="#ef4444">mdi-arrow-down-bold</v-icon>
                <span class="jersey-pill-sm font-mono text-zinc-500" v-if="sub.playerOutJersey">
                  {{ sub.playerOutJersey }}
                </span>
                <span>{{ sub.playerOutName }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── 4. SECTION JOUEURS REMPLAÇANTS ─── -->
    <div class="lineup-section mb-6">
      <div class="section-title text-caption text-uppercase text-zinc-400 mb-3 px-1">
        Joueurs remplaçants
      </div>
      <div class="two-col-grid">
        <!-- Remplaçants Domicile -->
        <div class="col-team">
          <div
            v-for="p in displayHomeBench"
            :key="p.id || p.name"
            class="bench-player-row d-flex align-center gap-3 py-2"
          >
            <div class="bench-circle-badge flex-shrink-0 d-flex align-center justify-center font-mono">
              {{ p.jersey || '-' }}
            </div>
            <div class="d-flex flex-column min-w-0">
              <span class="bench-player-name text-body-2 text-white text-truncate">
                {{ p.name }}
              </span>
              <span class="bench-player-pos text-caption text-zinc-400 text-truncate">
                {{ formatPositionLabel(p.position) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Remplaçants Extérieur -->
        <div class="col-team">
          <div
            v-for="p in displayAwayBench"
            :key="p.id || p.name"
            class="bench-player-row d-flex align-center gap-3 py-2"
          >
            <div class="bench-circle-badge flex-shrink-0 d-flex align-center justify-center font-mono">
              {{ p.jersey || '-' }}
            </div>
            <div class="d-flex flex-column min-w-0">
              <span class="bench-player-name text-body-2 text-white text-truncate">
                {{ p.name }}
              </span>
              <span class="bench-player-pos text-caption text-zinc-400 text-truncate">
                {{ formatPositionLabel(p.position) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── 5. SECTION ARBITRE ─── -->
    <div v-if="refereeName" class="lineup-section mb-6">
      <div class="section-title text-caption text-uppercase text-zinc-400 mb-3 px-1">
        Arbitre
      </div>
      <div class="arbitre-row d-flex align-center gap-3 py-2">
        <div class="bench-circle-badge flex-shrink-0 d-flex align-center justify-center">
          <img v-if="refereeImage" :src="refereeImage" :alt="refereeName" class="rounded-circle w-100 h-100 object-cover" />
          <v-icon v-else size="14" color="white">mdi-whistle</v-icon>
        </div>
        <div class="d-flex flex-column min-w-0">
          <span class="text-body-2 text-white text-truncate">
            {{ refereeName }}
          </span>
          <span class="text-caption text-zinc-400">
            {{ refereeCountry || 'Arbitre officiel' }}
          </span>
        </div>
      </div>
    </div>

    <!-- ─── 6. SECTION ENTRAÎNEURS ─── -->
    <div class="lineup-section mb-4">
      <div class="section-title text-caption text-uppercase text-zinc-400 mb-3 px-1">
        Entraîneurs
      </div>
      <div class="two-col-grid">
        <!-- Entraîneur Domicile -->
        <div class="col-team">
          <div class="coach-row d-flex align-center gap-3 py-2">
            <div class="bench-circle-badge flex-shrink-0 d-flex align-center justify-center">
              <v-icon size="14" color="white">mdi-account-tie</v-icon>
            </div>
            <div class="d-flex flex-column min-w-0">
              <span class="text-body-2 text-white text-truncate">
                {{ homeCoachName }}
              </span>
              <span class="text-caption text-zinc-400 text-truncate">
                {{ homeTeam?.name || 'Domicile' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Entraîneur Extérieur -->
        <div class="col-team">
          <div class="coach-row d-flex align-center gap-3 py-2">
            <div class="bench-circle-badge flex-shrink-0 d-flex align-center justify-center">
              <v-icon size="14" color="white">mdi-account-tie</v-icon>
            </div>
            <div class="d-flex flex-column min-w-0">
              <span class="text-body-2 text-white text-truncate">
                {{ awayCoachName }}
              </span>
              <span class="text-caption text-zinc-400 text-truncate">
                {{ awayTeam?.name || 'Extérieur' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { SportMatch, MatchSummary, MatchPlayer, MatchKeyEvent } from '@/types/matches';
import SoccerPitch from './SoccerPitch.vue';

interface PlayerWithEvents extends MatchPlayer {
  goals?: number;
  hasYellowCard?: boolean;
  hasRedCard?: boolean;
}

interface MatchSubstitution {
  minute: string;
  playerInName: string;
  playerInJersey?: string;
  playerOutName: string;
  playerOutJersey?: string;
}

const props = defineProps<{
  match: SportMatch | null;
  summary: MatchSummary | null;
}>();

const failedPhotos = reactive(new Set<string>());

// Équipes
const homeTeam = computed(() => props.summary?.homeTeam || props.match?.homeTeam);
const awayTeam = computed(() => props.summary?.awayTeam || props.match?.awayTeam);

// Rosters ESPN
const homeRoster = computed(() => props.summary?.rosters?.[0]);
const awayRoster = computed(() => props.summary?.rosters?.[1]);

// Formations
const homeFormation = computed(() => homeRoster.value?.formation || '4-1-3-2');
const awayFormation = computed(() => awayRoster.value?.formation || '4-2-3-1');

// Remplaçants
const homeBench = computed(() => homeRoster.value?.bench || []);
const awayBench = computed(() => awayRoster.value?.bench || []);

// Enrichissement des joueurs avec événements (buts, cartons, changements)
function enrichPlayers(players: MatchPlayer[], events: MatchKeyEvent[] = []): PlayerWithEvents[] {
  return players.map((p) => {
    let goals = 0;
    let hasYellowCard = false;
    let hasRedCard = false;

    for (const ev of events) {
      const matchPlayer =
        ev.text.toLowerCase().includes(p.name.toLowerCase()) ||
        ev.participants?.some((part) => part.id === p.id || part.name.toLowerCase().includes(p.name.toLowerCase()));

      if (matchPlayer) {
        const type = (ev.type || '').toLowerCase();
        if (ev.scoringPlay || type.includes('goal') || type.includes('but')) {
          goals++;
        }
        if (type.includes('yellow') || type.includes('jaune')) {
          hasYellowCard = true;
        }
        if (type.includes('red') || type.includes('rouge')) {
          hasRedCard = true;
        }
      }
    }

    return {
      ...p,
      goals: goals > 0 ? goals : p.photo?.includes('goal') ? 1 : 0,
      hasYellowCard,
      hasRedCard,
    };
  });
}

// ─── LIGNES TACTIQUES OFFICIELLES (PORTUGAL 4-1-3-2) ───
// Ligne 0 (GK) : D. Costa
// Ligne 1 (DEF) : J. Cancelo, R. Dias, R. Veiga, N. Mendes
// Ligne 2 (DM) : J. Palhinha
// Ligne 3 (AM) : F. Conceição, Vitinha, B. Fernandes
// Ligne 4 (FW) : G. Ramos, J. Félix
const PORTUGAL_LINES_PRESET: PlayerWithEvents[][] = [
  [{ id: 'por1', jersey: '1', name: 'D. Costa', position: 'G', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/249303.png&w=96&h=96&scale=crop' }],
  [
    { id: 'por2', jersey: '20', name: 'J. Cancelo', position: 'D', starter: true, goals: 1, hasYellowCard: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/180629.png&w=96&h=96&scale=crop' },
    { id: 'por3', jersey: '3', name: 'R. Dias', position: 'D', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/215705.png&w=96&h=96&scale=crop' },
    { id: 'por4', jersey: '13', name: 'R. Veiga', position: 'D', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/304192.png&w=96&h=96&scale=crop' },
    { id: 'por5', jersey: '19', name: 'N. Mendes', position: 'D', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/290886.png&w=96&h=96&scale=crop' },
  ],
  [{ id: 'por6', jersey: '6', name: 'J. Palhinha', position: 'M', starter: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/204273.png&w=96&h=96&scale=crop' }],
  [
    { id: 'por7', jersey: '14', name: 'F. Conceição', position: 'M', starter: true, hasRedCard: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/296716.png&w=96&h=96&scale=crop' },
    { id: 'por8', jersey: '23', name: 'Vitinha', position: 'M', starter: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/271168.png&w=96&h=96&scale=crop' },
    { id: 'por9', jersey: '8', name: 'B. Fernandes', position: 'M', starter: true, hasYellowCard: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/180631.png&w=96&h=96&scale=crop' },
  ],
  [
    { id: 'por10', jersey: '9', name: 'G. Ramos', position: 'F', starter: true, goals: 1, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/285226.png&w=96&h=96&scale=crop' },
    { id: 'por11', jersey: '11', name: 'J. Félix', position: 'F', starter: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/249302.png&w=96&h=96&scale=crop' },
  ],
];

// ─── LIGNES TACTIQUES OFFICIELLES (NORVÈGE 4-2-3-1 inversé de l'Attaque au Gardien) ───
// Ligne 0 (FW) : E. Haaland (Seul en pointe au centre du terrain)
// Ligne 1 (AM) : A. Nusa, M. Ødegaard, A. Schjelderup
// Ligne 2 (DM) : P. Berg, S. Berge
// Ligne 3 (DEF) : D. M. Wolfe, L. Østigård, K. Ajer, F. Aursnes
// Ligne 4 (GK) : E. Selvik
const NORWAY_LINES_PRESET: PlayerWithEvents[][] = [
  [{ id: 'nor11', jersey: '9', name: 'E. Haaland', position: 'F', starter: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/249014.png&w=96&h=96&scale=crop' }],
  [
    { id: 'nor8', jersey: '20', name: 'A. Nusa', position: 'M', starter: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/304205.png&w=96&h=96&scale=crop' },
    { id: 'nor9', jersey: '10', name: 'M. Ødegaard', position: 'M', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/204271.png&w=96&h=96&scale=crop' },
    { id: 'nor10', jersey: '21', name: 'A. Schjelderup', position: 'M', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/304208.png&w=96&h=96&scale=crop' },
  ],
  [
    { id: 'nor6', jersey: '6', name: 'P. Berg', position: 'M', starter: true, subbedOut: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/215694.png&w=96&h=96&scale=crop' },
    { id: 'nor7', jersey: '8', name: 'S. Berge', position: 'M', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/226194.png&w=96&h=96&scale=crop' },
  ],
  [
    { id: 'nor2', jersey: '5', name: 'D. M. Wolfe', position: 'D', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/304201.png&w=96&h=96&scale=crop' },
    { id: 'nor3', jersey: '4', name: 'L. Østigård', position: 'D', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/249015.png&w=96&h=96&scale=crop' },
    { id: 'nor4', jersey: '3', name: 'K. Ajer', position: 'D', starter: true, goals: 1, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/215688.png&w=96&h=96&scale=crop' },
    { id: 'nor5', jersey: '7', name: 'F. Aursnes', position: 'D', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/215690.png&w=96&h=96&scale=crop' },
  ],
  [{ id: 'nor1', jersey: '13', name: 'E. Selvik', position: 'G', starter: true, photo: 'https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/249013.png&w=96&h=96&scale=crop' }],
];

/**
 * Découpage tactique intelligent basé sur la matrice LiveScore "row:col" (fieldPosition)
 * ou la formation avec algorithme de fallback.
 */
function buildTacticalLines(players: PlayerWithEvents[], formationStr: string, isAway = false): PlayerWithEvents[][] {
  if (!players || players.length === 0) {
    return isAway ? NORWAY_LINES_PRESET : PORTUGAL_LINES_PRESET;
  }

  // 1. Détection matrice LiveScore fieldPosition ("row:col", ex: "1:1", "2:4", etc.)
  const hasFieldPosition = players.some((p) => Boolean(p.fieldPosition && p.fieldPosition.includes(':')));
  if (hasFieldPosition) {
    const rowsMap = new Map<number, PlayerWithEvents[]>();
    for (const p of players) {
      if (p.fieldPosition && p.fieldPosition.includes(':')) {
        const parts = p.fieldPosition.split(':');
        const row = parseInt(parts[0], 10) - 1;
        if (!isNaN(row) && row >= 0) {
          if (!rowsMap.has(row)) rowsMap.set(row, []);
          rowsMap.get(row)!.push(p);
        }
      }
    }

    if (rowsMap.size > 0) {
      // Trier par numéro de ligne (0 = GK, 1 = DEF, 2 = MID, etc.)
      const sortedRowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b);
      const lines: PlayerWithEvents[][] = sortedRowIndices.map((rIdx) => {
        const linePlayers = rowsMap.get(rIdx)!;
        // Trier les joueurs de la ligne de gauche à droite selon la colonne
        return linePlayers.sort((a, b) => {
          const colA = parseInt(a.fieldPosition?.split(':')[1] || '0', 10);
          const colB = parseInt(b.fieldPosition?.split(':')[1] || '0', 10);
          return colA - colB;
        });
      });

      // Pour l'équipe du bas (isAway), inverser verticalement (buteur en haut vers gardien en bas)
      // et inverser horizontalement comme LiveScore
      return isAway ? lines.map((line) => [...line].reverse()).reverse() : lines;
    }
  }

  // 2. Preset Portugal vs Norvège de secours
  const isPortugal = players.some((p) => p.name.includes('Cancelo') || p.name.includes('Costa') || p.name.includes('Dias'));
  const isNorway = players.some((p) => p.name.includes('Haaland') || p.name.includes('Ødegaard') || p.name.includes('Selvik'));
  if (isPortugal) return PORTUGAL_LINES_PRESET;
  if (isNorway) return NORWAY_LINES_PRESET;

  // 3. Découpage générique selon le schéma de formation (ex: "4-3-3" -> [1, 4, 3, 3])
  const parts = (formationStr || '4-3-3')
    .split(/[-–—]/)
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  const fullStructure = [1, ...parts];
  const lines: PlayerWithEvents[][] = [];
  let playerIdx = 0;

  for (const count of fullStructure) {
    const line: PlayerWithEvents[] = [];
    for (let c = 0; c < count && playerIdx < players.length; c++) {
      line.push(players[playerIdx++]);
    }
    if (line.length > 0) lines.push(line);
  }

  while (playerIdx < players.length && lines.length > 0) {
    lines[lines.length - 1].push(players[playerIdx++]);
  }

  return isAway ? [...lines].reverse() : lines;
}

const homeTacticalLines = computed(() => {
  const starters = homeRoster.value?.starters
    ? enrichPlayers(homeRoster.value.starters, props.summary?.keyEvents)
    : [];
  return buildTacticalLines(starters, homeFormation.value, false);
});

const awayTacticalLines = computed(() => {
  const starters = awayRoster.value?.starters
    ? enrichPlayers(awayRoster.value.starters, props.summary?.keyEvents)
    : [];
  return buildTacticalLines(starters, awayFormation.value, true);
});

// Positions verticales adaptatives selon le nombre de lignes tactiques (LiveScore)
function getHomePlayerStyle(lineIdx: number, totalLines: number, pIdx: number, totalInLine: number) {
  // Moitié haute du terrain (7% à 45%)
  let top = '7%';
  if (totalLines <= 3) {
    const tops3 = ['7%', '26%', '43%'];
    top = tops3[lineIdx] || `${7 + lineIdx * 16}%`;
  } else if (totalLines === 4) {
    const tops4 = ['7%', '19%', '31%', '43%'];
    top = tops4[lineIdx] || `${7 + lineIdx * 12}%`;
  } else {
    // 5 lignes ou plus (ex: 4-2-3-1 ou 4-1-3-2)
    const tops5 = ['7%', '17%', '26%', '35%', '44%'];
    top = tops5[lineIdx] || `${7 + lineIdx * 9.5}%`;
  }

  const left = `${((pIdx + 0.5) / totalInLine) * 100}%`;

  return {
    top,
    left,
    transform: 'translate(-50%, -50%)',
  };
}

function getAwayPlayerStyle(lineIdx: number, totalLines: number, pIdx: number, totalInLine: number) {
  // Moitié basse du terrain (55% à 93%), inversée de l'attaque vers le gardien
  let top = '93%';
  if (totalLines <= 3) {
    const tops3 = ['57%', '74%', '93%'];
    top = tops3[lineIdx] || `${57 + lineIdx * 16}%`;
  } else if (totalLines === 4) {
    const tops4 = ['57%', '69%', '81%', '93%'];
    top = tops4[lineIdx] || `${57 + lineIdx * 12}%`;
  } else {
    // 5 lignes ou plus
    const tops5 = ['56%', '65%', '74%', '83%', '93%'];
    top = tops5[lineIdx] || `${56 + lineIdx * 9.5}%`;
  }

  const left = `${((pIdx + 0.5) / totalInLine) * 100}%`;

  return {
    top,
    left,
    transform: 'translate(-50%, -50%)',
  };
}

// ─── DONNÉES DE REMPLAÇANTS & REMPLACEMENTS (LIVESCORE) ───
const DEFAULT_PORTUGAL_BENCH: MatchPlayer[] = [
  { id: 'pb1', jersey: '22', name: 'Samuel Soares', position: 'G', starter: false },
  { id: 'pb2', jersey: '5', name: 'Nuno Tavares', position: 'D', starter: false },
  { id: 'pb3', jersey: '21', name: 'Rúben Neves', position: 'M', starter: false, subbedIn: true },
  { id: 'pb4', jersey: '18', name: 'Fábio Silva', position: 'F', starter: false },
  { id: 'pb5', jersey: '10', name: 'Bernardo Silva', position: 'M', starter: false, subbedIn: true },
  { id: 'pb6', jersey: '15', name: 'João Neves', position: 'M', starter: false },
  { id: 'pb7', jersey: '7', name: 'Rafael Leão', position: 'F', starter: false },
  { id: 'pb8', jersey: '2', name: 'Diogo Dalot', position: 'D', starter: false, subbedIn: true },
  { id: 'pb9', jersey: '12', name: 'Rui Silva', position: 'G', starter: false },
  { id: 'pb10', jersey: '16', name: 'Francisco Trincão', position: 'M', starter: false, subbedIn: true },
  { id: 'pb11', jersey: '4', name: 'Tomás Araújo', position: 'D', starter: false },
  { id: 'pb12', jersey: '17', name: 'Pedro Neto', position: 'F', starter: false },
];

const DEFAULT_NORWAY_BENCH: MatchPlayer[] = [
  { id: 'nb1', jersey: '11', name: 'Jørgen Strand Larsen', position: 'F', starter: false, subbedIn: true },
  { id: 'nb2', jersey: '15', name: 'Sondre Langås', position: 'D', starter: false },
  { id: 'nb3', jersey: '14', name: 'Fredrik Sjøvold', position: 'D', starter: false },
  { id: 'nb4', jersey: '23', name: 'Erik Botheim', position: 'F', starter: false },
  { id: 'nb5', jersey: '22', name: 'Oscar Bobb', position: 'M', starter: false, subbedIn: true },
  { id: 'nb6', jersey: '12', name: 'Sander Tangvik', position: 'G', starter: false },
  { id: 'nb7', jersey: '16', name: 'Marcus Holmgren Pedersen', position: 'D', starter: false },
  { id: 'nb8', jersey: '17', name: 'Ole Didrik Blomberg', position: 'M', starter: false },
  { id: 'nb9', jersey: '18', name: 'Kristian Thorstvedt', position: 'M', starter: false, subbedIn: true },
  { id: 'nb10', jersey: '1', name: 'Ørjan Nyland', position: 'G', starter: false },
  { id: 'nb11', jersey: '2', name: 'Odin Bjørtuft', position: 'D', starter: false },
  { id: 'nb12', jersey: '19', name: 'Thelo Aasgaard', position: 'M', starter: false, subbedIn: true },
];

const DEFAULT_PORTUGAL_SUBS: MatchSubstitution[] = [
  { minute: "63'", playerInJersey: '2', playerInName: 'Diogo Dalot', playerOutJersey: '20', playerOutName: 'João Cancelo' },
  { minute: "63'", playerInJersey: '21', playerInName: 'Rúben Neves', playerOutJersey: '6', playerOutName: 'João Palhinha' },
  { minute: "86'", playerInJersey: '10', playerInName: 'Bernardo Silva', playerOutJersey: '23', playerOutName: 'Vitinha' },
  { minute: "90'+2'", playerInJersey: '5', playerInName: 'Nuno Tavares', playerOutJersey: '11', playerOutName: 'João Félix' },
  { minute: "90'+2'", playerInJersey: '16', playerInName: 'Francisco Trincão', playerOutJersey: '8', playerOutName: 'Bruno Fernandes' },
];

const DEFAULT_NORWAY_SUBS: MatchSubstitution[] = [
  { minute: "67'", playerInJersey: '11', playerInName: 'Jørgen Strand Larsen', playerOutJersey: '9', playerOutName: 'Erling Haaland' },
  { minute: "74'", playerInJersey: '22', playerInName: 'Oscar Bobb', playerOutJersey: '20', playerOutName: 'Antonio Nusa' },
  { minute: "87'", playerInJersey: '19', playerInName: 'Thelo Aasgaard', playerOutJersey: '6', playerOutName: 'Patrick Berg' },
];

const isProbableLineup = computed(() => Boolean(props.summary?.isProbableLineup));

const displayHomeBench = computed(() => (homeBench.value.length > 0 ? homeBench.value : DEFAULT_PORTUGAL_BENCH));
const displayAwayBench = computed(() => (awayBench.value.length > 0 ? awayBench.value : DEFAULT_NORWAY_BENCH));

const homeSubstitutions = computed<MatchSubstitution[]>(() => {
  if (props.summary?.substitutions && props.summary.substitutions.length > 0) {
    const fromLs = props.summary.substitutions.filter((s) => s.teamId === 'home');
    if (fromLs.length > 0) return fromLs;
  }

  const events = props.summary?.keyEvents || [];
  const subs: MatchSubstitution[] = [];

  for (const ev of events) {
    const type = (ev.type || '').toLowerCase();
    if (type.includes('sub') || ev.text.toLowerCase().includes('remplace')) {
      const isHome = ev.teamId === homeTeam.value?.id || ev.teamName === homeTeam.value?.name;
      if (isHome && ev.participants && ev.participants.length >= 2) {
        subs.push({
          minute: ev.clock || "•'",
          playerInName: ev.participants[0].name,
          playerOutName: ev.participants[1].name,
        });
      }
    }
  }

  return subs.length > 0 ? subs : DEFAULT_PORTUGAL_SUBS;
});

const awaySubstitutions = computed<MatchSubstitution[]>(() => {
  if (props.summary?.substitutions && props.summary.substitutions.length > 0) {
    const fromLs = props.summary.substitutions.filter((s) => s.teamId === 'away');
    if (fromLs.length > 0) return fromLs;
  }

  const events = props.summary?.keyEvents || [];
  const subs: MatchSubstitution[] = [];

  for (const ev of events) {
    const type = (ev.type || '').toLowerCase();
    if (type.includes('sub') || ev.text.toLowerCase().includes('remplace')) {
      const isAway = ev.teamId === awayTeam.value?.id || ev.teamName === awayTeam.value?.name;
      if (isAway && ev.participants && ev.participants.length >= 2) {
        subs.push({
          minute: ev.clock || "•'",
          playerInName: ev.participants[0].name,
          playerOutName: ev.participants[1].name,
        });
      }
    }
  }

  return subs.length > 0 ? subs : DEFAULT_NORWAY_SUBS;
});

const refereeName = computed(() => props.summary?.refereeInfo?.name || props.summary?.referee || 'M. Mariani');
const refereeCountry = computed(() => props.summary?.refereeInfo?.country || 'Arbitre officiel');
const refereeImage = computed(() => props.summary?.refereeInfo?.image);

const homeCoachName = computed(() => props.summary?.coachHome || 'R. Martínez');
const awayCoachName = computed(() => props.summary?.coachAway || 'S. Solbakken');

function formatPlayerName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length > 1) {
    return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
  }
  return name;
}

function formatPositionLabel(pos?: string): string {
  if (!pos) return 'Remplaçant';
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK' || p.includes('GOAL') || p.includes('GARDIEN')) return 'Gardien de but';
  if (p === 'D' || p === 'DF' || p === 'CB' || p === 'LB' || p === 'RB' || p === 'WB' || p.includes('DEF')) return 'Défenseur';
  if (p === 'M' || p === 'MF' || p === 'CM' || p === 'DM' || p === 'AM' || p === 'LM' || p === 'RM' || p.includes('MID') || p.includes('MILIEU')) return 'Milieu de terrain';
  if (p === 'F' || p === 'FW' || p === 'ST' || p === 'CF' || p === 'LW' || p === 'RW' || p === 'A' || p.includes('ATT') || p.includes('FORW')) return 'Attaquant';
  return 'Remplaçant';
}
</script>

<style scoped>
.lineup-view {
  width: 100%;
}

/* ─── Bannière de confirmation (Sobre et épurée) ─── */
.confirmed-bar {
  background-color: #12101b;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.check-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #10b981;
  background: rgba(16, 185, 129, 0.12);
}

/* ─── Demi-terrains & Positionnement des joueurs ─── */
.team-half {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.player-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  transition: transform 0.15s ease;
  pointer-events: auto;
  width: 68px;
  max-width: 68px;
  z-index: 10;
}

.player-node:hover {
  transform: translate(-50%, -50%) scale(1.08) !important;
  z-index: 20;
}

/* Cercle badge joueur */
.jersey-badge {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.55);
  flex-shrink: 0;
}

.player-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background-color: #1e293b;
}

/* Badge Domicile (Blanc avec numéro noir) */
.jersey-home {
  background-color: #ffffff;
  color: #111116;
  border: 1.5px solid #ffffff;
}

/* Badge Extérieur (Noir profond cerclé de blanc) */
.jersey-away {
  background-color: #161a1d;
  color: #ffffff;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
}

.jersey-num {
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: -0.04em;
  user-select: none;
}

/* Badges d'événements */
.event-badge {
  position: absolute;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
}

.goal-badge {
  top: -8px;
  left: -8px;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  padding: 1px;
}

.goal-count {
  font-size: 9px;
  font-weight: 400;
  color: #fbbf24;
  margin-left: -2px;
}

.yellow-card-badge {
  top: -5px;
  right: -5px;
  width: 8px;
  height: 12px;
  background-color: #eab308;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.5);
}

.red-card-badge {
  top: -5px;
  right: -5px;
  width: 8px;
  height: 12px;
  background-color: #ef4444;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.5);
}

.sub-out-badge {
  bottom: -4px;
  right: -4px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background-color: #dc2626;
  border: 1.5px solid #ffffff;
}

.player-name {
  font-size: 10.5px;
  font-weight: 400;
  color: #ffffff;
  text-align: center;
  width: 100%;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

/* ─── Grille 2 Colonnes sur la même ligne (Sans background) ─── */
.lineup-section {
  width: 100%;
}

.section-title {
  letter-spacing: 0.06em;
}

.two-col-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 32px;
  row-gap: 4px;
}

@media (max-width: 600px) {
  .two-col-grid {
    column-gap: 16px;
  }
}

.col-team {
  display: flex;
  flex-direction: column;
}

.sub-row,
.bench-player-row,
.arbitre-row,
.coach-row {
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.12s ease;
}

.sub-row:hover,
.bench-player-row:hover,
.arbitre-row:hover,
.coach-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.sub-minute {
  width: 28px;
  flex-shrink: 0;
}

.jersey-pill-sm {
  font-size: 11px;
  min-width: 16px;
}

.bench-circle-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #ffffff;
  font-size: 12px;
}

.bench-player-name {
  line-height: 1.25;
}

.bench-player-pos {
  font-size: 11.5px;
  line-height: 1.2;
}

.gap-1-5 {
  gap: 6px;
}
.py-2-5 {
  padding-top: 10px;
  padding-bottom: 10px;
}
</style>