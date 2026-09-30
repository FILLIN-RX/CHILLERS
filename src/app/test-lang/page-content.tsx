"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MagnifyingGlass,
  Translate,
  Play,
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  CircleNotch,
  Lightning,
  FilmStrip,
  Television,
  X,
  Clock,
  Sparkle,
  DownloadSimple,
} from "@phosphor-icons/react";
import { searchMedia } from "@/services/media";
import type { MovieOrShow } from "@/types/media";

interface MediaItem {
  id: number;
  title: string;
  originalTitle: string;
  year: number;
  type: "movie" | "tv";
  poster: string;
}

const PRESET_MEDIA: MediaItem[] = [
  {
    id: 558449,
    title: "Gladiator II",
    originalTitle: "Gladiator II",
    year: 2024,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg",
  },
  {
    id: 27205,
    title: "Inception",
    originalTitle: "Inception",
    year: 2010,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
  },
  {
    id: 533535,
    title: "Deadpool & Wolverine",
    originalTitle: "Deadpool & Wolverine",
    year: 2024,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
  },
  {
    id: 157336,
    title: "Interstellar",
    originalTitle: "Interstellar",
    year: 2014,
    type: "movie",
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  },
  {
    id: 85937,
    title: "Demon Slayer: Kimetsu no Yaiba",
    originalTitle: "鬼滅の刃",
    year: 2019,
    type: "tv",
    poster: "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
  },
];

type Language = "fr" | "vostfr";

const LANGUAGES: { id: Language; label: string; flag: string; desc: string }[] = [
  { id: "fr", label: "Français (VF)", flag: "🇫🇷", desc: "Doublage audio en Français" },
  { id: "vostfr", label: "Version Originale (VO / VOSTFR)", flag: "🌐", desc: "Audio original avec sous-titres FR" },
];

/** Détecte si l'URL est un flux vidéo direct (.mp4, .m3u8, ou flux proxy vidéo) */
function isDirectVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".m3u8") ||
    clean.endsWith(".webm") ||
    url.includes("/api/doodstream/stream") ||
    url.includes("/api/download/stream") ||
    url.includes("/api/omnisave/proxy")
  );
}

/** Nettoie l'URL pour s'assurer qu'elle joue en streaming inline sans forcer le téléchargement */
function cleanStreamPlaybackUrl(url?: string | null): string {
  if (!url) return "";
  let clean = url.replace(/([?&])download=1(&|$)/, "$1").replace(/[?&]$/, "");
  if (clean.startsWith("/")) {
    clean = `http://localhost:4000${clean}`;
  }
  return clean;
}

