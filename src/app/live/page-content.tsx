"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Television,
  MagnifyingGlass,
  X,
  SquaresFour,
  FilmStrip,
  ShareNetwork,
  Check,
} from "@phosphor-icons/react";
import { getLiveChannels, FALLBACK_CHANNELS } from "@/services/live";
import { getOhaChannels, resolveOhaStream } from "@/services/oha";
import type { OhaChannel, OhaCategory } from "@/types/oha";
import type { LiveChannel } from "@/types/live";
import LivePlayer from "@/components/LivePlayer";
import SportsMatchesRow from "@/components/SportsMatchesRow";
import MosaicChannelCard from "@/components/live/MosaicChannelCard";
import ChannelPosterCard from "@/components/live/ChannelPosterCard";
import LivePlayerModal from "@/components/live/LivePlayerModal";

const PAGE_SIZE = 50;

/** Catégorie oha → catégorie du live (null = uniquement « Toutes »/favoris). */
const OHA_CAT_TO_LIVE: Record<OhaCategory, string | null> = {
  general: null,
  sport: "sports",
  cine: "cinema",
  kids: "kids",
  musique: "music",
};

function ohaToLiveChannel(ch: OhaChannel): LiveChannel {
  const cat = OHA_CAT_TO_LIVE[ch.category];
  return {
    _id: `oha-${ch.id}`,
    name: ch.name,
    slug: `oha-${ch.id}`,
    logo: ch.logo ?? undefined,
    categories: cat ? [cat] : [],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "", // résolu au clic via /api/live/oha/resolve
    enabled: true,
    order: 0,
    isOnline: true,
    proxy: true,
    epgNow: ch.epgNow,
    epgNext: ch.epgNext,
  };
}

