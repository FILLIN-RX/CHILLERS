"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Television,
  MagnifyingGlass,
  Star,
  X,
  SquaresFour,
  FilmStrip,
  Popcorn,
  Baby,
  Newspaper,
  Compass,
  MusicNotes,
  Trophy,
  CaretLeft,
  CaretRight,
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
import TvChannelsSection from "@/components/live/TvChannelsSection";

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

const CATEGORIES = [
  { id: "all", label: "Toutes", icon: Television },
  { id: "tvfr", label: "TV Française", icon: Television },
  { id: "sports", label: "Sport", icon: Trophy },
  { id: "cinema", label: "Cinéma", icon: FilmStrip },
  { id: "series", label: "Séries", icon: Popcorn },
  { id: "kids", label: "Jeunesse", icon: Baby },
  { id: "news", label: "Infos", icon: Newspaper },
  { id: "documentary", label: "Découverte", icon: Compass },
  { id: "music", label: "Musique", icon: MusicNotes },
  { id: "favorites", label: "Favoris", icon: Star },
];

/* ── 5 THEMED HERO BANNERS (Exact replica of user's CAN & Sports broadcast graphics) ── */
const HERO_SLIDES = [
  {
    id: "can-2027",
    bgClass: "bg-[#FFCC00] text-black",
    theme: "yellow",
    badge: "CAN 2027 QUALIFIERS",
    badgeClass: "bg-black text-white font-black",
    title: "SUIVEZ LES QUALIFICATIONS DE LA CAN 2027",
    subtitle: "À PARTIR DU 24 SEPTEMBRE · EN DIRECT ET EN EXCLUSIVITÉ",
    channelBadge: "SPORT",
    channelSub: "EN DIRECT SUR",
    linkUrl: "/live",
    accentColor: "#000000",
    leftGraphic: "trophy-can",
  },
  {
    id: "ucl-2026",
    bgClass: "bg-gradient-to-r from-[#030B2E] via-[#081B5E] to-[#0D2E8E] text-white",
    theme: "blue",
    badge: "UEFA CHAMPIONS LEAGUE",
    badgeClass: "bg-blue-500 text-white font-black",
    title: "LA PLUS GRANDE DES COMPÉTITIONS EUROPÉENNES",
    subtitle: "TOUS LES MATCHS DES PHASES DE GROUPES EN DIRECT",
    channelBadge: "UCL LIVE",
    channelSub: "DIFFUSEUR OFFICIEL",
    linkUrl: "/live",
    accentColor: "#00E5FF",
    leftGraphic: "trophy-ucl",
  },
  {
    id: "pl-2026",
    bgClass: "bg-gradient-to-r from-[#20002B] via-[#38003C] to-[#50005C] text-white",
    theme: "purple",
    badge: "PREMIER LEAGUE",
    badgeClass: "bg-[#00FF87] text-[#38003C] font-black",
    title: "LE MEILLEUR DU FOOTBALL ANGLAIS CHAQUE WEEK-END",
    subtitle: "MAN CITY · LIVERPOOL · ARSENAL · CHELSEA · MAN UNITED",
    channelBadge: "FOOTBALL",
    channelSub: "LE GRAND FOOTBALL EN DIRECT",
    linkUrl: "/live",
    accentColor: "#00FF87",
    leftGraphic: "lion-pl",
  },
  {
    id: "laliga-2026",
    bgClass: "bg-gradient-to-r from-[#4A000A] via-[#7B0818] to-[#BA0E22] text-white",
    theme: "red",
    badge: "LA LIGA EA SPORTS",
    badgeClass: "bg-amber-400 text-black font-black",
    title: "LE CHOC DES GÉANTS · REAL MADRID vs FC BARCELONE",
    subtitle: "VIVEZ TOUS LES MATCHS DU CHAMPIONNAT ESPAGNOL EN DIRECT",
    channelBadge: "LA LIGA",
    channelSub: "LE CLASSICO EN EXCLUSIVITÉ",
    linkUrl: "/live",
    accentColor: "#FFD700",
    leftGraphic: "laliga",
  },
  {
    id: "live-tv-hd",
    bgClass: "bg-gradient-to-r from-[#0A001F] via-[#1A0047] to-[#003B6E] text-white",
    theme: "cyan",
    badge: "LIVE TV & SPORT HD",
    badgeClass: "bg-cyan-400 text-black font-black",
    title: "VOS CHAÎNES EN DIRECT ET EN EXCLUSIVITÉ",
    subtitle: "SPORT EN DIRECT · CINÉMA · SÉRIES · INFOS 24/7 · DIVERTISSEMENT",
    channelBadge: "DIRECT HD",
    channelSub: "100% DISPONIBLE SUR",
    linkUrl: "/live",
    accentColor: "#00F0FF",
    leftGraphic: "trophy",
  },
];

