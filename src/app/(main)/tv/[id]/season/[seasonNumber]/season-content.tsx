"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSeasonDetails, getMediaDetails, getStreamUrl, getPopularTV } from "@/services/media";
import type { Episode, MovieOrShow } from "@/types/media";
import VideoPlayer from "@/components/VideoPlayer";
import MovieCard from "@/components/MovieCard";
import SeriesDownloadModal from "@/features/downloads/SeriesDownloadModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconPlayerTrackPrev,
  IconPlayerTrackNext,
  IconMovie,
  IconDownload,
  IconShare,
  IconBookmark,
  IconBookmarkFilled,
  IconCheck,
  IconSparkles,
  IconLayersLinked,
} from "@tabler/icons-react";

export default function SeasonContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, updateUser } = useAuthStore();
  const { id, seasonNumber } = params;
  const targetEpNumber = searchParams?.get("ep") ? Number(searchParams.get("ep")) : null;
  const { translate: _ } = useLanguage();

  const [detailItem, setDetailItem] = useState<MovieOrShow | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamLoading, setStreamLoading] = useState(false);
  const [similar, setSimilar] = useState<MovieOrShow[]>([]);
  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [showBatchDownload, setShowBatchDownload] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const playerRef = useRef<HTMLDivElement>(null);
  const activeEpisodeRef = useRef<HTMLDivElement>(null);

  const isFavorite = user?.favorites?.some(
    (f) => f.tmdbId === String(id) && (f.mediaType === "series" || f.mediaType === "anime")
  );

  // Initialisation de la saison et des métadonnées
  useEffect(() => {
    async function fetchSeason() {
      setIsLoading(true);
      try {
        const [data, detail, popularList] = await Promise.all([
          getSeasonDetails(id as string, seasonNumber as string),
          getMediaDetails(id as string, true),
          getPopularTV(1).catch(() => []),
        ]);

        if (detail) {
          setDetailItem(detail);
          setShowTitle(detail.title);
        }

        if (popularList && popularList.length > 0) {
          setSimilar(popularList.filter((m) => m.id !== id).slice(0, 14));
        }

        if (data && data.episodes && data.episodes.length > 0) {
          const mapped: Episode[] = data.episodes.map((ep: any) => ({
            id: String(ep.id),
            title: ep.name,
            duration: `${ep.runtime || 24}m`,
            number: ep.episode_number,
            season: Number(seasonNumber),
            thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : detail?.backdropUrl || "",
            synopsis: ep.overview,
          }));
          setEpisodes(mapped);

          let initialIndex = 0;
          if (targetEpNumber) {
            const foundIdx = mapped.findIndex((e) => e.number === targetEpNumber);
            if (foundIdx !== -1) initialIndex = foundIdx;
          }
          setCurrentIndex(initialIndex);

          // Charger le stream initial
          if (mapped.length > 0) {
            setStreamLoading(true);
            try {
              const stream = await getStreamUrl(
                id as string,
                "series",
                Number(seasonNumber),
                mapped[initialIndex].number,
                detail?.title || (id as string)
              );
              setStreamUrl(stream?.embedUrl || "");
            } catch (err) {
              console.error("Stream error on initial load", err);
            } finally {
              setStreamLoading(false);
            }
          }
        } else {
          // Si pas d'épisodes, vérifier si c'est un film
          const movieDetail = await getMediaDetails(id as string, false);
          if (movieDetail && movieDetail.id) {
            router.replace(`/watch/${id}?type=movie`);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load season", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSeason();
  }, [id, seasonNumber, targetEpNumber, router]);

  const currentEpisode = episodes[currentIndex];

  // Chargement du flux vidéo
  const loadStream = useCallback(
    async (ep: Episode) => {
      if (!ep) return;
      const title = showTitle || (id as string);
      setStreamLoading(true);
      try {
        const stream = await getStreamUrl(id as string, "series", Number(seasonNumber), ep.number, title);
        setStreamUrl(stream?.embedUrl || "");
      } catch (err) {
        console.error("Stream error", err);
      } finally {
        setStreamLoading(false);
      }
    },
    [id, seasonNumber, showTitle]
  );

  // Navigation Épisodes
  const playEpisode = (index: number) => {
    setCurrentIndex(index);
    const ep = episodes[index];
    if (ep) {
      loadStream(ep);
      window.history.replaceState(null, "", `/tv/${id}/season/${seasonNumber}?ep=${ep.number}`);
    }
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goNext = () => {
    if (currentIndex < episodes.length - 1) {
      playEpisode(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      playEpisode(currentIndex - 1);
    }
  };

  // Toggle Favoris
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !user || !detailItem) return;
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
    const url = window.location.href;
    const title = showTitle ? `Regardez ${showTitle} sur CHILLERS` : "CHILLERS";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    setShareOpen(!shareOpen);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setShareOpen(false);
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white">
        <div className="pt-[72px] pb-16 px-4 sm:px-6 md:px-12 lg:px-16 space-y-6">
          <div className="w-full aspect-video bg-zinc-900 rounded-3xl animate-pulse max-h-[70vh]" />
          <div className="space-y-3">
            <div className="h-6 w-32 bg-zinc-800 rounded-full animate-pulse" />
            <div className="h-10 w-2/3 bg-zinc-800 rounded-2xl animate-pulse" />
            <div className="h-4 w-1/3 bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const mockItem: MovieOrShow | null = currentEpisode
    ? {
        id: id as string,
        title: `${showTitle || `S${seasonNumber}`} · E${currentEpisode.number}`,
        type: "series",
        description: currentEpisode.synopsis || "",
        synopsis: currentEpisode.synopsis || "",
        backdropUrl: currentEpisode.thumbnail || detailItem?.backdropUrl || "",
        posterUrl: detailItem?.posterUrl || "",
        rating: detailItem?.rating || 0,
        year: detailItem?.year || 0,
        duration: currentEpisode.duration,
        genres: detailItem?.genres || [],
        cast: detailItem?.cast || [],
        videoUrl: streamUrl,
      }
    : null;

  const validSeasons = detailItem?.seasons?.filter((s) => s.seasonNumber > 0) || [];

  return (
    <div className="min-h-screen bg-[#09090B] text-white select-none">
      
      {/* 2. SECTION CENTRALE DU LECTEUR VIDÉO (PLEIN ÉCRAN STREAMING) */}
      <div className="pt-[68px] pb-16 w-full">
        
        {/* Lecteur Vidéo Plein Écran */}
        <div ref={playerRef} className="w-full bg-black relative scroll-mt-20">
          <div className="w-full max-h-[60vh] sm:max-h-[75vh] aspect-video bg-black relative mx-auto overflow-hidden">
            {streamLoading || !mockItem ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 bg-zinc-950">
                <div className="animate-spin h-10 w-10 border-4 border-[#D70466] border-t-transparent rounded-full" />
                <p className="text-xs uppercase tracking-widest font-bold text-zinc-400">
                  Chargement de l&apos;épisode {currentEpisode?.number}…
                </p>
              </div>
            ) : (
              <VideoPlayer
                key={`${currentEpisode?.id ?? "ep"}-${streamUrl}`}
                item={mockItem}
                episode={currentEpisode}
                onBack={() => router.push(`/tv/${id}`)}
                onOpenDetails={() => router.push(`/tv/${id}`)}
              />
            )}
          </div>
        </div>

        {/* 3. CONTENU DÉTAILS DE L'ÉPISODE + TIROIR DE NAVIGATION DES ÉPISODES */}
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-6 sm:pt-8 space-y-10">
          
          {/* Barre Rapide Précédent / Épisode Actuel / Suivant */}
          {episodes.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-900/70 border border-white/5 backdrop-blur-xl">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <IconPlayerTrackPrev className="h-4 w-4" />
                <span className="hidden sm:inline">Épisode Précédent</span>
              </button>

              <div className="text-center truncate px-2 flex-1 min-w-0">
                <span className="text-[11px] font-black text-[#D70466] uppercase tracking-widest">
                  Saison {seasonNumber} · Épisode {currentEpisode?.number || 1}
                </span>
                <p className="text-xs sm:text-sm font-bold text-white truncate max-w-md mx-auto">
                  {currentEpisode?.title || `Épisode ${currentEpisode?.number}`}
                </p>
              </div>

              <button
                onClick={goNext}
                disabled={currentIndex >= episodes.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <span className="hidden sm:inline">Épisode Suivant</span>
                <IconPlayerTrackNext className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Grille Principale 2 Colonnes : Détails Épisode à gauche & Liste des Épisodes à droite */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
            
            {/* Colonne Gauche : Titre, Synopsis & Actions */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#D70466] font-black tracking-widest text-xs uppercase flex items-center gap-1 bg-[#D70466]/10 border border-[#D70466]/20 px-2.5 py-0.5 rounded-full">
                    <IconSparkles className="w-3 h-3" />
                    CHILLERS SÉRIE
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {currentEpisode?.duration}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {showTitle}
                </h1>
                
                <h2 className="text-lg sm:text-xl font-bold text-zinc-300">
                  Saison {seasonNumber} · Épisode {currentEpisode?.number} : {currentEpisode?.title}
                </h2>
              </div>

              {/* Boutons d'Action */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  onClick={() => setShowSingleDownload(true)}
                  disabled={!currentEpisode}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black hover:bg-[#E5E5EA] font-bold text-xs sm:text-sm transition-all shadow-lg cursor-pointer"
                >
                  <IconDownload className="h-4 w-4" />
                  <span>Télécharger l&apos;épisode</span>
                </button>

                <button
                  onClick={() => setShowBatchDownload(true)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  <IconLayersLinked className="h-4 w-4" />
                  <span>Télécharger la saison</span>
                </button>

                {user && (
                  <button
                    onClick={toggleFavorite}
                    disabled={favoriteLoading}
                    aria-label="Favoris"
                    className={`p-2.5 rounded-full border transition-all hover:scale-105 backdrop-blur-md cursor-pointer ${
                      isFavorite
                        ? "bg-[#D70466]/90 border-[#D70466] text-white shadow-lg shadow-[#D70466]/40"
                        : "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
                    }`}
                  >
                    {isFavorite ? (
                      <IconBookmarkFilled className="w-4 h-4" />
                    ) : (
                      <IconBookmark className="w-4 h-4" />
                    )}
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={handleShare}
                    aria-label="Partager"
                    className="p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white transition-all hover:scale-105 cursor-pointer"
                  >
                    <IconShare className="w-4 h-4" />
                  </button>

                  {shareOpen && (
                    <div className="absolute left-0 bottom-full mb-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-1 z-50 overflow-hidden">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent((showTitle || "Chillers") + " " + window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <span>WhatsApp</span>
                      </a>
                      <button
                        onClick={copyToClipboard}
                        className="w-full text-left flex items-center justify-between px-3 py-2 text-xs text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <span>{copiedLink ? "Lien copié !" : "Copier le lien"}</span>
                        {copiedLink && <IconCheck className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Synopsis de l'Épisode */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  Résumé de l&apos;épisode
                </h3>
                <p className="text-zinc-300 text-sm sm:text-base leading-relaxed font-normal">
                  {currentEpisode?.synopsis || "Aucun résumé disponible pour cet épisode."}
                </p>
              </div>

            </div>

            {/* Colonne Droite : Tiroir / Liste Complète des Épisodes de la Saison */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Épisodes de la Saison {seasonNumber}</span>
                  <span className="text-xs text-zinc-500 font-normal">({episodes.length})</span>
                </h3>

                {/* Sélecteur de Saisons Dropdown */}
                {validSeasons.length > 1 && (
                  <select
                    value={seasonNumber}
                    onChange={(e) => router.push(`/tv/${id}/season/${e.target.value}`)}
                    className="bg-zinc-900 border border-zinc-700 text-xs text-white rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:border-[#D70466]"
                  >
                    {validSeasons.map((s) => (
                      <option key={s.id} value={s.seasonNumber}>
                        {s.name || `Saison ${s.seasonNumber}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Liste Déroulante des Épisodes avec Cartes 16:9 et Indicateur de Lecture */}
              <div className="space-y-2.5 max-h-[650px] overflow-y-auto no-scrollbar pr-1">
                {episodes.map((ep, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => playEpisode(idx)}
                      className={`flex items-start gap-3.5 p-3 rounded-2xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-white/10 border border-[#D70466] shadow-lg"
                          : "bg-zinc-900/50 hover:bg-zinc-800/60 border border-zinc-800/60"
                      }`}
                    >
                      {/* Thumbnail 16:9 */}
                      <div className="relative flex-none w-28 aspect-video rounded-xl overflow-hidden bg-zinc-950">
                        {ep.thumbnail ? (
                          <Image
                            src={ep.thumbnail}
                            alt={ep.title}
                            fill
                            className="object-cover object-top"
                            sizes="112px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <IconMovie className="w-6 h-6" />
                          </div>
                        )}

                        {/* Overlay sombre */}
                        <div className="absolute inset-0 bg-black/30" />

                        {/* Badge Numéro d'épisode */}
                        <div className="absolute top-1.5 left-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white">
                            EP {ep.number}
                          </span>
                        </div>

                        {/* Indicateur de lecture en cours */}
                        {isActive && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-[#D70466] flex items-center justify-center">
                              <IconPlayerPlay className="w-4 h-4 fill-white translate-x-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Détails de l'épisode */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-xs sm:text-sm font-bold truncate ${isActive ? "text-[#D70466]" : "text-white"}`}>
                            {ep.number}. {ep.title}
                          </h4>
                          <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                            {ep.duration}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-normal">
                          {ep.synopsis || "Aucun résumé pour cet épisode."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* MODALE TÉLÉCHARGEMENT BATCH DE LA SAISON */}
      {episodes.length > 0 && (
        <SeriesDownloadModal
          isOpen={showBatchDownload}
          onClose={() => setShowBatchDownload(false)}
          seriesTitle={showTitle || `Saison ${seasonNumber}`}
          tmdbId={id as string}
          episodes={episodes}
        />
      )}

      {/* MODALE TÉLÉCHARGEMENT SINGLE ÉPISODE */}
      {currentEpisode && (
        <DownloadModal
          isOpen={showSingleDownload}
          onClose={() => setShowSingleDownload(false)}
          title={`${showTitle || `Saison ${seasonNumber}`} · S${seasonNumber}E${currentEpisode.number}`}
          id={id as string}
          type="series"
          season={Number(seasonNumber)}
          episode={currentEpisode.number}
          posterUrl={currentEpisode.thumbnail || detailItem?.posterUrl}
          backdropUrl={currentEpisode.thumbnail || detailItem?.backdropUrl}
        />
      )}

    </div>
  );
}
