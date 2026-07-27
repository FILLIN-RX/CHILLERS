"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MovieOrShow } from "@/app/mockData";
import { IconPlayerPlay, IconStar, IconInfoCircle, IconMovie } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";

interface MovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
  variant?: "scroll" | "grid";
}

function MovieCard({
  item,
  onPlay,
  onOpenDetails,
  variant = "scroll",
}: MovieCardProps) {
  const { translate: _ } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);

  const primarySrc = !backdropFailed && item.backdropUrl ? item.backdropUrl : item.posterUrl;
  const hasImage = !!primarySrc && !imgError;

  // Size tokens match Netflix-style row cards (~300px on lg+).
  const sizeClass =
    variant === "grid"
      ? "w-full"
      : "flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px]";

  // Genres are limited to the first 3 to keep the panel compact.
  const visibleGenres = (item.genres ?? []).slice(0, 3);

  const gradients = [
    "from-red-900/50 via-zinc-900 to-zinc-900",
    "from-purple-900/50 via-zinc-900 to-zinc-900",
    "from-emerald-900/50 via-zinc-900 to-zinc-900",
    "from-amber-900/50 via-zinc-900 to-zinc-900",
    "from-blue-900/50 via-zinc-900 to-zinc-900",
    "from-pink-900/50 via-zinc-900 to-zinc-900",
    "from-cyan-900/50 via-zinc-900 to-zinc-900",
    "from-orange-900/50 via-zinc-900 to-zinc-900",
    "from-teal-900/50 via-zinc-900 to-zinc-900",
    "from-violet-900/50 via-zinc-900 to-zinc-900",
    "from-rose-900/50 via-zinc-900 to-zinc-900",
    "from-lime-900/50 via-zinc-900 to-zinc-900",
  ];
  const gradientIndex = item.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % gradients.length;

  return (
    <div
      data-testid="movie-card"
      onClick={() => onOpenDetails(item)}
      className={`group relative ${sizeClass} cursor-pointer transition-all duration-300 ease-out
        hover:scale-[1.05] hover:-translate-y-1 hover:z-20 hover:shadow-[0_6px_22px_rgba(0,0,0,0.55)]
        [&:hover_.movie-card-img]:scale-[1.07]`}
    >
      {/* Poster / backdrop — 16:9 landscape, no border, rounded-md */}
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-900">
        {hasImage ? (
          <Image
            src={primarySrc}
            alt={item.title}
            fill
            className="movie-card-img object-cover transition-transform duration-500 ease-out"
            onError={() => {
              // If the backdrop 404s, try the poster; if that fails too, fall back to the placeholder.
              if (!backdropFailed && item.posterUrl) {
                setBackdropFailed(true);
              } else {
                setImgError(true);
              }
            }}
            sizes={
              variant === "grid"
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                : "(max-width: 640px) 250px, (max-width: 768px) 300px, (max-width: 1024px) 360px, 420px"
            }
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
            <IconMovie className="h-8 w-8 text-white/20" />
            <span className="line-clamp-3 text-xs font-semibold text-white/30">{item.title}</span>
          </div>
        )}

        {/* Top-left rating badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold border border-white/10 backdrop-blur-sm">
          <IconStar className="h-3 w-3 text-amber-400" />
          <span className="text-amber-400">{item.rating}</span>
        </div>

        {/* Top-right type badge */}
        <div className="absolute top-2 right-2 z-20">
          <span className="rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold border border-white/10 uppercase tracking-widest text-zinc-300 backdrop-blur-sm">
            {item.type}
          </span>
        </div>

        {/* Title overlay — always visible at bottom, identifies the movie on mobile */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-2 px-2.5">
          <h3 className="text-xs sm:text-sm font-bold text-white leading-tight line-clamp-1 drop-shadow-md">
            {item.title}
          </h3>
        </div>
      </div>

      {/* Info overlay — appears on top of the card image on hover (desktop only, like Netflix) */}
      <div
        className="movie-card-panel pointer-events-none absolute bottom-0 left-0 right-0 z-30
          opacity-0 invisible translate-y-2 transition-all duration-300 ease-out
          group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
          max-md:hidden"
      >
        <div className="bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-8 pb-2.5 px-2.5 space-y-1.5">
          {/* Action buttons row */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(item);
              }}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-white/80 transition-colors shadow-lg cursor-pointer"
              aria-label={_("media.watch")}
            >
              <IconPlayerPlay className="h-4 w-4 translate-x-[1px]" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(item);
              }}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white hover:border-white hover:bg-black/60 transition-colors cursor-pointer"
              aria-label={_("media.details")}
            >
              <IconInfoCircle className="h-4 w-4" />
            </button>
          </div>

          {/* Title */}
          <h3
            className="text-sm font-bold text-white leading-tight line-clamp-1 drop-shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(item);
            }}
          >
            {item.title}
          </h3>

          {/* Meta line: year • rating • duration/seasons */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-300 font-medium drop-shadow-md">
            <span>{item.year}</span>
            <span className="border border-zinc-500 px-1 rounded text-[9px] font-semibold text-zinc-200">
              {item.rating}
            </span>
            {item.duration && (
              <>
                <span>•</span>
                <span>{item.duration}</span>
              </>
            )}
          </div>

          {/* Genres as small chips */}
          {visibleGenres.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-zinc-300 drop-shadow-md">
              {visibleGenres.map((g, i) => (
                <React.Fragment key={g}>
                  {i > 0 && <span className="text-zinc-500">•</span>}
                  <span>{g}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(MovieCard);
