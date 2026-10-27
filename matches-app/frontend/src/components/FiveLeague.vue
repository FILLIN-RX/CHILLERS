<template>
  <div class="five-leagues-wrapper">
    <!-- Si utilisé en mode grille complète des 5 ligues (comportement par défaut) -->
    <template v-if="!isSingleCard">
      <!-- ─── 1. Version Desktop (≥ 768px) : Grille en 2 lignes (2 en haut, 3 en bas) ─── -->
      <div class="desktop-leagues d-none d-md-flex flex-column">
        <!-- Première ligne : 2 ligues (Premier League & La Liga) -->
        <div class="leagues-row row-top mb-4">
          <div
            v-for="league in topLeagues"
            :key="league.id"
            class="league-card"
            :style="{ backgroundColor: league.bg }"
            @click="onLeagueClick(league.id)"
          >
            <!-- Watermark (Logo en filigrane arrière-plan) -->
            <img
              v-if="league.watermark"
              :src="league.watermark"
              alt=""
              class="watermark-img"
            />

            <!-- Contenu texte à gauche -->
            <div class="card-content">
              <!-- En-tête : Drapeau + Nom du Pays -->
              <div class="flag-badge">
                <span class="flag-icon" v-html="league.flagSvg"></span>
                <span class="country-label">{{ league.country }}</span>
              </div>

              <!-- Titre + Action -->
              <div class="title-action-box">
                <h2 class="league-title">{{ league.name }}</h2>
                <div class="action-btn">
                  <span>{{ league.action }}</span>
                  <span class="action-arrow">→</span>
                </div>
              </div>
            </div>

            <!-- Joueur vedette à droite (Cutout FootyRenders) -->
            <img
              v-if="league.player"
              :src="league.player"
              :alt="league.name"
              class="player-img"
            />
          </div>
        </div>

        <!-- Deuxième ligne : 3 ligues (Bundesliga, Ligue 1, Série A) -->
        <div class="leagues-row row-bottom">
          <div
            v-for="league in bottomLeagues"
            :key="league.id"
            class="league-card"
            :style="{ backgroundColor: league.bg }"
            @click="onLeagueClick(league.id)"
          >
            <!-- Watermark (Logo en filigrane arrière-plan) -->
            <img
              v-if="league.watermark"
              :src="league.watermark"
              alt=""
              class="watermark-img watermark-bottom"
            />

            <!-- Contenu texte à gauche -->
            <div class="card-content">
              <!-- En-tête : Drapeau + Nom du Pays -->
              <div class="flag-badge">
                <span class="flag-icon" v-html="league.flagSvg"></span>
                <span class="country-label">{{ league.country }}</span>
              </div>

              <!-- Titre + Action -->
              <div class="title-action-box">
                <h2 class="league-title">{{ league.name }}</h2>
                <div class="action-btn">
                  <span>{{ league.action }}</span>
                  <span class="action-arrow">→</span>
                </div>
              </div>
            </div>

            <!-- Joueur vedette à droite (Cutout FootyRenders) -->
            <img
              v-if="league.player"
              :src="league.player"
              :alt="league.name"
              class="player-img"
            />
          </div>
        </div>
      </div>

      <!-- ─── 2. Version Mobile (< 768px) : Carrousel Horizontal Swipeable ─── -->
      <div class="mobile-carousel-container d-md-none">
        <div
          ref="carouselRef"
          class="mobile-carousel-track"
          @scroll.passive="handleScroll"
        >
          <div
            v-for="(league, index) in allLeagues"
            :key="league.id"
            :ref="(el) => setCardRef(el, index)"
            class="league-card mobile-league-card"
            :class="{ 'is-active-card': activeIndex === index }"
            :style="{ backgroundColor: league.bg }"
            @click="onLeagueClick(league.id)"
          >
            <!-- Watermark -->
            <img
              v-if="league.watermark"
              :src="league.watermark"
              alt=""
              class="watermark-img"
              :class="{ 'watermark-bottom': index >= 2 }"
            />

            <!-- Contenu texte -->
            <div class="card-content">
              <div class="flag-badge">
                <span class="flag-icon" v-html="league.flagSvg"></span>
                <span class="country-label">{{ league.country }}</span>
              </div>

              <div class="title-action-box">
                <h2 class="league-title">{{ league.name }}</h2>
                <div class="action-btn">
                  <span>{{ league.action }}</span>
                  <span class="action-arrow">→</span>
                </div>
              </div>
            </div>

            <!-- Joueur vedette -->
            <img
              v-if="league.player"
              :src="league.player"
              :alt="league.name"
              class="player-img"
            />
          </div>
        </div>

        <!-- Contrôles de navigation et indicateurs (Points / Pills) -->
        <div class="carousel-pagination">
          <button
            class="nav-arrow-btn prev-btn"
            :disabled="activeIndex === 0"
            aria-label="Précédent"
            @click="goToPrev"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <button
            class="nav-arrow-btn next-btn"
            :disabled="activeIndex === allLeagues.length - 1"
            aria-label="Suivant"
            @click="goToNext"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </template>

    <!-- Si utilisé en mode carte unique personnalisée -->
    <template v-else>
      <div
        class="league-card single-card"
        :style="{ backgroundColor: customBgColor }"
        @click="emit('click')"
      >
        <img
          v-if="watermarkImage"
          :src="watermarkImage"
          alt=""
          class="watermark-img"
        />

        <div class="card-content">
          <div class="flag-badge">
            <span v-if="isEmoji(countryFlag)" class="emoji-flag">{{ countryFlag }}</span>
            <img v-else-if="countryFlag" :src="countryFlag" class="custom-flag-img" alt="" />
            <span class="country-label">{{ countryName }}</span>
          </div>

          <div class="title-action-box">
            <h2 class="league-title">{{ leagueName }}</h2>
            <div class="action-btn">
              <span>{{ actionText }}</span>
              <span class="action-arrow">→</span>
            </div>
          </div>
        </div>

        <img
          v-if="playerImage"
          :src="playerImage"
          :alt="leagueName || 'Joueur'"
          class="player-img"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface SingleCardProps {
  backgroundColor?: string;
  watermarkImage?: string;
  playerImage?: string;
  countryName?: string;
  countryFlag?: string;
  leagueName?: string;
  actionText?: string;
}

