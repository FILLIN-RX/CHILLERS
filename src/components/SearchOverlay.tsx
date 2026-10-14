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
  const trendingQuery = useTrendingMovies({ enabled: isOpen });
  const genresQuery = useMovieGenres({ enabled: isOpen });

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#1F1F1F] text-white animate-fade-in select-none h-dvh overflow-hidden">
      {/* ── Barre de recherche (verre Apple TV) ───────────────────── */}
      <div className="shrink-0 z-10 border-b border-white/10 bg-[#1F1F1F]/80 backdrop-blur-2xl">
        <div className="mx-auto max-w-8xl h-16 sm:h-20 px-4 sm:px-8 lg:px-16 xl:px-20 flex items-center gap-2.5 sm:gap-4">
          {/* Gauche : retour mobile / logo desktop */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              aria-label="Fermer la recherche"
              className="sm:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
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
                className="h-7 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                priority
              />
              <span className="text-lg font-black tracking-tight text-white font-sans -ml-1.5">
                HILL<span className="text-white">ERS</span>
              </span>
            </Link>
          </div>

          {/* Centre : champ de recherche en pastille de verre */}
          <div className="flex-none w-full max-w-2xl min-w-0">
            <div
              onClick={() => inputRef.current?.focus()}
              className="relative w-full bg-white/10 backdrop-blur-md border border-white/15 focus-within:border-white/40 focus-within:bg-white/15 rounded-2xl px-4 py-2.5 sm:py-3 flex items-center gap-3 transition-all cursor-text"
            >
              <MagnifyingGlass className="h-5 w-5 text-white/50 shrink-0" />

              <input
                ref={inputRef}
                type="text"
                value={search.query}
                onChange={(e) => search.setQuery(e.target.value)}
                placeholder="Rechercher un film, une série..."
                style={{ outline: "none", boxShadow: "none" }}
                className="no-focus-outline w-full bg-transparent border-0 text-sm md:text-base font-medium text-white placeholder-white/40 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 !outline-none p-0"
                autoFocus
              />

              {search.query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    search.setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                  aria-label="Effacer le texte"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Droite : avatar / ESC */}
          <div className="hidden sm:flex flex-1 items-center justify-end gap-2 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer font-medium"
              title="Fermer (Échap)"
            >
              <span className="text-[10px] text-white/40 font-mono">ESC</span>
              <X className="h-3.5 w-3.5" />
            </button>

            {user && (
              <div className="cursor-pointer" onClick={() => { router.push("/profile"); }}>
                <UserAvatar user={user} size="sm" showBadge={false} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Corps (Tendances / Genres / Résultats) ────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-16 xl:px-20 py-5 sm:py-8 pb-28 sm:pb-14 overscroll-contain">
        {search.query.trim() === "" ? (
          <div className="max-w-8xl mx-auto space-y-10 sm:space-y-12">
            {/* Suggestions : cartes de films qui remplissent l'espace */}
            {trendingMovies.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Flame className="h-5 w-5 text-brand-primary" />
                  <span>Suggestions</span>
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-4 sm:gap-5 lg:gap-6">
                  {trendingMovies.slice(0, 18).map((m) => (
                    <MovieCard
                      key={m.id}
                      item={m}
                      variant="grid-poster"
                      appleFrame
                      onPlay={(i) => {
                        const typeParam = i.type === "series" || i.type === "anime" ? "tv" : "movie";
                        router.push(`/watch/${i.id}?type=${typeParam}`);
                      }}
                      onOpenDetails={(i) => goToDetail(i)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. Genres */}
            {genres.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <SquaresFour className="h-5 w-5 text-white/70" />
                  <span>Explorer par genre</span>
                </h3>
                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {genres.slice(0, 18).map((g) => (
                    <button
                      key={g.id}
                      onClick={() => search.setQuery(g.name)}
                      className="rounded-full bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/20 hover:border-white/30 px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-medium text-white/90 hover:text-white transition-all cursor-pointer active:scale-95"
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : search.isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-8 w-8 border-3 border-white/15 border-t-white rounded-full animate-spin" />
            <p className="text-xs text-white/50 font-medium">Recherche en cours…</p>
          </div>
        ) : results.length > 0 ? (
          <div className="max-w-8xl mx-auto space-y-5">
            <p className="text-sm text-white/50 font-medium">
              <span className="text-white font-bold">{results.length}</span> résultats pour &quot;
              <span className="text-white font-semibold">{search.query}</span>&quot;
            </p>
            {/* Grille de cartes Apple (même habillage que l'accueil) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-4 sm:gap-5 lg:gap-6">
              {results.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  variant="grid-poster"
                  appleFrame
                  onPlay={(i) => {
                    const typeParam = i.type === "series" || i.type === "anime" ? "tv" : "movie";
                    router.push(`/watch/${i.id}?type=${typeParam}`);
                  }}
                  onOpenDetails={(i) => goToDetail(i)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <FilmSlate className="h-12 w-12 text-white/20" />
            <h3 className="text-base sm:text-lg font-bold text-white">Aucun résultat trouvé</h3>
            <p className="text-xs text-white/40 max-w-sm">
              Nous n&apos;avons trouvé aucun média correspondant à &quot;{search.query}&quot;. Essayez un autre mot-clé.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
