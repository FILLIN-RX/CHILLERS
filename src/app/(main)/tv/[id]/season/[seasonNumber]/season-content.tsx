"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSeasonDetails, getMediaDetails, getStreamUrl, getPopularTV } from "@/services/media";
import type { Episode, MovieOrShow } from "@/types/media";
import VideoPlayer from "@/components/VideoPlayer";
import MovieCard from "@/components/MovieCard";
import ScrollRow from "@/components/ScrollRow";
import SeriesDownloadModal from "@/features/downloads/SeriesDownloadModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import NotificationModal from "@/components/NotificationModal";
import AuthModal from "@/components/AuthModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import Button from "@/components/Button";
import NetflixDownloadButton from "@/components/NetflixDownloadButton";
import CardImage from "@/components/CardImage";
import {
  ArrowLeft,
  Play,
  Star,
  Clock,
  CalendarBlank,
  FilmSlate,
  DownloadSimple,
  ShareNetwork,
  CaretDown,
  CaretCircleRight,
  CaretCircleLeft,
  BookmarkSimple,
  Check,
  LinkSimple,
  Translate,
} from "@phosphor-icons/react";

export default function SeasonContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, updateUser } = useAuthStore();
  const { translate: _ } = useLanguage();

  const id = params?.id as string;
  const seasonNumber = params?.seasonNumber as string;
  const currentSeasonNum = parseInt(seasonNumber) || 1;
  const targetEpNumber = searchParams?.get("ep") ? Number(searchParams.get("ep")) : 1;
  const initialLang = (searchParams?.get("lang") === "vostfr" ? "vostfr" : "fr") as "fr" | "vostfr";

  const [detailItem, setDetailItem] = useState<MovieOrShow | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioVersion, setAudioVersion] = useState<"fr" | "vostfr">(initialLang);
  const [streamUrl, setStreamUrl] = useState("");
  /** Referer CDN du flux direct (HLS Uqload/Vidzy) — transmis à VideoPlayer. */
  const [streamReferer, setStreamReferer] = useState<string | null>(null);
  /**
   * Applique un stream résolu : priorité à l'URL directe (HLS/MP4) pour que
   * VideoPlayer joue le flux natif au lieu de l'iframe embed (avec pubs).
   */
  const applyStream = (
    stream: { embedUrl: string; directUrl?: string | null; referer?: string | null } | null,
  ): boolean => {
    const url = stream?.directUrl || stream?.embedUrl;
    if (!url) return false;
    setStreamUrl(url);
    setStreamReferer(stream?.referer ?? null);
    return true;
  };
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamUnavailable, setStreamUnavailable] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [similar, setSimilar] = useState<MovieOrShow[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals state
  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [selectedDownloadEpisode, setSelectedDownloadEpisode] = useState<Episode | null>(null);
  const [showBatchDownload, setShowBatchDownload] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const playerRef = useRef<HTMLDivElement>(null);

  const isFavorite = user?.favorites?.some(
    (f) => f.tmdbId === String(id) && (f.mediaType === "series" || f.mediaType === "anime")
  );

  // Sync fullscreen state
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Initialisation parallèle de la saison, des métadonnées et du stream
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const signal = controller.signal;
    let cancelled = false;

    setIsLoading(true);
    setStreamLoading(true);
    setStreamUnavailable(false);

    (async () => {
      try {
        const [seasonData, detail, popularList] = await Promise.all([
          getSeasonDetails(id, seasonNumber, signal),
          getMediaDetails(id, true, signal),
          getPopularTV(1).catch(() => []),
        ]);

        if (cancelled) return;

        if (detail) {
          setDetailItem(detail);
          setShowTitle(detail.title);
        }

        if (popularList && popularList.length > 0) {
          setSimilar(popularList.filter((m) => m.id !== id).slice(0, 14));
        }

        if (seasonData && seasonData.episodes && seasonData.episodes.length > 0) {
          const mapped: Episode[] = seasonData.episodes.map((ep: any) => ({
            id: String(ep.id),
            title: ep.name || `${_("media.episode")} ${ep.episode_number}`,
            duration: `${ep.runtime || 24}m`,
            number: ep.episode_number,
            season: currentSeasonNum,
            thumbnail: ep.still_path
              ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
              : detail?.backdropUrl || "",
            synopsis: ep.overview || "",
          }));
          setEpisodes(mapped);

          let startIdx = 0;
          if (targetEpNumber) {
            const foundIdx = mapped.findIndex((e) => e.number === targetEpNumber);
            if (foundIdx !== -1) startIdx = foundIdx;
          }
          setCurrentIndex(startIdx);

          const epToPlay = mapped[startIdx];
          if (epToPlay) {
            const stream = await getStreamUrl(
              id,
              "series",
              currentSeasonNum,
              epToPlay.number,
              detail?.title || id,
              signal,
              (detail as any)?.originalTitle || (detail as any)?.original_title,
              detail?.releaseDate,
              detail?.year,
              initialLang
            );
            if (cancelled) return;
            if (stream?.embedUrl) {
              applyStream(stream);
              setStreamUnavailable(false);
            } else {
              setStreamUnavailable(true);
            }
          }
        } else {
          // Si pas d'épisodes, vérifier si c'est un film
          const movieDetail = await getMediaDetails(id, false, signal);
          if (movieDetail && movieDetail.id) {
            router.replace(`/watch/${id}?type=movie`);
            return;
          }
          setStreamUnavailable(true);
        }
      } catch (err: any) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Failed to load season", err);
          setStreamUnavailable(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setStreamLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, seasonNumber, targetEpNumber, initialLang, currentSeasonNum, router, _]);

  const currentEpisode = episodes[currentIndex];

  // Chargement / changement d'épisode
  const playEpisode = useCallback(
    async (idx: number) => {
      const ep = episodes[idx];
      if (!ep) return;
      setCurrentIndex(idx);
      setStreamLoading(true);
      setStreamUrl("");
      setStreamReferer(null);
      setStreamUnavailable(false);

      try {
        const stream = await getStreamUrl(
          id,
          "series",
          currentSeasonNum,
          ep.number,
          showTitle || id,
          undefined,
          (detailItem as any)?.originalTitle || (detailItem as any)?.original_title,
          detailItem?.releaseDate,
          detailItem?.year,
          audioVersion
        );
        if (!applyStream(stream)) {
          setStreamUnavailable(true);
        }

        window.history.replaceState(
          null,
          "",
          `/tv/${id}/season/${seasonNumber}?ep=${ep.number}&lang=${audioVersion}`
        );
      } catch (err) {
        console.error("Episode stream error:", err);
        setStreamUnavailable(true);
      } finally {
        setStreamLoading(false);
      }

      setTimeout(() => {
        playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    [episodes, id, seasonNumber, currentSeasonNum, showTitle, detailItem, audioVersion]
  );

  // Changement de saison via dropdown
  const handleSeasonChange = (newSeason: number) => {
    setSeasonLoading(true);
    router.push(`/tv/${id}/season/${newSeason}?ep=1&lang=${audioVersion}`);
  };

  // Changement de langue Audio (VF vs VOSTFR)
  const handleLanguageChange = useCallback(
    async (newLang: "fr" | "vostfr") => {
      if (newLang === audioVersion) return;
      setAudioVersion(newLang);
      setStreamLoading(true);
      setStreamUnavailable(false);
      setStreamUrl("");
      setStreamReferer(null);

      try {
        const ep = episodes[currentIndex];
        const stream = await getStreamUrl(
          id,
          "series",
          currentSeasonNum,
          ep?.number || 1,
          showTitle || id,
          undefined,
          (detailItem as any)?.originalTitle || (detailItem as any)?.original_title,
          detailItem?.releaseDate,
          detailItem?.year,
          newLang
        );
        if (!applyStream(stream)) {
          setStreamUnavailable(true);
        }
        window.history.replaceState(
          null,
          "",
          `/tv/${id}/season/${seasonNumber}?ep=${ep?.number || 1}&lang=${newLang}`
        );
      } catch (err) {
        console.error("Language switch stream error:", err);
        setStreamUnavailable(true);
      } finally {
        setStreamLoading(false);
      }
    },
    [audioVersion, currentIndex, episodes, id, seasonNumber, currentSeasonNum, showTitle, detailItem]
  );

  // Navigation Épisodes Suivant / Précédent
  const playNextEpisode = useCallback(() => {
    if (currentIndex < episodes.length - 1) {
      playEpisode(currentIndex + 1);
    }
  }, [currentIndex, episodes.length, playEpisode]);

  const playPrevEpisode = useCallback(() => {
    if (currentIndex > 0) {
      playEpisode(currentIndex - 1);
    }
  }, [currentIndex, playEpisode]);

  // Toggle Favoris
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !user || !detailItem) {
      setIsAuthModalOpen(true);
      return;
    }
    setFavoriteLoading(true);
    try {
      const res = await userService.toggleFavorite(token, {
        mediaType: detailItem.type === "anime" ? "anime" : "series",
        tmdbId: String(detailItem.id),
        title: detailItem.title,
        posterPath: detailItem.posterUrl,
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

  // Partage
  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: showTitle ? `Regardez ${showTitle} sur CHILLERS` : "CHILLERS",
          url,
        });
        return;
      } catch {}
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setNotification({
        title: _("watch.linkCopied") || "Lien copié !",
        message: _("watch.linkCopiedDesc") || "Le lien a été copié dans votre presse-papiers.",
      });
    } catch {}
  };

  const handleDownloadSingle = (ep?: Episode) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedDownloadEpisode(ep || currentEpisode || null);
    setShowSingleDownload(true);
  };

  const validSeasons = detailItem?.seasons?.filter((s) => s.seasonNumber > 0) || [];

  const playerItem: MovieOrShow | null = detailItem
    ? currentEpisode
      ? {
          ...detailItem,
          title: `${detailItem.title} · S${currentSeasonNum}E${currentEpisode.number}`,
          backdropUrl: currentEpisode.thumbnail || detailItem.backdropUrl,
          videoUrl: streamUrl,
        }
      : { ...detailItem, videoUrl: streamUrl }
    : null;

  const showPlayerSkeleton = (streamLoading || !playerItem) && !streamUnavailable;
  const hasEpisodes = episodes.length > 0;

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <div
        className={`pt-[64px] sm:pt-[70px] pb-16 sm:pb-20 lg:pb-24 ${
          hasEpisodes ? "lg:pr-[26rem] xl:pr-[28rem]" : ""
        }`}
      >
        {/* Main Video Player Section */}
        <div ref={playerRef} className="w-full bg-black">
          <div className="w-full relative mx-auto">
            {streamUnavailable ? (
              <div className="w-full min-h-[220px] sm:min-h-[360px] aspect-video max-h-[75dvh] flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950/90">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50">
                  <FilmSlate className="h-8 w-8 sm:h-10 sm:w-10 text-zinc-500" />
                </div>
                <div className="text-center max-w-md space-y-2">
                  <h3 className="text-base sm:text-xl font-bold text-white">
                    {_("media.comingSoon") || "Bientôt disponible"}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    {_("media.comingSoonDesc") || "Ce contenu sera disponible en streaming très prochainement."}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 border border-brand-primary/20">
                  <svg
                    className="animate-pulse h-3 w-3 text-brand-primary"
                    viewBox="0 0 8 8"
                    fill="currentColor"
                  >
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                    {_("media.comingSoon") || "En cours de synchronisation"}
                  </span>
                </div>
              </div>
            ) : showPlayerSkeleton ? (
              <div className="w-full min-h-[220px] sm:min-h-[360px] aspect-video max-h-[75dvh] flex flex-col items-center justify-center gap-3 text-zinc-500 bg-zinc-950">
                <div className="animate-spin h-8 w-8 sm:h-10 sm:w-10 border-4 border-brand-primary border-t-transparent rounded-full" />
                <p className="text-[10px] sm:text-xs uppercase tracking-widest font-bold">
                  {seasonLoading
                    ? _("media.loadingEpisodes") || "Chargement des épisodes…"
                    : _("media.loadingStream") || "Chargement du flux…"}
                </p>
              </div>
            ) : (
              <>
                <VideoPlayer
                  key={`${currentEpisode?.id ?? id}-${streamUrl}-${audioVersion}`}
                  item={playerItem!}
                  episode={currentEpisode}
                  audioVersion={audioVersion}
                  streamReferer={streamReferer}
                  onLanguageChange={handleLanguageChange}
                  onBack={() => router.push(`/tv/${id}`)}
                  onOpenDetails={() => router.push(`/tv/${id}`)}
                />
                {isFullscreen && (
                  <span className="pointer-events-none absolute top-4 left-4 z-50 text-xs sm:text-sm font-black tracking-widest uppercase text-[brand-primary] drop-shadow-lg">
                    CHILLERS
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Media Details & Controls */}
        <div className="mt-3 sm:mt-6 space-y-3 sm:space-y-5 px-3 sm:px-6 md:px-10 lg:px-[3%]">
          {/* Series Episode Switcher Quick Bar */}
          {hasEpisodes && (
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-xl bg-zinc-900/80 border border-white/5 backdrop-blur-md">
              <button
                onClick={playPrevEpisode}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 cursor-pointer"
              >
                <CaretCircleLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{_("common.previous") || "Précédent"}</span>
              </button>

              <div className="text-center truncate px-1 flex-1 min-w-0">
                <span className="text-[10px] sm:text-xs font-bold text-brand-primary uppercase tracking-wider block">
                  S{currentSeasonNum} · E{currentEpisode?.number || 1}
                </span>
                <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] xs:max-w-[240px] sm:max-w-md mx-auto">
                  {currentEpisode?.title}
                </p>
              </div>

              <button
                onClick={playNextEpisode}
                disabled={currentIndex >= episodes.length - 1}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 cursor-pointer"
              >
                <span className="hidden sm:inline">{_("common.next") || "Suivant"}</span>
                <CaretCircleRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Title Header */}
          {detailItem ? (
            <div className="space-y-1">
              <span className="text-brand-primary font-black tracking-widest text-[9px] sm:text-xs uppercase">
                CHILLERS SÉRIE
              </span>

              <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight break-words">
                {showTitle}
              </h1>

              {currentEpisode && (
                <p className="text-zinc-400 text-[11px] sm:text-sm font-medium flex items-center gap-1.5 flex-wrap">
                  <span className="text-white font-bold">
                    S{currentSeasonNum} · E{currentEpisode.number}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300 truncate max-w-[200px] sm:max-w-md">
                    {currentEpisode.title}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-20 bg-zinc-800 rounded" />
              <div className="h-7 w-2/3 bg-zinc-800 rounded-lg" />
            </div>
          )}

          {/* Metadata Badges */}
          {detailItem ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-zinc-400 font-medium">
              {detailItem.rating > 0 && (
                <span className="text-brand-primary font-bold flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-brand-primary" />
                  {Math.round(detailItem.rating * 10)}%
                </span>
              )}
              {detailItem.year > 0 && (
                <span className="flex items-center gap-1">
                  <CalendarBlank className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-zinc-500" />
                  {detailItem.year}
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] sm:text-[10px] uppercase font-bold text-zinc-200">
                HD
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-zinc-500" />
                {currentEpisode ? currentEpisode.duration : detailItem.duration}
              </span>
              {validSeasons.length > 0 && (
                <span className="text-[11px] sm:text-xs text-zinc-400">
                  {validSeasons.length} saison{validSeasons.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          ) : null}

          {/* Action Download Buttons */}
          {detailItem ? (
            <div className="flex items-center gap-2 sm:gap-2.5 py-1 flex-wrap sm:flex-nowrap">
              <NetflixDownloadButton
                tmdbId={id}
                type="series"
                season={currentSeasonNum}
                episodeNumber={currentEpisode?.number}
                title="Télécharger l'épisode"
                onClick={() => handleDownloadSingle(currentEpisode)}
                className="flex-1 min-w-[140px] justify-center"
              />

              <Button
                onClick={() => {
                  if (!user) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setShowBatchDownload(true);
                }}
                variant="primary"
                size="md"
                text={_("download.series") || "Télécharger la saison"}
                leftIcon={<DownloadSimple className="h-4 w-4" />}
                ariaLabel={_("download.series") || "Télécharger la saison"}
                className="flex-1 min-w-[140px]"
              />

              {user && (
                <Button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  variant={isFavorite ? "primary" : "outline"}
                  size="icon"
                  ariaLabel={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  icon={<BookmarkSimple className="w-4 h-4" />}
                />
              )}

              <Button
                onClick={handleShare}
                variant="outline"
                size="icon"
                ariaLabel="Partager la série"
                icon={<ShareNetwork className="w-4 h-4" />}
              />
            </div>
          ) : null}

          {/* Synopsis */}
          {(currentEpisode?.synopsis || detailItem?.synopsis || detailItem?.description) && (
            <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed max-w-3xl">
              {currentEpisode?.synopsis || detailItem?.synopsis || detailItem?.description}
            </p>
          )}

          {/* Cast */}
          {detailItem?.cast && detailItem.cast.length > 0 && detailItem.cast[0] !== "Cast Info Unavailable" && (
            <div className="text-[11px] sm:text-sm text-zinc-400">
              <span className="text-zinc-500 font-semibold">{_("media.cast") || "Distribution"}: </span>
              {detailItem.cast.join(", ")}
            </div>
          )}
        </div>

        {/* Mobile & Tablet Series Episode List */}
        {hasEpisodes && (
          <section className="lg:hidden mt-6 sm:mt-8 px-4 sm:px-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-brand-primary" />
                {_("media.episodes") || "Épisodes"}
              </h2>

              {/* Mobile Season Picker */}
              {validSeasons.length > 1 && (
                <div className="relative">
                  <select
                    value={currentSeasonNum}
                    onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                    className="appearance-none bg-zinc-800 text-white font-bold text-[11px] sm:text-xs py-1.5 pl-3 pr-8 rounded-lg border border-white/10 focus:outline-none focus:border-brand-primary"
                  >
                    {validSeasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {s.name || `S${s.seasonNumber}`} ({s.episodeCount || 10} ép.)
                      </option>
                    ))}
                  </select>
                  <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {episodes.map((ep, idx) => (
                <EpisodeCard
                  key={ep.id}
                  ep={ep}
                  active={idx === currentIndex}
                  onClick={() => playEpisode(idx)}
                  onDownload={() => handleDownloadSingle(ep)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Similar / Recommendations Section */}
        {similar.length > 0 && (
          <section className="mt-8 sm:mt-12 px-4 sm:px-6 md:px-10 lg:px-[3%] space-y-3 sm:space-y-4">
            <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2 sm:gap-3">
              <span className="h-4 sm:h-5 w-1 rounded-full bg-brand-primary" />
              {_("media.youMightAlsoLike") || "Vous aimerez aussi"}
            </h2>
            <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {similar.map((sim) => (
                <MovieCard
                  key={sim.id}
                  item={sim}
                  variant="grid-poster"
                  onPlay={(i) => router.push(`/tv/${i.id}/season/1?ep=1`)}
                  onOpenDetails={(i) => router.push(`/tv/${i.id}`)}
                />
              ))}
            </div>
            <div className="sm:hidden">
              <ScrollRow title="" accentColor="primary" className="space-y-0">
                {similar.map((sim) => (
                  <MovieCard
                    key={sim.id}
                    item={sim}
                    variant="poster"
                    onPlay={(i) => router.push(`/tv/${i.id}/season/1?ep=1`)}
                    onOpenDetails={(i) => router.push(`/tv/${i.id}`)}
                  />
                ))}
              </ScrollRow>
            </div>
          </section>
        )}
      </div>

      {/* ─── Desktop Persistent Right Sidebar (PC Only) ─── */}
      {hasEpisodes && (
        <aside className="hidden lg:block fixed top-[64px] sm:top-[70px] right-0 w-[26rem] xl:w-[28rem] h-[calc(100dvh-64px)] sm:h-[calc(100dvh-70px)] bg-[#0c0c0e]/98 backdrop-blur-2xl border-l border-white/5 overflow-y-auto p-4 z-30 space-y-3">
          {/* Season Selector Dropdown */}
          <div className="sticky top-0 bg-[#0c0c0e] backdrop-blur-md pb-3 pt-1 z-30 border-b border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="h-3 w-1 rounded-full bg-brand-primary" />
                Épisodes ({episodes.length})
              </h3>
            </div>

            {validSeasons.length > 1 && (
              <div className="relative">
                <select
                  value={currentSeasonNum}
                  onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                  className="w-full appearance-none bg-zinc-800/90 text-white font-bold text-sm py-2.5 pl-3.5 pr-10 rounded-xl border border-white/10 hover:border-white/20 focus:outline-none focus:border-brand-primary transition-all cursor-pointer"
                >
                  {validSeasons.map((s) => (
                    <option key={s.seasonNumber} value={s.seasonNumber} className="bg-zinc-900 text-white">
                      {s.name || `Saison ${s.seasonNumber}`} ({s.episodeCount || 10} épisodes)
                    </option>
                  ))}
                </select>
                <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Desktop Episode Cards */}
          <div className="space-y-2.5 pb-8">
            {episodes.map((ep, idx) => (
              <EpisodeCard
                key={ep.id}
                ep={ep}
                active={idx === currentIndex}
                onClick={() => playEpisode(idx)}
                onDownload={() => handleDownloadSingle(ep)}
              />
            ))}
          </div>
        </aside>
      )}

      {/* Modals */}
      {notification && (
        <NotificationModal
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          title={notification.title}
          message={notification.message}
        />
      )}

      {detailItem && (
        <SeriesDownloadModal
          isOpen={showBatchDownload}
          onClose={() => setShowBatchDownload(false)}
          seriesTitle={showTitle || `Saison ${seasonNumber}`}
          tmdbId={id}
          episodes={episodes}
          initialLanguage={audioVersion}
        />
      )}

      {detailItem && (
        <DownloadModal
          isOpen={showSingleDownload}
          onClose={() => {
            setShowSingleDownload(false);
            setSelectedDownloadEpisode(null);
          }}
          title={`${showTitle || `Saison ${seasonNumber}`} · S${seasonNumber}E${selectedDownloadEpisode?.number || currentEpisode?.number || 1}`}
          id={id}
          type="series"
          season={currentSeasonNum}
          episode={selectedDownloadEpisode?.number || currentEpisode?.number || 1}
          posterUrl={selectedDownloadEpisode?.thumbnail || currentEpisode?.thumbnail || detailItem.posterUrl}
          backdropUrl={selectedDownloadEpisode?.thumbnail || currentEpisode?.thumbnail || detailItem.backdropUrl}
          initialLanguage={audioVersion}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

function EpisodeCard({
  ep,
  active,
  onClick,
  onDownload,
}: {
  ep: Episode;
  active: boolean;
  onClick: () => void;
  onDownload?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all border ${
        active
          ? "bg-zinc-800/80 border-brand-primary/40 shadow-lg"
          : "bg-white/[0.02] hover:bg-white/[0.06] border-transparent"
      }`}
    >
      <div className="flex-none w-24 sm:w-28 md:w-32 aspect-video rounded-lg overflow-hidden bg-zinc-800 relative">
        <CardImage
          src={ep.thumbnail}
          alt={ep.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="128px"
          fallbackText={`Épisode ${ep.number}`}
        />
        {active && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-primary flex items-center justify-center shadow-lg">
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-1">
          <h4
            className={`text-[11px] sm:text-sm font-bold line-clamp-1 leading-snug ${
              active ? "text-brand-primary" : "text-white group-hover:text-zinc-200"
            }`}
          >
            {ep.number}. {ep.title}
          </h4>

          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              aria-label={`Download ${ep.title}`}
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex-none"
            >
              <DownloadSimple className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>

        <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5">
          {ep.duration}
        </span>

        {ep.synopsis && (
          <p className="text-[10px] sm:text-[11px] text-zinc-500 line-clamp-2 leading-tight mt-0.5">
            {ep.synopsis}
          </p>
        )}
      </div>
    </div>
  );
}
