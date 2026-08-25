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
import SeriesDownloadModal from "@/features/downloads/SeriesDownloadModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import MovieCard from "@/components/MovieCard";
import { useLanguage } from "@/i18n/LanguageContext";
import { PopupFirewall } from "@/lib/PopupFirewall";
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconStar,
  IconClock,
  IconCalendar,
  IconMovie,
  IconDownload,
  IconShare,
  IconChevronDown,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
} from "@tabler/icons-react";

function WatchContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { translate: _ } = useLanguage();

  const id = params?.id as string;
  const typeParam = searchParams?.get("type");
  const isTV =
    typeParam === "tv" ||
    typeParam === "series" ||
    typeParam === "anime";
  const watchTypeQuery = typeParam === "anime" ? "anime" : isTV ? "series" : "movie";
  const initialSeasonParam = searchParams?.get("season") || "1";
  const initialEpisodeParam = searchParams?.get("episode") || "1";

  const [item, setItem] = useState<MovieOrShow | null>(null);
  const [currentSeason, setCurrentSeason] = useState<number>(parseInt(initialSeasonParam) || 1);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamUnavailable, setStreamUnavailable] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const [similar, setSimilar] = useState<MovieOrShow[]>([]);

  // Modals state
  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [selectedDownloadEpisode, setSelectedDownloadEpisode] = useState<Episode | null>(null);
  const [showBatchDownloadModal, setShowBatchDownloadModal] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);

  const playerRef = useRef<HTMLDivElement>(null);
  const currentEpisode = episodes[currentEpisodeIndex];

  // Initial Load (Media Details + First Stream)
  useEffect(() => {
    if (!id) return;
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
            signal
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
                  ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
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
              signal
            );
          }
          if (!cancelled) {
            if (stream) setStreamUrl(stream.embedUrl);
            else setStreamUnavailable(true);
          }
          setSeasonLoading(false);
        } else {
          const stream = await getStreamUrl(
            id,
            "movie",
            undefined,
            undefined,
            detail?.title || id,
            signal
          );
          if (!cancelled && stream) {
            setStreamUrl(stream.embedUrl);
          } else if (!cancelled) {
            setStreamUnavailable(true);
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
  }, [id, isTV, initialSeasonParam, initialEpisodeParam, _]);

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
              ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
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
            item?.title || id
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
            `/watch/${id}?type=${watchTypeQuery}&season=${newSeason}&episode=${firstEp ? firstEp.number : 1}`
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
    [id, currentSeason, item, watchTypeQuery, _]
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
          item.title || id
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
          `/watch/${id}?type=${watchTypeQuery}&season=${ep.season || currentSeason}&episode=${ep.number}`
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
    [episodes, id, item, currentSeason, watchTypeQuery]
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
  const showPageSkeleton = pageLoading && !item;

  if (showPageSkeleton) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white">
        <div className="pt-[88px] pb-16 lg:pb-24 px-4 sm:px-6 md:px-12 lg:px-[4%] space-y-6">
          <div className="w-full aspect-video bg-zinc-900 rounded-3xl animate-pulse" />
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-zinc-800 rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-zinc-800 rounded-full animate-pulse" />
            </div>
            <div className="h-10 bg-zinc-800 rounded-lg w-2/3 animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded w-full animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded w-5/6 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <IconMovie className="h-16 w-16 text-zinc-700 mx-auto" />
          <h1 className="text-xl font-bold text-white">{_("watch.contentNotFound")}</h1>
          <p className="text-zinc-400 text-sm">
            {_("watch.contentNotFoundDesc")}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 rounded-full bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/90 transition-colors"
          >
            {_("watch.backToHome")}
          </button>
        </div>
      </div>
    );
  }

  const hasEpisodes = isTV && episodes.length > 0;

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Top Back Navigation */}
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => {
            window.scrollTo(0, 0);
            router.back();
          }}
          aria-label={_("media.back")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`pt-[72px] pb-16 lg:pb-24 ${
          hasEpisodes ? "lg:pr-[26rem] xl:pr-[28rem]" : ""
        }`}
      >
        {/* Main Video Player Section */}
        <div ref={playerRef} className="scroll-mt-20 w-full">
          <div className="w-full max-h-[75vh] aspect-video bg-black relative mx-auto shadow-2xl">
            {streamUnavailable ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950/90">
                <div className="w-20 h-20 rounded-full bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50">
                  <IconMovie className="h-10 w-10 text-zinc-500" />
                </div>
                <div className="text-center max-w-md space-y-2">
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {_("media.comingSoon")}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 bg-zinc-950">
                <div className="animate-spin h-10 w-10 border-4 border-brand-primary border-t-transparent rounded-full" />
                <p className="text-xs uppercase tracking-widest font-bold">
                  {seasonLoading
                    ? _("media.loadingEpisodes")
                    : _("media.loadingStream")}
                </p>
              </div>
            ) : (
              <VideoPlayer
                key={`${currentEpisode?.id ?? item.id}-${streamUrl}`}
                item={playerItem!}
                onBack={() => router.back()}
                onOpenDetails={(it) =>
                  router.push(
                    `/media/${it.id}?type=${
                      it.type === "movie" ? "movie" : it.type
                    }`
                  )
                }
              />
            )}
          </div>
        </div>

        {/* Media Details & Controls */}
        <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-5 px-4 sm:px-6 md:px-10 lg:px-[3%]">
          {/* Series Episode Switcher Quick Bar */}
          {hasEpisodes && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/80 border border-white/5 backdrop-blur-md">
              <button
                onClick={playPrevEpisode}
                disabled={currentEpisodeIndex === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <IconPlayerTrackPrev className="h-4 w-4" />
                <span className="hidden sm:inline">Précédent</span>
              </button>

              <div className="text-center truncate px-2">
                <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                  Saison {currentSeason} · Épisode {currentEpisode?.number || 1}
                </span>
                <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {currentEpisode?.title}
                </p>
              </div>

              <button
                onClick={playNextEpisode}
                disabled={currentEpisodeIndex >= episodes.length - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <span className="hidden sm:inline">Suivant</span>
                <IconPlayerTrackNext className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Title Header */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-black tracking-widest text-xs uppercase">
                CHILLERS {isTV ? "SÉRIE" : "FILM"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
              {item.title}
            </h1>

            {currentEpisode && (
              <p className="text-zinc-400 text-sm font-medium flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold">
                  Saison {currentSeason}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-white font-bold">
                  Épisode {currentEpisode.number}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-300 truncate max-w-xs sm:max-w-md">
                  {currentEpisode.title}
                </span>
              </p>
            )}
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400 font-medium">
            {item.rating > 0 && (
              <span className="text-green-400 font-bold flex items-center gap-1">
                <IconStar className="h-4 w-4 fill-green-400" />
                {Math.round(item.rating * 10)}% match
              </span>
            )}
            {item.year && (
              <span className="flex items-center gap-1">
                <IconCalendar className="h-3.5 w-3.5 text-zinc-500" />
                {item.year}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] uppercase font-bold text-zinc-200">
              HD
            </span>
            <span className="flex items-center gap-1">
              <IconClock className="h-3.5 w-3.5 text-zinc-500" />
              {currentEpisode ? currentEpisode.duration : item.duration}
            </span>
            {isTV && availableSeasons.length > 0 && (
              <span className="text-xs text-zinc-400">
                {availableSeasons.length} saison{availableSeasons.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Action Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-1 max-w-lg">
            <button
              onClick={() => handleDownloadSingle(currentEpisode)}
              disabled={streamUnavailable}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${
                streamUnavailable
                  ? "bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
                  : "bg-zinc-800 text-white hover:bg-zinc-700 shadow-md"
              }`}
            >
              <IconDownload className="h-4 w-4" />
              {isTV
                ? `Télécharger l'épisode ${currentEpisode?.number || 1}`
                : "Télécharger le film"}
            </button>

            {isTV && (
              <button
                onClick={() => setShowBatchDownloadModal(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm bg-brand-primary/20 border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/30 transition-all"
              >
                <IconDownload className="h-4 w-4" />
                Télécharger plusieurs épisodes
              </button>
            )}
          </div>

          {/* Synopsis */}
          {(currentEpisode?.synopsis || item.synopsis || item.description) && (
            <p className="text-zinc-200 text-sm sm:text-base leading-relaxed max-w-3xl">
              {currentEpisode?.synopsis || item.synopsis || item.description}
            </p>
          )}

          {/* Cast */}
          {item.cast && item.cast.length > 0 && item.cast[0] !== "Cast Info Unavailable" && (
            <div className="text-xs sm:text-sm text-zinc-400">
              <span className="text-zinc-500 font-semibold">Distribution : </span>
              {item.cast.join(", ")}
            </div>
          )}

          {/* Bottom Action Icons */}
          <div className="flex items-center gap-6 sm:gap-8 pt-2 pb-2 border-t border-white/5">
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
            >
              <IconShare className="h-5 w-5" />
              <span className="text-[11px] font-medium">Partager</span>
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Series Episode List */}
        {hasEpisodes && (
          <section className="lg:hidden mt-8 px-4 sm:px-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-brand-primary" />
                Épisodes
              </h2>

              {/* Mobile Season Picker */}
              {availableSeasons.length > 1 && (
                <div className="relative">
                  <select
                    value={currentSeason}
                    onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                    className="appearance-none bg-zinc-800 text-white font-bold text-xs py-1.5 pl-3 pr-8 rounded-lg border border-white/10 focus:outline-none focus:border-brand-primary"
                  >
                    {availableSeasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {s.name || `Saison ${s.seasonNumber}`} ({s.episodeCount} ép.)
                      </option>
                    ))}
                  </select>
                  <IconChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="space-y-2">
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
          <section className="mt-12 px-4 sm:px-6 md:px-10 lg:px-[3%] space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-brand-primary" />
              {_("media.youMightAlsoLike")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {similar.map((sim) => (
                <MovieCard
                  key={sim.id}
                  item={sim}
                  variant="grid"
                  onPlay={(i) =>
                    router.push(
                      `/watch/${i.id}?type=${
                        i.type === "movie" ? "movie" : i.type
                      }`
                    )
                  }
                  onOpenDetails={(i) =>
                    router.push(
                      `/media/${i.id}?type=${
                        i.type === "movie" ? "movie" : i.type
                      }`
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Desktop Persistent Sidebar with Season Selector & Episode List */}
      {hasEpisodes && (
        <aside className="hidden lg:block fixed top-[72px] right-0 w-[26rem] xl:w-[28rem] h-[calc(100vh-72px)] bg-[#0c0c0e]/95 backdrop-blur-xl border-l border-white/5 overflow-y-auto p-4 z-30 space-y-3">
          {/* Season Selector Dropdown */}
          <div className="sticky top-0 bg-[#0c0c0e]/95 backdrop-blur-md pb-3 pt-1 z-10 border-b border-white/5 space-y-2">
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
                <IconChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
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
      className={`group flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
        active
          ? "bg-zinc-800/80 border-brand-primary/40 shadow-lg"
          : "bg-white/[0.02] hover:bg-white/[0.06] border-transparent"
      }`}
    >
      <div className="flex-none w-28 sm:w-32 aspect-video rounded-lg overflow-hidden bg-zinc-800 relative">
        {ep.thumbnail ? (
          <Image
            src={ep.thumbnail}
            alt={ep.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="128px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconMovie className="h-5 w-5 text-zinc-600" />
          </div>
        )}
        {active && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center shadow-lg">
              <IconPlayerPlay className="h-4 w-4 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-1">
          <h4
            className={`text-xs sm:text-sm font-bold line-clamp-1 leading-snug ${
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
              aria-label={`Télécharger ${ep.title}`}
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <IconDownload className="h-4 w-4" />
            </button>
          )}
        </div>

        <span className="text-[11px] text-zinc-400 mt-0.5">
          {ep.duration}
        </span>

        {ep.synopsis && (
          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-tight mt-1">
            {ep.synopsis}
          </p>
        )}
      </div>
    </div>
  );
}

export default WatchContent;
