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
import LiveMatchesRow from "@/components/LiveMatchesRow";
import { useLanguage } from "@/i18n/LanguageContext";
import type { MovieOrShow, Episode } from "@/types/media";
import UpgradeModal from "@/components/UpgradeModal";
import { useAuthStore } from "@/stores/useAuthStore";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const MovieModal = dynamic(() => import("@/components/MovieModal"), { ssr: false });

export interface HomeClientWrapperProps {
  heroSlides: MovieOrShow[];
  trendingAll: MovieOrShow[];
  newReleases: MovieOrShow[];
  popularSeries: MovieOrShow[];
  animeCollection: MovieOrShow[];
  africanMovies: MovieOrShow[];
  africanSeries: MovieOrShow[];
}

export default function HomeClientWrapper({
  heroSlides,
  trendingAll,
  newReleases,
  popularSeries,
  animeCollection,
  africanMovies,
  africanSeries
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
      const fresh = items.filter((it) => !seen.has(it.id));
      fresh.forEach((it) => seen.add(it.id));
      if (fresh.length === 0) return;
      rows.push({ title, items: fresh, accent, variant, autoScroll, autoScrollSpeed });
    };

    push(_("home.trending"), trendingAll, "primary", "poster");
    push("Nouveautés", newReleases, "primary", "poster");
    push(_("home.mostWatched"), mostWatched, "primary", undefined, true, 0.4);
    push(_("home.trendingNow"), trendingNow, "secondary", undefined, true, 0.5);
    push(_("home.popularSeries"), popularSeries, "primary");
    push(_("home.animeCollection"), animeCollection, "secondary");
    push("Films Africains", africanMovies, "secondary");
    push("Séries Africaines", africanSeries, "secondary");

    return rows;
  }, [trendingAll, newReleases, mostWatched, trendingNow, popularSeries, animeCollection, africanMovies, africanSeries, _]);

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

  // Infinite Scroll logic for rows
  const [visibleRowsCount, setVisibleRowsCount] = useState(4);
  const [rowsLoadingState, setRowsLoadingState] = useState<'idle' | 'loading'>('idle');

  const handleLoadMoreRows = useCallback(() => {
    setRowsLoadingState('loading');
    setTimeout(() => {
      setVisibleRowsCount((prev) => Math.min(prev + 4, homeRows.length));
      setRowsLoadingState('idle');
    }, 100);
  }, [homeRows.length]);

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: handleLoadMoreRows,
    hasMore: visibleRowsCount < homeRows.length,
    isLoading: rowsLoadingState === 'loading',
    rootMargin: "800px",
  });

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

            {trendingAll.length > 0 && (
              <MostViewedMovie
                item={trendingAll[0]}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
              />
            )}

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

            {homeRows.slice(5, visibleRowsCount).map((row) => (
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

            <div ref={sentinelRef} className="h-10 w-full pointer-events-none" />
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
