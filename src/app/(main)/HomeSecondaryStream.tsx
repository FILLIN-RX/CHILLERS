import {
  getAfricanMovies,
  getAfricanTV,
  getTopRatedMovies,
  getTopRatedTV,
  getMoviesByGenre,
  getTVByGenrePage,
  getBoxOfficeMovies,
  getNewAnime,
  getPopularTVPage,
} from "@/app/api";
import HomeSecondaryClientRows from "./HomeSecondaryClientRows";
import { trimRowItems } from "./homeMedia";

export default async function HomeSecondaryStream() {
  // 10 appels au lieu de 17 : moins de travail serveur et ~40 % de payload
  // React Flight en moins, donc moins de parse HTML sur le main thread mobile.
  const [
    africanM,
    africanS,
    topRatedMovies,
    topRatedTV,
    actionMovies,
    comedyMovies,
    actionSeries,
    boxOffice,
    newAnime,
    tvForYouPage,
  ] = await Promise.all([
    getAfricanMovies(1).catch(() => []),
    getAfricanTV(1).catch(() => []),
    getTopRatedMovies().catch(() => []),
    getTopRatedTV().catch(() => []),
    getMoviesByGenre("28", 1).catch(() => []),
    getMoviesByGenre("35", 1).catch(() => []),
    getTVByGenrePage("10759", 1).catch(() => ({ results: [], totalPages: 1 })),
    getBoxOfficeMovies(1).catch(() => []),
    getNewAnime(1).catch(() => []),
    getPopularTVPage(2).catch(() => ({ results: [], totalPages: 1 })),
  ]);

  return (
    <div className="space-y-5">
      <HomeSecondaryClientRows
      africanMovies={trimRowItems(africanM || [])}
      africanSeries={trimRowItems(africanS || [])}
      topRatedMovies={trimRowItems(topRatedMovies)}
      topRatedTV={trimRowItems(topRatedTV)}
      actionMovies={trimRowItems(actionMovies)}
      comedyMovies={trimRowItems(comedyMovies)}
      actionSeries={trimRowItems(actionSeries.results || [])}
      animationSeries={[]}
      boxOffice={trimRowItems(boxOffice)}
      newAnime={trimRowItems(newAnime)}
      martialArts={[]}
      tvForYou={trimRowItems(tvForYouPage.results || [])}
      saDrama={[]}
      madeInChina={[]}
      barbieMovies={[]}
      realityShows={[]}
      allTimeFavorites={[]}
      />
    </div>
  );
}
