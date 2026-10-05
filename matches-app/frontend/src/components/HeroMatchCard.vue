<template>
  <div v-if="allMatches.length > 0" class="hero-matches-container">
    <!-- Cas 1 : Plusieurs matchs à la une (Carrousel Mobile & Desktop) -->
    <template v-if="allMatches.length > 1">
      <!-- Carrousel Horizontal Swipeable -->
      <div
        ref="carouselRef"
        class="hero-carousel-track"
        @scroll.passive="handleScroll"
      >
        <div
          v-for="(m, idx) in allMatches"
          :key="m.id"
          :ref="(el) => setItemRef(el, idx)"
          class="hero-carousel-slide"
          :class="{ 'is-active-slide': activeIndex === idx }"
        >
          <HeroMatchItem
            :match="m"
            @select="(match) => $emit('select', match)"
            @watch-stream="(match) => $emit('watch-stream', match)"
          />
        </div>
      </div>

      <!-- Pagination & Contrôles -->
      <div class="hero-pagination-bar">
        <button
          class="nav-btn prev-btn"
          :disabled="activeIndex === 0"
          aria-label="Match précédent"
          @click="goToPrev"
        >
          <v-icon size="14" color="white">mdi-chevron-left</v-icon>
        </button>

        <div class="pagination-dots">
          <button
            v-for="(m, idx) in allMatches"
            :key="`hero-dot-${m.id}`"
            class="pagination-dot"
            :class="{ 'active': activeIndex === idx }"
            :aria-label="`Match ${idx + 1}`"
            @click="goToSlide(idx)"
          ></button>
        </div>

        <button
          class="nav-btn next-btn"
          :disabled="activeIndex === allMatches.length - 1"
          aria-label="Match suivant"
          @click="goToNext"
        >
          <v-icon size="14" color="white">mdi-chevron-right</v-icon>
        </button>
      </div>
    </template>

    <!-- Cas 2 : Un seul match -->
    <template v-else-if="allMatches[0]">
      <HeroMatchItem
        :match="allMatches[0]"
        @select="(match) => $emit('select', match)"
        @watch-stream="(match) => $emit('watch-stream', match)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SportMatch } from '../types/matches';
import HeroMatchItem from './HeroMatchItem.vue';

const props = defineProps<{
  match?: SportMatch | null;
  matches?: SportMatch[];
}>();

defineEmits<{
  (e: 'select', match: SportMatch): void;
  (e: 'watch-stream', match: SportMatch): void;
}>();

const allMatches = computed<SportMatch[]>(() => {
  if (props.matches && props.matches.length > 0) {
    return props.matches;
  }
  if (props.match) {
    return [props.match];
  }
  return [];
});

const carouselRef = ref<HTMLElement | null>(null);
const slideElements = ref<HTMLElement[]>([]);
const activeIndex = ref(0);

const setItemRef = (el: any, index: number) => {
  if (el) {
    slideElements.value[index] = el;
  }
};

const handleScroll = () => {
  if (!carouselRef.value) return;
  const container = carouselRef.value;
  const scrollLeft = container.scrollLeft;
  const containerCenter = scrollLeft + container.clientWidth / 2;

  let closestIndex = 0;
  let minDistance = Infinity;

  slideElements.value.forEach((slide, idx) => {
    if (!slide) return;
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const distance = Math.abs(containerCenter - slideCenter);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = idx;
    }
  });

  if (activeIndex.value !== closestIndex) {
    activeIndex.value = closestIndex;
  }
};

const goToSlide = (index: number) => {
  if (!carouselRef.value || !slideElements.value[index]) return;
  const slide = slideElements.value[index];
  const container = carouselRef.value;
  const scrollPosition = slide.offsetLeft - (container.clientWidth - slide.offsetWidth) / 2;

  container.scrollTo({
    left: Math.max(0, scrollPosition),
    behavior: 'smooth',
  });
  activeIndex.value = index;
};

const goToPrev = () => {
  if (activeIndex.value > 0) {
    goToSlide(activeIndex.value - 1);
  }
};

const goToNext = () => {
  if (activeIndex.value < allMatches.value.length - 1) {
    goToSlide(activeIndex.value + 1);
  }
};
</script>

<style scoped>
.hero-matches-container {
  width: 100%;
  position: relative;
}

.hero-carousel-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 4px 4px 8px 4px;
  margin: 0 -4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.hero-carousel-track::-webkit-scrollbar {
  display: none;
}

.hero-carousel-slide {
  flex: 0 0 100%;
  min-width: 100%;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .hero-carousel-slide {
    flex: 0 0 92vw;
    min-width: 290px;
    max-width: 440px;
    margin-right: 0;
  }
}

.hero-pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.nav-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.pagination-dots {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.25);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.pagination-dot.active {
  width: 20px;
  background: #e50914;
  box-shadow: 0 0 8px rgba(229, 9, 20, 0.6);
}
</style>
