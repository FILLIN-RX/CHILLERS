"use client";

import React, { useState, useRef, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import gsap from "gsap";
import type { MovieOrShow } from "@/types/media";
import { Play, Star, Info, FilmSlate, BookmarkSimple, ListNumbers, HourglassSimple } from '@phosphor-icons/react';
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";

const AddToPlaylistModal = dynamic(() => import("@/components/AddToPlaylistModal"), {
  ssr: false,
});

interface MovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
  variant?: "scroll" | "grid" | "poster" | "grid-poster";
  className?: string;
}

function MovieCard({
  item,
  onPlay,
  onOpenDetails,
  variant = "scroll",
  className = "",
}: MovieCardProps) {
  const { translate: _ } = useLanguage();
  const isLoggedIn = useAuthStore((s) => Boolean(s.token));
  const isFavorite = useAuthStore((s) =>
    Boolean(
      s.user?.favorites?.some(
        (f) =>
          f.tmdbId === String(item?.id) &&
          f.mediaType === (item?.type === "series" ? "series" : item?.type === "anime" ? "anime" : "movie")
      )
    )
  );

  const [imgError, setImgError] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [landscapeLoaded, setLandscapeLoaded] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { token, user, updateUser } = useAuthStore.getState();
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

  const isPoster = variant === "poster" || variant === "grid-poster";
  const isGridPoster = variant === "grid-poster";
  const posterSrc = item.posterUrl || item.backdropUrl;
  const backdropSrc = (!backdropFailed && item.backdropUrl) ? item.backdropUrl : item.posterUrl;
  const primarySrc = isPoster ? posterSrc : backdropSrc;
  const hasImage = !!primarySrc && !imgError;

  const sizeClass =
    variant === "grid" || isGridPoster
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

  /** true si le film/série n'est pas encore sorti */
  const isUpcoming = React.useMemo(() => {
    if (!item.releaseDate) return false;
    return new Date(item.releaseDate) > new Date();
  }, [item.releaseDate]);

  /** Date de sortie formatée lisiblement (ex: "25 sept. 2026") */
  const releaseDateLabel = React.useMemo(() => {
    if (!item.releaseDate) return null;
    try {
      return new Date(item.releaseDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return item.releaseDate; }
  }, [item.releaseDate]);

  // Hardware-accelerated, zero-reflow GSAP Hover Animations
  const handleMouseEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia && !window.matchMedia("(hover: hover)").matches) {
      return;
    }

    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: -6,
        scale: 1.04,
        zIndex: 30,
        duration: 0.35,
        ease: "power2.out",
        force3D: true,
        overwrite: "auto",
      });
    }

    if (posterRef.current) {
      gsap.to(posterRef.current, {
        scale: 1.05,
        duration: 0.4,
        ease: "power2.out",
        force3D: true,
        overwrite: "auto",
      });
    }

    if (overlayRef.current) {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
          force3D: true,
          overwrite: "auto",
        }
      );
    }

    if (buttonsRef.current) {
      gsap.fromTo(
        buttonsRef.current.children,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.04,
          duration: 0.28,
          ease: "back.out(1.4)",
          force3D: true,
          overwrite: "auto",
        }
      );
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        zIndex: 1,
        duration: 0.28,
        ease: "power2.inOut",
        force3D: true,
        overwrite: "auto",
      });
    }

    if (posterRef.current) {
      gsap.to(posterRef.current, {
        scale: 1,
        duration: 0.28,
        ease: "power2.inOut",
        force3D: true,
        overwrite: "auto",
      });
    }

    if (overlayRef.current) {
      gsap.to(overlayRef.current, {
        opacity: 0,
        y: 8,
        duration: 0.2,
        ease: "power2.in",
        force3D: true,
        overwrite: "auto",
      });
    }
  }, []);

  // Premium Vertical Poster Card (Fluid, stable width without flex layout reflow)
  if (isPoster) {
    const posterCardClass = isGridPoster
      ? `group relative w-full aspect-[2/3] cursor-pointer rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.9)] transition-shadow duration-300 card-ambient-shimmer ${className}`
      : `group relative flex-none h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] cursor-pointer rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_8px_24px_rgba(0,0,0,0.6)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.9)] transition-shadow duration-300 card-ambient-shimmer ${className}`;

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
        className={posterCardClass}
      >
        {/* 1. Base Vertical Poster Image */}
        <div ref={posterRef} className="relative w-full h-full bg-zinc-900 overflow-hidden">
          {/* Shimmer Placeholder : affiché tant que l'image n'est pas prête ou si l'image est en cours */}
          {(!posterLoaded || !posterSrc) && !imgError && (
            <div
              className="absolute inset-0 skeleton-loading z-10 pointer-events-none transition-opacity duration-500 ease-out"
              aria-hidden="true"
            />
          )}
          {posterSrc && !imgError ? (
            <Image
              src={posterSrc}
              alt={item.title || ""}
              fill
              className={`object-cover object-top transition-opacity duration-500 ease-out will-change-[opacity] ${
                posterLoaded ? "opacity-100" : "opacity-0"
              }`}
              sizes={
                isGridPoster
                  ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  : "(max-width: 640px) 165px, (max-width: 768px) 195px, 255px"
              }
              loading="lazy"
              onLoad={() => setPosterLoaded(true)}
              onError={() => {
                setImgError(true);
                setPosterLoaded(true);
              }}
            />
          ) : !posterSrc && !imgError ? (
            <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />
          ) : (
            <div className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
              <FilmSlate className="h-8 w-8 text-white/40" />
              <span className="line-clamp-3 text-xs font-semibold text-white/70">{item.title}</span>
            </div>
          )}
        </div>

        {/* Skeleton Badges placeholders while image is loading */}
        {!posterLoaded && !imgError && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-md px-2 py-0.5 bg-black/40 backdrop-blur-md">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
              <div className="h-2 w-4 rounded bg-zinc-600/60" />
            </div>
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
              <div className="h-4 w-12 rounded-md bg-white/10 backdrop-blur-md" />
            </div>
          </div>
        )}

        {/* Top-right "NOUVEAU" or Type Badge & Audio & Bookmark (fades in when loaded) */}
        <div className={`absolute top-2.5 right-2.5 z-20 flex flex-col items-end gap-1.5 pointer-events-auto transition-opacity duration-300 ${
          posterLoaded || imgError ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}>
          <div className="flex items-center gap-1">
            {audioBadge && (
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border-0 shadow-none ${
                audioBadge.isFrench 
                ? 'bg-brand-primary text-white' 
                : 'bg-amber-600 text-white'
            }`}>
                {audioBadge.label}
              </span>
            )}
            {isUpcoming && (
              <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border-0 shadow-none bg-blue-600 text-white flex items-center gap-1">
                <HourglassSimple className="w-2.5 h-2.5" />
                <span>À VENIR</span>
              </span>
            )}
            <span className="rounded-md glass-badge px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200 border-0 shadow-none">
              {item.isTrending ? "NOUVEAU" : item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
            </span>
          </div>
          {isLoggedIn && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistModal(true);
                }}
                title="Enregistrer dans une playlist"
                aria-label="Enregistrer dans une playlist"
                className="rounded-full p-2 shadow-md backdrop-blur-md transition-all bg-black/50 text-cyan-400 hover:bg-black/80 hover:scale-105 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <ListNumbers className="w-4 h-4" />
              </button>

              <button 
                onClick={toggleFavorite}
                disabled={favoriteLoading}
                title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                className={`rounded-full p-2 shadow-md backdrop-blur-md transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  isFavorite ? 'bg-brand-primary text-white' : 'bg-black/50 text-white hover:bg-black/80'
                }`}
              >
                <BookmarkSimple className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Top-left Rating Badge (fades in when loaded) */}
        {Boolean(item.rating) && (
          <div className={`absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-md glass-badge px-2 py-0.5 text-[10px] font-bold border-0 shadow-none transition-opacity duration-300 ${
            posterLoaded || imgError ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-amber-400">{item.rating}</span>
          </div>
        )}



        {/* Bottom Cinematic Gradient & Details Overlay (Visible smoothly on Hover) */}
        <div
          ref={overlayRef}
          style={{ opacity: 0, transform: "translateY(8px)" }}
          className="absolute inset-0 flex flex-col justify-end p-3.5 sm:p-4 bg-gradient-to-t from-black via-black/85 to-transparent z-20 pointer-events-none group-hover:pointer-events-auto"
        >
          <div className="space-y-2">
            {/* Title */}
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-1 drop-shadow-md">
              {item.title}
            </h3>

            {/* Action Buttons */}
            <div ref={buttonsRef} className="flex items-center gap-2 pt-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  onPlay(item);
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white translate-x-[0.5px]" />
                <span>Regarder</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  onOpenDetails(item);
                }}
                title="Détails"
                aria-label={_("media.details")}
                className="h-8 w-8 rounded-xl glass-button text-white flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>

            {/* Metadata Tags */}
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-300 font-medium flex-wrap pt-0.5">
              {item.rating && (
                <span className="text-amber-400 font-bold">★ {item.rating}</span>
              )}
              {item.genres && item.genres.length > 0 && (
                <span>• {item.genres[0]}</span>
              )}
              {isUpcoming && releaseDateLabel
                ? <span className="text-blue-400 font-semibold flex items-center gap-1">
                    <HourglassSimple className="w-2.5 h-2.5" />
                    <span>Sortie le {releaseDateLabel}</span>
                  </span>
                : item.year && <span>• {item.year}</span>
              }
            </div>
          </div>
        </div>

        {showPlaylistModal && (
          <AddToPlaylistModal
            isOpen={showPlaylistModal}
            onClose={() => setShowPlaylistModal(false)}
            media={{
              tmdbId: String(item.id),
              mediaType: item.type === "series" ? "series" : item.type === "anime" ? "anime" : "movie",
              title: item.title,
              posterPath: item.posterUrl,
              backdropPath: item.backdropUrl,
            }}
          />
        )}
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
      className={`group relative ${sizeClass} cursor-pointer card-ambient-shimmer ${className}`}
    >
      {/* Landscape 16:9 box */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-md transition-colors duration-300">
        {/* Shimmer Placeholder with smooth crossfade */}
        {(!landscapeLoaded || !primarySrc) && !imgError && (
          <div
            className="absolute inset-0 skeleton-loading z-10 pointer-events-none transition-opacity duration-500 ease-out"
            aria-hidden="true"
          />
        )}
        <div ref={posterRef} className="relative w-full h-full">
          {primarySrc && !imgError ? (
            <Image
              src={primarySrc}
              alt={item.title || ""}
              fill
              className={`object-cover object-top transition-opacity duration-700 ease-out will-change-[opacity] ${
                landscapeLoaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setLandscapeLoaded(true)}
              onError={() => {
                if (!backdropFailed && item.posterUrl) {
                  setBackdropFailed(true);
                } else {
                  setImgError(true);
                }
                setLandscapeLoaded(true);
              }}
              sizes={
                variant === "grid"
                  ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  : "(max-width: 640px) 240px, (max-width: 768px) 280px, 360px"
              }
            />
          ) : !primarySrc && !imgError ? (
            <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />
          ) : (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}>
              <FilmSlate className="h-8 w-8 text-white/40" />
              <span className="line-clamp-3 text-xs font-semibold text-white/70">{item.title}</span>
            </div>
          )}
        </div>

        {/* Skeleton Badges placeholders while landscape image is loading */}
        {!landscapeLoaded && !imgError && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-black/40 backdrop-blur-md">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
              <div className="h-2 w-4 rounded bg-zinc-600/60" />
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <div className="h-3.5 w-11 rounded-md bg-white/10 backdrop-blur-md" />
            </div>
          </div>
        )}

        {/* Top-left rating badge (fades in when loaded) */}
        {Boolean(item.rating) && (
          <div className={`absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md glass-badge px-1.5 py-0.5 text-[10px] font-bold border-0 shadow-none transition-opacity duration-300 ${
            landscapeLoaded || imgError ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-amber-400">{item.rating}</span>
          </div>
        )}

        {/* Top-right type & audio badge (fades in when loaded) */}
        <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 transition-opacity duration-300 ${
          landscapeLoaded || imgError ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}>
          {audioBadge && (
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border-0 shadow-none ${
              audioBadge.isFrench 
                ? 'bg-[#D70466]/90 text-white' 
                : 'bg-amber-600/90 text-white'
            }`}>
              {audioBadge.label}
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border-0 shadow-none bg-blue-600 text-white flex items-center gap-1">
              <HourglassSimple className="w-2.5 h-2.5" />
              <span>À VENIR</span>
            </span>
          )}
          <span className="rounded-md glass-badge px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-200 border-0 shadow-none">
            {item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
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
              {isLoggedIn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylistModal(true);
                  }}
                  title="Enregistrer dans une playlist"
                  aria-label="Enregistrer dans une playlist"
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full glass-button text-cyan-400 hover:text-white cursor-pointer"
                >
                  <ListNumbers className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  onPlay(item);
                }}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
                aria-label={_("media.watch")}
              >
                <Play className="h-4 w-4 fill-black translate-x-[0.5px]" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  onOpenDetails(item);
                }}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full glass-button text-white cursor-pointer"
                aria-label={_("media.details")}
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-medium">
            {isUpcoming && releaseDateLabel
              ? <span className="text-blue-400 font-semibold flex items-center gap-1">
                  <HourglassSimple className="w-2.5 h-2.5" />
                  <span>Sortie le {releaseDateLabel}</span>
                </span>
              : item.year && <span>{item.year}</span>
            }
            {item.rating && (
              <span className="glass-badge px-1 py-0.2 rounded text-amber-400 font-bold">
                ★ {item.rating}
              </span>
            )}
            {!isUpcoming && item.duration && <span>• {item.duration}</span>}
          </div>
        </div>
      </div>

      {showPlaylistModal && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          media={{
            tmdbId: String(item.id),
            mediaType: item.type === "series" ? "series" : item.type === "anime" ? "anime" : "movie",
            title: item.title,
            posterPath: item.posterUrl,
            backdropPath: item.backdropUrl,
          }}
        />
      )}
    </div>
  );
}

export default React.memo(MovieCard);
