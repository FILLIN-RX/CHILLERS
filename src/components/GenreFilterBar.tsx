"use client";

import React from "react";
import type { Genre } from "@/types/media";
import { CaretDown } from "@phosphor-icons/react";
import { useLanguage } from "@/i18n/LanguageContext";

interface GenreFilterBarProps {
  genres: Genre[];
  activeGenreId: string | null;
  onSelect: (genreId: string | null) => void;
  isLoading?: boolean;
  compact?: boolean;
}

// Popular genres shown first (by ID), the rest follow
const PRIORITY_GENRE_IDS = [28, 35, 27, 878, 10749, 18, 12, 80, 9648, 53, 14, 37];

export default function GenreFilterBar({
  genres,
  activeGenreId,
  onSelect,
  isLoading,
  compact = false,
}: GenreFilterBarProps) {
  const { lang } = useLanguage();
  const allLabel = lang === "en" ? "All categories" : "Toutes les catégories";

  // Sort: priority genres first, then the rest alphabetically
  const sorted = [...genres].sort((a, b) => {
    const ai = PRIORITY_GENRE_IDS.indexOf(a.id);
    const bi = PRIORITY_GENRE_IDS.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  if (isLoading || genres.length === 0) {
    return (
      <div
        className={`${
          compact ? "h-7 w-32 rounded-lg" : "h-9 sm:h-10 w-44 sm:w-52 rounded-xl"
        } bg-zinc-800/70 skeleton-loading`}
      />
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={activeGenreId || ""}
        onChange={(e) => onSelect(e.target.value ? e.target.value : null)}
        aria-label="Sélectionner une catégorie"
        className={`appearance-none bg-zinc-900/95 hover:bg-zinc-800 text-white font-semibold cursor-pointer transition-all border border-zinc-700/80 hover:border-zinc-500 focus:outline-none focus:border-brand-primary shadow-md tracking-tight ${
          compact
            ? "text-xs py-1 pl-2.5 pr-7 rounded-lg min-w-[135px]"
            : "text-xs sm:text-sm py-1.5 sm:py-2 pl-3 pr-8 rounded-xl min-w-[160px] sm:min-w-[200px]"
        }`}
      >
        <option value="" className="bg-zinc-900 text-white font-medium">
          {allLabel}
        </option>
        {sorted.map((genre) => (
          <option
            key={genre.id}
            value={String(genre.id)}
            className="bg-zinc-900 text-white font-medium"
          >
            {genre.name}
          </option>
        ))}
      </select>
      <CaretDown
        className={`absolute pointer-events-none text-zinc-400 ${
          compact ? "right-2 top-1/2 -translate-y-1/2 h-3 w-3" : "right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
        }`}
        weight="bold"
      />
    </div>
  );
}
