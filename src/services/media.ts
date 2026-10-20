// Public API of the media service. All HTTP calls go through services/http.ts;
// all cached concerns are delegated to TanStack Query at the hook layer (Phase 2).
//
// Each function:
// - Accepts an AbortSignal for cancellation (propagated to the underlying fetch).
// - Throws on network/parse errors that aren't DOMException("AbortError").
//   Most callers should use react-query so they don't have to handle throws explicitly.

import { cache } from "react";
import { httpJson, HttpError, API_BASE_PATH } from "./http";
import { getAntiBotHeaders } from "@/lib/antibot";
import type { MovieOrShow, Genre, MediaType, CastMember, Network, PersonDetails } from "@/types/media";

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

export function isUltraLowBandwidth(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn) return false;
  return Boolean(conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g");
}

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
  size: "original" | "w1280" | "w780" | "w500" | "w300" = "w500"
): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
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
  popularity?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  origin_country?: string[];
  original_language?: string;
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

/** Entrée de `combined_credits` : rôle joué ou poste technique. */
export type PersonCredit = TmdbRawItem & {
  media_type?: string;
  popularity?: number;
  character?: string;
  job?: string;
  department?: string;
};

/** Raw shape of TMDB /person/{id} (append_to_response=combined_credits). */
export interface TmdbPersonRaw {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  known_for_department?: string;
  also_known_as?: string[];
  gender?: number;
  popularity?: number;
  combined_credits?: {
    cast?: PersonCredit[];
    crew?: PersonCredit[];
  };
  movie_credits?: {
    cast?: PersonCredit[];
  };
  tv_credits?: {
    cast?: PersonCredit[];
  };
}

