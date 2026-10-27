<template>
  <div class="match-stats">
    <!-- ─── 1. En-tête : identification Domicile / Extérieur ─── -->
    <div class="stats-header">
      <div class="side side-home">
        <TeamLogo :src="home.logo" :name="home.name" :size="36" />
        <div class="side-meta">
          <span class="side-name">{{ home.name }}</span>
          <span class="side-tag">
            <i class="tag-dot tag-dot-home" />
            Domicile
          </span>
        </div>
      </div>

      <div class="header-center">
        <v-icon size="14" color="zinc-400">mdi-chart-box-outline</v-icon>
        <span>Statistiques</span>
      </div>

      <div class="side side-away">
        <div class="side-meta side-meta-away">
          <span class="side-name">{{ away.name }}</span>
          <span class="side-tag">
            <i class="tag-dot tag-dot-away" />
            Extérieur
          </span>
        </div>
        <TeamLogo :src="away.logo" :name="away.name" :size="36" />
      </div>
    </div>

    <!-- ─── 2. État vide ─── -->
    <div v-if="rows.length === 0" class="stats-empty">
      <v-icon size="34" color="zinc-500">mdi-chart-box-outline</v-icon>
      <div class="empty-title">Statistiques non disponibles</div>
      <div class="empty-sub">Les données comparatives de ce match ne sont pas encore remontées.</div>
    </div>

    <!-- ─── 3. Lignes de statistiques ─── -->
    <div v-else class="stats-list">
      <div v-for="row in rows" :key="row.key" class="stat-row">
        <div class="stat-topline">
          <span class="value-cell value-cell-home">
            <span
              class="stat-value"
              :class="row.lead === 'home' ? 'is-lead is-lead-home' : 'is-trail'"
            >
              {{ row.home }}
              <v-icon v-if="row.lead === 'home'" size="11" class="lead-mark">mdi-menu-up</v-icon>
            </span>
          </span>

          <span class="stat-label">
            <v-icon size="14" class="label-icon">{{ row.icon }}</v-icon>
            {{ row.label }}
          </span>

          <span class="value-cell value-cell-away">
            <span
              class="stat-value"
              :class="row.lead === 'away' ? 'is-lead is-lead-away' : 'is-trail'"
            >
              <v-icon v-if="row.lead === 'away'" size="11" class="lead-mark">mdi-menu-down</v-icon>
              {{ row.away }}
            </span>
          </span>
        </div>

        <div class="stat-track" role="presentation">
          <span class="seg seg-home" :style="{ width: row.homePct + '%' }" />
          <span class="seg seg-away" :style="{ width: row.awayPct + '%' }" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import TeamLogo from '../TeamLogo.vue';
import type { SportMatch, MatchSummary } from '../../types/matches';

interface StatRow {
  key: string;
  label: string;
  icon: string;
  home: string;
  away: string;
  homePct: number;
  awayPct: number;
  lead: 'home' | 'away' | 'equal';
}

const TARGETS: Array<{ name: string; label: string; icon: string }> = [
  { name: 'possessionPct', label: 'Possession', icon: 'mdi-chart-donut' },
  { name: 'totalShots', label: 'Tirs totaux', icon: 'mdi-soccer' },
  { name: 'shotsOnTarget', label: 'Tirs cadrés', icon: 'mdi-target' },
  { name: 'totalPasses', label: 'Passes', icon: 'mdi-arrow-right-bold-circle-outline' },
  { name: 'wonCorners', label: 'Corners', icon: 'mdi-flag-outline' },
  { name: 'foulsCommitted', label: 'Fautes', icon: 'mdi-gavel' },
  { name: 'yellowCards', label: 'Cartons jaunes', icon: 'mdi-card-outline' },
  { name: 'offsides', label: 'Hors-jeu', icon: 'mdi-run-fast' },
  { name: 'saves', label: 'Arrêts', icon: 'mdi-hand-front-right' },
];

const props = defineProps({
  match: {
    type: Object as PropType<SportMatch>,
    required: true,
  },
  summary: {
    type: Object as PropType<MatchSummary | null>,
    default: null,
  },
});

