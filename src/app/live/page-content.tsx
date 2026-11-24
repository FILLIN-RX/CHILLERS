"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Television, MagnifyingGlass, X } from "@phosphor-icons/react";
import { getLiveChannels, FALLBACK_CHANNELS } from "@/services/live";
import { getOhaChannels, resolveOhaStream } from "@/services/oha";
import { canonicalChannelKey, channelPriority } from "@/lib/channel-canonical";
import { liveChannelRef, matchesLiveChannelRef } from "@/lib/live-channel-url";
import { ohaChannelSlug, type OhaChannel, type OhaCategory } from "@/types/oha";
import type { LiveChannel } from "@/types/live";
import SportsMatchesRow from "@/components/SportsMatchesRow";
import LiveChannelCard from "@/components/live/LiveChannelCard";
import LivePlayerModal from "@/components/live/LivePlayerModal";

const PAGE_SIZE = 50;

// OHA returned 502 "all sources dead" for these channels on 2026-11-24,
// including their alternate source IDs. Seeded/direct alternatives of the
// same names are kept below because they may still play independently.
const OHA_UNPLAYABLE_NAMES = new Set([
  "CINE+ ACTION",
  "CINE+ PREMIER",
  "DISNEY CINEMA",
  "OCS FRANCEBOX 4",
  "OCS FRANCEBOX 5",
  "PARAMOUNT DECALE",
  "C STAR HIT",
  "LCP ASSEMBLEE NATIONALE",
  "RMC STORY",
  "TF1",
  "TFX",
  "BABY TV",
  "CANAL JUNIOR",
  "CARTOON NETWORK",
  "DISNEY CHANNEL",
  "NICKELODEON +1",
  "NRJ HITS",
  "TRACE AFRICA",
  "TRACE SPORT STARS",
  "TRACE URBAN",
  "BEIN SPORTS 1",
  "BEIN SPORTS MAX 7",
  "BEIN SPORTS MAX 9",
  "CANAL+ SPORT",
  "CANAL+ SPORT 2",
  "CANAL+ SPORT 360",
  "DAZN 1",
  "DAZN 2 LEAUGE 1",
  "DAZN EVENT 2",
  "DAZN EVENT 6",
  "DAZN LIGUE 1 LIVE 2",
  "DAZN LIGUE 1 LIVE 5",
].map(canonicalChannelKey));

/** Catégorie oha → catégorie du live (null = uniquement « Toutes »/favoris). */
const OHA_CAT_TO_LIVE: Record<OhaCategory, string | null> = {
  general: "general",
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
    slug: ohaChannelSlug(ch.name),
    logo: ch.logo ?? undefined,
    categories: cat ? [cat] : [],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: ch.streamUrl ?? "", // URL HLS en cache, sinon résolue à la demande.
    enabled: true,
    order: 0,
    isOnline: true,
    proxy: true,
    source: "oha",
    ohaId: ch.id,
    ohaAltIds: ch.altIds ?? [],
    epgNow: ch.epgNow,
    epgNext: ch.epgNext,
  };
}