function computeAge(birthday?: string | null, deathday?: string | null): number | null {
  if (!birthday) return null;
  const start = new Date(birthday);
  if (Number.isNaN(start.getTime())) return null;
  const end = deathday ? new Date(deathday) : new Date();
  if (Number.isNaN(end.getTime())) return null;
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Mappe TMDB /person/{id} (+ combined_credits) vers PersonDetails. */
export function mapTMDBToPersonDetails(raw: TmdbPersonRaw): PersonDetails {
  const combined = raw.combined_credits;
  const cast: PersonCredit[] = combined?.cast ?? [
    ...(raw.movie_credits?.cast ?? []),
    ...(raw.tv_credits?.cast ?? []),
  ];
  const crew: PersonCredit[] = combined?.crew ?? [];

  // Une page « Réalisation / Production » ne joue presque jamais devant la
  // caméra : sans les crédits crew, sa filmographie serait vide.
  const played = new Set(cast.map((c) => String(c.id)));
  const credits = [...cast, ...crew.filter((c) => !played.has(String(c.id)))];

  const toList = (mediaType: "movie" | "tv") => {
    const seen = new Set<string>();
    return credits
      .filter((c) => (c.media_type ?? (c.title ? "movie" : "tv")) === mediaType)
      .map((c) => ({
        item: mapTMDBToMovieOrShow(c, mediaType === "tv" ? "series" : "movie"),
        popularity: c.popularity ?? 0,
      }))
      .filter(({ item }) => {
        if (!item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => b.popularity - a.popularity)
      .map(({ item }) => item);
  };

  const movies = toList("movie");
  const tvShows = toList("tv");

  const creditsCount = cast.length + crew.length;

  return {
    id: String(raw.id),
    name: raw.name || "Inconnu",
    biography: raw.biography || "",
    birthday: raw.birthday || null,
    deathday: raw.deathday || null,
    placeOfBirth: raw.place_of_birth || null,
    profileUrl: raw.profile_path ? getTmdbImageUrl(raw.profile_path) : "",
    knownForDepartment: raw.known_for_department || "",
    alsoKnownAs: raw.also_known_as || [],
    gender: raw.gender ?? 0,
    age: computeAge(raw.birthday, raw.deathday),
    movies,
    tvShows,
    creditsCount,
  };
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
  // « anime » qualifie la série animée. Un film d'animation qui recevrait cette
  // étiquette est demandé comme /stream/tv/{id}/1/1 par les liens de lecture :
  // les providers cherchent alors une saison qui n'existe pas.
  // Fallback : si le backend proxy filtre genre_ids, on détecte l'anime via le
  // pays / la langue d'origine japonaise sur un contenu TV (évite qu'un animé
  // soit classé en simple « série »).
  const isJapaneseOrigin =
    (item.origin_country?.includes("JP") ?? false) || item.original_language === "ja";
  if (isTV && (genreIds.includes(16) || (isJapaneseOrigin && genreIds.length === 0))) {
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
        posterUrl: getTmdbImageUrl(s.poster_path),
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
      profileUrl: actor.profile_path ? getTmdbImageUrl(actor.profile_path) : "",
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
          logoUrl: n.logo_path ? `https://image.tmdb.org/t/p/original${n.logo_path}` : "",
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
  // TMDB renvoie souvent recommendations: {results: []} — un tableau vide est truthy,
  // il faut bien choisir le premier pool NON vide (similar est plus généreux en long tail).
  const recs = [item.recommendations?.results, item.similar?.results].find(
    (pool) => Array.isArray(pool) && pool.length > 0,
  );
  if (recs) {
    similar = recs.slice(0, 10).map((r) => mapTMDBToMovieOrShow(r, type));
  }

  const backdropUrl = getTmdbImageUrl(item.backdrop_path, "w1280");
  const backdropOriginalUrl = getTmdbImageUrl(item.backdrop_path, "original");
  const posterUrl = getTmdbImageUrl(item.poster_path, "w500");

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
    releaseDate: releaseDate || undefined,
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

  const debut = Date.now();
  let dernierEchec: unknown = null;
  // Deux essais : cet hôte tombe régulièrement en ETIMEDOUT sur
  // api.themoviedb.org, et sans reprise la fiche — titre, canonical et JSON-LD
  // côté /person compris — disparaît du HTML servi.
  for (let tentative = 0; tentative < 2; tentative++) {
    try {
      const res = await fetch(url.toString(), {
        signal,
        next: { revalidate: 3600 },
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) return (await res.json()) as T;
      // 404 = la ressource n'existe pas : la retester ne sert à rien.
      if (res.status !== 404 && res.status < 500 && res.status !== 429) return null;
      dernierEchec = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        throw err;
      }
      dernierEchec = err;
    }
    if (tentative === 0) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  console.warn(`[TMDB Direct Fallback] Failed for ${tmdbPath} (${Date.now() - debut} ms):`, dernierEchec);
  return null;
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
export async function getUpcomingMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const list = await getPage("/movies/upcoming", page, signal);
    const future = list.filter((m) => Boolean(m.releaseDate && m.releaseDate >= today));
    if (future.length > 0) return future;
  } catch {}

  try {
    const direct = await fetchDirectTMDB<{ results: TmdbRawItem[] }>("/discover/movie", {
      page,
      "primary_release_date.gte": today,
      sort_by: "popularity.desc",
      include_adult: "false",
    }, signal);
    if (direct?.results) {
      return direct.results
        .map((r) => mapTMDBToMovieOrShow(r))
        .filter((m) => Boolean(m.releaseDate && m.releaseDate >= today));
    }
  } catch {}

  return [];
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

export function getPopularMoviesPage(page = 1, signal?: AbortSignal) {
  return getPageWithTotal("/movies/popular", page, signal);
}
export function getPopularTVPage(page = 1, signal?: AbortSignal) {
  return getPageWithTotal("/tv/popular", page, signal);
}

export async function getAllTimeFavorites(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const [tvRes, mRes, tvdRes] = await Promise.all([
      fetchDirectTMDB<{ results: TmdbRawItem[] }>("/discover/tv", {
        page,
        sort_by: "vote_count.desc",
      }, signal),
      fetchDirectTMDB<{ results: TmdbRawItem[] }>("/discover/movie", {
        page,
        sort_by: "vote_count.desc",
      }, signal),
      fetchDirectTMDB<{ results: TmdbRawItem[] }>("/search/tv", {
        query: "The Vampire Diaries",
      }, signal),
    ]);
    const tv = (tvRes?.results || []).map((r) => mapTMDBToMovieOrShow(r, "series"));
    const movies = (mRes?.results || []).map((r) => mapTMDBToMovieOrShow(r, "movie"));
    const tvd = tvdRes?.results?.[0] ? mapTMDBToMovieOrShow(tvdRes.results[0], "series") : null;

    const list: MovieOrShow[] = [];
    if (tvd) list.push(tvd);
    const maxLen = Math.max(tv.length, movies.length);
    for (let i = 0; i < maxLen; i++) {
      if (tv[i] && tv[i].id !== tvd?.id) list.push(tv[i]);
      if (movies[i]) list.push(movies[i]);
    }
    return list;
  } catch (err) {
    console.error("Error in getAllTimeFavorites:", err);
    return [];
  }
}

export async function getBoxOfficeMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const direct = await fetchDirectTMDB<{ results: TmdbRawItem[] }>("/discover/movie", {
      page,
      sort_by: "revenue.desc",
      "primary_release_date.gte": "2022-01-01",
      "vote_count.gte": 50,
      include_adult: "false",
    }, signal);
    if (direct?.results) return direct.results.filter((r) => Boolean(r.poster_path)).map((r) => mapTMDBToMovieOrShow(r, "movie"));
  } catch (err) {
    console.error("Error in getBoxOfficeMovies:", err);
  }
  return [];
}

export async function getNewAnime(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [popRes, newestRes] = await Promise.all([
      fetchDirectTMDB<{ results: TmdbRawItem[] }>(
        "/discover/tv",
        {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "popularity.desc",
          "first_air_date.gte": "2023-01-01",
          page,
        },
        signal
      ),
      fetchDirectTMDB<{ results: TmdbRawItem[] }>(
        "/discover/tv",
        {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "first_air_date.desc",
          "first_air_date.lte": today,
          "vote_count.gte": 5,
          page,
        },
        signal
      ),
    ]);

    const seen = new Set<number>();
    const list: MovieOrShow[] = [];
    for (const raw of [...(popRes?.results || []), ...(newestRes?.results || [])]) {
      if (raw.poster_path && !seen.has(raw.id)) {
        seen.add(raw.id);
        list.push(mapTMDBToMovieOrShow(raw, "anime"));
      }
    }
    return list;
  } catch (err) {
    console.error("Error in getNewAnime:", err);
    return [];
  }
}

export async function getMartialArtsMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const franchises = [
      "Ip Man",
      "The Karate Kid",
      "The Raid",
      "Kung Fu Hustle",
      "Enter the Dragon",
      "Ong-Bak",
      "Fearless",
      "Drunken Master",
      "Bloodsport",
      "Kill Bill: Vol. 1",
      "Cobra Kai",
      "Ninja Assassin",
    ];
    const [searches, disc] = await Promise.all([
      Promise.all(
        franchises.map((f) =>
          fetchDirectTMDB<{ results: TmdbRawItem[] }>("/search/multi", { query: f }, signal)
        )
      ),
      fetchDirectTMDB<{ results: TmdbRawItem[] }>(
        "/discover/movie",
        {
          with_genres: "28",
          with_keywords: "9715|780",
          without_genres: "878,14,16",
          without_keywords: "9717|180730",
          sort_by: "popularity.desc",
          page,
        },
        signal
      ),
    ]);

    const curated: MovieOrShow[] = searches
      .map((s) => s?.results?.[0])
      .filter((item): item is TmdbRawItem => Boolean(item && item.poster_path))
      .map((r) => mapTMDBToMovieOrShow(r, "movie"));

    const curatedIds = new Set(curated.map((c) => c.id));
    const discovered: MovieOrShow[] = (disc?.results || [])
      .filter((r) => r.poster_path && !curatedIds.has(String(r.id)))
      .map((r) => mapTMDBToMovieOrShow(r, "movie"));

    return [...curated, ...discovered];
  } catch (err) {
    console.error("Error in getMartialArtsMovies:", err);
    return [];
  }
}

