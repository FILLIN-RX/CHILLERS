"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import Image from "next/image";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  getMediaDetails,
  getStreamUrl,
  getSeasonDetails,
  getMovieRecommendations,
  getPopularMovies,
  getPopularTV,
  startDownload,
  triggerDownload,
  checkSeriesDownloads,
} from "@/app/api";
import { MovieOrShow, Episode } from "@/app/mockData";
import VideoPlayer from "@/components/VideoPlayer";
import NotificationModal from "@/components/NotificationModal";
import MovieCard from "@/components/MovieCard";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  ArrowLeftIcon,
  PlayIcon,
  StarIcon,
  ClockIcon,
  CalendarDaysIcon,
  FilmIcon,
  ArrowDownTrayIcon,
  ShareIcon,
} from "@heroicons/react/24/solid";

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
  const seasonParam = searchParams?.get("season");
  const episodeParam = searchParams?.get("episode");

  const [item, setItem] = useState<MovieOrShow | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamUnavailable, setStreamUnavailable] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [seasonLoading, setSeasonLoading] = useState(false);

  const [similar, setSimilar] = useState<MovieOrShow[]>([]);

  const [downloading, setDownloading] = useState(false);
  const [seriesDownloading, setSeriesDownloading] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);

  const playerRef = useRef<HTMLDivElement>(null);
  const currentEpisode = episodes[currentEpisodeIndex];

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
          const targetSeason = seasonParam || "1";
          const seasonData = await getSeasonDetails(id, targetSeason, signal);
          if (cancelled) return;
          if (seasonData?.episodes?.length) {
            const targetEp = episodeParam ? parseInt(episodeParam) : undefined;
            let startIdx = 0;
            const eps: Episode[] = seasonData.episodes.map((ep: any, idx: number) => {
              if (targetEp && ep.episode_number === targetEp) startIdx = idx;
              return {
                id: String(ep.id),
                title: ep.name || `${_("media.episode")} ${ep.episode_number}`,
                duration: `${ep.runtime || 24}m`,
                number: ep.episode_number,
                season: parseInt(targetSeason),
                thumbnail: ep.still_path
                  ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                  : "",
                synopsis: ep.overview || "",
              };
            });
            setEpisodes(eps);
            setCurrentEpisodeIndex(startIdx);

            const firstEpNumber = eps[startIdx]?.number || eps[0].number;
            const stream = await getStreamUrl(
              id,
              "series",
              parseInt(targetSeason),
              firstEpNumber,
              detail?.title || id,
              signal
            );
            if (!cancelled && stream) {
              setStreamUrl(stream.embedUrl);
            } else if (!cancelled) {
              setStreamUnavailable(true);
            }
          } else if (!cancelled) {
            setStreamUnavailable(true);
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

        if (isTV) {
          const list = await getPopularTV(1, signal);
          if (!cancelled) setSimilar(list.filter((m) => m.id !== id).slice(0, 10));
        } else {
          const recs = await getMovieRecommendations(id, signal);
          if (!cancelled && recs.length > 0) {
            setSimilar(recs.slice(0, 10));
          } else {
            const popular = await getPopularMovies(1, signal);
            if (!cancelled) setSimilar(popular.filter((m) => m.id !== id).slice(0, 10));
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
  }, [id, isTV]);

  const playEpisode = useCallback(
    async (idx: number) => {
      const ep = episodes[idx];
      if (!ep || !item) return;
      setCurrentEpisodeIndex(idx);
      setStreamLoading(true);
      setStreamUrl("");
      try {
        setStreamUnavailable(false);
        const stream = await getStreamUrl(id, "series", ep.season || 1, ep.number, item.title || id);
        if (stream) {
          setStreamUrl(stream.embedUrl);
        } else {
          setStreamUnavailable(true);
        }
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
    [episodes, id, item]
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const type = isTV && currentEpisode ? "series" : "movie";
      const result = await startDownload(
        id,
        type,
        item?.title,
        currentEpisode?.season,
        currentEpisode?.number
      );
      if (result?.downloadUrl) {
        const filename = `${item?.title || "video"}${
          currentEpisode
            ? `-S${currentEpisode.season ?? 1}E${currentEpisode.number}`
            : ""
        }.mp4`;
        triggerDownload(result.downloadUrl, filename);
      } else {
        setNotification({
          title: _("download.impossible"),
          message: _("download.noSource"),
        });
      }
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSeriesDownload = async () => {
    if (!item) return;
    setSeriesDownloading(true);
    try {
      const result = await checkSeriesDownloads(item.id);
      if (!result.success) {
        const missing = result.data?.missing;
        let msg = _("download.downloadLaunchedDesc", { count: 0 });
        if (missing && missing.length > 0) {
          const missingStr = missing.map((m: any) => `S${m.season}E${m.episode}`).join(', ');
          msg = _("watch.seriesIncompleteDesc", { missing: missingStr });
        }
        setNotification({
          title: _("download.impossible"),
          message: result.message || msg,
        });
        return;
      }

      const episodes = result.data?.episodes || [];
      if (episodes.length === 0) {
        setNotification({
          title: _("watch.noEpisodes"),
          message: _("watch.noEpisodesDesc"),
        });
        return;
      }

      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        if (ep.downloadUrl) {
          const filename = `${item.title}-S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}.mp4`;
          triggerDownload(ep.downloadUrl, filename);
        }
        if (i < episodes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      setNotification({
        title: _("download.downloadLaunched"),
        message: _("download.downloadLaunchedDesc", { count: episodes.length }),
      });
    } catch (err) {
      console.error('Series download failed:', err);
    } finally {
      setSeriesDownloading(false);
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: item?.title || "Chillers", url });
        return;
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotification({
        title: _("watch.linkCopied"),
        message: _("watch.linkCopiedDesc"),
      });
    } catch {
    }
  };

  const playerItem: MovieOrShow | null = item
    ? currentEpisode
      ? {
          ...item,
          title: `${item.title} · E${currentEpisode.number}`,
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
        <div className="pt-[88px] max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="w-full min-h-[300px] sm:min-h-[400px] bg-zinc-900 rounded-3xl animate-pulse" />
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
          <FilmIcon className="h-16 w-16 text-zinc-700 mx-auto" />
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
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); router.back(); }}
          aria-label={_("media.back")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`pt-[88px] pb-16 lg:pb-24 max-w-7xl mx-auto px-4 sm:px-6 ${
          hasEpisodes ? "lg:pr-[22rem]" : ""
        }`}
      >
        <div ref={playerRef} className="scroll-mt-24">
          <div className="w-full min-h-[300px] sm:min-h-[400px] rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-800 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] bg-black relative">
            {streamUnavailable ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-20 h-20 rounded-full bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50">
                  <FilmIcon className="h-10 w-10 text-zinc-500" />
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
                  <svg className="animate-pulse h-3 w-3 text-brand-primary" viewBox="0 0 8 8" fill="currentColor">
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                    {_("media.comingSoon")}
                  </span>
                </div>
              </div>
            ) : showPlayerSkeleton ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
                <div className="animate-spin h-10 w-10 border-4 border-brand-primary border-t-transparent rounded-full" />
                <p className="text-xs uppercase tracking-widest font-bold">
                  {seasonLoading ? _("media.loadingEpisodes") : _("media.loadingStream")}
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
                      it.type === "series" || it.type === "anime" ? "tv" : "movie"
                    }`
                  )
                }
              />
            )}
          </div>
        </div>

        <div className="mt-6 sm:mt-8 space-y-5">
          {item.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest border border-brand-primary/40 text-brand-primary bg-brand-primary/10"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              {item.title}
            </h1>
            {currentEpisode && (
              <p className="text-zinc-400 text-sm sm:text-base font-semibold flex items-center gap-2 flex-wrap">
                <span className="text-brand-primary">{_("media.season")} 1</span>
                <span className="text-zinc-600">•</span>
                <span>{_("media.episode")} {currentEpisode.number}</span>
                <span className="text-zinc-600">•</span>
                <span className="truncate max-w-xs sm:max-w-md">
                  {currentEpisode.title}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-sm text-zinc-300 font-medium">
            <div className="flex items-center gap-1.5 text-amber-400">
              <StarIcon className="h-4 w-4" />
              <span className="font-bold text-white">{item.rating}</span>
              <span className="text-zinc-500">/10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDaysIcon className="h-4 w-4 text-zinc-500" />
              <span>{item.year}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 text-zinc-500" />
              <span>{currentEpisode ? currentEpisode.duration : item.duration}</span>
            </div>
            <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-xs uppercase tracking-wider">
              {item.type}
            </span>
          </div>

          {(currentEpisode?.synopsis || item.synopsis || item.description) && (
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-3xl">
              {currentEpisode?.synopsis || item.synopsis || item.description}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
            <button
              onClick={handleDownload}
              disabled={downloading || streamUnavailable}
              className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs border transition-all whitespace-nowrap ${
                downloading || streamUnavailable
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              }`}
            >
              {downloading ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : streamUnavailable ? (
                <svg className="h-3.5 w-3.5 flex-none" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              ) : (
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              )}
              <span>
                {downloading ? _("download.preparing") : streamUnavailable ? "Bientôt dispo" : _("download.single")}
              </span>
            </button>

            {isTV && (
              <button
                onClick={handleSeriesDownload}
                disabled={seriesDownloading}
                className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs border transition-all whitespace-nowrap ${
                  seriesDownloading
                    ? "bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed"
                    : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                }`}
              >
                {seriesDownloading ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                )}
                <span className="sm:hidden">Série</span>
                <span className="hidden sm:inline">{_("download.all")}</span>
              </button>
            )}

            <button
              onClick={handleShare}
              aria-label={_("media.share")}
              className="flex-none flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all whitespace-nowrap"
            >
              <ShareIcon className="h-3.5 w-3.5" />
              <span className="sm:hidden">Partager</span>
              <span className="hidden sm:inline">{_("media.share")}</span>
            </button>
          </div>
        </div>

        {hasEpisodes && (
          <section className="lg:hidden mt-10 space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-brand-primary" />
              {_("watch.episodes")} · {episodes.length}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {episodes.map((ep, idx) => (
                <EpisodeCard
                  key={ep.id}
                  ep={ep}
                  active={idx === currentEpisodeIndex}
                  onClick={() => playEpisode(idx)}
                />
              ))}
            </div>
          </section>
        )}

        {item.cast &&
          item.cast.length > 0 &&
          item.cast[0] !== "Cast Info Unavailable" && (
            <section className="mt-12 space-y-4">
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3">
                <span className="h-5 w-1 rounded-full bg-brand-secondary" />
                {_("media.cast")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {item.cast.map((actor) => (
                  <span
                    key={actor}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs sm:text-sm font-medium text-zinc-300 hover:border-zinc-600 transition-colors"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </section>
          )}

        {similar.length > 0 && (
          <section className="mt-12 space-y-4">
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
          </section>
        )}
      </div>

      {hasEpisodes && (
        <aside className="hidden lg:block fixed top-[88px] right-4 w-[20rem] max-h-[calc(100vh-110px)] overflow-y-auto pr-1 z-30">
          <div className="sticky top-0 bg-[#09090B]/85 backdrop-blur-md py-3 z-10 -mx-1 px-1">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              {_("watch.episodes")} · {episodes.length}
            </h3>
          </div>
          <div className="space-y-2">
            {episodes.map((ep, idx) => (
              <EpisodeCard
                key={ep.id}
                ep={ep}
                active={idx === currentEpisodeIndex}
                onClick={() => playEpisode(idx)}
              />
            ))}
          </div>
        </aside>
      )}

      {notification && (
        <NotificationModal
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          title={notification.title}
          message={notification.message}
        />
      )}
    </div>
  );
}

function EpisodeCard({
  ep,
  active,
  onClick,
}: {
  ep: Episode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl cursor-pointer transition-all border ${
        active
          ? "bg-brand-primary/10 border-brand-primary/40"
          : "bg-zinc-900/60 border-zinc-800/40 hover:bg-zinc-800/60 hover:border-zinc-700"
      }`}
    >
      <div className="flex-none w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-zinc-800 relative">
        {ep.thumbnail ? (
          <Image
            src={ep.thumbnail}
            alt={ep.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 96px, 112px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FilmIcon className="h-5 w-5 text-zinc-600" />
          </div>
        )}
        {active && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <PlayIcon className="h-6 w-6 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] sm:text-xs text-zinc-500 font-bold">
            {ep.number}.
          </span>
          <h4
            className={`text-xs sm:text-sm font-bold truncate ${
              active ? "text-brand-primary" : "text-white"
            }`}
          >
            {ep.title}
          </h4>
        </div>
        {ep.synopsis && (
          <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5 line-clamp-2">
            {ep.synopsis}
          </p>
        )}
        <span className="text-[10px] text-zinc-600 mt-0.5 block">
          {ep.duration}
        </span>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
          <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