export default function LivePageContent() {
  const [viewMode, setViewMode] = useState<"mosaic" | "cards">("mosaic");
  const [search, setSearch] = useState("");
  const [isMultiLiveOpen, setIsMultiLiveOpen] = useState(false);
  const [selectedMultiSlugs, setSelectedMultiSlugs] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [shareCopied, setShareCopied] = useState(false);
  const handleSharePage = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'CHILLERS · TV en Direct', url });
        return;
      }
      throw new Error('no-web-share');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {}
    }
  };
  const [playingChannel, setPlayingChannel] = useState<LiveChannel | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  const { data: channels = FALLBACK_CHANNELS, isLoading } = useQuery({
    queryKey: ["live", "channels"],
    queryFn: () => getLiveChannels(),
    staleTime: 60_000,
  });

  // Catalogue FR curaté (oha.to) — même cache que l'onglet TV / la page /live/tv.
  const { data: ohaChannels = [] } = useQuery({
    queryKey: ["oha", "channels"],
    queryFn: getOhaChannels,
    staleTime: 10 * 60_000,
  });

  const ohaBySlug = useMemo(() => {
    const m = new Map<string, OhaChannel>();
    for (const c of ohaChannels) m.set(`oha-${c.id}`, c);
    return m;
  }, [ohaChannels]);

  const [resolvingSlug, setResolvingSlug] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  // Grille principale : chaînes FR d'abord, puis les chaînes backend restantes.
  const baseChannels = useMemo(() => {
    const ohaLive = ohaChannels.map(ohaToLiveChannel);
    const seen = new Set(ohaLive.map((c) => c.slug));
    const backend = channels.filter((c) => !seen.has(c.slug));
    return [...ohaLive, ...backend];
  }, [ohaChannels, channels]);

  /** Clic sur une carte : direct si le flux existe déjà, sinon résolution oha. */
  const openChannel = async (channel: LiveChannel) => {
    if (channel.streamUrl) {
      setPlayingChannel(channel);
      return;
    }
    const oha = ohaBySlug.get(channel.slug);
    if (!oha || resolvingSlug) return;
    setPlayError(null);
    setResolvingSlug(channel.slug);
    try {
      // Le serveur résout primary + replis en parallèle et vérifie les playlists.
      const url = await resolveOhaStream(oha.id, oha.altIds ?? []);
      setPlayingChannel({ ...channel, streamUrl: url });
    } catch {
      setPlayError(`Lien indisponible pour ${channel.name}. Réessayez plus tard.`);
    } finally {
      setResolvingSlug(null);
    }
  };

  // Sélection multi-live : slots vides → repli sur les premières chaînes.
  const displayMultiSlugs = [0, 1, 2, 3].map(
    (i) => selectedMultiSlugs[i] || channels[i]?.slug || "",
  );

  // Reset pagination on search change (« ajuster pendant le rendu »).
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setVisibleCount(PAGE_SIZE);
  }

  const filteredChannels = useMemo(() => {
    let list = baseChannels;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.categories?.some((cat) => cat.toLowerCase().includes(q))
      );
    }

    return list;
  }, [baseChannels, search]);

  // Infinite Scroll Trigger
  const paginatedChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  const hasMore = visibleCount < filteredChannels.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredChannels.length));
    }
  }, [hasMore, filteredChannels.length]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="min-h-screen bg-[#1F1F1F] text-white pt-[72px] pb-28 px-2 sm:px-6 md:px-12 lg:px-[3%] select-none">
      {/* ── 1. Football Matches Row (Live Scores) ─────────────────────────── */}
      <div className="mb-10">
        <SportsMatchesRow />
      </div>

      {/* ── 3. Controls Bar (recherche, vue, multi-view) ───────────────────── */}
      <div className="sticky top-[calc(var(--network-banner-height,0px)+48px)] sm:top-[calc(var(--network-banner-height,0px)+52px)] z-30 bg-[#1F1F1F]/95 backdrop-blur-xl py-3 -mx-2 px-2 sm:-mx-6 sm:px-6 md:-mx-12 md:px-12 lg:-mx-[3%] lg:px-[3%] border-b border-white/10 mb-8">
        <div className="flex items-center gap-2 sm:gap-3 justify-end">
          {/* Bouton Partager */}
          <button
            onClick={handleSharePage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold transition-all shrink-0"
            aria-label="Partager la page"
            title="Partager"
          >
            {shareCopied ? <Check className="w-4 h-4 text-green-400" /> : <ShareNetwork className="w-4 h-4" />}
            <span className="hidden sm:inline">{shareCopied ? 'Copié !' : 'Partager'}</span>
          </button>
          {/* View Mode Toggle (Mosaïque Logos Canal+ vs Affiches) */}
          <div className="flex items-center bg-zinc-900/90 border border-white/10 rounded-xl p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("mosaic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-bold transition-all ${
                viewMode === "mosaic"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Mosaïque de logos Canal+"
            >
              <SquaresFour className="w-4 h-4" />
              <span className="hidden sm:inline">Mosaïque Logos</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs font-bold transition-all ${
                viewMode === "cards"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Affiches et aperçus des programmes"
            >
              <FilmStrip className="w-4 h-4" />
              <span className="hidden sm:inline">Affiches</span>
            </button>
          </div>

          <button
            onClick={() => setIsMultiLiveOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-[5px] bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-400 hover:text-white text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap"
          >
            <SquaresFour className="w-4 h-4" />
            <span className="hidden sm:inline">Multi-View</span>
            <span className="sm:hidden">4X</span>
          </button>

          <div className="relative flex-1 md:w-56">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-colors shadow-inner"
            />
          </div>
          <span className="hidden lg:inline-block px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-bold text-zinc-400 whitespace-nowrap">
            {filteredChannels.length} chaînes
          </span>
        </div>
      </div>

      {/* ── 4. Grille Live (Mosaïque Logos ou Affiches) ──────────────────── */}
      {viewMode === "mosaic" ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3 md:gap-4">
          {paginatedChannels.map((channel) => (
            <MosaicChannelCard
              key={channel.slug}
              channel={channel}
              onOpen={openChannel}
              isResolving={resolvingSlug === channel.slug}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
          {paginatedChannels.map((channel) => (
            <ChannelPosterCard
              key={channel.slug}
              channel={channel}
              onOpen={openChannel}
              isResolving={resolvingSlug === channel.slug}
            />
          ))}
        </div>
      )}

      {/* ── Infinite Scroll Sentinel / Loading Indicator ───────────────── */}
      {hasMore && (
        <div ref={observerTarget} className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Chargement de plus de chaînes ({paginatedChannels.length} / {filteredChannels.length})...
          </p>
          <button
            onClick={loadMore}
            className="mt-2 px-5 py-2 rounded-[5px] bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 border border-white/10 transition-colors"
          >
            Afficher plus manuellement
          </button>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {!isLoading && filteredChannels.length === 0 && (
        <div className="py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
            <Television className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">Aucune chaîne trouvée</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Essayez avec d&apos;autres mots-clés.
          </p>
        </div>
      )}

      {/* ── Toast erreur de lecture ───────────────────────────────────────── */}
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

      {/* ── Lecteur modal plein écran (remplace l'ancienne page détail) ──── */}
      {playingChannel && (
        <LivePlayerModal
          channel={playingChannel}
          allChannels={filteredChannels}
          onClose={() => setPlayingChannel(null)}
          onSelectChannel={(ch) => setPlayingChannel(ch)}
        />
      )}

      {/* ── 6. Multi-Live Modal Split View (4 Screens) ─────────────────────── */}
      {isMultiLiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col p-3 sm:p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                Multi-Live Multiplex (4 Écrans Simultanés)
              </h2>
            </div>
            <button
              onClick={() => setIsMultiLiveOpen(false)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-0 py-2">
            {[0, 1, 2, 3].map((idx) => {
              const currentSlug = displayMultiSlugs[idx];
              const ch = channels.find((c) => c.slug === currentSlug) || channels[idx % channels.length];

              return (
                <div
                  key={idx}
                  className="relative bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 flex flex-col min-h-[240px] sm:min-h-0"
                >
                  {/* Selector Dropdown Header */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-2 max-w-[calc(100%-1.5rem)]">
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-[10px] sm:text-xs font-black text-white shrink-0 shadow-lg">
                      Écran {idx + 1}
                    </span>
                    <select
                      value={ch?.slug || ""}
                      onChange={(e) => {
                        const newSlug = e.target.value;
                        setSelectedMultiSlugs((prev) => {
                          const copy = [...prev];
                          copy[idx] = newSlug;
                          return copy;
                        });
                      }}
                      className="bg-black/90 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-lg px-3 py-1 focus:outline-none focus:border-red-500 max-w-[180px] sm:max-w-[240px] truncate cursor-pointer shadow-lg"
                    >
                      {channels.map((c) => (
                        <option key={c.slug} value={c.slug} className="bg-zinc-900 text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 relative w-full h-full">
                    {ch && (
                      <LivePlayer
                        channel={ch}
                        allChannels={channels}
                        onBack={() => setIsMultiLiveOpen(false)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
