"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  getMediaDetails,
  getSeasonDetails,
  getStreamUrl,
  getMovieRecommendations,
  getPopularMovies,
  getPopularTV,
} from "@/services/media";
import type { MovieOrShow, Episode } from "@/types/media";
import VideoPlayer from "@/components/VideoPlayer";
import NotificationModal from "@/components/NotificationModal";
import AuthModal from "@/components/AuthModal";
import SeriesDownloadModal from "@/features/downloads/SeriesDownloadModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import MovieCard from "@/components/MovieCard";
import ScrollRow from "@/components/ScrollRow";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import { PopupFirewall } from "@/lib/PopupFirewall";
import Button from "@/components/Button";
import CardImage from "@/components/CardImage";
import { ArrowLeft, Play, Star, Clock, CalendarBlank, FilmSlate, DownloadSimple, ShareNetwork, CaretDown, CaretCircleRight, CaretCircleLeft } from "@phosphor-icons/react";

interface WatchContentProps {
  initialItem?: MovieOrShow | null;
  initialSeasonData?: any;
  initialStreamUrl?: string | null;
  initialStreamUnavailable?: boolean;
}

function WatchContent({ initialItem, initialSeasonData, initialStreamUrl, initialStreamUnavailable }: WatchContentProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const { token, user, updateUser } = useAuthStore();

  const id = params?.id as string;
  const typeParam = searchParams?.get("type");
  const isTV =
    typeParam === "tv" ||
    typeParam === "series" ||
    typeParam === "anime";
  const initialSeasonParam = searchParams?.get("season") || "1";
  const initialEpisodeParam = searchParams?.get("episode") || "1";

  const [item, setItem] = useState<MovieOrShow | null>(initialItem || null);
  const [currentSeason, setCurrentSeason] = useState<number>(parseInt(initialSeasonParam) || 1);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl || "");
  const [streamLoading, setStreamLoading] = useState(!initialStreamUrl && !initialStreamUnavailable);
  const [streamUnavailable, setStreamUnavailable] = useState(initialStreamUnavailable || false);
  const [isUnreleased, setIsUnreleased] = useState(false);
  const [unreleasedDate, setUnreleasedDate] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(!initialItem);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const [similar, setSimilar] = useState<MovieOrShow[]>([]);

  // Modals state
  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [selectedDownloadEpisode, setSelectedDownloadEpisode] = useState<Episode | null>(null);
  const [showBatchDownloadModal, setShowBatchDownloadModal] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);

  const playerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const currentEpisode = episodes[currentEpisodeIndex];

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Initialize episodes from initialSeasonData if available
  useEffect(() => {
    if (isTV && initialSeasonData?.episodes?.length) {
      const targetEp = parseInt(initialEpisodeParam) || 1;
      let startIdx = 0;
      const eps: Episode[] = initialSeasonData.episodes.map((ep: any, idx: number) => {
        if (targetEp && ep.episode_number === targetEp) startIdx = idx;
        return {
          id: String(ep.id),
          title: ep.name || `${_("media.episode")} ${ep.episode_number}`,
          duration: `${ep.runtime || 24}m`,
          number: ep.episode_number,
          season: currentSeason,
          thumbnail: ep.still_path
            ? `https://image.tmdb.org/t/p/w185${ep.still_path}`
            : "",
          synopsis: ep.overview || "",
        };
      });
      setEpisodes(eps);
      setCurrentEpisodeIndex(startIdx);
    }
  }, [initialSeasonData, isTV, initialEpisodeParam, currentSeason, _]);

  // Initial Load (Media Details + First Stream) if not provided
  useEffect(() => {
    if (!id || initialItem) return;
    const controller = new AbortController();
    const signal = controller.signal;
    let cancelled = false;
    setPageLoading(true);
    setStreamLoading(true);
    setStreamUrl("");

    (async () => {
      try {
        const detail = await getMediaDetails(id, isTV, signal);
        if (cancelled) return;
        if (detail) setItem(detail);

        // ── Early exit si le contenu n'est pas encore sorti ──
        if (detail?.releaseDate && new Date(detail.releaseDate).getTime() > Date.now()) {
          setIsUnreleased(true);
          setUnreleasedDate(detail.releaseDate);
          setStreamUnavailable(true);
          setStreamLoading(false);
          setSeasonLoading(false);
          return;
        }

        const originalTitle = (detail as any)?.originalTitle || (detail as any)?.original_title;

        if (isTV) {
          setSeasonLoading(true);
          const targetSeason = parseInt(initialSeasonParam) || 1;
          const targetEp = parseInt(initialEpisodeParam) || 1;
          setCurrentSeason(targetSeason);

          const seasonDataPromise = getSeasonDetails(id, String(targetSeason), signal);
          const firstStreamPromise = getStreamUrl(
            id,
            "series",
            targetSeason,
            targetEp,
            detail?.title || id,
            signal,
            originalTitle,
            detail?.releaseDate,
            detail?.year,
          );

          const [seasonData, firstStream] = await Promise.all([
            seasonDataPromise,
            firstStreamPromise,
          ]);
          if (cancelled) return;

          if (seasonData?.episodes?.length) {
            let startIdx = 0;
            const eps: Episode[] = seasonData.episodes.map((ep: any, idx: number) => {
              if (targetEp && ep.episode_number === targetEp) startIdx = idx;
              return {
                id: String(ep.id),
                title: ep.name || `${_("media.episode")} ${ep.episode_number}`,
                duration: `${ep.runtime || 24}m`,
                number: ep.episode_number,
                season: targetSeason,
                thumbnail: ep.still_path
                  ? `https://image.tmdb.org/t/p/w185${ep.still_path}`
                  : "",
                synopsis: ep.overview || "",
              };
            });
            setEpisodes(eps);
            setCurrentEpisodeIndex(startIdx);
          }

          let stream = firstStream;
          if (!stream && targetSeason !== 1) {
            stream = await getStreamUrl(
              id,
              "series",
              1,
              1,
              detail?.title || id,
              signal,
              originalTitle,
              detail?.releaseDate,
              detail?.year,
            );
          }
          if (!cancelled) {
            if (stream?.unreleased) {
              setIsUnreleased(true);
              setUnreleasedDate(stream.releaseDate || detail?.releaseDate || null);
              setStreamUnavailable(true);
            } else if (stream) {
              setStreamUrl(stream.embedUrl);
            } else {
              setStreamUnavailable(true);
            }
          }
          setSeasonLoading(false);
        } else {
          const stream = await getStreamUrl(
            id,
            "movie",
            undefined,
            undefined,
            detail?.title || id,
            signal,
            originalTitle,
            detail?.releaseDate,
            detail?.year,
          );
          if (!cancelled) {
            if (stream?.unreleased) {
              setIsUnreleased(true);
              setUnreleasedDate(stream.releaseDate || detail?.releaseDate || null);
              setStreamUnavailable(true);
            } else if (stream) {
              setStreamUrl(stream.embedUrl);
            } else {
              setStreamUnavailable(true);
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Watch page load error:", err);
      } finally {
        if (!cancelled) {
          setPageLoading(false);
          setStreamLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, isTV, initialSeasonParam, initialEpisodeParam, initialItem, _]);

  // Record into Watch History when media is ready
  useEffect(() => {
    if (!token || !item) return;
    userService.markAsWatched(token, {
      tmdbId: String(item.id),
      mediaType: isTV ? "series" : "movie",
      season: currentEpisode?.season || (isTV ? currentSeason : undefined),
      episode: currentEpisode?.number,
      title: item.title,
      posterPath: item.posterUrl,
    }).then((res) => {
      if (res?.success && res.watchHistory) {
        updateUser({ watchHistory: res.watchHistory });
      }
    }).catch(console.error);
  }, [token, item?.id, isTV, currentSeason, currentEpisode?.number, item?.title, item?.posterUrl, updateUser]);

  // Load Similar Content
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const signal = controller.signal;

    const loadSimilar = async () => {
      try {
        if (isTV) {
          const list = await getPopularTV(1, signal);
          setSimilar(list.filter((m) => m.id !== id).slice(0, 10));
          return;
        }

        const recs = await getMovieRecommendations(id, signal);
        if (recs.length > 0) {
          setSimilar(recs.slice(0, 10));
          return;
        }

        const popular = await getPopularMovies(1, signal);
        setSimilar(popular.filter((m) => m.id !== id).slice(0, 10));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Watch similar content load error:", err);
      }
    };

    loadSimilar();
    return () => controller.abort();
  }, [id, isTV]);

  // Anti-popup firewall
  useEffect(() => {
    PopupFirewall.activate();

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (streamUrl && !streamUnavailable) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      PopupFirewall.deactivate();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [streamUrl, streamUnavailable]);

  // Switch Season Handler
  const handleSeasonChange = useCallback(
    async (newSeason: number) => {
      if (!id || newSeason === currentSeason) return;
      setCurrentSeason(newSeason);
      setSeasonLoading(true);
      setStreamLoading(true);
      setStreamUrl("");
      setStreamUnavailable(false);

      try {
        const seasonData = await getSeasonDetails(id, String(newSeason));
        if (seasonData?.episodes?.length) {
          const eps: Episode[] = seasonData.episodes.map((ep: any) => ({
            id: String(ep.id),
            title: ep.name || `${_("media.episode")} ${ep.episode_number}`,
            duration: `${ep.runtime || 24}m`,
            number: ep.episode_number,
            season: newSeason,
            thumbnail: ep.still_path
              ? `https://image.tmdb.org/t/p/w185${ep.still_path}`
              : "",
            synopsis: ep.overview || "",
          }));
          setEpisodes(eps);
          setCurrentEpisodeIndex(0);

          const firstEp = eps[0];
          const stream = await getStreamUrl(
            id,
            "series",
            newSeason,
            firstEp ? firstEp.number : 1,
            item?.title || id,
            undefined,
            (item as any)?.originalTitle || (item as any)?.original_title,
            item?.releaseDate,
            item?.year,
          );
          if (stream) {
            setStreamUrl(stream.embedUrl);
          } else {
            setStreamUnavailable(true);
          }

          // Update URL silently
          window.history.replaceState(
            null,
            "",
            `/watch/${id}?type=tv&season=${newSeason}&episode=${firstEp ? firstEp.number : 1}`
          );
        } else {
          setStreamUnavailable(true);
        }
      } catch (err) {
        console.error("Season switch error:", err);
        setStreamUnavailable(true);
      } finally {
        setSeasonLoading(false);
        setStreamLoading(false);
      }
    },
    [id, currentSeason, item, _]
  );

  // Play Specific Episode Handler
  const playEpisode = useCallback(
    async (idx: number) => {
      const ep = episodes[idx];
      if (!ep || !item) return;
      setCurrentEpisodeIndex(idx);
      setStreamLoading(true);
      setStreamUrl("");
      setStreamUnavailable(false);

      try {
        const stream = await getStreamUrl(
          id,
          "series",
          ep.season || currentSeason,
          ep.number,
          item.title || id,
          undefined,
          (item as any)?.originalTitle || (item as any)?.original_title,
          item?.releaseDate,
          item?.year,
        );
        if (stream) {
          setStreamUrl(stream.embedUrl);
        } else {
          setStreamUnavailable(true);
        }

        // Update URL silently
        window.history.replaceState(
          null,
          "",
          `/watch/${id}?type=tv&season=${ep.season || currentSeason}&episode=${ep.number}`
        );
      } catch (err) {
        console.error("Episode stream error:", err);
        setStreamUnavailable(true);
      } finally {
        setStreamLoading(false);
      }
      setTimeout(
        () => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100
      );
    },
    [episodes, id, item, currentSeason]
  );

  // Next / Prev Episode Navigation
  const playNextEpisode = useCallback(() => {
    if (currentEpisodeIndex < episodes.length - 1) {
      playEpisode(currentEpisodeIndex + 1);
    }
  }, [currentEpisodeIndex, episodes.length, playEpisode]);

  const playPrevEpisode = useCallback(() => {
    if (currentEpisodeIndex > 0) {
      playEpisode(currentEpisodeIndex - 1);
    }
  }, [currentEpisodeIndex, playEpisode]);

  const handleDownloadSingle = (ep?: Episode) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (ep) {
      setSelectedDownloadEpisode(ep);
    } else if (currentEpisode) {
      setSelectedDownloadEpisode(currentEpisode);
    } else {
      setSelectedDownloadEpisode(null);
    }
    setShowSingleDownload(true);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item ? `Regardez ${item.title} sur CHILLERS` : "CHILLERS",
          url,
        });
        return;
      } catch {}
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setNotification({
        title: _("watch.linkCopied"),
        message: _("watch.linkCopiedDesc"),
      });
    } catch {}
  };

  const availableSeasons = item?.seasons?.filter((s) => s.seasonNumber > 0) || [];

  const playerItem: MovieOrShow | null = item
    ? currentEpisode
      ? {
          ...item,
          title: `${item.title} · S${currentEpisode.season || currentSeason}E${currentEpisode.number}`,
          backdropUrl: currentEpisode.thumbnail || item.backdropUrl,
          videoUrl: streamUrl,
        }
      : { ...item, videoUrl: streamUrl }
    : null;

  const showPlayerSkeleton = (streamLoading || !playerItem) && !streamUnavailable;

  if (!pageLoading && !item) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-4 pt-16">
        <div className="text-center space-y-4 max-w-md">
          <FilmSlate className="h-16 w-16 text-zinc-700 mx-auto" />
          <h1 className="text-xl font-bold text-white">{_("watch.contentNotFound")}</h1>
          <p className="text-zinc-400 text-sm">
            {_("watch.contentNotFoundDesc")}
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="primary"
            size="md"
            text={_("watch.backToHome")}
          />
        </div>
      </div>
    );
  }

  const hasEpisodes = isTV && episodes.length > 0;

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
            {isUnreleased ? (
              <div className="w-full min-h-[240px] sm:min-h-[380px] aspect-video max-h-[75dvh] flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950/95 border-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600/15 flex items-center justify-center border-0 shadow-none">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
                </div>
                <div className="text-center max-w-md space-y-2">
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border-0 shadow-none">
                    Bientôt disponible
                  </span>
                  <h3 className="text-lg sm:text-2xl font-black text-white">
                    {item?.title || "Ce titre"} n'est pas encore sorti
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    {unreleasedDate
                      ? `La sortie officielle est prévue le ${new Date(unreleasedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Le contenu sera disponible en streaming sur CHILLERS peu après sa sortie.`
                      : "Ce contenu n'est pas encore disponible en streaming."}
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => router.back()}
                    className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="px-5 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-lg shadow-brand-primary/30 cursor-pointer"
                  >
                    Explorer les nouveautés
                  </button>
                </div>
              </div>
            ) : streamUnavailable ? (
              <div className="w-full min-h-[220px] sm:min-h-[360px] aspect-video max-h-[75dvh] flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950/90">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50">
                  <FilmSlate className="h-8 w-8 sm:h-10 sm:w-10 text-zinc-500" />
                </div>
                <div className="text-center max-w-md space-y-2">
                  <h3 className="text-base sm:text-xl font-bold text-white">
                    {_("media.comingSoon")}
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    {_("media.comingSoonDesc")}
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
                    {_("media.comingSoon")}
                  </span>
                </div>
              </div>
            ) : showPlayerSkeleton ? (
              <div className="w-full min-h-[220px] sm:min-h-[360px] aspect-video max-h-[75dvh] flex flex-col items-center justify-center gap-3 text-zinc-500 bg-zinc-950">
                <div className="animate-spin h-8 w-8 sm:h-10 sm:w-10 border-4 border-brand-primary border-t-transparent rounded-full" />
                <p className="text-[10px] sm:text-xs uppercase tracking-widest font-bold">
                  {seasonLoading
                    ? _("media.loadingEpisodes")
                    : _("media.loadingStream")}
                </p>
              </div>
            ) : (
              <>
                <VideoPlayer
                  key={`${currentEpisode?.id ?? item?.id ?? id}-${streamUrl}`}
                  item={playerItem!}
                  episode={currentEpisode}
                  onBack={() => router.back()}
                  onOpenDetails={(it) =>
                    router.push(
                      `/media/${it.id}?type=${
                        it.type === "series" || it.type === "anime" ? "tv" : "movie"
                      }`
                    )
                  }
                />
                {isFullscreen && (
                  <span className="pointer-events-none absolute top-4 left-4 z-50 text-xs sm:text-sm font-black tracking-widest uppercase text-[#D70466] drop-shadow-lg">
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
                disabled={currentEpisodeIndex === 0}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                <CaretCircleLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{_("common.previous")}</span>
              </button>

              <div className="text-center truncate px-1 flex-1 min-w-0">
                <span className="text-[10px] sm:text-xs font-bold text-brand-primary uppercase tracking-wider block">
                  S{currentSeason} · E{currentEpisode?.number || 1}
                </span>
                <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] xs:max-w-[240px] sm:max-w-md mx-auto">
                  {currentEpisode?.title}
                </p>
              </div>

              <button
                onClick={playNextEpisode}
                disabled={currentEpisodeIndex >= episodes.length - 1}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
              >
                <span className="hidden sm:inline">{_("common.next")}</span>
                <CaretCircleRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Title Header */}
          {/* Title Header */}
          {item ? (
            <div className="space-y-1">
              <span className="text-brand-primary font-black tracking-widest text-[9px] sm:text-xs uppercase">
                CHILLERS {isTV ? "SÉRIE" : "FILM"}
              </span>

              <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight break-words">
                {item.title}
              </h1>

              {currentEpisode && (
                <p className="text-zinc-400 text-[11px] sm:text-sm font-medium flex items-center gap-1.5 flex-wrap">
                  <span className="text-white font-bold">
                    S{currentSeason} · E{currentEpisode.number}
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
          {item ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[11px] sm:text-sm text-zinc-400 font-medium">
              {item.rating > 0 && (
                <span className="text-brand-primary font-bold flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-brand-primary" />
                  {Math.round(item.rating * 10)}%
                </span>
              )}
              {item.year > 0 && (
                <span className="flex items-center gap-1">
                  <CalendarBlank className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-zinc-500" />
                  {item.year}
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] sm:text-[10px] uppercase font-bold text-zinc-200">
                HD
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-zinc-500" />
                {currentEpisode ? currentEpisode.duration : item.duration}
              </span>
              {isTV && availableSeasons.length > 0 && (
                <span className="text-[11px] sm:text-xs text-zinc-400">
                  {availableSeasons.length} saison{availableSeasons.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          ) : null}

          {/* Action Download Buttons */}
          {item ? (
            <div className="flex items-center gap-2 sm:gap-2.5 py-1 flex-wrap sm:flex-nowrap">
              <Button
                onClick={() => handleDownloadSingle(currentEpisode)}
                disabled={streamUnavailable}
                variant="dark"
                size="md"
                text={_("download.single")}
                leftIcon={<DownloadSimple className="h-4 w-4 text-zinc-300" />}
                ariaLabel={_("download.single")}
                className="flex-1 min-w-[140px]"
              />

              {isTV ? (
                <Button
                  onClick={() => {
                    if (!user) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setShowBatchDownloadModal(true);
                  }}
                  variant="primary"
                  size="md"
                  text={_("download.series")}
                  leftIcon={<DownloadSimple className="h-4 w-4" />}
                  ariaLabel={_("download.series")}
                  className="flex-1 min-w-[140px]"
                />
              ) : (
                <Button
                  onClick={handleShare}
                  variant="outline"
                  size="md"
                  text={_("media.share")}
                  leftIcon={<ShareNetwork className="h-4 w-4" />}
                  ariaLabel={_("media.share")}
                  className="flex-1 min-w-[120px]"
                />
              )}
            </div>
          ) : null}

          {/* Synopsis */}
          {(currentEpisode?.synopsis || item?.synopsis || item?.description) && (
            <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed max-w-3xl">
              {currentEpisode?.synopsis || item?.synopsis || item?.description}
            </p>
          )}

          {/* Cast */}
          {item?.cast && item.cast.length > 0 && item.cast[0] !== "Cast Info Unavailable" && (
            <div className="text-[11px] sm:text-sm text-zinc-400">
              <span className="text-zinc-500 font-semibold">{_("media.cast")}: </span>
              {item.cast.join(", ")}
            </div>
          )}
        </div>

        {/* Mobile & Tablet Series Episode List */}
        {hasEpisodes && (
          <section className="lg:hidden mt-6 sm:mt-8 px-4 sm:px-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-brand-primary" />
                {_("media.episodes")}
              </h2>

              {/* Mobile Season Picker */}
              {availableSeasons.length > 1 && (
                <div className="relative">
                  <select
                    value={currentSeason}
                    onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                    className="appearance-none bg-zinc-800 text-white font-bold text-[11px] sm:text-xs py-1.5 pl-3 pr-8 rounded-lg border border-white/10 focus:outline-none focus:border-brand-primary"
                  >
                    {availableSeasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {s.name || `S${s.seasonNumber}`} ({s.episodeCount} ép.)
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
                  active={idx === currentEpisodeIndex}
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
              {_("media.youMightAlsoLike")}
            </h2>
            <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {similar.map((sim) => (
                <MovieCard
                  key={sim.id}
                  item={sim}
                  variant="grid-poster"
                  onPlay={(i) =>
                    router.push(
                      `/watch/${i.id}?type=${
                        i.type === "series" || i.type === "anime" ? "tv" : "movie"
                      }`
                    )
                  }
                  onOpenDetails={(i) =>
                    router.push(
                      `/media/${i.id}?type=${
                        i.type === "series" || i.type === "anime" ? "tv" : "movie"
                      }`
                    )
                  }
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
                    onPlay={(i) =>
                      router.push(
                        `/watch/${i.id}?type=${
                          i.type === "series" || i.type === "anime" ? "tv" : "movie"
                        }`
                      )
                    }
                    onOpenDetails={(i) =>
                      router.push(
                        `/media/${i.id}?type=${
                          i.type === "series" || i.type === "anime" ? "tv" : "movie"
                        }`
                      )
                    }
                  />
                ))}
              </ScrollRow>
            </div>
          </section>
        )}
      </div>

      {/* Desktop Persistent Sidebar with Season Selector & Episode List */}
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

            {availableSeasons.length > 1 && (
              <div className="relative">
                <select
                  value={currentSeason}
                  onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                  className="w-full appearance-none bg-zinc-800/90 text-white font-bold text-sm py-2.5 pl-3.5 pr-10 rounded-xl border border-white/10 hover:border-white/20 focus:outline-none focus:border-brand-primary transition-all cursor-pointer"
                >
                  {availableSeasons.map((s) => (
                    <option key={s.seasonNumber} value={s.seasonNumber} className="bg-zinc-900 text-white">
                      {s.name || `Saison ${s.seasonNumber}`} ({s.episodeCount} épisodes)
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
                active={idx === currentEpisodeIndex}
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

      {isTV && item && (
        <SeriesDownloadModal
          isOpen={showBatchDownloadModal}
          onClose={() => setShowBatchDownloadModal(false)}
          seriesTitle={item.title}
          tmdbId={item.id}
          episodes={episodes}
        />
      )}

      {item && (
        <DownloadModal
          isOpen={showSingleDownload}
          onClose={() => {
            setShowSingleDownload(false);
            setSelectedDownloadEpisode(null);
          }}
          title={item.title}
          id={id}
          type={isTV ? "series" : "movie"}
          season={isTV ? (selectedDownloadEpisode?.season || currentSeason) : undefined}
          episode={isTV ? (selectedDownloadEpisode?.number || currentEpisode?.number || 1) : undefined}
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

export default WatchContent;
