"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { Play, Star, Info, FilmSlate, BookmarkSimple, ListNumbers, HourglassSimple } from "@phosphor-icons/react";
import type { MovieOrShow } from "@/types/media";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";

export interface AppleMovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails?: (item: MovieOrShow) => void;
  variant?: "poster" | "landscape";
  className?: string;
  badge?: string;
  selected?: boolean;
}

// Apple design principles spring constants:
// Response ~0.35s, damping ratio ~0.88 (smooth settle with physical crispness)
const HOVER_SPRING = {
  type: "spring" as const,
  stiffness: 360,
  damping: 24,
  mass: 0.8,
};

const TAP_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 20,
  mass: 0.6,
};

export default function AppleMovieCard({
  item,
  onPlay,
  onOpenDetails,
  variant = "poster",
  className = "",
  badge,
  selected = false,
}: AppleMovieCardProps) {
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
  const [isHovered, setIsHovered] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    }
  }, []);

  // ── Apple TV 3D Tilt & Specular Light Physics (via Motion Values) ──
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const smoothX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const smoothY = useSpring(mouseY, { stiffness: 300, damping: 30 });

  // 3D rotations (gentle, Apple TV style depth: max ±8 deg)
  const rotateX = useTransform(smoothY, [0, 1], shouldReduceMotion ? [0, 0] : [7, -7]);
  const rotateY = useTransform(smoothX, [0, 1], shouldReduceMotion ? [0, 0] : [-7, 7]);

  // Glare / Specular highlight position
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

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || !canHover) return;
    setIsHovered(true);
  }, [canHover]);

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

  const isPoster = variant === "poster";
  const imageSrc = isPoster
    ? item.posterUrl || item.backdropUrl
    : item.backdropUrl || item.posterUrl;

  const isUpcoming = React.useMemo(() => {
    if (!item.releaseDate) return false;
    return new Date(item.releaseDate) > new Date();
  }, [item.releaseDate]);

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

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={() => onPlay(item)}
      // Apple Spring Physics: Real-world physical scale & translation
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
          ? { opacity: 0.85 }
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
      className={`group relative select-none cursor-pointer rounded-2xl bg-zinc-900/90 p-[1px] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] hover:shadow-[0_22px_45px_-12px_rgba(0,0,0,0.9)] transition-shadow duration-300 ${
        selected ? "ring-2 ring-red-500 shadow-red-500/20" : ""
      } ${
        isPoster
          ? "aspect-[2/3] w-full min-w-[150px] max-w-[260px]"
          : "aspect-video w-full"
      } ${className}`}
    >
      {/* ── Apple Specular Light / Glass Top Edge ── */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/15 border-t-white/30 z-30" />

      {/* ── Outer Rounded Container ── */}
      <div className="relative w-full h-full rounded-[15px] overflow-hidden bg-zinc-950 flex flex-col justify-end">
        {/* ── Poster / Backdrop Image with smooth crossfade ── */}
        {imageSrc && !imgError ? (
          <Image
            src={imageSrc}
            alt={item.title || ""}
            fill
            sizes="(max-width: 640px) 160px, (max-width: 1024px) 240px, 300px"
            className={`object-cover object-center transition-all duration-500 will-change-transform ${
              imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
            } ${isHovered ? "scale-105 brightness-105" : "scale-100"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 text-center">
            <FilmSlate className="w-10 h-10 text-zinc-600 mb-2" />
            <span className="text-xs font-bold text-zinc-400 line-clamp-2">{item.title}</span>
          </div>
        )}

        {/* ── Apple TV Glare / Sheen Shader (follows mouse coordinate) ── */}
        {!shouldReduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mix-blend-overlay"
            style={{
              background: `radial-gradient(circle 240px at ${glareX} ${glareY}, rgba(255,255,255,0.45), transparent 70%)`,
            }}
          />
        )}

        {/* ── Top Status Badges (Apple Glass Chips) ── */}
        <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between pointer-events-none">
          {/* Left: Rating or Custom Badge */}
          <div className="flex items-center gap-1.5">
            {badge ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-md">
                {badge}
              </span>
            ) : item.rating ? (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-xl border border-white/10 text-amber-400 text-[10px] font-bold shadow-md">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{item.rating}</span>
              </div>
            ) : null}
          </div>

          {/* Right: Audio (VF / VOSTFR) & Format Badges */}
          <div className="flex items-center gap-1">
            {audioBadge && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-md backdrop-blur-md ${
                  audioBadge.isFrench
                    ? "bg-red-600 text-white"
                    : "bg-black/60 text-cyan-300 border border-cyan-400/30"
                }`}
              >
                {audioBadge.label}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-xl border border-white/15 text-zinc-200 shadow-md">
              {item.type === "series" ? "SÉRIE" : "FILM"}
            </span>
          </div>
        </div>

        {/* ── Center Quick Play Button (Spring pop on Hover) ── */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
          transition={HOVER_SPRING}
          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center shadow-[0_8px_25px_rgba(0,0,0,0.5)] z-20 backdrop-blur-md pointer-events-none"
        >
          <Play className="w-5 h-5 fill-black translate-x-0.5" />
        </motion.div>

        {/* ── Bottom Content Gradient & Title (Apple Typography & Vibrancy) ── */}
        <div className="relative z-10 p-3 pt-10 bg-gradient-to-t from-black via-black/80 to-transparent space-y-1">
          <h3 className="text-xs sm:text-sm font-bold text-white leading-tight line-clamp-1 drop-shadow-sm tracking-[-0.01em]">
            {item.title}
          </h3>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
            <div className="flex items-center gap-1.5 truncate">
              {item.year && <span>{item.year}</span>}
              {item.genres && item.genres.length > 0 && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="truncate">{item.genres[0]}</span>
                </>
              )}
            </div>

            {isLoggedIn && (
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={favoriteLoading}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto"
                title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <BookmarkSimple
                  className={`w-3.5 h-3.5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
