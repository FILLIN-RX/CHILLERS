// Public API of the media service. All HTTP calls go through services/http.ts;
// all cached concerns are delegated to TanStack Query at the hook layer (Phase 2).
//
// Each function:
// - Accepts an AbortSignal for cancellation (propagated to the underlying fetch).
// - Throws on network/parse errors that aren't DOMException("AbortError").
//   Most callers should use react-query so they don't have to handle throws explicitly.

import { httpJson, HttpError, API_BASE_PATH } from "./http";
import type { MovieOrShow, Genre, MediaType } from "@/types/media";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return true; // Faible résolution par défaut (SSR)
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn) return true; // Faible résolution par défaut si l'API n'est pas supportée
  if (conn.saveData) return true;
  if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g" || conn.effectiveType === "3g") return true;
  if (conn.effectiveType === "4g") return false;
  return true; // Faible résolution par défaut
}

export function getTmdbImageUrl(
  path?: string | null,
  type: "poster" | "backdrop" | "still" = "poster",
  original = false,
): string {
  if (!path) return "";
  const weak = isSlowConnection();

  // Si on force "original" mais que le réseau est faible, on rétrograde à une taille adaptée
  if (original && !weak) {
    return `https://image.tmdb.org/t/p/original${path}`;
  }

  // TMDB ne génère pas toujours les très petites résolutions (w185/w300) pour toutes les images récentes,
  // ce qui cause des erreurs 404. On utilise w500 et w780 comme fallback fiable "faible résolution".
  if (type === "backdrop") {
    return `https://image.tmdb.org/t/p/${weak ? "w780" : "original"}${path}`;
  }
  if (type === "still") {
    return `https://image.tmdb.org/t/p/${weak ? "w500" : "original"}${path}`;
  }
  return `https://image.tmdb.org/t/p/${weak ? "w500" : "original"}${path}`;
}

function clientLang(): string {
  if (typeof window === "undefined") return "fr";
  try {
    return localStorage.getItem("chillers-lang") || "fr";
  } catch {
    return "fr";
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  provider?: string;
}

/* ─── TMDB → MovieOrShow mapping ──────────────────────────────────────────── */

const GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

/** Loose shape of a TMDB item; we keep it intentionally untyped to absorb upstream variations. */
export interface TmdbRawItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  number_of_seasons?: number;
  seasons?: Array<{
    id: number;
    name: string;
    season_number: number;
    poster_path?: string | null;
    episode_count?: number;
    air_date?: string | null;
  }>;
  credits?: { cast?: Array<{ name: string }> };
  videos?: { results?: Array<{ site?: string; type?: string; key?: string; official?: boolean }> };
}

export function mapTMDBToMovieOrShow(
  item: TmdbRawItem,
  typeOverride?: MediaType,
): MovieOrShow {
  const isTV =
    item.media_type === "tv" ||
    item.first_air_date !== undefined ||
    item.name !== undefined;

  let type: MediaType = typeOverride || (isTV ? "series" : "movie");

  const genreIds = item.genre_ids || [];
  if (genreIds.includes(16)) {
    type = "anime";
  } else if (genreIds.includes(99)) {
    type = "documentary";
  }

  const releaseDate = item.release_date || item.first_air_date || "";
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 2026;

  let genres: string[] = [];
  if (Array.isArray(item.genre_ids)) {
    genres = item.genre_ids.map((id) => GENRE_MAP[id] || "").filter(Boolean);
  } else if (Array.isArray(item.genres)) {
    genres = item.genres.map((g) => g.name || "");
  }
  if (genres.length === 0) {
    genres = [
      type === "movie"
        ? "Movie"
        : type === "series"
          ? "Series"
          : type === "anime"
            ? "Anime"
            : "Documentary",
    ];
  }

  let seasons: MovieOrShow["seasons"] = [];
  if (Array.isArray(item.seasons)) {
    seasons = item.seasons.map((s) => ({
      id: String(s.id),
      name: s.name,
      seasonNumber: s.season_number,
      posterUrl: getTmdbImageUrl(s.poster_path, "poster"),
      episodeCount: s.episode_count ?? 0,
      airDate: s.air_date || undefined,
      episodes: [],
    }));
  }

  let cast: string[] = [];
  if (item.credits?.cast) {
    cast = item.credits.cast.slice(0, 5).map((actor) => actor.name);
  }

  let trailerUrl = "";
  if (item.videos?.results) {
    const results = item.videos.results;
    const trailer =
      results.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official === true) ||
      results.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
      results[0];
    if (trailer?.key) trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
  }

  const backdropUrl = getTmdbImageUrl(item.backdrop_path, "backdrop");
  const backdropOriginalUrl = getTmdbImageUrl(item.backdrop_path, "backdrop", true);
  const posterUrl = getTmdbImageUrl(item.poster_path, "poster");

  return {
    id: String(item.id),
    title: item.title || item.name || "Untitled",
    type,
    description: item.overview || "No description available.",
    synopsis: item.overview || "No synopsis available.",
    backdropUrl,
    backdropOriginalUrl,
    posterUrl,
    rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 7.0,
    year,
    duration: isTV
      ? `${item.number_of_seasons || 1} Season${(item.number_of_seasons || 1) > 1 ? "s" : ""}`
      : item.runtime
        ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
        : "2h 05m",
    genres,
    cast: cast.length > 0 ? cast : ["Cast Info Unavailable"],
    trailerUrl,
    videoUrl: "",
    seasons: seasons.length > 0 ? seasons : undefined,
  };
}

