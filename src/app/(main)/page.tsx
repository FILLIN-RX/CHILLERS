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
import { SITE_URL } from "@/lib/seo";
import type { MovieOrShow } from "@/types/media";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Accueil",
  description: "Découvrez les meilleurs films, séries et animes en streaming gratuit.",
  // URL canonique absolue — évite que Google interprète "/" comme chillers.site (sans www)
  alternates: { canonical: SITE_URL },
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

// A slow upstream should not hold the whole home page behind its hero.
// This is a display deadline: the remaining hero sources can still populate
// the carousel when one source (for example anime) is temporarily unavailable.
function settleWithin<T>(promise: Promise<T>, fallback: T, timeoutMs = 2_500): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function buildHeroSlides(movies: MovieOrShow[], tv: MovieOrShow[], anime: MovieOrShow[]) {
  const movieSlice = movies.slice(0, 5);
  const tvSlice = tv.slice(0, 4);
  const animeSlice = anime.slice(0, 3);
  const slides: MovieOrShow[] = [];
  const maxLength = Math.max(movieSlice.length, tvSlice.length, animeSlice.length);
  for (let index = 0; index < maxLength; index++) {
    if (movieSlice[index]) slides.push(movieSlice[index]);
    if (tvSlice[index]) slides.push(tvSlice[index]);
    if (animeSlice[index]) slides.push(animeSlice[index]);
  }
  return slides.slice(0, 10);
}

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
  // Let the first films paint without waiting on the slower TV/anime sources.
  // Once those independent requests settle, the carousel adds the remaining slides.
  const trendingMovies = await settleWithin(trendingMoviesPromise, [], 2500);
  const heroSlidesPromise = Promise.all([
    trendingMoviesPromise,
    trendingTVPromise,
    animeSeriesPromise.then((page) => page.results || []),
  ]).then(([movies, tv, anime]) => buildHeroSlides(movies, tv, anime));
  const heroSlides = trimShowcaseItems(buildHeroSlides(trendingMovies, [], []));
  const animeCollectionPromise = animeSeriesPromise.then((page) => page.results || []);

  return (
    <HomeClientWrapper
      heroSlides={heroSlides}
      heroSlidesPromise={heroSlidesPromise.then(trimShowcaseItems)}
      trendingMoviesPromise={trendingMoviesPromise}
      trendingTVPromise={trendingTVPromise}
      upcomingMoviesPromise={upcomingMoviesPromise}
      popularSeries={[]}
      popularSeriesPromise={trendingTVPromise.then(trimRowItems)}
      animeCollection={[]}
      animeCollectionPromise={animeCollectionPromise.then(trimRowItems)}
    >
      <Suspense fallback={<HomeSecondarySkeleton />}>
        <HomeSecondaryStream />
      </Suspense>
    </HomeClientWrapper>
  );
}
