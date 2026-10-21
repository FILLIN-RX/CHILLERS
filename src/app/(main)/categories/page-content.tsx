"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { httpJson } from "@/services/http";
import { mapTMDBToMovieOrShow, type TmdbRawItem } from "@/services/media";
import type { MovieOrShow } from "@/types/media";

type AfrolandFilm = {
  id: string;
  title: string;
  year?: number;
  description?: string;
  posterUrl?: string;
  language?: string;
  tmdbId?: number;
  matched: boolean;
  card?: TmdbRawItem;
};

type CatalogPage = { items: AfrolandFilm[]; totalPages: number };
type ApiEnvelope<T> = { success: boolean; data?: T };

function mapAfrolandFilm(film: AfrolandFilm): MovieOrShow {
  const fallbackDate = film.year ? `${film.year}-01-01` : undefined;
  const raw: TmdbRawItem = film.matched && film.card
    ? {
        ...film.card,
        id: film.tmdbId || film.card.id,
        media_type: "movie",
        title: film.title,
        overview: film.description || film.card.overview,
        posterUrl: film.posterUrl || film.card.posterUrl,
        release_date: film.card.release_date || fallbackDate,
        sourceProvider: "Black",
      }
    : {
        id: 0,
        media_type: "movie",
        title: film.title,
        overview: film.description || "",
        posterUrl: film.posterUrl,
        year: film.year,
        release_date: fallbackDate,
        sourceProvider: "Black",
      };
  const mapped = mapTMDBToMovieOrShow(raw, "movie");
  return {
    ...mapped,
    id: film.matched && film.tmdbId ? String(film.tmdbId) : `afroland-${film.id}`,
    sourceProvider: "Black",
    langueAudio: film.language || "UNKNOWN",
    isFrenchAudio: ["VF", "VFF", "VFQ"].includes(film.language || ""),
  };
}

export default function CategoriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<MovieOrShow[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    httpJson<ApiEnvelope<CatalogPage>>("/catalog/list", {
      query: { provider: "afroland", type: "movie", matched: "all", page, limit: 24 },
      timeoutMs: 15_000,
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.success || !response.data) throw new Error("Catalogue AfroLand indisponible");
        const nextItems = response.data.items.map(mapAfrolandFilm);
        setTotalPages(response.data.totalPages || 1);
        setItems((current) => page === 1 || !current
          ? nextItems
          : [...current, ...nextItems.filter((item) => !current.some((previous) => previous.id === item.id))]);
        setIsLoadingMore(false);
      })
      .catch((error) => {
        console.error("Erreur de chargement du catalogue Nollywood", error);
        if (!cancelled) {
          setHasError(true);
          setItems((current) => current ?? []);
          setIsLoadingMore(false);
        }
      });
    return () => { cancelled = true; };
  }, [page]);

  const isLoading = items === null;
  const visibleItems = items ?? [];
  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setPage((current) => current + 1);
    }
  }, [hasMore, isLoading, isLoadingMore]);
  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoading || isLoadingMore,
    rootMargin: "600px",
  });

  const openDetails = (item: MovieOrShow) => {
    router.push(item.id.startsWith("afroland-")
      ? `/media/${item.id}?type=movie`
      : `/media/${item.id}`);
  };
  const play = (item: MovieOrShow) => {
    router.push(`/watch/${item.id}?type=movie`);
  };

  return (
    <main className="min-h-screen bg-brand-dark pb-28 pt-24 sm:pt-28 lg:pt-24">
      <div className="mb-2 px-2 py-2 sm:px-6 md:px-12 lg:px-[3%]">
        <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Nollywood</h1>
      </div>

      <div className="px-2 pt-2 sm:px-6 md:px-12 lg:px-[3%]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-8">
          {visibleItems.map((item) => (
            <MovieCard
              key={item.id}
              item={item}
              variant="grid-poster"
              onPlay={play}
              onOpenDetails={openDetails}
            />
          ))}
          {(isLoading || isLoadingMore) &&
            Array.from({ length: isLoading ? 15 : 10 }).map((_, index) => (
              <MovieCardSkeleton key={`skeleton-${index}`} variant="grid-poster" />
            ))}
        </div>

        {hasMore && (
          <div ref={sentinelRef} className="flex w-full flex-col items-center justify-center gap-2 py-8">
            {isLoadingMore && (
              <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-zinc-900/80 px-4 py-2 text-xs font-semibold text-zinc-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                <span>Chargement des films suivants…</span>
              </div>
            )}
          </div>
        )}

        {!isLoading && !isLoadingMore && visibleItems.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            {hasError ? "Le catalogue AfroLand est momentanément indisponible." : "Aucun film disponible."}
          </p>
        )}
      </div>
    </main>
  );
}