export default function TestLangContent() {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem>(PRESET_MEDIA[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MovieOrShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [selectedLang, setSelectedLang] = useState<Language>("fr");

  const [loading, setLoading] = useState(false);
  const [streamData, setStreamData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Recherche live TMDB avec debounce ──
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchMedia(searchQuery.trim());
        setSearchResults(results.slice(0, 8));
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSearchResult = (item: MovieOrShow) => {
    const media: MediaItem = {
      id: Number(item.id),
      title: item.title,
      originalTitle: (item as any).originalTitle || item.title,
      year: item.year || (item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2024),
      type: item.type === "series" ? "tv" : "movie",
      poster: item.posterUrl || (item as any).poster || "",
    };
    setSelectedMedia(media);
    setShowDropdown(false);
    setSearchQuery("");
  };

  const resolveStream = async (media: MediaItem, lang: Language) => {
    setLoading(true);
    setError(null);
    setStreamData(null);
    const start = Date.now();

    try {
      const isTv = media.type === "tv";
      const endpoint = isTv
        ? `http://localhost:4000/api/stream/tv/${media.id}/${season}/${episode}?title=${encodeURIComponent(
            media.title
          )}&original_title=${encodeURIComponent(media.originalTitle)}&year=${media.year}&lang=${lang}`
        : `http://localhost:4000/api/stream/movie/${media.id}?title=${encodeURIComponent(
            media.title
          )}&original_title=${encodeURIComponent(media.originalTitle)}&year=${media.year}&lang=${lang}`;

      const res = await fetch(endpoint);
      const data = await res.json();
      setLatencyMs(Date.now() - start);

      if (data.success && (data.data?.embedUrl || data.data?.directUrl)) {
        setStreamData(data);
      } else {
        setError(data.message || "Aucun flux trouvé pour cette langue.");
      }
    } catch (err: any) {
      setLatencyMs(Date.now() - start);
      setError(err?.message || "Erreur réseau lors de la résolution du flux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resolveStream(selectedMedia, selectedLang);
  }, [selectedMedia, selectedLang, season, episode]);

  const rawUrl = streamData?.data?.directUrl || streamData?.data?.embedUrl;
  const playbackUrl = cleanStreamPlaybackUrl(rawUrl);
  const isVideoDirect = isDirectVideoUrl(playbackUrl);

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 sm:p-8 lg:p-12 font-sans selection:bg-red-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Top Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="p-2.5 rounded-xl bg-red-600/15 text-red-500 border border-red-500/20 shadow-lg shadow-red-600/10">
                <Translate className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Laboratoire Multi-Langues
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-red-600 text-white">
                    VF / VO / VOSTFR
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">
                  Recherchez n&apos;importe quel film ou série et testez le changement de langue instantané
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Direct Streaming Inline
            </span>
          </div>
        </div>

        {/* ── Search Bar Interactive ── */}
        <div ref={searchContainerRef} className="relative z-40">
          <div className="relative flex items-center">
            <MagnifyingGlass className="absolute left-4 w-5 h-5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un film ou une série (ex: Avatar, Breaking Bad, Gladiator, Titanic...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-zinc-900/90 border border-white/15 text-sm font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all shadow-xl backdrop-blur-xl"
            />
            {isSearching ? (
              <CircleNotch className="absolute right-4 w-5 h-5 text-red-500 animate-spin" />
            ) : searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                className="absolute right-4 p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl divide-y divide-white/5 max-h-[380px] overflow-y-auto no-scrollbar">
              {searchResults.map((item) => (
                <button
                  key={`${item.id}-${item.type}`}
                  onClick={() => selectSearchResult(item)}
                  className="w-full p-3 flex items-center gap-3.5 hover:bg-white/10 transition-colors text-left cursor-pointer group"
                >
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-10 h-14 object-cover rounded-lg shrink-0 shadow-md group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-zinc-500">
                      {item.type === "series" ? "TV" : "FILM"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white group-hover:text-red-400 transition-colors truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                        {item.type === "series" ? "Série" : "Film"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {(item as any).originalTitle || item.title} • {item.releaseDate ? new Date(item.releaseDate).getFullYear() : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Main Layout: Sidebar & Player ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Selection / Suggestions */}
          <div className="space-y-6">
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5 backdrop-blur-md">
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Sparkle className="w-4 h-4 text-amber-400" />
                Films & Séries Recommandés
              </h2>
              <div className="space-y-2">
                {PRESET_MEDIA.map((m) => {
                  const isSelected = selectedMedia.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMedia(m)}
                      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? "bg-red-600 text-white shadow-lg shadow-red-600/30 scale-[1.01]"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {m.poster ? (
                        <img src={m.poster} alt={m.title} className="w-10 h-14 object-cover rounded-lg shrink-0 shadow" />
                      ) : (
                        <div className="w-10 h-14 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                          {m.type === "movie" ? "FILM" : "TV"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">{m.title}</p>
                        </div>
                        <p className={`text-[11px] truncate ${isSelected ? "text-red-100" : "text-zinc-500"}`}>
                          {m.originalTitle} • {m.year}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Episode Selector for Series */}
            {selectedMedia.type === "tv" && (
              <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3 backdrop-blur-md">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Television className="w-4 h-4 text-red-500" />
                  Sélection Saison / Épisode
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1">Saison</label>
                    <input
                      type="number"
                      min={1}
                      value={season}
                      onChange={(e) => setSeason(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-bold text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1">Épisode</label>
                    <input
                      type="number"
                      min={1}
                      value={episode}
                      onChange={(e) => setEpisode(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-bold text-white text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Language Selector + Inline Player + Live Diagnostics */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Language Switcher Buttons ── */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Translate className="w-4 h-4 text-red-500" />
                  Langue Audio du Flux :
                </span>
                {loading && (
                  <span className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    Chargement...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.map((lang) => {
                  const isSelected = selectedLang === lang.id;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => setSelectedLang(lang.id)}
                      className={`flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-red-600/20 border-red-500 text-white shadow-xl shadow-red-600/25 ring-2 ring-red-500/50 scale-[1.02]"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-2xl sm:text-3xl mb-1.5">{lang.flag}</span>
                      <span className="text-xs sm:text-sm font-black">{lang.label}</span>
                      <span className="text-[10px] text-zinc-400 text-center line-clamp-1 mt-0.5">{lang.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Integrated Video Player (Inline, NO download trigger) ── */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="aspect-video w-full bg-black relative flex items-center justify-center">
                {loading ? (
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <CircleNotch className="w-10 h-10 text-red-500 animate-spin" />
                    <p className="text-xs font-black tracking-wider uppercase">
                      Recherche du flux {selectedLang === "fr" ? "Français (VF)" : "Version Originale (VOSTFR)"}...
                    </p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center gap-3 text-zinc-400 p-6 text-center">
                    <WarningCircle className="w-12 h-12 text-amber-500" />
                    <p className="text-sm font-bold text-white">{error}</p>
                    <p className="text-xs text-zinc-500">
                      Essayez de basculer sur l&apos;autre version (Français VF ou Version Originale).
                    </p>
                  </div>
                ) : playbackUrl ? (
                  isVideoDirect ? (
                    // Lecteur HTML5 natif pour les flux MP4 / HLS directs
                    <video
                      key={playbackUrl}
                      src={playbackUrl}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    // Iframe sécurisée pour les players externes
                    <iframe
                      key={playbackUrl}
                      src={playbackUrl}
                      title="Player Test"
                      className="w-full h-full border-0"
                      allowFullScreen
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-500">
                    <Play className="w-8 h-8 opacity-50" />
                    <p className="text-xs font-medium">Sélectionnez une version pour lancer la lecture</p>
                  </div>
                )}
              </div>

              {/* ── Diagnostics & Info Footer with Download button ── */}
              <div className="p-4 sm:p-5 border-t border-white/10 space-y-3 bg-black/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs sm:text-sm font-black text-white truncate max-w-[280px]">
                      {selectedMedia.title}
                    </span>
                    <span className="text-xs font-bold text-red-400 uppercase">
                      [{selectedLang === "fr" ? "VF" : "VOSTFR"}]
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {latencyMs !== null && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {latencyMs}ms
                      </span>
                    )}

                    {rawUrl && (
                      <a
                        href={rawUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg shadow-md shadow-red-600/20 transition-all"
                      >
                        <DownloadSimple className="w-3.5 h-3.5" />
                        Télécharger ({selectedLang === "fr" ? "VF" : "VO"})
                      </a>
                    )}
                  </div>
                </div>

                {streamData && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">Source Provider</p>
                      <p className="font-black text-white capitalize mt-0.5">{streamData.provider || "Direct"}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">Mode de Lecture</p>
                      <p className="font-black text-emerald-400 mt-0.5">
                        {isVideoDirect ? "Flux Direct (MP4 1080p)" : "Lecteur Embarqué (Embed)"}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">Qualité Vidéo</p>
                      <p className="font-black text-white capitalize mt-0.5">
                        {streamData.data?.quality || "1080p Full HD"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
