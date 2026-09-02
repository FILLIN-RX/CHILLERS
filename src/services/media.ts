// Public API of the media service. All HTTP calls go through services/http.ts;
// all cached concerns are delegated to TanStack Query at the hook layer (Phase 2).
//
// Each function:
// - Accepts an AbortSignal for cancellation (propagated to the underlying fetch).
// - Throws on network/parse errors that aren't DOMException("AbortError").
//   Most callers should use react-query so they don't have to handle throws explicitly.

import { httpJson, HttpError, API_BASE_PATH } from "./http";
import type { MovieOrShow, Genre, MediaType, CastMember, Network } from "@/types/media";

/* ─── in-memory client cache (5 min TTL) ─────────────────────────────────── */
const clientCache = new Map<string, { data: any; expiry: number }>();
const CLIENT_CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = clientCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  return null;
}

function setCached<T>(key: string, data: T, ttl = CLIENT_CACHE_TTL): void {
  clientCache.set(key, { data, expiry: Date.now() + ttl });
}

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
  tagline?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  status?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  networks?: Array<{ id: number; name: string; logo_path?: string | null }>;
  created_by?: Array<{ id: number; name: string }>;
  seasons?: Array<{
    id: number;
    name: string;
    season_number: number;
    poster_path?: string | null;
    episode_count?: number;
    air_date?: string | null;
    overview?: string;
  }>;
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
    }>;
    crew?: Array<{
      id: number;
      name: string;
      job?: string;
    }>;
  };
  content_ratings?: {
    results?: Array<{ iso_3166_1: string; rating: string }>;
  };
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates?: Array<{ certification: string }>;
    }>;
  };
  videos?: { results?: Array<{ site?: string; type?: string; key?: string; official?: boolean }> };
  recommendations?: { results?: TmdbRawItem[] };
  similar?: { results?: TmdbRawItem[] };
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
    seasons = item.seasons
      .filter((s) => s.season_number > 0 || item.seasons!.length === 1)
      .map((s) => ({
        id: String(s.id),
        name: s.name,
        seasonNumber: s.season_number,
        posterUrl: getTmdbImageUrl(s.poster_path, "poster"),
        episodeCount: s.episode_count ?? 0,
        airDate: s.air_date || undefined,
        overview: s.overview,
        episodes: [],
      }));
  }

  let cast: string[] = [];
  let castDetails: CastMember[] = [];
  if (item.credits?.cast) {
    cast = item.credits.cast.slice(0, 8).map((actor) => actor.name);
    castDetails = item.credits.cast.slice(0, 15).map((actor) => ({
      id: actor.id,
      name: actor.name,
      character: actor.character || "Rôle non spécifié",
      profileUrl: actor.profile_path ? getTmdbImageUrl(actor.profile_path, "still") : "",
    }));
  }

  const directors: string[] = [];
  if (item.credits?.crew) {
    const direct = item.credits.crew.filter((c) => c.job === "Director");
    for (const d of direct.slice(0, 3)) {
      directors.push(d.name);
    }
  }

  const creators: string[] = [];
  if (item.created_by) {
    for (const c of item.created_by) {
      creators.push(c.name);
    }
  }

  const networks: Network[] = [];
  if (Array.isArray(item.networks)) {
    for (const n of item.networks) {
      if (n.name) {
        networks.push({
          id: n.id,
          name: n.name,
          logoUrl: n.logo_path ? `https://image.tmdb.org/t/p/w300${n.logo_path}` : "",
        });
      }
    }
  }

  // Statut traduit
  let statusLabel = "";
  if (item.status) {
    const s = item.status.toLowerCase();
    if (s.includes("returning")) statusLabel = "En cours";
    else if (s.includes("ended")) statusLabel = "Terminée";
    else if (s.includes("canceled") || s.includes("cancelled")) statusLabel = "Annulée";
    else if (s.includes("production")) statusLabel = "En production";
    else if (s.includes("released")) statusLabel = "Disponible";
    else statusLabel = item.status;
  }

  // Classification d'âge
  let contentRating = "";
  if (item.content_ratings?.results) {
    const fr = item.content_ratings.results.find((r) => r.iso_3166_1 === "FR");
    const us = item.content_ratings.results.find((r) => r.iso_3166_1 === "US");
    contentRating = fr?.rating || us?.rating || "";
  } else if (item.release_dates?.results) {
    const fr = item.release_dates.results.find((r) => r.iso_3166_1 === "FR");
    const us = item.release_dates.results.find((r) => r.iso_3166_1 === "US");
    contentRating =
      fr?.release_dates?.[0]?.certification || us?.release_dates?.[0]?.certification || "";
  }

  let trailerUrl = "";
  if (item.videos?.results) {
    const results = item.videos.results;
    const trailer =
      results.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official === true) ||
      results.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
      results.find((v) => v.site === "YouTube" && v.type === "Teaser") ||
      results[0];
    if (trailer?.key) trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
  }

  let similar: MovieOrShow[] = [];
  const recs = item.recommendations?.results || item.similar?.results;
  if (Array.isArray(recs)) {
    similar = recs.slice(0, 10).map((r) => mapTMDBToMovieOrShow(r, type));
  }

  const backdropUrl = getTmdbImageUrl(item.backdrop_path, "backdrop");
  const backdropOriginalUrl = getTmdbImageUrl(item.backdrop_path, "backdrop", true);
  const posterUrl = getTmdbImageUrl(item.poster_path, "poster");

  return {
    id: String(item.id),
    title: item.title || item.name || "Untitled",
    type,
    description: item.overview || "Aucune description disponible pour le moment.",
    synopsis: item.overview || "Aucun résumé disponible.",
    tagline: item.tagline || "",
    backdropUrl,
    backdropOriginalUrl,
    posterUrl,
    rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 7.0,
    voteCount: item.vote_count,
    year,
    duration: isTV
      ? `${item.number_of_seasons || seasons.length || 1} Saison${(item.number_of_seasons || seasons.length || 1) > 1 ? "s" : ""}`
      : item.runtime
        ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
        : "2h 05m",
    genres,
    cast: cast.length > 0 ? cast : ["Casting non renseigné"],
    castDetails: castDetails.length > 0 ? castDetails : undefined,
    directors: directors.length > 0 ? directors : undefined,
    creators: creators.length > 0 ? creators : undefined,
    networks: networks.length > 0 ? networks : undefined,
    status: item.status,
    statusLabel,
    contentRating: contentRating || (type === "anime" ? "12+" : "16+"),
    numberOfSeasons: item.number_of_seasons || seasons.length,
    numberOfEpisodes: item.number_of_episodes,
    trailerUrl,
    videoUrl: "",
    seasons: seasons.length > 0 ? seasons : undefined,
    similar: similar.length > 0 ? similar : undefined,
  };
}

