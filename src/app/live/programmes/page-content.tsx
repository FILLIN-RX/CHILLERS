"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Television,
  MagnifyingGlass,
  Trophy,
  FilmStrip,
  Baby,
  MusicNotes,
  CalendarBlank,
  ArrowLeft,
  Play,
  CircleNotch,
} from "@phosphor-icons/react";
import { getOhaChannels, resolveOhaStream } from "@/services/oha";
import {
  OHA_CATEGORY_LABELS,
  OHA_CATEGORY_ORDER,
  type OhaCategory,
  type OhaChannel,
} from "@/types/oha";
import type { LiveChannel } from "@/types/live";
import { competitionsForChannel } from "@/lib/match-channels";
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

function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

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

export default function ProgramGuideContent() {
  const [activeCat, setActiveCat] = useState<CatFilter>("all");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<{ ch: OhaChannel; streamUrl: string } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const { data: channels = [], isLoading } = useQuery({
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

  const playerChannels = useMemo(
    () => filtered.map((c) => toLiveChannel(c, "")),
    [filtered],
  );

  const play = async (ch: OhaChannel) => {
    if (resolvingId) return;
    setPlayError(null);
    setResolvingId(ch.id);
    try {
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
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au Live
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <CalendarBlank className="w-7 h-7 text-red-500" />
              Programmes TV par chaîne
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Consultez le programme en cours et à venir des chaînes de télévision françaises.
            </p>
          </div>
        </div>

        {/* Barre filtres + recherche */}
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
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-64">
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

        {/* Message d'erreur de lecture */}
        {playError && (
          <div className="mb-6 p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-xs text-red-200 flex items-center justify-between">
            <span>{playError}</span>
            <button
              onClick={() => setPlayError(null)}
              className="text-red-400 hover:text-white font-bold text-sm ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-20 bg-zinc-900/60 rounded-xl border border-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Liste des programmes par chaîne */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((ch) => {
              const isResolving = resolvingId === ch.id;
              const hasNow = Boolean(ch.epgNow?.title);

              return (
                <div
                  key={ch.id}
                  className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-red-500/30 hover:bg-zinc-800/60 transition-all"
                >
                  {/* Chaîne (Logo + Nom) */}
                  <div className="flex items-center gap-4 min-w-[200px] shrink-0">
                    <div className="w-16 h-12 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt={ch.name}
                          className="w-full h-full object-contain filter brightness-110"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs font-black text-zinc-300">
                          {ch.name.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">
                        {ch.name}
                      </h3>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {OHA_CATEGORY_LABELS[ch.category]?.fr ?? ch.category}
                      </span>
                      {competitionsForChannel(ch.name).length > 0 && (
                        <p
                          className="text-[10px] text-zinc-500 truncate max-w-[190px]"
                          title={`Diffuse : ${competitionsForChannel(ch.name).join(", ")}`}
                        >
                          <span className="text-zinc-600">Diffuse : </span>
                          {competitionsForChannel(ch.name).slice(0, 2).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Programmes (Maintenant + Ensuite) */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* En ce moment */}
                    <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/5 flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        À l&apos;antenne
                        {ch.epgNow?.start && ch.epgNow?.end && (
                          <span className="text-zinc-500 font-normal">
                            ({fmtTime(ch.epgNow.start)} - {fmtTime(ch.epgNow.end)})
                          </span>
                        )}
                      </span>
                      {hasNow ? (
                        <p className="text-xs font-semibold text-zinc-100 truncate">
                          {ch.epgNow!.title}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-zinc-500 italic">
                          Programme non disponible
                        </p>
                      )}
                    </div>

                    {/* Ensuite */}
                    <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-white/5 flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Ensuite
                        {ch.epgNext?.start && ch.epgNext?.end && (
                          <span className="text-zinc-600 font-normal ml-1">
                            ({fmtTime(ch.epgNext.start)} - {fmtTime(ch.epgNext.end)})
                          </span>
                        )}
                      </span>
                      {ch.epgNext?.title ? (
                        <p className="text-xs font-medium text-zinc-300 truncate">
                          {ch.epgNext.title}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-zinc-600 italic">—</p>
                      )}
                    </div>
                  </div>

                  {/* Bouton Regarder */}
                  <div className="shrink-0 flex items-center justify-end">
                    <button
                      onClick={() => play(ch)}
                      disabled={isResolving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isResolving ? (
                        <CircleNotch className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play weight="fill" className="w-4 h-4" />
                      )}
                      <span>Regarder</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Aucun résultat */}
        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center bg-zinc-900/40 border border-white/5 rounded-2xl">
            <CalendarBlank className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 font-medium">
              Aucune chaîne ne correspond à votre recherche.
            </p>
          </div>
        )}
      </div>

      {/* Reader Modal */}
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
