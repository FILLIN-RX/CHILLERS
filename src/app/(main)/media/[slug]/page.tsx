"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getMediaDetails, getPopularMovies, getPopularTV, getStreamUrl, startDownload, triggerDownload, getPopularMoviesPage, getPopularTVPage, getAnimeSeriesPage, getMoviesByGenrePage, getTVByGenrePage, getMovieGenres, getTVGenres, Genre } from "@/app/api";
import GenreFilterBar from "@/components/GenreFilterBar";
import NotificationModal from "@/components/NotificationModal";
import { MovieOrShow } from "@/app/mockData";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  ArrowLeftIcon,
  PlayIcon,
  StarIcon,
  ClockIcon,
  CalendarDaysIcon,
  FilmIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";
import { ShareIcon } from "@heroicons/react/24/outline";
import VideoPlayer from "@/components/VideoPlayer";
import MovieCard from "@/components/MovieCard";

const LISTING_TYPES = ["movies", "series", "anime"];

function MediaDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { translate: _ } = useLanguage();

  const id = params?.slug as string;
  const isTV = searchParams?.get("type") === "tv" || searchParams?.get("type") === "series";

  const [item, setItem] = useState<MovieOrShow | null>(null);
  const [similar, setSimilar] = useState<MovieOrShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    if (shareOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [shareOpen]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = item?.title || 'Chillers';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    setShareOpen(true);
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, similarList] = await Promise.all([
        getMediaDetails(id, isTV),
        isTV ? getPopularTV() : getPopularMovies(),
      ]);
      if (detail) {
        if (detail.trailerUrl) {
          setTrailerUrl(detail.trailerUrl);
        } else if (detail.videoUrl?.includes("youtube.com") || detail.videoUrl?.includes("embed")) {
          setTrailerUrl(detail.videoUrl);
        }
        setItem(detail);
        const season = isTV ? 1 : undefined;
        const episode = isTV ? 1 : undefined;
        getStreamUrl(detail.id, isTV ? 'series' : 'movie', season, episode, detail.title).then(stream => {
          if (stream) setItem(prev => prev ? { ...prev, videoUrl: stream.embedUrl } : prev);
        });
      }
      setSimilar(similarList.filter((m) => m.id !== id).slice(0, 8));
    } catch (err) {
      console.error("Error loading detail page:", err);
    } finally {
      setLoading(false);
    }
  }, [id, isTV]);

  useEffect(() => {
    fetchData();
  }, [fetchData, id]);

  const handleWatch = async () => {
    if (isTV && item) {
      router.push(`/watch/${item.id}?type=tv`, { scroll: false });
      return;
    }
    if (item && !item.videoUrl) {
      const stream = await getStreamUrl(item.id, 'movie', undefined, undefined, item.title);
      if (stream) {
        setItem({ ...item, videoUrl: stream.embedUrl });
      } else {
        setNotification({
          title: _("media.streamUnavailable"),
          message: _("media.streamUnavailableDesc"),
        });
      }
    }
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const type = isTV ? 'series' : 'movie';
      const result = await startDownload(id, type, item?.title || id);
      if (result?.downloadUrl) {
        triggerDownload(result.downloadUrl, `${item?.title || 'video'}.mp4`);
      } else {
        setNotification({
          title: _("download.impossible"),
          message: _("download.noSource"),
        });
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
        <div className="fixed top-0 left-0 z-40 p-4">
          <button
            onClick={() => { window.scrollTo(0, 0); router.back(); }}
            aria-label={_("media.back")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-black/90 transition-all"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="w-full h-[70vh] bg-zinc-900 animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-6 w-full">
          <div className="h-10 bg-zinc-800 rounded-xl w-2/3 animate-pulse" />
          <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-zinc-800 rounded w-full animate-pulse" />
          <div className="h-4 bg-zinc-800 rounded w-5/6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <FilmIcon className="h-16 w-16 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 text-lg">{_("media.notFound")}</p>
          <button
            onClick={() => { window.scrollTo(0, 0); router.back(); }}
            className="px-6 py-2 rounded-full bg-[#D70466] text-white text-sm font-bold hover:bg-[#b5034f] transition-colors"
          >
            {_("media.back")}
          </button>
        </div>
      </div>
    );
  }

  const isYouTube = trailerUrl?.includes("youtube.com") || trailerUrl?.includes("embed");

  return (
    <div className="flex-1 flex flex-col bg-[#09090B] text-white pb-20 sm:pb-0">

      {/* Back button */}
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); router.back(); }}
          aria-label={_("media.back")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative w-full h-[85vh] overflow-hidden">
        <Image
          src={item.backdropUrl}
          alt={item.title}
          fill
          className="object-cover scale-105"
          style={{ filter: "brightness(0.65) saturate(1.05)" }}
          sizes="100vw"
          priority
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/80 via-[#09090B]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />

        <div className="absolute inset-0 flex items-end pb-16 px-6 sm:px-12 lg:px-20">
          <div className="flex flex-col sm:flex-row gap-8 items-start max-w-6xl w-full mx-auto">

            <div className="hidden sm:block relative flex-none w-44 lg:w-56 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
              <Image
                src={item.posterUrl}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 176px, 224px"
              />
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap gap-2">
                {item.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest border border-[#D70466]/40 text-[#D70466] bg-[#D70466]/10"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-xl sm:text-5xl lg:text-7xl font-black text-white leading-tight drop-shadow-xl">
                {item.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-base text-zinc-300 font-medium">
                <div className="flex items-center gap-1 sm:gap-1.5 text-amber-400">
                  <StarIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  <span className="font-bold">{item.rating}</span>
                  <span className="text-zinc-500">/10</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <CalendarDaysIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-zinc-500" />
                  {item.year}
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-zinc-500" />
                  {item.duration}
                </div>
                <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-[10px] sm:text-xs uppercase tracking-wider">
                  {item.type}
                </span>
              </div>

              <p className="text-zinc-300 text-sm sm:text-lg leading-relaxed max-w-2xl line-clamp-3">
                {item.synopsis || item.description}
              </p>

              <div className="flex items-center gap-2 pt-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={!loading && !isTV && !item.videoUrl ? undefined : handleWatch}
                  className={`flex-none flex items-center gap-1.5 px-3 sm:px-6 py-1.5 sm:py-3 rounded-full font-bold text-[11px] sm:text-sm transition-all hover:scale-105 shadow-lg whitespace-nowrap ${
                    !loading && !isTV && !item.videoUrl
                      ? "bg-zinc-800 border border-zinc-700 text-zinc-400 cursor-not-allowed shadow-none"
                      : "bg-[#D70466] hover:bg-[#b5034f] text-white shadow-lg shadow-[#D70466]/30"
                  }`}
                  disabled={!loading && !isTV && !item.videoUrl}
                >
                  {!loading && !isTV && !item.videoUrl ? (
                    <svg className="h-3.5 w-3.5 sm:h-5 sm:w-5 flex-none" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ) : (
                    <PlayIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  )}
                  <span className="sm:hidden">{!loading && !isTV && !item.videoUrl ? 'Bientôt' : isTV ? 'Série' : 'Film'}</span>
                  <span className="hidden sm:inline">{!loading && !isTV && !item.videoUrl ? 'Bientôt disponible' : _("media.watch")}</span>
                </button>

                {isYouTube && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    className="flex-none flex items-center gap-1.5 px-3 sm:px-6 py-1.5 sm:py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-bold text-[11px] sm:text-sm transition-all hover:scale-105"
                  >
                    <FilmIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                    <span className="sm:hidden">Bande-annonce</span>
                    <span className="hidden sm:inline">{_("media.trailer")}</span>
                  </button>
                )}

                <button 
                  className={`flex-none flex items-center gap-1.5 px-3 sm:px-6 py-1.5 sm:py-3 rounded-full font-bold text-[11px] sm:text-sm transition-all hover:scale-105 border whitespace-nowrap ${
                    downloading || (!loading && !item.videoUrl)
                      ? "bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={handleDownload}
                  disabled={downloading || (!loading && !item.videoUrl)}
                >
                  {downloading ? (
                    <>
                      <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="sm:hidden">...</span>
                      <span className="hidden sm:inline">{_("download.preparing")}</span>
                    </>
                  ) : !loading && !item.videoUrl ? (
                    <>
                      <svg className="h-3 w-3 sm:h-4 sm:w-4 flex-none" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span className="sm:hidden">Bientôt</span>
                      <span className="hidden sm:inline">Bientôt disponible</span>
                    </>
                  ) : (
                    <ArrowDownTrayIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1.5" />
                  )}
                  {!downloading && (loading || item.videoUrl) && <span className="hidden sm:inline">{_("download.single")}</span>}
                </button>

                <div className="relative" ref={shareRef}>
                  <button
                    onClick={handleShare}
                    aria-label={_("media.share")}
                    className="flex-none flex items-center gap-1.5 px-2.5 sm:px-5 py-1.5 sm:py-3 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all hover:scale-105 font-bold text-[11px] sm:text-sm"
                  >
                    <ShareIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  </button>
                  {shareOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent((item?.title || 'Chillers') + ' ' + window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-800 transition-colors"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </a>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-800 transition-colors"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          setShareOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-800 transition-colors"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 006.364 6.364l1.757-1.757" /></svg>
                        Copier le lien
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-12 lg:px-20 py-12 sm:py-16 space-y-12 sm:space-y-16">
        <section className="space-y-3 sm:space-y-4">
          <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
            <span className="h-4 w-1 sm:h-5 sm:w-1 rounded-full bg-[#D70466]" />
            {_("media.synopsis")}
          </h2>
          <p className="text-zinc-300 text-sm sm:text-lg leading-relaxed max-w-3xl">
            {item.synopsis || item.description || _("media.noSynopsis")}
          </p>
        </section>

        {item.cast && item.cast.length > 0 && item.cast[0] !== "Cast Info Unavailable" && (
          <section className="space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
              <span className="h-4 w-1 sm:h-5 sm:w-1 rounded-full bg-[#7C3AED]" />
              {_("media.cast")}
            </h2>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {item.cast.map((actor) => (
                <span
                  key={actor}
                  className="px-3 sm:px-4 py-1 sm:py-2 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] sm:text-sm font-medium text-zinc-300 hover:border-zinc-600 transition-colors"
                >
                  {actor}
                </span>
              ))}
            </div>
          </section>
        )}

        {!isTV && (
          <section ref={playerRef} className="space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
              <span className="h-4 w-1 sm:h-5 sm:w-1 rounded-full bg-[#D70466]" />
              {_("media.watch")}
            </h2>
            <div className="w-full rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-black relative">
              {item.videoUrl ? (
                <VideoPlayer
                  item={item!}
                  onBack={() => {}}
                  onOpenDetails={(it) => router.push(`/media/${it.id}?type=${it.type}`)}
                />
              ) : (
                <div className="w-full min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-center gap-3 text-zinc-500">
                  <div className="animate-spin h-10 w-10 border-4 border-[#D70466] border-t-transparent rounded-full" />
                  <p className="text-xs uppercase tracking-widest font-bold">{_("media.loadingStream")}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {isTV && item.seasons && item.seasons.length > 0 && (
          <section className="space-y-4 sm:space-y-6">
            <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
              <span className="h-4 w-1 sm:h-5 sm:w-1 rounded-full bg-[#D70466]" />
              {_("media.season")}s
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {item.seasons.filter(s => s.seasonNumber > 0).map((season) => (
                <div
                  key={season.id}
                  onClick={() => router.push(`/tv/${item.id}/season/${season.seasonNumber}`)}
                  className="group cursor-pointer space-y-2"
                >
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 relative">
                    {season.posterUrl ? (
                      <Image
                        src={season.posterUrl}
                        alt={season.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FilmIcon className="h-12 w-12 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <PlayIcon className="h-8 w-8 text-white mx-auto mb-2 opacity-90" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#D70466] transition-colors truncate">
                      {season.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                       {season.episodeCount ?? season.episodes.length} {_("media.episodes")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="space-y-4 sm:space-y-6">
            <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
              <span className="h-4 w-1 sm:h-5 sm:w-1 rounded-full bg-[#7C3AED]" />
              {_("media.youMightAlsoLike")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {similar.map((sim) => (
                <div
                  key={sim.id}
                  onClick={() => router.push(`/media/${sim.id}?type=${sim.type}`)}
                  className="group cursor-pointer space-y-2"
                >
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 relative">
                    <Image
                      src={sim.posterUrl}
                      alt={sim.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <PlayIcon className="h-8 w-8 text-white mx-auto mb-2 opacity-90" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#D70466] transition-colors truncate">
                      {sim.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>{sim.year}</span>
                      <span>•</span>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        <StarIcon className="h-3 w-3" />
                        <span>{sim.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {trailerOpen && isYouTube && trailerUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTrailerOpen(false)}
        >
          <div
            className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${trailerUrl}?autoplay=1&controls=1&rel=0&modestbranding=1`}
              className="w-full h-full border-none bg-black"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; gyroscope; accelerometer"
              allowFullScreen
              referrerPolicy="origin"
              title={item.title}
            />
          </div>
        </div>
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

function MediaListingPage() {
  const params = useParams();
  const type = params?.slug as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { translate: _ } = useLanguage();

  const [items, setItems] = useState<MovieOrShow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    const handleScroll = () => setHeaderHidden(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Genre filter state
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [activeGenreId, setActiveGenreId] = useState<string | null>(null);

  // Fetch genres depending on content type
  useEffect(() => {
    setGenresLoading(true);
    const fetchGenres = type === "movies"
      ? getMovieGenres
      : getTVGenres;
    fetchGenres()
      .then(setGenres)
      .finally(() => setGenresLoading(false));
    // Reset filter when switching type
    setActiveGenreId(null);
    setPage(1);
  }, [type]);

  // Read ?genre= from URL on mount
  useEffect(() => {
    const genreParam = searchParams?.get("genre");
    if (genreParam) {
      setActiveGenreId(genreParam);
    }
  }, [searchParams]);

  // Reset to page 1 when genre changes
  useEffect(() => {
    setPage(1);
  }, [activeGenreId]);

  // Fetch content — uses genre filter if active, otherwise default lists
  useEffect(() => {
    let cancelled = false;
    async function fetchPage() {
      setIsLoading(true);
      try {
        let result: { results: MovieOrShow[]; totalPages: number } = { results: [], totalPages: 1 };

        if (activeGenreId) {
          // Genre filtered
          if (type === "movies") result = await getMoviesByGenrePage(activeGenreId, page);
          else result = await getTVByGenrePage(activeGenreId, page); // series + anime
        } else {
          // Default lists
          if (type === "movies") result = await getPopularMoviesPage(page);
          else if (type === "series") result = await getPopularTVPage(page);
          else if (type === "anime") result = await getAnimeSeriesPage(page);
        }

        if (!cancelled) {
          setItems(result.results);
          setTotalPages(result.totalPages);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchPage();
    return () => { cancelled = true; };
  }, [type, page, activeGenreId]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== page) setPage(p);
  };

  const buildPages = () => {
    const range: (number | "...")[] = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);
    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1) range.push(totalPages);
    return range;
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
    movies: { title: _("home.blockbusterMovies"), subtitle: _("home.blockbusterSubtitle") },
    series: { title: _("home.featuredSeries"), subtitle: _("home.featuredSeriesSubtitle") },
    anime: { title: _("home.globalAnime"), subtitle: _("search.animePoweredBy") },
  };
  const { title, subtitle } = titles[type] || { title: type, subtitle: "" };

  // Active genre label
  const activeGenreName = genres.find(g => String(g.id) === activeGenreId)?.name;

  return (
    <main className="min-h-screen bg-brand-dark pb-28">

      {/* ── Sticky filter bar ── */}
      <div className={`sticky z-30 bg-brand-dark/95 backdrop-blur-md border-b border-zinc-800/50 px-2 sm:px-6 md:px-12 lg:px-[4%] py-2.5 transition-all duration-500 ${
        headerHidden ? "top-0" : "top-[64px]"
      }`}>
        <GenreFilterBar
          genres={genres}
          activeGenreId={activeGenreId}
          onSelect={(id) => setActiveGenreId(id)}
          isLoading={genresLoading}
        />
      </div>

      {/* ── Page content ── */}
      <div className="max-w-[1600px] mx-auto px-2 sm:px-6 md:px-12 lg:px-[4%] pt-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              {activeGenreName ? `${title} · ${activeGenreName}` : title}
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>
          </div>
          {!isLoading && (
            <span className="text-xs text-zinc-500">
              {_("common.page")} <span className="text-white font-bold">{page}</span>/{_("common.of")} {totalPages}
            </span>
          )}
        </div>

        {/* Anime banner */}
        {type === "anime" && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-brand-secondary/10 border border-brand-secondary/30">
            <p className="text-xs font-bold text-white">{_("search.animePoweredBy")}</p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {isLoading
            ? Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-lg sm:rounded-xl bg-zinc-900 skeleton-loading" />
              ))
            : items.map((item) => (
                <MovieCard
                  key={item.id}
                  item={item}
                  variant="grid"
                  onPlay={(i) => router.push(`/media/${i.id}?type=${i.type === "series" || i.type === "anime" ? "tv" : "movie"}`)}
                  onOpenDetails={(i) => router.push(`/media/${i.id}?type=${i.type === "series" || i.type === "anime" ? "tv" : "movie"}`)}
                />
              ))
          }
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-4 flex-wrap">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{_("common.previous")}</span>
            </button>

            {buildPages().map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="px-2 py-2 text-zinc-600 text-sm select-none">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p as number)}
                  className={`min-w-[36px] px-3 py-2 rounded-xl text-sm font-bold border transition-all focus:outline-none cursor-pointer ${
                    p === page
                      ? "bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/30"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
            >
              <span className="hidden sm:inline">{_("common.next")}</span>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </main>
  );
}

function MediaListingPageFallback() {
  return <div className="min-h-screen bg-brand-dark" />;
}

function MediaDetailPageFallback() {
  return <div className="min-h-screen bg-brand-dark" />;
}

export default function MediaPage() {
  const params = useParams();
  const slug = params?.slug as string;

  if (LISTING_TYPES.includes(slug)) {
    return (
      <Suspense fallback={<MediaListingPageFallback />}>
        <MediaListingPage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<MediaDetailPageFallback />}>
      <MediaDetailPage />
    </Suspense>
  );
}