/* ─── typed API ───────────────────────────────────────────────────────────── */

const DEFAULT_TMDB_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1ODY4ZjBmM2NmZTg1MTZmYmQ1NmE2YjNiNzJmOGYwZiIsIm5iZiI6MTc4Mzk0MDMzNi42ODMsInN1YiI6IjZhNTRjNGYwY2M4ZTIzNDZhNWI1MmUxYiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.33Zn39ASeHdHwv7jxe5-qaPhi-5uSvGqfAOPCSW8ddM";

async function fetchDirectTMDB<T>(
  tmdbPath: string,
  params: Record<string, string | number | undefined | null> = {},
  signal?: AbortSignal,
): Promise<T | null> {
  const url = new URL(`https://api.themoviedb.org/3${tmdbPath.startsWith("/") ? tmdbPath : `/${tmdbPath}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  const token =
    process.env.NEXT_PUBLIC_TMDB_TOKEN ||
    process.env.TMDB_TOKEN ||
    DEFAULT_TMDB_TOKEN;

  try {
    const res = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.warn(`[TMDB Direct Fallback] Failed for ${tmdbPath}:`, err);
    return null;
  }
}

async function fetchFallbackPage(
  endpoint: string,
  page: number,
  signal?: AbortSignal,
): Promise<PaginatedRaw | null> {
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const clean = endpoint.split("?")[0];
  const qs = new URLSearchParams(endpoint.includes("?") ? endpoint.split("?")[1] : "");
  const country = qs.get("country") || "NG|GH|CM|CI|SN";

  if (clean === "/movies/trending") {
    return fetchDirectTMDB<PaginatedRaw>("/trending/movie/week", { page, language: lang }, signal);
  }
  if (clean === "/tv/trending") {
    return fetchDirectTMDB<PaginatedRaw>("/trending/tv/week", { page, language: lang }, signal);
  }
  if (clean === "/movies/popular") {
    return fetchDirectTMDB<PaginatedRaw>("/movie/popular", { page, language: lang }, signal);
  }
  if (clean === "/tv/popular") {
    return fetchDirectTMDB<PaginatedRaw>("/tv/popular", { page, language: lang }, signal);
  }
  if (clean === "/tv/top-rated") {
    return fetchDirectTMDB<PaginatedRaw>("/tv/top_rated", { page, language: lang }, signal);
  }
  if (clean === "/movies/top-rated") {
    return fetchDirectTMDB<PaginatedRaw>("/movie/top_rated", { page, language: lang }, signal);
  }
  if (clean === "/movies/upcoming") {
    return fetchDirectTMDB<PaginatedRaw>("/movie/upcoming", { page, language: lang }, signal);
  }
  if (clean === "/tv/anime") {
    return fetchDirectTMDB<PaginatedRaw>(
      "/discover/tv",
      { with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc", page, language: lang },
      signal,
    );
  }
  if (clean === "/movies/african") {
    return fetchDirectTMDB<PaginatedRaw>(
      "/discover/movie",
      { with_origin_country: country, sort_by: "popularity.desc", page, language: lang },
      signal,
    );
  }
  if (clean === "/tv/african") {
    return fetchDirectTMDB<PaginatedRaw>(
      "/discover/tv",
      { with_origin_country: country, sort_by: "popularity.desc", page, language: lang },
      signal,
    );
  }
  const genreMovieMatch = clean.match(/^\/movies\/genre\/(\d+)$/);
  if (genreMovieMatch) {
    return fetchDirectTMDB<PaginatedRaw>(
      "/discover/movie",
      { with_genres: genreMovieMatch[1], sort_by: "popularity.desc", page, language: lang },
      signal,
    );
  }
  const genreTvMatch = clean.match(/^\/tv\/genre\/(\d+)$/);
  if (genreTvMatch) {
    return fetchDirectTMDB<PaginatedRaw>(
      "/discover/tv",
      { with_genres: genreTvMatch[1], sort_by: "popularity.desc", page, language: lang },
      signal,
    );
  }
  return null;
}

interface PaginatedRaw {
  page: number;
  total_pages: number;
  results: TmdbRawItem[];
}

async function getPage(endpoint: string, page: number, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const env = await httpJson<ApiEnvelope<PaginatedRaw>>(endpoint, {
      query: { page, language: clientLang() },
      signal,
      timeoutMs: 8_000,
    });
    if (env.success && env.data?.results) {
      return env.data.results.map((r) => mapTMDBToMovieOrShow(r));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  const fallback = await fetchFallbackPage(endpoint, page, signal);
  if (fallback?.results) {
    return fallback.results.map((r) => mapTMDBToMovieOrShow(r));
  }
  return [];
}

async function getPageWithTotal(
  endpoint: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const env = await httpJson<ApiEnvelope<PaginatedRaw>>(endpoint, {
      query: { page, language: clientLang() },
      signal,
      timeoutMs: 8_000,
    });
    if (env.success && env.data?.results) {
      return {
        results: env.data.results.map((r) => mapTMDBToMovieOrShow(r)),
        totalPages: env.data.total_pages || 1,
      };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  const fallback = await fetchFallbackPage(endpoint, page, signal);
  if (fallback?.results) {
    return {
      results: fallback.results.map((r) => mapTMDBToMovieOrShow(r)),
      totalPages: fallback.total_pages || 1,
    };
  }
  return { results: [], totalPages: 1 };
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

export const AFRICAN_COUNTRIES = [
  { code: "CM", name: "Cameroun", emoji: "🇨🇲" },
  { code: "NG", name: "Nigeria", emoji: "🇳🇬" },
  { code: "CI", name: "Côte d'Ivoire", emoji: "🇨🇮" },
  { code: "GH", name: "Ghana", emoji: "🇬🇭" },
  { code: "SN", name: "Sénégal", emoji: "🇸🇳" },
  { code: "ZA", name: "Afrique du Sud", emoji: "🇿🇦" },
];

export function getAfricanMovies(page = 1, country?: string, signal?: AbortSignal): Promise<MovieOrShow[]> {
  const url = country ? `/movies/african?country=${country}` : "/movies/african";
  return getPage(url, page, signal);
}
export function getAfricanTV(page = 1, country?: string, signal?: AbortSignal): Promise<MovieOrShow[]> {
  const url = country ? `/tv/african?country=${country}` : "/tv/african";
  return getPage(url, page, signal);
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

/* ─── Hero trailer enrichment ────────────────────────────────────────────── */

/**
 * Enrichit les slides du hero avec les bandes-annonces YouTube.
 * Les appels sont faits en parallèle via Promise.allSettled pour ne pas
 * bloquer si un appel échoue. Résultat : chaque slide reçoit un videoUrl
 * pointant vers l'embed YouTube du trailer (si disponible).
 */
export async function enrichHeroSlidesWithTrailers(
  slides: MovieOrShow[],
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  const results = await Promise.allSettled(
    slides.map((s) =>
      getMediaDetails(s.id, s.type === "series" || s.type === "anime", signal),
    ),
  );
  return slides.map((slide, i) => {
    const result = results[i];
    if (result.status === "fulfilled" && result.value?.trailerUrl) {
      return { ...slide, videoUrl: result.value.trailerUrl };
    }
    return slide;
  });
}

/* ─── catalogue endpoints (delegating to getPage/getPageWithTotal) ────────── */

/* Media details (single movie or series). */

export async function getMediaDetails(
  id: string,
  isTV = false,
  signal?: AbortSignal,
): Promise<MovieOrShow | null> {
  const cacheKey = `media_details:${isTV ? 'tv' : 'movie'}:${id}:${clientLang()}`;
  const cached = getCached<MovieOrShow>(cacheKey);
  if (cached) return cached;

  const endpoint = isTV ? `/tv/${id}` : `/movies/${id}`;
  try {
    const env = await httpJson<ApiEnvelope<TmdbRawItem>>(endpoint, {
      query: { language: clientLang() },
      signal,
      timeoutMs: 10_000,
    });
    if (env.success && env.data) {
      const mapped = mapTMDBToMovieOrShow(env.data, isTV ? "series" : "movie");
      setCached(cacheKey, mapped, 10 * 60 * 1000);
      return mapped;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError && err.status === 404) return null;
  }

  // Direct TMDB fallback
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const append = isTV
    ? "credits,videos,content_ratings,external_ids,recommendations,similar,aggregate_credits,keywords"
    : "credits,videos,release_dates,recommendations,similar,content_ratings";
  const directData = await fetchDirectTMDB<TmdbRawItem>(
    `/${isTV ? "tv" : "movie"}/${id}`,
    { append_to_response: append, language: lang },
    signal,
  );
  if (directData) {
    const mapped = mapTMDBToMovieOrShow(directData, isTV ? "series" : "movie");
    setCached(cacheKey, mapped, 10 * 60 * 1000);
    return mapped;
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
  const cacheKey = `season_details:${id}:${seasonNumber}:${clientLang()}`;
  const cached = getCached<SeasonDetails>(cacheKey);
  if (cached) return cached;

  try {
    const env = await httpJson<ApiEnvelope<SeasonDetails>>(
      `/tv/${id}/season/${seasonNumber}`,
      { query: { language: clientLang() }, signal, timeoutMs: 10_000 },
    );
    if (env.success && env.data) {
      setCached(cacheKey, env.data, 10 * 60 * 1000);
      return env.data;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof HttpError && err.status === 404) return null;
  }

  // Direct TMDB fallback
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const directData = await fetchDirectTMDB<SeasonDetails>(
    `/tv/${id}/season/${seasonNumber}`,
    { append_to_response: "credits,videos,images", language: lang },
    signal,
  );
  if (directData) {
    setCached(cacheKey, directData, 10 * 60 * 1000);
    return directData;
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
      { query: { language: clientLang() }, signal, timeoutMs: 10_000 },
    );
    if (env.success && env.data?.results) {
      return env.data.results
        .filter((r) => r.media_type === "movie" || r.media_type === "tv" || !r.media_type)
        .slice(0, 20)
        .map((r) => mapTMDBToMovieOrShow(r, r.media_type === "tv" ? "series" : "movie"));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Direct TMDB fallback
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const directData = await fetchDirectTMDB<PaginatedRaw>(
    `/movie/${id}/recommendations`,
    { language: lang },
    signal,
  );
  if (directData?.results) {
    return directData.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv" || !r.media_type)
      .slice(0, 20)
      .map((r) => mapTMDBToMovieOrShow(r, r.media_type === "tv" ? "series" : "movie"));
  }
  return [];
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
      timeoutMs: 10_000,
    });
    if (env.success && env.data?.tmdbResults?.results) {
      return env.data.tmdbResults.results
        .filter((r) => r.media_type === "movie" || r.media_type === "tv" || !r.media_type)
        .map((r) => mapTMDBToMovieOrShow(r, r.media_type === "tv" ? "series" : "movie"));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Direct TMDB fallback
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const directData = await fetchDirectTMDB<PaginatedRaw>(
    "/search/multi",
    { query, page, language: lang },
    signal,
  );
  if (directData?.results) {
    return directData.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv" || !r.media_type)
      .map((r) => mapTMDBToMovieOrShow(r, r.media_type === "tv" ? "series" : "movie"));
  }
  return [];
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
  title?: string,
): Promise<string | null> {
  const isTv = type === "series" || type === "anime";
  const endpoint = isTv
    ? `/nexstream/tv/${id}/${season ?? 1}/${episode ?? 1}`
    : `/nexstream/movie/${id}`;
  const payload = await getStreamOnce(endpoint, type, title, undefined, 12_000);
  return payload?.embedUrl ?? null;
}

/* Genres. */

export async function getMovieGenres(signal?: AbortSignal): Promise<Genre[]> {
  try {
    const env = await httpJson<ApiEnvelope<Genre[]>>("/genres/movie", {
      query: { language: clientLang() },
      signal,
      timeoutMs: 10_000,
    });
    if (env.success && Array.isArray(env.data)) return env.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Direct TMDB fallback
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const directData = await fetchDirectTMDB<{ genres: Genre[] }>(
    "/genre/movie/list",
    { language: lang },
    signal,
  );
  return directData?.genres || [];
}

export async function getTVGenres(signal?: AbortSignal): Promise<Genre[]> {
  try {
    const env = await httpJson<ApiEnvelope<Genre[]>>("/genres/tv", {
      query: { language: clientLang() },
      signal,
      timeoutMs: 10_000,
    });
    if (env.success && Array.isArray(env.data)) return env.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Direct TMDB fallback
  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  const directData = await fetchDirectTMDB<{ genres: Genre[] }>(
    "/genre/tv/list",
    { language: lang },
    signal,
  );
  return directData?.genres || [];
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
  langueAudio?: string;
  isFrenchAudio?: boolean;
}

export async function getDisponible(
  tmdbId: string,
  type: "movie" | "series",
): Promise<AvailabilityEntry | null> {
  const cacheKey = `dispo:${type}:${tmdbId}`;
  const cached = getCached<AvailabilityEntry>(cacheKey);
  if (cached) return cached;

  try {
    const batchType = type === "series" ? "tv" : "movie";
    const env = await httpJson<ApiEnvelope<Record<string, AvailabilityEntry>>>(
      "/availability/batch",
      { query: { type: batchType, ids: tmdbId }, timeoutMs: 8_000 },
    );
    if (env.success && env.data) {
      const entry = env.data[tmdbId] ?? null;
      if (entry) setCached(cacheKey, entry, 5 * 60 * 1000);
      return entry;
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