"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Genre } from "@/app/api";

interface GenreFilterBarProps {
  genres: Genre[];
  activeGenreId: string | null;
  onSelect: (genreId: string | null) => void;
  isLoading?: boolean;
}

// Popular genres shown first (by ID), the rest follow
const PRIORITY_GENRE_IDS = [28, 35, 27, 878, 10749, 18, 12, 80, 9648, 53, 14, 37];

export default function GenreFilterBar({
  genres,
  activeGenreId,
  onSelect,
  isLoading,
}: GenreFilterBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort: priority genres first, then the rest alphabetically
  const sorted = [...genres].sort((a, b) => {
    const ai = PRIORITY_GENRE_IDS.indexOf(a.id);
    const bi = PRIORITY_GENRE_IDS.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  // Scroll active pill into view when it changes
  const activeRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (node && scrollRef.current) {
        const container = scrollRef.current;
        const left = node.offsetLeft - container.clientWidth / 2 + node.clientWidth / 2;
        container.scrollTo({ left, behavior: "smooth" });
      }
    },
    [activeGenreId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (isLoading || genres.length === 0) {
    // Skeleton
    return (
      <div className="flex gap-2 overflow-hidden px-2 sm:px-0 py-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-none h-8 rounded-full bg-zinc-800 skeleton-loading"
            style={{ width: `${60 + (i % 3) * 20}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-0"
    >
      {/* "All" pill */}
      <button
        onClick={() => onSelect(null)}
        className={`flex-none px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition-all duration-200 focus:outline-none whitespace-nowrap cursor-pointer active:scale-95 ${
          activeGenreId === null
            ? "bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/30"
            : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
        }`}
      >
        Tous
      </button>

      {sorted.map((genre) => {
        const isActive = String(genre.id) === activeGenreId;
        return (
          <button
            key={genre.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSelect(String(genre.id))}
            className={`flex-none px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition-all duration-200 focus:outline-none whitespace-nowrap cursor-pointer active:scale-95 ${
              isActive
                ? "bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/30"
                : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
            }`}
          >
            {genre.name}
          </button>
        );
      })}
    </div>
  );
}
