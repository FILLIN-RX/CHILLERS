"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { Play, Info, Star } from "@phosphor-icons/react";
import type { MovieOrShow } from "@/types/media";
import Button from "@/components/Button";

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
  const backdrop = item.backdropUrl || item.backdropOriginalUrl;

  return (
    <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-white/5 bg-zinc-950/80 hover:border-white/15 transition-all duration-300 w-full flex flex-row items-stretch p-3 sm:p-4 gap-3 sm:gap-4 shadow-xl">
      {/* Subtle backdrop ambient glow in card background */}
      {backdrop && (
        <div className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity duration-500 overflow-hidden">
          <Image
            src={backdrop}
            alt=""
            fill
            aria-hidden="true"
            className="object-cover blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-zinc-950/80" />
        </div>
      )}

      {/* Left: Vertical Poster (2:3 aspect ratio) */}
      <div
        onClick={() => onOpenDetails(item)}
        className="relative flex-none w-24 xs:w-28 sm:w-32 md:w-36 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 shrink-0 cursor-pointer shadow-md group-hover:scale-[1.02] transition-transform duration-300 z-10"
      >
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 110px, (max-width: 1024px) 140px, 160px"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-zinc-800 flex items-center justify-center p-2 text-center text-xs text-zinc-500 font-bold">
            {item.title}
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-primary/90 text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play weight="fill" className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      </div>

      {/* Right: Details & Actions */}
      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5 z-10">
        <div>
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
            {item.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                <Star weight="fill" className="w-3 h-3 text-amber-400" />
                <span>{item.rating.toFixed(1)}</span>
              </span>
            )}
            {item.year > 0 && (
              <span className="text-[10px] sm:text-xs text-zinc-400 font-semibold">
                {item.year}
              </span>
            )}
            {item.genres && item.genres.length > 0 && (
              <span className="hidden xs:inline-flex text-[10px] sm:text-xs text-zinc-500 font-medium truncate max-w-[120px]">
                • {item.genres[0]}
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            onClick={() => onOpenDetails(item)}
            className="text-sm xs:text-base sm:text-lg font-black text-white leading-tight mb-1 sm:mb-1.5 line-clamp-1 group-hover:text-brand-primary transition-colors cursor-pointer"
          >
            {item.title}
          </h3>

          {/* Synopsis */}
          <p className="text-[11px] sm:text-xs md:text-sm text-zinc-400 line-clamp-2 sm:line-clamp-3 leading-relaxed">
            {item.synopsis || item.description || "Découvrez ce titre incontournable disponible en streaming."}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => onWatchNow(item)}
            variant="primary"
            size="xs"
            leftIcon={<Play className="h-3 w-3 fill-current" />}
            ariaLabel={`Regarder ${item.title}`}
            className="text-[11px] sm:text-xs font-bold"
          >
            Regarder
          </Button>
          <Button
            onClick={() => onOpenDetails(item)}
            variant="outline"
            size="xs"
            leftIcon={<Info className="h-3 w-3" />}
            ariaLabel={`Détails de ${item.title}`}
            className="text-[11px] sm:text-xs bg-white/5 hover:bg-white/10 border-white/10"
          >
            Détails
          </Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
