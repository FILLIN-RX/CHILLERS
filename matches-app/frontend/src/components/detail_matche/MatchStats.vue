<template>
  <div class="match-stats">
    <!-- ─── État vide ─── -->
    <div v-if="rows.length === 0" class="stats-empty">
      <v-icon size="34" color="zinc-500">mdi-chart-box-outline</v-icon>
      <div class="empty-title">Statistiques non disponibles</div>
      <div class="empty-sub">Les données comparatives de ce match ne sont pas encore remontées.</div>
    </div>

    <!-- ─── Lignes de statistiques ─── -->
    <div v-else class="stats-list">
      <div v-for="row in rows" :key="row.key" class="stat-row">
        <div class="stat-topline">
          <span class="value-cell value-cell-home" :style="{ left: row.homePos + '%' }">
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

          <span class="value-cell value-cell-away" :style="{ left: row.awayPos + '%' }">
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
import type { SportMatch, MatchSummary } from '../../types/matches';

interface StatRow {
  key: string;
  label: string;
  icon: string;
  home: string;
  away: string;
  homePct: number;
  awayPct: number;
  homePos: number;
  awayPos: number;
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
      homePos: 25,
      awayPos: 75,
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

/* ─── État vide ─── */
.stats-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 34px 16px;
  border: 1px dashed #3a3a3a;
  border-radius: 16px;
  background: #1F1F1F;
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
}

.value-cell {
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  transform: translate(-50%, -50%);
  z-index: 1;
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
  background: #1F1F1F;
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
  .match-stats {
    gap: 12px;
  }

  .stats-list {
    gap: 12px;
  }

  .stat-row {
    gap: 5px;
  }

  .stat-topline {
    min-height: 22px;
  }

  .stat-label {
    font-size: 11px;
    gap: 4px;
  }

  .stat-value {
    min-width: 38px;
    padding: 3px 6px;
    font-size: 12px;
  }
}
</style>
