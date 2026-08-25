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

  // Size tokens match Netflix/Prime-style row cards
  const sizeClass =
    variant === "grid"
      ? "w-full"
      : isPoster
        ? "flex-none w-[140px] sm:w-[160px] md:w-[190px] lg:w-[220px]"
        : "flex-none w-[240px] sm:w-[280px] md:w-[320px] lg:w-[360px]";

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
        hover:scale-[1.04] hover:-translate-y-1 hover:z-30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.8)]
        [&:hover_.movie-card-img]:scale-[1.05]`}
    >
      {/* Poster / backdrop — aspect ratio dynamic, 100% bright & crisp */}
      <div className={`relative ${isPoster ? "aspect-[2/3]" : "aspect-video"} w-full overflow-hidden rounded-lg bg-zinc-900 shadow-md`}>
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
                : isPoster
                  ? "(max-width: 640px) 140px, (max-width: 768px) 160px, 220px"
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

        {/* Bottom brand bag/badge (Prime Video style) */}
        <div className="absolute bottom-2 left-2 z-10">
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/90 text-[10px] shadow-sm">
            👑
          </span>
        </div>
      </div>

      {/* ── 1. PRIME VIDEO STYLE EXPANDED POPUP (For Poster Variant) ── */}
      {isPoster && (
        <div
          className="pointer-events-none absolute inset-0 z-40
            opacity-0 invisible transition-all duration-300 ease-out
            group-hover:opacity-100 group-hover:visible
            max-md:hidden"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] md:w-[380px] bg-zinc-950/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] space-y-3 pointer-events-auto">
            {/* Header with thumbnail & title */}
            <div className="flex gap-3">
              <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden shrink-0 border border-white/10">
                {hasImage && (
                  <Image
                    src={primarySrc}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                    {item.type === "series" ? "Série Chillers" : "Film Chillers"}
                  </span>
                  <h3 className="text-sm font-extrabold text-white leading-tight line-clamp-2 mt-0.5">
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-300 font-semibold mt-1">
                  {item.rating && (
                    <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                      ★ {item.rating}
                    </span>
                  )}
                  {item.year && <span>{item.year}</span>}
                  {item.duration && <span>{item.duration}</span>}
                </div>
              </div>
            </div>

            {/* Action buttons (Prime Video Style) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(item);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all shadow-md cursor-pointer"
              >
                <IconPlayerPlay className="h-3.5 w-3.5 fill-black" />
                <span>Regarder</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(item);
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-white/15 transition-all cursor-pointer"
              >
                <IconInfoCircle className="h-3.5 w-3.5" />
                <span>Plus d'infos</span>
              </button>
            </div>

            {/* Description & Genres */}
            {item.description && (
              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                {item.description}
              </p>
            )}

            {visibleGenres.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-zinc-400 pt-1 border-t border-white/5">
                {visibleGenres.map((g) => (
                  <span key={g} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. STANDARD LANDSCAPE HOVER PANEL (For 16:9 Scroll & Grid) ── */}
      {!isPoster && (
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
      )}
    </div>
  );
}

export default React.memo(MovieCard);
