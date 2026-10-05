<template>
  <transition name="goal-slide">
    <div v-if="alert" class="goal-notification-wrapper" @click="goToMatch">
      <div class="goal-card d-flex align-center gap-4 pa-4 rounded-2xl elevation-10">
        <!-- Icône Ballon avec effet Pulse -->
        <div class="goal-icon-wrapper flex-shrink-0">
          <span class="goal-ball">⚽</span>
          <div class="goal-ring"></div>
        </div>

        <!-- Détails du But -->
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-center gap-2 mb-1">
            <span class="goal-tag font-weight-black text-uppercase">BUT !</span>
            <span class="text-caption text-zinc-400 font-weight-bold" v-if="alert.minute">
              {{ alert.minute }}
            </span>
            <span class="text-caption text-zinc-500">•</span>
            <span class="text-caption text-zinc-400 text-truncate font-weight-medium">
              {{ alert.leagueName }}
            </span>
          </div>

          <div class="text-subtitle-1 font-weight-black text-white text-truncate mb-1">
            {{ alert.teamName }}
          </div>

          <div class="d-flex align-center gap-2">
            <span class="score-badge font-weight-black px-2 py-0.5 rounded">
              {{ alert.newScore }}
            </span>
            <span class="text-caption text-zinc-300 text-truncate">
              {{ alert.matchTitle }}
            </span>
          </div>
        </div>

        <!-- Bouton Fermer -->
        <v-btn
          icon="mdi-close"
          size="x-small"
          variant="text"
          color="zinc-400"
          class="flex-shrink-0"
          @click.stop="$emit('close')"
        />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { GoalEventData } from '../services/sse.service';

const props = defineProps<{
  alert: GoalEventData | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();

function goToMatch() {
  if (props.alert?.matchId) {
    emit('close');
    router.push(`/match/${props.alert.matchId}`);
  }
}
</script>

<style scoped>
.goal-notification-wrapper {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: 90%;
  max-width: 460px;
  cursor: pointer;
}

.goal-card {
  background: linear-gradient(135deg, rgba(28, 25, 44, 0.95), rgba(15, 14, 23, 0.98));
  border: 1px solid rgba(255, 179, 0, 0.4);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 179, 0, 0.2);
  backdrop-filter: blur(16px);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.goal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 179, 0, 0.3);
}

.goal-icon-wrapper {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 179, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.goal-ball {
  font-size: 24px;
  animation: rotateBall 3s infinite linear;
}

.goal-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(255, 179, 0, 0.6);
  animation: ripple 1.8s infinite ease-out;
}

@keyframes ripple {
  0% {
    transform: scale(0.85);
    opacity: 1;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

@keyframes rotateBall {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.goal-tag {
  background: linear-gradient(90deg, #ff9800, #ffb300);
  color: #000;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.score-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #ffb300;
  font-family: monospace;
  font-size: 13px;
  border: 1px solid rgba(255, 179, 0, 0.3);
}

/* Transitions */
.goal-slide-enter-active,
.goal-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.goal-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -40px) scale(0.95);
}

.goal-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px) scale(0.95);
}
</style>
