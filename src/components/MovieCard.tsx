"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import type { MovieOrShow } from "@/types/media";
import {
  Play,
  Star,
  Info,
  FilmSlate,
  BookmarkSimple,
  ListNumbers,
  HourglassSimple,
} from "@phosphor-icons/react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";

const AddToPlaylistModal = dynamic(() => import("@/components/AddToPlaylistModal"), {
  ssr: false,
});

export interface MovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
  variant?: "scroll" | "grid" | "poster" | "grid-poster";
  className?: string;
  badge?: string;
  selected?: boolean;
  appleFrame?: boolean;
}

// Apple design principles spring constants (§4 Behavior over animation):
// Critically damped (damping 1.0, bounce 0), response 0.35s - smooth settle, no oscillation
const HOVER_SPRING = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.35,
};

// Response on pointer-down (§1 Kill latency & tactile feedback)
const TAP_SPRING = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.15,
};

function MovieCard({
  item,
  onPlay,
  onOpenDetails,
  variant = "scroll",
  className = "",
  badge,
  selected = false,
  appleFrame = false,
}: MovieCardProps) {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

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

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    }
  }, []);

  // ── Pre-calculated URLs for Instant Prefetching (Vercel bundle-preload rule) ──
  const typeParam = item.type === "series" || item.type === "anime" ? "tv" : "movie";
  const watchUrl = `/watch/${item.id}?type=${typeParam}`;
  const detailsUrl = item.type === "series" || item.type === "anime" ? `/tv/${item.id}` : `/media/${item.id}`;

  // ── Apple TV 3D Tilt & Light Physics (§2 Direct manipulation & §4 Springs) ──
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Critically damped springs tracking pointer position smoothly
  const smoothX = useSpring(mouseX, { stiffness: 260, damping: 32 });
  const smoothY = useSpring(mouseY, { stiffness: 260, damping: 32 });

  // 3D rotations (subtle, non-distracting depth: max ±5.5 deg)
  const rotateX = useTransform(smoothY, [0, 1], shouldReduceMotion ? [0, 0] : [5.5, -5.5]);
  const rotateY = useTransform(smoothX, [0, 1], shouldReduceMotion ? [0, 0] : [-5.5, 5.5]);

  // Glare / Specular highlight position across the card
  const glareX = useTransform(smoothX, [0, 1], ["0%", "100%"]);
  const glareY = useTransform(smoothY, [0, 1], ["0%", "100%"]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (shouldReduceMotion || !cardRef.current || e.pointerType === "touch" || !canHover) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseX.set(Math.max(0, Math.min(1, x)));
      mouseY.set(Math.max(0, Math.min(1, y)));
    },
    [canHover, mouseX, mouseY, shouldReduceMotion]
  );

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch" || !canHover) return;
      setIsHovered(true);
      // Instant Next.js route prefetching on hover for 0ms navigation latency
      try {
        router.prefetch(watchUrl);
        router.prefetch(detailsUrl);
      } catch {}
    },
    [canHover, router, watchUrl, detailsUrl]
  );

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  }, [mouseX, mouseY]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { token, user, updateUser } = useAuthStore.getState();
    if (!token || !user || !item) return;
    setFavoriteLoading(true);
    try {
      const res = await userService.toggleFavorite(token, {
        mediaType: item.type === "series" ? "series" : item.type === "anime" ? "anime" : "movie",
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

  const isPoster = variant === "poster" || variant === "grid-poster";
  const isGridPoster = variant === "grid-poster";

  const posterSrc = item.posterUrl || item.backdropUrl;
  const backdropSrc = !backdropFailed && (item.backdropOriginalUrl || item.backdropUrl) ? (item.backdropOriginalUrl || item.backdropUrl) : item.posterUrl;
  const primarySrc = isPoster ? posterSrc : backdropSrc;

  const gradients = [
    "from-zinc-800 via-zinc-900 to-zinc-950",
    "from-slate-800 via-zinc-900 to-zinc-950",
    "from-neutral-800 via-zinc-900 to-zinc-950",
  ];
  const gradientIndex = item.id
    ? item.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % gradients.length
    : 0;

  const audioBadge = React.useMemo(() => {
    if (item.langueAudio && item.langueAudio !== "UNKNOWN") {
      const isFr = item.langueAudio === "VF" || item.langueAudio === "VFF" || item.langueAudio === "VFQ";
      return {
        label: item.langueAudio === "VFF" ? "VF" : item.langueAudio,
        isFrench: isFr,
      };
    }
    const title = (item.title || "").toUpperCase();
    if (/\b(VOSTFR|VOST)\b/.test(title)) return { label: "VOSTFR", isFrench: false };
    if (/\b(VF|VFF|VFQ|FRENCH|TRUEFRENCH)\b/.test(title)) return { label: "VF", isFrench: true };
    return null;
  }, [item.langueAudio, item.title]);

  const isUpcoming = React.useMemo(() => {
    if (!item.releaseDate) return false;
    return new Date(item.releaseDate) > new Date();
  }, [item.releaseDate]);

  const releaseDateLabel = React.useMemo(() => {
    if (!item.releaseDate) return null;
    try {
      return new Date(item.releaseDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return item.releaseDate;
    }
  }, [item.releaseDate]);

  // ═════════════════════════════════════════════════════════════════════════
  // 1. POSTER VERTICAL VARIANT (Pure Apple TV Depth & Translucency)
  // ═════════════════════════════════════════════════════════════════════════
  if (isPoster) {
    const frameClass = appleFrame
      ? "bg-zinc-900/90 p-[1px] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)]"
      : "overflow-hidden bg-zinc-950";
    const posterContainerClass = isGridPoster
      ? `group relative w-full aspect-[2/3] select-none cursor-pointer rounded-2xl transition-transform duration-300 ${frameClass} ${
          selected ? "ring-2 ring-brand-primary" : ""
        } ${className}`
      : `group relative flex-none h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] select-none cursor-pointer rounded-2xl transition-transform duration-300 ${frameClass} ${
          selected ? "ring-2 ring-brand-primary" : ""
        } ${className}`;

    return (
      <motion.div
        ref={cardRef}
        data-testid="movie-card-poster"
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={() => onOpenDetails(item)}
        whileHover={
          !canHover || shouldReduceMotion
            ? undefined
            : {
                scale: 1.045,
                y: -5,
                transition: HOVER_SPRING,
              }
        }
        whileTap={
          shouldReduceMotion
            ? { opacity: 0.9 }
            : {
                scale: 0.96,
                y: 0,
                transition: TAP_SPRING,
              }
        }
        style={{
          rotateX: canHover ? rotateX : 0,
          rotateY: canHover ? rotateY : 0,
          transformPerspective: 900,
          transformStyle: "preserve-3d",
          touchAction: "manipulation",
        }}
        className={posterContainerClass}
      >
        {appleFrame && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/15 border-t-white/30 z-30" />
        )}
        <div className={appleFrame ? "relative w-full h-full rounded-2xl overflow-hidden bg-zinc-950" : "contents"}>
        {/* Shimmer Placeholder */}
        {(!imgLoaded || !primarySrc) && !imgError && (
          <div
            className="absolute inset-0 skeleton-loading z-10 pointer-events-none transition-opacity duration-500 ease-out"
            aria-hidden="true"
          />
        )}

        {/* Poster Image */}
        {primarySrc && !imgError ? (
          <Image
            src={primarySrc}
            alt={item.title || ""}
            fill
            className={`object-cover object-top transition-all duration-500 z-10 ${
              "opacity-100 scale-100"
            } ${isHovered ? "scale-105 brightness-105" : "scale-100"}`}
            sizes={
              isGridPoster
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                : "(max-width: 640px) 165px, (max-width: 768px) 195px, 255px"
            }
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
          />
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}
          >
            <FilmSlate className="h-8 w-8 text-white/40" />
            {imgError && (
              <span className="line-clamp-3 text-xs font-semibold text-white/70">
                {item.title}
              </span>
            )}
          </div>
        )}

        {/* Apple TV Parabolic Glare (Soft Ambient Sheen, No Stroke Border) */}
        {canHover && !shouldReduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle 280px at ${glareX} ${glareY}, rgba(255,255,255,0.35), transparent 70%)`,
            }}
          />
        )}

        {/* Top Status Chips (Apple Translucent Materials without Hard Borders) */}
        <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-start justify-between pointer-events-none">
          {/* Left: Rating Badge */}
          <div className="flex items-center gap-1.5">
            {badge ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-primary text-white">
                {badge}
              </span>
            ) : item.rating ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xl text-amber-400 text-[10px] font-bold">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{item.rating}</span>
              </div>
            ) : null}
          </div>

          {/* Right: Audio & Type Badges + Action Buttons */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-1">
              {audioBadge && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${
                    audioBadge.isFrench
                      ? "bg-brand-primary text-white"
                      : "bg-black/70 text-cyan-300"
                  }`}
                >
                  {audioBadge.label}
                </span>
              )}
              {isUpcoming && (
                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-600/90 backdrop-blur-md text-white flex items-center gap-1">
                  <HourglassSimple className="w-2.5 h-2.5" />
                  <span>À VENIR</span>
                </span>
              )}
              <span className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-xl text-zinc-200">
                {item.isTrending
                  ? "NOUVEAU"
                  : item.type === "series"
                  ? "SÉRIE"
                  : item.type === "anime"
                  ? "ANIME"
                  : "FILM"}
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
                  className="rounded-full p-2 shadow-md backdrop-blur-xl bg-black/60 text-cyan-400 hover:bg-black/80 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                >
                  <ListNumbers className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  className={`rounded-full p-2 shadow-md backdrop-blur-xl transition-all cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center active:scale-95 ${
                    isFavorite
                      ? "bg-brand-primary text-white"
                      : "bg-black/60 text-white hover:bg-black/80 hover:scale-105"
                  }`}
                >
                  <BookmarkSimple
                    className={`w-3.5 h-3.5 ${isFavorite ? "fill-white text-white" : ""}`}
                  />
                </button>
              </div>
            )}
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
      </motion.div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 2. LANDSCAPE 16:9 VARIANT (Apple TV Card Depth & Soft Translucency)
  // ═════════════════════════════════════════════════════════════════════════
  const landscapeSizeClass =
    variant === "grid"
      ? "w-full"
      : "flex-none w-[240px] sm:w-[280px] md:w-[320px] lg:w-[360px]";

  return (
    <motion.div
      ref={cardRef}
      data-testid="movie-card"
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={() => onOpenDetails(item)}
      whileHover={
        !canHover || shouldReduceMotion
          ? undefined
          : {
              scale: 1.035,
              y: -4,
              transition: HOVER_SPRING,
            }
      }
      whileTap={
        shouldReduceMotion
          ? { opacity: 0.9 }
          : {
              scale: 0.96,
              y: 0,
              transition: TAP_SPRING,
            }
      }
      style={
        canHover
          ? {
              rotateX,
              rotateY,
              transformPerspective: 900,
              transformStyle: "preserve-3d",
              touchAction: "manipulation",
            }
          : { touchAction: "manipulation" }
      }
      className={`group relative ${landscapeSizeClass} select-none cursor-pointer rounded-2xl overflow-hidden bg-zinc-950 transition-transform duration-300 ${
        selected ? "ring-2 ring-brand-primary" : ""
      } ${className}`}
    >
      {/* Landscape 16:9 Box */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950">
        {/* Shimmer Placeholder with smooth crossfade */}
        {(!imgLoaded || !primarySrc) && !imgError && (
          <div
            className="absolute inset-0 skeleton-loading z-10 pointer-events-none transition-opacity duration-500 ease-out"
            aria-hidden="true"
          />
        )}

        {/* Landscape Image */}
        {primarySrc && !imgError ? (
          <Image
            src={primarySrc}
            alt={item.title || ""}
            fill
            className={`object-cover object-top transition-all duration-500 z-10 ${
              "opacity-100 scale-100"
            } ${isHovered ? "scale-105 brightness-105" : "scale-100"}`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              if (!backdropFailed && item.posterUrl) {
                setBackdropFailed(true);
              } else {
                setImgError(true);
              }
              setImgLoaded(true);
            }}
            sizes={
              variant === "grid"
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                : "(max-width: 640px) 240px, (max-width: 768px) 280px, 360px"
            }
          />
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${gradients[gradientIndex]} p-3 text-center`}
          >
            <FilmSlate className="h-8 w-8 text-white/40" />
            {imgError && (
              <span className="line-clamp-3 text-xs font-semibold text-white/70">
                {item.title}
              </span>
            )}
          </div>
        )}

        {/* Apple TV Parabolic Glare (Soft Ambient Sheen, No Stroke Border) */}
        {canHover && !shouldReduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle 280px at ${glareX} ${glareY}, rgba(255,255,255,0.35), transparent 70%)`,
            }}
          />
        )}

        {/* Top-left Rating Badge */}
        {Boolean(item.rating) && (
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xl text-amber-400 text-[10px] font-bold">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{item.rating}</span>
          </div>
        )}

        {/* Top-right Type & Audio Badges */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1">
          {audioBadge && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${
                audioBadge.isFrench
                  ? "bg-brand-primary text-white"
                  : "bg-black/70 text-cyan-300"
              }`}
            >
              {audioBadge.label}
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-600/90 backdrop-blur-md text-white flex items-center gap-1">
              <HourglassSimple className="w-2.5 h-2.5" />
              <span>À VENIR</span>
            </span>
          )}
          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-xl text-zinc-200">
            {item.type === "series" ? "SÉRIE" : item.type === "anime" ? "ANIME" : "FILM"}
          </span>
        </div>

        {/* Center Quick Play Spring Button on hover */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
          transition={HOVER_SPRING}
          className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-white/95 text-black flex items-center justify-center shadow-[0_8px_25px_rgba(0,0,0,0.6)] z-20 backdrop-blur-md max-md:hidden pointer-events-none"
        >
          <Play className="w-4 h-4 fill-black translate-x-0.5" />
        </motion.div>

        {/* Mobile: always-visible title gradient */}
        <div className="absolute bottom-0 left-0 right-0 z-20 md:hidden pointer-events-none">
          <div className="bg-gradient-to-t from-black via-black/60 to-transparent p-2.5 pt-6">
            <h3 className="text-[11px] font-bold text-white leading-tight line-clamp-1 drop-shadow-md tracking-tight">
              {item.title}
            </h3>
          </div>
        </div>
      </div>

      {/* Glassmorphic Info overlay on hover (desktop only) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={HOVER_SPRING}
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 max-md:hidden"
          >
            <div className="bg-black/85 backdrop-blur-2xl p-3 rounded-b-2xl space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-white leading-tight line-clamp-1 drop-shadow-sm tracking-[-0.015em]">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
                  {isLoggedIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlaylistModal(true);
                      }}
                      title="Enregistrer dans une playlist"
                      aria-label="Enregistrer dans une playlist"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-cyan-400 hover:text-white cursor-pointer active:scale-95 transition-all"
                    >
                      <ListNumbers className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
                    aria-label={_("media.watch")}
                  >
                    <Play className="h-3.5 w-3.5 fill-black translate-x-[0.5px]" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails(item);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white hover:scale-105 active:scale-95 cursor-pointer transition-all"
                    aria-label={_("media.details")}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-medium">
                {isUpcoming && releaseDateLabel ? (
                  <span className="text-blue-400 font-semibold flex items-center gap-1">
                    <HourglassSimple className="w-2.5 h-2.5" />
                    <span>Sortie le {releaseDateLabel}</span>
                  </span>
                ) : (
                  item.year && <span>{item.year}</span>
                )}
                {item.rating && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                    ★ {item.rating}
                  </span>
                )}
                {!isUpcoming && item.duration && <span>• {item.duration}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </motion.div>
  );
}

export default React.memo(MovieCard);
