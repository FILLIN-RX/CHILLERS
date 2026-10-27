<template>
  <div class="w-full min-w-0">
    <div class="mb-2 flex items-center justify-between gap-3 px-1">
      <p class="text-[10px] font-black uppercase tracking-widest text-zinc-400">{{ label }}</p>
      <p v-if="hint" class="truncate text-[10px] font-medium text-zinc-500">{{ hint }}</p>
    </div>

    <div class="flex items-stretch gap-2 overflow-x-auto pb-1" style="scrollbar-width: none">
      <button
        v-for="ch in channels"
        :key="ch.id"
        type="button"
        :disabled="Boolean(resolvingId)"
        :title="`${ch.name} — regarder en direct`"
        class="group flex shrink-0 items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-3.5 text-left backdrop-blur-md transition-colors disabled:opacity-60"
        :class="chipClass(ch)"
        @click="emit('select', ch)"
      >
        <span
          class="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          :class="selectedId === ch.id ? 'bg-black/25' : 'bg-black/45'"
        >
          <img
            v-if="ch.logo && !broken[ch.id]"
            :src="ch.logo"
            alt=""
            class="h-5 w-9 object-contain"
            loading="lazy"
            decoding="async"
            @error="broken[ch.id] = true"
          />
          <v-icon v-else size="16" color="zinc-400">mdi-television</v-icon>
        </span>

        <span class="flex min-w-0 flex-col leading-tight">
          <span class="max-w-[9rem] truncate text-[11px] font-bold uppercase tracking-wide">{{ ch.name }}</span>
          <span class="mt-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider" :class="statusClass(ch)">
            <span v-if="isConfirmed(ch)" class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {{ resolvingId === ch.id ? 'Connexion…' : isConfirmed(ch) ? 'En direct' : 'Possible' }}
          </span>
        </span>

        <v-progress-circular
          v-if="resolvingId === ch.id"
          indeterminate
          size="14"
          width="2"
          :color="selectedId === ch.id ? 'white' : 'grey'"
        />
      </button>

      <button
        v-if="externalOption"
        type="button"
        class="flex shrink-0 items-center gap-2.5 rounded-xl border py-1.5 pl-2 pr-3.5 text-left backdrop-blur-md transition-colors"
        :class="externalActive ? 'border-primary bg-primary text-white' : `${chipBase} text-zinc-300`"
        @click="emit('external')"
      >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="externalActive ? 'bg-black/25' : 'bg-black/45'">
          <v-icon size="16">mdi-broadcast</v-icon>
        </span>
        <span class="flex min-w-0 flex-col leading-tight">
          <span class="max-w-[9rem] truncate text-[11px] font-bold uppercase tracking-wide">Autres sources</span>
          <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-wider" :class="externalActive ? 'text-white/80' : 'text-zinc-500'">
            Flux web
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import type { OhaChannel } from '../types/oha';

const props = withDefaults(
  defineProps<{
    channels: OhaChannel[];
    selectedId?: string | null;
    resolvingId?: string | null;
    confirmedIds?: string[];
    label?: string;
    hint?: string;
    externalOption?: boolean;
    externalActive?: boolean;
  }>(),
  {
    selectedId: null,
    resolvingId: null,
    confirmedIds: () => [],
    label: 'Source du direct',
    hint: '',
    externalOption: false,
    externalActive: false,
  },
);

const emit = defineEmits<{ select: [channel: OhaChannel]; external: [] }>();

const broken = reactive<Record<string, boolean>>({});

const chipBase = 'border-white/10 bg-zinc-900/80 hover:bg-zinc-800';

function isConfirmed(channel: OhaChannel): boolean {
  return props.confirmedIds.includes(channel.id);
}

function chipClass(channel: OhaChannel): string {
  if (props.selectedId === channel.id) {
    return 'border-primary bg-primary text-white shadow-lg shadow-red-600/25';
  }
  if (isConfirmed(channel)) {
    return 'border-emerald-400/35 bg-emerald-400/5 text-zinc-100 hover:bg-emerald-400/10';
  }
  return `${chipBase} text-zinc-300`;
}

function statusClass(channel: OhaChannel): string {
  if (props.selectedId === channel.id) return 'text-white/80';
  if (isConfirmed(channel)) return 'text-emerald-300';
  return 'text-zinc-500';
}
</script>
