<template>
  <div
    class="team-logo-container d-inline-flex align-center justify-center"
    :style="{
      width: widthPx,
      height: sizePx,
      minWidth: widthPx,
      minHeight: sizePx,
    }"
    :aria-label="name"
  >
    <img
      v-if="displaySrc && !hasError"
      :src="displaySrc"
      :alt="name"
      :width="widthNumber"
      :height="sizeNumber"
      class="team-logo-img"
      :class="{ 'is-loaded': isLoaded }"
      loading="lazy"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />

    <div
      v-if="showSkeleton"
      class="team-logo-skeleton"
      aria-hidden="true"
    />

    <div
      v-else-if="hasError && fallbackIcon"
      class="team-logo-icon d-flex align-center justify-center"
    >
      <v-icon :icon="fallbackIcon" :size="Math.round(sizeNumber * 0.68)" />
    </div>
    <div
      v-else-if="hasError && flag"
      class="team-logo-flag d-flex align-center justify-center"
      :style="{ fontSize: flagFontSize }"
    >
      {{ flag }}
    </div>
    <div
      v-else-if="hasError"
      class="team-logo-fallback d-flex align-center justify-center"
      :style="{ fontSize: fallbackFontSize }"
    >
      {{ fallbackText }}
    </div>

    <div
      v-if="!displaySrc && !hasError && fallbackIcon"
      class="team-logo-icon d-flex align-center justify-center"
    >
      <v-icon :icon="fallbackIcon" :size="Math.round(sizeNumber * 0.68)" />
    </div>
    <div
      v-else-if="!displaySrc && !hasError && flag"
      class="team-logo-flag d-flex align-center justify-center"
      :style="{ fontSize: flagFontSize }"
    >
      {{ flag }}
    </div>
    <div
      v-else-if="!displaySrc && !hasError"
      class="team-logo-fallback d-flex align-center justify-center"
      :style="{ fontSize: fallbackFontSize }"
    >
      {{ fallbackText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { optimizedImageUrl } from '../utils/image';

const props = withDefaults(
  defineProps<{
    src?: string;
    name: string;
    flag?: string;
    fallbackIcon?: string;
    size?: number | string;
    aspect?: number;
  }>(),
  {
    size: 28,
    aspect: 1,
  }
);

const hasError = ref(false);
const isLoaded = ref(false);
const useOriginalSource = ref(false);

watch(
  () => props.src,
  () => {
    hasError.value = false;
    isLoaded.value = false;
    useOriginalSource.value = false;
  }
);

const sizeNumber = computed(() => {
  if (typeof props.size === 'number') return props.size;
  const num = parseInt(props.size, 10);
  return isNaN(num) ? 28 : num;
});

const widthNumber = computed(() =>
  Math.round(sizeNumber.value * Math.max(1, props.aspect || 1))
);
const widthPx = computed(() => `${widthNumber.value}px`);
const sizePx = computed(() => `${sizeNumber.value}px`);
const displaySrc = computed(() =>
  useOriginalSource.value ? props.src : optimizedImageUrl(props.src, sizeNumber.value)
);
const showSkeleton = computed(() => Boolean(displaySrc.value) && !hasError.value && !isLoaded.value);

const fallbackFontSize = computed(() => {
  return `${Math.max(10, Math.round(sizeNumber.value * 0.4))}px`;
});

const flagFontSize = computed(() => {
  return `${Math.max(10, Math.round(sizeNumber.value * 0.58))}px`;
});

const fallbackText = computed(() => {
  if (!props.name) return '•';
  const words = props.name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return props.name.slice(0, 2).toUpperCase();
});

function onLoad() {
  isLoaded.value = true;
}

function onError() {
  if (!useOriginalSource.value && props.src && displaySrc.value !== props.src) {
    useOriginalSource.value = true;
    isLoaded.value = false;
    return;
  }
  hasError.value = true;
  isLoaded.value = false;
}
</script>

<style scoped>
.team-logo-container {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-sizing: border-box;
  background: transparent;
}

.team-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity 180ms ease-out,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.team-logo-img.is-loaded {
  opacity: 1;
  transform: scale(1);
}

.team-logo-skeleton {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.055);
}

.team-logo-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    100deg,
    transparent 20%,
    rgba(255, 255, 255, 0.11) 42%,
    rgba(255, 255, 255, 0.16) 50%,
    rgba(255, 255, 255, 0.11) 58%,
    transparent 80%
  );
  animation: logo-shimmer 1.25s ease-in-out infinite;
}

.team-logo-icon,
.team-logo-flag,
.team-logo-fallback {
  width: 100%;
  height: 100%;
  line-height: 1;
  user-select: none;
}

.team-logo-icon {
  color: rgba(255, 255, 255, 0.5);
}

.team-logo-fallback {
  color: rgba(255, 255, 255, 0.62);
  letter-spacing: -0.02em;
}

@keyframes logo-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .team-logo-img {
    transition: opacity 120ms ease;
    transform: none;
  }
  .team-logo-img.is-loaded {
    transform: none;
  }
  .team-logo-skeleton::after {
    animation: none;
    opacity: 0.35;
  }
}
</style>
