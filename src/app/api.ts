import { MovieOrShow } from "./mockData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const FETCH_TIMEOUT = 45000;

function getLang(): string {
  if (typeof window === 'undefined') return 'fr';
  try {
    return localStorage.getItem('chillers-lang') || 'fr';
  } catch {
    return 'fr';
  }
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const GENRE_MAP: { [key: number]: string } = {
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

export function mapTMDBToMovieOrShow(
  item: any,
  typeOverride?: "movie" | "series" | "anime" | "documentary"
): MovieOrShow {
  const isTV = item.media_type === "tv" || item.first_air_date !== undefined || item.name !== undefined || item.first_season_episodes !== undefined;
  
  // Decide media type (If animation genre is present, categorize under anime, etc.)
  let type: "movie" | "series" | "anime" | "documentary" = typeOverride || (isTV ? "series" : "movie");
  
  const genreIds = item.genre_ids || [];
  if (genreIds.includes(16)) {
    type = "anime";
  } else if (genreIds.includes(99)) {
    type = "documentary";
  }

  // Get year
  const releaseDate = item.release_date || item.first_air_date || "";
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 2026;

  // Map genres
  let genres: string[] = [];
  if (item.genre_ids && Array.isArray(item.genre_ids)) {
    genres = item.genre_ids.map((id: number) => GENRE_MAP[id] || "").filter(Boolean);
  } else if (item.genres && Array.isArray(item.genres)) {
    genres = item.genres.map((g: any) => g.name || "");
  }

  if (genres.length === 0) {
    genres = [type === "movie" ? "Movie" : type === "series" ? "Series" : type === "anime" ? "Anime" : "Documentary"];
  }

  // Map Seasons — use episode_count from TMDB directly (episodes list fetched separately per season)
  let seasons: MovieOrShow['seasons'] = [];
  if (item.seasons && Array.isArray(item.seasons)) {
    seasons = item.seasons.map((s: any) => ({
      id: String(s.id),
      name: s.name,
      seasonNumber: s.season_number,
      posterUrl: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : "",
      episodeCount: s.episode_count ?? 0,
      episodes: [],
    }));
  }

  // Cast members
  let cast: string[] = [];
  if (item.credits && item.credits.cast) {
    cast = item.credits.cast.slice(0, 5).map((actor: any) => actor.name);
  }

  // YouTube trailer detection
  let videoUrl = "";
  if (item.videos && item.videos.results) {
    const results = item.videos.results || [];
    const trailer =
      results.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official === true) ||
      results.find((v: any) => v.site === "YouTube" && v.type === "Trailer") ||
      results[0];

    if (trailer && trailer.key) {
      videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
    }
  }

  // Backdrop & Poster paths
  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
    : "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=1200";
  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400";

  return {
    id: String(item.id),
    title: item.title || item.name || "Untitled",
    type,
    description: item.overview || "No description available.",
    synopsis: item.overview || "No synopsis available.",
    backdropUrl,
    posterUrl,
    rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 7.0,
    year,
    duration: isTV
      ? `${item.number_of_seasons || 1} Season${item.number_of_seasons > 1 ? 's' : ''}`
      : item.runtime
        ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
        : "2h 05m",
    genres,
    cast: cast.length > 0 ? cast : ["Cast Info Unavailable"],
    // No trailer found — leave videoUrl empty so the VideoPlayer
    // shows its "Flux indisponible" placeholder instead of trying to
    // load a hard-coded asset that is blocked by the CSP.
    videoUrl: videoUrl || "",
    seasons: seasons && seasons.length > 0 ? seasons : undefined,
  };
}

export async function getTrendingMovies(): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/trending?language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie"));
    }
  } catch (error) {
    console.error("Error fetching trending movies:", error);
  }
  return [];
}

export async function getTrendingTV(): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/trending?language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "series"));
    }
  } catch (error) {
    console.error("Error fetching trending series:", error);
  }
  return [];
}

export async function getPopularMovies(page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/popular?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie"));
    }
  } catch (error) {
    console.error("Error fetching popular movies:", error);
  }
  return [];
}

export async function getPopularTV(page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/popular?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "series"));
    }
  } catch (error) {
    console.error("Error fetching popular series:", error);
  }
  return [];
}

export async function getTopRatedTV(page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/top-rated?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "series"));
    }
  } catch (error) {
    console.error("Error fetching top rated TV:", error);
  }
  return [];
}

