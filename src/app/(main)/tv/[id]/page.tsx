"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getMediaDetails,
  getDisponible,
  getPopularTV,
  AvailabilityEntry,
} from "@/services/media";
import type { MovieOrShow, Episode } from "@/types/media";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import MovieCard from "@/components/MovieCard";
import ScrollRow from "@/components/ScrollRow";
import SeriesDownloadModal from "@/features/downloads/SeriesDownloadModal";
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconStar,
  IconCalendar,
  IconMovie,
  IconDownload,
  IconShare,
  IconBookmark,
  IconBookmarkFilled,
  IconX,
  IconCheck,
  IconSparkles,
  IconLayersLinked,
} from "@tabler/icons-react";

export default function TVDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const { user, token, updateUser } = useAuthStore();

  const id = params?.id as string;

  const [item, setItem] = useState<MovieOrShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState<MovieOrShow[]>([]);
  const [disponible, setDisponible] = useState<AvailabilityEntry | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showSeriesDownloadModal, setShowSeriesDownloadModal] = useState(false);

  const isFavorite = user?.favorites?.some(
    (f) => f.tmdbId === String(item?.id) && (f.mediaType === "series" || f.mediaType === "anime")
  );

  // Charger les détails de la série
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const signal = controller.signal;
    let cancelled = false;

    setLoading(true);

    Promise.all([
      getMediaDetails(id, true, signal),
      getDisponible(id, "series").catch(() => null),
      getPopularTV(1, signal).catch(() => []),
    ])
      .then(([detail, dispo, popularList]) => {
        if (cancelled) return;
        if (detail) setItem(detail);
        if (dispo) setDisponible(dispo);
        if (popularList && popularList.length > 0) {
          setSimilar(popularList.filter((m) => m.id !== id).slice(0, 14));
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Erreur chargement TV Page:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  // Toggle Favoris
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !user || !item) return;
    setFavoriteLoading(true);
    try {
      const res = await userService.toggleFavorite(token, {
        mediaType: item.type === "anime" ? "anime" : "series",
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

  // Partage
  const handleShare = async () => {
    const url = window.location.href;
    const title = item ? `Regardez ${item.title} sur CHILLERS` : "CHILLERS";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white select-none pb-24">
        {/* 1. HERO SKELETON */}
        <div className="relative w-full h-[65vh] sm:h-[75vh] lg:h-[80vh] max-h-[800px] overflow-hidden bg-zinc-900 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 md:px-12 lg:px-16 pb-10 sm:pb-16 flex flex-col md:flex-row md:items-end gap-6 sm:gap-8">
            <div className="w-[170px] sm:w-[210px] lg:w-[240px] aspect-[2/3] rounded-2xl bg-zinc-800 border border-white/10 shrink-0 shadow-2xl" />
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-zinc-800" />
                <div className="h-6 w-16 rounded-full bg-zinc-800" />
              </div>
              <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-zinc-800" />
              <div className="h-4 w-1/3 rounded-lg bg-zinc-800" />
              <div className="flex gap-3 pt-2">
                <div className="h-12 w-44 rounded-full bg-zinc-800" />
                <div className="h-12 w-32 rounded-full bg-zinc-800" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. SEASONS GRID SKELETON */}
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-10 space-y-6">
          <div className="h-8 w-44 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-zinc-800/60" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Série introuvable</h2>
        <p className="text-zinc-400 mb-6">Cette série n&apos;est pas disponible ou a été déplacée.</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-all"
        >
          Retourner au catalogue
        </button>
      </div>
    );
  }

  const audioTag = disponible?.langueAudio || item.langueAudio;
  const isFrench = disponible?.isFrenchAudio ?? (audioTag === "VF" || audioTag === "VFF" || audioTag === "VFQ");
  const validSeasons = item.seasons?.filter((s) => s.seasonNumber > 0) || [];
  const firstSeasonNumber = validSeasons.length > 0 ? validSeasons[0].seasonNumber : 1;

  return (
    <div className="min-h-screen bg-[#09090B] text-white select-none pb-20">
      
      {/* 1. HERO SECTION AVEC AFFICHE VERTICALE ET BACKDROP DE FOND */}
      <div className="relative w-full min-h-[65vh] sm:min-h-[75vh] lg:min-h-[82vh] overflow-hidden flex flex-col justify-end">
        {/* Backdrop Image */}
        {item.backdropOriginalUrl || item.backdropUrl ? (
          <Image
            src={item.backdropOriginalUrl || item.backdropUrl}
            alt={item.title}
            fill
            priority
            className="object-cover object-top filter brightness-[0.70] scale-100"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-[#09090B]" />
        )}

        {/* Dégradés cinéma pour fondre le hero sans couper l'image */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/70 to-transparent max-w-5xl" />
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

        {/* Bouton retour (mobile uniquement, masqué sur PC car les flèches du header gèrent la navigation) */}
        <div className="fixed top-0 left-0 z-40 p-4 sm:hidden">
          <button
            onClick={() => router.back()}
            aria-label="Retour"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-xl border border-white/10 text-white transition-all shadow-xl cursor-pointer"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu du Hero : Poster vertical sur la gauche + Informations sur la droite */}
        <div className="relative z-20 w-full px-4 sm:px-8 md:px-12 lg:px-16 pb-10 sm:pb-14 pt-24 flex flex-col md:flex-row md:items-end gap-6 sm:gap-8">
          
          {/* Affiche Verticale de la Série (Aspect 2/3) */}
          <div className="relative w-[160px] sm:w-[200px] lg:w-[230px] aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0 shadow-2xl">
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt={item.title}
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 160px, 230px"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <IconMovie className="w-12 h-12" />
              </div>
            )}
          </div>

          {/* Informations textuelles & Actions */}
          <div className="flex-1 space-y-3.5 max-w-4xl">
            
            {/* Badges : Réseau, Statut, Classification, Audio */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="text-[#D70466] font-black tracking-widest text-[11px] uppercase flex items-center gap-1.5 bg-[#D70466]/10 border border-[#D70466]/20 px-2.5 py-0.5 rounded-full">
                <IconSparkles className="w-3.5 h-3.5" />
                SÉRIE CHILLERS
              </span>

              {/* Logo Diffuseur */}
              {item.networks && item.networks.length > 0 && item.networks[0].logoUrl && (
                <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 flex items-center h-6">
                  <Image
                    src={item.networks[0].logoUrl}
                    alt={item.networks[0].name}
                    width={60}
                    height={18}
                    className="object-contain h-4 w-auto brightness-200"
                  />
                </div>
              )}

              {/* Statut */}
              {item.statusLabel && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                    item.statusLabel === "En cours"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                  }`}
                >
                  ● {item.statusLabel}
                </span>
              )}

              {/* Audio */}
              {audioTag && audioTag !== "UNKNOWN" && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-md ${
                    isFrench
                      ? "bg-blue-600/90 text-white border border-blue-400/30"
                      : "bg-amber-600/90 text-white border border-amber-400/30"
                  }`}
                >
                  {audioTag === "VFF" ? "VF (TrueFrench)" : audioTag === "VFQ" ? "VF (Québec)" : audioTag}
                </span>
              )}

              {/* Classification */}
              {item.contentRating && (
                <span className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[10px] sm:text-xs font-mono">
                  {item.contentRating}
                </span>
              )}
            </div>

            {/* Titre */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-2xl leading-tight">
              {item.title}
            </h1>

            {/* Tagline */}
            {item.tagline && (
              <p className="text-zinc-300 italic text-xs sm:text-sm font-medium line-clamp-1">
                &ldquo;{item.tagline}&rdquo;
              </p>
            )}

            {/* Métadonnées */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-zinc-300 font-medium">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                <IconStar className="h-3.5 w-3.5 fill-amber-400" />
                <span>{item.rating}</span>
                <span className="text-zinc-500 text-[11px]">/10</span>
              </div>

              <span className="text-zinc-600">•</span>
              <div className="flex items-center gap-1">
                <IconCalendar className="h-4 w-4 text-zinc-500" />
                <span>{item.year}</span>
              </div>

              <span className="text-zinc-600">•</span>
              <span>{validSeasons.length} Saison{validSeasons.length > 1 ? "s" : ""}</span>

              {item.genres && item.genres.length > 0 && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">{item.genres.slice(0, 3).join(", ")}</span>
                </>
              )}
            </div>

            {/* Synopsis court */}
            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed line-clamp-2 max-w-2xl font-normal">
              {item.synopsis || item.description}
            </p>

            {/* Boutons d'Action */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
              <Link
                href={`/tv/${id}/season/${firstSeasonNumber}`}
                className="flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full bg-[#D70466] hover:bg-[#b5034f] text-white font-bold text-xs sm:text-sm transition-all hover:scale-105 shadow-xl shadow-[#D70466]/40 cursor-pointer"
              >
                <IconPlayerPlay className="h-4 w-4 fill-white" />
                <span>Regarder Saison {firstSeasonNumber}</span>
              </Link>

              {item.trailerUrl && (
                <button
                  onClick={() => setTrailerOpen(true)}
                  className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs sm:text-sm transition-all hover:scale-105 cursor-pointer"
                >
                  <IconMovie className="h-4 w-4" />
                  <span>Bande-annonce</span>
                </button>
              )}

              {user && (
                <button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  aria-label="Favoris"
                  className={`p-3 rounded-full border transition-all hover:scale-105 backdrop-blur-md cursor-pointer ${
                    isFavorite
                      ? "bg-[#D70466]/90 border-[#D70466] text-white shadow-lg shadow-[#D70466]/40"
                      : "bg-black/50 border-white/20 text-white hover:bg-black/80"
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
                  className="p-3 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 text-white transition-all hover:scale-105 backdrop-blur-md cursor-pointer"
                >
                  <IconShare className="w-4 h-4" />
                </button>

                {shareOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-1 z-50 overflow-hidden">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent((item.title || "Chillers") + " " + window.location.href)}`}
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
          </div>
        </div>
      </div>

      {/* 2. SECTION SAISONS : CARTES ÉPURÉES SANS BORDER NI DESCRIPTION */}
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-10 space-y-12">
        
        {/* Grille des Saisons */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <IconLayersLinked className="w-6 h-6 text-[#D70466]" />
              <span>Saisons Disponibles</span>
              <span className="text-xs text-zinc-500 font-normal">({validSeasons.length})</span>
            </h2>
          </div>

          <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6 w-full">
            {validSeasons.map((season) => {
              const poster = season.posterUrl || item.posterUrl;

              return (
                <div
                  key={season.id}
                  onClick={() => router.push(`/tv/${id}/season/${season.seasonNumber}`)}
                  className="group cursor-pointer space-y-2 transition-transform duration-300 hover:scale-[1.03]"
                >
                  {/* Image Poster de la saison */}
                  <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 shadow-xl">
                    {poster ? (
                      <Image
                        src={poster}
                        alt={season.name}
                        fill
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <IconMovie className="w-10 h-10" />
                      </div>
                    )}

                    {/* Gradient Overlay sombre */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

                    {/* Badge Épisodes */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-bold text-[10px]">
                        {season.episodeCount} épisodes
                      </span>
                    </div>

                    {/* Bouton Play au survol */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <div className="w-12 h-12 rounded-full bg-[#D70466] flex items-center justify-center text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                        <IconPlayerPlay className="w-5 h-5 fill-white translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Titre & Épisodes */}
                  <div className="space-y-0.5 pt-1">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#D70466] transition-colors truncate">
                      {season.name || `Saison ${season.seasonNumber}`}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {season.episodeCount} épisodes {season.airDate ? `• ${new Date(season.airDate).getFullYear()}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: Horizontal Scroll */}
          <div className="sm:hidden">
            <ScrollRow title="" accentColor="primary" className="space-y-0">
              {validSeasons.map((season) => {
                const poster = season.posterUrl || item.posterUrl;

                return (
                  <div
                    key={season.id}
                    onClick={() => router.push(`/tv/${id}/season/${season.seasonNumber}`)}
                    className="group cursor-pointer space-y-2 transition-transform duration-300 hover:scale-[1.03] flex-shrink-0"
                  >
                    {/* Image Poster de la saison */}
                    <div className="relative aspect-[2/3] w-32 rounded-2xl overflow-hidden bg-zinc-900 shadow-xl">
                      {poster ? (
                        <Image
                          src={poster}
                          alt={season.name}
                          fill
                          className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                          sizes="(max-width: 768px) 128px"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <IconMovie className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}

                      {/* Gradient Overlay sombre */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

                      {/* Badge Épisodes */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-bold text-[10px]">
                          {season.episodeCount}
                        </span>
                      </div>

                      {/* Bouton Play au survol */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-10 h-10 rounded-full bg-[#D70466] flex items-center justify-center text-white shadow-xl">
                          <IconPlayerPlay className="w-4 h-4 fill-white translate-x-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Titre */}
                    <div className="space-y-0.5 pt-1 w-32">
                      <h3 className="text-xs font-bold text-white truncate">{season.name}</h3>
                      <p className="text-[10px] text-zinc-400 truncate">{season.episodeCount} épisodes</p>
                    </div>
                  </div>
                );
              })}
            </ScrollRow>
          </div>
        </section>

        {/* 3. CASTING & PERSONNAGES (CARROUSEL FLUIDE SUR 1 SEULE LIGNE) */}
        {item.castDetails && item.castDetails.length > 0 && (
          <section className="space-y-4 pt-6 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black text-white">
                Casting & Personnages
              </h2>
              <span className="text-xs text-zinc-500 font-medium">
                {item.castDetails.length} acteurs
              </span>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
              {item.castDetails.map((actor) => (
                <div
                  key={actor.id}
                  className="flex flex-col items-center text-center space-y-2 flex-shrink-0 w-20 sm:w-24 group cursor-pointer"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-zinc-800 shadow-md ring-2 ring-white/5 group-hover:ring-[#D70466] group-hover:scale-105 transition-all duration-300">
                    {actor.profileUrl ? (
                      <Image
                        src={actor.profileUrl}
                        alt={actor.name}
                        fill
                        className="object-cover object-top"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-sm">
                        {actor.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="w-full">
                    <p
                      className="text-[11px] sm:text-xs font-bold text-white truncate group-hover:text-[#D70466] transition-colors"
                      title={actor.name}
                    >
                      {actor.name}
                    </p>
                    <p
                      className="text-[10px] text-zinc-400 truncate"
                      title={actor.character}
                    >
                      {actor.character}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. SÉRIES SIMILAIRES ET RECOMMANDÉES (GRID 3 SUR MOBILE) */}
        {similar.length > 0 && (
          <section className="space-y-6 pt-8 border-t border-zinc-800/80 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
                <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
                <span>Séries Similaires & Recommandées</span>
              </h2>
              <span className="text-xs text-zinc-400 font-semibold">{similar.length} titres</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 sm:gap-5 lg:gap-6 w-full">
              {similar.slice(0, 15).map((show) => (
                <MovieCard
                  key={show.id}
                  item={show}
                  variant="poster"
                  onOpenDetails={(m) => router.push(`/tv/${m.id}`)}
                  onPlay={(m) => router.push(`/tv/${m.id}`)}
                />
              ))}
            </div>
          </section>
        )}

      </div>

      {/* MODALE BANDE-ANNONCE */}
      {trailerOpen && item.trailerUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
            <button
              onClick={() => setTrailerOpen(false)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
            >
              <IconX className="w-6 h-6" />
            </button>
            <iframe
              src={`${item.trailerUrl}?autoplay=1`}
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title="Bande-annonce"
            />
          </div>
        </div>
      )}

    </div>
  );
}
