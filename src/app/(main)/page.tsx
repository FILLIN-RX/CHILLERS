"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import HeroCarousel from "@/components/HeroCarousel";
import MovieCard from "@/components/MovieCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import ScrollRow from "@/components/ScrollRow";
import SpotlightGrid from "@/components/SpotlightGrid";
import MostViewedMovie from "@/components/MostViewedMovie";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  MovieOrShow,
  Episode,
} from "@/types/media";

import {
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getMoviesByGenre,
  getAnimeSeries,
  getAfricanMovies,
  getAfricanTV,
  AFRICAN_COUNTRIES,
  getUpcomingMovies,
  getRecommendedForYou,
} from "../api";

const HOME_GENRES = [
  { id: '16', title: 'Animation' },
  { id: '28', title: 'Action' },
  { id: '10749', title: 'Romance' },
];

// Full catalogue of home sections. Each entry either fetches a single TMDB
// genre or combines several genres into one row (deduped at load time).
type HomeSectionDef = {
  key: string;
  title: string;
  genreIds?: string[];
  tv?: boolean;
  recommended?: boolean;
};

const HOME_SECTIONS: HomeSectionDef[] = [
  { key: 'action', title: "Films d'Action", genreIds: ['28'] },
  { key: 'comedy', title: "Films de Comédie", genreIds: ['35'] },
  { key: 'animation', title: "Films d'Animation", genreIds: ['16'] },
  { key: 'drama', title: "Films Dramatiques (Drama)", genreIds: ['18'] },
  { key: 'series', title: "Séries TV", tv: true },
  { key: 'fantasy', title: "Films de Fantaisie / Aventure", genreIds: ['12', '14'] },
  { key: 'recommended', title: "Recommandés pour vous", recommended: true },
  { key: 'scifi', title: "Films de Science-Fiction", genreIds: ['878'] },
  { key: 'horror', title: "Films d'Horreur / Thriller", genreIds: ['27', '53'] },
];

const HOME_SECTION_KEYS = HOME_SECTIONS.map((s) => s.key);

const ANIME_GENRES = [
  { id: '10759', title: 'Action & Adventure Anime' },
  { id: '16', title: 'Animation Anime' },
  { id: '10765', title: 'Sci-Fi & Fantasy Anime' },
];

type TabFetcher = (signal: AbortSignal) => Promise<MovieOrShow[]>;

const MovieModal = dynamic(() => import("@/components/MovieModal"), {
  ssr: false,
});

const TAB_FETCHERS: Record<string, TabFetcher> = {
  movies: (signal) => getPopularMovies(1, signal),
  series: (signal) => getPopularTV(1, signal),
  anime: (signal) => getAnimeSeries(1, signal),
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Home />
    </Suspense>
  );
}

function HomeFallback() {
  const { translate: _ } = useLanguage();
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm">{_("common.loading")}</p>
      </div>
    </div>
  );
}

