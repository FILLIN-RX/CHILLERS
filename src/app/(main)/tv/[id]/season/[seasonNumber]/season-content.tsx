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
import AuthModal from "@/components/AuthModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import { ArrowLeft, Play, CaretCircleLeft, CaretCircleRight, FilmSlate, DownloadSimple, ShareNetwork, BookmarkSimple, Check, Sparkle, LinkSimple, Translate } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import NetflixDownloadButton from "@/components/NetflixDownloadButton";

export default function SeasonContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, updateUser } = useAuthStore();
  const { id, seasonNumber } = params;
  const targetEpNumber = searchParams?.get("ep") ? Number(searchParams.get("ep")) : null;
  const initialLang = searchParams?.get("lang") === "vostfr" ? "vostfr" : "fr";
  const { translate: _ } = useLanguage();

  const [detailItem, setDetailItem] = useState<MovieOrShow | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioVersion, setAudioVersion] = useState<"fr" | "vostfr">(initialLang);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamLoading, setStreamLoading] = useState(false);
  const [similar, setSimilar] = useState<MovieOrShow[]>([]);
  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [showBatchDownload, setShowBatchDownload] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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
                detail?.title || (id as string),
                undefined,
                undefined,
                undefined,
                undefined,
                initialLang
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
  }, [id, seasonNumber, targetEpNumber, initialLang, router]);

  const currentEpisode = episodes[currentIndex];

  // Chargement du flux vidéo
  const loadStream = useCallback(
    async (ep: Episode, lang: "fr" | "vostfr" = audioVersion) => {
      if (!ep) return;
      const title = showTitle || (id as string);
      setStreamLoading(true);
      try {
        const stream = await getStreamUrl(
          id as string,
          "series",
          Number(seasonNumber),
          ep.number,
          title,
          undefined,
          undefined,
          undefined,
          undefined,
          lang
        );
        setStreamUrl(stream?.embedUrl || "");
      } catch (err) {
        console.error("Stream error", err);
      } finally {
        setStreamLoading(false);
      }
    },
    [id, seasonNumber, showTitle, audioVersion]
  );

  const handleLanguageChange = (lang: "fr" | "vostfr") => {
    if (lang === audioVersion) return;
    setAudioVersion(lang);
    if (currentEpisode) {
      loadStream(currentEpisode, lang);
    }
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("lang", lang);
      window.history.replaceState(null, "", currentUrl.toString());
    }
  };

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
          <div className="w-full h-[36vh] xs:h-[40vh] sm:h-auto sm:aspect-video min-h-[260px] xs:min-h-[300px] sm:min-h-[420px] md:min-h-[500px] max-h-[85vh] bg-black relative mx-auto overflow-hidden">
            {streamLoading || !mockItem ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 bg-zinc-950">
                <div className="animate-spin h-10 w-10 border-4 border-[brand-primary] border-t-transparent rounded-full" />
                <p className="text-xs uppercase tracking-widest font-bold text-zinc-400">
                  Chargement de l&apos;épisode {currentEpisode?.number}…
                </p>
              </div>
            ) : (
              <VideoPlayer
                key={`${currentEpisode?.id ?? "ep"}-${streamUrl}`}
                item={mockItem}
                episode={currentEpisode}
                audioVersion={audioVersion}
                onLanguageChange={handleLanguageChange}
                onBack={() => router.push(`/tv/${id}`)}
                onOpenDetails={() => router.push(`/tv/${id}`)}
              />
            )}
          </div>
        </div>

        {/* 3. CONTENU DÉTAILS DE L'ÉPISODE */}
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-6 sm:pt-8 space-y-8">
          
          {/* Section Titre, Actions & Résumé de l'épisode actif */}
          <div className="max-w-4xl space-y-5">
            <div className="space-y-2">
              {currentEpisode?.duration && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300 font-mono bg-zinc-800/80 border border-zinc-700 px-2.5 py-0.5 rounded-full">
                    {currentEpisode.duration}
                  </span>
                </div>
              )}

              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                {showTitle}
              </h1>
              
              <h2 className="text-lg sm:text-2xl font-bold text-zinc-300">
                Saison {seasonNumber} · Épisode {currentEpisode?.number} : {currentEpisode?.title}
              </h2>
            </div>

            {/* Boutons d'Action (avec Couleur Principale) */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <NetflixDownloadButton
                tmdbId={id as string}
                type="series"
                season={Number(seasonNumber)}
                episodeNumber={currentEpisode?.number}
                title="Télécharger l'épisode"
                className="bg-brand-primary text-white shadow-lg shadow-brand-primary/25 border-none font-bold"
                onClick={() => {
                  if (!user) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setShowSingleDownload(true);
                }}
              />

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setShowBatchDownload(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <LinkSimple className="h-4 w-4 text-[brand-primary]" />
                <span>Télécharger la saison</span>
              </button>

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

              <div className="relative">
                <Button
                  onClick={handleShare}
                  variant="outline"
                  size="icon"
                  ariaLabel="Partager la série"
                  icon={<ShareNetwork className="w-4 h-4" />}
                />

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
                      {copiedLink && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Synopsis de l'Épisode */}
            <div className="space-y-2 pt-3 border-t border-zinc-800/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Résumé de l&apos;épisode
              </h3>
              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed font-normal">
                {currentEpisode?.synopsis || "Aucun résumé disponible pour cet épisode."}
              </p>
            </div>
          </div>

          {/* 4. SECTION DES CARTES DES ÉPISODES (TOUT EN BAS SOUS LE RÉSUMÉ) */}
          <div className="space-y-5 pt-8 border-t border-zinc-800">
            <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
                <span>Épisodes de la Saison {seasonNumber}</span>
                <span className="text-xs sm:text-sm font-normal text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-full">
                  {episodes.length} épisodes
                </span>
              </h3>

              {/* Sélecteur de Saisons Dropdown */}
              {validSeasons.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-semibold">Saison :</span>
                  <select
                    value={seasonNumber}
                    onChange={(e) => router.push(`/tv/${id}/season/${e.target.value}`)}
                    className="bg-zinc-900 border border-zinc-700 text-xs sm:text-sm text-white font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-[brand-primary] cursor-pointer"
                  >
                    {validSeasons.map((s) => (
                      <option key={s.id} value={s.seasonNumber}>
                        {s.name || `Saison ${s.seasonNumber}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Grille des Cartes d'Épisodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {episodes.map((ep, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <div
                    key={ep.id}
                    onClick={() => playEpisode(idx)}
                    className={`group flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                      isActive
                        ? "bg-zinc-900 border-2 border-[brand-primary] shadow-xl shadow-[brand-primary]/15 ring-2 ring-[brand-primary]/20 -translate-y-1"
                        : "bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 hover:-translate-y-1 hover:shadow-xl"
                    }`}
                  >
                    {/* Thumbnail 16:9 avec overlay & badge */}
                    <div className="relative w-full aspect-video overflow-hidden bg-zinc-950">
                      {ep.thumbnail ? (
                        <Image
                          src={ep.thumbnail}
                          alt={ep.title}
                          fill
                          className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <FilmSlate className="w-8 h-8" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Badge Épisode */}
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-black text-white border border-white/10">
                          EP {ep.number}
                        </span>
                      </div>

                      {/* Bouton Téléchargement d'épisode rapide */}
                      <div
                        className="absolute top-2 right-2 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <NetflixDownloadButton
                          tmdbId={id as string}
                          type="series"
                          season={Number(seasonNumber)}
                          episodeNumber={ep.number}
                          variant="icon"
                          onClick={() => {
                            if (!user) {
                              setIsAuthModalOpen(true);
                              return;
                            }
                            setCurrentIndex(idx);
                            setShowSingleDownload(true);
                          }}
                        />
                      </div>

                      {/* Indicateur de lecture active */}
                      {isActive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="w-10 h-10 rounded-full bg-[brand-primary] flex items-center justify-center shadow-lg animate-pulse">
                            <Play className="w-5 h-5 fill-white translate-x-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Informations de la Carte */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-bold truncate ${isActive ? "text-[brand-primary]" : "text-white group-hover:text-white"}`}>
                            {ep.number}. {ep.title}
                          </h4>
                          <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                            {ep.duration}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {ep.synopsis || "Aucun résumé disponible pour cet épisode."}
                        </p>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] font-semibold">
                        <span className={`flex items-center gap-1 ${isActive ? "text-[brand-primary]" : "text-zinc-500 group-hover:text-zinc-300"}`}>
                          <Play className="w-3 h-3 fill-current" />
                          {isActive ? "En cours de lecture" : "Regarder l'épisode"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          initialLanguage={audioVersion}
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