const props = withDefaults(defineProps<SingleCardProps>(), {
  actionText: 'Accéder aux matchs',
});

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'select', leagueId: string): void;
}>();

const isSingleCard = computed(() => Boolean(props.leagueName));

const customBgColor = computed(() => {
  if (!props.backgroundColor) return '#1e1e1e';
  if (props.backgroundColor.startsWith('bg-[')) {
    return props.backgroundColor.replace('bg-[', '').replace(']', '');
  }
  return props.backgroundColor;
});

const isEmoji = (str?: string) => {
  if (!str) return false;
  const emojiRegex = /[\p{Emoji}]/u;
  return emojiRegex.test(str) && !str.includes('http') && !str.includes('/');
};

// Drapeaux SVG vectoriels précis avec ratio 22x15
const FLAG_ENGLAND = `
  <svg width="22" height="15" viewBox="0 0 60 36" style="border-radius: 3px; border: 0.5px solid rgba(255,255,255,0.3); display: block;">
    <rect width="60" height="36" fill="#FFFFFF"/>
    <rect x="25" width="10" height="36" fill="#CE1124"/>
    <rect y="13" width="60" height="10" fill="#CE1124"/>
  </svg>
`;

const FLAG_SPAIN = `
  <svg width="22" height="15" viewBox="0 0 60 36" style="border-radius: 3px; border: 0.5px solid rgba(255,255,255,0.3); display: block;">
    <rect width="60" height="9" fill="#AA151B"/>
    <rect y="9" width="60" height="18" fill="#F1BF00"/>
    <rect y="27" width="60" height="9" fill="#AA151B"/>
    <circle cx="18" cy="18" r="4.5" fill="#AA151B" opacity="0.85"/>
  </svg>
`;