function SlideNotches({ type }: { type: string }) {
  if (type === "can-2027") {
    return (
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-20"
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        fill="#09090b"
      >
        {/* CAN 2027: Asymmetrical jagged African championship cuts */}
        <polygon points="50,0 75,0 55,26 30,26" />
        <polygon points="210,0 285,0 270,24 225,24" />
        <polygon points="520,0 595,0 580,24 535,24" />
        <polygon points="820,0 895,0 880,24 835,24" />
        <polygon points="1125,0 1150,0 1170,26 1145,26" />

        <polygon points="50,320 75,320 95,294 70,294" />
        <polygon points="210,320 290,320 275,296 225,296" />
        <polygon points="840,320 920,320 905,296 855,296" />
        <polygon points="1125,320 1150,320 1130,294 1105,294" />
      </svg>
    );
  }

  if (type === "ucl-2026") {
    return (
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-20"
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        fill="#09090b"
      >
        {/* UCL: Star-pointed diamond chevrons */}
        <polygon points="0,0 90,0 55,28 0,28" />
        <polygon points="340,0 410,0 375,26" />
        <polygon points="590,0 650,0 620,30 560,30" />
        <polygon points="840,0 910,0 875,26" />
        <polygon points="1110,0 1200,0 1200,28 1145,28" />

        <polygon points="0,320 90,320 55,292 0,292" />
        <polygon points="440,320 510,320 475,294" />
        <polygon points="740,320 810,320 775,294" />
        <polygon points="1110,320 1200,320 1200,292 1145,292" />
      </svg>
    );
  }

  if (type === "pl-2026") {
    return (
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-20"
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        fill="#09090b"
      >
        {/* Premier League: Sharp 45° speed slashes */}
        <polygon points="80,0 140,0 100,28 40,28" />
        <polygon points="260,0 320,0 280,28 220,28" />
        <polygon points="680,0 740,0 700,28 640,28" />
        <polygon points="980,0 1040,0 1000,28 940,28" />

        <polygon points="140,320 200,320 240,292 180,292" />
        <polygon points="440,320 500,320 540,292 480,292" />
        <polygon points="780,320 840,320 880,292 820,292" />
        <polygon points="1060,320 1120,320 1160,292 1100,292" />
      </svg>
    );
  }

  if (type === "laliga-2026") {
    return (
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-20"
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        fill="#09090b"
      >
        {/* La Liga: Dynamic Spanish sawtooth triangular cutouts */}
        <polygon points="0,0 60,0 0,32" />
        <polygon points="180,0 230,0 205,28" />
        <polygon points="380,0 460,0 420,32" />
        <polygon points="760,0 840,0 800,32" />
        <polygon points="1020,0 1070,0 1045,28" />
        <polygon points="1140,0 1200,0 1200,32" />

        <polygon points="0,320 60,320 0,288" />
        <polygon points="260,320 340,320 300,288" />
        <polygon points="600,320 680,320 640,288" />
        <polygon points="920,320 1000,320 960,288" />
        <polygon points="1140,320 1200,320 1200,288" />
      </svg>
    );
  }

  // Live TV HD: Digital cyber micro-notches
  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full z-20"
      viewBox="0 0 1200 320"
      preserveAspectRatio="none"
      fill="#09090b"
    >
      <polygon points="0,0 40,0 0,22" />
      <rect x="150" y="0" width="80" height="18" />
      <rect x="420" y="0" width="100" height="20" />
      <rect x="750" y="0" width="90" height="18" />
      <rect x="1000" y="0" width="60" height="16" />
      <polygon points="1160,0 1200,0 1200,22" />

      <polygon points="0,320 40,320 0,298" />
      <rect x="250" y="302" width="90" height="18" />
      <rect x="580" y="300" width="120" height="20" />
      <rect x="880" y="302" width="80" height="18" />
      <polygon points="1160,320 1200,320 1200,298" />
    </svg>
  );
}