export async function getAnimeSeries(page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/anime?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "anime"));
    }
  } catch (error) {
    console.error("Error fetching anime:", error);
  }
  return [];
}

export async function getPopularTVPage(page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/popular?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return {
        results: json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "series")),
        totalPages: json.data.total_pages || 1,
      };
    }
  } catch (error) {
    console.error("Error fetching popular TV page:", error);
  }
  return { results: [], totalPages: 1 };
}

export async function getAnimeSeriesPage(page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/anime?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return {
        results: json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "anime")),
        totalPages: json.data.total_pages || 1,
      };
    }
  } catch (error) {
    console.error("Error fetching anime page:", error);
  }
  return { results: [], totalPages: 1 };
}

export async function getPopularMoviesPage(page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/popular?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return {
        results: json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie")),
        totalPages: json.data.total_pages || 1,
      };
    }
  } catch (error) {
    console.error("Error fetching popular movies page:", error);
  }
  return { results: [], totalPages: 1 };
}

export async function getUpcomingMovies(page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/upcoming?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie"));
    }
  } catch (error) {
    console.error("Error fetching upcoming movies:", error);
  }
  return [];
}

export async function getTopRatedMovies(page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/top-rated?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie"));
    }
  } catch (error) {
    console.error("Error fetching top rated movies:", error);
  }
  return [];
}

export async function getMediaDetails(id: string, isTV: boolean = false): Promise<MovieOrShow | null> {
  try {
    const endpoint = isTV ? `tv/${id}` : `movies/${id}`;
    const res = await fetchWithTimeout(`${API_BASE_URL}/${endpoint}?language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return mapTMDBToMovieOrShow(json.data, isTV ? "series" : "movie");
    }
  } catch (error) {
    console.error("Error fetching media details:", error);
  }
  return null;
}

export async function getSeasonDetails(id: string, seasonNumber: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/${id}/season/${seasonNumber}?language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (error) {
    console.error("Error fetching season details:", error);
  }
  return null;
}

export async function getMovieRecommendations(id: string): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/${id}/recommendations?language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results
        .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
        .slice(0, 20)
        .map((item: any) => {
          const type = item.media_type === "tv" ? "series" : "movie";
          return mapTMDBToMovieOrShow(item, type as any);
        });
    }
  } catch (error) {
    console.error("Error fetching recommendations:", error);
  }
  return [];
}

export async function getRecommendedForYou(): Promise<MovieOrShow[]> {
  try {
    // Fetch top popular movies and use their recommendations
    const pop = await getPopularMovies();
    const topIds = pop.slice(0, 5).map(m => m.id);
    const allRecs = await Promise.all(topIds.map(id => getMovieRecommendations(id)));
    const seen = new Set<string>();
    return allRecs.flat().filter(item => {
      if (seen.has(item.id)) return false;
      if (topIds.includes(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, 20);
  } catch {
    return [];
  }
}

export async function searchMedia(query: string, page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (!json.success) return [];

    const results: MovieOrShow[] = [];

    // 1. MongoDB local results
    const local = json.data?.localResults;
    if (local) {
      for (const m of local.movies || []) {
        results.push({
          id: m.tmdbId ? String(m.tmdbId) : String(m._id),
          title: m.titre,
          type: 'movie',
          description: '',
          synopsis: '',
          backdropUrl: 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=1200',
          posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400',
          rating: 0,
          year: 0,
          duration: '',
          genres: ['Movie'],
          cast: [],
        });
      }
      for (const s of local.series || []) {
        results.push({
          id: s.tmdbId ? String(s.tmdbId) : String(s._id),
          title: s.titre,
          type: 'series',
          description: '',
          synopsis: '',
          backdropUrl: 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=1200',
          posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400',
          rating: 0,
          year: 0,
          duration: '',
          genres: ['Series'],
          cast: [],
        });
      }
    }

    // 2. TMDB results
    if (json.data?.tmdbResults?.results) {
      const tmdb = json.data.tmdbResults.results
        .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
        .map((item: any) => {
          const type = item.media_type === "tv" ? "series" : "movie";
          return mapTMDBToMovieOrShow(item, type as any);
        });
      results.push(...tmdb);
    }

    return results;
  } catch (error) {
    console.error("Error searching media:", error);
  }
  return [];
}

export async function getNexStreamUrl(
  id: string,
  type: 'movie' | 'series' | 'anime' = 'movie',
  season?: number,
  episode?: number
): Promise<string | null> {
  try {
    const isTv = type === 'series' || type === 'anime';
    let endpoint: string;
    if (isTv) {
      endpoint = `nexstream/tv/${id}/${season || 1}/${episode || 1}`;
    } else {
      endpoint = `nexstream/movie/${id}`;
    }
    const res = await fetchWithTimeout(`${API_BASE_URL}/${endpoint}?language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data?.embedUrl) {
      return json.data.embedUrl;
    }
  } catch (error) {
    console.error("Error fetching NexStream URL:", error);
  }
  return null;
}

