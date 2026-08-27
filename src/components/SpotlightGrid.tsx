"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { IconPlayerPlay, IconInfoCircle } from "@tabler/icons-react";
import type { MovieOrShow } from "@/types/media";

interface SpotlightGridProps {
  items: MovieOrShow[];
  onWatchNow: (movie: MovieOrShow) => void;
  onOpenDetails: (movie: MovieOrShow) => void;
}

function SpotlightCard({
  item,
  onWatchNow,
  onOpenDetails,
}: {
  item: MovieOrShow;
  onWatchNow: (m: MovieOrShow) => void;
  onOpenDetails: (m: MovieOrShow) => void;
}) {
  const bg = item.backdropOriginalUrl || item.backdropUrl;

  return (
    <div className="relative group overflow-hidden sm:rounded-2xl border border-white/10 w-full">
      <div className="relative w-full h-full min-h-[160px] sm:min-h-[420px]">
        {bg ? (
          <Image
            src={bg}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent opacity-80" />

        <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-5 z-10">
          <h3 className="text-sm sm:text-lg font-extrabold text-white drop-shadow-lg leading-tight mb-1 line-clamp-1">
            {item.title}
          </h3>
          <p className="hidden sm:block text-xs sm:text-sm text-zinc-300 line-clamp-2 mb-2 sm:mb-3 max-w-sm">
            {item.synopsis || item.description}
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onWatchNow(item)}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-black hover:bg-zinc-200 active:scale-95 transition-all"
            >
              <IconPlayerPlay className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="currentColor" />
              Play Now
            </button>
            <button
              onClick={() => onOpenDetails(item)}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-white backdrop-blur-sm hover:bg-white/20 active:scale-95 transition-all"
            >
              <IconInfoCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Details
            </button>
          </div>
        </div>

        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20">
          <button
            aria-label="Ajouter aux favoris"
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SpotlightGrid({ items, onWatchNow, onOpenDetails }: SpotlightGridProps) {
  const fourCards = useMemo(() => {
    if (!items || items.length < 5) return [];
    const copy = [...items];
    copy.sort((a, b) => b.rating - a.rating);
    return copy.slice(1, 5);
  }, [items]);

  if (fourCards.length < 4) return null;

  return (
    <div className="w-full px-2 lg:px-3">
      {/* Mobile: 1 column stacked, Tablet/Desktop: 2x2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {fourCards.map((item) => (
          <SpotlightCard
            key={item.id}
            item={item}
            onWatchNow={onWatchNow}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </div>
  );
}
