"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  discoverMediaPage,
  type DiscoverSort,
  getMovieGenres,
  getTVGenres,
  getDisponible,
  getMediaLogo,
  getSimilarTitles,
} from "@/services/media";
import { useMediaDetails } from "@/hooks/useMediaDetails";
import { httpJson } from "@/services/http";
import type { Genre, MovieOrShow } from "@/types/media";
import GenreFilterBar from "@/components/GenreFilterBar";
import NotificationModal from "@/components/NotificationModal";
import AuthModal from "@/components/AuthModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import UpgradeModal from "@/components/UpgradeModal";
import MovieCard from "@/components/MovieCard";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import HilltopAd from "@/components/HilltopAd";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
import Button from "@/components/Button";
import CardImage from "@/components/CardImage";
import MediaLogo from "@/components/MediaLogo";
import { useLanguage } from "@/i18n/LanguageContext";
import { ArrowLeft, Play, Star, Clock, CalendarBlank, FilmSlate, CaretDown, DownloadSimple, ShareNetwork, Sparkle, BookmarkSimple, ListNumbers } from '@phosphor-icons/react';
import { useAuthStore } from '@/stores/useAuthStore';
import { userService } from '@/services/user';

import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const LISTING_TYPES = ["movies", "series", "anime"];

interface MediaPageProps {
  initialItem?: MovieOrShow | null;
  initialSimilar?: MovieOrShow[];
}