function Home() {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("home");

  const [selectedMovie, setSelectedMovie] = useState<MovieOrShow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [continueWatching, setContinueWatching] = useState<
    { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; season?: number; episode?: number }[]
  >([]);

  const [heroSlides, setHeroSlides] = useState<MovieOrShow[]>([]);
  const [trendingAll, setTrendingAll] = useState<MovieOrShow[]>([]);
  const [moviesData, setMoviesData] = useState<MovieOrShow[]>([]);
  const [seriesData, setSeriesData] = useState<MovieOrShow[]>([]);
  const [animeData, setAnimeData] = useState<MovieOrShow[]>([]);
  const [africanMoviesData, setAfricanMoviesData] = useState<MovieOrShow[]>([]);
  const [africanSeriesData, setAfricanSeriesData] = useState<MovieOrShow[]>([]);
  const [selectedAfricanCountry, setSelectedAfricanCountry] = useState<string>("");
  const [newReleases, setNewReleases] = useState<MovieOrShow[]>([]);
  const [genreRows, setGenreRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [animeGenreRows, setAnimeGenreRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [homeSectionRows, setHomeSectionRows] = useState<{ title: string; items: MovieOrShow[] }[]>([]);
  const [spotlightItems, setSpotlightItems] = useState<MovieOrShow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingGenreRows, setIsLoadingGenreRows] = useState(false);
  const [isLoadingAnimeGenreRows, setIsLoadingAnimeGenreRows] = useState(false);
  const [isLoadingHomeSections, setIsLoadingHomeSections] = useState(false);
  const [hasTriedGenreRows, setHasTriedGenreRows] = useState(false);
  const [hasTriedAnimeGenreRows, setHasTriedAnimeGenreRows] = useState(false);
  const [hasTriedHomeSections, setHasTriedHomeSections] = useState(false);

  // Two animated rows derived from `trendingAll`:
  // - `mostWatched`: top items by rating (people-rated popularity proxy)
  // - `trendingNow`: most recent items (this-week freshness proxy)
  // Both are capped at 10 because the rows are infinite-scroll carousels.
  const mostWatched = useMemo(
    () =>
      [...trendingAll]
        .filter((m) => m.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 10),
    [trendingAll],
  );
  const trendingNow = useMemo(
    () =>
      [...trendingAll]
        .filter((m) => m.year > 0)
        .sort((a, b) => b.year - a.year)
        .slice(0, 10),
    [trendingAll],
  );

  // Global on-page de-duplication: a `MovieOrShow` should never appear twice on
  // the home page, even if it belongs to several sections/genres. Each row keeps
  // the top items that haven't been shown above, so rows lower on the page don't
  // repeat titles from rows higher up.
  const homeRows = useMemo<Array<{
    title: string;
    items: MovieOrShow[];
    accent: "primary" | "secondary";
    variant?: "poster";
    autoScroll?: boolean;
    autoScrollSpeed?: number;
  }>>(() => {
    const rows: Array<{
      title: string;
      items: MovieOrShow[];
      accent: "primary" | "secondary";
      variant?: "poster";
      autoScroll?: boolean;
      autoScrollSpeed?: number;
    }> = [];
    const seen = new Set<string>();
    const push = (
      title: string,
      items: MovieOrShow[],
      accent: "primary" | "secondary",
      variant?: "poster",
      autoScroll?: boolean,
      autoScrollSpeed?: number,
    ) => {
      const fresh = items.filter((it) => !seen.has(it.id));
      fresh.forEach((it) => seen.add(it.id));
      if (fresh.length === 0) return;
      rows.push({ title, items: fresh, accent, variant, autoScroll, autoScrollSpeed });
    };
    push(_("home.trending"), trendingAll, "primary", "poster");
    push("Nouveautés", newReleases, "primary", "poster");
    push(_("home.mostWatched"), mostWatched, "primary", undefined, true, 0.4);
    push(_("home.trendingNow"), trendingNow, "secondary", undefined, true, 0.5);
    push(_("home.popularSeries"), seriesData, "primary");
    push(_("home.animeCollection"), animeData, "secondary");
    push("Films Africains", africanMoviesData, "secondary");
    push("Séries Africaines", africanSeriesData, "secondary");
    animeGenreRows.forEach((r) => push(r.title, r.items, "secondary"));
    genreRows.forEach((r) => push(r.title, r.items, "secondary"));
    for (const section of HOME_SECTIONS) {
      if (section.key === 'animation' || section.key === 'action') continue;
      const row = homeSectionRows.find((r) => r.title === section.title);
      if (!row || row.items.length === 0) continue;
      push(section.title, row.items, "secondary");
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendingAll, newReleases, mostWatched, trendingNow, seriesData, animeData, animeGenreRows, genreRows, homeSectionRows, africanMoviesData, africanSeriesData]);

  // Continue-watching is read from localStorage. Declared BEFORE the useEffect
  // that calls it so the effect's first run can't hit a TDZ (P0-#8).
  const loadContinueWatchingHistory = useCallback(() => {
    const history: { item: MovieOrShow; progress: number; remaining: string; episodeName?: string; season?: number; episode?: number; updatedAt: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("chiller_progress_")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.title) {
              history.push({
                item: {
                  id: parsed.id,
                  title: parsed.title,
                  type: parsed.type || 'movie',
                  posterUrl: parsed.posterUrl || '',
                  backdropUrl: parsed.backdropUrl || '',
                  description: '',
                  synopsis: '',
                  rating: 0,
                  year: 0,
                  duration: '',
                  genres: [],
                  cast: [],
                  videoUrl: '',
                },
                progress: parsed.progress,
                remaining: parsed.remaining,
                episodeName: parsed.episodeName,
                season: parsed.season,
                episode: parsed.episode,
                updatedAt: parsed.updatedAt || 0,
              });
            }
          }
        } catch (e) {
          console.error("Failed to read progress history item", e);
        }
      }
    }

    history.sort((a, b) => b.updatedAt - a.updatedAt);
    setContinueWatching(
      history.map(({ item, progress, remaining, episodeName, season, episode }) => ({
        item,
        progress,
        remaining,
        episodeName,
        season,
        episode,
      })),
    );
  }, []);

  useEffect(() => {
    loadContinueWatchingHistory();
  }, [loadContinueWatchingHistory]);

  const loadNewReleases = useCallback(async () => {
    if (newReleases.length > 0) return;
    try {
      const releases = await getUpcomingMovies(1);
      if (releases.length > 0) setNewReleases(releases);
    } catch (err) {
      console.error("Failed to load new releases", err);
    }
  }, [newReleases.length]);

  const loadHomeData = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingData(true);
    try {
      const fetchWithCatch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await promise;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") throw e;
          console.error("Failed fetching section:", e);
          return fallback;
        }
      };

      const [trending, trendingTV, popular, popularTV, anime, africanM, africanS] = await Promise.all([
        fetchWithCatch(getTrendingMovies(signal), []),
        fetchWithCatch(getTrendingTV(signal), []),
        fetchWithCatch(getPopularMovies(1, signal), []),
        fetchWithCatch(getPopularTV(1, signal), []),
        fetchWithCatch(getAnimeSeries(1, signal), []),
        fetchWithCatch(getAfricanMovies(1, undefined, signal), []),
        fetchWithCatch(getAfricanTV(1, undefined, signal), []),
      ]);

      const allTrending = [...trending, ...trendingTV];
      if (allTrending.length > 0) setTrendingAll(allTrending);
      if (popular.length > 0) {
        setMoviesData(popular);
        setHeroSlides(popular.slice(0, 10));
      }
      if (popularTV.length > 0) setSeriesData(popularTV);
      if (anime.length > 0) setAnimeData(anime);
      if (africanM.length > 0) setAfricanMoviesData(africanM);
      if (africanS.length > 0) setAfricanSeriesData(africanS);

      await loadNewReleases();

    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      console.error("Failed to load home data", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [loadNewReleases]);

  const handleCountrySelect = useCallback(async (code: string) => {
    setSelectedAfricanCountry(code);
    try {
      const [africanM, africanS] = await Promise.all([
        getAfricanMovies(1, code || undefined),
        getAfricanTV(1, code || undefined),
      ]);
      setAfricanMoviesData(africanM || []);
      setAfricanSeriesData(africanS || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadGenreRows = useCallback(async (signal?: AbortSignal) => {
    if (genreRows.length > 0) return;
    setIsLoadingGenreRows(true);
    let success = false;
    try {
      const rowsData = await Promise.all(
        HOME_GENRES.map(async (g) => ({
          title: g.title,
          items: await getMoviesByGenre(g.id, 1, signal),
        })),
      );
      const validRows = rowsData.filter((row) => row.items.length > 0);
      if (validRows.length > 0) setGenreRows(validRows);
      success = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to load home genre rows", err);
    } finally {
      setIsLoadingGenreRows(false);
      if (success) setHasTriedGenreRows(true);
    }
  }, [genreRows.length]);

  const loadAnimeGenreRows = useCallback(async (signal?: AbortSignal) => {
    if (animeGenreRows.length > 0) return;
    setIsLoadingAnimeGenreRows(true);
    let success = false;
    try {
      const rowsData = await Promise.all(
        ANIME_GENRES.map(async (g) => ({
          title: g.title,
          items: await getMoviesByGenre(g.id, 1, signal),
        })),
      );
      const validRows = rowsData.filter((row) => row.items.length > 0);
      if (validRows.length > 0) setAnimeGenreRows(validRows);
      success = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to load anime genre rows", err);
    } finally {
      setIsLoadingAnimeGenreRows(false);
      if (success) setHasTriedAnimeGenreRows(true);
    }
  }, [animeGenreRows.length]);

  // Loads the full home catalogue (genre / series / recommended rows) plus the
  // promo banner (the single most prominent TMDB title). Home sections are
  // loaded together, deduping combined-genre rows. The banner uses the trending
  // movie as the most-seen title across TMDB.
  const loadHomeSections = useCallback(
    async (signal?: AbortSignal) => {
      if (homeSectionRows.length > 0 && spotlightItems.length > 0) return;
      setIsLoadingHomeSections(true);
      let success = false;
      try {
        const loadSection = async (def: HomeSectionDef): Promise<{ title: string; items: MovieOrShow[] }> => {
          try {
            let items: MovieOrShow[] = [];
            if (def.recommended) {
              items = await getRecommendedForYou();
            } else if (def.tv) {
              items = await getPopularTV(1, signal);
            } else if (def.genreIds && def.genreIds.length > 0) {
              const results = await Promise.all(
                def.genreIds.map(async (gid) => {
                  try {
                    return await getMoviesByGenre(gid, 1, signal);
                  } catch (e) {
                    if (e instanceof DOMException && e.name === "AbortError") throw e;
                    console.error(`Failed to load genre ${gid}`, e);
                    return [] as MovieOrShow[];
                  }
                }),
              );
              const seen = new Set<string>();
              items = results
                .flat()
                .filter((m) => {
                  if (seen.has(m.id)) return false;
                  seen.add(m.id);
                  return true;
                });
            }
            return { title: def.title, items };
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") throw e;
            console.error(`Failed to load section ${def.key}`, e);
            return { title: def.title, items: [] };
          }
        };

        const [rows, banner] = await Promise.all([
          Promise.all(HOME_SECTIONS.map((def) => loadSection(def))),
          getTrendingMovies(signal).catch((e) => {
            if (e instanceof DOMException && e.name === "AbortError") throw e;
            return [] as MovieOrShow[];
          }),
        ]);

        const validRows = rows.filter((row) => row.items.length > 0);
        if (validRows.length > 0) setHomeSectionRows(validRows);
        if (banner.length > 0) setSpotlightItems(banner.slice(0, 5));
        success = true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load home sections", err);
      } finally {
        setIsLoadingHomeSections(false);
        if (success) setHasTriedHomeSections(true);
      }
    },
    [homeSectionRows.length, spotlightItems.length],
  );

  // Home tab: load all rows once. Aborted on unmount or tab change.
  useEffect(() => {
    if (activeTab !== "home") return;
    if (trendingAll.length > 0) return; // already loaded
    const controller = new AbortController();
    loadHomeData(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [activeTab, trendingAll.length, loadHomeData]);

  useEffect(() => {
    if (activeTab !== "home") return;
    if (isLoadingData) return;
    if (genreRows.length > 0 || isLoadingGenreRows || hasTriedGenreRows) return;
    const controller = new AbortController();
    const idleTimer = setTimeout(() => {
      loadGenreRows(controller.signal).catch(() => {});
    }, 350);
    return () => {
      clearTimeout(idleTimer);
      controller.abort();
    };
  }, [activeTab, isLoadingData, genreRows.length, hasTriedGenreRows, loadGenreRows]);

  useEffect(() => {
    if (activeTab !== "home") return;
    if (isLoadingData) return;
    if (animeGenreRows.length > 0 || isLoadingAnimeGenreRows || hasTriedAnimeGenreRows) return;
    const controller = new AbortController();
    const idleTimer = setTimeout(() => {
      loadAnimeGenreRows(controller.signal).catch(() => {});
    }, 700); // Slight delay to stagger
    return () => {
      clearTimeout(idleTimer);
      controller.abort();
    };
  }, [activeTab, isLoadingData, animeGenreRows.length, hasTriedAnimeGenreRows, loadAnimeGenreRows]);

  useEffect(() => {
    if (activeTab !== "home") return;
    if (isLoadingData) return;
    if (homeSectionRows.length > 0 || isLoadingHomeSections || hasTriedHomeSections) return;
    const controller = new AbortController();
    const idleTimer = setTimeout(() => {
      loadHomeSections(controller.signal).catch(() => {});
    }, 500);
    return () => {
      clearTimeout(idleTimer);
      controller.abort();
    };
  }, [activeTab, isLoadingData, homeSectionRows.length, hasTriedHomeSections, loadHomeSections]);

  // P1-#22: one effect dispatches on `activeTab` instead of three near-identical
  // effects. Each tab fetcher is in TAB_FETCHERS; the matching setter is in
  // TAB_SETTERS so we don't have to pass the setter through the fetcher.
  const TAB_SETTERS: Record<string, React.Dispatch<React.SetStateAction<MovieOrShow[]>>> = {
    movies: setMoviesData,
    series: setSeriesData,
    anime: setAnimeData,
  };

  useEffect(() => {
    const fetcher = TAB_FETCHERS[activeTab];
    const setter = TAB_SETTERS[activeTab];
    if (!fetcher || !setter) return;
    if (activeTab === "movies" && moviesData.length > 0) return;
    if (activeTab === "series" && seriesData.length > 0) return;
    if (activeTab === "anime" && animeData.length > 0) return;
    const controller = new AbortController();
    fetcher(controller.signal).then(setter).catch(() => {});
    return () => controller.abort();
  }, [activeTab, moviesData.length, seriesData.length, animeData.length]);

  const handleOpenDetails = (item: MovieOrShow) => {
    // Mobile: navigate directly instead of opening modal
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const typeParam = item.type === "series" || item.type === "anime" ? "tv" : item.type;
      router.push(`/media/${item.id}?type=${typeParam}`);
      return;
    }
    // Desktop : ouvre la modale immédiatement avec les données partielles du card.
    // Les détails complets (cast, saisons, trailer, synopsis long) sont récupérés
    // par MovieModal dans son propre useEffect — plus d'attente synchrone.
    setSelectedMovie(item);
    setIsModalOpen(true);
  };

  const handleWatchNow = (item: MovieOrShow, season?: number, episode?: number) => {
    setIsModalOpen(false);
    const typeParam =
      item.type === "series" || item.type === "anime" ? "tv" : "movie";
    let url = `/watch/${item.id}?type=${typeParam}`;
    if (season) url += `&season=${season}`;
    if (episode) url += `&episode=${episode}`;
    router.push(url);
  };

  const handleModalWatch = (item: MovieOrShow, episode?: Episode) => {
    handleWatchNow(item, episode?.season, episode?.number);
  };

  const getFilteredMedia = (type: 'movie' | 'series' | 'anime') => {
    if (type === 'movie') return moviesData;
    if (type === 'series') return seriesData;
    if (type === 'anime') return animeData;
    return [];
  };

  return (
    <div className="flex-1 flex flex-col bg-brand-dark transition-colors duration-300">

      <main className="flex-grow transition-all duration-300">
        <div className="space-y-10 pb-24">

            {activeTab === "home" && (
              <HeroCarousel
                slides={heroSlides}
                onWatchNow={handleWatchNow}
                onOpenDetails={handleOpenDetails}
                slideTimings={[20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000]}
              />
            )}

            {activeTab !== "home" && <div className="pt-[72px]" />}

            {continueWatching.length > 0 && activeTab === "home" && (
              <div className="max-w-full mx-auto px-2 lg:px-3">
                <ScrollRow title={_("home.continueWatching")} accentColor="secondary">
                  {continueWatching.map(({ item, progress, remaining, episodeName, season, episode }) => (
                    <ContinueWatchingCard
                      key={item.id}
                      item={item}
                      progress={progress}
                      remainingTime={remaining}
                      episodeName={episodeName}
                      onResume={() => handleWatchNow(item, season, episode)}
                      onOpenDetails={handleOpenDetails}
                    />
                  ))}
                </ScrollRow>
              </div>
            )}

            <div className="max-w-full mx-auto px-2 lg:px-3 space-y-8">

              {activeTab === "home" && (
                <>
                  {isLoadingData ? (
                    <>
                      <ScrollRow title={_("home.trending")} accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`trending-sk-${i}`}
                            className="flex-none w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] rounded-2xl bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title="Nouveautés" accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`new-sk-${i}`}
                            className="flex-none w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] rounded-2xl bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title={_("home.popularSeries")} accentColor="primary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`series-sk-${i}`}
                            className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      <ScrollRow title={_("home.animeCollection")} accentColor="secondary">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`anime-sk-${i}`}
                            className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                          />
                        ))}
                      </ScrollRow>

                      {ANIME_GENRES.map((g) => (
                        <ScrollRow key={`anime-genre-sk-${g.title}`} title={g.title} accentColor="secondary">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={`anime-genre-item-sk-${g.id}-${i}`}
                              className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      {HOME_GENRES.map((g) => (
                        <ScrollRow key={`genre-sk-${g.title}`} title={g.title} accentColor="secondary">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={`genre-item-sk-${g.id}-${i}`}
                              className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      {HOME_SECTION_KEYS.filter((k) => k !== 'animation' && k !== 'action').map((k) => (
                        <ScrollRow key={`home-section-sk-${k}`} title={k} accentColor="secondary">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={`home-section-item-sk-${k}-${i}`}
                              className="flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] aspect-video rounded-md bg-zinc-900/60 skeleton-loading"
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      <div className="w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl bg-zinc-900/60 skeleton-loading" />
                    </>
                  ) : (
                    <>
                      {homeRows.slice(0, 2).map((row) => (
                        <ScrollRow
                          key={row.title}
                          title={row.title}
                          accentColor={row.accent}
                          autoScroll={row.autoScroll}
                          autoScrollSpeed={row.autoScrollSpeed}
                        >
                          {row.items.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              variant={row.variant}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      {spotlightItems.length >= 5 && (
                        <MostViewedMovie
                          item={spotlightItems[0]}
                          onWatchNow={handleWatchNow}
                          onOpenDetails={handleOpenDetails}
                        />
                      )}

                      {homeRows.slice(2, 5).map((row) => (
                        <ScrollRow
                          key={row.title}
                          title={row.title}
                          accentColor={row.accent}
                          autoScroll={row.autoScroll}
                          autoScrollSpeed={row.autoScrollSpeed}
                        >
                          {row.items.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              variant={row.variant}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      {spotlightItems.length >= 5 && (
                        <SpotlightGrid
                          items={spotlightItems}
                          onWatchNow={handleWatchNow}
                          onOpenDetails={handleOpenDetails}
                        />
                      )}

                      {homeRows.slice(5, -3).map((row) => (
                        <ScrollRow
                          key={row.title}
                          title={row.title}
                          accentColor={row.accent}
                          autoScroll={row.autoScroll}
                          autoScrollSpeed={row.autoScrollSpeed}
                        >
                          {row.items.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              variant={row.variant}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      ))}

                      {homeRows.slice(-3).map((row) => (
                        <ScrollRow
                          key={row.title}
                          title={row.title}
                          accentColor={row.accent}
                          autoScroll={row.autoScroll}
                          autoScrollSpeed={row.autoScrollSpeed}
                        >
                          {row.items.map((item) => (
                            <MovieCard
                              key={item.id}
                              item={item}
                              variant={row.variant}
                              onPlay={handleWatchNow}
                              onOpenDetails={handleOpenDetails}
                            />
                          ))}
                        </ScrollRow>
                      ))}
                    </>
                  )}
                </>
              )}

              {activeTab === "movies" && (
                <div className="space-y-8">
                  {africanMoviesData.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                          onClick={() => handleCountrySelect("")}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                            selectedAfricanCountry === ""
                              ? "bg-brand-primary text-white"
                              : "bg-zinc-800 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Tous les pays
                        </button>
                        {AFRICAN_COUNTRIES.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => handleCountrySelect(country.code)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                              selectedAfricanCountry === country.code
                                ? "bg-brand-primary text-white"
                                : "bg-zinc-800 text-zinc-400 hover:text-white"
                            }`}
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                      <ScrollRow title={selectedAfricanCountry ? `Films: ${AFRICAN_COUNTRIES.find((c) => c.code === selectedAfricanCountry)?.name}` : "Films Africains"} accentColor="secondary">
                        {africanMoviesData.map((item) => (
                          <MovieCard
                            key={item.id}
                            item={item}
                            onPlay={handleWatchNow}
                            onOpenDetails={handleOpenDetails}
                          />
                        ))}
                      </ScrollRow>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.blockbusterMovies")}</h2>
                      <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.blockbusterSubtitle")}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                    {getFilteredMedia("movie").map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              </div>
              )}

              {activeTab === "series" && (
                <div className="space-y-8">
                  {africanSeriesData.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                          onClick={() => handleCountrySelect("")}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                            selectedAfricanCountry === ""
                              ? "bg-brand-primary text-white"
                              : "bg-zinc-800 text-zinc-400 hover:text-white"
                          }`}
                        >
                          Tous les pays
                        </button>
                        {AFRICAN_COUNTRIES.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => handleCountrySelect(country.code)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                              selectedAfricanCountry === country.code
                                ? "bg-brand-primary text-white"
                                : "bg-zinc-800 text-zinc-400 hover:text-white"
                            }`}
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                      <ScrollRow title={selectedAfricanCountry ? `Séries: ${AFRICAN_COUNTRIES.find((c) => c.code === selectedAfricanCountry)?.name}` : "Séries Africaines"} accentColor="secondary">
                        {africanSeriesData.map((item) => (
                          <MovieCard
                            key={item.id}
                            item={item}
                            onPlay={handleWatchNow}
                            onOpenDetails={handleOpenDetails}
                          />
                        ))}
                      </ScrollRow>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.featuredSeries")}</h2>
                      <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.featuredSeriesSubtitle")}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                    {getFilteredMedia("series").map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              </div>
              )}

              {activeTab === "anime" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.globalAnime")}</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.globalAnimeSubtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                    {getFilteredMedia("anime").map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "trending" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl sm:text-3xl font-extrabold text-white">{_("home.trendingThisWeek")}</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">{_("home.trendingSubtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                    {trendingAll.map((item) => (
                      <MovieCard
                        key={item.id}
                        item={item}
                        variant="grid"
                        onPlay={handleWatchNow}
                        onOpenDetails={handleOpenDetails}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
      </main>

      <MovieModal
        item={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWatch={handleModalWatch}
        onOpenDetails={(movie) => {
          setSelectedMovie(movie);
        }}
      />

    </div>
  );
}
