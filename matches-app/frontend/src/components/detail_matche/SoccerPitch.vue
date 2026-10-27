<template>
  <div class="soccer-pitch-wrapper">
    <div class="soccer-pitch">
      <!-- ─── 1. Bandes de Pelouse (Stripes de tonte réalistes) ─── -->
      <div class="pitch-stripes">
        <div
          v-for="i in 12"
          :key="i"
          class="grass-stripe"
          :class="{ 'stripe-alt': i % 2 === 0 }"
        ></div>
      </div>

      <!-- ─── 2. Filigranes des Logos d'Équipes (Exactement comme LiveScore) ─── -->
      <!-- Portugal / Domicile : En haut à droite -->
      <div v-if="homeLogo" class="watermark watermark-home">
        <img :src="homeLogo" :alt="homeName || 'Domicile'" />
      </div>

      <!-- Norvège / Extérieur : En bas à gauche -->
      <div v-if="awayLogo" class="watermark watermark-away">
        <img :src="awayLogo" :alt="awayName || 'Extérieur'" />
      </div>

      <!-- ─── 3. Tracés SVG Réglementaires du Terrain (Lignes blanches fines et nettes) ─── -->
      <svg
        class="pitch-markings"
        viewBox="0 0 100 145"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Contour du terrain -->
        <rect x="2.5" y="2.5" width="95" height="140" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />

        <!-- Ligne médiane -->
        <line x1="2.5" y1="72.5" x2="97.5" y2="72.5" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />

        <!-- Rond central & Point d'engagement -->
        <circle cx="50" cy="72.5" r="13" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />
        <circle cx="50" cy="72.5" r="0.75" fill="rgba(255, 255, 255, 0.7)" />

        <!-- ── HAUT (Domicile) ── -->
        <!-- Grande surface -->
        <rect x="22" y="2.5" width="56" height="23" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />
        <!-- Petite surface 6m -->
        <rect x="34" y="2.5" width="32" height="8" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />
        <!-- Point de penalty -->
        <circle cx="50" cy="16" r="0.75" fill="rgba(255, 255, 255, 0.7)" />
        <!-- Arc de penalty -->
        <path d="M 39 25.5 A 10.5 10.5 0 0 0 61 25.5" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />

        <!-- ── BAS (Extérieur) ── -->
        <!-- Grande surface -->
        <rect x="22" y="119.5" width="56" height="23" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />
        <!-- Petite surface 6m -->
        <rect x="34" y="134.5" width="32" height="8" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />
        <!-- Point de penalty -->
        <circle cx="50" cy="129" r="0.75" fill="rgba(255, 255, 255, 0.7)" />
        <!-- Arc de penalty -->
        <path d="M 39 119.5 A 10.5 10.5 0 0 1 61 119.5" fill="none" stroke="rgba(255, 255, 255, 0.42)" stroke-width="0.75" />

        <!-- Corners -->
        <path d="M 2.5 5.5 A 3 3 0 0 0 5.5 2.5" fill="none" stroke="rgba(255, 255, 255, 0.4)" stroke-width="0.75" />
        <path d="M 94.5 2.5 A 3 3 0 0 0 97.5 5.5" fill="none" stroke="rgba(255, 255, 255, 0.4)" stroke-width="0.75" />
        <path d="M 2.5 139.5 A 3 3 0 0 1 5.5 142.5" fill="none" stroke="rgba(255, 255, 255, 0.4)" stroke-width="0.75" />
        <path d="M 94.5 142.5 A 3 3 0 0 1 97.5 139.5" fill="none" stroke="rgba(255, 255, 255, 0.4)" stroke-width="0.75" />
      </svg>

      <!-- ─── 4. Logos & Formations dans les coins (Haut Gauche et Bas Droite) ─── -->
      <!-- Info Domicile (Haut Gauche) -->
      <div class="team-badge-overlay team-badge-home">
        <img v-if="homeLogo" :src="homeLogo" :alt="homeName" class="team-mini-logo" />
        <span class="formation-text font-mono font-normal">{{ homeFormation || '4-1-3-2' }}</span>
      </div>

      <!-- Info Extérieur (Bas Droite) -->
      <div class="team-badge-overlay team-badge-away">
        <img v-if="awayLogo" :src="awayLogo" :alt="awayName" class="team-mini-logo" />
        <span class="formation-text font-mono font-normal">{{ awayFormation || '4-2-3-1' }}</span>
      </div>

      <!-- ─── 5. Conteneur des Joueurs (Slot Interactif) ─── -->
      <div class="pitch-content">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  homeLogo?: string;
  homeName?: string;
  homeFormation?: string;
  awayLogo?: string;
  awayName?: string;
  awayFormation?: string;
}>();
</script>

<style scoped>
.soccer-pitch-wrapper {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  user-select: none;
}

/* Terrain Principal (Couleur sombre gazon stadium LiveScore) */
.soccer-pitch {
  position: relative;
  width: 100%;
  aspect-ratio: 100 / 146;
  background-color: #17371f;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/* Bandes de tonte horizontales */
.pitch-stripes {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.grass-stripe {
  flex: 1;
  background-color: #193c22;
}

.grass-stripe.stripe-alt {
  background-color: #15331d;
}

/* Filigranes des logos (Positionnés exactement comme LiveScore) */
.watermark {
  position: absolute;
  pointer-events: none;
  opacity: 0.14;
  filter: grayscale(20%) drop-shadow(0 0 12px rgba(0, 0, 0, 0.6));
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.watermark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Domicile (Portugal) : En haut à droite */
.watermark-home {
  top: 18%;
  right: 5%;
  width: 150px;
  height: 150px;
}

/* Extérieur (Norvège) : En bas à gauche */
.watermark-away {
  top: 60%;
  left: 5%;
  width: 150px;
  height: 150px;
}

/* Lignes de jeu SVG */
.pitch-markings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

/* Badges Équipes & Formations dans les coins */
.team-badge-overlay {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 5;
  pointer-events: none;
}

.team-badge-home {
  top: 12px;
  left: 12px;
  align-items: flex-start;
}

.team-badge-away {
  bottom: 12px;
  right: 12px;
  align-items: flex-end;
}

.team-mini-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
}

.formation-text {
  font-size: 11px;
  color: #ffffff;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  font-style: italic;
}

/* Conteneur des joueurs */
.pitch-content {
  position: absolute;
  inset: 0;
  z-index: 4;
}
</style>
