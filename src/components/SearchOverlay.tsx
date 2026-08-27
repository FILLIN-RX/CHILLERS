"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Autocomplete } from "@mantine/core";
import type { MovieOrShow } from "@/types/media";
import { useTrendingMovies } from "@/hooks/useTrendingMovies";
import { useMovieGenres } from "@/hooks/useMovieGenres";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { IconX, IconSearch, IconArrowLeft } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import MovieCard from "./MovieCard";

const SESSION_KEY = "chillers_search_query";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const { translate: _ } = useLanguage();
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
    const typeParam = item.type === "series" || item.type === "anime" ? "tv" : item.type;
    router.push(`/media/${item.id}?type=${typeParam}`, { scroll: false });
  };

  const dedup = (items: MovieOrShow[]) => {
    const seen = new Set<string>();
    return items.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  };

  const trendingMovies = useMemo(() => dedup(trendingQuery.data ?? []), [trendingQuery.data]);
  const genres = genresQuery.data ?? [];
  const results = useMemo(() => dedup(search.results), [search.results]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return results
      .filter((m) => {
        if (seen.has(m.title)) return false;
        seen.add(m.title);
        return true;
      })
      .slice(0, 6)
      .map((m) => ({ value: m.title, movie: m }));
  }, [results]);

  const suggestionNames = useMemo(() => suggestions.map((s) => s.value), [suggestions]);

  const handleAutocompleteSubmit = (title: string) => {
    const match = suggestions.find((s) => s.value === title)?.movie;
    if (match) goToDetail(match);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 sm:px-8 md:px-12 lg:px-[4%] py-4 border-b border-zinc-800">
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white transition-colors"
        >
          <IconArrowLeft className="h-6 w-6" />
        </button>

        <div className="flex-1 max-w-3xl">
          <Autocomplete
            ref={inputRef}
            value={search.query}
            onChange={search.setQuery}
            onOptionSubmit={handleAutocompleteSubmit}
            data={search.query.trim().length > 1 ? suggestionNames : []}
            placeholder={_("search.placeholder")}
            leftSection={<IconSearch className="h-5 w-5 text-zinc-500" />}
            rightSection={search.query ? (
              <button onClick={() => search.setQuery("")} className="text-zinc-500 hover:text-white">
                <IconX className="h-4 w-4" />
              </button>
            ) : undefined}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
              }
            }}
            classNames={{
              input: "bg-transparent border-0 text-lg sm:text-xl font-medium text-white placeholder-zinc-600 h-12 px-0 focus:outline-none focus:ring-0",
              dropdown: "bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl mt-2",
              option: "text-zinc-300 hover:text-white hover:bg-zinc-800 data-combobox-active:bg-zinc-800 data-combobox-active:text-white px-4 py-3 text-sm font-medium",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 lg:px-[4%] py-6">
        {search.query.trim() === "" ? (
          <div className="max-w-7xl mx-auto space-y-12">
            {/* Trending — posters row */}
            {trendingMovies.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <span className="h-3 w-1 rounded-full bg-brand-primary" />
                  {_("search.trendingSearches")}
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {trendingMovies.slice(0, 10).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => goToDetail(m)}
                      className="group flex-none w-36 sm:w-44 space-y-2 text-left"
                    >
                      <div className="relative aspect-video w-full min-h-[80px] rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-zinc-800 group-hover:ring-brand-primary/50 transition-all">
                        {m.backdropUrl ? (
                          <Image
                            src={m.backdropUrl}
                            alt={m.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 640px) 144px, 176px"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h2.25m-2.25 0a1.125 1.125 0 0 1-1.125-1.125M12 12h2.25m-2.25 0a1.125 0 0 0 1.125 1.125M12 13.125V12m0 0v-1.5" /></svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-0 inset-x-0 p-2">
                          <p className="text-xs font-bold text-white truncate drop-shadow-md">
                            {m.title}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Genres — visual cards */}
            {genres.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <span className="h-3 w-1 rounded-full bg-brand-secondary" />
                  {_("categories.title")}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {genres.slice(0, 12).map((g, i) => {
                    const gradients = [
                      "from-red-900/60 via-zinc-900 to-zinc-900",
                      "from-purple-900/60 via-zinc-900 to-zinc-900",
                      "from-emerald-900/60 via-zinc-900 to-zinc-900",
                      "from-amber-900/60 via-zinc-900 to-zinc-900",
                      "from-blue-900/60 via-zinc-900 to-zinc-900",
                      "from-pink-900/60 via-zinc-900 to-zinc-900",
                      "from-cyan-900/60 via-zinc-900 to-zinc-900",
                      "from-orange-900/60 via-zinc-900 to-zinc-900",
                      "from-teal-900/60 via-zinc-900 to-zinc-900",
                      "from-violet-900/60 via-zinc-900 to-zinc-900",
                      "from-rose-900/60 via-zinc-900 to-zinc-900",
                      "from-lime-900/60 via-zinc-900 to-zinc-900",
                    ];
                    return (
                      <button
                        key={g.id}
                        onClick={() => search.setQuery(g.name)}
                        className={`p-5 rounded-xl bg-gradient-to-br ${gradients[i % gradients.length]} border border-zinc-800 text-center font-bold text-sm text-zinc-300 hover:text-white hover:border-zinc-600 hover:scale-[1.03] transition-all`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : search.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <div className="max-w-full">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-zinc-500">
                <span className="text-white font-bold">{results.length}</span> {_("search.title")}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {results.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  variant="grid"
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
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <IconSearch className="h-12 w-12 text-zinc-700" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">{_("search.noResults")}</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}