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
import { trimRowItems, trimShowcaseItems } from "./homeMedia";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Accueil",
  description: "Découvrez les meilleurs films, séries et animes en streaming gratuit.",
};

export default async function HomePage() {
  // Tier 1 (Critical, above-the-fold): Only hero-critical calls
  // These three build the heroSlides and must resolve before page renders
  const [
    popularMoviesPage,
    popularTVPage,
    animeSeriesPage,
  ] = await Promise.all([
    getPopularMoviesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getPopularTVPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getAnimeSeriesPage(1).catch(() => ({ results: [], totalPages: 1 })),
  ]);

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

  // Tier 2 (Deferred, non-critical): Start these promises but do NOT await them in critical path
  // These will be streamed to HomeClientWrapper as promises
  const trendingMoviesPromise = getTrendingMovies().catch(() => []);
  const trendingTVPromise = getTrendingTV().catch(() => []);
  const upcomingMoviesPromise = getUpcomingMovies(1).catch(() => []);

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeClientWrapper
        heroSlides={trimShowcaseItems(heroSlides)}
        trendingMoviesPromise={trendingMoviesPromise}
        trendingTVPromise={trendingTVPromise}
        upcomingMoviesPromise={upcomingMoviesPromise}
        popularSeries={trimRowItems(popularSeries)}
        animeCollection={trimRowItems(animeCollection)}
      >
        {/* Tier 2 (Below-the-fold) : Streamé progressivement en arrière-plan sans bloquer le TTFB */}
        <Suspense fallback={<HomeSecondarySkeleton />}>
          <HomeSecondaryStream />
        </Suspense>
      </HomeClientWrapper>
    </Suspense>
  );
}
