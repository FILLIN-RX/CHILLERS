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
import { IconArrowLeft, IconPlayerPlay, IconStar, IconClock, IconCalendar, IconMovie, IconDownload, IconShare } from '@tabler/icons-react';

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

  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
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

        // Pour les séries, saison + stream sont indépendants → on les lance
        // en parallèle. Pour les films, le stream attend implicitement `detail`
        // (besoin du titre pour la requête backend), donc une seule branche.
        if (isTV) {
          setSeasonLoading(true);
          const targetSeason = seasonParam || "1";
          const seasonDataPromise = getSeasonDetails(id, targetSeason, signal);

          // On pré-calcule l'épisode cible sans attendre les épisodes (fallback Ep 1).
          const targetEp = episodeParam ? parseInt(episodeParam) : 1;
          const firstStreamPromise = getStreamUrl(
            id,
            "series",
            parseInt(targetSeason),
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
                season: parseInt(targetSeason),
                thumbnail: ep.still_path
                  ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                  : "",
                synopsis: ep.overview || "",
              };
            });
            setEpisodes(eps);
            setCurrentEpisodeIndex(startIdx);
          }

          // Stream : fallback saison 1 si la cible n'a rien donné.
          let stream = firstStream;
          if (!stream && parseInt(targetSeason) !== 1) {
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
  }, [id, isTV]);

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

  // ── Anti-popup firewall + redirect protection ────────────────────────
  useEffect(() => {
    PopupFirewall.activate();

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (streamUrl && !streamUnavailable) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      PopupFirewall.deactivate();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [streamUrl, streamUnavailable]);

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

  const handleDownload = () => {
    setShowSingleDownload(true);
  };

  const handleSeriesDownload = () => {
    if (!item) return;
    setShowDownloadModal(true);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: item ? `Regardez ${item.title} sur CHILLERS` : "CHILLERS", url });
        return;
      } catch {
      }
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
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); router.back(); }}
          aria-label={_("media.back")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`pt-[72px] pb-16 lg:pb-24 ${
          hasEpisodes ? "lg:pr-[28rem]" : ""
        }`}
      >
        <div ref={playerRef} className="scroll-mt-20 w-full">
          <div className="w-full max-h-[70vh] aspect-video bg-black relative mx-auto shadow-2xl">
            {streamUnavailable ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
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

        <div className="mt-4 sm:mt-8 space-y-4 sm:space-y-5 px-4 sm:px-6 md:px-12 lg:px-[4%]">
          {/* Brand Logo / Netflix style */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-red-600 font-black tracking-widest text-sm">CHILLERS</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              {item.title}
            </h1>
            {currentEpisode && (
              <p className="text-zinc-400 text-sm font-semibold flex items-center gap-2 flex-wrap">
                <span className="text-white">{_("media.season")} {currentEpisode.season || 1}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-white">{_("media.episode")} {currentEpisode.number}</span>
                <span className="text-zinc-600">•</span>
                <span className="truncate text-white max-w-xs sm:max-w-md">
                  {currentEpisode.title}
                </span>
              </p>
            )}
          </div>

          {/* Metadata dynamic */}
          <div className="flex flex-wrap items-center gap-2 text-[13px] sm:text-sm text-zinc-400 font-medium">
            {item.rating > 0 && (
              <span className="text-green-500 font-bold">Recommandé à {Math.round(item.rating * 10)}%</span>
            )}
            {item.year && <span>{item.year}</span>}
            <span className="px-1 py-0.5 rounded border border-zinc-600 text-[10px] uppercase font-bold leading-none">HD</span>
            <span>{currentEpisode ? currentEpisode.duration : item.duration}</span>
          </div>

          {/* Action Buttons (Lecture / Télécharger) */}
          <div className="flex flex-col gap-3 py-2">
            <button
              onClick={() => {
                 playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors"
            >
              <IconPlayerPlay className="h-5 w-5 fill-black" />
              Lecture
            </button>
            <button
              onClick={isTV ? handleSeriesDownload : handleDownload}
              disabled={streamUnavailable}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded font-bold text-sm transition-colors ${
                streamUnavailable 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-zinc-800 text-white hover:bg-zinc-700"
              }`}
            >
              <IconDownload className="h-5 w-5" />
              {streamUnavailable ? "Bientôt dispo" : "Télécharger"}
            </button>
          </div>

          {/* Synopsis */}
          {(currentEpisode?.synopsis || item.synopsis || item.description) && (
            <p className="text-white text-[14px] sm:text-base leading-snug max-w-3xl">
              {currentEpisode?.synopsis || item.synopsis || item.description}
            </p>
          )}

          {/* Cast info */}
          {item.cast && item.cast.length > 0 && item.cast[0] !== "Cast Info Unavailable" && (
            <div className="text-[13px] sm:text-sm text-zinc-400 leading-snug">
              <span className="text-zinc-500">Distribution : </span>
              {item.cast.join(", ")}
              <span className="text-white cursor-pointer ml-1 font-semibold">... plus</span>
            </div>
          )}

          {/* Action icons: Ma liste, Évaluer, Partager, Télécharger */}
          <div className="flex items-center gap-6 sm:gap-8 pt-4 pb-2">
            <button className="flex flex-col items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-[11px] font-medium">Ma liste</span>
            </button>
            <button className="flex flex-col items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25" />
              </svg>
              <span className="text-[11px] font-medium">Évaluer</span>
            </button>
            <button onClick={handleShare} className="flex flex-col items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
              <IconShare className="h-6 w-6" />
              <span className="text-[11px] font-medium">Partager</span>
            </button>
            <button onClick={handleDownload} disabled={streamUnavailable} className={`flex flex-col items-center gap-1.5 transition-colors ${streamUnavailable ? "text-zinc-600" : "text-zinc-400 hover:text-white"}`}>
              <IconDownload className="h-6 w-6" />
              <span className="text-[11px] font-medium">Télécharger</span>
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



        {similar.length > 0 && (
          <section className="mt-12 space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-brand-primary" />
              {_("media.youMightAlsoLike")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
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
        <aside className="hidden lg:block fixed top-[88px] right-4 w-[24rem] max-h-[calc(100vh-110px)] overflow-y-auto pr-1 z-30">
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

      {isTV && item && (
        <SeriesDownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          seriesTitle={item.title}
          tmdbId={item.id}
          episodes={episodes}
        />
      )}

      {item && (
        <DownloadModal
          isOpen={showSingleDownload}
          onClose={() => setShowSingleDownload(false)}
          title={item.title}
          id={id}
          type={isTV ? 'series' : 'movie'}
          season={currentEpisode?.season}
          episode={currentEpisode?.number}
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
      className={`flex flex-col gap-2 p-2 sm:p-3 rounded-md cursor-pointer transition-colors border border-transparent ${
        active
          ? "bg-zinc-800/60"
          : "hover:bg-zinc-900 border-b-zinc-800/50"
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex-none w-28 sm:w-36 aspect-video rounded overflow-hidden bg-zinc-800 relative">
          {ep.thumbnail ? (
            <Image
              src={ep.thumbnail}
              alt={ep.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 112px, 144px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <IconMovie className="h-5 w-5 text-zinc-600" />
            </div>
          )}
          {active && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <IconPlayerPlay className="h-6 w-6 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4
            className={`text-sm font-bold line-clamp-2 leading-tight ${
              active ? "text-white" : "text-zinc-200"
            }`}
          >
            {ep.number}. {ep.title}
          </h4>
          <span className="text-xs text-zinc-400 mt-1">
            {ep.duration}
          </span>
        </div>
        <div className="flex-none px-2 hidden sm:block">
          <IconDownload className="h-6 w-6 text-zinc-500" />
        </div>
      </div>
      {ep.synopsis && (
        <p className="text-xs text-zinc-400 line-clamp-3 leading-snug mt-1">
          {ep.synopsis}
        </p>
      )}
    </div>
  );
}

export default WatchContent;