function MediaDetailPage({ initialItem, initialSimilar }: MediaPageProps) {
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

  const { data: itemData, isLoading: itemLoading } = useMediaDetails(id, isTV, {
    initialData: initialItem ?? undefined,
    staleTime: 5 * 60_000,
  });
  const item = itemData ?? null;
  const loading = itemLoading && !item;
  const [similar, setSimilar] = useState<MovieOrShow[]>(initialSimilar || []);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const trailerUrl = useMemo(() => {
    if (!item) return null;
    if (item.trailerUrl) return item.trailerUrl;
    if (item.videoUrl?.includes("youtube.com") || item.videoUrl?.includes("embed")) return item.videoUrl;
    return null;
  }, [item]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const shareBtnRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [sharePos, setSharePos] = useState<{ top: number; right: number } | null>(null);
  const [disponible, setDisponible] = useState<{ disponible: boolean; streaming: boolean; download: boolean; langueAudio?: string; isFrenchAudio?: boolean } | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"fr" | "vostfr">("fr");
  const castScrollRef = useRef<HTMLDivElement>(null);
  const [castCanScrollLeft, setCastCanScrollLeft] = useState(false);
  const [castCanScrollRight, setCastCanScrollRight] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chillers_preferred_lang") as "fr" | "vostfr" | null;
      if (saved && (saved === "fr" || saved === "vostfr")) {
        setSelectedLang(saved);
      }
    }
  }, []);

  const handleLangSelect = (l: "fr" | "vostfr") => {
    setSelectedLang(l);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("chillers_preferred_lang", l);
      } catch {}
    }
  };

  /** true si le film n'est pas encore sorti (date de sortie dans le futur) */
  const isUpcoming = Boolean(item?.releaseDate && new Date(item.releaseDate).getTime() > Date.now());
  const releaseDateLabel = useMemo(() => {
    if (!item?.releaseDate) return null;
    try {
      return new Date(item.releaseDate).toLocaleDateString(lang === "fr" ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return item.releaseDate; }
  }, [item?.releaseDate, lang]);

  const checkCastScroll = useCallback(() => {
    const el = castScrollRef.current;
    if (!el) return;
    setCastCanScrollLeft(el.scrollLeft > 4);
    setCastCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // Similaires : fetchés côté client uniquement quand le détail ne vient pas du RSC
  // (même comportement que l'ancien fetchData — le RSC fournit initialSimilar sinon).
  useEffect(() => {
    if (!id || !item || initialItem) return;
    let cancelled = false;
    getSimilarTitles(id, isTV, item)
      .then((s) => { if (!cancelled) setSimilar(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id, isTV, item, initialItem]);

  // Handle availability check separately (client-side only polling)
  useEffect(() => {
    let cancelled = false;
    const checkAvailability = async () => {
      const targetItem = item;
      if (!targetItem || !id) return;

      // Si le film n'est pas encore sorti, ne pas spammer /api/requests
      const unreleased = targetItem.releaseDate && new Date(targetItem.releaseDate).getTime() > Date.now();
      if (unreleased) {
        if (!cancelled) setDisponible({ disponible: false, streaming: false, download: false });
        return;
      }

      const dispo = await getDisponible(id, isTV ? 'series' : 'movie', targetItem.title);
      if (cancelled) return;
      if (dispo) setDisponible(dispo);

      if (!dispo?.disponible && targetItem.title) {
        httpJson("/api/requests", {
          method: "POST",
          body: {
            tmdbId: Number(id),
            title: targetItem.title,
            type: isTV ? "series" : "movie",
            year: typeof targetItem.year === "number" ? targetItem.year : targetItem.year ? parseInt(String(targetItem.year)) : undefined,
            posterUrl: targetItem.posterUrl,
          },
        }).catch(() => {});

        let attempts = 0;
        const pollTimer = setInterval(async () => {
          attempts++;
          if (attempts > 2 || cancelled) {
            clearInterval(pollTimer);
            return;
          }
          const updatedDispo = await getDisponible(id, isTV ? 'series' : 'movie', targetItem.title);
          if (updatedDispo?.disponible) {
            setDisponible(updatedDispo);
            clearInterval(pollTimer);
          }
        }, 8000);
      }
    };
    checkAvailability();
    return () => { cancelled = true; };
  }, [id, item, isTV]);

  useEffect(() => {
    if (item?.castDetails?.length) {
      requestAnimationFrame(checkCastScroll);
    }
  }, [item?.castDetails, checkCastScroll]);

  // Load logo on item change
  useEffect(() => {
    if (!item || !id || item.logoUrl) return;
    let cancelled = false;
    
    const loadLogo = async () => {
      try {
        const logo = await getMediaLogo(id, isTV);
        if (logo && !cancelled) {
          setLogoUrl(logo);
        }
      } catch {}
    };
    
    loadLogo();
    return () => { cancelled = true; };
  }, [item?.id, isTV]);

  const handleWatch = async () => {
    if (!item) return;
    // Tout le streaming passe par /watch — on ne lance plus rien en inline
    // sur la page /media (le player a été retiré de cette vue).
    router.push(`/watch/${item.id}?type=${isTV ? "tv" : "movie"}&lang=${selectedLang}`, { scroll: false });
  };

  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
      } catch { }
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-[#1F1F1F] text-white pb-20">
        {/* Bouton retour */}
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => { window.scrollTo(0, 0); router.back(); }}
            aria-label={_("media.back") || "Retour"}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-xl border border-white/15 text-white transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* 1. HERO SKELETON */}
        <div className="relative w-full min-h-[60vh] sm:h-[70vh] lg:h-[78vh] max-h-[750px] overflow-hidden bg-zinc-900 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 md:px-12 lg:px-16 pb-8 sm:pb-12 flex flex-col md:flex-row md:items-end gap-6 sm:gap-8">
            {/* Poster vertical */}
            <div className="relative w-[180px] sm:w-[210px] lg:w-[240px] aspect-[2/3] rounded-2xl bg-zinc-800 border border-white/10 shrink-0" />

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
      <div className="min-h-screen bg-[#1F1F1F] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <FilmSlate className="h-16 w-16 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 text-lg">{_("media.notFound")}</p>
          <button
            onClick={() => { window.scrollTo(0, 0); router.back(); }}
            className="px-6 py-2 rounded-full bg-brand-primary text-white text-sm font-bold hover:bg-[#b5034f] transition-colors"
          >
            {_("media.back")}
          </button>
        </div>
      </div>
    );
  }

  const heroImageUrl = item.posterUrl || item.backdropUrl || item.backdropOriginalUrl;
  const desktopBackdropUrl = item.backdropUrl || item.backdropOriginalUrl;
  const isYouTube = trailerUrl?.includes("youtube.com") || trailerUrl?.includes("embed");

  return (
    <div className="flex-1 flex flex-col text-white pb-20 sm:pb-0">
      {/* Le backdrop continue sous le hero : image floutée, assombrie pour la lisibilité */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#1F1F1F]">
        {(item.backdropUrl || item.backdropOriginalUrl) && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.backdropUrl || item.backdropOriginalUrl}
              alt=""
              className="h-full w-full scale-110 object-cover object-top opacity-50 blur-2xl saturate-150 sm:scale-125 sm:opacity-70 sm:blur-3xl"
            />
            <div className="absolute inset-0 bg-[#1F1F1F]/40" />
          </>
        )}
      </div>

      {/* Floating Back Button (Mobile & Desktop) */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => { window.scrollTo(0, 0); router.back(); }}
          aria-label={_("media.back") || "Retour"}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-xl border border-white/15 text-white transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 1. HERO SECTION */}
      <div className="relative flex w-full flex-col justify-end overflow-hidden sm:min-h-[70vh] sm:max-h-[750px] lg:h-[78vh]">
        {heroImageUrl ? (
          <>
            {/* Mobile : affiche portrait (comme oha.to), non recadrée */}
            <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden sm:hidden">
              <Image
                src={heroImageUrl}
                alt={item.title}
                fill
                className="object-cover object-center"
                sizes="100vw"
                quality={85}
                priority
              />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#1F1F1F] to-transparent" />
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
            </div>
            {/* Desktop : backdrop plein écran */}
            {desktopBackdropUrl && (
              <div className="relative hidden sm:absolute sm:inset-0 sm:block">
                <Image
                  src={desktopBackdropUrl}
                  alt={item.title}
                  fill
                  className="object-cover object-top"
                  sizes="100vw"
                  quality={85}
                  priority
                />
              </div>
            )}
          </>
        ) : (
          <div className="h-56 w-full bg-gradient-to-b from-zinc-800 to-black sm:absolute sm:inset-0 sm:h-full" />
        )}

        {/* Dégradé gauche à droite (desktop) */}
        <div className="absolute inset-0 hidden max-w-4xl bg-gradient-to-r from-black via-black/60 to-transparent sm:block" />

        {/* Dégradé du bas avec petite hauteur (desktop) */}
        <div className="absolute bottom-0 left-0 right-0 hidden h-16 bg-gradient-to-t from-[#1F1F1F] via-[#1F1F1F]/40 to-transparent sm:block sm:from-[#09090B] sm:via-[#09090B]/40" />

        {/* Contenu du Hero */}
        <div className="relative z-20 w-full px-4 pb-8 pt-4 sm:px-8 sm:pb-12 sm:pt-24 md:px-12 lg:px-16">
          <div className="flex w-full flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:gap-8 sm:text-left">
            {/* Poster vertical (desktop) : masqué sur mobile pour un hero image simple */}
            <div className="relative hidden aspect-[2/3] w-44 flex-none shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 ring-1 ring-white/5 sm:block md:w-52 lg:w-56">
              <CardImage
                src={item.posterUrl}
                alt={item.title}
                fill
                className="object-cover object-top"
                sizes="(max-width: 640px) 112px, (max-width: 1024px) 210px, 240px"
                priority
                fallbackText={item.title}
              />
            </div>

            {/* Informations textuelles */}
            <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
              {/* Badges : Disponibilité, Audio, Âge, Genres */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold sm:justify-start sm:gap-2">
                {isUpcoming && releaseDateLabel ? (
                  <span className="max-sm:hidden px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border-0 flex items-center shadow-none">
                    <span>Sortie au cinéma le {releaseDateLabel}</span>
                  </span>
                ) : disponible && (
                  <span
                    className={`max-sm:hidden px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border-0 ${disponible.disponible
                        ? "text-brand-primary bg-brand-primary/10"
                        : "text-blue-300 bg-blue-500/15"
                      }`}
                  >
                    {disponible.disponible ? "● Disponible" : "● Bientôt disponible"}
                  </span>
                )}

                {/* Badge Audio */}
                {(disponible?.langueAudio || item.langueAudio) && (disponible?.langueAudio !== 'UNKNOWN') && (
                  <span className={`max-sm:hidden px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border-0 shadow-none ${disponible?.isFrenchAudio || item.isFrenchAudio
                      ? 'bg-brand-primary/90 text-white'
                      : 'bg-amber-600/90 text-white'
                    }`}>
                    {disponible?.langueAudio === 'VFF' ? 'VF (TrueFrench)' : disponible?.langueAudio === 'VFQ' ? 'VF (Québec)' : (disponible?.langueAudio || item.langueAudio)}
                  </span>
                )}

                {item.contentRating && (
                  <span className="px-2 py-0.5 rounded bg-zinc-900/80 border-0 text-zinc-300 text-[10px] sm:text-xs font-mono">
                    {item.contentRating}
                  </span>
                )}

                {item.genres?.slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold text-zinc-300 bg-white/10 border-0"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {/* Logo officiel (principale), fallback titre — masqué en mobile (l'affiche porte déjà le titre) */}
              <div className="max-sm:hidden">
                {(item.logoUrl || logoUrl) ? (
                  <MediaLogo src={item.logoUrl || logoUrl || ""} alt={`Logo ${item.title}`} />
                ) : (
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl">
                    {item.title}
                  </h1>
                )}
              </div>

              {/* Tagline */}
              {item.tagline && (
                <p className="text-zinc-300 italic text-xs sm:text-sm font-medium line-clamp-1">
                  &ldquo;{item.tagline}&rdquo;
                </p>
              )}

              {/* Métadonnées : Note, Année / Date de sortie, Durée */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-zinc-300 sm:justify-start sm:gap-4 sm:text-sm">
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="h-4 w-4 fill-amber-400" />
                  <span>{item.rating}</span>
                  <span className="text-zinc-500 text-[10px] sm:text-xs">/10</span>
                  {item.voteCount && (
                    <span className="text-zinc-500 text-[10px] font-normal">({item.voteCount.toLocaleString()})</span>
                  )}
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-1">
                  <span>{isUpcoming ? "Bientôt dispo" : item.year}</span>
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-zinc-500" />
                  <span>{item.duration}</span>
                </div>
              </div>

              {/* Synopsis court */}
              <p className="mx-auto max-w-3xl text-zinc-300 text-xs sm:text-sm leading-relaxed line-clamp-3 sm:mx-0">
                {item.synopsis || item.description}
              </p>

              {/* Actions : Regarder seul sur sa ligne, VF + icônes sur la suivante (sans bordure sur mobile) */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-3">
                {isUpcoming ? (
                  <Button
                    disabled
                    variant="dark"
                    size="md"
                    text="Bientôt dispo"
                    ariaLabel={`Sortie prévue le ${releaseDateLabel}`}
                    className="w-full cursor-not-allowed border-0 bg-blue-600/20 font-bold text-blue-200 opacity-90 shadow-none sm:w-auto"
                  />
                ) : (
                  <Button
                    onClick={handleWatch}
                    disabled={!item || loading}
                    variant="primary"
                    size="md"
                    text={_("media.watch")}
                    leftIcon={<Play className="h-4 w-4 fill-current" />}
                    ariaLabel={`Regarder le film ${item?.title || ""}`}
                    className="w-full max-sm:!bg-white max-sm:!text-black max-sm:border-white max-sm:shadow-none sm:w-auto"
                  />
                )}

                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:contents sm:justify-start sm:gap-3">
                  {!isUpcoming && (
                    <div className="flex items-center rounded-xl bg-white/5 p-1 backdrop-blur-md max-sm:border-0">
                      <button
                        type="button"
                        onClick={() => handleLangSelect("fr")}
                        className={`px-3 py-2 rounded-[5px] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedLang === "fr"
                            ? "bg-brand-primary text-white shadow-md shadow-brand-primary/30"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span>VF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLangSelect("vostfr")}
                        className={`px-3 py-2 rounded-[5px] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedLang === "vostfr"
                            ? "bg-brand-primary text-white shadow-md shadow-brand-primary/30"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span>VOSTFR</span>
                      </button>
                    </div>
                  )}

                  {!isUpcoming && (
                    <Button
                      onClick={handleDownload}
                      disabled={!item || loading}
                      variant="dark"
                      size="md"
                      leftIcon={<DownloadSimple className="h-4 w-4" />}
                      ariaLabel={`Télécharger ${item.title}`}
                      className="max-sm:!rounded-full max-sm:!border-0 max-sm:!bg-white/10 max-sm:px-3"
                    >
                      <span className="max-sm:hidden">Télécharger</span>
                    </Button>
                  )}

                  {user && (
                    <Button
                      onClick={() => setShowPlaylistModal(true)}
                      variant="outline"
                      size="icon"
                      title={lang === "fr" ? "Enregistrer dans une playlist ou À regarder plus tard" : "Save to playlist or watch later"}
                      ariaLabel={lang === "fr" ? "Enregistrer dans une playlist" : "Save to playlist"}
                      icon={<ListNumbers className="h-4 w-4 text-cyan-400 opacity-75" />}
                      className="max-sm:!rounded-full max-sm:!border-0 max-sm:!bg-white/10"
                    />
                  )}

                  {user && (
                    <Button
                      onClick={toggleFavorite}
                      disabled={favoriteLoading || !item}
                      variant={isFavorite ? "primary" : "outline"}
                      size="icon"
                      ariaLabel={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                      icon={<BookmarkSimple className="w-4 h-4" />}
                      className={`max-sm:!rounded-full max-sm:!border-0 ${isFavorite ? "" : "max-sm:!bg-white/10"}`}
                    />
                  )}

                  <div className="relative" ref={shareBtnRef}>
                    <Button
                      onClick={handleShare}
                      variant="outline"
                      size="icon"
                      ariaLabel="Partager le film"
                      icon={<ShareNetwork className="h-4 w-4" />}
                      className="max-sm:!rounded-full max-sm:!border-0 max-sm:!bg-white/10"
                    />
                  </div>
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
            <section className=" p-6 space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                {/* <span className="h-4 w-1 rounded-full bg-brand-primary" /> */}
                <span>Info</span>
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
                    <span className="h-4 w-1 rounded-full bg-brand-primary" />
                    <span>Casting & Personnages</span>
                  </h2>
                  <span className="text-xs text-zinc-500 font-medium">
                    {item.castDetails.length} acteurs
                  </span>
                </div>
                <div className="relative group/cast">
                  <div
                    ref={castScrollRef}
                    onScroll={checkCastScroll}
                    className="flex gap-4 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
                  >
                    {item.castDetails.map((actor) => (
                      <Link
                        key={actor.id}
                        href={`/person/${actor.id}`}
                        className="flex-none w-24 sm:w-28 flex flex-col items-center text-center group"
                      >
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-zinc-800 border border-white/10 group-hover:border-brand-primary/50 transition-all shadow-lg mb-2 relative">
                          {actor.profileUrl ? (
                            <CardImage
                              src={actor.profileUrl}
                              alt={actor.name}
                              fill
                              className="object-cover"
                              sizes="96px"
                              fallbackText={actor.name.charAt(0)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600 font-black text-sm sm:text-base">
                              {actor.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-brand-primary transition-colors">
                          {actor.name}
                        </p>
                        {actor.character && (
                          <p className="text-[10px] text-zinc-400 line-clamp-1">
                            {actor.character}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                  {castCanScrollLeft && (
                    <button
                      onClick={() => castScrollRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
                      className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 items-center justify-center h-9 w-9 rounded-full bg-black/70 border border-white/20 hover:bg-black/90 cursor-pointer transition-all"
                      aria-label="Défiler vers la gauche"
                    >
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  )}
                  {castCanScrollRight && (
                    <button
                      onClick={() => castScrollRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
                      className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 items-center justify-center h-9 w-9 rounded-full bg-black/70 border border-white/20 hover:bg-black/90 cursor-pointer transition-all"
                      aria-label="Défiler vers la droite"
                    >
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
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
                  <span className="font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded">1080p Full HD</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-zinc-800/40">
                  <span className="text-zinc-400">Version Audio</span>
                  <span className="font-bold text-brand-primary">
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
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {item.rating}/10
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. FILMS SIMILAIRES & RECOMMANDÉS */}
        {similar.length > 0 && (
          <section className="space-y-4 sm:space-y-6 pt-6 sm:pt-8 border-t border-zinc-800/80 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
                <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
                <span>Films Similaires & Recommandés</span>
              </h2>
              <span className="text-xs text-zinc-400 font-semibold">{similar.length} titres</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5 w-full">
              {similar.map((sim) => (
                <MovieCard
                  key={sim.id}
                  item={sim}
                  variant="grid-poster"
                  onOpenDetails={(m) => router.push(`/media/${m.id}`)}
                  onPlay={(m) => router.push(`/watch/${m.id}?type=movie`)}
                />
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
            className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${trailerUrl}?autoplay=1&controls=1&rel=0&modestbranding=1`}
              className="w-full h-full border-none bg-black"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; gyroscope; accelerometer"
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

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

/** Options de tri du catalogue — tendance du moment par défaut. */
const SORT_OPTIONS: Array<{ id: DiscoverSort; label: string }> = [
  { id: "trending", label: "Tendance" },
  { id: "recent", label: "Date" },
  { id: "rating", label: "Mieux notées" },
];

const SORT_IDS: DiscoverSort[] = ["trending", "rating", "recent", "oldest"];

/** URL du listing pilotée par l'URL : ?genre= et ?sort= (tendance = défaut, non sérialisé). */
function buildListingQuery(type: string, genreId: string | null, sort: DiscoverSort) {
  const qs = new URLSearchParams();
  if (genreId) qs.set("genre", genreId);
  if (sort !== "trending") qs.set("sort", sort);
  const q = qs.toString();
  return `/media/${type}${q ? `?${q}` : ""}`;
}

function MediaListingPage() {
  const params = useParams();
  const type = params?.slug as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { translate: _ } = useLanguage();

  // Grille infinie : items === null ⇒ chargement initial en cours
  const [items, setItems] = useState<MovieOrShow[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Genre et tri pilotés par l'URL (source de vérité, pas d'effet de synchro)
  const activeGenreId = useMemo(() => searchParams?.get("genre") || null, [searchParams]);
  const sort = useMemo<DiscoverSort>(() => {
    const param = searchParams?.get("sort") as DiscoverSort | null;
    return param && SORT_IDS.includes(param) ? param : "trending";
  }, [searchParams]);

  // Genres mis en cache par famille (movie / tv) — loading dérivé, sans setState dans l'effet
  const [genresByFamily, setGenresByFamily] = useState<Record<string, Genre[] | undefined>>({});
  const genreFamily = type === "movies" ? "movies" : "tv";
  const genres = genresByFamily[genreFamily];
  const genresLoading = genres === undefined;

  useEffect(() => {
    if (genresByFamily[genreFamily]) return;
    let cancelled = false;
    const fetcher = genreFamily === "movies" ? getMovieGenres : getTVGenres;
    fetcher()
      .then((g) => {
        if (!cancelled) setGenresByFamily((prev) => ({ ...prev, [genreFamily]: g }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [genreFamily, genresByFamily]);

  // Ajustement pendant le rendu (pattern React officiel) : la nouvelle requête
  // (type / genre / tri) remet la page 1 et vide la grille affichée.
  const queryKey = `${type}|${activeGenreId}|${sort}`;
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (prevQueryKey !== queryKey) {
    setPrevQueryKey(queryKey);
    setPage(1);
    setItems(null);
    setIsLoadingMore(false);
  }

  // Catalogue : une seule grille infinie (découverte TMDB, tendance par défaut).
  // Seuls des setState asynchrones (callbacks) sont appelés ici.
  useEffect(() => {
    let cancelled = false;
    discoverMediaPage(type as "movies" | "series" | "anime", {
      genreId: activeGenreId,
      sort,
      page,
    })
      .then((res) => {
        if (cancelled) return;
        setTotalPages(res.totalPages);
        setItems((prev) =>
          page === 1 || !prev ? res.results : [
            ...prev,
            ...res.results.filter((i) => !prev.some((p) => p.id === i.id)),
          ],
        );
        setIsLoadingMore(false);
      })
      .catch((err) => {
        console.error("Error loading catalog:", err);
        if (!cancelled) {
          setItems((prev) => prev ?? []);
          setIsLoadingMore(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [type, activeGenreId, sort, page]);

  const isLoading = items === null;
  const visibleItems = items ?? [];
  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setPage((prev) => prev + 1);
    }
  }, [isLoading, isLoadingMore, hasMore]);

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoading || isLoadingMore,
    rootMargin: "600px",
  });

  const handleOpenDetails = (item: MovieOrShow) => {
    router.push(item.type === "series" || item.type === "anime" ? `/tv/${item.id}` : `/media/${item.id}`);
  };

  const handlePlay = (item: MovieOrShow) => {
    router.push(`/watch/${item.id}?type=${item.type === "series" || item.type === "anime" ? "tv" : "movie"}`);
  };

  // Genre et tri pilotés par l'URL : liens partageables + Header synchronisé
  const handleSelectGenre = (id: string | null) => {
    router.push(buildListingQuery(type, id, sort));
  };

  const handleSelectSort = (id: DiscoverSort) => {
    router.push(buildListingQuery(type, activeGenreId, id));
  };

  const titles: Record<string, string> = {
    movies: _("home.blockbusterMovies"),
    series: _("home.featuredSeries"),
    anime: _("home.globalAnime"),
  };
  const title = titles[type] || type;
  const activeGenreName = genres?.find((g) => String(g.id) === activeGenreId)?.name;

  return (
    <main className="min-h-screen bg-brand-dark pt-24 sm:pt-28 lg:pt-24 pb-28">
      {/* Bandeau Anime Powered */}
      {type === "anime" && (
        <div className="px-2 sm:px-6 md:px-12 lg:px-[3%] mb-4">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-brand-secondary/10 border border-brand-secondary/30">
            <Sparkle className="h-4 w-4 text-brand-secondary" />
            <p className="text-xs font-bold text-white">{_("search.animePoweredBy")}</p>
          </div>
        </div>
      )}

      {/* Titre + sélecteurs (tri : tendance par défaut / date / note, et genre) */}
      <div className="px-2 sm:px-6 md:px-12 lg:px-[3%] py-2 mb-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight shrink-0">
            {type === "movies"
              ? _("nav.movies") || "Films"
              : type === "series"
                ? _("nav.series") || "Séries"
                : type === "anime"
                  ? _("nav.anime") || "Anime"
                  : title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tri : Tendance (défaut) / Date / Mieux notées */}
            <div className="relative inline-flex items-center">
              <select
                value={sort}
                onChange={(e) => handleSelectSort(e.target.value as DiscoverSort)}
                aria-label="Trier le catalogue"
                className="appearance-none bg-zinc-900/95 hover:bg-zinc-800 text-white font-semibold cursor-pointer transition-all border border-zinc-700/80 hover:border-zinc-500 focus:outline-none focus:border-brand-primary shadow-md tracking-tight text-xs sm:text-sm py-1.5 sm:py-2 pl-3 pr-8 rounded-xl min-w-[130px] sm:min-w-[160px]"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-zinc-900 text-white font-medium">
                    {opt.label}
                  </option>
                ))}
              </select>
              <CaretDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                weight="bold"
              />
            </div>

            <GenreFilterBar
              genres={genres ?? []}
              activeGenreId={activeGenreId}
              onSelect={handleSelectGenre}
              isLoading={genresLoading}
            />
          </div>
        </div>

        {activeGenreName && (
          <p className="mt-1 text-xs text-zinc-500">
            {title} · {activeGenreName}
          </p>
        )}
      </div>

      {/* Grille de cartes (scroll infini) */}
      <div className="px-2 sm:px-6 md:px-12 lg:px-[3%] pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
          {visibleItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <MovieCard
                item={item}
                variant="grid-poster"
                onPlay={handlePlay}
                onOpenDetails={handleOpenDetails}
              />
              {type === "movies" || type === "series" || type === "anime" ? (
                <>
                  {(index + 1) % 20 === 0 && (
                    <HilltopAd className="col-span-full flex w-full items-center justify-center overflow-hidden rounded-xl bg-white/[0.02] sm:hidden" />
                  )}
                  {(index + 1) % 30 === 0 && (
                    <HilltopAd className="col-span-full hidden w-full items-center justify-center overflow-hidden rounded-xl bg-white/[0.02] sm:flex md:hidden" />
                  )}
                  {(index + 1) % 40 === 0 && (
                    <HilltopAd className="col-span-full hidden w-full items-center justify-center overflow-hidden rounded-xl bg-white/[0.02] md:flex lg:hidden" />
                  )}
                  {(index + 1) % 80 === 0 && (
                    <HilltopAd className="col-span-full hidden w-full items-center justify-center overflow-hidden rounded-xl bg-white/[0.02] lg:flex" />
                  )}
                </>
              ) : null}
            </React.Fragment>
          ))}
          {(isLoading || isLoadingMore) &&
            Array.from({ length: isLoading ? 15 : 10 }).map((_, i) => (
              <MovieCardSkeleton key={`skeleton-${i}`} variant="grid-poster" />
            ))}
        </div>

        {hasMore && (
          <div
            ref={sentinelRef}
            className="w-full py-8 flex flex-col items-center justify-center gap-2"
          >
            {isLoadingMore && (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-zinc-900/80 border border-white/10 text-xs font-semibold text-zinc-400">
                <div className="w-4 h-4 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                <span>Chargement des vidéos suivantes…</span>
              </div>
            )}
          </div>
        )}

        {!isLoading && !isLoadingMore && visibleItems.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            Aucun résultat pour ces filtres.
          </p>
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

export default function MediaPage({ initialItem, initialSimilar }: MediaPageProps) {
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
      <MediaDetailPage initialItem={initialItem} initialSimilar={initialSimilar} />
    </Suspense>
  );
}