const FLAG_GERMANY = `
  <svg width="22" height="15" viewBox="0 0 60 36" style="border-radius: 3px; border: 0.5px solid rgba(255,255,255,0.3); display: block;">
    <rect width="60" height="12" fill="#000000"/>
    <rect y="12" width="60" height="12" fill="#DD0000"/>
    <rect y="24" width="60" height="12" fill="#FFCE00"/>
  </svg>
`;

const FLAG_FRANCE = `
  <svg width="22" height="15" viewBox="0 0 60 36" style="border-radius: 3px; border: 0.5px solid rgba(255,255,255,0.3); display: block;">
    <rect width="20" height="36" fill="#002654"/>
    <rect x="20" width="20" height="36" fill="#FFFFFF"/>
    <rect x="40" width="20" height="36" fill="#CE1124"/>
  </svg>
`;

const FLAG_ITALY = `
  <svg width="22" height="15" viewBox="0 0 60 36" style="border-radius: 3px; border: 0.5px solid rgba(255,255,255,0.3); display: block;">
    <rect width="20" height="36" fill="#009246"/>
    <rect x="20" width="20" height="36" fill="#FFFFFF"/>
    <rect x="40" width="20" height="36" fill="#CE2B37"/>
  </svg>
`;

// Configuration exacte des 5 championnats
const topLeagues = [
  {
    id: 'eng.1',
    country: 'ANGLETERRE',
    flagSvg: FLAG_ENGLAND,
    name: 'Premier League',
    action: 'Accéder aux matchs de championnat',
    bg: '#38003C', // Violet officiel Premier League
    watermark: '/league/premiere_ligue/pl_logo.png',
    player: '/league/premiere_ligue/Erling Braut Håland - FootyRenders.png',
  },
  {
    id: 'esp.1',
    country: 'ESPAGNE',
    flagSvg: FLAG_SPAIN,
    name: 'La Liga',
    action: 'Accéder aux matchs de championnat',
    bg: '#FF4633', // Rouge vif LaLiga
    watermark: '/league/liga/liga.png',
    player: '/league/liga/Kylian Mbappé - FootyRenders.png',
  },
];

const bottomLeagues = [
  {
    id: 'ger.1',
    country: 'ALLEMAGNE',
    flagSvg: FLAG_GERMANY,
    name: 'Bundesliga',
    action: 'Accéder aux matchs',
    bg: '#D20515', // Rouge profond Bundesliga
    watermark: '/league/Bundesliga/budesliga.png',
    player: '/league/Bundesliga/kane_transparent.png',
  },
  {
    id: 'fra.1',
    country: 'FRANCE',
    flagSvg: FLAG_FRANCE,
    name: 'Ligue 1',
    action: 'Accéder aux matchs',
    bg: '#142954', // Bleu nuit Ligue 1
    watermark: '/league/ligue_1/l1_logo.png',
    player: '/league/ligue_1/dembele_transparent.png',
  },
  {
    id: 'ita.1',
    country: 'ITALIE',
    flagSvg: FLAG_ITALY,
    name: 'Série A',
    action: 'Accéder aux matchs',
    bg: '#0091DA', // Bleu azur Serie A
    watermark: '/league/serie_A/seriea.png',
    player: '/league/serie_A/Lautaro Martínez - FootyRenders.png',
  },
];

const allLeagues = computed(() => [...topLeagues, ...bottomLeagues]);

// Gestion du carrousel mobile
const carouselRef = ref<HTMLElement | null>(null);
const cardElements = ref<HTMLElement[]>([]);
const activeIndex = ref(0);

const setCardRef = (el: any, index: number) => {
  if (el) {
    cardElements.value[index] = el;
  }
};

