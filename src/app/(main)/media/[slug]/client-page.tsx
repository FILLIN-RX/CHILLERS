"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  getMediaDetails,
  getPopularMovies,
  getPopularTV,
  getTrendingMovies,
  getTrendingTV,
  getTopRatedMovies,
  getTopRatedTV,
  getUpcomingMovies,
  getAnimeSeries,
  getPopularMoviesPage,
  getPopularTVPage,
  getAnimeSeriesPage,
  getMoviesByGenrePage,
  getTVByGenrePage,
  getMoviesByGenre,
  getByGenreMultiple,
  getMovieGenres,
  getTVGenres,
  getDisponible,
} from "@/services/media";
import type { Genre, MovieOrShow } from "@/types/media";
import GenreFilterBar from "@/components/GenreFilterBar";
import NotificationModal from "@/components/NotificationModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import ScrollRow from "@/components/ScrollRow";
import MovieCard from "@/components/MovieCard";
import { useLanguage } from "@/i18n/LanguageContext";
import { IconArrowLeft, IconPlayerPlay, IconStar, IconClock, IconCalendar, IconMovie, IconChevronLeft, IconChevronRight, IconDownload, IconShare, IconSparkles } from '@tabler/icons-react';

import CatalogSpotlightHero from "@/components/CatalogSpotlightHero";