function HeroBannerCarousel() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full overflow-hidden mb-10 select-none min-h-[220px] sm:min-h-[270px] md:min-h-[300px]"
    >
      {/* ── GPU-Accelerated Stacked Slides (0% JS Main-Thread Blockage) ── */}
      {HERO_SLIDES.map((slide, idx) => {
        const isActive = currentIdx === idx;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full ${slide.bgClass} flex flex-col justify-between p-6 sm:p-9 md:p-12 overflow-hidden transition-all duration-700 ease-out will-change-[opacity,transform] ${
              isActive
                ? "opacity-100 scale-100 z-10 pointer-events-auto"
                : "opacity-0 scale-[0.98] z-0 pointer-events-none"
            }`}
          >
            {/* Custom geometric shape per slide, seamlessly cut from page #09090b */}
            <SlideNotches type={slide.id} />

            {/* Content Layout */}
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 my-auto">
              {/* Left / Center: Logo & Main Big Title */}
              <div className="flex items-center gap-5 sm:gap-8 max-w-4xl">
                {/* Left Trophy Icon/Emblem replica */}
                <div className="shrink-0 flex flex-col items-center justify-center">
                  {slide.id === "can-2027" && (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full border-4 border-black flex items-center justify-center p-2 bg-white/20 shadow-inner">
                        <Trophy weight="fill" className="w-10 h-10 sm:w-14 sm:h-14 text-black" />
                      </div>
                      <div className="hidden sm:flex flex-col text-left font-black tracking-tight leading-tight text-black uppercase text-[10px] sm:text-xs">
                        <span className="text-sm sm:text-base font-black tracking-tighter">CAF · TotalEnergies</span>
                        <span>AFRICA CUP</span>
                        <span>OF NATIONS</span>
                        <span className="text-[10px] font-extrabold opacity-80">KE - TZ - UG 27</span>
                        <span className="text-black font-black">QUALIFIERS</span>
                      </div>
                    </div>
                  )}
                  {slide.id === "ucl-2026" && (
                    <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full border-2 border-cyan-400/60 flex items-center justify-center p-2 bg-blue-900/40 shadow-lg shadow-cyan-500/20">
                      <Star weight="fill" className="w-10 h-10 sm:w-14 sm:h-14 text-cyan-300 animate-pulse" />
                    </div>
                  )}
                  {slide.id === "pl-2026" && (
                    <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full border-2 border-[#00FF87]/60 flex items-center justify-center p-2 bg-[#20002B]/80 shadow-lg shadow-[#00FF87]/20">
                      <Trophy weight="fill" className="w-10 h-10 sm:w-14 sm:h-14 text-[#00FF87]" />
                    </div>
                  )}
                  {slide.id === "laliga-2026" && (
                    <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full border-2 border-amber-400/60 flex items-center justify-center p-2 bg-red-950/80 shadow-lg shadow-amber-400/20">
                      <FilmStrip weight="fill" className="w-10 h-10 sm:w-14 sm:h-14 text-amber-400" />
                    </div>
                  )}
                  {slide.id === "live-tv-hd" && (
                    <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full border-2 border-cyan-400/60 flex items-center justify-center p-2 bg-black/60 shadow-lg shadow-cyan-400/30">
                      <Television weight="fill" className="w-10 h-10 sm:w-14 sm:h-14 text-cyan-400" />
                    </div>
                  )}
                </div>

                {/* Typography */}
                <div>
                  <div className="inline-block px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1 shadow-sm">
                    <span className={`px-2 py-0.5 rounded-full ${slide.badgeClass}`}>{slide.badge}</span>
                  </div>

                  <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black italic tracking-tight uppercase leading-none">
                    {slide.title}
                  </h1>

                  <p className="text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-wide opacity-90 mt-2">
                    {slide.subtitle}
                  </p>
                </div>
              </div>

              {/* Right Badge: Official CHILLERS broadcast badge */}
              <div className="hidden md:flex flex-col items-end shrink-0">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-90 mb-1">
                  {slide.channelSub}
                </span>
                <div className="bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-white/20 font-black text-xs sm:text-sm tracking-wider uppercase shadow-2xl flex items-center gap-2">
                  <div className="flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/favicon-32x32.png"
                      alt="C"
                      className="h-4 sm:h-5 w-auto object-contain drop-shadow-[0_0_8px_rgba(215,4,102,0.6)]"
                    />
                    <span className="font-black tracking-tight text-white flex items-center -ml-1 text-xs sm:text-sm">
                      HILL<span className="text-brand-primary">ERS</span>
                    </span>
                  </div>
                  <span className="bg-[#00D66C] text-black px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded-sm">
                    {slide.channelBadge}
                  </span>
                </div>
              </div>
            </div>

            {/* Carousel Controls & Indicators */}
            <div className="relative z-10 flex items-center justify-between mt-4 pt-2 border-t border-black/10">
              {/* Slide indicator dots */}
              <div className="flex items-center gap-2">
                {HERO_SLIDES.map((s, dotIdx) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentIdx(dotIdx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentIdx === dotIdx ? "w-8 bg-black/90 shadow-md" : "w-2 bg-black/30 hover:bg-black/50"
                    }`}
                    aria-label={`Slide ${dotIdx + 1}`}
                  />
                ))}
              </div>

              {/* Arrows */}
              <div className="flex items-center gap-2">
                <button
                  onClick={prevSlide}
                  className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-current transition-colors active:scale-95"
                  aria-label="Previous slide"
                >
                  <CaretLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={nextSlide}
                  className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-current transition-colors active:scale-95"
                  aria-label="Next slide"
                >
                  <CaretRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LivePageContent() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"mosaic" | "cards">("mosaic");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isMultiLiveOpen, setIsMultiLiveOpen] = useState(false);
  const [selectedMultiSlugs, setSelectedMultiSlugs] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [playingChannel, setPlayingChannel] = useState<LiveChannel | null>(null);

  const isTvTab = activeCategory === "tvfr";

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

  useEffect(() => {
    // localStorage n'existe pas côté serveur : lecture différée après hydration.
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem("chillers_live_favorites");
        if (saved) setFavorites(JSON.parse(saved));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
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

  // Reset pagination on category/search change (« ajuster pendant le rendu »).
  const [prevFilterKey, setPrevFilterKey] = useState(
    `${activeCategory}|${search}`,
  );
  const filterKey = `${activeCategory}|${search}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  const filteredChannels = useMemo(() => {
    let list = baseChannels;

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
  }, [baseChannels, activeCategory, search, favorites]);

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
    <div className="min-h-screen bg-[#1F1F1F] text-white pt-20 sm:pt-24 pb-28 px-3 sm:px-6 md:px-10 lg:px-[5%] select-none">
      {/* ── 1. Hero Promo Banners (Replica of CAN 2027 & Sports broadcasts) ── */}
      {!search && activeCategory === "all" && <HeroBannerCarousel />}

      {/* ── 2. Football Matches Row (Live Scores) ─────────────────────────── */}
      <div className="mb-10">
        <SportsMatchesRow />
      </div>

      {/* ── 3. Controls & Filter Bar ───────────────────────────────────────── */}
      <div className="sticky top-16 sm:top-20 z-30 bg-[#1F1F1F]/95 backdrop-blur-xl py-3 -mx-3 px-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 lg:-mx-[5%] lg:px-[5%] border-b border-white/10 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-[5px] text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                    isActive
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/30 scale-100"
                      : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search Input, View Mode & Multi-Live Button */}
          {isTvTab ? (
            <Link
              href="/live/tv"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-[5px] bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap w-fit"
              title="Version complète TV Française"
            >
              <Television className="w-4 h-4 text-red-500" />
              <span className="hidden sm:inline">Page TV dédiée</span>
              <span className="sm:hidden">TV</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
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
          )}
        </div>
      </div>

      {/* ── 4. Onglet TV Française (grille partagée avec /live/tv) ───────── */}
      {isTvTab ? (
        <TvChannelsSection />
      ) : (
        <>
          {/* ── Grille Live (Mosaïque Logos ou Affiches) ─────────────────── */}
          {viewMode === "mosaic" ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-5">
              {paginatedChannels.map((channel) => (
                <MosaicChannelCard
                  key={channel.slug}
                  channel={channel}
                  isFavorite={favorites.includes(channel.slug)}
                  onToggleFavorite={toggleFavorite}
                  onOpen={openChannel}
                  isResolving={resolvingSlug === channel.slug}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {paginatedChannels.map((channel) => (
                <ChannelPosterCard
                  key={channel.slug}
                  channel={channel}
                  isFavorite={favorites.includes(channel.slug)}
                  onToggleFavorite={toggleFavorite}
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
              <h3 className="text-lg font-bold text-white">
                {activeCategory === "favorites"
                  ? "Aucune chaîne dans vos favoris"
                  : "Aucune chaîne trouvée"}
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {activeCategory === "favorites"
                  ? "Cliquez sur l'étoile sur une chaîne pour la retrouver rapidement ici."
                  : "Essayez avec d'autres mots-clés ou sélectionnez une autre catégorie ci-dessus."}
              </p>
            </div>
          )}
        </>
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