export async function getStreamUrl(
  id: string,
  type: 'movie' | 'series' | 'anime' = 'movie',
  season?: number,
  episode?: number,
  title?: string
): Promise<{ embedUrl: string; provider: string } | null> {
  try {
    const isTv = type === 'series' || type === 'anime';
    let endpoint: string;
    if (isTv) {
      endpoint = `stream/tv/${id}/${season || 1}/${episode || 1}`;
    } else {
      endpoint = `stream/movie/${id}`;
    }
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('language', getLang());
    if (title) params.set('title', title);
    const res = await fetchWithTimeout(`${API_BASE_URL}/${endpoint}?${params.toString()}`);
    const json = await res.json();
    if (json.success && json.data?.embedUrl) {
      return { embedUrl: json.data.embedUrl, provider: json.provider || 'unknown' };
    }
    if (!json.success) {
      console.warn(`Stream unavailable for "${title || id}": ${json.message || 'unknown reason'}`);
    }
  } catch (error) {
    console.error("Error fetching stream URL:", error);
  }
  return null;
}

export async function startDownload(
  id: string,
  type: 'movie' | 'series' | 'anime' = 'movie',
  title?: string,
  season?: number,
  episode?: number
): Promise<{ downloadUrl: string; fileCode: string } | null> {
  try {
    if (title) {
      let doodUrl = `${API_BASE_URL}/doodstream/download?title=${encodeURIComponent(title)}`;
      if (season !== undefined) doodUrl += `&season=${season}`;
      if (episode !== undefined) doodUrl += `&episode=${episode}`;
      const res = await fetchWithTimeout(doodUrl);
      const json = await res.json();
      if (json.success && json.data?.downloadUrl) {
        return { downloadUrl: json.data.downloadUrl, fileCode: json.data.fileCode };
      }
    }

    const res = await fetchWithTimeout(`${API_BASE_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: id, mediaType: type, season, episode, title }),
    });
    const json = await res.json();
    if (json.success && json.m3u8_url) {
      return { downloadUrl: json.m3u8_url, fileCode: '' };
    }
    console.error('Download extraction failed:', json.error);
  } catch (error) {
    console.error('Error starting download:', error);
  }
  return null;
}

export async function checkSeriesDownloads(tmdbId: string): Promise<{
  success: boolean;
  data?: { missing?: { season: number; episode: number }[]; episodes?: { season: number; episode: number; fileCode: string; downloadUrl: string | null }[]; total?: number; seriesTitle?: string | null };
  message?: string | null;
}> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/doodstream/series/download-check?tmdb_id=${tmdbId}`);
    const json = await res.json();
    if (json.success && json.data) {
      return { success: true, data: json.data, message: json.message };
    }
    return { success: false, data: json.data || undefined, message: json.message || 'Série incomplète ou indisponible' };
  } catch (error) {
    console.error('Error checking series downloads:', error);
    return { success: false, message: 'Erreur lors de la vérification de la série' };
  }
}