export async function getBarbieMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const direct = await fetchDirectTMDB<{ results: TmdbRawItem[] }>(
      "/search/movie",
      {
        page,
        query: "barbie",
      },
      signal
    );
    if (direct?.results) {
      return direct.results
        .filter((r) => Boolean(r.poster_path))
        .map((r) => mapTMDBToMovieOrShow(r, "movie"));
    }
  } catch (err) {
    console.error("Error in getBarbieMovies:", err);
  }
  return [];
}

export async function getRealityShows(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const [votedRes, popRes] = await Promise.all([
      fetchDirectTMDB<{ results: TmdbRawItem[] }>(
        "/discover/tv",
        {
          with_genres: "10764",
          sort_by: "vote_count.desc",
          page,
        },
        signal
      ),
      fetchDirectTMDB<{ results: TmdbRawItem[] }>(
        "/discover/tv",
        {
          with_genres: "10764",
          sort_by: "popularity.desc",
          "vote_count.gte": 30,
          page,
        },
        signal
      ),
    ]);

    const seen = new Set<number>();
    const list: MovieOrShow[] = [];
    for (const raw of [...(votedRes?.results || []), ...(popRes?.results || [])]) {
      if (raw.poster_path && !seen.has(raw.id)) {
        seen.add(raw.id);
        list.push(mapTMDBToMovieOrShow(raw, "series"));
      }
    }
    return list;
  } catch (err) {
    console.error("Error in getRealityShows:", err);
    return [];
  }
}