/* ─── typed API ───────────────────────────────────────────────────────────── */

interface PaginatedRaw {
  page: number;
  total_pages: number;
  results: TmdbRawItem[];
}

async function getPage(endpoint: string, page: number, signal?: AbortSignal): Promise<MovieOrShow[]> {
  const env = await httpJson<ApiEnvelope<PaginatedRaw>>(endpoint, {
    query: { page, language: clientLang() },
    signal,
    timeoutMs: 20_000,
  });
  if (!env.success || !env.data) return [];
  return env.data.results.map((r) => mapTMDBToMovieOrShow(r));
}

async function getPageWithTotal(
  endpoint: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  const env = await httpJson<ApiEnvelope<PaginatedRaw>>(endpoint, {
    query: { page, language: clientLang() },
    signal,
    timeoutMs: 20_000,
  });
  if (!env.success || !env.data) return { results: [], totalPages: 1 };
  return {
    results: env.data.results.map((r) => mapTMDBToMovieOrShow(r)),
    totalPages: env.data.total_pages || 1,
  };
}

/* Trending / Popular lists */

export function getTrendingMovies(signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/movies/trending", 1, signal);
}
export function getTrendingTV(signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/tv/trending", 1, signal);
}
export function getPopularMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/movies/popular", page, signal);
}
export function getPopularTV(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/tv/popular", page, signal);
}
export function getTopRatedTV(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/tv/top-rated", page, signal);
}
export function getAnimeSeries(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/tv/anime", page, signal);
}
export function getUpcomingMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/movies/upcoming", page, signal);
}
export function getTopRatedMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/movies/top-rated", page, signal);
}

export function getAfricanMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/movies/african", page, signal);
}
export function getAfricanTV(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage("/tv/african", page, signal);
}

/* Paged variants that return totals (used by listings/genre pages). */

export function getPopularMoviesPage(page = 1, signal?: AbortSignal) {
  return getPageWithTotal("/movies/popular", page, signal);
}
export function getPopularTVPage(page = 1, signal?: AbortSignal) {
  return getPageWithTotal("/tv/popular", page, signal);
}
export function getAnimeSeriesPage(page = 1, signal?: AbortSignal) {
  return getPageWithTotal("/tv/anime", page, signal);
}
export function getMoviesByGenrePage(genreId: string, page = 1, signal?: AbortSignal) {
  return getPageWithTotal(`/movies/genre/${genreId}`, page, signal);
}
export function getTVByGenrePage(genreId: string, page = 1, signal?: AbortSignal) {
  return getPageWithTotal(`/tv/genre/${genreId}`, page, signal);
}

/* Combined "all movies" payload used by the home carousel. */

