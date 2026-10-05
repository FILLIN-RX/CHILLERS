<template>
  <!-- But : ballon -->
  <span v-if="kind === 'goal'" class="ic ic-goal" role="img" aria-label="But">⚽</span>

  <!-- Cartons réels (dessinés, pas d'emoji) -->
  <span
    v-else-if="kind === 'yellow' || kind === 'red'"
    class="real-card"
    :class="kind === 'yellow' ? 'card-yellow' : 'card-red'"
    role="img"
    :aria-label="kind === 'yellow' ? 'Carton jaune' : 'Carton rouge'"
  />

  <!-- Remplacement -->
  <span v-else-if="kind === 'sub'" class="ic ic-sub" aria-label="Remplacement">
    <v-icon size="12">mdi-swap-horizontal</v-icon>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  kind: 'goal' | 'yellow' | 'red' | 'sub';
}>();
</script>

<style scoped>
.ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ic-goal {
  font-size: 15px;
  line-height: 1;
}

.ic-sub {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: rgba(16, 185, 129, 0.14);
  box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.35);
  color: #34d399;
}

/* Vrai carton : rectangle incliné avec volume */
.real-card {
  display: block;
  width: 13px;
  height: 19px;
  border-radius: 2.5px;
  transform: rotate(-9deg);
  flex-shrink: 0;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.card-yellow {
  background: linear-gradient(155deg, #fef08a 0%, #fde047 45%, #eab308 100%);
}

.card-red {
  background: linear-gradient(155deg, #fca5a5 0%, #ef4444 45%, #b91c1c 100%);
}
</style>
