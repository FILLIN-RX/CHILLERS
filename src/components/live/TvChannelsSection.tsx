"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Television,
  MagnifyingGlass,
  X,
  Trophy,
  FilmStrip,
  Baby,
  MusicNotes,
  CalendarBlank,
} from "@phosphor-icons/react";
import { getOhaChannels, resolveOhaStream } from "@/services/oha";
import {
  OHA_CATEGORY_LABELS,
  OHA_CATEGORY_ORDER,
  type OhaCategory,
  type OhaChannel,
} from "@/types/oha";
import type { LiveChannel } from "@/types/live";
import TvChannelCard from "@/components/live/TvChannelCard";
import LivePlayerModal from "@/components/live/LivePlayerModal";

type CatFilter = "all" | OhaCategory;

const TABS: { id: CatFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "Toutes", icon: Television },
  ...OHA_CATEGORY_ORDER.map((cat) => ({
    id: cat as CatFilter,
    label: OHA_CATEGORY_LABELS[cat].fr,
    icon:
      cat === "sport"
        ? Trophy
        : cat === "cine"
          ? FilmStrip
          : cat === "kids"
            ? Baby
            : cat === "musique"
              ? MusicNotes
              : Television,
  })),
];

function toLiveChannel(ch: OhaChannel, streamUrl: string): LiveChannel {
  return {
    _id: `oha-${ch.id}`,
    name: ch.name,
    slug: `oha-${ch.id}`,
    logo: ch.logo ?? undefined,
    categories: [ch.category],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl,
    enabled: true,
    order: 0,
    isOnline: true,
    proxy: true,
    epgNow: ch.epgNow,
    epgNext: ch.epgNext,
  };
}

/**
 * Grille des chaînes FR (oha.to) — utilisée par /live/tv et par l'onglet
 * « TV Française » de /live. Gère recherche, sous-catégories, résolution
 * avec repli sur les sources alternatives, et lecteur modal plein écran.
 */
export default function TvChannelsSection() {
  const [activeCat, setActiveCat] = useState<CatFilter>("all");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<{ ch: OhaChannel; streamUrl: string } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const { data: channels = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["oha", "channels"],
    queryFn: getOhaChannels,
    staleTime: 10 * 60_000,
  });

  const filtered = useMemo(() => {
    let list = channels;
    if (!search.trim() && activeCat !== "all") {
      list = list.filter((c) => c.category === activeCat);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [channels, activeCat, search]);

  const counts = useMemo(() => {
    const m = new Map<CatFilter, number>([["all", channels.length]]);
    for (const cat of OHA_CATEGORY_ORDER) m.set(cat, 0);
    for (const c of channels) {
      m.set(c.category, (m.get(c.category) ?? 0) + 1);
    }
    return m;
  }, [channels]);

  const playerChannels = useMemo(
    () => filtered.map((c) => toLiveChannel(c, "")),
    [filtered],
  );

  const play = async (ch: OhaChannel) => {
    if (resolvingId) return;
    setPlayError(null);
    setResolvingId(ch.id);
    try {
      // Le serveur résout primary + replis en parallèle et vérifie les playlists.
      const url = await resolveOhaStream(ch.id, ch.altIds ?? []);
      setPlaying({ ch, streamUrl: url });
    } catch {
      setPlayError(`Lien indisponible pour ${ch.name}. Réessayez plus tard.`);
    } finally {
      setResolvingId(null);
    }
  };

  const selectInPlayer = async (liveCh: LiveChannel) => {
    const id = liveCh.slug.replace(/^oha-/u, "");
    const ch = channels.find((c) => c.id === id);
    if (!ch || ch.id === playing?.ch.id) return;
    await play(ch);
  };

  return (
    <div>
      {/* ── Sous-onglets + recherche ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCat === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCat(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-[5px] text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                    : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    isActive ? "bg-black/30" : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {counts.get(tab.id) ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link
            href="/live/programmes"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white transition-colors shrink-0"
          >
            <CalendarBlank className="w-4 h-4 text-red-500" />
            <span>Programmes TV</span>
          </Link>

          <div className="relative flex-1 md:w-56">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une chaîne..."
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-colors shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* ── Grille ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] bg-zinc-900/60 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
            <Television className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Chaînes indisponibles</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Impossible de charger le catalogue pour le moment.
          </p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-all"
          >
            Réessayer
          </button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
            <MagnifyingGlass className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Aucune chaîne trouvée</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Essayez un autre mot-clé ou une autre catégorie.
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {filtered.map((ch) => (
            <TvChannelCard
              key={ch.id}
              ch={ch}
              isPlaying={playing?.ch.id === ch.id}
              isResolving={resolvingId === ch.id}
              onPlay={play}
            />
          ))}
        </div>
      )}

      {/* ── Toast erreur ────────────────────────────────────────── */}
      {playError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-red-500/40 shadow-2xl shadow-red-900/30 animate-fade-in max-w-[92vw]">
          <p className="text-xs font-bold text-white">{playError}</p>
          <button
            onClick={() => setPlayError(null)}
            className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Lecteur modal plein écran ───────────────────────────── */}
      {playing && (
        <LivePlayerModal
          channel={toLiveChannel(playing.ch, playing.streamUrl)}
          allChannels={playerChannels}
          onClose={() => setPlaying(null)}
          onSelectChannel={selectInPlayer}
        />
      )}
    </div>
  );
}
