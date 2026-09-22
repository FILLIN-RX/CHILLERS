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
  getMoviesByGenre,
  getTVByGenrePage,
  getBoxOfficeMovies,
  getNewAnime,
  getMartialArtsMovies,
  getMadeInChina,
  getTopRatedMovies,
  getTopRatedTV,
  getBarbieMovies,
  getRealityShows,
  getAllTimeFavorites,
} from "@/app/api";
import HomeClientWrapper from "./HomeClientWrapper";
import HomeSkeleton from "@/components/HomeSkeleton";

export const revalidate = 3600;

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
    topRatedMovies,
    topRatedTV,
    actionMovies,
    comedyMovies,
    actionSeries,
    animationSeries,
    boxOffice,
    newAnime,
    martialArts,
    tvForYouPage,
    saDrama,
    madeInChina,
    barbieMovies,
    realityShows,
    allTimeFavorites,
  ] = await Promise.all([
    getTrendingMovies().catch(() => []),
    getTrendingTV().catch(() => []),
    getPopularMoviesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getPopularTVPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getAnimeSeriesPage(1).catch(() => ({ results: [], totalPages: 1 })),
    getAfricanMovies(1).catch(() => []),
    getAfricanTV(1).catch(() => []),
    getUpcomingMovies(1).catch(() => []),
    getTopRatedMovies().catch(() => []),
    getTopRatedTV().catch(() => []),
    getMoviesByGenre("28", 1).catch(() => []),
    getMoviesByGenre("35", 1).catch(() => []),
    getTVByGenrePage("10759", 1).catch(() => ({ results: [], totalPages: 1 })),
    getTVByGenrePage("16", 1).catch(() => ({ results: [], totalPages: 1 })),
    getBoxOfficeMovies(1).catch(() => []),
    getNewAnime(1).catch(() => []),
    getMartialArtsMovies(1).catch(() => []),
    getPopularTVPage(2).catch(() => ({ results: [], totalPages: 1 })),
    getAfricanTV(1, "ZA").catch(() => []), // SA Drama
    getMadeInChina(1).catch(() => []),
    getBarbieMovies(1).catch(() => []),
    getRealityShows(1).catch(() => []),
    getAllTimeFavorites(1).catch(() => []),
  ]);

  const trendingAll = [...trendingMovies, ...trendingTV];

  console.log("FETCH RESULTS:", {
    martialArts: martialArts.length,
    newAnime: newAnime.length,
    tvForYou: tvForYouPage.results?.length,
    saDrama: saDrama.length,
    madeInChina: madeInChina.length,
    boxOffice: boxOffice.length,
    barbieMovies: barbieMovies.length,
    realityShows: realityShows.length,
    allTimeFavorites: allTimeFavorites.length,
  });

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
    <Suspense fallback={<HomeSkeleton />}>
      <HomeClientWrapper
        heroSlides={heroSlides}
        trendingAll={trendingAll}
        newReleases={newReleases}
        upcomingMovies={newReleases}
        popularSeries={popularSeries}
        animeCollection={animeCollection}
        africanMovies={africanMovies}
        africanSeries={africanSeries}
        topRatedMovies={topRatedMovies}
        topRatedTV={topRatedTV}
        actionMovies={actionMovies}
        comedyMovies={comedyMovies}
        actionSeries={actionSeries.results || []}
        animationSeries={animationSeries.results || []}
        boxOffice={boxOffice}
        newAnime={newAnime}
        martialArts={martialArts}
        tvForYou={tvForYouPage.results || []}
        saDrama={saDrama}
        madeInChina={madeInChina}
        barbieMovies={barbieMovies}
        realityShows={realityShows}
        allTimeFavorites={allTimeFavorites}
      />
    </Suspense>
  );
}

