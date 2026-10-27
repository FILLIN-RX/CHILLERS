<template>
  <div id="stream-player" class="w-full space-y-3">
    <!-- Sélecteur unique : chaînes (confirmées d'abord) puis sources externes -->
    <div v-if="statuses.length > 0" class="space-y-2 rounded-xl border border-white/10 bg-[#161616] p-3">
      <MatchChannelsRow
        :channels="allChannels"
        :confirmed-ids="confirmedIds"
        :selected-id="ohaChoice?.ch.id ?? null"
        :resolving-id="ohaResolving"
        :hint="confirmedChannels.length > 0 ? 'Sélection automatique (EPG)' : 'D’après les droits TV'"
        :external-option="true"
        :external-active="!ohaChoice"
        @select="playOha"
        @external="switchExternal"
      />
      <p v-if="ohaError" class="px-1 text-[11px] text-red-300">{{ ohaError }}</p>
    </div>

    <!-- Conteneur principal 16:9 -->
    <div
      ref="containerRef"
      class="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#222222] bg-[#0e0e0e]"
      :class="isFullscreen ? 'fixed inset-0 z-[9999] h-dvh w-screen rounded-none border-0' : ''"
    >
      <!-- Badge Live -->
      <div class="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
        <span
          v-if="isLive"
          class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
          style="background: #e50914"
        >
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {{ minute || 'En direct' }}
        </span>
        <span
          v-else
          class="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1c1c1c]/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 backdrop-blur-md"
        >
          <v-icon size="14" color="primary">mdi-broadcast</v-icon>
          Flux match
        </span>
      </div>

      <!-- Plein écran -->
      <div class="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          :title="isFullscreen ? 'Quitter le plein écran' : 'Plein écran'"
          class="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-300 backdrop-blur-md transition-colors hover:bg-black/90 hover:text-white"
          @click="toggleFullscreen"
        >
          <v-icon size="20">{{ isFullscreen ? 'mdi-arrow-collapse' : 'mdi-arrow-expand' }}</v-icon>
        </button>
      </div>

      <!-- 1. Chargement -->
      <div
        v-if="loading && !activeStream && !ohaChannel"
        class="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0d0d0d] px-4 text-center"
      >
        <v-progress-circular indeterminate color="primary" size="40" />
        <p class="text-[13px] font-semibold text-zinc-300">Recherche du flux vidéo en direct...</p>
        <p class="text-[11px] text-zinc-500">Connexion à la source de diffusion</p>
      </div>

      <!-- 2. Chaîne CHILLERS / OHA -->
      <div v-else-if="ohaChannel && ohaChoice" class="h-full w-full">
        <HlsVideo :key="`oha-${ohaChoice.ch.id}`" :src="ohaChoice.url" proxy />
      </div>

      <!-- 3. Flux HLS actif -->
      <div v-else-if="activeStream?.type === 'hls'" class="h-full w-full">
        <HlsVideo
          :key="activeStream.url"
          :src="activeStream.url"
          :fallback-src="activeStream.directUrl"
          :referer="activeStream.referer"
          @fatal="advanceCandidate"
        />
      </div>

      <!-- 4. Flux iframe (player embarqué proxifié) -->
      <div v-else-if="embedUrl" class="h-full w-full">
        <iframe
          :key="embedUrl"
          :src="embedUrl"
          :title="`${homeName} vs ${awayName}`"
          class="h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerpolicy="no-referrer"
          @error="advanceCandidate('Le player intégré n’a pas pu charger la source.')"
          @load="checkEmbedLoaded"
        />
      </div>

      <!-- 5. Aucun flux -->
      <div
        v-else-if="!loading"
        class="flex h-full w-full flex-col items-center justify-center gap-3.5 bg-[#121212] px-6 text-center"
      >
        <div class="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#1c1c1c] text-zinc-400">
          <v-icon size="28" color="primary">mdi-television</v-icon>
        </div>
        <div class="max-w-sm space-y-1">
          <h3 class="text-[15px] font-bold text-white">
            {{ isLive ? 'Signal vidéo en attente...' : 'Diffusion programmée' }}
          </h3>
          <p class="text-[12px] leading-relaxed text-zinc-400">
            {{
              isLive
                ? "Le flux direct pour ce match n'est pas encore disponible ou est momentanément indisponible."
                : 'Le lecteur vidéo démarrera automatiquement dès le coup d’envoi de la rencontre.'
            }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-full border border-white/10 bg-[#222222] px-4 py-2 text-[12px] font-semibold text-zinc-300 transition-colors hover:bg-[#2b2b2b] hover:text-white"
          @click="loadStream(true)"
        >
          Vérifier à nouveau
        </button>
      </div>

      <!-- 6. Changement de source -->
      <div
        v-if="!ohaChannel && candidates.length > 1"
        class="absolute inset-x-0 bottom-3 z-30 flex flex-col items-center gap-2 px-3"
      >
        <p v-if="notice" role="status" class="rounded-full bg-black/75 px-3 py-1.5 text-xs text-amber-200">
          {{ notice }}
        </p>
        <button
          type="button"
          class="rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/15"
          @click="navigateToNextCandidate"
        >
          Changer de source · {{ ((candidateIndex + 1) % candidates.length) + 1 }}/{{ candidates.length }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import HlsVideo from './HlsVideo.vue';
import MatchChannelsRow from './MatchChannelsRow.vue';
import {
  absoluteApiUrl,
  fetchMatchChannels,
  fetchMatchStream,
  fetchSportsChannels,
  fetchSportsStream,
  resolveOhaStream,
  type MatchChannelStatus,
  type StreamResolution,
  type StreamServer,
} from '../services/api';
import type { OhaChannel } from '../types/oha';
import { PopupFirewall } from '../lib/PopupFirewall';
import { enterFullscreen, exitFullscreen, isFullscreenActive } from '../lib/fullscreen';

interface Candidate {
  url: string;
  type: 'hls' | 'iframe';
  name: string;
  provider?: string;
  referer?: string;
  directUrl?: string;
}

const props = withDefaults(
  defineProps<{
    matchId: string;
    homeName: string;
    awayName: string;
    isLive?: boolean;
    minute?: string;
    league?: string;
    sport?: string;
    startTime?: string;
  }>(),
  { isLive: false, minute: '', league: '', sport: 'football', startTime: '' },
);

const containerRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const primary = ref<StreamResolution | null>(null);
const backup = ref<StreamResolution | null>(null);
const candidateChoice = ref<number | null>(null);
const failed = ref<string[]>([]);
const notice = ref('');
const ohaChoice = ref<{ ch: OhaChannel; url: string } | null>(null);
const ohaResolving = ref<string | null>(null);
const ohaError = ref<string | null>(null);
const statuses = ref<MatchChannelStatus[]>([]);
const isFullscreen = ref(false);
const autoTried = ref<string | null>(null);

function abs(url?: string | null): string {
  if (!url) return '';
  return absoluteApiUrl(url) || url;
}

function hasPlayable(res: StreamResolution | null): boolean {
  if (!res) return false;
  return Boolean(res.primaryUrl || res.url || (res.servers && res.servers.length > 0));
}

function toCandidate(server: StreamServer, primarySource?: string): Candidate {
  const type = server.type ?? 'iframe';
  const prefersRelay = type === 'hls' && Boolean(server.relayUrl);
  return {
    url: abs(prefersRelay ? server.relayUrl : server.url),
    type,
    name: server.name?.trim() || server.provider || primarySource?.toUpperCase() || 'Serveur',
    provider: server.external ? undefined : server.provider ?? primarySource,
    referer: server.referer,
    directUrl: abs(server.url),
  };
}

const candidates = computed<Candidate[]>(() => {
  const source = primary.value;
  if (!source) return [];
  const list: Candidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: Candidate) => {
    if (!candidate.url || seen.has(candidate.url)) return;
    seen.add(candidate.url);
    list.push(candidate);
  };

  if (source.servers?.length) {
    for (const server of source.servers) push(toCandidate(server, source.source));
  } else {
    const type = source.primaryType ?? source.type ?? 'iframe';
    const relay = type === 'hls' ? source.relayUrl || (source.primaryUrl?.includes('/hls/') ? source.primaryUrl : undefined) : undefined;
    push({
      url: abs(relay || source.primaryUrl || source.url),
      type,
      name: source.source?.toUpperCase() || 'Serveur 1',
      provider: source.source,
      referer: source.referer,
      directUrl: abs(source.directUrl || source.url),
    });
  }

  for (const server of backup.value?.servers ?? []) {
    push(toCandidate(server, backup.value?.source));
  }

  return list.sort((a, b) => (a.type === 'hls' ? 0 : 1) - (b.type === 'hls' ? 0 : 1));
});

const candidateIndex = computed(() => {
  if (candidateChoice.value === null) return 0;
  return Math.min(candidateChoice.value, Math.max(candidates.value.length - 1, 0));
});

const activeStream = computed<Candidate | null>(() => candidates.value[candidateIndex.value] ?? null);

const rawEmbedUrl = computed(() => (activeStream.value?.type === 'iframe' ? activeStream.value.url : null));

const embedUrl = computed(() => {
  const raw = rawEmbedUrl.value;
  if (!raw) return null;
  if (/youtube\.com|youtu\.be/i.test(raw)) return raw;
  const suffix = activeStream.value?.referer ? `&referer=${encodeURIComponent(activeStream.value.referer)}` : '';
  return abs(`/api/live/embed-proxy?url=${encodeURIComponent(raw)}${suffix}`);
});

const confirmedChannels = computed(() => statuses.value.filter((status) => status.confirmed).map((status) => status.channel));
const candidateChannels = computed(() => statuses.value.filter((status) => !status.confirmed).map((status) => status.channel));
const allChannels = computed(() => [...confirmedChannels.value, ...candidateChannels.value]);
const confirmedIds = computed(() => confirmedChannels.value.map((channel) => channel.id));

const ohaChannel = computed(() => {
  if (!ohaChoice.value) return null;
  return {
    id: ohaChoice.value.ch.id,
    name: ohaChoice.value.ch.name,
    logo: ohaChoice.value.ch.logo ?? undefined,
    url: ohaChoice.value.url,
  };
});

function markFailed(candidate: Candidate | null, matchId: string) {
  if (!candidate) return;
  const key = `${matchId}:${candidate.url}`;
  if (!failed.value.includes(key)) failed.value.push(key);
  if (candidate.provider) {
    const providerKey = `${matchId}:provider:${candidate.provider}`;
    if (!failed.value.includes(providerKey)) failed.value.push(providerKey);
  }
}

function advanceCandidate(reason: string) {
  const matchId = props.matchId;
  const current = activeStream.value;
  markFailed(current, matchId);

  const start = candidateIndex.value + 1;
  let next = -1;
  for (let index = start; index < candidates.value.length; index += 1) {
    const candidate = candidates.value[index];
    if (failed.value.includes(`${matchId}:${candidate.url}`)) continue;
    if (candidate.provider && failed.value.includes(`${matchId}:provider:${candidate.provider}`)) continue;
    next = index;
    break;
  }

  if (next >= 0) {
    candidateChoice.value = next;
    notice.value = `Source indisponible, passage à ${candidates.value[next].name}.`;
  } else {
    notice.value = `${reason.replace(/\.$/, '')}. Aucune autre source testée n’est disponible pour ce match.`;
  }
}

function navigateToNextCandidate() {
  if (candidates.value.length < 2) return;
  const next = (candidateIndex.value + 1) % candidates.value.length;
  const candidate = candidates.value[next];
  failed.value = failed.value.filter((key) => key !== `${props.matchId}:${candidate.url}`);
  if (candidate.provider) {
    failed.value = failed.value.filter((key) => key !== `${props.matchId}:provider:${candidate.provider}`);
  }
  candidateChoice.value = next;
  notice.value = `Source ${next + 1}/${candidates.value.length} : ${candidate.name}.`;
}

function checkEmbedLoaded(event: Event) {
  try {
    const frame = event.currentTarget as HTMLIFrameElement;
    const doc = frame.contentDocument;
    const title = doc?.title ?? '';
    const body = doc?.body?.innerText ?? '';
    const offline = /stream is offline|channel is offline|no stream|access denied|error 404/i;
    if (offline.test(title) || (body.length < 1200 && offline.test(body))) {
      advanceCandidate('La page du player signale un flux indisponible.');
    }
  } catch {
    // Le contenu imbriqué peut être cross-origin et invisible au navigateur.
  }
}

let disposed = false;

async function loadStream(force = false) {
  if (disposed) return;
  if (!force && (primary.value || loading.value)) return;
  loading.value = true;
  notice.value = '';
  try {
    let resolved = await fetchMatchStream(props.matchId, props.homeName, props.awayName);
    if (!hasPlayable(resolved)) {
      resolved = await fetchSportsStream(props.matchId);
    }
    if (disposed) return;
    primary.value = resolved;
    candidateChoice.value = 0;

    const id = resolved?.sourceMatchId || resolved?.matchId || props.matchId;
    if (resolved?.sourceMatchId && id) {
      const extra = await fetchSportsChannels(id);
      if (!disposed) backup.value = extra;
    }
  } finally {
    if (!disposed) loading.value = false;
  }
}

async function loadChannels() {
  if (disposed) return;
  const next = await fetchMatchChannels({
    sport: props.sport,
    league: props.league,
    home: props.homeName,
    away: props.awayName,
    start: props.startTime,
  });
  if (!disposed) statuses.value = next;
}

async function playOha(channel: OhaChannel, silent = false): Promise<boolean> {
  if (ohaResolving.value) return false;
  ohaError.value = null;
  ohaResolving.value = channel.id;
  try {
    const url = await resolveOhaStream(channel.id, channel.altIds ?? []);
    if (!disposed) ohaChoice.value = { ch: channel, url };
    return true;
  } catch {
    if (!silent && !disposed) ohaError.value = `Lien ${channel.name} momentanément indisponible.`;
    return false;
  } finally {
    if (!disposed) ohaResolving.value = null;
  }
}

function switchExternal() {
  ohaChoice.value = null;
  ohaError.value = null;
}

async function tryConfirmedChannels() {
  for (const channel of confirmedChannels.value) {
    if (disposed) return;
    if (await playOha(channel, true)) return;
  }
  if (!disposed) ohaError.value = 'Chaîne confirmée indisponible — autres sources conservées.';
}

watch(
  () => [props.matchId, props.homeName, props.awayName],
  () => {
    primary.value = null;
    backup.value = null;
    candidateChoice.value = null;
    failed.value = [];
    notice.value = '';
    ohaChoice.value = null;
    ohaError.value = null;
    statuses.value = [];
    autoTried.value = null;
    void loadStream(true);
    void loadChannels();
  },
  { immediate: true },
);

watch(
  () => [props.league, props.sport, props.startTime],
  () => void loadChannels(),
);

watch(
  () => [statuses.value, props.isLive, props.startTime],
  () => {
    const first = confirmedChannels.value[0];
    if (!first || ohaChoice.value) return;
    const key = `${props.matchId}:${first.id}`;
    if (autoTried.value === key) return;
    const startMs = props.startTime ? Date.parse(props.startTime) : Number.NaN;
    const reached = props.isLive || (Number.isFinite(startMs) && Date.now() >= startMs - 5 * 60_000);
    if (!reached) return;
    autoTried.value = key;
    void tryConfirmedChannels();
  },
);

function syncFullscreen() {
  isFullscreen.value = isFullscreenActive();
}

async function toggleFullscreen() {
  if (!containerRef.value) return;
  const video = containerRef.value.querySelector('video');
  if (isFullscreen.value || isFullscreenActive()) {
    await exitFullscreen(video).catch(() => {});
  } else {
    const entered = await enterFullscreen(containerRef.value, video);
    isFullscreen.value = entered;
  }
}

let channelTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  PopupFirewall.activate();
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
  channelTimer = setInterval(() => void loadChannels(), 60_000);
  void nextTick(() => syncFullscreen());
});

onBeforeUnmount(() => {
  disposed = true;
  PopupFirewall.deactivate();
  document.removeEventListener('fullscreenchange', syncFullscreen);
  document.removeEventListener('webkitfullscreenchange', syncFullscreen);
  if (channelTimer) clearInterval(channelTimer);
});
</script>
