"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
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
import UpgradeModal from "@/components/UpgradeModal";
import ScrollRow from "@/components/ScrollRow";
import MovieCard from "@/components/MovieCard";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { IconArrowLeft, IconPlayerPlay, IconStar, IconClock, IconCalendar, IconMovie, IconChevronLeft, IconChevronRight, IconDownload, IconShare, IconSparkles, IconBookmark, IconBookmarkFilled, IconPlaylist } from '@tabler/icons-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { userService } from '@/services/user';

import CatalogSpotlightHero from "@/components/CatalogSpotlightHero";

const MovieModal = dynamic(() => import("@/components/MovieModal"), { ssr: false });

const LISTING_TYPES = ["movies", "series", "anime"];

function MediaDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { translate: _, lang } = useLanguage();
  const { user, token, updateUser } = useAuthStore();

  const id = params?.slug as string;
  const isTV = searchParams?.get("type") === "tv" || searchParams?.get("type") === "series";

  useEffect(() => {
    if (isTV && id) {
      router.replace(`/tv/${id}`);
    }
  }, [isTV, id, router]);

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
  const [disponible, setDisponible] = useState<{ disponible: boolean; streaming: boolean; download: boolean; langueAudio?: string; isFrenchAudio?: boolean } | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, dispo, similarList] = await Promise.all([
        getMediaDetails(id, isTV),
        getDisponible(id, isTV ? 'series' : 'movie'),
        isTV ? getPopularTV(1) : getPopularMovies(1),
      ]);

      if (detail) {
        if (detail.trailerUrl) {
          setTrailerUrl(detail.trailerUrl);
        } else if (detail.videoUrl?.includes("youtube.com") || detail.videoUrl?.includes("embed")) {
          setTrailerUrl(detail.videoUrl);
        }
        setItem(detail);
      }
      if (dispo) setDisponible(dispo);
      if (detail?.similar && detail.similar.length > 0) {
        setSimilar(detail.similar);
      } else if (similarList) {
        setSimilar(similarList.filter((m) => m.id !== id).slice(0, 14));
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

  const handleWatch = async () => {
    if (!item) return;
    // Tout le streaming passe par /watch — on ne lance plus rien en inline
    // sur la page /media (le player a été retiré de cette vue).
    router.push(`/watch/${item.id}?type=${isTV ? "tv" : "movie"}`, { scroll: false });
  };

  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

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

  const handleDownload = () => {
    if (!user || (user?.subscription?.features && !user.subscription.features.hasDownloads)) {
      setShowUpgradeModal(true);
      return;
    }
    setShowSingleDownload(true);
  };

  const isFavorite = user?.favorites?.some((f) => f.tmdbId === String(item?.id) && f.mediaType === (isTV ? 'series' : 'movie'));

  const toggleFavorite = async () => {
    if (!token || !user || !item) return;
    setFavoriteLoading(true);
    try {
      const res = await userService.toggleFavorite(token, {
        mediaType: isTV ? 'series' : 'movie',
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
      <div className="flex-1 flex flex-col bg-[#09090B] text-white pb-20">
        {/* Bouton retour */}
        <div className="fixed top-0 left-0 z-40 p-4">
          <div className="w-10 h-10 rounded-full bg-black/70 border border-white/10" />
        </div>

        {/* 1. HERO SKELETON */}
        <div className="relative w-full min-h-[60vh] sm:h-[70vh] lg:h-[78vh] max-h-[750px] overflow-hidden bg-zinc-900 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 md:px-12 lg:px-16 pb-8 sm:pb-12 flex flex-col md:flex-row md:items-end gap-6 sm:gap-8">
            {/* Poster vertical */}
            <div className="relative w-[180px] sm:w-[210px] lg:w-[240px] aspect-[2/3] rounded-2xl bg-zinc-800 border border-white/10 shrink-0 shadow-2xl" />

            {/* Détails texte */}
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-zinc-800" />
                <div className="h-6 w-16 rounded-full bg-zinc-800" />
                <div className="h-6 w-12 rounded-full bg-zinc-800" />
              </div>
              <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-zinc-800" />
              <div className="h-4 w-1/3 rounded-lg bg-zinc-800" />
              <div className="flex gap-3 pt-2">
                <div className="h-11 w-36 rounded-full bg-zinc-800" />
                <div className="h-11 w-32 rounded-full bg-zinc-800" />
                <div className="h-11 w-11 rounded-full bg-zinc-800" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. POST-HERO SKELETON (2 Colonnes) */}
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-8 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonne Gauche : Synopsis + Casting */}
            <div className="lg:col-span-2 space-y-8">
              {/* Carte Synopsis */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-4 animate-pulse">
                <div className="h-6 w-32 bg-zinc-800 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-full" />
                  <div className="h-4 bg-zinc-800 rounded w-5/6" />
                  <div className="h-4 bg-zinc-800 rounded w-4/6" />
                </div>
              </div>

              {/* Carte Casting */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-4 animate-pulse">
                <div className="h-6 w-44 bg-zinc-800 rounded-lg" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
                        <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Colonne Droite : Specs Techniques */}
            <div className="lg:col-span-1">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-5 animate-pulse">
                <div className="h-6 w-40 bg-zinc-800 rounded-lg" />
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-zinc-800/50">
                      <div className="h-4 w-20 bg-zinc-800 rounded" />
                      <div className="h-4 w-28 bg-zinc-800 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SIMILAR MOVIES GRID SKELETON */}
          <div className="mt-14 space-y-6 animate-pulse">
            <div className="h-7 w-48 bg-zinc-800 rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl bg-zinc-800 border border-zinc-800/80" />
              ))}
            </div>
          </div>
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

      {/* 1. HERO SECTION */}
      <div className="relative w-full min-h-[65vh] sm:min-h-[70vh] lg:h-[78vh] max-h-[750px] overflow-hidden flex flex-col justify-end">
        {item.backdropOriginalUrl || item.backdropUrl ? (
          <Image
            src={item.backdropOriginalUrl || item.backdropUrl}
            alt={item.title}
            fill
            className="object-cover object-top filter brightness-[0.75]"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black" />
        )}

        {/* Dégradés cinéma pour immersion */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent max-w-4xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

        {/* Contenu du Hero */}
        <div className="relative z-20 w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 pb-8 sm:pb-12">
          <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 items-start sm:items-end w-full">
            {/* Poster vertical avec taille adaptative mobile / desktop */}
            <div className="relative flex-none w-28 sm:w-44 md:w-52 lg:w-56 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5 bg-zinc-900 shrink-0">
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 112px, (max-width: 1024px) 210px, 240px"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <IconMovie className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
              )}
            </div>

            {/* Informations textuelles */}
            <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
              {/* Badges : Disponibilité, Audio, Âge, Genres */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold">
                {disponible && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border ${
                      disponible.disponible
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : "border-red-500/40 text-red-400 bg-red-500/10"
                    }`}
                  >
                    {disponible.disponible ? "● Disponible" : "● Bientôt disponible"}
                  </span>
                )}

                {/* Badge Audio */}
                {(disponible?.langueAudio || item.langueAudio) && (disponible?.langueAudio !== 'UNKNOWN') && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-md ${
                    disponible?.isFrenchAudio || item.isFrenchAudio
                      ? 'bg-blue-600/90 text-white border border-blue-400/30' 
                      : 'bg-amber-600/90 text-white border border-amber-400/30'
                  }`}>
                    {disponible?.langueAudio === 'VFF' ? 'VF (TrueFrench)' : disponible?.langueAudio === 'VFQ' ? 'VF (Québec)' : (disponible?.langueAudio || item.langueAudio)}
                  </span>
                )}

                {item.contentRating && (
                  <span className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[10px] sm:text-xs font-mono">
                    {item.contentRating}
                  </span>
                )}

                {item.genres?.slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold text-zinc-300 bg-white/10 border border-white/10"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {/* Titre */}
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl">
                {item.title}
              </h1>

              {/* Tagline */}
              {item.tagline && (
                <p className="text-zinc-300 italic text-xs sm:text-sm font-medium line-clamp-1">
                  &ldquo;{item.tagline}&rdquo;
                </p>
              )}

              {/* Métadonnées : Note, Année, Durée */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-zinc-300 font-medium">
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <IconStar className="h-4 w-4 fill-amber-400" />
                  <span>{item.rating}</span>
                  <span className="text-zinc-500 text-[10px] sm:text-xs">/10</span>
                  {item.voteCount && (
                    <span className="text-zinc-500 text-[10px] font-normal">({item.voteCount.toLocaleString()})</span>
                  )}
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-1">
                  <IconCalendar className="h-4 w-4 text-zinc-500" />
                  <span>{item.year}</span>
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-1">
                  <IconClock className="h-4 w-4 text-zinc-500" />
                  <span>{item.duration}</span>
                </div>
              </div>

              {/* Synopsis court */}
              <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-3xl line-clamp-3">
                {item.synopsis || item.description}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2">
                <button
                  onClick={handleWatch}
                  disabled={!item || loading}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-full font-bold text-xs sm:text-sm transition-all hover:scale-105 shadow-xl whitespace-nowrap ${
                    !item || loading
                      ? "bg-zinc-800 border border-zinc-700 text-zinc-400 cursor-not-allowed"
                      : "bg-[#D70466] hover:bg-[#b5034f] text-white shadow-[#D70466]/30"
                  }`}
                >
                  <IconPlayerPlay className="h-4 w-4 fill-white" />
                  <span>{_("media.watch")}</span>
                </button>

                {item.trailerUrl && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs sm:text-sm transition-all hover:scale-105"
                  >
                    <IconMovie className="h-4 w-4" />
                    <span>Bande-annonce</span>
                  </button>
                )}

                <button
                  onClick={handleDownload}
                  disabled={!item || loading}
                  className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs sm:text-sm transition-all hover:scale-105"
                >
                  <IconDownload className="h-4 w-4" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>

                {user && (
                  <button
                    onClick={() => setShowPlaylistModal(true)}
                    aria-label={lang === 'fr' ? 'Enregistrer dans une playlist ou À regarder plus tard' : 'Save to playlist or watch later'}
                    title={lang === 'fr' ? 'Enregistrer dans...' : 'Save to...'}
                    className="p-3 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white transition-all hover:scale-105 backdrop-blur-md cursor-pointer"
                  >
                    <IconPlaylist className="h-4 w-4 text-cyan-400" />
                  </button>
                )}

                {user && (
                  <button
                    onClick={toggleFavorite}
                    disabled={favoriteLoading || !item}
                    className={`p-3 rounded-full border transition-all hover:scale-105 backdrop-blur-md ${
                      isFavorite
                        ? "bg-[#D70466]/90 border-[#D70466] text-white shadow-lg shadow-[#D70466]/40"
                        : "bg-black/50 border-white/20 text-white hover:bg-black/80"
                    }`}
                  >
                    {isFavorite ? (
                      <IconBookmarkFilled className="h-4 w-4" />
                    ) : (
                      <IconBookmark className="h-4 w-4" />
                    )}
                  </button>
                )}

                <div className="relative" ref={shareBtnRef}>
                  <button
                    onClick={handleShare}
                    aria-label="Partager"
                    className="p-3 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white transition-all hover:scale-105 backdrop-blur-md"
                  >
                    <IconShare className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTENU DÉTAILLÉ APRÈS LE HERO */}
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-10 space-y-12">
        {/* Grille Synopsis & Fiche Technique */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne gauche : Synopsis & Réalisateur */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-[#D70466]" />
                <span>Synopsis</span>
              </h2>
              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                {item.synopsis || item.description || "Aucun résumé disponible pour ce film."}
              </p>
            </section>

            {/* Casting avec photos (Carrousel sur 1 ligne) */}
            {item.castDetails && item.castDetails.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[#7C3AED]" />
                    <span>Casting & Personnages</span>
                  </h2>
                  <span className="text-xs text-zinc-500 font-medium">
                    {item.castDetails.length} acteurs
                  </span>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {item.castDetails.map((actor) => (
                    <div
                      key={actor.id}
                      className="flex-none w-24 sm:w-28 flex flex-col items-center text-center group"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-zinc-800 border border-white/10 group-hover:border-[#7C3AED]/50 transition-all shadow-lg mb-2 relative">
                        {actor.profileUrl ? (
                          <Image
                            src={actor.profileUrl}
                            alt={actor.name}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 font-black text-sm sm:text-base">
                            {actor.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#7C3AED] transition-colors">
                        {actor.name}
                      </p>
                      {actor.character && (
                        <p className="text-[10px] text-zinc-400 line-clamp-1">
                          {actor.character}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Colonne droite : Fiche Technique & Specs */}
          <div className="space-y-4">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white border-b border-zinc-800 pb-3">
                Informations du Film
              </h3>

              <div className="space-y-3 text-xs sm:text-sm">
                {item.directors && item.directors.length > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/40">
                    <span className="text-zinc-400">Réalisation</span>
                    <span className="font-semibold text-white truncate max-w-[160px]">{item.directors.join(", ")}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400">Qualité</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">1080p Full HD</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400">Version Audio</span>
                  <span className="font-bold text-blue-400">
                    {disponible?.langueAudio === 'VFF' ? 'VF (TrueFrench)' : (disponible?.langueAudio || 'VF / French')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400">Année</span>
                  <span className="text-white font-medium">{item.year}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400">Durée</span>
                  <span className="text-white font-medium">{item.duration}</span>
                </div>

                {item.genres && item.genres.length > 0 && (
                  <div className="flex justify-between items-start py-1 border-b border-zinc-800/40">
                    <span className="text-zinc-400">Genres</span>
                    <span className="text-white font-medium text-right max-w-[160px]">{item.genres.join(", ")}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-zinc-400">Note TMDB</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <IconStar className="w-3.5 h-3.5 fill-amber-400" />
                    {item.rating}/10
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. FILMS SIMILAIRES & RECOMMANDÉS */}
        {similar.length > 0 && (
          <section className="space-y-6 pt-6 border-t border-zinc-800/80 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
                <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
                <span>Films Similaires & Recommandés</span>
              </h2>
              <span className="text-xs text-zinc-400 font-semibold">{similar.length} titres</span>
            </div>
            <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6 w-full">
              {similar.map((sim) => (
                <MovieCard
                  key={sim.id}
                  item={sim}
                  variant="poster"
                  onOpenDetails={(m) => router.push(`/media/${m.id}`)}
                  onPlay={(m) => router.push(`/watch/${m.id}?type=movie`)}
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
                    onOpenDetails={(m) => router.push(`/media/${m.id}`)}
                    onPlay={(m) => router.push(`/watch/${m.id}?type=movie`)}
                  />
                ))}
              </ScrollRow>
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
          posterUrl={item.posterUrl}
          backdropUrl={item.backdropUrl}
        />
      )}

      {item && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          featureName="Le téléchargement de films et séries"
        />
      )}

      {item && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          media={{
            tmdbId: String(item.id),
            mediaType: isTV ? 'series' : 'movie',
            title: item.title,
            posterPath: item.posterUrl,
            backdropPath: item.backdropUrl,
          }}
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
    // Mobile: navigate directly instead of opening modal
    if (window.innerWidth < 768) {
      if (item.type === "series" || item.type === "anime") {
        router.push(`/tv/${item.id}`);
      } else {
        router.push(`/media/${item.id}`);
      }
      return;
    }
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
          <div className="hidden sm:grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
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

          {/* Mobile Horizontal Scroll */}
          <div className="sm:hidden">
            <ScrollRow title="" accentColor="primary" className="space-y-0">
              {isLoadingGrid
                ? Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="aspect-video rounded-md bg-zinc-900 skeleton-loading w-[40vw] flex-shrink-0" />
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
            </ScrollRow>
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