const home = computed(() => props.summary?.homeTeam ?? props.match.homeTeam);
const away = computed(() => props.summary?.awayTeam ?? props.match.awayTeam);

function toNum(value?: string): number {
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const rows = computed<StatRow[]>(() => {
  const boxscore = props.summary?.boxscore;
  if (!boxscore || boxscore.length < 2) return [];

  const homeStats = boxscore[0]?.statistics || [];
  const awayStats = boxscore[1]?.statistics || [];

  return TARGETS.map((target) => {
    const h = homeStats.find((s) => s.name === target.name);
    const a = awayStats.find((s) => s.name === target.name);
    if (!h && !a) return null;

    const homeValue = h?.displayValue || '0';
    const awayValue = a?.displayValue || '0';
    const homeNum = toNum(homeValue);
    const awayNum = toNum(awayValue);
    const total = homeNum + awayNum;
    const homePct = total === 0 ? 50 : Math.round((homeNum / total) * 100);

    return {
      key: target.name,
      label: target.label,
      icon: target.icon,
      home: homeValue,
      away: awayValue,
      homePct,
      awayPct: 100 - homePct,
      lead: homeNum > awayNum ? 'home' : awayNum > homeNum ? 'away' : 'equal',
    } as StatRow;
  }).filter((row): row is StatRow => row !== null);
});
</script>

<style scoped>
.match-stats {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ─── En-tête ─── */
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #1f1c2b;
}

.side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 0;
  min-width: 0;
}

.side-away {
  flex-direction: row-reverse;
}

.side-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.side-meta-away {
  align-items: flex-end;
  text-align: right;
}

.side-name {
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.side-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #71717a;
}

.tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-dot-home {
  background: #e50914;
  box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.18);
}

.tag-dot-away {
  background: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.header-center {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 5px 12px;
  border-radius: 999px;
  background: #161420;
  border: 1px solid #1f1c2b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a1a1aa;
  white-space: nowrap;
}

/* ─── État vide ─── */
.stats-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 34px 16px;
  border: 1px dashed #26233a;
  border-radius: 16px;
  background: #13111c;
}

.empty-title {
  font-size: 14px;
  font-weight: 800;
  color: #d4d4d8;
}

.empty-sub {
  font-size: 12px;
  color: #71717a;
  text-align: center;
  max-width: 360px;
}

/* ─── Lignes ─── */
.stats-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.stat-topline {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}

.value-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.value-cell-home {
  justify-content: flex-start;
}

.value-cell-away {
  justify-content: flex-end;
}

.stat-value {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 54px;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transition: color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease;
}

.is-lead {
  color: #fff;
}

.is-lead-home {
  background: rgba(229, 9, 20, 0.16);
  box-shadow: inset 0 0 0 1px rgba(229, 9, 20, 0.4);
}

.is-lead-away {
  background: rgba(59, 130, 246, 0.16);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.42);
}

.is-trail {
  color: #52525b;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
}

.lead-mark {
  opacity: 0.9;
}

.value-cell-home .lead-mark {
  color: #ef4444;
}

.value-cell-away .lead-mark {
  color: #60a5fa;
}

.stat-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #a1a1aa;
  white-space: nowrap;
  text-align: center;
}

.label-icon {
  color: #52525b;
  flex-shrink: 0;
}

/* ─── Barre comparative ─── */
.stat-track {
  display: flex;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: #1a1826;
}

.seg {
  height: 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.seg-home {
  background: linear-gradient(90deg, #7f1d1d 0%, #e50914 100%);
}

.seg-away {
  background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: inset 1px 0 0 rgba(0, 0, 0, 0.55);
}

/* ─── Responsive ─── */
@media (max-width: 600px) {
  .side-name {
    max-width: 92px;
    font-size: 12px;
  }

  .header-center span {
    display: none;
  }

  .header-center {
    padding: 5px 7px;
  }

  .stat-label {
    font-size: 11px;
    gap: 4px;
  }

  .stat-value {
    min-width: 46px;
    padding: 4px 7px;
    font-size: 12px;
  }
}
</style>
