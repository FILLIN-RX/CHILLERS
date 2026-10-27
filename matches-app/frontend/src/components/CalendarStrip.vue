<template>
  <div class="calendar-bar">
    <!-- ─── Colonne 1 : navigation par jour ─── -->
    <div class="date-nav d-flex align-center px-1">
      <v-btn
        icon="mdi-chevron-left"
        size="small"
        variant="text"
        color="zinc-400"
        class="nav-arrow flex-shrink-0"
        aria-label="Jour précédent"
        @click="shiftDate(-1)"
      />

      <v-menu v-model="menu" location="bottom center" :close-on-content-click="true">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            variant="text"
            color="white"
            class="date-trigger flex-1 mx-1"
            aria-label="Choisir une date"
          >
            <span class="date-stack">
              <span class="date-top">{{ labelTop }}</span>
              <span class="date-bottom">{{ labelBottom }}</span>
            </span>
            <v-icon size="18" class="ml-2" color="zinc-400">mdi-calendar-month-outline</v-icon>
          </v-btn>
        </template>

        <v-card color="surface" class="picker-card pa-2">
          <v-date-picker
            v-model="pickerDate"
            color="primary"
            title="Choisir une date"
            :first-day-of-week="1"
            @update:model-value="onPick"
          />
        </v-card>
      </v-menu>

      <v-btn
        icon="mdi-chevron-right"
        size="small"
        variant="text"
        color="zinc-400"
        class="nav-arrow flex-shrink-0"
        aria-label="Jour suivant"
        @click="shiftDate(1)"
      />
    </div>

    <!-- ─── Colonne 2 : action ─── -->
    <div class="date-action d-flex align-center justify-center">
      <v-btn
        size="small"
        :variant="directActive ? 'flat' : 'outlined'"
        :color="directActive ? 'error' : 'error'"
        rounded="lg"
        class="px-4 font-weight-bold"
        aria-label="Voir les matchs en direct"
        @click="$emit('direct')"
      >
        <v-icon start size="16">mdi-star</v-icon>
        Direct
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    selectedDate: string;
    directActive?: boolean;
  }>(),
  { directActive: false }
);

const emit = defineEmits<{
  (e: 'update:selectedDate', value: string): void;
  (e: 'direct'): void;
}>();

const menu = ref(false);

function parseLocal(value: string): Date {
  const [year, month, day] = String(value || '').split('-').map(Number);
  const d = new Date(year || 1970, (month || 1) - 1, day || 1);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const todayStr = computed(() => toStr(new Date()));

const selected = computed(() => parseLocal(props.selectedDate));

// Écart en jours avec aujourd'hui (-1 = hier, 0 = aujourd'hui, 1 = demain)
const diffDays = computed(() => {
  const a = selected.value;
  const b = parseLocal(todayStr.value);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
});

const labelTop = computed(() => {
  switch (diffDays.value) {
    case -1:
      return 'Hier';
    case 0:
      return "Aujourd'hui";
    case 1:
      return 'Demain';
    default:
      return selected.value
        .toLocaleDateString('fr-FR', { weekday: 'short' })
        .replace(/\./g, '')
        .trim();
  }
});

const labelBottom = computed(() =>
  selected.value
    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .trim()
);

const pickerDate = computed<Date>({
  get: () => selected.value,
  set: (value: Date) => {
    if (value) selectDate(toStr(value));
  },
});

function selectDate(date: string) {
  emit('update:selectedDate', date);
}

function shiftDate(offset: number) {
  const d = selected.value;
  d.setDate(d.getDate() + offset);
  selectDate(toStr(d));
}

function onPick() {
  menu.value = false;
}
</script>

<style scoped>
.calendar-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
  background-color: #181818;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 6px 8px;
  max-width: 100%;
}

.date-nav {
  min-width: 0;
}

.date-action {
  min-width: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}

/* Petit écran : la 2ème cellule se cale sur le bouton pour libérer la navigation */
@media (max-width: 600px) {
  .calendar-bar {
    grid-template-columns: 1fr auto;
  }
}

.date-trigger {
  min-width: 0 !important;
  justify-content: center;
  text-transform: none;
  letter-spacing: normal;
}

.date-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.15;
  min-width: 0;
}

.date-top {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a1a1aa;
}

.date-bottom {
  font-size: 16px;
  font-weight: 800;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.nav-arrow {
  opacity: 0.8;
}

.nav-arrow:hover {
  opacity: 1;
  color: #fff !important;
}

.picker-card {
  overflow: hidden;
}
</style>