export async function clearTmdbCache(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/clear-cache`, { method: 'POST' });
  } catch {
    // silent
  }
}

export function triggerDownload(downloadUrl: string, filename: string = 'video.mp4') {
  if (typeof window === "undefined") return;

  // Vidzy/DoodStream direct links — open in new tab
  window.open(downloadUrl, '_blank');
}

export interface Genre {
  id: number;
  name: string;
}

export async function getMovieGenres(): Promise<Genre[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/genres/movie?language=${getLang()}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch (error) {
    console.error("Error fetching movie genres:", error);
  }
  return [];
}

export async function getAllMovies(page = 1): Promise<MovieOrShow[]> {
  try {
    const [popular, topRated, trending] = await Promise.all([
      getPopularMovies(page),
      getTopRatedMovies(page),
      fetch(`${API_BASE_URL}/movies/trending?language=${getLang()}`).then(r => r.json()).then(j =>
        j.success ? j.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie")) : []
      ),
    ]);
    const merged = [...trending, ...popular, ...topRated];
    const seen = new Set<string>();
    return merged.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch (error) {
    console.error("Error fetching all movies:", error);
  }
  return [];
}

export async function getMoviesByGenrePage(genreId: string, page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/genre/${genreId}?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return {
        results: json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie")),
        totalPages: json.data.total_pages || 1,
      };
    }
  } catch (error) {
    console.error(`Error fetching movies by genre ${genreId}:`, error);
  }
  return { results: [], totalPages: 1 };
}

export async function getTVByGenrePage(genreId: string, page = 1): Promise<{ results: MovieOrShow[]; totalPages: number }> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/tv/genre/${genreId}?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data) {
      return {
        results: json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "series")),
        totalPages: json.data.total_pages || 1,
      };
    }
  } catch (error) {
    console.error(`Error fetching TV by genre ${genreId}:`, error);
  }
  return { results: [], totalPages: 1 };
}

export async function getTVGenres(): Promise<Genre[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/genres/tv?language=${getLang()}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch (error) {
    console.error("Error fetching TV genres:", error);
  }
  return [];
}

export async function getMoviesByGenre(genreId: string, page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/movies/genre/${genreId}?page=${page}&language=${getLang()}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results.map((item: any) => mapTMDBToMovieOrShow(item, "movie"));
    }
  } catch (error) {
    console.error(`Error fetching movies for genre ${genreId}:`, error);
  }
  return [];
}

export async function getMoviesByGenreMultiPage(genreId: string, pages = 2): Promise<MovieOrShow[]> {
  const pagePromises = [];
  for (let i = 1; i <= pages; i++) {
    pagePromises.push(getMoviesByGenre(genreId, i));
  }
  const results = await Promise.all(pagePromises);
  const seen = new Set<string>();
  return results.flat().filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function getByGenreMultiple(genres: { id: string; name: string }[], pages = 2): Promise<Record<string, MovieOrShow[]>> {
  const entries = await Promise.all(
    genres.map(async (g) => {
      const movies = await getMoviesByGenreMultiPage(g.id, pages);
      return [g.name, movies] as const;
    })
  );
  return Object.fromEntries(entries);
}

/* ─── Admin API ─── */

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin-token');
}

async function adminFetch(url: string, options?: RequestInit) {
  const token = getAdminToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetchWithTimeout(`${API_BASE_URL}/admin${url}`, { ...options, headers });
  return res.json();
}

export async function adminLogin(username: string, password: string) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success && data.data?.token) {
    localStorage.setItem('admin-token', data.data.token);
  }
  return data;
}

export async function adminVerify() {
  return adminFetch('/auth/verify');
}

export async function adminLogout() {
  localStorage.removeItem('admin-token');
}

export async function adminGetDashboard() {
  return adminFetch('/dashboard');
}

export async function adminGetLogs(type = 'all', lines = 100) {
  return adminFetch(`/logs?type=${type}&lines=${lines}`);
}

export async function adminGetDeadLinks() {
  return adminFetch('/dead-links');
}

export async function adminGetSettings() {
  return adminFetch('/settings');
}

export async function adminUpdateSettings(settings: Record<string, string>) {
  return adminFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function adminTriggerScrape(type: string) {
  return adminFetch('/scrape/trigger', {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export async function adminClearCache() {
  return adminFetch('/clear-cache', { method: 'POST' });
}

export async function adminGetCollection(type: string, q = '', page = 1, limit = 50) {
  return adminFetch(`/collection?type=${type}&q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
}

export async function adminGetScraperState() {
  return adminFetch('/scraper-state');
}

export async function adminGetSerie(id: string) {
  return adminFetch(`/serie/${id}`);
}

export async function adminGetTmdbStats() {
  return adminFetch('/tmdb/stats');
}

export async function adminTriggerTmdbLink(type: string) {
  return adminFetch('/tmdb/link', {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export function adminGetLogsStreamUrl(): string {
  const token = getAdminToken();
  return `${API_BASE_URL}/admin/logs/stream?token=${token}`;
}
