"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import MovieCard from "@/components/MovieCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import ScrollRow from "@/components/ScrollRow";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  MovieOrShow,
} from "../mockData";

import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getMediaDetails,
  getMoviesByGenre,
  getAnimeSeries,
} from "../api";

const HOME_GENRES = [
  { id: '16', title: 'Animation' },
  { id: '28', title: 'Action' },
  { id: '10749', title: 'Romance' },
];

type TabFetcher = (signal: AbortSignal) => Promise<MovieOrShow[]>;

const MovieModal = dynamic(() => import("@/components/MovieModal"), {
  ssr: false,
});

const TAB_FETCHERS: Record<string, TabFetcher> = {
  movies: (signal) => getPopularMovies(1, signal),
  series: (signal) => getPopularTV(1, signal),
  anime: (signal) => getAnimeSeries(1, signal),
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Home />
    </Suspense>
  );
}

function HomeFallback() {
  const { translate: _ } = useLanguage();
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm">{_("common.loading")}</p>
      </div>
    </div>
  );
}

function Home() {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("home");

  const [selectedMovie, setSelectedMovie] = useState<MovieOrShow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [continueWatching, setContinueWatching] = useState<
    { item: MovieOrShow; progress: number; remaining: string; episodeName?: string }[]
  >([]);

  const [heroSlides, setHeroSlides] = useState<MovieOrShow[]>([]);
  const [trendingAll, setTrendingAll] = useState<MovieOrShow[]>([]);
  const [moviesData, setMoviesData] = useState<MovieOrShow[]>([]);
  const [seriesData, setSeriesData] = useState<MovieOrShow[]>([]);
  const [animeData, setAnimeData] = useState<MovieOrShow[]>([]);
  const [genreRows, setGenreRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingGenreRows, setIsLoadingGenreRows] = useState(false);
  const [hasTriedGenreRows, setHasTriedGenreRows] = useState(false);

  // Continue-watching is read from localStorage. Declared BEFORE the useEffect
  // that calls it so the effect's first run can't hit a TDZ (P0-#8).
  const loadContinueWatchingHistory = useCallback(() => {
    const history: { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; updatedAt: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("chiller_progress_")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.title) {
              history.push({
                item: {
                  id: parsed.id,
                  title: parsed.title,
                  type: parsed.type || 'movie',
                  posterUrl: parsed.posterUrl || '',
                  backdropUrl: parsed.backdropUrl || '',
                  description: '',
                  synopsis: '',
                  rating: 0,
                  year: 0,
                  duration: '',
                  genres: [],
                  cast: [],
                  videoUrl: '',
                },
                progress: parsed.progress,
                remaining: parsed.remaining,
                episodeName: parsed.episodeName,
                updatedAt: parsed.updatedAt || 0,
              });
            }
          }
        } catch (e) {
          console.error("Failed to read progress history item", e);
        }
      }
    }

    history.sort((a, b) => b.updatedAt - a.updatedAt);
    setContinueWatching(
      history.map(({ item, progress, remaining, episodeName }) => ({
        item,
        progress,
        remaining,
        episodeName,
      })),
    );
  }, []);

  useEffect(() => {
    loadContinueWatchingHistory();
  }, [loadContinueWatchingHistory]);

  const loadHomeData = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingData(true);
    try {
      const fetchWithCatch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await promise;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") throw e;
          console.error("Failed fetching section:", e);
          return fallback;
        }
      };

      const [trending, trendingTV, popular, popularTV, anime] = await Promise.all([
        fetchWithCatch(getTrendingMovies(signal), []),
        fetchWithCatch(getTrendingTV(signal), []),
        fetchWithCatch(getPopularMovies(1, signal), []),
        fetchWithCatch(getPopularTV(1, signal), []),
        fetchWithCatch(getAnimeSeries(1, signal), []),
      ]);

      const allTrending = [...trending, ...trendingTV];
      if (allTrending.length > 0) setTrendingAll(allTrending);
      if (popular.length > 0) {
        setMoviesData(popular);
        setHeroSlides(popular.slice(0, 5));
      }
      if (popularTV.length > 0) setSeriesData(popularTV);
      if (anime.length > 0) setAnimeData(anime);

    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      console.error("Failed to load home data", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const loadGenreRows = useCallback(async (signal?: AbortSignal) => {
    if (genreRows.length > 0) return;
    setIsLoadingGenreRows(true);
    try {
      const rowsData = await Promise.all(
        HOME_GENRES.map(async (g) => ({
          title: g.title,
          items: await getMoviesByGenre(g.id, 1, signal),
        })),
      );
      const validRows = rowsData.filter((row) => row.items.length > 0);
      if (validRows.length > 0) setGenreRows(validRows);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to load home genre rows", err);
    } finally {
      setIsLoadingGenreRows(false);
    }
  }, [genreRows.length]);

  // Home tab: load all rows once. Aborted on unmount or tab change.
  useEffect(() => {
    if (activeTab !== "home") return;
    if (trendingAll.length > 0) return; // already loaded
    const controller = new AbortController();
    loadHomeData(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [activeTab, trendingAll.length, loadHomeData]);

  useEffect(() => {
    if (activeTab !== "home") return;
    if (isLoadingData) return;
    if (genreRows.length > 0 || isLoadingGenreRows || hasTriedGenreRows) return;
    const controller = new AbortController();
    const idleTimer = setTimeout(() => {
      setHasTriedGenreRows(true);
      loadGenreRows(controller.signal).catch(() => {});
    }, 350);
    return () => {
      clearTimeout(idleTimer);
      controller.abort();
    };
  }, [activeTab, isLoadingData, genreRows.length, isLoadingGenreRows, hasTriedGenreRows, loadGenreRows]);

  // P1-#22: one effect dispatches on `activeTab` instead of three near-identical
  // effects. Each tab fetcher is in TAB_FETCHERS; the matching setter is in
  // TAB_SETTERS so we don't have to pass the setter through the fetcher.
  const TAB_SETTERS: Record<string, React.Dispatch<React.SetStateAction<MovieOrShow[]>>> = {
    movies: setMoviesData,
    series: setSeriesData,
    anime: setAnimeData,
  };

  useEffect(() => {
    const fetcher = TAB_FETCHERS[activeTab];
    const setter = TAB_SETTERS[activeTab];
    if (!fetcher || !setter) return;
    if (activeTab === "movies" && moviesData.length > 0) return;
    if (activeTab === "series" && seriesData.length > 0) return;
    if (activeTab === "anime" && animeData.length > 0) return;
    const controller = new AbortController();
    fetcher(controller.signal).then(setter).catch(() => {});
    return () => controller.abort();
  }, [activeTab, moviesData.length, seriesData.length, animeData.length]);

  const handleOpenDetails = async (item: MovieOrShow) => {
    setSelectedMovie(item);
    setIsModalOpen(true);
    try {
      const isTV = item.type === "series" || item.type === "anime" || item.duration?.includes("Season");
      const full = await getMediaDetails(item.id, isTV);
      if (full) setSelectedMovie(full);
    } catch (e) {
    }
  };

  const handleWatchNow = (item: MovieOrShow) => {
    setIsModalOpen(false);
    const typeParam =
      item.type === "series" || item.type === "anime" ? "tv" : "movie";
    router.push(`/watch/${item.id}?type=${typeParam}`);
  };

  const getFilteredMedia = (type: 'movie' | 'series' | 'anime') => {
    if (type === 'movie') return moviesData;
    if (type === 'series') return seriesData;
    if (type === 'anime') return animeData;
    return [];
  };

  return (
    <div className="flex-1 flex flex-col bg-brand-dark transition-colors duration-300">

      <main className="flex-grow transition-all duration-300">
        <div className="space-y-10 pb-24">

            {activeTab === "home" && (
              <HeroCarousel
                slides={heroSlides}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
                slideTimings={[20000, 20000, 20000, 20000, 20000]}
              />
            )}

            {activeTab !== "home" && <div className="pt-[72px]" />}

            {continueWatching.length > 0 && activeTab === "home" && (
              <div className="max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-[4%]">
                <ScrollRow title={_("home.continueWatching")} accentColor="secondary">
                  {continueWatching.map(({ item, progress, remaining, episodeName }) => (
                    <ContinueWatchingCard
                      key={item.id}
                      item={item}
                      progress={progress}
                      remainingTime={remaining}
                      episodeName={episodeName}
                      onResume={handleWatchNow}
                      onOpenDetails={handleOpenDetails}
                    />
                  ))}
                </ScrollRow>
              </div>
            )}

            <div className="max-w-[1600px] mx-auto px-2 sm:px-6 md:px-12 lg:px-[4%] space-y-10">

              {activeTab === "home" && (
                <>
                  {isLoadingData ? (
                    <>
                      <ScrollRow title={_("home.trending")} accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`trending-sk-${i}`}
                            className="flex-none w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900/60 skeleton-loading border border-zinc-800/40"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title={_("home.popularSeries")} accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`series-sk-${i}`}
                            className="flex-none w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900/60 skeleton-loading border border-zinc-800/40"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title={_("home.animeCollection")} accentColor="secondary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`anime-sk-${i}`}
                            className="flex-none w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900/60 skeleton-loading border border-zinc-800/40"
                          />
                        ))}
                      </ScrollRow>

                      {HOME_GENRES.map((g) => (
                        <ScrollRow key={`genre-sk-${g.title}`} title={g.title} accentColor="secondary">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={`genre-item-sk-${g.id}-${i}`}
                              className="flex-none w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900/60 skeleton-loading border border-zinc-800/40"
                            />
                          ))}
                        </ScrollRow>
                      ))}
                    </>
                  ) : (
                    <>
                      {trendingAll.length > 0 && (
                        <ScrollRow title={_("home.trending")} accentColor="primary">
                          {trendingAll.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      )}

                      {seriesData.length > 0 && (
                        <ScrollRow title={_("home.popularSeries")} accentColor="primary">
                          {seriesData.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      )}

                      {animeData.length > 0 && (
                        <ScrollRow title={_("home.animeCollection")} accentColor="secondary">
                          {animeData.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      )}

                      {genreRows.map((row) => (
                        <ScrollRow key={row.title} title={row.title} accentColor="secondary">
                          {row.items.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      ))}
                    </>
                  )}
                </>
              )}

              {activeTab === "movies" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.blockbusterMovies")}</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.blockbusterSubtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                    {getFilteredMedia("movie").map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "series" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.featuredSeries")}</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.featuredSeriesSubtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                    {getFilteredMedia("series").map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "anime" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.globalAnime")}</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.globalAnimeSubtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                    {getFilteredMedia("anime").map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "trending" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.trendingThisWeek")}</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.trendingSubtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                    {trendingAll.map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
      </main>

      <MovieModal
        item={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWatch={handleWatchNow}
        onOpenDetails={(movie) => {
          setSelectedMovie(movie);
        }}
      />

    </div>
  );
}
