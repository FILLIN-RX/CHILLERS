"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import HeroCarousel from "@/components/HeroCarousel";
import MovieCard from "@/components/MovieCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import ScrollRow from "@/components/ScrollRow";
import MovieModal from "@/components/MovieModal";

import {
  MovieOrShow,
} from "./mockData";

import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getMediaDetails,
  getMovieGenres,
  getMoviesByGenre,
  getAnimeSeries,
  Genre,
} from "./api";

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Home />
    </Suspense>
  );
}

function HomeFallback() {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm">Chargement…</p>
      </div>
    </div>
  );
}

function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("home");

  // Media Playback & Modal States
  const [selectedMovie, setSelectedMovie] = useState<MovieOrShow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Continue Watching History
  const [continueWatching, setContinueWatching] = useState<
    { item: MovieOrShow; progress: number; remaining: string; episodeName?: string }[]
  >([]);

  // Live TMDB Data — lazy loaded per tab
  const [heroSlides, setHeroSlides] = useState<MovieOrShow[]>([]);
  const [trendingAll, setTrendingAll] = useState<MovieOrShow[]>([]);
  const [moviesData, setMoviesData] = useState<MovieOrShow[]>([]);
  const [seriesData, setSeriesData] = useState<MovieOrShow[]>([]);
  const [animeData, setAnimeData] = useState<MovieOrShow[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genreRows, setGenreRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load continue watching from localStorage on mount
  useEffect(() => {
    loadContinueWatchingHistory();
  }, []);

  const HOME_GENRES = [
    { id: '16', title: 'Animation' },
    { id: '28', title: 'Action' },
    { id: '10749', title: 'Romance' },
  ];

  // Home tab: charge trending + hero + genres + 3 genre rows
  // Home tab: charge trending + hero + genres + 3 genre rows + series + anime
  const loadHomeData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const fetchWithCatch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await promise;
        } catch (e) {
          console.error("Failed fetching section:", e);
          return fallback;
        }
      };

      const [trending, trendingTV, popular, popularTV, anime, genreList] = await Promise.all([
        fetchWithCatch(getTrendingMovies(), []),
        fetchWithCatch(getTrendingTV(), []),
        fetchWithCatch(getPopularMovies(), []),
        fetchWithCatch(getPopularTV(), []),
        fetchWithCatch(getAnimeSeries(), []),
        fetchWithCatch(getMovieGenres(), []),
      ]);

      const allTrending = [...trending, ...trendingTV];
      if (allTrending.length > 0) setTrendingAll(allTrending);
      if (popular.length > 0) {
        setMoviesData(popular);
        setHeroSlides(popular.slice(0, 5));
      }
      if (popularTV.length > 0) setSeriesData(popularTV);
      if (anime.length > 0) setAnimeData(anime);
      if (genreList.length > 0) setGenres(genreList);

      const genreResults = await Promise.all(
        HOME_GENRES.map(g => fetchWithCatch(getMoviesByGenre(g.id), []))
      );
      const rows = HOME_GENRES.map((g, i) => ({ title: g.title, items: genreResults[i] || [] }))
        .filter(r => r.items.length > 0);
      if (rows.length > 0) setGenreRows(rows);
    } catch (err) {
      console.error("Failed to load home data", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "home" && trendingAll.length === 0) loadHomeData();
  }, [activeTab, loadHomeData]);

  // Movies tab: charge popular movies si pas déjà faits
  useEffect(() => {
    if (activeTab !== "movies" || moviesData.length > 0) return;
    getPopularMovies().then(setMoviesData).catch(() => {});
  }, [activeTab]);

  // Series tab: charge popular TV
  useEffect(() => {
    if (activeTab !== "series" || seriesData.length > 0) return;
    getPopularTV().then(setSeriesData).catch(() => {});
  }, [activeTab]);

  // Anime tab: charge anime series
  useEffect(() => {
    if (activeTab !== "anime" || animeData.length > 0) return;
    getAnimeSeries().then(setAnimeData).catch(() => {});
  }, [activeTab]);

  // Trending tab: déjà chargé avec home, rien à faire
  // Categories tab: déjà chargé avec home (genres)

  const loadContinueWatchingHistory = () => {
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
    setContinueWatching(history.map(({ item, progress, remaining, episodeName }) => ({ item, progress, remaining, episodeName })));
  };

  // Media triggers — open modal immediately, then enrich with full TMDB details in background
  const handleOpenDetails = async (item: MovieOrShow) => {
    setSelectedMovie(item);
    setIsModalOpen(true);
    try {
      const isTV = item.type === "series" || item.type === "anime" || item.duration?.includes("Season");
      const full = await getMediaDetails(item.id, isTV);
      if (full) setSelectedMovie(full);
    } catch (e) {
      // keep the card data already shown
    }
  };

  // Navigate to dedicated /watch/[id] page — the user explicitly chose
  // to leave the home and enter the immersive player screen.
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

      {/* Main Content Area */}
      <main className="flex-grow transition-all duration-300">
        {/* Standard Browsing Portal Hub */}
        <div className="space-y-10 pb-24">
            
            {/* HERO CAROUSEL — no padding-top, goes behind the navbar */}
            {activeTab === "home" && (
              <HeroCarousel
                slides={heroSlides}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
                slideTimings={[20000, 20000, 20000, 20000, 20000]}
              />
            )}

            {/* PADDING-TOP only for non-hero tabs — pushes content below navbar */}
            {activeTab !== "home" && <div className="pt-[72px]" />}

            {/* CONTINUE WATCHING CONTAINER (Dynamic) */}
            {continueWatching.length > 0 && activeTab === "home" && (
              <div className="max-w-[1600px] mx-auto px-4 sm:px-8 md:px-12 lg:px-[4%]">
                <ScrollRow title="Continue Watching" accentColor="secondary">
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



            {/* MAIN TAB SWITCH CONTENT CONTAINER */}
            <div className="max-w-[1600px] mx-auto px-2 sm:px-6 md:px-12 lg:px-[4%] space-y-10">
              
              {activeTab === "home" && (
                <>
                  {isLoadingData ? (
                    <>
                      {/* Skeletons while loading */}
                      <ScrollRow title="Trending Worldwide" accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`trending-sk-${i}`}
                            className="flex-none w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900/60 skeleton-loading border border-zinc-800/40"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title="Popular TV Shows" accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`series-sk-${i}`}
                            className="flex-none w-[140px] sm:w-[180px] md:w-[220px] aspect-[2/3] rounded-xl sm:rounded-2xl bg-zinc-900/60 skeleton-loading border border-zinc-800/40"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title="Anime Collection" accentColor="secondary">
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
                      {/* Row 1: Trending Worldwide */}
                      {trendingAll.length > 0 && (
                        <ScrollRow title="Trending Worldwide" accentColor="primary">
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

                      {/* Row 2: Popular TV Shows */}
                      {seriesData.length > 0 && (
                        <ScrollRow title="Popular TV Shows" accentColor="primary">
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

                      {/* Row 3: Anime Collection */}
                      {animeData.length > 0 && (
                        <ScrollRow title="Anime Collection" accentColor="secondary">
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

                      {/* Genre rows: Animation, Action, Romance */}
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

              {/* MOVIES TAB */}
              {activeTab === "movies" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">Blockbuster Movies</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Unlimited streaming. Instant theatrical releases.</p>
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

              {/* SERIES TAB */}
              {activeTab === "series" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">Featured Series</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Binge-worthy premium drama, politics, and thrillers.</p>
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

              {/* ANIME TAB */}
              {activeTab === "anime" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">Global Anime</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Action packed cybernetic ninjas, mechs, and spirits.</p>
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

              {/* TRENDING TAB */}
              {activeTab === "trending" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">Trending This Week</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">The most watched films and series on Chiller right now.</p>
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

      {/* Single full-screen overlay modal for detailed descriptions */}
      <MovieModal
        item={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWatch={handleWatchNow}
        onOpenDetails={(movie) => {
          setSelectedMovie(movie); // navigate to new movie details in modal without reloads
        }}
      />

      {/* Mobile Bottom Navigation is now in AppShell so it shows on every page. */}

    </div>
  );
}
