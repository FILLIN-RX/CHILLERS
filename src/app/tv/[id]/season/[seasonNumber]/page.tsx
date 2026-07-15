"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { getSeasonDetails, getMediaDetails, getStreamUrl, startDownload, triggerDownload } from "@/app/api";
import { Episode } from "@/app/mockData";
import VideoPlayer from "@/components/VideoPlayer";
import {
  ArrowLeftIcon,
  PlayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
} from "@heroicons/react/24/solid";

export default function SeasonPage() {
  const params = useParams();
  const router = useRouter();
  const { id, seasonNumber } = params;

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streamUrl, setStreamUrl] = useState("");
  const [streamLoading, setStreamLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSeason() {
      setIsLoading(true);
      try {
        // Fetch title AND season in parallel
        const [data, detail] = await Promise.all([
          getSeasonDetails(id as string, seasonNumber as string),
          getMediaDetails(id as string, true),
        ]);

        const title = detail?.title || "";
        if (title) setShowTitle(title);

        if (data && data.episodes) {
          const mapped = data.episodes.map((ep: any) => ({
            id: String(ep.id),
            title: ep.name,
            duration: `${ep.runtime || 24}m`,
            number: ep.episode_number,
            season: Number(seasonNumber),
            thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : "",
            synopsis: ep.overview,
          }));
          setEpisodes(mapped);

          // Load stream for first episode with the resolved title immediately
          if (mapped.length > 0) {
            setStreamLoading(true);
            try {
              const stream = await getStreamUrl(
                id as string,
                'series',
                Number(seasonNumber),
                mapped[0].number,
                title
              );
              setStreamUrl(stream?.embedUrl || "");
            } catch (err) {
              console.error("Stream error on initial load", err);
            } finally {
              setStreamLoading(false);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load season", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSeason();
  }, [id, seasonNumber]);

  const currentEpisode = episodes[currentIndex];

  const loadStream = useCallback(async (ep: Episode, titleOverride?: string) => {
    if (!ep) return;
    const title = titleOverride ?? showTitle;
    // Don't load if no title yet — initial load handled in fetchSeason
    if (!title) return;
    setStreamLoading(true);
    try {
      const stream = await getStreamUrl(id as string, 'series', Number(seasonNumber), ep.number, title);
      setStreamUrl(stream?.embedUrl || "");
    } catch (err) {
      console.error("Stream error", err);
    } finally {
      setStreamLoading(false);
    }
  }, [id, seasonNumber, showTitle]);

  // Re-load stream when user switches episode (not on first load — handled above)
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    if (!initialLoadDone && episodes.length > 0) {
      setInitialLoadDone(true);
      return; // skip — first episode already loaded in fetchSeason
    }
    if (currentEpisode && initialLoadDone) loadStream(currentEpisode);
  }, [currentIndex]); // only track index changes

  const goNext = () => {
    if (currentIndex < episodes.length - 1) {
      setCurrentIndex(prev => prev + 1);
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const playEpisode = (index: number) => {
    setCurrentIndex(index);
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="w-96 h-8 bg-zinc-800 rounded-lg" />
          <div className="w-80 h-4 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  const mockItem = currentEpisode ? {
    id: id as string,
    title: `${showTitle || `S${seasonNumber}`} · E${currentEpisode.number}`,
    type: 'series' as const,
    description: currentEpisode.synopsis,
    synopsis: currentEpisode.synopsis,
    backdropUrl: currentEpisode.thumbnail,
    posterUrl: "",
    rating: 0,
    year: 0,
    duration: currentEpisode.duration,
    genres: [],
    cast: [],
    videoUrl: streamUrl,
  } : null;

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Back button — positioned just below the navbar */}
      <div className="fixed top-[72px] left-4 sm:left-6 z-40">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-sm font-semibold text-white hover:bg-white/10 transition-all group"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Retour
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-[72px] pb-12">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-4" ref={playerRef}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black">{showTitle || `Saison ${seasonNumber}`}</h1>
                <p className="text-zinc-400 text-sm">
                  S{seasonNumber} · E{currentEpisode?.number} — {currentEpisode?.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="Épisode précédent"
          className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex >= episodes.length - 1}
          aria-label="Épisode suivant"
          className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
              </div>
            </div>

            <div className="w-full rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
              {streamLoading ? (
                <div className="aspect-video flex items-center justify-center">
                  <div className="animate-spin h-10 w-10 border-4 border-[#D70466] border-t-transparent rounded-full" />
                </div>
              ) : mockItem ? (
                <VideoPlayer
                  item={mockItem}
                  onBack={() => {}}
                  onOpenDetails={() => {}}
                />
              ) : (
                <div className="aspect-video flex items-center justify-center text-zinc-500">
                  Aucun épisode trouvé
                </div>
              )}
            </div>

            <div className="space-y-3 p-1">
              <h2 className="text-lg font-bold">Synopsis</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {currentEpisode?.synopsis || "Aucun synopsis disponible."}
              </p>
            </div>

            <div className="flex gap-3 pt-2 flex-wrap">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                Précédent
              </button>
              <button
                onClick={goNext}
                disabled={currentIndex >= episodes.length - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#D70466] text-white font-bold text-sm hover:bg-[#b5034f] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#D70466]/30"
              >
                Suivant
                <ChevronRightIcon className="h-4 w-4" />
              </button>
              <button
                onClick={async () => {
                  if (!currentEpisode) return;
                  setDownloading(true);
                  try {
                    const result = await startDownload(
                      id as string, 'series', showTitle, Number(seasonNumber), currentEpisode.number
                    );
                    if (result?.downloadUrl) {
                      triggerDownload(result.downloadUrl, `${showTitle || 'video'}-S${seasonNumber}E${currentEpisode.number}.mp4`);
                    }
                  } catch (err) {
                    console.error('Download failed:', err);
                  } finally {
                    setDownloading(false);
                  }
                }}
                disabled={downloading || !currentEpisode}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 border border-zinc-800 text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {downloading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
                Télécharger
              </button>
            </div>
          </div>

          <div className="w-full lg:w-80 xl:w-96 flex-none space-y-3">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              Épisodes · {episodes.length}
            </h3>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {episodes.map((ep, idx) => (
                <div
                  key={ep.id}
                  onClick={() => playEpisode(idx)}
                  className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                    idx === currentIndex
                      ? "bg-[#D70466]/10 border border-[#D70466]/30"
                      : "bg-zinc-900/60 border border-zinc-800/40 hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex-none w-24 aspect-video rounded-lg overflow-hidden bg-zinc-800 relative">
                    {ep.thumbnail ? (
                      <Image src={ep.thumbnail} alt={ep.title} fill className="object-cover" sizes="96px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FilmIcon className="h-5 w-5 text-zinc-600" />
                      </div>
                    )}
                    {idx === currentIndex && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <PlayIcon className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-500 font-bold">{ep.number}.</span>
                      <h4 className={`text-sm font-bold truncate ${idx === currentIndex ? "text-[#D70466]" : "text-white"}`}>
                        {ep.title}
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{ep.synopsis}</p>
                    <span className="text-[10px] text-zinc-600 mt-0.5 block">{ep.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