export async function getAllMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  const [popular, topRated, trending] = await Promise.all([
    getPopularMovies(page, signal),
    getTopRatedMovies(page, signal),
    getTrendingMovies(signal),
  ]);
  const seen = new Set<string>();
  return [...trending, ...popular, ...topRated].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/* Media details (single movie or series). */

export async function getMediaDetails(
  id: string,
  isTV = false,
  signal?: AbortSignal,
): Promise<MovieOrShow | null> {
  const endpoint = isTV ? `/tv/${id}` : `/movies/${id}`;
  try {
    const env = await httpJson<ApiEnvelope<TmdbRawItem>>(endpoint, {
      query: { language: clientLang() },
      signal,
      timeoutMs: 20_000,
    });
    if (env.success && env.data) {
      return mapTMDBToMovieOrShow(env.data, isTV ? "series" : "movie");
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError) return null;
    console.error("Error fetching media details:", err);
  }
  return null;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  poster_path?: string | null;
  overview?: string;
  episodes?: Array<{
    id: number;
    name: string;
    episode_number: number;
    runtime?: number;
    still_path?: string | null;
    overview?: string;
  }>;
}

export async function getSeasonDetails(
  id: string,
  seasonNumber: string,
  signal?: AbortSignal,
): Promise<SeasonDetails | null> {
  try {
    const env = await httpJson<ApiEnvelope<SeasonDetails>>(
      `/tv/${id}/season/${seasonNumber}`,
      { query: { language: clientLang() }, signal, timeoutMs: 20_000 },
    );
    if (env.success && env.data) return env.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError) return null;
    console.error("Error fetching season details:", err);
  }
  return null;
}

/* Recommendations / personalization. */

export async function getMovieRecommendations(
  id: string,
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  try {
    const env = await httpJson<ApiEnvelope<PaginatedRaw>>(
      `/movies/${id}/recommendations`,
      { query: { language: clientLang() }, signal, timeoutMs: 20_000 },
    );
    if (!env.success || !env.data) return [];
    return env.data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, 20)
      .map((r) => mapTMDBToMovieOrShow(r, r.media_type === "tv" ? "series" : "movie"));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError) return [];
    console.error("Error fetching recommendations:", err);
    return [];
  }
}

