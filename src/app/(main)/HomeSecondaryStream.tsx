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
      africanMovies={africanM || []}
      africanSeries={africanS || []}
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
  );
}