export async function getMadeInChina(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  try {
    const direct = await fetchDirectTMDB<{ results: TmdbRawItem[] }>("/discover/tv", {
      page,
      with_original_language: "zh",
      sort_by: "popularity.desc",
      "vote_count.gte": 5,
    }, signal);
    if (direct?.results) {
      return direct.results
        .filter((r) => Boolean(r.poster_path))
        .map((r) => mapTMDBToMovieOrShow(r, "series"));
    }
  } catch (err) {
    console.error("Error in getMadeInChina:", err);
  }
  return [];
}

export type DiscoverSort = "trending" | "rating" | "recent" | "oldest";

/** Catalogue filtrable (année, genre, tri) — tendance par défaut. */
export async function discoverMediaPage(
  type: "movies" | "series" | "anime",
  opts: { genreId?: string | null; year?: string | null; sort?: DiscoverSort; page?: number } = {},
  signal?: AbortSignal,
): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  const endpoint = type === "movies" ? "/movies/discover" : "/tv/discover";
  const page = Math.max(1, opts.page ?? 1);
  const sort = opts.sort || "trending";
  try {
    const env = await httpJson<ApiEnvelope<PaginatedRaw>>(endpoint, {
      query: {
        page,
        language: clientLang(),
        genre: opts.genreId || undefined,
        year: opts.year || undefined,
        sort,
        ...(type === "anime" ? { anime: 1 } : {}),
      },
      signal,
      timeoutMs: 12_000,
    });
    if (env.success && env.data?.results?.length) {
      return {
        results: env.data.results.map((r) =>
          mapTMDBToMovieOrShow(r, type === "movies" ? "movie" : undefined),
        ),
        totalPages: env.data.total_pages || 1,
      };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Production backend can be temporarily unavailable (or return an empty
  // catalog). Keep Films/Séries usable by falling back directly to TMDB.
  const language = clientLang() === "fr" ? "fr-FR" : "en-US";
  const movieSort: Record<DiscoverSort, string> = {
    trending: "popularity.desc",
    rating: "vote_average.desc",
    recent: "primary_release_date.desc",
    oldest: "primary_release_date.asc",
  };
  const tvSort: Record<DiscoverSort, string> = {
    trending: "popularity.desc",
    rating: "vote_average.desc",
    recent: "first_air_date.desc",
    oldest: "first_air_date.asc",
  };

  if (type === "anime") {
    const genres = opts.genreId ? `${opts.genreId},16` : "16";
    const common: Record<string, string | number | null | undefined> = {
      page,
      language,
      with_genres: genres,
      with_original_language: "ja",
      include_adult: "false",
    };
    const movieParams: Record<string, string | number | null | undefined> = {
      ...common,
      sort_by: movieSort[sort],
    };
    const tvParams: Record<string, string | number | null | undefined> = {
      ...common,
      sort_by: tvSort[sort],
    };
    if (opts.year) movieParams["primary_release_year"] = opts.year;
    if (sort === "rating") {
      movieParams["vote_count.gte"] = 100;
      tvParams["vote_count.gte"] = 100;
    }
    const [tvData, movieData] = await Promise.all([
      fetchDirectTMDB<PaginatedRaw>("/discover/tv", tvParams, signal),
      fetchDirectTMDB<PaginatedRaw>("/discover/movie", movieParams, signal),
    ]);
    const results = [
      ...(tvData?.results ?? []).map((raw) => ({ raw, item: mapTMDBToMovieOrShow(raw, "series") })),
      ...(movieData?.results ?? []).map((raw) => ({ raw, item: mapTMDBToMovieOrShow(raw, "movie") })),
    ]
      .sort((a, b) => (b.raw.popularity ?? 0) - (a.raw.popularity ?? 0))
      .slice(0, 20)
      .map(({ item }) => item);
    return { results, totalPages: Math.max(tvData?.total_pages ?? 1, movieData?.total_pages ?? 1) };
  }

  const isMovie = type === "movies";
  const useTrending = sort === "trending" && !opts.genreId && !opts.year;
  const directPath = useTrending
    ? `/trending/${isMovie ? "movie" : "tv"}/week`
    : `/discover/${isMovie ? "movie" : "tv"}`;
  const params: Record<string, string | number | null | undefined> = {
    page,
    language,
    ...(useTrending ? {} : { sort_by: isMovie ? movieSort[sort] : tvSort[sort], include_adult: "false" }),
    ...(opts.genreId ? { with_genres: opts.genreId } : {}),
    ...(opts.year ? { [isMovie ? "primary_release_year" : "first_air_date_year"]: opts.year } : {}),
    ...(sort === "rating" ? { "vote_count.gte": isMovie ? 200 : 100 } : {}),
  };
  const directData = await fetchDirectTMDB<PaginatedRaw>(directPath, params, signal);
  if (directData?.results?.length) {
    return {
      results: directData.results.map((raw) => mapTMDBToMovieOrShow(raw, isMovie ? "movie" : "series")),
      totalPages: directData.total_pages || 1,
    };
  }
  return { results: [], totalPages: 1 };
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
export function getAnimeByGenre(genreId: string, page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  return getPage(`/tv/anime/genre/${genreId}`, page, signal);
}

/* Combined "all movies" payload used by the home carousel. */

/** Compute composite smart score for a movie (same formula as backend). */
function computeSmartScore(item: MovieOrShow): number {
  const rating = item.rating || 0;
  const voteCount = item.voteCount || 0;
  const releaseYear = item.year || 2020;
  const yearRecency = Math.min(1, Math.max(0, (2026 - releaseYear) / 2));
  return (
    (rating / 10) * 0.4 +
    (Math.log10(voteCount + 1) / 3) * 0.3 +
    yearRecency * 0.3
  );
}

export async function getAllMovies(page = 1, signal?: AbortSignal): Promise<MovieOrShow[]> {
  // 1. Try backend smart endpoint first
  try {
    const env = await httpJson<ApiEnvelope<{ results: TmdbRawItem[] }>>('/movies/discover-smart', {
      query: { page, language: clientLang() },
      signal,
      timeoutMs: 8_000,
    });
    if (env.success && env.data?.results && env.data.results.length > 0) {
      return env.data.results.map((r) => mapTMDBToMovieOrShow(r, 'movie'));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // fall through to local scoring
  }

  // 2. Fallback: combine sources and apply smart scoring locally
  const [popular, topRated, trending] = await Promise.all([
    getPopularMovies(page, signal),
    getTopRatedMovies(page, signal),
    getTrendingMovies(signal),
  ]);

  const seen = new Set<string>();
  const combined: MovieOrShow[] = [];
  for (const item of [...trending, ...popular, ...topRated]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      combined.push(item);
    }
  }

  // Sort by composite smart score
  return combined.sort((a, b) => computeSmartScore(b) - computeSmartScore(a));
}

/** Variante paginée de getAllMovies qui expose aussi le nombre total de pages,
 *  indispensable pour que le scroll infini des pages Films continue à charger. */
export async function getAllMoviesPage(
  page = 1,
  signal?: AbortSignal,
): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const env = await httpJson<ApiEnvelope<{ results: TmdbRawItem[]; total_pages?: number }>>(
      "/movies/discover-smart",
      { query: { page, language: clientLang() }, signal, timeoutMs: 8_000 },
    );
    if (env.success && env.data?.results && env.data.results.length > 0) {
      return {
        results: env.data.results.map((r) => mapTMDBToMovieOrShow(r, "movie")),
        totalPages: env.data.total_pages || 1,
      };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Fallback local : merge de Popular + TopRated + Trending (pas de total fiable,
  // on garde une borne haute TMDB pour que le scroll continue).
  const [popular, topRated, trending] = await Promise.all([
    getPopularMovies(page, signal),
    getTopRatedMovies(page, signal),
    getTrendingMovies(signal),
  ]);
  const seen = new Set<string>();
  const combined: MovieOrShow[] = [];
  for (const item of [...trending, ...popular, ...topRated]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      combined.push(item);
    }
  }
  return {
    results: combined.sort((a, b) => computeSmartScore(b) - computeSmartScore(a)),
    totalPages: 500,
  };
}

/* ─── Hero trailer enrichment ────────────────────────────────────────────── */

/**
 * Récupère l'URL d'embed YouTube du trailer pour un film ou une série à la demande.
 * Mise en cache 30 minutes pour une fluidité instantanée.
 */
export async function getMediaTrailerUrl(
  id: string,
  isTV = false,
  signal?: AbortSignal,
): Promise<string | null> {
  const cacheKey = `media_trailer:${isTV ? "tv" : "movie"}:${id}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const endpoint = isTV ? `/tv/${id}/trailer` : `/movies/${id}/trailer`;
  try {
    const env = await httpJson<ApiEnvelope<{ key?: string; site?: string }>>(endpoint, {
      query: { language: clientLang() },
      signal,
      timeoutMs: 6_000,
    });
    if (env.success && env.data?.key) {
      const url = `https://www.youtube.com/embed/${env.data.key}`;
      setCached(cacheKey, url, 30 * 60 * 1000);
      return url;
    }
  } catch {}
  return null;
}

/**
 * Récupère le logo officiel TMDb (PNG transparent) pour un film ou une série.
 * Utilisé pour les hero banners style Netflix/Disney+.
 * Mise en cache 30 minutes.
 */
export async function getMediaLogo(
  id: string,
  isTV = false,
  signal?: AbortSignal,
): Promise<string | null> {
  const cacheKey = `media_logo:${isTV ? "tv" : "movie"}:${id}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    // Appel direct à TMDb pour récupérer les images avec logos
    const data = await fetchDirectTMDB<{ logos?: Array<{ file_path: string; vote_average: number; iso_639_1: string | null }> }>(
      `/${isTV ? "tv" : "movie"}/${id}/images`,
      { include_image_language: "en,null" },
      signal,
    );

    if (data?.logos && data.logos.length > 0) {
      // Trier par vote_average pour obtenir le meilleur logo
      const sortedLogos = [...data.logos].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      const bestLogo = sortedLogos[0];
      
      if (bestLogo?.file_path) {
        const logoUrl = getTmdbImageUrl(bestLogo.file_path);
        setCached(cacheKey, logoUrl, 30 * 60 * 1000);
        return logoUrl;
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.warn(`[getMediaLogo] Failed to fetch logo for ${isTV ? "tv" : "movie"} ${id}:`, err);
  }

  return null;
}

export async function enrichHeroSlidesWithTrailers(
  slides: MovieOrShow[],
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  const results = await Promise.allSettled(
    slides.map((s) =>
      getMediaTrailerUrl(s.id, s.type === "series" || s.type === "anime", signal),
    ),
  );
  return slides.map((slide, i) => {
    const result = results[i];
    if (result.status === "fulfilled" && result.value) {
      return { ...slide, videoUrl: result.value };
    }
    return slide;
  });
}

/* ─── catalogue endpoints (delegating to getPage/getPageWithTotal) ────────── */

/* Media details (single movie or series). */

export const getMediaDetails = cache(async function getMediaDetails(
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
});

/* Person details (actor / director / ...). Uses TMDB combined_credits
   (films ET séries en un seul appel), comme demandé pour la page /person. */

export const getPersonDetails = cache(async function getPersonDetails(
  id: string,
  signal?: AbortSignal,
): Promise<PersonDetails | null> {
  const cacheKey = `person_details:${id}:${clientLang()}`;
  const cached = getCached<PersonDetails>(cacheKey);
  if (cached) return cached;

  const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
  // combined_credits regroupe movie_credits + tv_credits en une seule réponse.
  const directData = await fetchDirectTMDB<TmdbPersonRaw>(
    `/person/${id}`,
    { append_to_response: "combined_credits,images", language: lang },
    signal,
  );
  if (directData && directData.id) {
    const mapped = mapTMDBToPersonDetails(directData);
    setCached(cacheKey, mapped, 10 * 60 * 1000);
    return mapped;
  }

  return null;
});

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
    air_date?: string | null;
  }>;
}

export const getSeasonDetails = cache(async function getSeasonDetails(
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
});

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

export async function getTVRecommendations(
  id: string,
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  try {
    // Direct TMDB API pour les séries similaires
    const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
    const directData = await fetchDirectTMDB<PaginatedRaw>(
      `/tv/${id}/recommendations`,
      { language: lang },
      signal,
    );
    if (directData?.results) {
      return directData.results
        .filter((r) => r.media_type === "tv" || !r.media_type)
        .slice(0, 20)
        .map((r) => mapTMDBToMovieOrShow(r, "series"));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }

  // Fallback: essayer les séries similaires
  try {
    const lang = clientLang() === "fr" ? "fr-FR" : "en-US";
    const similarData = await fetchDirectTMDB<PaginatedRaw>(
      `/tv/${id}/similar`,
      { language: lang },
      signal,
    );
    if (similarData?.results) {
      return similarData.results
        .slice(0, 20)
        .map((r) => mapTMDBToMovieOrShow(r, "series"));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }
  
  return [];
}

/**
 * Chaîne « titres similaires » pour une fiche : similar/recommandations TMDB du
 * titre courant, puis popular en dernier recours. Sans ancrage sur `id`, la
 * populaire est identique pour toutes les fiches — c'était le bug rapporté.
 */
export async function getSimilarTitles(
  id: string,
  isTV: boolean,
  detail?: MovieOrShow | null,
  signal?: AbortSignal,
): Promise<MovieOrShow[]> {
  const seen = new Set<string>([String(id)]);
  const pick = (list: MovieOrShow[], limit: number) => {
    const out: MovieOrShow[] = [];
    for (const m of list) {
      const key = String(m.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
      if (out.length >= limit) break;
    }
    return out;
  };

  if (detail?.similar?.length) return pick(detail.similar, 14);

  const recs = await (isTV ? getTVRecommendations(id, signal) : getMovieRecommendations(id, signal)).catch(
    () => [] as MovieOrShow[],
  );
  if (recs.length > 0) return pick(recs, 14);

  const popular = await (isTV ? getPopularTV(1, signal) : getPopularMovies(1, signal)).catch(
    () => [] as MovieOrShow[],
  );
  return pick(popular, 10);
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
  directUrl?: string | null;
  directType?: "mp4" | "hls" | null;
  referer?: string | null;
  provider?: string;
  unreleased?: boolean;
  releaseDate?: string | null;
  message?: string | null;
}

async function getStreamOnce(
  endpoint: string,
  type: "movie" | "series" | "anime",
  title: string | undefined,
  signal?: AbortSignal,
  timeoutMs?: number,
  originalTitle?: string,
  releaseDate?: string,
  year?: number,
  language?: string,
): Promise<StreamPayload | null> {
  try {
    const env = await httpJson<ApiEnvelope<StreamPayload> & { unreleased?: boolean; releaseDate?: string }>(endpoint, {
      query: {
        type,
        language: language || clientLang(),
        title,
        originalTitle,
        releaseDate,
        year,
      },
      signal,
      timeoutMs,
    });
    if (env.unreleased) {
      return {
        embedUrl: "",
        provider: "unreleased",
        unreleased: true,
        releaseDate: env.releaseDate || releaseDate,
        message: env.message,
      };
    }
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
  } catch (err: any) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err.name === "HttpError" && err.status === 403 && err.body && err.body.includes("PREMIUM_REQUIRED")) {
      throw err; // Laisse remonter le 403 au hook pour déclencher la modale
    }
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
  originalTitle?: string,
  releaseDate?: string,
  year?: number,
  language?: string,
): Promise<{ embedUrl: string; provider: string; downloadUrl?: string | null; directType?: "mp4" | "hls" | null; directUrl?: string | null; referer?: string | null; unreleased?: boolean; releaseDate?: string | null } | null> {
  const isTv = type === "series" || type === "anime";
  const endpoint = isTv
    ? `/stream/tv/${id}/${season ?? 1}/${episode ?? 1}`
    : `/stream/movie/${id}`;
  const payload = await getStreamOnce(endpoint, type, title, signal, 45_000, originalTitle, releaseDate, year, language);
  if (payload) {
    return {
      embedUrl: payload.embedUrl,
      provider: payload.unreleased ? "unreleased" : "primary",
      downloadUrl: payload.downloadUrl ?? null,
      directType: payload.directType ?? null,
      directUrl: payload.directUrl ?? null,
      referer: payload.referer ?? null,
      unreleased: payload.unreleased,
      releaseDate: payload.releaseDate,
    };
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
  const payload = await getNexStreamResolution(id, type, season, episode, title);
  return payload?.embedUrl ?? null;
}

/**
 * Variante complète du secondaire : conserve directUrl / directType / referer
 * pour que le lecteur joue le HLS/MP4 au lieu de retomber sur l'embed.
 */
export async function getNexStreamResolution(
  id: string,
  type: "movie" | "series" | "anime" = "movie",
  season?: number,
  episode?: number,
  title?: string,
): Promise<StreamPayload | null> {
  const isTv = type === "series" || type === "anime";
  const endpoint = isTv
    ? `/nexstream/tv/${id}/${season ?? 1}/${episode ?? 1}`
    : `/nexstream/movie/${id}`;
  return await getStreamOnce(endpoint, type, title, undefined, 12_000);
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
  title?: string,
): Promise<AvailabilityEntry | null> {
  const cacheKey = `dispo:${type}:${tmdbId}:${title || ""}`;
  const cached = getCached<AvailabilityEntry>(cacheKey);
  if (cached) return cached;

  try {
    const batchType = type === "series" ? "tv" : "movie";
    const env = await httpJson<ApiEnvelope<Record<string, AvailabilityEntry>>>(
      "/availability/batch",
      { query: { type: batchType, ids: tmdbId, title }, timeoutMs: 8_000 },
    );
    if (env.success && env.data) {
      const entry = env.data[tmdbId] ?? Object.values(env.data)[0] ?? null;
      if (entry) setCached(cacheKey, entry, 2 * 60 * 1000);
      return entry;
    }
  } catch (err: any) {
    if (err?.name === "AbortError" || err instanceof HttpError) return null;
    console.error("Error fetching availability:", err);
  }
  return null;
}

/* Backend cache clear (admin-triggered by LanguageContext). */

export async function clearTmdbCache(): Promise<void> {
  try {
    await fetch(`${API_BASE_PATH}/clear-cache`, {
      method: "POST",
      headers: getAntiBotHeaders(),
    });
  } catch {
    /* silent */
  }
}