export default function LivePageContent() {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [playingChannel, setPlayingChannel] = useState<LiveChannel | null>(null);
  const [deepLinkRef, setDeepLinkRef] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  const { data: channels = FALLBACK_CHANNELS, isLoading } = useQuery({
    queryKey: ["live", "channels"],
    queryFn: () => getLiveChannels(),
    staleTime: 60_000,
  });

  // Catalogue FR curaté (oha.to) — même cache que l'onglet TV / la page /live/tv.
  const { data: ohaChannels = [], isLoading: isOhaLoading } = useQuery({
    queryKey: ["oha", "channels"],
    queryFn: getOhaChannels,
    staleTime: 2 * 60_000,
  });

  const ohaBySlug = useMemo(() => {
    const m = new Map<string, OhaChannel>();
    for (const c of ohaChannels) m.set(ohaChannelSlug(c.name), c);
    return m;
  }, [ohaChannels]);

  const ohaById = useMemo(() => {
    const m = new Map<string, OhaChannel>();
    for (const c of ohaChannels) m.set(c.id, c);
    return m;
  }, [ohaChannels]);

  const [resolvingSlug, setResolvingSlug] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [unavailableKeys, setUnavailableKeys] = useState<Set<string>>(() => new Set());

  // Une seule carte par chaîne canonique. Les flux seed/manuels stables passent
  // avant les flux OHA ; les cartes sans flux ni source résoluble sont écartées.
  const baseChannels = useMemo(() => {
    const byKey = new Map<string, LiveChannel>();
    for (const candidate of [...ohaChannels.map(ohaToLiveChannel), ...channels]) {
      const priority = channelPriority(candidate);
      if (priority === 0) continue;

      // Drop only the dead OHA entry; an independently configured stream
      // (seed/manual) with the same name can still win and remain visible.
      if (
        candidate.source === "oha" &&
        OHA_UNPLAYABLE_NAMES.has(canonicalChannelKey(candidate.name))
      ) continue;

      const key = canonicalChannelKey(candidate.name);
      if (unavailableKeys.has(key)) continue;

      const current = byKey.get(key);
      if (!current || priority > channelPriority(current)) {
        byKey.set(key, candidate);
      }
    }
    return [...byKey.values()];
  }, [ohaChannels, channels, unavailableKeys]);

  const handledDeepLinkRef = useRef<string | null>(null);

  const syncChannelParam = useCallback((ref: string | null) => {
    handledDeepLinkRef.current = ref;
    setDeepLinkRef(ref);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (ref) url.searchParams.set("ch", ref);
    else url.searchParams.delete("ch");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const markUnavailable = (channel: LiveChannel) => {
    const key = canonicalChannelKey(channel.name);
    setUnavailableKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setPlayError(`Lien indisponible pour ${channel.name}. Réessayez plus tard.`);
    syncChannelParam(null);
  };

  /** Clic sur une carte : ouverture immédiate, résolution en arrière-plan. */
  const openChannel = async (channel: LiveChannel) => {
    const oha = ohaBySlug.get(channel.slug)
      ?? (channel.ohaId ? ohaById.get(channel.ohaId) : undefined);

    if (oha) {
      if (resolvingSlug) return;
      setPlayError(null);
      setResolvingSlug(channel.slug);
      const base = {
        ...channel,
        streamUrl: "",
        source: "oha",
        ohaId: oha.id,
        ohaAltIds: oha.altIds ?? [],
        proxy: true,
      };
      setPlayingChannel(base);
      syncChannelParam(liveChannelRef(base));
      try {
        // Le serveur résout primary + replis en parallèle et vérifie les playlists.
        let url: string;
        try {
          url = await resolveOhaStream(oha.id, oha.altIds ?? []);
        } catch {
          url = await resolveOhaStream(oha.id, oha.altIds ?? [], { force: true });
        }
        setPlayingChannel((current) =>
          current?._id === base._id ? { ...base, streamUrl: url } : current,
        );
      } catch {
        setPlayingChannel((current) => (current?._id === base._id ? null : current));
        markUnavailable(channel);
      } finally {
        setResolvingSlug(null);
      }
      return;
    }

    if (channel.streamUrl) {
      setPlayingChannel(channel);
      syncChannelParam(liveChannelRef(channel));
      return;
    }

    markUnavailable(channel);
  };

  const openChannelRef = useRef(openChannel);
  useEffect(() => {
    openChannelRef.current = openChannel;
  });

  useEffect(() => {
    const readDeepLink = () => {
      setDeepLinkRef(new URLSearchParams(window.location.search).get("ch"));
    };
    readDeepLink();
    window.addEventListener("popstate", readDeepLink);
    return () => window.removeEventListener("popstate", readDeepLink);
  }, []);

  useEffect(() => {
    if (!deepLinkRef) {
      handledDeepLinkRef.current = null;
      return;
    }
    if (handledDeepLinkRef.current === deepLinkRef) return;
    if (isLoading || isOhaLoading) return;
    let match = baseChannels.find((channel) => matchesLiveChannelRef(channel, deepLinkRef));
    if (!match && deepLinkRef.startsWith("oha-")) {
      const oha = ohaById.get(deepLinkRef.slice(4));
      if (oha) match = ohaToLiveChannel(oha);
    }
    if (!match) return;
    handledDeepLinkRef.current = deepLinkRef;
    void openChannelRef.current(match);
  }, [deepLinkRef, baseChannels, isLoading, isOhaLoading, ohaById]);

  const closeChannel = useCallback(() => {
    setPlayingChannel(null);
    syncChannelParam(null);
  }, [syncChannelParam]);

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

      {/* ── 3. Recherche : la barre reste flottante, sans ligne de séparation ── */}
      <div className="sticky top-[calc(var(--network-banner-height,0px)+48px)] sm:top-[calc(var(--network-banner-height,0px)+52px)] z-30 bg-[#1F1F1F]/80 backdrop-blur-xl py-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-colors shadow-inner"
            />
          </div>
          <span className="shrink-0 px-3 py-2 rounded-xl liquid-glass-surface text-xs font-bold text-white/80 whitespace-nowrap">
            {filteredChannels.length} chaînes
          </span>
        </div>
      </div>

      {/* ── 4. Cartes live inspirées des cartes de matchs ───────────────── */}
      <div className="grid auto-rows-[76px] grid-cols-2 gap-3 sm:auto-rows-[84px] sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {paginatedChannels.map((channel, index) => (
          <LiveChannelCard
            key={channel.slug}
            channel={channel}
            onOpen={openChannel}
            isResolving={resolvingSlug === channel.slug}
            layout={
              index % 17 === 0 || index % 17 === 9 || index % 17 === 15
                ? "wide"
                : index % 17 === 4 || index % 17 === 11
                  ? "tall"
                  : (index % 17 === 7 || index % 17 === 14) && Boolean(channel.logo)
                    ? "logo"
                    : "regular"
            }
          />
        ))}
      </div>

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
          onClose={closeChannel}
          onSelectChannel={(ch) => setPlayingChannel(ch)}
        />
      )}


    </div>
  );
}
