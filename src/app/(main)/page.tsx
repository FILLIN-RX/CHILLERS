import { Metadata } from "next";
import { Suspense } from "react";
import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMoviesPage,
  getPopularTVPage,
  getAnimeSeriesPage,
  getAfricanMovies,
  getAfricanTV,
  getUpcomingMovies,
} from "@/app/api";
import HomeClientWrapper from "./HomeClientWrapper";

export const metadata: Metadata = {
  title: "Accueil",
  description: "Découvrez les meilleurs films, séries et animes en streaming gratuit.",
};

export default async function HomePage() {
  // 1. Lancer toutes les requêtes en parallèle depuis le serveur
  const [
    trendingMovies,
    trendingTV,
    popularMoviesPage,
    popularTVPage,
    animeSeriesPage,
    africanM,
    africanS,
    newReleases,
  ] = await Promise.all([
    getTrendingMovies().catch(() => []),
    getTrendingTV().catch(() => []),
    getPopularMoviesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getPopularTVPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getAnimeSeriesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getAfricanMovies(1).catch(() => []),
    getAfricanTV(1).catch(() => []),
    getUpcomingMovies(1).catch(() => []),
  ]);

  const trendingAll = [...trendingMovies, ...trendingTV];
  const popularSeries = popularTVPage.results;
  const animeCollection = animeSeriesPage.results;
  const africanMovies = africanM;
  const africanSeries = africanS;

  // Hero Carousel dynamique : mélange équilibré de films populaires, grandes séries et animes phares
  const heroBase = [];
  const mSlice = popularMoviesPage.results.slice(0, 5);
  const sSlice = popularSeries.slice(0, 4);
  const aSlice = animeCollection.slice(0, 3);
  const maxLen = Math.max(mSlice.length, sSlice.length, aSlice.length);
  for (let i = 0; i < maxLen; i++) {
    if (mSlice[i]) heroBase.push(mSlice[i]);
    if (sSlice[i]) heroBase.push(sSlice[i]);
    if (aSlice[i]) heroBase.push(aSlice[i]);
  }
  
  const heroSlides = heroBase.slice(0, 10);

  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeClientWrapper
        heroSlides={heroSlides}
        trendingAll={trendingAll}
        newReleases={newReleases}
        popularSeries={popularSeries}
        animeCollection={animeCollection}
        africanMovies={africanMovies}
        africanSeries={africanSeries}
      />
    </Suspense>
  );
}

function HomeFallback() {
  return (
    <div className="min-h-screen bg-brand-dark text-white pb-24">
      {/* HERO CAROUSEL SKELETON */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[2.4/1] min-h-[420px] max-h-[680px] bg-zinc-900 animate-pulse overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 md:px-12 lg:px-16 pb-12 space-y-4">
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-zinc-800" />
            <div className="h-6 w-28 rounded-full bg-zinc-800" />
          </div>
          <div className="h-10 sm:h-14 w-2/3 max-w-xl bg-zinc-800 rounded-2xl" />
          <div className="h-4 w-1/2 max-w-md bg-zinc-800 rounded-lg" />
        </div>
      </div>

      {/* CATEGORY ROWS SKELETONS */}
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 space-y-10 mt-8">
        {Array.from({ length: 4 }).map((_, rowIdx) => (
          <div key={rowIdx} className="space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-7 w-48 bg-zinc-800 rounded-lg" />
            </div>
            <div className="flex gap-3 sm:gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, colIdx) => (
                <div key={colIdx} className="flex-none w-[165px] h-[250px] sm:w-[195px] sm:h-[295px] rounded-2xl bg-zinc-800/80" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
