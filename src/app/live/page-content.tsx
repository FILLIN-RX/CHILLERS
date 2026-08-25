"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconDeviceTv,
  IconSearch,
  IconStar,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconX,
} from "@tabler/icons-react";
import { getLiveChannels, FALLBACK_CHANNELS } from "@/services/live";
import type { LiveChannel } from "@/types/live";
import LivePlayer from "@/components/LivePlayer";

export function ChannelLogo({ channel }: { channel: LiveChannel }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [channel.logo]);

  const initials = channel.name
    .replace(/^bein\s+sports/i, "beIN")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!channel.logo || broken) {
    return (
      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-300 shrink-0 shadow-sm">
        {initials || "TV"}
      </div>
    );
  }

  return (
    <div className="h-7 w-12 px-1 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
      <img
        src={channel.logo}
        alt={channel.name}
        className="h-full w-auto object-contain max-h-5"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

const CATEGORIES = [
  { id: "favorites", label: "FAVORIS" },
  { id: "all", label: "TOUTES LES CHAÎNES" },
  { id: "sports", label: "SPORT" },
  { id: "cinema", label: "CINÉMA" },
  { id: "kids", label: "JEUNESSE" },
  { id: "news", label: "INFOS" },
  { id: "series", label: "SÉRIES" },
  { id: "documentary", label: "DÉCOUVERTE" },
  { id: "entertainment", label: "DIVERTISSEMENT" },
  { id: "music", label: "MUSIQUE" },
];

const CHANNEL_PROGRAMS: Record<string, { program: string; category: string; banner?: string }> = {
  "crtv-sport": {
    program: "CRTV Sport Live",
    category: "Sports & Directs",
    banner: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80",
  },
  "canal-2-international": {
    program: "Canal 2 International",
    category: "Grandes Éditions & Mag",
    banner: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80",
  },
  "equinoxe-tv": {
    program: "Équinoxe TV Soir",
    category: "Mag. Actualités & Débats",
    banner: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&auto=format&fit=crop&q=80",
  },
  "bein-sports-xtra": {
    program: "beIN Live Match Football",
    category: "Football & Ligue 1 / Champions",
    banner: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop&q=80",
  },
  "bein-sports-xtra-hd": {
    program: "beIN Sports XTRA Action",
    category: "Sports US & Direct",
    banner: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop&q=80",
  },
  "red-bull-tv": {
    program: "Red Bull Action Sports Live",
    category: "Extreme Sports & Drift",
    banner: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80",
  },
  "fight-network": {
    program: "Fight Night Championship",
    category: "MMA & Boxe Pro",
    banner: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
  },
  "france-24-francais": {
    program: "Le Journal International",
    category: "Information en Continu",
    banner: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80",
  },
  "tv5monde-europe": {
    program: "Le 64 Minutes",
    category: "Culture & Monde",
    banner: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
  },
  "euronews-francais": {
    program: "Euronews Direct",
    category: "Actualités Européennes",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
  },
  "sky-news": {
    program: "Sky News Live Broadcast",
    category: "Global Breaking News",
    banner: "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80",
  },
};

export default function LivePageContent() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isMultiLiveOpen, setIsMultiLiveOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("chillers_live_favorites");
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleFavorite = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem("chillers_live_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const { data: channels = FALLBACK_CHANNELS, isLoading } = useQuery({
    queryKey: ["live", "channels"],
    queryFn: () => getLiveChannels(),
    staleTime: 60_000,
  });

  const filteredChannels = useMemo(() => {
    let list = channels;

    if (activeCategory === "favorites") {
      list = list.filter((c) => favorites.includes(c.slug));
    } else if (activeCategory !== "all") {
      list = list.filter((c) =>
        c.categories?.some((cat) => {
          if (activeCategory === "sports") return cat === "sports";
          if (activeCategory === "news") return cat === "news" || cat === "politics" || cat === "business";
          if (activeCategory === "cinema") return cat === "movies" || cat === "cinema";
          if (activeCategory === "series") return cat === "series";
          if (activeCategory === "entertainment") return cat === "entertainment" || cat === "general";
          if (activeCategory === "kids") return cat === "kids" || cat === "animation";
          if (activeCategory === "music") return cat === "music";
          if (activeCategory === "documentary") return cat === "documentary";
          return cat === activeCategory;
        })
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.categories?.some((cat) => cat.toLowerCase().includes(q))
      );
    }

    return list;
  }, [channels, activeCategory, search, favorites]);

  return (
    <div className="min-h-screen bg-[#0E0E11] text-white pt-20 sm:pt-24 pb-24 px-3 sm:px-6 md:px-10 lg:px-[4%] select-none">
      {/* ── Title Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-wider text-white uppercase flex items-center gap-2">
            EN DIRECT
          </h1>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 md:w-72">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une chaîne..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-600 transition-colors"
          />
        </div>
      </div>

      {/* ── Top Category Tabs Navigation Bar ─────────────────────── */}
      <div className="relative border-b border-white/10 pb-1 mb-6">
        <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar scroll-smooth">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`relative pb-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider whitespace-nowrap transition-all ${
                  isActive
                    ? "text-white font-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {cat.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-white rounded-full transition-all" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Live Channel Cards Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
        {/* 1. Special Multi-Live Card (always visible on 'all') */}
        {activeCategory === "all" && !search && (
          <div
            onClick={() => setIsMultiLiveOpen(true)}
            className="group relative cursor-pointer flex flex-col rounded-xl overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-white/10 hover:border-red-600/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-red-600/10"
          >
            {/* 16:9 Thumbnail Mock */}
            <div className="w-full aspect-video bg-zinc-950/80 flex items-center justify-center relative overflow-hidden p-6">
              <div className="grid grid-cols-2 gap-1.5 w-16 h-12">
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
              </div>

              {/* Multi-Live Badge */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-red-600 text-[10px] font-black text-white uppercase tracking-wider">
                Multi-View
              </div>
            </div>

            {/* Bottom Info */}
            <div className="p-3 bg-zinc-900/90 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white group-hover:text-red-500 transition-colors">
                  Multi-Live
                </h4>
                <p className="text-[11px] text-zinc-400 font-medium">
                  Regarder 4 chaînes en direct
                </p>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-red-600 transition-all">
                <IconPlayerPlay className="h-3.5 w-3.5 fill-current ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* 2. Channel Cards */}
        {filteredChannels.map((channel) => {
          const info = CHANNEL_PROGRAMS[channel.slug] || {
            program: channel.name,
            category: channel.categories?.[0] ? `Direct · ${channel.categories[0].toUpperCase()}` : "Émission en Direct",
          };
          const isFav = favorites.includes(channel.slug);

          return (
            <Link
              key={channel.slug}
              href={`/live/${channel.slug}`}
              className="group relative flex flex-col rounded-xl overflow-hidden bg-zinc-900/90 border border-white/10 hover:border-red-600/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-red-600/10"
            >
              {/* 16:9 Landscape Thumbnail Preview */}
              <div className="w-full aspect-video bg-zinc-950 relative overflow-hidden">
                {info.banner ? (
                  <img
                    src={info.banner}
                    alt={channel.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-zinc-900 to-zinc-800 flex items-center justify-center">
                    <IconDeviceTv className="h-10 w-10 text-zinc-700" />
                  </div>
                )}

                {/* Dark gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {/* Channel Logo Overlay Bottom-Left */}
                <div className="absolute bottom-2 left-2.5 flex items-center gap-2">
                  <ChannelLogo channel={channel} />
                </div>

                {/* Favorite Button Top-Right */}
                <button
                  onClick={(e) => toggleFavorite(e, channel.slug)}
                  className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all ${
                    isFav
                      ? "bg-amber-500/30 text-amber-400 border border-amber-500/50"
                      : "bg-black/50 text-zinc-400 hover:text-white hover:bg-black/70 opacity-0 group-hover:opacity-100"
                  }`}
                  aria-label="Favori"
                >
                  <IconStar className={`h-3.5 w-3.5 ${isFav ? "fill-amber-400" : ""}`} />
                </button>

                {/* Red Live Progress Bar Indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-zinc-800">
                  <div className="h-full bg-red-600 w-3/4 rounded-r-full shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
                </div>
              </div>

              {/* Card Metadata / Footer */}
              <div className="p-3 bg-zinc-900/95 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:text-red-400 transition-colors">
                    {info.program}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-medium">
                    {info.category}
                  </p>
                </div>

                {/* Action button icon right side */}
                <div className="flex-none text-zinc-500 group-hover:text-white transition-colors">
                  <IconPlayerTrackNext className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Empty State ─────────────────────────────────────────── */}
      {!isLoading && filteredChannels.length === 0 && (
        <div className="py-20 text-center space-y-3">
          <IconDeviceTv className="h-12 w-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-zinc-300">
            {activeCategory === "favorites"
              ? "Aucune chaîne dans vos favoris"
              : "Aucune chaîne trouvée"}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {activeCategory === "favorites"
              ? "Cliquez sur l'étoile d'une chaîne pour l'ajouter à vos favoris."
              : "Essayez de rechercher un autre mot-clé ou sélectionnez une autre catégorie."}
          </p>
        </div>
      )}

      {/* ── Multi-Live Modal Split View ──────────────────────────── */}
      {isMultiLiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                Multi-Live (4 Écrans en Direct)
              </h2>
            </div>
            <button
              onClick={() => setIsMultiLiveOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-0 overflow-hidden">
            {channels.slice(0, 4).map((ch, idx) => (
              <div
                key={ch.slug}
                className="relative bg-black rounded-xl overflow-hidden border border-white/10 flex flex-col"
              >
                <div className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded bg-black/70 backdrop-blur-md border border-white/10 text-xs font-black text-white">
                  Écran {idx + 1} : {ch.name}
                </div>
                <div className="flex-1 relative w-full h-full">
                  <LivePlayer channel={ch} onBack={() => setIsMultiLiveOpen(false)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
