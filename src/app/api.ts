import { MovieOrShow } from "./mockData";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://chillers.onrender.com/api";

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
    videoUrl: videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-42998-large.mp4",
    seasons: seasons && seasons.length > 0 ? seasons : undefined,
  };
}

export async function getTrendingMovies(): Promise<MovieOrShow[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/movies/trending`);
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
    const res = await fetch(`${API_BASE_URL}/tv/trending`);
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
    const res = await fetch(`${API_BASE_URL}/movies/popular?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/popular?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/top-rated?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/anime?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/popular?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/anime?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/movies/popular?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/movies/upcoming?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/movies/top-rated?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/${endpoint}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/${id}/season/${seasonNumber}`);
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
    const res = await fetch(`${API_BASE_URL}/movies/${id}/recommendations`);
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
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}`);
    const json = await res.json();
    if (json.success && json.data.results) {
      return json.data.results
        .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
        .map((item: any) => {
          const type = item.media_type === "tv" ? "series" : "movie";
          return mapTMDBToMovieOrShow(item, type as any);
        });
    }
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
    const res = await fetch(`${API_BASE_URL}/${endpoint}`);
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
    if (title) params.set('title', title);
    const res = await fetch(`${API_BASE_URL}/${endpoint}?${params.toString()}`);
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
      const res = await fetch(`${API_BASE_URL}/doodstream/download?title=${encodeURIComponent(title)}`);
      const json = await res.json();
      if (json.success && json.data?.downloadUrl) {
        return { downloadUrl: json.data.downloadUrl, fileCode: json.data.fileCode };
      }
    }

    const res = await fetch(`${API_BASE_URL}/download`, {
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

export function triggerDownload(downloadUrl: string, filename: string = 'video.mp4') {
  const link = document.createElement('a');
  link.href = `${API_BASE_URL}/doodstream/download/proxy?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`;
  link.download = filename;
  link.click();
}

export interface Genre {
  id: number;
  name: string;
}

export async function getMovieGenres(): Promise<Genre[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/genres/movie`);
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
      fetch(`${API_BASE_URL}/movies/trending`).then(r => r.json()).then(j =>
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
    const res = await fetch(`${API_BASE_URL}/movies/genre/${genreId}?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/tv/genre/${genreId}?page=${page}`);
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
    const res = await fetch(`${API_BASE_URL}/genres/tv`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch (error) {
    console.error("Error fetching TV genres:", error);
  }
  return [];
}

export async function getMoviesByGenre(genreId: string, page = 1): Promise<MovieOrShow[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/movies/genre/${genreId}?page=${page}`);
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
