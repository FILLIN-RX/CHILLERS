"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import HeroCarousel from "@/components/HeroCarousel";
import MovieCard from "@/components/MovieCard";
import CategoryCard from "@/components/CategoryCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import ScrollRow from "@/components/ScrollRow";
import MovieModal from "@/components/MovieModal";
import VideoPlayer from "@/components/VideoPlayer";

import {
  MovieOrShow,
  Episode,
  Season,
} from "./mockData";

import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getMediaDetails,
  getStreamUrl,
  getMovieGenres,
  getAnimeSeries,
  Genre,
} from "./api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("home");

  // Media Playback & Modal States
  const [selectedMovie, setSelectedMovie] = useState<MovieOrShow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{ item: MovieOrShow; episode?: Episode } | null>(null);

  // Favorites / Watchlist state
  const [favorites, setFavorites] = useState<string[]>([]);

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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);

  // Load favorites & continue watching from localStorage on mount
  useEffect(() => {
    // Load Favorites
    const savedFavorites = localStorage.getItem("chiller_favorites");
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }

    // Load Continue Watching
    loadContinueWatchingHistory();
  }, [playingVideo]);

  // Home tab: charge trending + hero + genres
  const loadHomeData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [trending, trendingTV, popular] = await Promise.all([
        getTrendingMovies(),
        getTrendingTV(),
        getPopularMovies(),
      ]);
      const allTrending = [...trending, ...trendingTV];
      if (allTrending.length > 0) setTrendingAll(allTrending);
      if (popular.length > 0) setMoviesData(popular);
      setHeroSlides(popular.slice(0, 5));
      getMovieGenres().then(setGenres).catch(() => {});
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

  // Handle ?play=1 redirect from detail page (uses sessionStorage bridge)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("play") === "1") {
      try {
        const raw = sessionStorage.getItem("chiller_play_item");
        if (raw) {
          const item = JSON.parse(raw) as MovieOrShow;
          sessionStorage.removeItem("chiller_play_item");
          // Resolve the actual stream URL (separate from trailer)
          getStreamUrl(item.id, item.type === 'series' || item.type === 'anime' ? item.type : 'movie', undefined, undefined, item.title).then(stream => {
            const updated = stream ? { ...item, videoUrl: stream.embedUrl } : { ...item, videoUrl: '' };
            setPlayingVideo({ item: updated, episode: undefined });
          });
          // Clean URL without reload
          window.history.replaceState({}, "", "/");
        }
      } catch (e) { /* ignore */ }
    }
  }, []);

  const loadContinueWatchingHistory = () => {
    const history: { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; updatedAt: number }[] = [];
    
    // Look for chiller_progress_* keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("chiller_progress_")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            // Match corresponding media item from our data
            const allData = [...trendingAll, ...moviesData, ...seriesData];
            const foundItem = allData.find((m) => m.id === parsed.id);
            if (foundItem) {
              history.push({
                item: foundItem,
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

    // Sort by most recently watched
    history.sort((a, b) => b.updatedAt - a.updatedAt);
    setContinueWatching(history.map(({ item, progress, remaining, episodeName }) => ({ item, progress, remaining, episodeName })));
  };

  // Toggle Favorite Action
  const toggleFavorite = (id: string) => {
    const nextFavorites = favorites.includes(id)
      ? favorites.filter((favId) => favId !== id)
      : [...favorites, id];
    
    setFavorites(nextFavorites);
    localStorage.setItem("chiller_favorites", JSON.stringify(nextFavorites));
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

  const handleWatchNow = async (item: MovieOrShow, episode?: Episode) => {
    setIsModalOpen(false);
    
    // Clear videoUrl before fetching stream to prevent trailer from playing initially
    setPlayingVideo({ item: { ...item, videoUrl: '' }, episode });
    
    let stream;
    if (episode) {
      stream = await getStreamUrl(item.id, item.type === 'documentary' ? 'movie' : item.type, activeSeason?.seasonNumber, episode.number, item.title);
    } else {
      stream = await getStreamUrl(item.id, item.type === 'documentary' ? 'movie' : item.type, undefined, undefined, item.title);
    }
    
    if (stream) {
      setPlayingVideo({ item: { ...item, videoUrl: stream.embedUrl }, episode });
    } else {
      setPlayingVideo({ item: { ...item, videoUrl: '' }, episode });
    }
  };

  const getFilteredMedia = (type: 'movie' | 'series' | 'anime') => {
    if (type === 'movie') return moviesData;
    if (type === 'series') return seriesData;
    if (type === 'anime') return animeData;
    return [];
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-dark transition-colors duration-300">
      
      {/* Main Content Area */}
      <main className="flex-grow transition-all duration-300">
        {playingVideo ? (
          /* Immersive Custom Video Player Mode */
          <VideoPlayer
            item={playingVideo.item}
            episode={playingVideo.episode}
            onBack={() => {
              setPlayingVideo(null);
              loadContinueWatchingHistory();
            }}
            onOpenDetails={handleOpenDetails}
          />
        ) : (
          /* Standard Browsing Portal Hub */
          <div className="space-y-10 pb-24">
            
            {/* HERO CAROUSEL — no padding-top, goes behind the navbar */}
            {activeTab === "home" && (
              <HeroCarousel
                slides={heroSlides}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
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
                  {/* Row 1: Trending Movies & Shows */}
                  <ScrollRow title="Trending Worldwide" accentColor="primary">
                    {trendingAll.map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
                      />
                    ))}
                  </ScrollRow>

                  {/* Row 4: Category Genres Visual Board */}
                  <div className="space-y-3">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span className="h-3 w-1 bg-brand-primary rounded-full" />
                      Browse by Genre
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                      {(genres.length > 0
                        ? genres.map(g => ({ id: String(g.id), name: g.name, imageUrl: '' }))
                        : []
                      ).slice(0, 10).map((g) => {
                        return (
                          <CategoryCard
                            key={g.id}
                            category={{
                              id: g.id,
                              name: g.name,
                              imageUrl: `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop`,
                            }}
                            onClick={() => { setActiveTab("categories"); }}
                          />
                        );
                      })}
                    </div>
                  </div>


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
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
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
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
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
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
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
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </div>
              )}



            </div>

          </div>
        )}
      </main>

      {/* Single full-screen overlay modal for detailed descriptions */}
      <MovieModal
        item={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWatch={handleWatchNow}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        onOpenDetails={(movie) => {
          setSelectedMovie(movie); // navigate to new movie details in modal without reloads
        }}
      />

      {/* Mobile Bottom Navigation */}
      {!playingVideo && (
        <BottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setPlayingVideo(null);
          }}
          onSearchClick={() => window.dispatchEvent(new Event("open-search"))}
        />
      )}

    </div>
  );
}