const handleScroll = () => {
  if (!carouselRef.value) return;
  const container = carouselRef.value;
  const scrollLeft = container.scrollLeft;
  const containerCenter = scrollLeft + container.clientWidth / 2;

  let closestIndex = 0;
  let minDistance = Infinity;

  cardElements.value.forEach((card, idx) => {
    if (!card) return;
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(containerCenter - cardCenter);
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
  if (!carouselRef.value || !cardElements.value[index]) return;
  const card = cardElements.value[index];
  const container = carouselRef.value;
  const scrollPosition = card.offsetLeft - (container.clientWidth - card.offsetWidth) / 2;

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
  if (activeIndex.value < allLeagues.value.length - 1) {
    goToSlide(activeIndex.value + 1);
  }
};

const onLeagueClick = (leagueId: string) => {
  emit('select', leagueId);
  emit('click');
};
</script>

<style scoped>
.five-leagues-wrapper {
  width: 100%;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* ─── Desktop Grids ─── */
.desktop-leagues {
  width: 100%;
}

.row-top {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.row-bottom {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .row-bottom {
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
}

/* ─── Mobile Carousel ─── */
.mobile-carousel-container {
  width: 100%;
  position: relative;
}

.mobile-carousel-track {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 4px 6px 12px 6px;
  margin: 0 -4px;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.mobile-carousel-track::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.mobile-league-card {
  flex: 0 0 86vw;
  max-width: 350px;
  min-width: 280px;
  height: 180px;
  min-height: 180px;
  scroll-snap-align: center;
  scroll-snap-stop: always;
  transform: scale(0.98);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
}

.mobile-league-card.is-active-card {
  transform: scale(1);
  box-shadow: 0 14px 34px -6px rgba(0, 0, 0, 0.65);
}

/* Indicateurs et Flèches */
.carousel-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 6px;
}

.nav-arrow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-arrow-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
  transform: scale(1.08);
}

.nav-arrow-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* ─── Carte de Ligue Générale ─── */
.league-card {
  position: relative;
  display: flex;
  width: 100%;
  height: 185px;
  min-height: 175px;
  overflow: hidden;
  border-radius: 24px;
  padding: 20px 22px;
  cursor: pointer;
  box-shadow: 0 10px 30px -6px rgba(0, 0, 0, 0.45);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, filter 0.3s ease;
}

.league-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 40px -8px rgba(0, 0, 0, 0.6);
  filter: brightness(1.03);
}

.league-card:active {
  transform: scale(0.985);
}

/* Contenu texte */
.card-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 68%;
  height: 100%;
}

/* Drapeau & Pays */
.flag-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flag-icon {
  display: inline-flex;
  align-items: center;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.country-label {
  color: rgba(255, 255, 255, 0.95);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* Titre & Action */
.title-action-box {
  margin-top: auto;
}

.league-title {
  color: #ffffff;
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 0 0 6px 0;
}

@media (max-width: 768px) {
  .league-title {
    font-size: 22px;
  }
}

.action-btn {
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: color 0.2s ease;
}

.action-arrow {
  font-weight: bold;
  font-size: 14px;
  transition: transform 0.25s ease;
}

.league-card:hover .action-arrow {
  transform: translateX(4px);
}

.league-card:hover .action-btn {
  color: #ffffff;
}

/* Watermark */
.watermark-img {
  position: absolute;
  top: 50%;
  left: 28%;
  transform: translateY(-50%);
  height: 160px;
  max-width: 220px;
  object-fit: contain;
  opacity: 0.14;
  pointer-events: none;
  filter: brightness(2) contrast(1.2);
  user-select: none;
  z-index: 1;
}

.watermark-bottom {
  left: 24%;
  height: 145px;
}

/* Joueur Vedette à l'extrémité droite */
.player-img {
  position: absolute;
  right: 0;
  bottom: 0;
  height: 108%;
  max-height: 195px;
  object-fit: contain;
  object-position: bottom right;
  pointer-events: none;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.5));
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  z-index: 2;
}

.league-card:hover .player-img {
  transform: scale(1.04);
}

@media (max-width: 640px) {
  .player-img {
    right: 0;
    max-height: 175px;
  }
  .watermark-img {
    left: 20%;
    height: 130px;
  }
}

.single-card {
  width: 100%;
}

.emoji-flag {
  font-size: 18px;
  line-height: 1;
}

.custom-flag-img {
  width: 22px;
  height: 15px;
  object-fit: cover;
  border-radius: 3px;
}
</style>