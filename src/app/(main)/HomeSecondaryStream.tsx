import {
  getAfricanMovies,
  getAfricanTV,
  getTopRatedMovies,
  getTopRatedTV,
  getMoviesByGenre,
  getTVByGenrePage,
  getBoxOfficeMovies,
  getNewAnime,
  getMartialArtsMovies,
  getPopularTVPage,
  getMadeInChina,
  getBarbieMovies,
  getRealityShows,
  getAllTimeFavorites,
} from "@/app/api";
import HomeSecondaryClientRows from "./HomeSecondaryClientRows";
import { trimRowItems } from "./homeMedia";

export default async function HomeSecondaryStream() {
  const [
    africanM,
    africanS,
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
    getAfricanMovies(1).catch(() => []),
    getAfricanTV(1).catch(() => []),
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
    getAfricanTV(1, "ZA").catch(() => []),
    getMadeInChina(1).catch(() => []),
    getBarbieMovies(1).catch(() => []),
    getRealityShows(1).catch(() => []),
    getAllTimeFavorites(1).catch(() => []),
  ]);

  return (
    <HomeSecondaryClientRows
      africanMovies={trimRowItems(africanM || [])}
      africanSeries={trimRowItems(africanS || [])}
      topRatedMovies={trimRowItems(topRatedMovies)}
      topRatedTV={trimRowItems(topRatedTV)}
      actionMovies={trimRowItems(actionMovies)}
      comedyMovies={trimRowItems(comedyMovies)}
      actionSeries={trimRowItems(actionSeries.results || [])}
      animationSeries={trimRowItems(animationSeries.results || [])}
      boxOffice={trimRowItems(boxOffice)}
      newAnime={trimRowItems(newAnime)}
      martialArts={trimRowItems(martialArts)}
      tvForYou={trimRowItems(tvForYouPage.results || [])}
      saDrama={trimRowItems(saDrama)}
      madeInChina={trimRowItems(madeInChina)}
      barbieMovies={trimRowItems(barbieMovies)}
      realityShows={trimRowItems(realityShows)}
      allTimeFavorites={trimRowItems(allTimeFavorites)}
    />
  );
}
