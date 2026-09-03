"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { MovieOrShow, Season, Episode } from "@/types/media";
import { getSeasonDetails, getMediaDetails } from "@/services/media";
import { IconX, IconPlayerPlay, IconStar, IconInfoCircle, IconPlaylist } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import { useAuthStore } from "@/stores/useAuthStore";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";

interface MovieModalProps {
  item: MovieOrShow | null;
  isOpen: boolean;
  onClose: () => void;
  onWatch: (item: MovieOrShow, episode?: Episode) => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function MovieModal({
  item,
  isOpen,
  onClose,
  onWatch,
  onOpenDetails: _onOpenDetails,
}: MovieModalProps) {
  const router = useRouter();
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [enhanced, setEnhanced] = useState<MovieOrShow | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const { user } = useAuthStore();
  const { translate: _ } = useLanguage();

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    return () => releaseModalScrollLock();
  }, [isOpen]);

  // Reset transient state when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveSeason(null);
      setEpisodes([]);
      setSeasonLoading(false);
      setEnhanced(null);
    }
  }, [isOpen, item?.id]);

  // Fetch full details
  useEffect(() => {
    if (!isOpen || !item) return;
    const controller = new AbortController();
    const isTV = item.type === "series" || item.type === "anime";
    getMediaDetails(item.id, isTV, controller.signal)
      .then(full => {
        if (full && !controller.signal.aborted) setEnhanced(full);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen, item?.id, item?.type]);

  const handleSeasonChange = useCallback(
    async (season: Season) => {
      if (!item) return;
      setActiveSeason(season);
      setSeasonLoading(true);
      try {
        const data = await getSeasonDetails(item.id, String(season.seasonNumber));
        if (data && data.episodes) {
          setEpisodes(
            data.episodes.map((ep: any) => ({
              id: String(ep.id),
              title: ep.name,
              duration: `${ep.runtime || 24}m`,
              number: ep.episode_number,
              thumbnail: ep.still_path
                ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                : "",
              synopsis: ep.overview,
            })),
          );
        } else {
          setEpisodes([]);
        }
      } catch (e) {
        console.error("Failed to load season details", e);
        setEpisodes([]);
      } finally {
        setSeasonLoading(false);
      }
    },
    [item?.id],
  );

  useEffect(() => {
    if (isOpen && item?.seasons && item.seasons.length > 0 && !activeSeason) {
      handleSeasonChange(item.seasons[0]);
    }
  }, [isOpen, item?.id, activeSeason, handleSeasonChange]);

  // GSAP Smooth Morph Expansion Animation (Card blossoming into Modal)
  useEffect(() => {
    if (isOpen && modalRef.current && backdropRef.current) {
      gsap.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.42, ease: "power2.out" }
      );

      gsap.fromTo(
        modalRef.current,
        {
          scale: 0.86,
          y: 28,
          opacity: 0.2,
          borderRadius: "28px",
        },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          borderRadius: "24px",
          duration: 0.5,
          ease: "power3.out",
        }
      );

      if (heroImageRef.current) {
        gsap.fromTo(
          heroImageRef.current,
          { scale: 1.08 },
          { scale: 1, duration: 0.6, ease: "power2.out" }
        );
      }

      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current.children,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.42,
            stagger: 0.05,
            delay: 0.12,
            ease: "power2.out",
          }
        );
      }
    }
  }, [isOpen, item?.id]);

  const handleClose = useCallback(() => {
    if (modalRef.current && backdropRef.current) {
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.28,
        ease: "power2.inOut",
      });
      gsap.to(modalRef.current, {
        scale: 0.9,
        y: 20,
        opacity: 0,
        duration: 0.28,
        ease: "power2.inOut",
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  }, [onClose]);

  if (!isOpen || !item) return null;

  const effective: MovieOrShow = enhanced
    ? {
        ...item,
        ...enhanced,
        backdropUrl: enhanced.backdropUrl || item.backdropUrl,
        posterUrl: enhanced.posterUrl || item.posterUrl,
        title: item.title || enhanced.title,
        year: item.year || enhanced.year,
        rating: item.rating || enhanced.rating,
        type: item.type || enhanced.type,
      }
    : item;

  const heroSrc = effective.backdropUrl || effective.posterUrl;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-lg p-3 sm:p-5"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] bg-brand-card rounded-3xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.95)] glass-modal flex flex-col will-change-transform"
      >
        {/* Hero image — Seamless continuation of the expanded card banner */}
        <div className="relative w-full flex-none bg-zinc-900 h-[32vh] min-h-[200px] max-h-[320px] overflow-hidden">
          <div ref={heroImageRef} className="relative w-full h-full">
            {heroSrc && (
              <Image
                src={heroSrc}
                alt={effective.title}
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 100vw, 900px"
                priority
              />
            )}
          </div>
          <div className="absolute inset-0 banner-overlay" />

          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label={_("common.close")}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 text-zinc-300 hover:text-white backdrop-blur-md hover:bg-black/85 transition-all cursor-pointer shadow-lg hover:scale-105"
          >
            <IconX className="h-5 w-5" />
          </button>

          {/* Bottom title overlay */}
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7 space-y-2">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
              {effective.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/90 font-semibold flex-wrap">
              {effective.rating && (
                <div className="flex items-center gap-1 text-amber-400 glass-badge px-2 py-0.5 rounded font-bold">
                  <IconStar className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{effective.rating}</span>
                </div>
              )}
              {effective.year && <span>{effective.year}</span>}
              {effective.duration && <span>• {effective.duration}</span>}
            </div>
          </div>
        </div>

        {/* Scrollable content with staggered entrance */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">

          {/* Buttons + synopsis */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => onWatch(item)}
                className="flex items-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-2.5 font-bold text-sm transition-all shadow-lg shadow-brand-primary/25 cursor-pointer hover:scale-105 active:scale-95"
              >
                <IconPlayerPlay className="h-4 w-4 fill-white" />
                {_("media.watch")}
              </button>

              <button
                onClick={() => {
                  handleClose();
                  const isTV = effective.type === "series" || effective.type === "anime";
                  router.push(isTV ? `/tv/${effective.id}` : `/media/${effective.id}`);
                }}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 font-bold text-sm transition-all cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md"
              >
                <IconInfoCircle className="h-4 w-4" />
                <span>Voir la fiche</span>
              </button>

              {user && (
                <button
                  onClick={() => setShowPlaylistModal(true)}
                  title="Enregistrer dans une playlist ou À regarder plus tard"
                  className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-cyan-400 hover:text-white px-4 py-2.5 font-bold text-sm transition-all cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md"
                >
                  <IconPlaylist className="h-4 w-4" />
                  <span>Enregistrer</span>
                </button>
              )}
            </div>

            {effective.synopsis ? (
              <p className="text-foreground/85 text-sm sm:text-base leading-relaxed line-clamp-4">
                {effective.synopsis}
              </p>
            ) : (
              <div className="h-12 rounded-xl bg-white/5 skeleton-loading" />
            )}

            {/* Meta inline */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-brand-text-muted">
              <span className="font-bold uppercase tracking-wider text-[10px] glass-badge px-2 py-0.5 rounded text-white">{effective.type}</span>
              {effective.cast && effective.cast.length > 0 && (
                <span className="truncate max-w-xs">{effective.cast.slice(0, 3).join(", ")}</span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {effective.genres && effective.genres.slice(0, 3).map((g) => (
                  <span key={g} className="rounded-lg glass-badge px-2 py-0.5 text-[10px] text-zinc-300">{g}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Episodes for series */}
          {effective.seasons && effective.seasons.filter(s => s.seasonNumber > 0).length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-text-muted">
                {_("watch.episodes")}
              </h3>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {effective.seasons.filter(s => s.seasonNumber > 0).map((season) => {
                  const now = new Date();
                  const hasEpisodes = (season.episodeCount ?? 0) > 0;
                  const hasAired = season.airDate ? new Date(season.airDate) <= now : hasEpisodes;
                  const isAvailable = hasEpisodes && hasAired;

                  return (
                    <button
                      key={season.id}
                      onClick={() => isAvailable && handleSeasonChange(season)}
                      className={`flex-none flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        !isAvailable
                          ? "text-zinc-500 border border-zinc-700 cursor-default opacity-50"
                          : activeSeason?.id === season.id
                            ? "bg-brand-primary text-white shadow-md shadow-brand-primary/30"
                            : "glass-button text-foreground/80 hover:text-white"
                      }`}
                    >
                      <span>{season.name}</span>
                      {!isAvailable && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-amber-400/80 whitespace-nowrap">
                          Bientôt
                        </span>
                      )}
                      {isAvailable && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-none" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                {seasonLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={`ep-sk-${i}`} className="h-14 rounded-xl bg-white/5 skeleton-loading" />
                  ))
                ) : episodes.length === 0 ? (
                  <p className="text-xs text-brand-text-muted py-4 text-center">{_("watch.noEpisodesDesc")}</p>
                ) : (
                  episodes.map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => onWatch(item, ep)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <span className="text-brand-text-muted font-bold text-sm w-6 text-center">{ep.number}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate">{ep.title}</h4>
                        <p className="text-[11px] text-brand-text-muted">{ep.duration}</p>
                      </div>
                      <IconPlayerPlay className="h-4 w-4 text-brand-primary flex-none" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {showPlaylistModal && effective && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          media={{
            tmdbId: String(effective.id),
            mediaType: effective.type === "series" ? "series" : effective.type === "anime" ? "anime" : "movie",
            title: effective.title,
            posterPath: effective.posterUrl,
            backdropPath: effective.backdropUrl,
          }}
        />
      )}
    </div>
  );
}
