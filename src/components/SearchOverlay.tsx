"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MovieOrShow } from "@/types/media";
import { useTrendingMovies } from "@/hooks/useTrendingMovies";
import { useMovieGenres } from "@/hooks/useMovieGenres";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { X, MagnifyingGlass, ArrowLeft, FilmSlate, Flame, SquaresFour } from "@phosphor-icons/react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import MovieCard from "./MovieCard";
import CardImage from "./CardImage";
import UserAvatar from "./UserAvatar";

const SESSION_KEY = "chillers_search_query";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);

  const [initialized, setInitialized] = useState(false);
  const search = useSearchSuggestions("");
  const trendingQuery = useTrendingMovies();
  const genresQuery = useMovieGenres();

  // Restore query from sessionStorage on first open
  useEffect(() => {
    if (!isOpen || initialized) return;
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) search.setQuery(saved);
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Persist query to sessionStorage
  useEffect(() => {
    if (!isOpen) return;
    if (search.query.trim()) sessionStorage.setItem(SESSION_KEY, search.query);
    else sessionStorage.removeItem(SESSION_KEY);
  }, [search.query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    // Focus the input immediately when the overlay opens
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => {
      releaseModalScrollLock();
      window.removeEventListener("keydown", handleKey);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  const goToDetail = (item: MovieOrShow) => {
    onClose();
    if (item.type === "series" || item.type === "anime") {
      router.push(`/tv/${item.id}`);
    } else {
      router.push(`/media/${item.id}`);
    }
  };

  const dedup = (items: MovieOrShow[]) => {
    const seen = new Set<string>();
    return items.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  };

  const trendingMovies = useMemo(() => dedup(trendingQuery.data ?? []), [trendingQuery.data]);
  const genres = genresQuery.data ?? [];
  const results = useMemo(() => dedup(search.results), [search.results]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#09090b] text-white animate-fade-in select-none h-dvh overflow-hidden">
      {/* ── Search Header Bar ───────────────────────────────── */}
      <div className="h-14 sm:h-16 px-2.5 sm:px-6 lg:px-8 border-b border-white/10 bg-[#0c0c0e]/95 backdrop-blur-2xl flex items-center justify-between gap-2 sm:gap-6 shrink-0 z-10 shadow-lg">
        {/* Left: Mobile Back Button & Desktop Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            aria-label="Fermer la recherche"
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <Link href="/" onClick={onClose} className="hidden sm:flex items-center focus:outline-none shrink-0 group">
            <Image
              src="/favicon-32x32.png"
              alt="CHILLERS"
              width={28}
              height={28}
              sizes="28px"
              className="h-6 sm:h-7 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
            <span className="text-base sm:text-lg font-black tracking-tight text-white items-center font-sans -ml-1.5">
              HILL<span className="text-white">ERS</span>
            </span>
          </Link>
        </div>

        {/* Center: Search Input Bar (Spans full width on mobile) */}
        <div className="flex-1 max-w-3xl flex items-center min-w-0">
          <div
            onClick={() => inputRef.current?.focus()}
            className="relative w-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/15 focus-within:border-white/70 focus-within:bg-zinc-800 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2.5 transition-all cursor-text"
          >
            <MagnifyingGlass className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400 shrink-0" />
            
            <input
              ref={inputRef}
              type="text"
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              placeholder="Rechercher un film, une série..."
              style={{ outline: "none", boxShadow: "none" }}
              className="no-focus-outline w-full bg-transparent border-0 text-xs sm:text-sm md:text-base font-medium text-white placeholder-zinc-500 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 !outline-none p-0"
              autoFocus
            />

            {/* Clear Query Button (X inside search bar) */}
            {search.query && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  search.setQuery("");
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                aria-label="Effacer le texte"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: User Avatar / ESC Close Button (Desktop only, giving full width to input on mobile) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer font-medium"
            title="Fermer (Échap)"
          >
            <span className="text-[10px] text-zinc-400 font-mono">ESC</span>
            <X className="h-3.5 w-3.5" />
          </button>

          {user && (
            <div className="cursor-pointer" onClick={() => { onClose(); router.push("/profile"); }}>
              <UserAvatar user={user} size="sm" showBadge={false} />
            </div>
          )}
        </div>
      </div>

      {/* ── Content Body (Realtime Search Results / Trending / Genres) ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 pb-28 sm:pb-12 overscroll-contain">
        {search.query.trim() === "" ? (
          <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10">
            {/* 1. Tendances actuelles */}
            {trendingMovies.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-zinc-300" />
                  <span>Recherches Tendances</span>
                </h3>
                <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 no-scrollbar">
                  {trendingMovies.slice(0, 12).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => goToDetail(m)}
                      className="group flex-none w-32 sm:w-44 space-y-2 text-left cursor-pointer transition-transform hover:scale-[1.02] active:scale-98"
                    >
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-white/30 transition-all shadow-md">
                        <CardImage
                          src={m.backdropUrl || m.posterUrl}
                          alt={m.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 128px, 176px"
                          fallbackText={m.title}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
                        <div className="absolute bottom-0 inset-x-0 p-2">
                          <p className="text-[11px] sm:text-xs font-bold text-white truncate drop-shadow-md">
                            {m.title}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Catégories & Genres */}
            {genres.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <SquaresFour className="h-4 w-4 text-zinc-300" />
                  <span>Explorer par Genre</span>
                </h3>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                  {genres.slice(0, 12).map((g) => (
                    <button
                      key={g.id}
                      onClick={() => search.setQuery(g.name)}
                      className="p-2.5 sm:p-3.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-white/30 text-center font-bold text-xs sm:text-sm text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : search.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-24 gap-3">
            <div className="h-8 w-8 border-3 border-zinc-700 border-t-white rounded-full animate-spin" />
            <p className="text-xs text-zinc-400 font-medium">Recherche en cours…</p>
          </div>
        ) : results.length > 0 ? (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                <span className="text-white font-bold">{results.length}</span> résultats pour &quot;<span className="text-white font-semibold">{search.query}</span>&quot;
              </p>
            </div>
            {/* Responsive grid of poster cards with 2:3 aspect ratio */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
              {results.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  variant="grid-poster"
                  onPlay={(i) => {
                    const typeParam = i.type === "series" || i.type === "anime" ? "tv" : "movie";
                    onClose();
                    router.push(`/watch/${i.id}?type=${typeParam}`);
                  }}
                  onOpenDetails={(i) => goToDetail(i)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 sm:py-24 text-center space-y-3">
            <FilmSlate className="h-12 w-12 text-zinc-700" />
            <h3 className="text-base sm:text-lg font-bold text-white">Aucun résultat trouvé</h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Nous n&apos;avons trouvé aucun média correspondant à &quot;{search.query}&quot;. Essayez un autre mot-clé.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}