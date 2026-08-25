"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { MovieOrShow } from "@/types/media";
import { IconPlayerPlay, IconStar, IconInfoCircle, IconMovie } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";

interface MovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
  variant?: "scroll" | "grid" | "poster";
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

  const isPoster = variant === "poster";
  const primarySrc = isPoster 
    ? (item.posterUrl || item.backdropUrl) 
    : (!backdropFailed && item.backdropUrl ? item.backdropUrl : item.posterUrl);
  const hasImage = !!primarySrc && !imgError;

  const sizeClass =
    variant === "grid"
      ? "w-full"
      : isPoster
        ? "flex-none w-[145px] sm:w-[170px] md:w-[195px] lg:w-[215px]"
        : "flex-none w-[240px] sm:w-[280px] md:w-[320px] lg:w-[360px]";

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

  // Specific class for poster cards (horizontal expansion on hover like Prime Video)
  if (isPoster) {
    return (
      <div
        data-testid="movie-card-poster"
        onClick={() => onOpenDetails(item)}
        className="group relative flex-none h-[220px] sm:h-[260px] md:h-[290px] lg:h-[320px] w-[145px] sm:w-[170px] md:w-[195px] lg:w-[215px] hover:w-[145px] sm:hover:w-[340px] md:hover:w-[390px] lg:hover:w-[440px] transition-all duration-300 ease-out cursor-pointer rounded-xl overflow-hidden bg-zinc-950 border border-white/10 hover:border-white/30 hover:shadow-[0_12px_36px_rgba(0,0,0,0.85)] hover:z-30"
      >
        <div className="relative w-full h-full flex flex-row overflow-hidden">
          
          {/* Left Expanded Info Pane (Visible on Hover on Desktop) */}
          <div className="hidden group-hover:flex flex-col justify-between w-[55%] p-3 sm:p-4 shrink-0 bg-zinc-950/95 z-20 transition-all duration-300 animate-fade-in">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                {item.type === "series" ? "Série Chillers" : "Film Chillers"}
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-[11px] text-zinc-300 line-clamp-2 sm:line-clamp-3 leading-relaxed mt-1">
                  {item.description}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {/* Action Buttons (Prime Video Style) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(item);
                  }}
                  className="flex-1 py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-white/15 transition-all text-center truncate cursor-pointer"
                >
                  Plus d'informations
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(item);
                  }}
                  aria-label={_("media.watch")}
                  className="h-8 w-8 rounded-lg bg-white text-black hover:bg-zinc-200 flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer"
                >
                  <IconPlayerPlay className="h-4 w-4 fill-black translate-x-[0.5px]" />
                </button>
              </div>

              {/* Metadata tags */}
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold flex-wrap">
                {item.rating && <span className="text-amber-400 font-bold">★ {item.rating}</span>}
                {item.year && <span>{item.year}</span>}
                {item.duration && <span>• {item.duration}</span>}
              </div>
            </div>
          </div>

          {/* Right/Main Poster Image */}
          <div className="relative h-full flex-1 min-w-[145px] sm:min-w-[170px] overflow-hidden bg-zinc-900">
            {hasImage ? (
              <Image
                src={primarySrc}
                alt={item.title}
                fill
                className="movie-card-img object-cover object-center transition-transform duration-500 ease-out"
                sizes="(max-width: 640px) 145px, (max-width: 768px) 170px, 220px"
              />
            ) : (
              <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
                <IconMovie className="h-8 w-8 text-white/40" />
                <span className="line-clamp-3 text-xs font-semibold text-white/70">{item.title}</span>
              </div>
            )}

            {/* Top-left rating badge */}
            {Boolean(item.rating) && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold border border-white/15 backdrop-blur-md">
                <IconStar className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-amber-400">{item.rating}</span>
              </div>
            )}

            {/* Top-right type badge */}
            <div className="absolute top-2 right-2 z-10">
              <span className="rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200 border border-white/15 backdrop-blur-md">
                {item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
              </span>
            </div>

            {/* Bottom brand bag/badge (Prime Video style) */}
            <div className="absolute bottom-2 left-2 z-10">
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/90 text-[10px] shadow-sm">
                👑
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Standard Landscape / Grid Cards
  return (
    <div
      data-testid="movie-card"
      onClick={() => onOpenDetails(item)}
      className={`group relative ${sizeClass} cursor-pointer transition-all duration-300 ease-out
        hover:scale-[1.04] hover:-translate-y-1 hover:z-30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.8)]
        [&:hover_.movie-card-img]:scale-[1.05]`}
    >
      {/* Landscape 16:9 box — 100% bright & crisp */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-900 shadow-md">
        {hasImage ? (
          <Image
            src={primarySrc}
            alt={item.title}
            fill
            className="movie-card-img object-cover object-center transition-transform duration-500 ease-out"
            onError={() => {
              if (!backdropFailed && item.posterUrl) {
                setBackdropFailed(true);
              } else {
                setImgError(true);
              }
            }}
            sizes={
              variant === "grid"
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                : "(max-width: 640px) 240px, (max-width: 768px) 280px, 360px"
            }
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
            <IconMovie className="h-8 w-8 text-white/40" />
            <span className="line-clamp-3 text-xs font-semibold text-white/70">{item.title}</span>
          </div>
        )}

        {/* Top-left rating badge */}
        {Boolean(item.rating) && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold border border-white/15 backdrop-blur-md">
            <IconStar className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-amber-400">{item.rating}</span>
          </div>
        )}

        {/* Top-right type badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className="rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200 border border-white/15 backdrop-blur-md">
            {item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
          </span>
        </div>

        {/* Bottom brand bag/badge */}
        <div className="absolute bottom-2 left-2 z-10">
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/90 text-[10px] shadow-sm">
            👑
          </span>
        </div>
      </div>

      {/* Info overlay on hover for 16:9 cards */}
      <div
        className="movie-card-panel pointer-events-none absolute bottom-0 left-0 right-0 z-30
          opacity-0 invisible translate-y-2 transition-all duration-300 ease-out
          group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
          max-md:hidden"
      >
        <div className="bg-zinc-950/90 backdrop-blur-md p-3 rounded-b-lg border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white leading-tight line-clamp-1">
              {item.title}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(item);
                }}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 transition-colors shadow-md cursor-pointer"
                aria-label={_("media.watch")}
              >
                <IconPlayerPlay className="h-3.5 w-3.5 fill-black translate-x-[0.5px]" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(item);
                }}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-white/20 transition-colors cursor-pointer"
                aria-label={_("media.details")}
              >
                <IconInfoCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
            {item.year && <span>{item.year}</span>}
            {item.rating && <span className="text-amber-400 font-bold">★ {item.rating}</span>}
            {item.duration && <span>• {item.duration}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MovieCard);
