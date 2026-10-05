<template>
  <video ref="videoEl" controls autoplay playsinline />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import Hls from 'hls.js';
import type { ErrorData } from 'hls.js';

const props = defineProps<{
  /** URL HLS (relay same-origin de préférence, sinon le flux distant). */
  src: string;
  /** URL brute, utilisée en secours si le relay tombe (erreur fatale HLS). */
  fallbackSrc?: string | null;
}>();

const videoEl = ref<HTMLVideoElement | null>(null);

let hls: Hls | null = null;
let currentSrc = '';
let triedFallback = false;

function destroy() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  currentSrc = '';
}

function attach(url: string) {
  const video = videoEl.value;
  if (!video || !url) return;
  destroy();
  currentSrc = url;

  if (Hls.isSupported()) {
    const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls = instance;

    instance.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
      if (!data.fatal) return;
      // Le relay peut renvoyer 404/502 (source indisponible côté backend) :
      // on retente une fois sur l'URL d'origine avant d'abandonner.
      const fallback = props.fallbackSrc;
      if (!triedFallback && fallback && fallback !== url) {
        triedFallback = true;
        queueMicrotask(() => attach(fallback));
        return;
      }
      destroy();
    });

    instance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });

    instance.loadSource(url);
    instance.attachMedia(video);
    return;
  }

  // Safari : lecture HLS native (pas de MediaSource).
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.play().catch(() => {});
  }
}

watch(
  () => props.src,
  (url) => {
    triedFallback = false;
    if (!url) {
      destroy();
      return;
    }
    if (currentSrc === url) return;
    attach(url);
  },
  { immediate: true },
);

onBeforeUnmount(destroy);
</script>