const MovieModal = dynamic(() => import("@/components/MovieModal"), { ssr: false });

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
  const shareBtnRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [sharePos, setSharePos] = useState<{ top: number; right: number } | null>(null);
  const [disponible, setDisponible] = useState<{ disponible: boolean; streaming: boolean; download: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    getDisponible(id, isTV ? 'series' : 'movie').then(setDisponible).catch(() => {});
  }, [id, isTV]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (shareBtnRef.current?.contains(target) || shareMenuRef.current?.contains(target)) return;
      setShareOpen(false);
    };
    const handleScroll = () => setShareOpen(false);
    if (shareOpen) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [shareOpen]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = item ? `Regardez ${item.title} sur CHILLERS` : 'CHILLERS';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    const rect = shareBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setSharePos({
        top: Math.min(rect.bottom + 8, window.innerHeight - 200),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setShareOpen(true);
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setSimilar([]);
    try {
      const detail = await getMediaDetails(id, isTV);
      if (detail) {
        if (detail.trailerUrl) {
          setTrailerUrl(detail.trailerUrl);
        } else if (detail.videoUrl?.includes("youtube.com") || detail.videoUrl?.includes("embed")) {
          setTrailerUrl(detail.videoUrl);
        }
        // On garde `videoUrl` s'il pointe vers une URL embed (YouTube bande-annonce)
        // mais on ne lance plus de fetch de stream ici — la page /watch s'en charge.
        setItem(detail);
      }
    } catch (err) {
      console.error("Error loading detail page:", err);
    } finally {
      setLoading(false);
    }
  }, [id, isTV]);

  useEffect(() => {
    fetchData();
  }, [fetchData, id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadSimilar = async () => {
      try {
        const similarList = isTV ? await getPopularTV() : await getPopularMovies();
        if (!cancelled) {
          setSimilar(similarList.filter((m) => m.id !== id).slice(0, 8));
        }
      } catch (err) {
        if (!cancelled) console.error("Error loading similar media:", err);
      }
    };

    loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [id, isTV]);

  const handleWatch = async () => {
    if (!item) return;
    // Tout le streaming passe par /watch — on ne lance plus rien en inline
    // sur la page /media (le player a été retiré de cette vue).
    router.push(`/watch/${item.id}?type=${isTV ? "tv" : "movie"}`, { scroll: false });
  };

  const [showSingleDownload, setShowSingleDownload] = useState(false);

  const handleDownload = () => {
    setShowSingleDownload(true);
  };

  const jsonLd = !loading && item ? (() => {
    const isMovie = !isTV;
    const schemaType = isMovie ? "Movie" : "TVSeries";
    return {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: item.title,
      description: item.synopsis || item.description,
      image: item.posterUrl,
      datePublished: item.year ? `${item.year}` : undefined,
      aggregateRating: item.rating ? {
        "@type": "AggregateRating",
        ratingValue: item.rating,
        bestRating: 10,
        worstRating: 0,
        itemReviewed: item.title,
      } : undefined,
      genre: item.genres,
      ...(isMovie ? {} : { numberOfSeasons: item.seasons?.filter(s => s.seasonNumber > 0).length }),
    };
  })() : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
        <div className="fixed top-0 left-0 z-40 p-4">
          <button
            onClick={() => { window.scrollTo(0, 0); router.back(); }}
            aria-label={_("media.back")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-black/90 transition-all"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="w-full h-[60vh] sm:h-[65vh] bg-zinc-900 animate-pulse" />
        <div className="mx-auto px-6 sm:px-8 md:px-12 lg:px-[4%] py-10 space-y-6 w-full">
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
          <IconMovie className="h-16 w-16 text-zinc-700 mx-auto" />
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

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Back button */}
      <div className="fixed top-0 left-0 z-40 p-4">
        <button
          onClick={() => { window.scrollTo(0, 0); router.back(); }}
          aria-label={_("media.back")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="relative w-full h-[65vh] sm:h-[75vh] overflow-hidden">
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

        <div className="absolute inset-0 flex items-end pb-14 sm:pb-16 px-4 sm:px-8 lg:px-20">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start w-full">

            <div className="hidden sm:block relative flex-none w-40 lg:w-56 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
              <Image
                src={item.posterUrl}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 160px, 224px"
                loading="lazy"
              />
            </div>

            <div className="flex-1 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {disponible && (
                  <span
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-widest border ${
                      disponible.disponible
                        ? "border-green-500/40 text-green-400 bg-green-500/10"
                        : "border-red-500/40 text-red-400 bg-red-500/10"
                    }`}
                  >
                    {disponible.disponible ? "● Disponible" : "● Non disponible"}
                  </span>
                )}
                {item.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-widest border border-[#D70466]/40 text-[#D70466] bg-[#D70466]/10"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-white leading-tight drop-shadow-xl">
                {item.title}
              </h1>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-4 text-[11px] sm:text-base text-zinc-300 font-medium">
                <div className="flex items-center gap-1 text-amber-400">
                  <IconStar className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  <span className="font-bold">{item.rating}</span>
                  <span className="text-zinc-500 text-[10px] sm:text-sm">/10</span>
                </div>
                <div className="flex items-center gap-1">
                  <IconCalendar className="h-3 w-3 sm:h-5 sm:w-5 text-zinc-500" />
                  {item.year}
                </div>
                <div className="flex items-center gap-1">
                  <IconClock className="h-3 w-3 sm:h-5 sm:w-5 text-zinc-500" />
                  {item.duration}
                </div>
                <span className="px-1.5 sm:px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-[9px] sm:text-xs uppercase tracking-wider">
                  {item.type}
                </span>
              </div>

              <p className="text-zinc-300 text-xs sm:text-base leading-relaxed max-w-2xl"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.synopsis || item.description}
              </p>

              <div className="flex items-center gap-1.5 sm:gap-2 pt-1 sm:pt-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={handleWatch}
                  disabled={!item || loading}
                  className={`flex-none flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-sm transition-all hover:scale-105 shadow-lg whitespace-nowrap ${
                    !item || loading
                      ? "bg-zinc-800 border border-zinc-700 text-zinc-400 cursor-not-allowed shadow-none"
                      : "bg-[#D70466] hover:bg-[#b5034f] text-white shadow-lg shadow-[#D70466]/30"
                  }`}
                >
                  <IconPlayerPlay className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">{isTV ? 'Série' : 'Film'}</span>
                  <span className="hidden sm:inline">{_("media.watch")}</span>
                </button>

                {isYouTube && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    className="flex-none flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-bold text-xs sm:text-sm transition-all hover:scale-105"
                  >
                    <IconMovie className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                    <span className="sm:hidden">Trailer</span>
                    <span className="hidden sm:inline">{_("media.trailer")}</span>
                  </button>
                )}

                <button
                  className="flex-none flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-3 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all font-bold text-xs sm:text-sm whitespace-nowrap"
                  onClick={handleDownload}
                  disabled={!item || loading}
                >
                  <IconDownload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{_("download.single")}</span>
                </button>

                <div className="relative" ref={shareBtnRef}>
                  <button
                    onClick={handleShare}
                    aria-label={_("media.share")}
                    className="flex-none flex items-center gap-1.5 px-2.5 sm:px-5 py-2 sm:py-3 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all hover:scale-105 font-bold text-xs sm:text-sm"
                  >
                    <IconShare className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  </button>
                  {shareOpen && sharePos &&
                    createPortal(
                      <div
                        ref={shareMenuRef}
                        style={{ position: "fixed", top: sharePos.top, right: sharePos.right }}
                        className="w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-[100]"
                      >
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
                      </div>,
                      document.body
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-8 md:px-12 lg:px-[4%] py-8 sm:py-12 lg:py-16 space-y-8 sm:space-y-12">
        <section className="space-y-2 sm:space-y-4">
          <h2 className="text-base sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-3">
            <span className="h-4 sm:h-5 w-1 rounded-full bg-[#D70466]" />
            {_("media.synopsis")}
          </h2>
          <p className="text-zinc-300 text-xs sm:text-base leading-relaxed max-w-3xl">
            {item.synopsis || item.description || _("media.noSynopsis")}
          </p>
        </section>

        {item.cast && item.cast.length > 0 && item.cast[0] !== "Cast Info Unavailable" && (
          <section className="space-y-2 sm:space-y-4">
            <h2 className="text-base sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-3">
              <span className="h-4 sm:h-5 w-1 rounded-full bg-[#7C3AED]" />
              {_("media.cast")}
            </h2>
            <div className="flex flex-wrap gap-1.5 sm:gap-3">
              {item.cast.map((actor) => (
                <span
                  key={actor}
                  className="px-2.5 sm:px-4 py-1 sm:py-2 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] sm:text-sm font-medium text-zinc-300 hover:border-zinc-600 transition-colors"
                >
                  {actor}
                </span>
              ))}
            </div>
          </section>
        )}

        {!isTV && (
          <section ref={playerRef} className="space-y-2 sm:space-y-4">
            <h2 className="text-base sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-3">
              <span className="h-4 sm:h-5 w-1 rounded-full bg-[#D70466]" />
              {_("media.watch")}
            </h2>
            <div className="w-full bg-black relative">
              <button
                type="button"
                onClick={() => router.push(`/watch/${item.id}?type=movie`)}
                className="group relative block w-full aspect-video overflow-hidden rounded-2xl border border-white/10"
                aria-label={_("media.watch")}
              >
                <Image
                  src={item.backdropUrl || item.posterUrl}
                  alt={item.title}
                  fill
                  sizes="100vw"
                  className="object-cover scale-105 transition-transform duration-700 ease-out group-hover:scale-100"
                  style={{ filter: "brightness(0.55) saturate(1.1)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />
                <span className="pointer-events-none absolute top-4 left-4 sm:top-6 sm:left-6 hidden text-sm sm:text-base font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent drop-shadow-lg">
                  Chillers
                </span>                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4 px-6 text-center">
                  <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#D70466] to-[#7C3AED] shadow-[0_12px_48px_rgba(215,4,102,0.55)] transition-transform duration-200 ease-out group-hover:scale-110">
                    <IconPlayerPlay className="h-7 w-7 sm:h-9 sm:w-9 text-white translate-x-0.5" fill="currentColor" />
                  </div>
                  <h3 className="text-xl sm:text-3xl font-black text-white drop-shadow-2xl">
                    {item.title}
                  </h3>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-[11px] sm:text-xs font-bold uppercase tracking-widest text-white/90">
                    <IconPlayerPlay className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" />
                    {_("media.watch")}
                  </span>
                </div>
              </button>
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
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <IconMovie className="h-12 w-12 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <IconPlayerPlay className="h-8 w-8 text-white mx-auto mb-2 opacity-90" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <IconPlayerPlay className="h-8 w-8 text-white mx-auto mb-2 opacity-90" />
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
                        <IconStar className="h-3 w-3" />
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

      {item && (
        <DownloadModal
          isOpen={showSingleDownload}
          onClose={() => setShowSingleDownload(false)}
          title={item.title}
          id={id}
          type={isTV ? 'series' : 'movie'}
        />
      )}
    </div>
  );
}

const MOVIE_ROWS_CONFIG = [
  { id: 'recent', title: 'Films récents & Nouveautés', variant: 'scroll' as const },
  { id: 'trending', title: 'Programmes exclusifs et popularités du moment', variant: 'poster' as const },
  { id: '28', title: 'Action & Aventure - Films', genreId: '28', variant: 'scroll' as const },
  { id: '35', title: 'Comédies - Films', genreId: '35', variant: 'scroll' as const },
  { id: '878', title: 'Science-Fiction & Fantastique', genreId: '878', variant: 'scroll' as const },
  { id: '99', title: 'Documentaires - Films', genreId: '99', variant: 'scroll' as const },
  { id: '37', title: 'Western - Films', genreId: '37', variant: 'scroll' as const },
  { id: '27', title: 'Horreur & Épouvante', genreId: '27', variant: 'scroll' as const },
  { id: '16', title: 'Animation & Famille', genreId: '16', variant: 'scroll' as const },
  { id: '18', title: 'Drames - Films', genreId: '18', variant: 'scroll' as const },
  { id: '53', title: 'Mystère & Thrillers', genreId: '53', variant: 'scroll' as const },
  { id: '10749', title: 'Romance - Films', genreId: '10749', variant: 'scroll' as const },
  { id: '80', title: 'Films policiers & Crime', genreId: '80', variant: 'scroll' as const },
  { id: '36', title: 'Histoire & Guerre', genreId: '36', variant: 'scroll' as const },
];

const SERIES_ROWS_CONFIG = [
  { id: 'recent', title: 'Séries récentes & Nouveautés', variant: 'scroll' as const },
  { id: 'trending', title: 'Programmes exclusifs et popularités du moment', variant: 'poster' as const },
  { id: '10759', title: 'Action & Aventure - Séries', genreId: '10759', variant: 'scroll' as const },
  { id: '18', title: 'Drames - Séries', genreId: '18', variant: 'scroll' as const },
  { id: '35', title: 'Comédies - Séries', genreId: '35', variant: 'scroll' as const },
  { id: '10765', title: 'Sci-Fi & Fantastique', genreId: '10765', variant: 'scroll' as const },
  { id: '9648', title: 'Mystère & Enquêtes', genreId: '9648', variant: 'scroll' as const },
  { id: '80', title: 'Crime & Séries policières', genreId: '80', variant: 'scroll' as const },
  { id: '16', title: 'Animation - Séries', genreId: '16', variant: 'scroll' as const },
  { id: '99', title: 'Documentaires - Séries', genreId: '99', variant: 'scroll' as const },
];

const ANIME_ROWS_CONFIG = [
  { id: 'recent', title: 'Anime récents & Tendances', variant: 'scroll' as const },
  { id: 'trending', title: 'Grands Classiques & Exclusivités', variant: 'poster' as const },
  { id: '10759', title: 'Shōnen & Action Aventure', genreId: '10759', variant: 'scroll' as const },
  { id: '10765', title: 'Sci-Fi & Isekai / Fantastique', genreId: '10765', variant: 'scroll' as const },
  { id: '16', title: 'Animation Japonaise', genreId: '16', variant: 'scroll' as const },
  { id: '35', title: 'Comédie & Slice of Life', genreId: '35', variant: 'scroll' as const },
];

function MediaListingPage() {
  const params = useParams();
  const type = params?.slug as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { translate: _ } = useLanguage();

  const [heroItems, setHeroItems] = useState<MovieOrShow[]>([]);
  const [categoryRows, setCategoryRows] = useState<Array<{ id: string; title: string; genreId?: string; variant: 'scroll' | 'poster'; items: MovieOrShow[] }>>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Single Genre Paginated Grid state
  const [gridItems, setGridItems] = useState<MovieOrShow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingGrid, setIsLoadingGrid] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);

  // Modal detail
  const [selectedMovie, setSelectedMovie] = useState<MovieOrShow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    const fetchGenres = type === "movies" ? getMovieGenres : getTVGenres;
    fetchGenres()
      .then(setGenres)
      .finally(() => setGenresLoading(false));
    setActiveGenreId(null);
    setPage(1);
  }, [type]);

  // Read ?genre= from URL on mount or change
  useEffect(() => {
    const genreParam = searchParams?.get("genre");
    setActiveGenreId(genreParam || null);
  }, [searchParams]);

  // Reset page when genre changes
  useEffect(() => {
    setPage(1);
  }, [activeGenreId]);

  // ── 1. Fetch Multi-Category Catalog (when activeGenreId is null) ──
  useEffect(() => {
    if (activeGenreId) return; // Not in multi-category mode

    let cancelled = false;
    async function loadCatalog() {
      setIsLoadingCatalog(true);
      try {
        const rowsConfig = type === "movies" 
          ? MOVIE_ROWS_CONFIG 
          : type === "series" 
            ? SERIES_ROWS_CONFIG 
            : ANIME_ROWS_CONFIG;

        // Fetch top hero items + initial rows in parallel
        let heroesPromise: Promise<MovieOrShow[]>;
        if (type === "movies") heroesPromise = getTrendingMovies();
        else if (type === "series") heroesPromise = getTrendingTV();
        else heroesPromise = getAnimeSeries(1);

        const heroes = await heroesPromise;
        if (cancelled) return;
        setHeroItems(heroes.slice(0, 6));

        // Initial 4 rows for fast paint
        const initialBatch = rowsConfig.slice(0, 4);
        const initialResults = await Promise.all(
          initialBatch.map(async (row) => {
            let rowItems: MovieOrShow[] = [];
            try {
              if (row.id === 'recent') {
                rowItems = type === "movies" 
                  ? await getPopularMovies(1) 
                  : type === "series" 
                    ? await getPopularTV(1) 
                    : await getAnimeSeries(1);
              } else if (row.id === 'trending') {
                rowItems = type === "movies" 
                  ? await getTrendingMovies() 
                  : type === "series" 
                    ? await getTrendingTV() 
                    : await getAnimeSeries(2);
              } else if (row.genreId) {
                if (type === "movies") {
                  rowItems = await getMoviesByGenre(row.genreId, 1);
                } else {
                  const tvRes = await getTVByGenrePage(row.genreId, 1);
                  rowItems = tvRes.results;
                }
              }
            } catch {}
            return { ...row, items: rowItems };
          })
        );

        if (cancelled) return;
        setCategoryRows(initialResults.filter(r => r.items.length > 0));
        setIsLoadingCatalog(false);

        // Progressively load remaining rows
        const remainingBatch = rowsConfig.slice(4);
        const remainingResults = await Promise.all(
          remainingBatch.map(async (row) => {
            let rowItems: MovieOrShow[] = [];
            try {
              if (row.genreId) {
                if (type === "movies") {
                  rowItems = await getMoviesByGenre(row.genreId, 1);
                } else {
                  const tvRes = await getTVByGenrePage(row.genreId, 1);
                  rowItems = tvRes.results;
                }
              }
            } catch {}
            return { ...row, items: rowItems };
          })
        );

        if (cancelled) return;
        setCategoryRows((prev) => {
          const valid = remainingResults.filter(r => r.items.length > 0);
          return [...prev, ...valid];
        });
      } catch (err) {
        console.error("Error loading catalog:", err);
      } finally {
        if (!cancelled) setIsLoadingCatalog(false);
      }
    }

    loadCatalog();
    return () => { cancelled = true; };
  }, [type, activeGenreId]);

  // ── 2. Fetch Single Genre Paginated Grid (when activeGenreId is set) ──
  useEffect(() => {
    if (!activeGenreId) return;

    let cancelled = false;
    async function fetchGridPage() {
      setIsLoadingGrid(true);
      try {
        let result: { results: MovieOrShow[]; totalPages: number } = { results: [], totalPages: 1 };
        if (type === "movies") {
          result = await getMoviesByGenrePage(activeGenreId!, page);
        } else {
          result = await getTVByGenrePage(activeGenreId!, page);
        }

        if (!cancelled) {
          setGridItems(result.results);
          setTotalPages(result.totalPages);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        console.error("Failed to load genre grid", err);
      } finally {
        if (!cancelled) setIsLoadingGrid(false);
      }
    }

    fetchGridPage();
    return () => { cancelled = true; };
  }, [type, page, activeGenreId]);

  const handleOpenDetails = (item: MovieOrShow) => {
    setSelectedMovie(item);
    setIsModalOpen(true);
  };

  const handlePlay = (item: MovieOrShow) => {
    router.push(`/watch/${item.id}?type=${item.type === "series" || item.type === "anime" ? "tv" : "movie"}`);
  };

  const handleSelectGenre = (id: string | null) => {
    setActiveGenreId(id);
    if (id) {
      router.push(`/media/${type}?genre=${id}`);
    } else {
      router.push(`/media/${type}`);
    }
  };

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
  const activeGenreName = genres.find(g => String(g.id) === activeGenreId)?.name;

  return (
    <main className="min-h-screen bg-brand-dark pt-16 sm:pt-20 pb-28">

      {/* ── Sticky genre filter bar with generous breathing room ── */}
      <div className={`sticky z-30 bg-brand-dark/95 backdrop-blur-md border-b border-zinc-800/40 px-2 sm:px-6 md:px-12 lg:px-[3%] py-3 transition-all duration-500 ${
        headerHidden ? "top-0" : "top-[60px] sm:top-[64px]"
      }`}>
        <GenreFilterBar
          genres={genres}
          activeGenreId={activeGenreId}
          onSelect={handleSelectGenre}
          isLoading={genresLoading}
        />
      </div>

      {/* ── MODE 1 : Multi-Category Carousel Catalog (Clean Prime Video Style) ── */}
      {!activeGenreId && (
        <div className="space-y-8 sm:space-y-10 pt-4 sm:pt-6">
          {/* Anime Powered Notice */}
          {type === "anime" && (
            <div className="px-2 sm:px-6 md:px-12 lg:px-[3%]">
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-brand-secondary/10 border border-brand-secondary/30">
                <IconSparkles className="h-4 w-4 text-brand-secondary" />
                <p className="text-xs font-bold text-white">{_("search.animePoweredBy")}</p>
              </div>
            </div>
          )}

          {/* Category Carousel Rows */}
          <div className="px-2 sm:px-6 md:px-12 lg:px-[3%] space-y-6 sm:space-y-8">
            {isLoadingCatalog && categoryRows.length === 0 ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <div key={rIdx} className="space-y-3">
                  <div className="h-5 w-48 bg-zinc-800 rounded skeleton-loading" />
                  <div className="flex gap-3 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, cIdx) => (
                      <div key={cIdx} className="aspect-video w-[240px] sm:w-[280px] bg-zinc-900 rounded-md skeleton-loading shrink-0" />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              categoryRows.map((row) => (
                <ScrollRow
                  key={row.id}
                  title={`${row.title} · ${type === 'movies' ? 'Films' : type === 'series' ? 'Séries' : 'Anime'}`}
                  seeAllHref={row.genreId ? `/media/${type}?genre=${row.genreId}` : undefined}
                  onSeeAll={row.genreId ? () => handleSelectGenre(row.genreId!) : undefined}
                  seeAllText="Voir plus"
                >
                  {row.items.map((item) => (
                    <MovieCard
                      key={item.id}
                      item={item}
                      variant={row.variant}
                      onPlay={handlePlay}
                      onOpenDetails={handleOpenDetails}
                    />
                  ))}
                </ScrollRow>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MODE 2 : Dedicated Filtered Genre Grid with Pagination ── */}
      {activeGenreId && (
        <div className="px-2 sm:px-6 md:px-12 lg:px-[3%] pt-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectGenre(null)}
                  className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <IconChevronLeft className="h-4 w-4" />
                  <span>Tous les {type === 'movies' ? 'films' : type === 'series' ? 'séries' : 'animes'}</span>
                </button>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                {activeGenreName ? `${title} · ${activeGenreName}` : title}
              </h1>
              <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>
            </div>
            {!isLoadingGrid && (
              <span className="text-xs text-zinc-500">
                {_("common.page")} <span className="text-white font-bold">{page}</span>/{_("common.of")} {totalPages}
              </span>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {isLoadingGrid
              ? Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="aspect-video rounded-md bg-zinc-900 skeleton-loading" />
                ))
              : gridItems.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    variant="grid"
                    onPlay={handlePlay}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
          </div>

          {/* Pagination */}
          {!isLoadingGrid && totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 flex-wrap">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <IconChevronLeft className="h-4 w-4" />
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
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Movie Modal */}
      {selectedMovie && (
        <MovieModal
          item={selectedMovie}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMovie(null);
          }}
          onWatch={handlePlay}
          onOpenDetails={handleOpenDetails}
        />
      )}
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
