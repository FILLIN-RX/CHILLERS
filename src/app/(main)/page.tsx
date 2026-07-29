"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import MovieCard from "@/components/MovieCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import ScrollRow from "@/components/ScrollRow";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  MovieOrShow,
  Episode,
} from "../mockData";

import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getMediaDetails,
  getMoviesByGenre,
  getAnimeSeries,
  getUpcomingMovies,
} from "../api";

const HOME_GENRES = [
  { id: '16', title: 'Animation' },
  { id: '28', title: 'Action' },
  { id: '10749', title: 'Romance' },
];

const ANIME_GENRES = [
  { id: '10759', title: 'Action & Adventure Anime' },
  { id: '16', title: 'Animation Anime' },
  { id: '10765', title: 'Sci-Fi & Fantasy Anime' },
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
    { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; season?: number; episode?: number }[]
  >([]);

  const [heroSlides, setHeroSlides] = useState<MovieOrShow[]>([]);
  const [trendingAll, setTrendingAll] = useState<MovieOrShow[]>([]);
  const [moviesData, setMoviesData] = useState<MovieOrShow[]>([]);
  const [seriesData, setSeriesData] = useState<MovieOrShow[]>([]);
  const [animeData, setAnimeData] = useState<MovieOrShow[]>([]);
  const [newReleases, setNewReleases] = useState<MovieOrShow[]>([]);
  const [genreRows, setGenreRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [animeGenreRows, setAnimeGenreRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingGenreRows, setIsLoadingGenreRows] = useState(false);
  const [isLoadingAnimeGenreRows, setIsLoadingAnimeGenreRows] = useState(false);
  const [hasTriedGenreRows, setHasTriedGenreRows] = useState(false);
  const [hasTriedAnimeGenreRows, setHasTriedAnimeGenreRows] = useState(false);

  // Two animated rows derived from `trendingAll`:
  // - `mostWatched`: top items by rating (people-rated popularity proxy)
  // - `trendingNow`: most recent items (this-week freshness proxy)
  // Both are capped at 10 because the rows are infinite-scroll carousels.
  const mostWatched = useMemo(
    () =>
      [...trendingAll]
        .filter((m) => m.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 10),
    [trendingAll],
  );
  const trendingNow = useMemo(
    () =>
      [...trendingAll]
        .filter((m) => m.year > 0)
        .sort((a, b) => b.year - a.year)
        .slice(0, 10),
    [trendingAll],
  );

  // Continue-watching is read from localStorage. Declared BEFORE the useEffect
  // that calls it so the effect's first run can't hit a TDZ (P0-#8).
  const loadContinueWatchingHistory = useCallback(() => {
    const history: { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; season?: number; episode?: number; updatedAt: number }[] = [];

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
                season: parsed.season,
                episode: parsed.episode,
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
      history.map(({ item, progress, remaining, episodeName, season, episode }) => ({
        item,
        progress,
        remaining,
        episodeName,
        season,
        episode,
      })),
    );
  }, []);

  useEffect(() => {
    loadContinueWatchingHistory();
  }, [loadContinueWatchingHistory]);

  const loadNewReleases = useCallback(async () => {
    if (newReleases.length > 0) return;
    try {
      const releases = await getUpcomingMovies(1);
      if (releases.length > 0) setNewReleases(releases);
    } catch (err) {
      console.error("Failed to load new releases", err);
    }
  }, [newReleases.length]);

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

      await loadNewReleases();

    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      console.error("Failed to load home data", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [loadNewReleases]);

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

  const loadAnimeGenreRows = useCallback(async (signal?: AbortSignal) => {
    if (animeGenreRows.length > 0) return;
    setIsLoadingAnimeGenreRows(true);
    try {
      const rowsData = await Promise.all(
        ANIME_GENRES.map(async (g) => ({
          title: g.title,
          items: await getMoviesByGenre(g.id, 1, signal),
        })),
      );
      const validRows = rowsData.filter((row) => row.items.length > 0);
      if (validRows.length > 0) setAnimeGenreRows(validRows);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to load anime genre rows", err);
    } finally {
      setIsLoadingAnimeGenreRows(false);
    }
  }, [animeGenreRows.length]);

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

  useEffect(() => {
    if (activeTab !== "home") return;
    if (isLoadingData) return;
    if (animeGenreRows.length > 0 || isLoadingAnimeGenreRows || hasTriedAnimeGenreRows) return;
    const controller = new AbortController();
    const idleTimer = setTimeout(() => {
      setHasTriedAnimeGenreRows(true);
      loadAnimeGenreRows(controller.signal).catch(() => {});
    }, 700); // Slight delay to stagger
    return () => {
      clearTimeout(idleTimer);
      controller.abort();
    };
  }, [activeTab, isLoadingData, animeGenreRows.length, isLoadingAnimeGenreRows, hasTriedAnimeGenreRows, loadAnimeGenreRows]);

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
    // Mobile: navigate directly instead of opening modal
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const typeParam = item.type === "series" || item.type === "anime" ? "tv" : item.type;
      router.push(`/media/${item.id}?type=${typeParam}`);
      return;
    }
    setSelectedMovie(item);
    setIsModalOpen(true);
    try {
      const isTV = item.type === "series" || item.type === "anime" || item.duration?.includes("Season");
      const full = await getMediaDetails(item.id, isTV);
      if (full) setSelectedMovie(full);
    } catch (e) {
    }
  };

  const handleWatchNow = (item: MovieOrShow, season?: number, episode?: number) => {
    setIsModalOpen(false);
    const typeParam =
      item.type === "series" || item.type === "anime" ? "tv" : "movie";
    let url = `/watch/${item.id}?type=${typeParam}`;
    if (season) url += `&season=${season}`;
    if (episode) url += `&episode=${episode}`;
    router.push(url);
  };

  const handleModalWatch = (item: MovieOrShow, episode?: Episode) => {
    handleWatchNow(item, episode?.season, episode?.number);
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
              <div className="max-w-full mx-auto px-2 lg:px-3">
                <ScrollRow title={_("home.continueWatching")} accentColor="secondary">
                  {continueWatching.map(({ item, progress, remaining, episodeName, season, episode }) => (
                    <ContinueWatchingCard
                      key={item.id}
                      item={item}
                      progress={progress}
                      remainingTime={remaining}
                      episodeName={episodeName}
                      onResume={() => handleWatchNow(item, season, episode)}
                      onOpenDetails={handleOpenDetails}
                    />
                  ))}
                </ScrollRow>
              </div>
            )}

            <div className="max-w-full mx-auto px-2 lg:px-3 space-y-8">

              {activeTab === "home" && (
                <>
                  {isLoadingData ? (
                    <>
                      <ScrollRow title={_("home.trending")} accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`trending-sk-${i}`}
                            className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title={_("home.popularSeries")} accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`series-sk-${i}`}
                            className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title={_("home.animeCollection")} accentColor="secondary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`anime-sk-${i}`}
                            className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      {ANIME_GENRES.map((g) => (
                        <ScrollRow key={`anime-genre-sk-${g.title}`} title={g.title} accentColor="secondary">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={`anime-genre-item-sk-${g.id}-${i}`}
                              className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      {HOME_GENRES.map((g) => (
                        <ScrollRow key={`genre-sk-${g.title}`} title={g.title} accentColor="secondary">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={`genre-item-sk-${g.id}-${i}`}
                              className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
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

                      {newReleases.length > 0 && (
                        <ScrollRow title="Nouveautés" accentColor="primary">
                          {newReleases.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      )}

                      {mostWatched.length > 0 && (
                        <ScrollRow
                          title={_("home.mostWatched")}
                          accentColor="primary"
                          autoScroll
                          autoScrollSpeed={0.4}
                        >
                          {mostWatched.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      )}

                      {trendingNow.length > 0 && (
                        <ScrollRow
                          title={_("home.trendingNow")}
                          accentColor="secondary"
                          autoScroll
                          autoScrollSpeed={0.5}
                        >
                          {trendingNow.map((item) => (
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

                      {animeGenreRows.map((row) => (
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
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
        onWatch={handleModalWatch}
        onOpenDetails={(movie) => {
          setSelectedMovie(movie);
        }}
      />

    </div>
  );
}
