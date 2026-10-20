import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import {
  getTrendingMovies,
  getTrendingTV,
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
  alternates: { canonical: "/" },
};

const getCachedTrendingMovies = unstable_cache(
  () => getTrendingMovies(),
  ["home-trending-movies"],
  { revalidate: 300, tags: ["home"] },
);
const getCachedTrendingTV = unstable_cache(
  () => getTrendingTV(),
  ["home-trending-tv"],
  { revalidate: 300, tags: ["home"] },
);
const getCachedAnimeSeries = unstable_cache(
  () => getAnimeSeriesPage(1),
  ["home-anime"],
  { revalidate: 300, tags: ["home"] },
);
const getCachedUpcomingMovies = unstable_cache(
  () => getUpcomingMovies(1),
  ["home-upcoming-movies"],
  { revalidate: 300, tags: ["home"] },
);

export default function HomePage() {
  return <Suspense fallback={<HomeSkeleton />}><HomeCriticalContent /></Suspense>;
}

async function HomeCriticalContent() {
  // Tier 1 (Critical, above-the-fold): Only hero-critical calls
  // Trending films + séries, et animes phares (pas d'endpoint "trending anime" sur TMDb).
  const trendingMoviesPromise = getCachedTrendingMovies().catch(() => []);
  const trendingTVPromise = getCachedTrendingTV().catch(() => []);
  const animeSeriesPromise = getCachedAnimeSeries().catch(() => ({ results: [], totalPages: 1 }));
  const upcomingMoviesPromise = getCachedUpcomingMovies().catch(() => []);
  const [trendingMovies, trendingTV, animeSeriesPage] = await Promise.all([
    trendingMoviesPromise,
    trendingTVPromise,
    animeSeriesPromise,
  ]);

  const animeCollection = animeSeriesPage.results || [];

  // Hero Carousel dynamique : mélange équilibré de films/séries en tendance + animes phares
  const heroBase = [];
  const mSlice = (trendingMovies || []).slice(0, 5);
  const sSlice = (trendingTV || []).slice(0, 4);
  const aSlice = animeCollection.slice(0, 3);
  const maxLen = Math.max(mSlice.length, sSlice.length, aSlice.length);
  for (let i = 0; i < maxLen; i++) {
    if (mSlice[i]) heroBase.push(mSlice[i]);
    if (sSlice[i]) heroBase.push(sSlice[i]);
    if (aSlice[i]) heroBase.push(aSlice[i]);
  }

  const heroSlides = heroBase.slice(0, 10);

  return (
    <HomeClientWrapper
      heroSlides={trimShowcaseItems(heroSlides)}
      trendingMoviesPromise={trendingMoviesPromise}
      trendingTVPromise={trendingTVPromise}
      upcomingMoviesPromise={upcomingMoviesPromise}
      popularSeries={trimRowItems(trendingTV)}
      animeCollection={trimRowItems(animeCollection)}
    >
      <Suspense fallback={<HomeSecondarySkeleton />}>
        <HomeSecondaryStream />
      </Suspense>
    </HomeClientWrapper>
  );
}
