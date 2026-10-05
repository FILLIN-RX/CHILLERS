<template>
  <div
    class="team-logo-container d-inline-flex align-center justify-center rounded-lg"
    :style="{ width: sizePx, height: sizePx, minWidth: sizePx, minHeight: sizePx }"
  >
    <img
      v-if="src && !hasError"
      :src="src"
      :alt="name"
      class="team-logo-img"
      loading="lazy"
      @error="hasError = true"
    />
    <div
      v-else-if="flag"
      class="team-logo-flag d-flex align-center justify-center"
      :style="{ fontSize: flagFontSize }"
    >
      {{ flag }}
    </div>
    <div
      v-else
      class="team-logo-fallback d-flex align-center justify-center font-normal"
      :style="{ fontSize: fallbackFontSize }"
    >
      {{ fallbackText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = withDefaults(
  defineProps<{
    src?: string;
    name: string;
    flag?: string;
    size?: number | string;
  }>(),
  {
    size: 24,
  }
);

const hasError = ref(false);

watch(
  () => props.src,
  () => {
    hasError.value = false;
  }
);

const sizeNumber = computed(() => {
  if (typeof props.size === 'number') return props.size;
  const num = parseInt(props.size, 10);
  return isNaN(num) ? 24 : num;
});

const sizePx = computed(() => `${sizeNumber.value}px`);

const fallbackFontSize = computed(() => {
  return `${Math.max(10, Math.round(sizeNumber.value * 0.44))}px`;
});

const flagFontSize = computed(() => {
  return `${Math.max(10, Math.round(sizeNumber.value * 0.62))}px`;
});

const fallbackText = computed(() => {
  if (!props.name) return '•';
  const words = props.name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return props.name.slice(0, 2).toUpperCase();
});
</script>

<style scoped>
.team-logo-container {
  overflow: hidden;
  flex-shrink: 0;
  background-color: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  box-sizing: border-box;
}

.team-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 1px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  transition: transform 0.15s ease;
}

.team-logo-flag {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  line-height: 1;
  user-select: none;
}

.team-logo-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2a2a2e 0%, #1c1c1f 100%);
  color: #e4e4e7;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  letter-spacing: -0.02em;
  user-select: none;
}
</style>