export async function getRecommendedForYou(): Promise<MovieOrShow[]> {
  try {
    const pop = await getPopularMovies(1, undefined);
    const topIds = pop.slice(0, 5).map((m) => m.id);
    const allRecs = await Promise.all(topIds.map((id) => getMovieRecommendations(id)));
    const seen = new Set<string>();
    return allRecs
      .flat()
      .filter((item) => {
        if (seen.has(item.id)) return false;
        if (topIds.includes(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

/* Search. */

export interface SearchRaw {
  tmdbResults?: PaginatedRaw;
}

export async function searchMedia(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  try {
    const env = await httpJson<ApiEnvelope<SearchRaw>>("/search", {
      query: { q: query, page, language: clientLang() },
      signal,
      timeoutMs: 15_000,
    });
    if (!env.success || !env.data?.tmdbResults?.results) return [];
    return env.data.tmdbResults.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => mapTMDBToMovieOrShow(r, r.media_type === "tv" ? "series" : "movie"));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError) return [];
    console.error("Error searching media:", err);
    return [];
  }
}

/* Stream resolution. */

export interface StreamPayload {
  embedUrl: string;
  downloadUrl?: string | null;
  provider?: string;
}

async function getStreamOnce(
  endpoint: string,
  type: "movie" | "series" | "anime",
  title: string | undefined,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<StreamPayload | null> {
  try {
    const env = await httpJson<ApiEnvelope<StreamPayload>>(endpoint, {
      query: { type, language: clientLang(), title },
      signal,
      timeoutMs,
    });
    if (env.success && env.data?.embedUrl) {
      if (env.data.provider === "torrserver") {
        console.log(
          `%c🧲 [Torrent-Module] Flux P2P (fallback) servi pour "${title ?? endpoint}"`,
          "color:#22d3ee;font-weight:bold",
        );
      }
      return env.data;
    }
    if (!env.success) {
      console.warn(`Stream unavailable for "${title ?? endpoint}": ${env.message ?? "unknown reason"}`);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.error("Error fetching stream URL:", err);
  }
  return null;
}

export async function getStreamUrl(
  id: string,
  type: "movie" | "series" | "anime" = "movie",
  season?: number,
  episode?: number,
  title?: string,
  signal?: AbortSignal,
): Promise<{ embedUrl: string; provider: string; downloadUrl?: string | null } | null> {
  const isTv = type === "series" || type === "anime";
  const endpoint = isTv
    ? `/stream/tv/${id}/${season ?? 1}/${episode ?? 1}`
    : `/stream/movie/${id}`;
  const payload = await getStreamOnce(endpoint, type, title, signal, 45_000);
  if (payload) {
    return { embedUrl: payload.embedUrl, provider: "primary", downloadUrl: payload.downloadUrl ?? null };
  }
  return null;
}

/** Secondary provider used by useStreamUrl race (Phase 5). */
export async function getNexStreamUrl(
  id: string,
  type: "movie" | "series" | "anime" = "movie",
  season?: number,
  episode?: number,
): Promise<string | null> {
  const isTv = type === "series" || type === "anime";
  const endpoint = isTv
    ? `/nexstream/tv/${id}/${season ?? 1}/${episode ?? 1}`
    : `/nexstream/movie/${id}`;
  const payload = await getStreamOnce(endpoint, type, undefined, undefined, 12_000);
  return payload?.embedUrl ?? null;
}

/* Genres. */

export async function getMovieGenres(signal?: AbortSignal): Promise<Genre[]> {
  try {
    const env = await httpJson<ApiEnvelope<Genre[]>>("/genres/movie", {
      query: { language: clientLang() },
      signal,
      timeoutMs: 15_000,
    });
    if (env.success && Array.isArray(env.data)) return env.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError) return [];
    console.error("Error fetching movie genres:", err);
  }
  return [];
}

export async function getTVGenres(signal?: AbortSignal): Promise<Genre[]> {
  try {
    const env = await httpJson<ApiEnvelope<Genre[]>>("/genres/tv", {
      query: { language: clientLang() },
      signal,
      timeoutMs: 15_000,
    });
    if (env.success && Array.isArray(env.data)) return env.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError) return [];
    console.error("Error fetching TV genres:", err);
  }
  return [];
}

/* Genres multi-page fan-out used by /media/[slug]. */

export async function getMoviesByGenre(
  genreId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  return getPage(`/movies/genre/${genreId}`, page, signal);
}

export async function getMoviesByGenreMultiPage(genreId: string, pages = 2): Promise<MovieOrShow[]> {
  const all = await Promise.all(
    Array.from({ length: pages }, (_, i) => getPageWithTotal(`/movies/genre/${genreId}`, i + 1)),
  );
  const seen = new Set<string>();
  return all
    .flatMap((p) => p.results)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export async function getByGenreMultiple(
  genres: { id: string; name: string }[],
  pages = 2,
): Promise<Record<string, MovieOrShow[]>> {
  const entries = await Promise.all(
    genres.map(async (g) => {
      const movies = await getMoviesByGenreMultiPage(g.id, pages);
      return [g.name, movies] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/* Availability (poster/dispo check used by search overlay). */

export interface AvailabilityEntry {
  disponible: boolean;
  streaming: boolean;
  download: boolean;
}

export async function getDisponible(
  tmdbId: string,
  type: "movie" | "series",
): Promise<AvailabilityEntry | null> {
  try {
    const batchType = type === "series" ? "tv" : "movie";
    const env = await httpJson<ApiEnvelope<Record<string, AvailabilityEntry>>>(
      "/availability/batch",
      { query: { type: batchType, ids: tmdbId }, timeoutMs: 8_000 },
    );
    if (env.success && env.data) {
      return env.data[tmdbId] ?? null;
    }
  } catch (err) {
    if (err instanceof HttpError) return null;
    console.error("Error fetching availability:", err);
  }
  return null;
}

/* Backend cache clear (admin-triggered by LanguageContext). */

export async function clearTmdbCache(): Promise<void> {
  try {
    await fetch(`${API_BASE_PATH}/clear-cache`, { method: "POST" });
  } catch {
    /* silent */
  }
}