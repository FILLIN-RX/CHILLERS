"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MovieOrShow } from "@/app/mockData";
import { searchMedia, getTrendingMovies, getMovieGenres, Genre } from "@/app/api";
import { XMarkIcon, MagnifyingGlassIcon, PlayIcon, StarIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function SearchOverlay({ isOpen, onClose, onOpenDetails }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MovieOrShow[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<MovieOrShow[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { translate: _ } = useLanguage();

  const goToDetail = (item: MovieOrShow) => {
    onClose();
    const typeParam = item.type === "series" || item.type === "anime" ? "tv" : item.type;
    router.push(`/media/${item.id}?type=${typeParam}`, { scroll: false });
  };

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
      getTrendingMovies().then(setTrendingMovies);
      getMovieGenres().then(setGenres);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim() === "") {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const apiResults = await searchMedia(query);
      setResults(apiResults);
      setIsSearching(false);
    }, 300);

    return () => { clearTimeout(timer); setIsSearching(false); };
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col glass-modal transition-all duration-300">
      
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-[4%] py-6 flex items-center justify-between border-b border-brand-border">
        
        <div className="flex-1 flex items-center gap-3">
          <MagnifyingGlassIcon className="h-6 w-6 text-brand-primary" />
          <input
            ref={inputRef}
            type="text"
            placeholder={_("search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-0 text-xl font-medium text-foreground placeholder-zinc-500 focus:outline-none focus:ring-0"
          />
        </div>

        <button
          onClick={onClose}
          aria-label={_("common.close")}
          className="p-2 rounded-full bg-brand-card text-brand-text-muted hover:text-foreground border border-brand-border hover:border-brand-primary/30 transition-all focus:outline-none"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-[4%] py-8">
        {query.trim() === "" ? (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-text-muted mb-4">
                {_("search.trendingSearches")}
              </h3>
              <div className="flex flex-wrap gap-3">
                {trendingMovies.slice(0, 12).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setQuery(m.title)}
                    className="px-4 py-2 rounded-full bg-brand-card border border-brand-border text-sm font-semibold text-foreground hover:text-brand-primary hover:border-brand-primary/30 transition-all duration-200"
                  >
                    {m.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-text-muted mb-4">
                {_("categories.title")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {genres.slice(0, 12).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setQuery(g.name)}
                    className="p-3 rounded-xl bg-brand-card border border-brand-border text-center font-bold text-sm text-brand-text-muted hover:text-foreground hover:border-brand-secondary/40 transition-colors"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin" />
          </div>
        ) : results.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-text-muted">
                {_("search.title")} ({results.length})
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => goToDetail(item)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group cursor-pointer space-y-2"
                >
                  <div
                    className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/40 transition-all duration-300"
                    style={{
                      transform: hoveredId === item.id ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: hoveredId === item.id ? '0 0 25px rgba(215, 4, 102, 0.35)' : 'none',
                    }}
                  >
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500"
                      style={{ transform: hoveredId === item.id ? 'scale(1.08)' : 'scale(1)' }}
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                    />

                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold border border-white/10 backdrop-blur-sm">
                      <StarIcon className="h-2.5 w-2.5 text-amber-400" />
                      <span className="text-amber-400">{item.rating}</span>
                    </div>

                    <div className="absolute top-2 right-2 z-10">
                      <span className="rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold border border-white/10 uppercase tracking-widest text-zinc-300 backdrop-blur-sm">
                        {item.type}
                      </span>
                    </div>

                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 ${
                        hoveredId === item.id ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-white shadow-xl">
                        <PlayIcon className="h-5 w-5 translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5 px-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-brand-text-muted font-semibold">
                      <span>{item.year}</span>
                      <span>•</span>
                      <div className="flex items-center gap-0.5 text-amber-400 font-bold">
                        <StarIcon className="h-2.5 w-2.5 fill-amber-400" />
                        <span>{item.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <MagnifyingGlassIcon className="h-12 w-12 text-brand-text-muted" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">{_("search.noResults")}</h3>
            </div>
            <button
              onClick={() => setQuery("")}
              className="mt-2 text-xs font-bold text-brand-primary uppercase tracking-wider hover:underline"
            >
              {_("common.close")}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
