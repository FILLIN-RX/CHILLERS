"use client";

import React, { useState, useEffect, useMemo, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import MovieCard from "@/components/MovieCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import ScrollRow from "@/components/ScrollRow";
import SpotlightGrid from "@/components/SpotlightGrid";
import MostViewedMovie from "@/components/MostViewedMovie";
import Top10Row from "@/components/Top10Row";
import LiveMatchesRow from "@/components/LiveMatchesRow";
import { useLanguage } from "@/i18n/LanguageContext";
import type { MovieOrShow, Episode } from "@/types/media";
import UpgradeModal from "@/components/UpgradeModal";
import { useAuthStore } from "@/stores/useAuthStore";

const MovieModal = dynamic(() => import("@/components/MovieModal"), { ssr: false });

export interface HomeClientWrapperProps {
  heroSlides: MovieOrShow[];
  trendingAll: MovieOrShow[];
  newReleases: MovieOrShow[];
  upcomingMovies?: MovieOrShow[];
  popularSeries: MovieOrShow[];
  animeCollection: MovieOrShow[];
  africanMovies: MovieOrShow[];
  africanSeries: MovieOrShow[];
  topRatedMovies: MovieOrShow[];
  topRatedTV: MovieOrShow[];
  actionMovies: MovieOrShow[];
  comedyMovies: MovieOrShow[];
  actionSeries: MovieOrShow[];
  animationSeries: MovieOrShow[];
  boxOffice: MovieOrShow[];
  newAnime: MovieOrShow[];
  martialArts: MovieOrShow[];
  tvForYou: MovieOrShow[];
  saDrama: MovieOrShow[];
  madeInChina: MovieOrShow[];
  barbieMovies: MovieOrShow[];
  realityShows: MovieOrShow[];
  allTimeFavorites?: MovieOrShow[];
}

export default function HomeClientWrapper({
  heroSlides,
  trendingAll,
  newReleases,
  upcomingMovies,
  popularSeries,
  animeCollection,
  africanMovies,
  africanSeries,
  topRatedMovies,
  topRatedTV,
  actionMovies,
  comedyMovies,
  actionSeries,
  animationSeries,
  boxOffice,
  newAnime,
  martialArts,
  tvForYou,
  saDrama,
  madeInChina,
  barbieMovies,
  realityShows,
  allTimeFavorites = [],
}: HomeClientWrapperProps) {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const user = useAuthStore((s) => s.user);

  const [selectedMovie, setSelectedMovie] = useState<MovieOrShow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [continueWatching, setContinueWatching] = useState<
    { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; season?: number; episode?: number }[]
  >([]);

  // Calculate animated rows
  const mostWatched = useMemo(
    () => [...trendingAll].filter((m) => m.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 10),
    [trendingAll]
  );
  const trendingNow = useMemo(
    () => [...trendingAll].filter((m) => m.year > 0).sort((a, b) => b.year - a.year).slice(0, 10),
    [trendingAll]
  );

  // Filter strictly unreleased upcoming movies with poster for the full-width spotlight banner
  const upcomingList = useMemo(() => {
    const list = upcomingMovies && upcomingMovies.length > 0 ? upcomingMovies : newReleases;
    const today = new Date().toISOString().split("T")[0];
    const unreleased = list.filter((m) => Boolean(m.posterUrl) && Boolean(m.releaseDate && m.releaseDate >= today));
    return unreleased.length > 0 ? unreleased : list.filter((m) => Boolean(m.posterUrl));
  }, [upcomingMovies, newReleases]);

  // Global Deduplication Logic
  const homeRows = useMemo(() => {
    const rows: Array<{
      title: string;
      items: MovieOrShow[];
      accent: "primary" | "secondary";
      variant?: "poster";
      autoScroll?: boolean;
      autoScrollSpeed?: number;
    }> = [];
    const seen = new Set<string>();
    const push = (
      title: string,
      items: MovieOrShow[],
      accent: "primary" | "secondary",
      variant?: "poster",
      autoScroll?: boolean,
      autoScrollSpeed?: number,
    ) => {
      const isCustomCategory = [
        "Box office",
        "New Anime",
        "Martial art",
        "TV for you",
        "SA Drama",
        "Made in China",
        "Séries d'Animation",
        "Séries Action & Aventure",
        "Comédies à voir",
        "Films d'Action",
        "Barbie World",
        "Barbie Princess World",
        "Reality Show",
        "All time favorite",
      ].includes(title);
      const fresh = isCustomCategory ? items : items.filter((it) => !seen.has(it.id));
      
      fresh.forEach((it) => seen.add(it.id));
      if (fresh.length === 0) return;
      rows.push({ title, items: fresh, accent, variant, autoScroll, autoScrollSpeed });
    };

    push(_("home.trending"), trendingAll, "primary", "poster");
    push("Nouveautés", newReleases, "primary", "poster");
    push("TV for you", tvForYou, "primary", "poster");
    
    // All time favorite: iconic classics (Game of Thrones, Vampire Diaries, Breaking Bad, etc.)
    const favoritesList = allTimeFavorites && allTimeFavorites.length > 0 
      ? allTimeFavorites 
      : [...topRatedTV, ...topRatedMovies];
    push("All time favorite", favoritesList, "secondary", "poster");

    push("Box office", boxOffice, "primary", "poster");
    push("New Anime", newAnime, "secondary", "poster");
    push("Martial art", martialArts, "primary", "poster");
    push("Reality Show", realityShows, "primary", "poster");
    push("Barbie World", barbieMovies, "secondary", "poster");

    push("Films d'Action", actionMovies, "primary", "poster");
    push("Comédies à voir", comedyMovies, "secondary", "poster");
    push("Séries Action & Aventure", actionSeries, "secondary", "poster");
    push("Films Africains", africanMovies, "secondary", "poster");
    push("Séries Africaines", africanSeries, "secondary", "poster");
    push("SA Drama", saDrama, "secondary", "poster");
    push("Made in China", madeInChina, "primary", "poster");

    push(_("home.popularSeries"), popularSeries, "primary", "poster");
    push(_("home.animeCollection"), animeCollection, "secondary", "poster");
    push("Séries d'Animation", animationSeries, "primary", "poster");
    push(_("home.mostWatched"), mostWatched, "primary", "poster", true, 0.4);
    push(_("home.trendingNow"), trendingNow, "secondary", "poster", true, 0.5);

    return rows;
  }, [
    trendingAll, newReleases, mostWatched, trendingNow, popularSeries, 
    animeCollection, africanMovies, africanSeries, topRatedMovies, topRatedTV, 
    actionMovies, comedyMovies, actionSeries, animationSeries,
    boxOffice, newAnime, martialArts, tvForYou, saDrama, madeInChina,
    barbieMovies, realityShows, allTimeFavorites, _
  ]);

  // Load Continue Watching
  useEffect(() => {
    const history: any[] = [];
    if (user && user.continueWatching) {
      user.continueWatching.forEach((cw: any) => {
        history.push({
          item: {
            id: cw.tmdbId,
            title: cw.title,
            type: cw.mediaType,
            posterUrl: cw.posterPath || '',
            backdropUrl: cw.backdropPath || '',
            description: '',
            synopsis: '',
            rating: 0,
            year: 0,
            duration: '',
            genres: [],
            cast: [],
            videoUrl: '',
          },
          progress: cw.progress ? Math.min((cw.progress / cw.duration) * 100, 100) : 0,
          remaining: cw.duration && cw.progress ? `${Math.round((cw.duration - cw.progress) / 60)}m left` : '',
          episodeName: cw.season && cw.episode ? `S${String(cw.season).padStart(2, "0")}E${String(cw.episode).padStart(2, "0")}` : undefined,
          season: cw.season,
          episode: cw.episode,
          updatedAt: new Date(cw.updatedAt).getTime(),
        });
      });
    } else {
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
          } catch (e) {}
        }
      }
    }
    history.sort((a, b) => b.updatedAt - a.updatedAt);
    setContinueWatching(history);
  }, [user]);

  const handleOpenDetails = useCallback((item: MovieOrShow) => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      if (item.type === "series" || item.type === "anime") {
        router.push(`/tv/${item.id}`);
      } else {
        router.push(`/media/${item.id}`);
      }
      return;
    }
    setSelectedMovie(item);
    setIsModalOpen(true);
  }, [router]);

  const handleWatchNow = useCallback((item: MovieOrShow, season?: number, episode?: number) => {
    setIsModalOpen(false);
    const typeParam = item.type === "series" || item.type === "anime" ? "tv" : "movie";
    let url = `/watch/${item.id}?type=${typeParam}`;
    if (season) url += `&season=${season}`;
    if (episode) url += `&episode=${episode}`;
    startTransition(() => {
      router.push(url);
    });
  }, [router]);

  const handleResume = (item: MovieOrShow, season?: number, episode?: number) => {
    if (!user || (user?.subscription?.features && !user.subscription.features.hasContinueWatching)) {
      setShowUpgradeModal(true);
      return;
    }
    handleWatchNow(item, season, episode);
  };

  const handleModalWatch = (item: MovieOrShow, episode?: Episode) => {
    handleWatchNow(item, episode?.season, episode?.number);
  };

  return (
    <div className="flex-1 flex flex-col bg-brand-dark transition-colors duration-300">
      <main className="flex-grow transition-all duration-300">
        <div className="space-y-10 pb-24">
          
          <HeroCarousel
            slides={heroSlides}
            onWatchNow={handleWatchNow}
            onOpenDetails={handleOpenDetails}
            slideTimings={[20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000]}
          />

          {continueWatching.length > 0 && (
            <div className="max-w-full mx-auto px-2 lg:px-3">
              <ScrollRow title={_("home.continueWatching")} accentColor="secondary">
                {continueWatching.map(({ item, progress, remaining, episodeName, season, episode }) => (
                  <ContinueWatchingCard
                    key={item.id}
                    item={item}
                    progress={progress}
                    remainingTime={remaining}
                    episodeName={episodeName}
                    onResume={() => handleResume(item, season, episode)}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </ScrollRow>
            </div>
          )}

          <div className="max-w-full mx-auto px-2 lg:px-3 space-y-8">
            <LiveMatchesRow />

            {homeRows.slice(0, 2).map((row) => (
              <ScrollRow
                key={row.title}
                title={row.title}
                accentColor={row.accent}
                autoScroll={row.autoScroll}
                autoScrollSpeed={row.autoScrollSpeed}
              >
                {row.items.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    variant={row.variant}
                    onPlay={handleWatchNow}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </ScrollRow>
            ))}

            {(upcomingList.length > 0 || trendingAll.length > 0) && (
              <MostViewedMovie
                items={upcomingList.length > 0 ? upcomingList : trendingAll}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
              />
            )}

            <Top10Row
              title="Top 10 : Ce que tout le monde regarde"
              items={trendingAll}
            />

            {homeRows.slice(2, 5).map((row) => (
              <ScrollRow
                key={row.title}
                title={row.title}
                accentColor={row.accent}
                autoScroll={row.autoScroll}
                autoScrollSpeed={row.autoScrollSpeed}
              >
                {row.items.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    variant={row.variant}
                    onPlay={handleWatchNow}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </ScrollRow>
            ))}

            {trendingAll.length >= 6 && (
              <SpotlightGrid
                items={trendingAll.slice(1, 6)}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
              />
            )}

            {homeRows.slice(5).map((row) => (
              <ScrollRow
                key={row.title}
                title={row.title}
                accentColor={row.accent}
                autoScroll={row.autoScroll}
                autoScrollSpeed={row.autoScrollSpeed}
              >
                {row.items.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    variant={row.variant}
                    onPlay={handleWatchNow}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </ScrollRow>
            ))}
          </div>
        </div>
      </main>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        featureName="La reprise de lecture"
      />

      <MovieModal
        item={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMovie(null);
        }}
        onWatch={handleModalWatch}
        onOpenDetails={(movie) => {
          setSelectedMovie(movie);
        }}
      />
    </div>
  );
}
