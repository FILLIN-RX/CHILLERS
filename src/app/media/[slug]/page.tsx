"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getMediaDetails, getPopularMovies, getPopularTV, getStreamUrl, startDownload, triggerDownload } from "@/app/api";
import { MovieOrShow } from "@/app/mockData";
import {
  ArrowLeftIcon,
  PlayIcon,
  PlusIcon,
  CheckIcon,
  StarIcon,
  ClockIcon,
  CalendarDaysIcon,
  FilmIcon,
} from "@heroicons/react/24/solid";
import { ShareIcon } from "@heroicons/react/24/outline";
import VideoPlayer from "@/components/VideoPlayer";
import MovieCard from "@/components/MovieCard";

const LISTING_TYPES = ["movies", "series", "anime"];

function MediaDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = params?.slug as string;
  const isTV = searchParams?.get("type") === "tv" || searchParams?.get("type") === "series";

  const [item, setItem] = useState<MovieOrShow | null>(null);
  const [similar, setSimilar] = useState<MovieOrShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, similarList] = await Promise.all([
        getMediaDetails(id, isTV),
        isTV ? getPopularTV() : getPopularMovies(),
      ]);
      if (detail) {
        if (detail.videoUrl?.includes("youtube.com") || detail.videoUrl?.includes("embed")) {
          setTrailerUrl(detail.videoUrl);
        }
        setItem(detail);
        getStreamUrl(detail.id, isTV ? 'series' : 'movie', undefined, undefined, detail.title).then(stream => {
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
    const saved = JSON.parse(localStorage.getItem("chiller_favorites") || "[]");
    setIsFavorite(saved.includes(id));
  }, [fetchData, id]);

  const toggleFavorite = () => {
    const saved: string[] = JSON.parse(localStorage.getItem("chiller_favorites") || "[]");
    const next = saved.includes(id) ? saved.filter((f) => f !== id) : [...saved, id];
    localStorage.setItem("chiller_favorites", JSON.stringify(next));
    setIsFavorite(next.includes(id));
  };

  const handleWatch = async () => {
    if (!isTV && item && !item.videoUrl) {
      const stream = await getStreamUrl(item.id, 'movie', undefined, undefined, item.title);
      if (stream) setItem({ ...item, videoUrl: stream.embedUrl });
    }
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const type = isTV ? 'series' : 'movie';
      const m3u8 = await startDownload(id, type, item?.title);
      if (m3u8) {
        triggerDownload(m3u8, `${item?.title || 'video'}.mp4`);
      } else {
        alert('Aucune source de téléchargement trouvée');
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
        <div className="fixed top-6 left-6 z-50">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-sm font-semibold text-white hover:bg-black/80 transition-all"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Retour
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
          <p className="text-zinc-400 text-lg">Film introuvable.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 rounded-full bg-[#D70466] text-white text-sm font-bold hover:bg-[#b5034f] transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const isYouTube = trailerUrl?.includes("youtube.com") || trailerUrl?.includes("embed");

  return (
    <div className="min-h-screen bg-[#09090B] text-white pb-20 sm:pb-0">

      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-all group"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Retour
        </button>
      </div>

      <div className="relative w-full h-[85vh] overflow-hidden">
        <img
          src={item.backdropUrl}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ filter: "brightness(0.45)" }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />

        <div className="absolute inset-0 flex items-end pb-16 px-6 sm:px-12 lg:px-20">
          <div className="flex flex-col sm:flex-row gap-8 items-start max-w-6xl w-full mx-auto">

            <div className="hidden sm:block flex-none w-44 lg:w-56 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
              <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap gap-2">
                {item.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-[#D70466]/40 text-[#D70466] bg-[#D70466]/10"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight drop-shadow-xl">
                {item.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-300 font-medium">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <StarIcon className="h-4 w-4" />
                  <span className="font-bold">{item.rating}</span>
                  <span className="text-zinc-500">/10</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarDaysIcon className="h-4 w-4 text-zinc-500" />
                  {item.year}
                </div>
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4 text-zinc-500" />
                  {item.duration}
                </div>
                <span className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 text-xs uppercase tracking-wider">
                  {item.type}
                </span>
              </div>

              <p className="text-zinc-300 text-base leading-relaxed max-w-2xl line-clamp-3">
                {item.synopsis || item.description}
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleWatch}
                  className="flex items-center gap-2 px-7 py-3 rounded-full bg-[#D70466] hover:bg-[#b5034f] text-white font-bold text-sm transition-all hover:scale-105 shadow-lg shadow-[#D70466]/30"
                >
                  <PlayIcon className="h-5 w-5 translate-x-0.5" />
                  Regarder
                </button>

                {isYouTube && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    className="flex items-center gap-2 px-7 py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-bold text-sm transition-all hover:scale-105"
                  >
                    <FilmIcon className="h-5 w-5" />
                    Bande-annonce
                  </button>
                )}

                <button
                  onClick={toggleFavorite}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm transition-all hover:scale-105 border ${
                    isFavorite
                      ? "bg-[#D70466]/20 border-[#D70466]/50 text-[#D70466]"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                >
                  {isFavorite ? <CheckIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                  {isFavorite ? "Dans ma liste" : "Ma liste"}
                </button>
                
                <button 
                  className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm transition-all hover:scale-105 border ${
                    downloading
                      ? "bg-zinc-800 border-zinc-700 text-zinc-400 animate-pulse"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  Télécharger
                </button>

                <button className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all hover:scale-105 font-bold text-sm">
                  <ShareIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 sm:px-12 lg:px-20 py-16 space-y-16">
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-[#D70466]" />
            Synopsis
          </h2>
          <p className="text-zinc-300 text-base leading-relaxed max-w-3xl">
            {item.synopsis || item.description || "Aucun synopsis disponible."}
          </p>
        </section>

        {item.cast && item.cast.length > 0 && item.cast[0] !== "Cast Info Unavailable" && (
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
              Casting
            </h2>
            <div className="flex flex-wrap gap-3">
              {item.cast.map((actor) => (
                <span
                  key={actor}
                  className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-300 hover:border-zinc-600 transition-colors"
                >
                  {actor}
                </span>
              ))}
            </div>
          </section>
        )}

        {!isTV && (
          <section ref={playerRef} className="space-y-4">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-[#D70466]" />
              Lecture
            </h2>
            <div className="w-full rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
              <VideoPlayer 
                item={item!} 
                onBack={() => {}}
                onOpenDetails={(item) => router.push(`/media/${item.id}?type=${item.type}`)} 
              />
            </div>
          </section>
        )}

        {isTV && item.seasons && item.seasons.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-[#D70466]" />
              Saisons
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
                      <img src={season.posterUrl} alt={season.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                    <h4 className="text-sm font-bold text-white group-hover:text-[#D70466] transition-colors truncate">
                      {season.name}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5">{season.episodes.length} épisodes</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-[#7C3AED]" />
              Vous pourriez aussi aimer
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {similar.map((sim) => (
                <div
                  key={sim.id}
                  onClick={() => router.push(`/media/${sim.id}?type=${sim.type}`)}
                  className="group cursor-pointer space-y-2"
                >
                  <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 relative">
                    <img
                      src={sim.posterUrl}
                      alt={sim.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <PlayIcon className="h-8 w-8 text-white mx-auto mb-2 opacity-90" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#D70466] transition-colors truncate">
                      {sim.title}
                    </h4>
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
              allow="autoplay; encrypted-media; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
              allowFullScreen
              title={item.title}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MediaListingPage() {
  const { slug } = useParams();
  const type = slug as string;
  const [items, setItems] = useState<MovieOrShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        let data: MovieOrShow[] = [];
        if (type === 'movies') {
            data = await getPopularMovies();
        } else if (type === 'series' || type === 'anime') {
            data = await getPopularTV();
            if (type === 'anime') {
                data = data.filter(item => item.genres.includes('Animation') || item.type === 'anime');
            }
        }
        setItems(data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [type]);

  return (
    <main className="min-h-screen bg-brand-dark pt-24 px-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-extrabold text-foreground capitalize">{type}</h1>
        
        {isLoading ? (
          <div className="text-white">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {items.map((item) => (
              <MovieCard
                key={item.id}
                item={item}
                onPlay={() => console.log('Play:', item)}
                onOpenDetails={() => console.log('Details:', item)}
                favorites={[]}
                toggleFavorite={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function MediaPage() {
  const params = useParams();
  const slug = params?.slug as string;

  if (LISTING_TYPES.includes(slug)) {
    return <MediaListingPage />;
  }

  return <MediaDetailPage />;
}
