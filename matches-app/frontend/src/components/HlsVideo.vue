<template>
  <video ref="videoEl" controls autoplay playsinline class="h-full w-full bg-black" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Hls from 'hls.js';
import type { ErrorData } from 'hls.js';
import { absoluteApiUrl } from '../services/api';

const props = withDefaults(
  defineProps<{
    /** URL HLS (relay same-origin de préférence, sinon le flux distant). */
    src: string;
    /** URL brute, utilisée en secours si le relay tombe (erreur fatale HLS). */
    fallbackSrc?: string | null;
    /** Passe toutes les requêtes par /api/live/proxy (OHA / anti-leech). */
    proxy?: boolean;
    /** Referer attendu par le CDN. */
    referer?: string;
  }>(),
  { fallbackSrc: null, proxy: false, referer: '' },
);

const emit = defineEmits<{ fatal: [reason: string] }>();

const videoEl = ref<HTMLVideoElement | null>(null);

let hls: Hls | null = null;
let attempts: string[] = [];
let attemptIndex = 0;
let mediaRecovered = false;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let fatalReported = false;

function proxied(url: string): string {
  if (!url) return '';
  if (url.includes('/api/live/proxy')) return url;
  const suffix = props.referer ? `&referer=${encodeURIComponent(props.referer)}` : '';
  return absoluteApiUrl(`/api/live/proxy?url=${encodeURIComponent(url)}${suffix}`) || url;
}

function clearWatchdog() {
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
}

function armWatchdog() {
  clearWatchdog();
  watchdog = setTimeout(() => {
    const video = videoEl.value;
    if (video && !video.paused && !video.ended) {
      fail('Aucun nouveau segment vidéo reçu depuis 20 secondes');
      return;
    }
    // Lecture en pause : hls.js cesse de charger, ce n'est pas une erreur.
    armWatchdog();
  }, 20_000);
}

function destroy() {
  clearWatchdog();
  const video = videoEl.value;
  if (video) {
    video.removeEventListener('timeupdate', armWatchdog);
    video.onerror = null;
  }
  if (hls) {
    hls.destroy();
    hls = null;
  }
}

function fail(reason: string) {
  if (fatalReported) return;
  fatalReported = true;
  destroy();
  emit('fatal', reason);
}

function nextAttempt(reason: string) {
  attemptIndex += 1;
  if (attemptIndex >= attempts.length) {
    fail(reason);
    return;
  }
  attach(attempts[attemptIndex]);
}

function attach(url: string) {
  const video = videoEl.value;
  if (!video || !url) return;
  destroy();
  mediaRecovered = false;

  if (Hls.isSupported()) {
    const instance = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 15,
      maxMaxBufferLength: 30,
      backBufferLength: 0,
      maxLoadingDelay: 2,
      maxBufferHole: 0.5,
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 6,
      startLevel: -1,
      liveSyncDurationCount: 1,
      liveMaxLatencyDurationCount: 3,
      maxLiveSyncPlaybackRate: 1.12,
    });
    hls = instance;

    instance.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        if (!mediaRecovered) {
          mediaRecovered = true;
          instance.recoverMediaError();
          return;
        }
        nextAttempt('Le flux HLS ne répond plus');
        return;
      }
      nextAttempt('Le flux HLS ne répond plus');
    });

    instance.on(Hls.Events.MANIFEST_PARSED, () => {
      armWatchdog();
      video.play().catch(() => {});
    });
    instance.on(Hls.Events.FRAG_LOADED, () => {
      armWatchdog();
    });

    instance.loadSource(url);
    instance.attachMedia(video);
    return;
  }

  // Safari : lecture HLS native (pas de MediaSource).
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    armWatchdog();
    video.addEventListener('timeupdate', armWatchdog);
    video.onerror = () => nextAttempt('Le flux HLS ne répond plus');
    video.play().catch(() => {});
  }
}

function isBackendUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/') || url.includes('/api/live/proxy')) return true;
  return url.startsWith(absoluteApiUrl('/api/') ?? '\u0000');
}

function startFrom(src: string, fallbackSrc?: string | null) {
  fatalReported = false;
  attemptIndex = 0;
  const base = [src, fallbackSrc || ''].filter(Boolean);
  if (props.proxy) {
    attempts = [...new Set(base.map(proxied))];
  } else {
    // Certains CDN (TV externe, hôtes « domain protected ») refusent le CORS ou
    // exigent un Referer : on garde le direct puis on retente via le proxy.
    const proxiedAttempts = base.filter((url) => !isBackendUrl(url)).map(proxied);
    attempts = [...new Set([...base, ...proxiedAttempts])];
  }
  if (attempts.length === 0) {
    destroy();
    return;
  }
  attach(attempts[0]);
}

watch(
  () => [props.src, props.fallbackSrc, props.proxy, props.referer],
  () => {
    if (!props.src) {
      destroy();
      return;
    }
    startFrom(props.src, props.fallbackSrc);
  },
);

onMounted(() => {
  if (props.src) startFrom(props.src, props.fallbackSrc);
});

defineExpose({ videoEl });

onBeforeUnmount(destroy);
</script>
