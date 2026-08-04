"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { MovieOrShow, Season, Episode } from "@/app/mockData";
import { getSeasonDetails, getMediaDetails } from "@/app/api";
import { IconX, IconPlayerPlay, IconStar } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";

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
  onOpenDetails,
}: MovieModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  // Détails TMDB complets chargés en arrière-plan. Tant qu'on n'a pas cette
  // donnée, on affiche les champs partiels du card (item). Une fois reçu,
  // `effective` combine les deux : immédiat + enrichi.
  const [enhanced, setEnhanced] = useState<MovieOrShow | null>(null);
  const { translate: _ } = useLanguage();

  // Lock body scroll while open. Decoupled from data loading so closing the
  // modal unmounts the lock immediately even if a season fetch is in flight.
  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    return () => releaseModalScrollLock();
  }, [isOpen]);

  // Reset transient state when the modal closes (or swaps item).
  useEffect(() => {
    if (!isOpen) {
      setActiveSeason(null);
      setEpisodes([]);
      setSeasonLoading(false);
      setEnhanced(null);
    }
  }, [isOpen, item?.id]);

  // Fetch des détails complets dès l'ouverture de la modale.
  // La card ne contient que les champs "list" (TMDB trending/popular) — il
  // manque typiquement cast, saisons, trailer, synopsis long. La modale doit
  // afficher quelque chose immédiatement, puis s'enrichir silencieusement.
  useEffect(() => {
    if (!isOpen || !item) return;
    const controller = new AbortController();
    const isTV = item.type === "series" || item.type === "anime";
    getMediaDetails(item.id, isTV, controller.signal)
      .then(full => {
        if (full && !controller.signal.aborted) setEnhanced(full);
      })
      .catch(() => { /* silencieux : le partial reste affiché */ });
    return () => controller.abort();
  }, [isOpen, item?.id, item?.type]);

  // Combine les données immédiates (item) avec les détails enrichis (enhanced).
  // enhanced.backdropUrl/posterUrl ne s'appliquent que si non vide (sinon on garde item).
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

  // Fetch the first season's episodes when the modal opens on a series.
  // Stable identity via useCallback so the effect doesn't re-fire on every render.
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

  // Auto-load first season only when opening on a series (separated from the
  // reset effect so the two never trigger setState on the same render).
  useEffect(() => {
    if (isOpen && item?.seasons && item.seasons.length > 0 && !activeSeason) {
      handleSeasonChange(item.seasons[0]);
    }
    // handleSeasonChange is intentionally omitted: its identity is stable per
    // item.id, and including it would re-fire the effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item?.id, activeSeason, handleSeasonChange]);

  if (!isOpen || !item) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[85vh] bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-2xl glass-modal flex flex-col"
      >

        {/* Hero image */}
        <div className="relative w-full flex-none bg-zinc-900 h-[30vh] min-h-[180px] max-h-[280px]">
          <Image
            src={effective.backdropUrl}
            alt={effective.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 900px"
            priority
          />
          <div className="absolute inset-0 banner-overlay" />

          <button
            onClick={onClose}
            aria-label={_("common.close")}
            className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 text-zinc-400 hover:text-white border border-white/10 hover:bg-black/85 transition-colors"
          >
            <IconX className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 space-y-2">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              {effective.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/80 font-semibold">
              <span>{effective.year}</span>
              <span>•</span>
              <span>{effective.duration}</span>
              <span>•</span>
              <div className="flex items-center gap-0.5 text-amber-400">
                <IconStar className="h-3.5 w-3.5 fill-amber-400" />
                <span>{effective.rating}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

          {/* Buttons + synopsis */}
          <div className="space-y-4">
            <button
              onClick={() => onWatch(item)}
              className="flex items-center gap-2 rounded-full bg-brand-primary hover:bg-brand-primary/90 text-white px-5 py-2 font-bold text-sm transition-all shadow-lg shadow-brand-primary/20"
            >
              <IconPlayerPlay className="h-4 w-4" />
              {_("media.watch")}
            </button>

            {effective.synopsis ? (
              <p className="text-foreground/80 text-sm leading-relaxed line-clamp-4">
                {effective.synopsis}
              </p>
            ) : (
              <div className="h-12 rounded-md bg-white/5 skeleton-loading" />
            )}

            {/* Meta inline */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-brand-text-muted">
              <span className="font-bold uppercase tracking-wider text-[10px]">{effective.type}</span>
              {effective.cast.length > 0 && (
                <span className="truncate max-w-xs">{effective.cast.slice(0, 3).join(", ")}</span>
              )}
              <div className="flex flex-wrap gap-1">
                {effective.genres.slice(0, 3).map((g) => (
                  <span key={g} className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px]">{g}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Episodes for series */}
          {effective.seasons && effective.seasons.filter(s => s.seasonNumber > 0).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-text-muted">
                {_("watch.episodes")}
              </h3>

              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {effective.seasons.filter(s => s.seasonNumber > 0).map((season) => {
                  const now = new Date();
                  const hasEpisodes = (season.episodeCount ?? 0) > 0;
                  const hasAired = season.airDate ? new Date(season.airDate) <= now : hasEpisodes;
                  const isAvailable = hasEpisodes && hasAired;

                  return (
                    <button
                      key={season.id}
                      onClick={() => isAvailable && handleSeasonChange(season)}
                      className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        !isAvailable
                          ? "text-zinc-500 border border-zinc-700 cursor-default"
                          : activeSeason?.id === season.id
                            ? "bg-brand-primary text-white"
                            : "text-foreground/70 hover:bg-white/5 border border-white/10"
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

              <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1">
                {seasonLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={`ep-sk-${i}`} className="h-14 rounded-lg bg-white/5 skeleton-loading" />
                  ))
                ) : episodes.length === 0 ? (
                  <p className="text-xs text-brand-text-muted py-4 text-center">{_("watch.noEpisodesDesc")}</p>
                ) : (
                  episodes.map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => onWatch(item, ep)}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
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
    </div>
  );
}
