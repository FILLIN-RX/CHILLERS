"use client";

import React, { useState, useRef, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { MovieOrShow } from "@/types/media";
import { IconPlayerPlay, IconStar, IconInfoCircle, IconMovie, IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";

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
  const { user, token, updateUser } = useAuthStore();
  const [imgError, setImgError] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const isFavorite = user?.favorites?.some((f) => f.tmdbId === String(item?.id) && f.mediaType === (item.type === 'series' ? 'series' : item.type === 'anime' ? 'anime' : 'movie'));

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !user || !item) return;
    setFavoriteLoading(true);
    try {
      const res = await userService.toggleFavorite(token, {
        mediaType: item.type === 'series' ? 'series' : item.type === 'anime' ? 'anime' : 'movie',
        tmdbId: String(item.id),
        title: item.title,
        posterPath: item.posterUrl,
      });
      if (res.success) {
        updateUser({ favorites: res.favorites });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  const isPoster = variant === "poster";
  const posterSrc = item.posterUrl || item.backdropUrl;
  const backdropSrc = (!backdropFailed && item.backdropUrl) ? item.backdropUrl : item.posterUrl;
  const primarySrc = isPoster ? posterSrc : backdropSrc;
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

  const audioBadge = React.useMemo(() => {
    if (item.langueAudio && item.langueAudio !== 'UNKNOWN') {
      const isFr = item.langueAudio === 'VF' || item.langueAudio === 'VFF' || item.langueAudio === 'VFQ';
      return {
        label: item.langueAudio === 'VFF' ? 'VF' : item.langueAudio,
        isFrench: isFr,
      };
    }
    const title = (item.title || '').toUpperCase();
    if (/\b(VOSTFR|VOST)\b/.test(title)) return { label: 'VOSTFR', isFrench: false };
    if (/\b(VF|VFF|VFQ|FRENCH|TRUEFRENCH)\b/.test(title)) return { label: 'VF', isFrench: true };
    return null;
  }, [item.langueAudio, item.title]);

  // GSAP Smooth Hover Animations (Prime Video Cinematic Easing)
  const handleMouseEnter = useCallback(() => {
    if (cardRef.current && document.contains(cardRef.current)) {
      gsap.to(cardRef.current, {
        y: -6,
        scale: 1.02,
        zIndex: 30,
        duration: 0.48,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    if (isPoster) {
      // Crossfade from vertical poster to wide backdrop
      if (backdropRef.current && document.contains(backdropRef.current)) {
        gsap.to(backdropRef.current, {
          opacity: 1,
          scale: 1.05,
          duration: 0.52,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
      if (posterRef.current && document.contains(posterRef.current)) {
        gsap.to(posterRef.current, {
          opacity: 0,
          duration: 0.35,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    } else {
      if (posterRef.current && document.contains(posterRef.current)) {
        gsap.to(posterRef.current, {
          scale: 1.06,
          duration: 0.5,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    }

    if (overlayRef.current && document.contains(overlayRef.current)) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.42,
          ease: "power2.out",
          overwrite: "auto",
        }
      );
    }

    if (buttonsRef.current && document.contains(buttonsRef.current)) {
      gsap.fromTo(
        buttonsRef.current.children,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.05,
          duration: 0.35,
          ease: "back.out(1.4)",
          overwrite: "auto",
        }
      );
    }
  }, [isPoster]);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current && document.contains(cardRef.current)) {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        zIndex: 1,
        duration: 0.38,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    }

    if (isPoster) {
      if (backdropRef.current && document.contains(backdropRef.current)) {
        gsap.to(backdropRef.current, {
          opacity: 0,
          scale: 1,
          duration: 0.35,
          ease: "power2.inOut",
          overwrite: "auto",
        });
      }
      if (posterRef.current && document.contains(posterRef.current)) {
        gsap.to(posterRef.current, {
          opacity: 1,
          duration: 0.35,
          ease: "power2.inOut",
          overwrite: "auto",
        });
      }
    } else {
      if (posterRef.current && document.contains(posterRef.current)) {
        gsap.to(posterRef.current, {
          scale: 1,
          duration: 0.35,
          ease: "power2.inOut",
          overwrite: "auto",
        });
      }
    }

    if (overlayRef.current && document.contains(overlayRef.current)) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        y: 8,
        duration: 0.28,
        ease: "power2.in",
        overwrite: "auto",
      });
    }
  }, [isPoster]);

  // Prime Video Style Poster Card: Full-bleed wide expansion with overlayed details at bottom
  if (isPoster) {
    return (
      <div
        ref={cardRef}
        data-testid="movie-card-poster"
        onClick={() => {
          handleMouseLeave();
          onOpenDetails(item);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative flex-none h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] sm:hover:w-[380px] md:hover:w-[440px] lg:hover:w-[500px] transition-all duration-500 ease-out cursor-pointer rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_12px_36px_rgba(0,0,0,0.7)] hover:shadow-[0_24px_60px_rgba(0,0,0,0.95)] hover:z-30"
      >
        {/* 1. Base Vertical Poster Image (visible when not hovered) */}
        <div ref={posterRef} className="absolute inset-0 w-full h-full bg-zinc-900 transition-opacity duration-300">
          {posterSrc && !imgError ? (
            <Image
              src={posterSrc}
              alt={item.title}
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 165px, (max-width: 768px) 195px, 255px"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
              <IconMovie className="h-8 w-8 text-white/40" />
              <span className="line-clamp-3 text-xs font-semibold text-white/70">{item.title}</span>
            </div>
          )}
        </div>

        {/* 2. Full-bleed Landscape Backdrop Image (crossfades on hover) */}
        <div
          ref={backdropRef}
          style={{ opacity: 0 }}
          className="hidden sm:block absolute inset-0 w-full h-full bg-zinc-900 pointer-events-none"
        >
          {backdropSrc ? (
            <Image
              src={backdropSrc}
              alt={item.title}
              fill
              className="object-cover object-top"
              sizes="(max-width: 1024px) 440px, 500px"
              loading="lazy"
            />
          ) : null}
        </div>

        {/* Top-right "NOUVEAU" or Type Badge & Audio & Bookmark */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1">
            {audioBadge && (
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-lg ${
                audioBadge.isFrench 
                  ? 'bg-blue-600/90 text-white border border-blue-400/30' 
                  : 'bg-amber-600/90 text-white border border-amber-400/30'
              }`}>
                {audioBadge.label}
              </span>
            )}
            <span className="rounded-md glass-badge px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200 shadow-lg">
              {item.isTrending ? "NOUVEAU" : item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
            </span>
          </div>
          {user && (
            <button 
              onClick={toggleFavorite}
              disabled={favoriteLoading}
              className={`rounded-full p-1.5 shadow-lg backdrop-blur-md transition-all ${
                isFavorite ? 'bg-[#D70466]/90 text-white' : 'bg-black/40 text-white hover:bg-black/60 border border-white/20'
              }`}
            >
              {isFavorite ? (
                <IconBookmarkFilled className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <IconBookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          )}
        </div>

        {/* Top-left Rating Badge */}
        {Boolean(item.rating) && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-md glass-badge px-2 py-0.5 text-[10px] font-bold">
            <IconStar className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-amber-400">{item.rating}</span>
          </div>
        )}

        {/* Bottom Crown Badge (collapsed state) */}
        <div className="absolute bottom-3 left-3 z-10 group-hover:opacity-0 transition-opacity duration-300">
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/90 text-xs shadow-md">
            👑
          </span>
        </div>

        {/* 3. Bottom Cinematic Gradient & Details Overlay (Visible on Hover like Prime Video) */}
        <div
          ref={overlayRef}
          style={{ opacity: 0, transform: "translateY(8px)" }}
          className="hidden sm:flex absolute inset-0 flex-col justify-end p-4 sm:p-5 bg-gradient-to-t from-black via-black/75 to-transparent z-20 pointer-events-none group-hover:pointer-events-auto"
        >
          <div className="space-y-2.5">
            {/* Title */}
            <h3 className="text-base sm:text-xl font-black text-white leading-tight line-clamp-1 drop-shadow-md">
              {item.title}
            </h3>

            {/* Action Buttons (Prime Video style) */}
            <div ref={buttonsRef} className="flex items-center gap-2.5 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  onOpenDetails(item);
                }}
                className="py-2 px-4 rounded-xl glass-button text-white font-bold text-xs transition-all text-center truncate cursor-pointer shadow-lg"
              >
                Plus d&apos;informations
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  onPlay(item);
                }}
                aria-label={_("media.watch")}
                className="h-8 w-8 rounded-xl bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95 flex items-center justify-center shrink-0 shadow-lg transition-all cursor-pointer"
              >
                <IconPlayerPlay className="h-4 w-4 fill-black translate-x-[0.5px]" />
              </button>
            </div>

            {/* Metadata Tags */}
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-300 font-medium flex-wrap pt-0.5">
              {item.rating && (
                <span className="glass-badge px-1.5 py-0.5 rounded text-amber-400 font-bold">
                  ★ {item.rating}
                </span>
              )}
              {item.genres && item.genres.length > 0 && (
                <span className="text-zinc-300">{item.genres.slice(0, 2).join(", ")}</span>
              )}
              {item.duration && <span>• {item.duration}</span>}
              {item.year && <span>• {item.year}</span>}
            </div>

            {/* Prime / Chillers Tagline */}
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium pt-0.5">
              <span className="text-amber-400">👑</span>
              <span>Inclus avec Chillers</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard Landscape / Grid Cards
  return (
    <div
      ref={cardRef}
      data-testid="movie-card"
      onClick={() => {
        handleMouseLeave();
        onOpenDetails(item);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative ${sizeClass} cursor-pointer`}
    >
      {/* Landscape 16:9 box */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-md transition-colors duration-300">
        <div ref={posterRef} className="relative w-full h-full">
          {hasImage ? (
            <Image
              src={primarySrc}
              alt={item.title}
              fill
              className="object-cover object-top"
              loading="lazy"
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

        {/* Top-right type & audio badge */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {audioBadge && (
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${
              audioBadge.isFrench 
                ? 'bg-blue-600/90 text-white border border-blue-400/30' 
                : 'bg-amber-600/90 text-white border border-amber-400/30'
            }`}>
              {audioBadge.label}
            </span>
          )}
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

        {/* Mobile: always-visible title gradient */}
        <div className="absolute bottom-0 left-0 right-0 z-20 md:hidden">
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-6">
            <h3 className="text-[11px] font-bold text-white leading-tight line-clamp-1 drop-shadow-md">
              {item.title}
            </h3>
          </div>
        </div>
      </div>

      {/* Glassmorphism Info overlay on hover (desktop only) */}
      <div
        ref={overlayRef}
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
                  handleMouseLeave();
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
                  handleMouseLeave();
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
