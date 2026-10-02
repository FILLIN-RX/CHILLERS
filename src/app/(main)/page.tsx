import { Metadata } from "next";
import { Suspense } from "react";
import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMoviesPage,
  getPopularTVPage,
  getAnimeSeriesPage,
  getUpcomingMovies,
} from "@/app/api";
import HomeClientWrapper from "./HomeClientWrapper";
import HomeSkeleton from "@/components/HomeSkeleton";
import HomeSecondaryStream from "./HomeSecondaryStream";
import HomeSecondarySkeleton from "@/components/HomeSecondarySkeleton";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Accueil",
  description: "Découvrez les meilleurs films, séries et animes en streaming gratuit.",
};

export default async function HomePage() {
  // 1. Tier 1 (Above-the-fold) : Seules les 6 requêtes critiques sont exécutées immédiatement
  const [
    trendingMovies,
    trendingTV,
    popularMoviesPage,
    popularTVPage,
    animeSeriesPage,
    newReleases,
  ] = await Promise.all([
    getTrendingMovies().catch(() => []),
    getTrendingTV().catch(() => []),
    getPopularMoviesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getPopularTVPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getAnimeSeriesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getUpcomingMovies(1).catch(() => []),
  ]);

  const trendingAll = [...trendingMovies, ...trendingTV];
  const popularSeries = popularTVPage.results || [];
  const animeCollection = animeSeriesPage.results || [];

  // Hero Carousel dynamique : mélange équilibré de films populaires, grandes séries et animes phares
  const heroBase = [];
  const mSlice = (popularMoviesPage.results || []).slice(0, 5);
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
    <Suspense fallback={<HomeSkeleton />}>
      <HomeClientWrapper
        heroSlides={heroSlides}
        trendingAll={trendingAll}
        newReleases={newReleases}
        upcomingMovies={newReleases}
        popularSeries={popularSeries}
        animeCollection={animeCollection}
      >
        {/* Tier 2 (Below-the-fold) : Streamé progressivement en arrière-plan sans bloquer le TTFB */}
        <Suspense fallback={<HomeSecondarySkeleton />}>
          <HomeSecondaryStream />
        </Suspense>
      </HomeClientWrapper>
    </Suspense>
  );
}
