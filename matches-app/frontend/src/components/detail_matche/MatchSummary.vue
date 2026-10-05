<template>
  <div class="match-summary">
    <!-- ─── 1. Sous-onglets Événements / Commentaire ─── -->
    <div class="seg-tabs" role="tablist">
      <button
        type="button"
        class="seg-tab"
        :class="{ 'is-active': tab === 'events' }"
        role="tab"
        :aria-selected="tab === 'events'"
        @click="tab = 'events'"
      >
        Événements
      </button>
      <button
        type="button"
        class="seg-tab"
        :class="{ 'is-active': tab === 'commentary' }"
        role="tab"
        :aria-selected="tab === 'commentary'"
        @click="openCommentary"
      >
        Commentaire
      </button>
    </div>

    <!-- ─── 2. Frise des événements ─── -->
    <div v-if="tab === 'events'" class="timeline-card">
      <div v-if="rows.length === 0" class="tl-empty">
        <v-icon size="30" color="zinc-500">mdi-soccer-field</v-icon>
        <div class="empty-title">Aucun événement marquant</div>
        <div class="empty-sub">Les temps forts de ce match ne sont pas encore disponibles.</div>
      </div>

      <template v-else>
        <div
          v-for="row in rows"
          :key="row.id"
          class="tl-row"
          :class="`row-${row.kind}`"
        >
          <div class="tl-clock">{{ row.clock }}</div>

          <!-- Ligne neutre (texte libre) -->
          <div v-if="row.kind === 'note'" class="tl-note">{{ row.text }}</div>

          <template v-else>
            <!-- Zone Domicile -->
            <div class="tl-side tl-side-home">
              <template v-if="row.kind === 'event' && row.side === 'home'">
                <div class="tl-players">
                  <span v-if="row.primary" class="p-main">{{ row.primary }}</span>
                  <span v-if="row.secondary" class="p-sub">{{ row.secondary }}</span>
                  <span v-if="!row.primary && row.fallback" class="p-fallback">{{ row.fallback }}</span>
                </div>
                <EventIcon v-if="row.icon" :kind="row.icon" />
              </template>
            </div>

            <!-- Score central -->
            <div class="tl-score">
              <span v-if="row.score">{{ row.score }}</span>
            </div>

            <!-- Zone Extérieur -->
            <div class="tl-side tl-side-away">
              <template v-if="row.kind === 'event' && row.side === 'away'">
                <EventIcon v-if="row.icon" :kind="row.icon" />
                <div class="tl-players tl-players-away">
                  <span v-if="row.primary" class="p-main">{{ row.primary }}</span>
                  <span v-if="row.secondary" class="p-sub">{{ row.secondary }}</span>
                  <span v-if="!row.primary && row.fallback" class="p-fallback">{{ row.fallback }}</span>
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- ─── 3. Commentaire en direct ─── -->
    <div v-else class="timeline-card">
      <!-- Squelette de chargement -->
      <div v-if="commentaryLoading" class="sk-block">
        <div class="sk-bone sk-avatar" />
        <div class="sk-lines">
          <span class="sk-bone sk-line sk-line-lg" />
          <span class="sk-bone sk-line" />
          <span class="sk-bone sk-line sk-line-md" />
        </div>
      </div>

      <div v-else-if="commentary.length === 0" class="tl-empty">
        <v-icon size="30" color="zinc-500">mdi-comment-text-outline</v-icon>
        <div class="empty-title">Commentaire indisponible</div>
        <div class="empty-sub">Le texte en direct n'est pas encore publié pour ce match.</div>
      </div>

      <div v-else class="comm-list">
        <div v-for="c in commentaryList" :key="c.sequence" class="comm-row">
          <div class="tl-clock">{{ c.clock || (c.period ? `${c.period}e` : '•') }}</div>
          <div class="comm-text">{{ c.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type PropType } from 'vue';
import EventIcon from './EventIcon.vue';
import type { MatchSummary, MatchCommentaryItem, MatchKeyEvent } from '../../types/matches';

type Side = 'home' | 'away';
type IconKind = 'goal' | 'yellow' | 'red' | 'sub';

interface MarkerRow {
  kind: 'marker';
  id: string;
  clock: string;
  score?: string;
}
interface NoteRow {
  kind: 'note';
  id: string;
  clock: string;
  text: string;
  score?: string;
}
interface EventRow {
  kind: 'event';
  id: string;
  clock: string;
  side: Side;
  icon: IconKind | null;
  primary?: string;
  secondary?: string;
  fallback?: string;
  score?: string;
}
type Row = MarkerRow | NoteRow | EventRow;

const props = defineProps({
  summary: {
    type: Object as PropType<MatchSummary | null>,
    default: null,
  },
  commentary: {
    type: Array as PropType<MatchCommentaryItem[]>,
    default: () => [],
  },
  commentaryLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{ (e: 'load-commentary'): void }>();

const tab = ref<'events' | 'commentary'>('events');

// Commentaire : du plus récent au plus ancien (indépendant de l'ordre de l'API)
const commentaryList = computed(() =>
  [...props.commentary].sort((a, b) => (b.sequence || 0) - (a.sequence || 0))
);

function openCommentary() {
  tab.value = 'commentary';
  if (props.commentary.length === 0) emit('load-commentary');
}

/* ─── Parsing horloge / période ─── */
function minuteOf(ev: MatchKeyEvent): number | null {
  const m = /(\d+)\s*(?:\+\s*(\d+))?/.exec(ev.clock || '');
  if (!m) return null;
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0);
}

function periodFallback(min: number): number {
  if (min <= 45) return 1;
  if (min <= 90) return 2;
  if (min <= 105) return 3;
  if (min <= 120) return 4;
  return 5;
}

function periodOf(ev: MatchKeyEvent): number {
  if (typeof ev.period === 'number' && ev.period > 0) return ev.period;
  const min = minuteOf(ev);
  return min === null ? 1 : periodFallback(min);
}

/* ─── Classification ─── */
function iconKindOf(ev: MatchKeyEvent): IconKind | null {
  const t = (ev.type || '').toLowerCase();
  if (t.includes('yellow')) return 'yellow';
  if (t.includes('red')) return 'red';
  if (t.includes('sub') || t.includes('replacement') || t.includes('entrance')) return 'sub';
  if (ev.scoringPlay || t.includes('goal')) return 'goal';
  return null;
}

function isInteresting(ev: MatchKeyEvent): boolean {
  return iconKindOf(ev) !== null;
}

function namesOf(ev: MatchKeyEvent): { primary?: string; secondary?: string } {
  const parts = (ev.participants || []).map((p) => p.name).filter(Boolean);
  if (parts.length >= 2) return { primary: parts[0], secondary: parts[1] };
  if (parts.length === 1) return { primary: parts[0] };
  return {};
}

/* ─── Construction de la frise ─── */
const rows = computed<Row[]>(() => {
  const s = props.summary;
  if (!s) return [];

  const homeId = String(s.homeTeam?.id ?? '');
  const awayId = String(s.awayTeam?.id ?? '');

  const events = (s.keyEvents || [])
    .filter(isInteresting)
    .slice()
    .sort((a, b) => periodOf(a) - periodOf(b) || (minuteOf(a) ?? 0) - (minuteOf(b) ?? 0));

  const out: Row[] = [];
  let h = 0;
  let a = 0;
  let halfTimeDone = false;

  for (const ev of events) {
    const period = periodOf(ev);

    // Mi-temps : insérée avant le premier événement de la 2e période
    if (!halfTimeDone && period >= 2) {
      out.push({
        kind: 'marker',
        id: 'half-time',
        clock: 'Mi-temps',
        score: `${h} - ${a}`,
      });
      halfTimeDone = true;
    }

    const icon = iconKindOf(ev);
    const isShootout = period >= 5;
    const scoring = icon === 'goal' && !isShootout;

    const side: Side | null =
      String(ev.teamId ?? '') === awayId && awayId ? 'away' : String(ev.teamId ?? '') === homeId && homeId ? 'home' : null;

    if (scoring && side) {
      if (side === 'home') h += 1;
      else a += 1;
    }

    const clock = ev.clock || (typeof ev.period === 'number' ? `${ev.period}e` : '•');

    if (!side) {
      out.push({
        kind: 'note',
        id: ev.id || `n-${out.length}`,
        clock,
        text: ev.shortText || ev.text || '',
      });
      continue;
    }

    const { primary, secondary } = namesOf(ev);

    out.push({
      kind: 'event',
      id: ev.id || `e-${out.length}`,
      clock,
      side,
      icon,
      primary,
      secondary,
      fallback: !primary ? ev.shortText || ev.text || undefined : undefined,
      score: scoring ? `${h} - ${a}` : undefined,
    });
  }

  // Mi-temps jamais insérée (aucun événement en 2e période) mais match terminé
  if (!halfTimeDone && s.status === 'finished' && out.length > 0) {
    out.push({ kind: 'marker', id: 'half-time', clock: 'Mi-temps', score: `${h} - ${a}` });
  }

  // Fin de match
  if (s.status === 'finished') {
    const homeScore = typeof s.homeTeam?.score === 'number' ? s.homeTeam.score : h;
    const awayScore = typeof s.awayTeam?.score === 'number' ? s.awayTeam.score : a;
    out.push({ kind: 'marker', id: 'full-time', clock: 'FT', score: `${homeScore} - ${awayScore}` });
  }

  // Tri : l'élément le plus récent en haut
  return out.slice().reverse();
});
</script>

<style scoped>
.match-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ─── Sous-onglets ─── */
.seg-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.seg-tab {
  appearance: none;
  border: 1px solid #2a2738;
  background: transparent;
  color: #a1a1aa;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  padding: 10px 20px;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.seg-tab:hover {
  color: #e4e4e7;
  border-color: #3a374d;
}

.seg-tab.is-active {
  background: #ffffff;
  border-color: #ffffff;
  color: #0b0a10;
}

/* ─── Carte ─── */
.timeline-card {
  background: #100f18;
  border: 1px solid #1f1c2b;
  border-radius: 16px;
  overflow: hidden;
}

.tl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px 20px;
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

/* ─── Ligne ─── */
.tl-row {
  display: grid;
  grid-template-columns: 78px 1fr 74px 1fr;
  align-items: center;
  gap: 6px;
  padding: 13px 16px;
}

.tl-row + .tl-row {
  border-top: 1px solid #1a1826;
}

.tl-clock {
  font-size: 12px;
  font-weight: 700;
  color: #71717a;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tl-side {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tl-side-home {
  justify-content: flex-end;
}

.tl-side-away {
  justify-content: flex-start;
}

.tl-players {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  text-align: right;
}

.tl-players-away {
  text-align: left;
}

.p-main {
  font-size: 13px;
  font-weight: 700;
  color: #fafafa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-sub {
  font-size: 11.5px;
  font-weight: 500;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-fallback {
  font-size: 12px;
  font-weight: 600;
  color: #a1a1aa;
}

.tl-score {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fafafa;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.tl-note {
  grid-column: 2 / -1;
  text-align: center;
  font-size: 12.5px;
  font-weight: 600;
  color: #a1a1aa;
}

/* Lignes marqueur (Mi-temps / FT) */
.row-marker .tl-clock,
.row-marker .tl-score {
  color: #71717a;
}

.row-marker .tl-score {
  font-weight: 800;
  color: #d4d4d8;
}

/* ─── Commentaire ─── */
.comm-list {
  display: flex;
  flex-direction: column;
}

.comm-row {
  display: grid;
  grid-template-columns: 78px 1fr;
  gap: 8px;
  padding: 13px 16px;
}

.comm-row + .comm-row {
  border-top: 1px solid #1a1826;
}

.comm-text {
  font-size: 12.5px;
  line-height: 1.55;
  color: #d4d4d8;
}

/* ─── Squelette de chargement ─── */
.sk-block {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 16px;
}

.sk-bone {
  display: block;
  background: linear-gradient(90deg, #24222f 0%, #2f2c3f 50%, #24222f 100%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
  border-radius: 8px;
}

.sk-avatar {
  width: 62px;
  height: 62px;
  border-radius: 12px;
  flex-shrink: 0;
}

.sk-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.sk-line {
  height: 14px;
  border-radius: 7px;
  width: 100%;
}

.sk-line-lg {
  width: 92%;
}

.sk-line-md {
  width: 66%;
}

@keyframes sk-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* ─── Responsive ─── */
@media (max-width: 600px) {
  .tl-row {
    grid-template-columns: 60px 1fr 62px 1fr;
    padding: 12px 12px;
    gap: 4px;
  }

  .comm-row {
    grid-template-columns: 56px 1fr;
    padding: 12px;
  }

  .p-main {
    font-size: 12px;
  }

  .p-sub {
    font-size: 10.5px;
  }

  .tl-score {
    font-size: 12px;
  }

  .seg-tab {
    padding: 9px 16px;
    font-size: 12.5px;
  }
}
</style>
