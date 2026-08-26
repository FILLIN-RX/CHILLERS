"use client";

import React, { useState, useRef, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";
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

  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const isPoster = variant === "poster";
  const primarySrc = isPoster 
    ? (item.posterUrl || item.backdropUrl) 
    : (!backdropFailed && item.backdropUrl ? item.backdropUrl : item.posterUrl);
  const hasImage = !!primarySrc && !imgError;

  const sizeClass =
    variant === "grid"
      ? "w-full"
      : isPoster
        ? "flex-none w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px]"
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

  // GSAP Smooth Hover Animations
  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: -6,
        scale: isPoster ? 1.03 : 1.04,
        zIndex: 80,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (imgRef.current) {
      gsap.to(imgRef.current, {
        scale: 1.06,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, x: isPoster ? -10 : 0, y: isPoster ? 0 : 8 },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.35,
          ease: "power3.out",
          overwrite: "auto",
        }
      );
    }
    if (buttonsRef.current) {
      gsap.fromTo(
        buttonsRef.current.children,
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.04, duration: 0.25, ease: "back.out(1.5)", overwrite: "auto" }
      );
    }
  }, [isPoster]);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        zIndex: 1,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (imgRef.current) {
      gsap.to(imgRef.current, {
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        opacity: 0,
        x: isPoster ? -8 : 0,
        y: isPoster ? 0 : 6,
        duration: 0.25,
        ease: "power2.in",
        overwrite: "auto",
      });
    }
  }, [isPoster]);

  // Vertical Poster Cards (Large, opening smoothly to the RIGHT with Glassmorphism)
  if (isPoster) {
    return (
      <div
        ref={cardRef}
        data-testid="movie-card-poster"
        onClick={() => onOpenDetails(item)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative flex-none h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] hover:w-[165px] sm:hover:w-[390px] md:hover:w-[450px] lg:hover:w-[510px] transition-all duration-300 ease-out cursor-pointer rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_12px_36px_rgba(0,0,0,0.7)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.95)] hover:z-30"
      >
        <div className="relative w-full h-full flex flex-row overflow-hidden">
          
          {/* 1. Main Poster Image (Fixed on LEFT, anchored) */}
          <div className="relative h-full flex-none w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] overflow-hidden bg-zinc-900">
            <div ref={imgRef} className="relative w-full h-full">
              {hasImage ? (
                <Image
                  src={primarySrc}
                  alt={item.title}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 165px, (max-width: 768px) 195px, 255px"
                />
              ) : (
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
                  <IconMovie className="h-8 w-8 text-white/40" />
                  <span className="line-clamp-3 text-xs font-semibold text-white/70">{item.title}</span>
                </div>
              )}
            </div>

            {/* Top-left rating badge (no harsh border) */}
            {Boolean(item.rating) && (
              <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-md glass-badge px-2 py-0.5 text-[10px] font-bold">
                <IconStar className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-amber-400">{item.rating}</span>
              </div>
            )}

            {/* Top-right type badge */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <span className="rounded-md glass-badge px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200">
                {item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
              </span>
            </div>

            {/* Bottom brand crown badge */}
            <div className="absolute bottom-2.5 left-2.5 z-10">
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/90 text-[10px] shadow-sm">
                👑
              </span>
            </div>
          </div>

          {/* 2. Expanded Info Pane (Opens smoothly to the RIGHT on Desktop) */}
          <div
            ref={panelRef}
            className="hidden group-hover:flex flex-col justify-between flex-1 min-w-0 p-3.5 sm:p-5 glass-card-poster-panel z-20 transition-all duration-300 animate-fade-in"
          >
            <div className="space-y-2">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider text-brand-primary drop-shadow-[0_2px_8px_rgba(215,4,102,0.5)]">
                {item.type === "series" ? "Série Chillers" : "Film Chillers"}
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2 drop-shadow-sm">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-[11px] sm:text-xs text-zinc-300 line-clamp-3 sm:line-clamp-4 leading-relaxed mt-1">
                  {item.description}
                </p>
              )}
            </div>

            <div className="space-y-3 pt-2">
              {/* Action Buttons */}
              <div ref={buttonsRef} className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(item);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl glass-button text-white font-bold text-xs transition-all text-center truncate cursor-pointer"
                >
                  Plus d'informations
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(item);
                  }}
                  aria-label={_("media.watch")}
                  className="h-8 w-8 rounded-xl bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95 flex items-center justify-center shrink-0 shadow-lg transition-all cursor-pointer"
                >
                  <IconPlayerPlay className="h-4 w-4 fill-black translate-x-[0.5px]" />
                </button>
              </div>

              {/* Metadata tags */}
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-zinc-400 font-semibold flex-wrap">
                {item.rating && (
                  <span className="glass-badge px-1.5 py-0.5 rounded text-amber-400 font-bold">
                    ★ {item.rating}
                  </span>
                )}
                {item.year && <span>{item.year}</span>}
                {item.duration && <span>• {item.duration}</span>}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Standard Landscape / Grid Cards with GSAP micro-animation and Glassmorphism overlay
  return (
    <div
      ref={cardRef}
      data-testid="movie-card"
      onClick={() => onOpenDetails(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative ${sizeClass} cursor-pointer`}
    >
      {/* Landscape 16:9 box */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-md transition-colors duration-300">
        <div ref={imgRef} className="relative w-full h-full">
          {hasImage ? (
            <Image
              src={primarySrc}
              alt={item.title}
              fill
              className="object-cover object-center"
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
        </div>

        {/* Top-left rating badge */}
        {Boolean(item.rating) && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md glass-badge px-1.5 py-0.5 text-[10px] font-bold">
            <IconStar className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-amber-400">{item.rating}</span>
          </div>
        )}

        {/* Top-right type badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className="rounded-md glass-badge px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200">
            {item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
          </span>
        </div>

        {/* Bottom brand badge */}
        <div className="absolute bottom-2 left-2 z-10">
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/90 text-[10px] shadow-sm">
            👑
          </span>
        </div>
      </div>

      {/* Glassmorphism Info overlay on hover */}
      <div
        ref={panelRef}
        style={{ opacity: 0, transform: "translateY(6px)" }}
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 max-md:hidden"
      >
        <div className="glass-card-overlay p-3 rounded-b-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-white leading-tight line-clamp-1 drop-shadow-sm">
              {item.title}
            </h3>
            <div ref={buttonsRef} className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(item);
                }}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
                aria-label={_("media.watch")}
              >
                <IconPlayerPlay className="h-3.5 w-3.5 fill-black translate-x-[0.5px]" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(item);
                }}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full glass-button text-white cursor-pointer"
                aria-label={_("media.details")}
              >
                <IconInfoCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
            {item.year && <span>{item.year}</span>}
            {item.rating && (
              <span className="glass-badge px-1 py-0.2 rounded text-amber-400 font-bold">
                ★ {item.rating}
              </span>
            )}
            {item.duration && <span>• {item.duration}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MovieCard);
