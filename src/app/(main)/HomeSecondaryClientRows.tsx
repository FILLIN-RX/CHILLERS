"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import MovieCard from "@/components/MovieCard";
import ScrollRow from "@/components/ScrollRow";
import { useHomeActions } from "./HomeActionContext";
import type { MovieOrShow } from "@/types/media";

function LazyRow({ children, title }: { children: React.ReactNode; title: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: "400px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={ref} className="min-h-[250px]">
      {isVisible ? (
        children
      ) : (
        <div className="space-y-3 py-3">
          <div className="h-4 w-36 rounded bg-white/10 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[250px] w-[165px] shrink-0 rounded-2xl bg-zinc-900/60 animate-pulse" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface HomeSecondaryClientRowsProps {
  africanMovies: MovieOrShow[];
  africanSeries: MovieOrShow[];
  topRatedMovies: MovieOrShow[];
  topRatedTV: MovieOrShow[];
  actionMovies: MovieOrShow[];
  comedyMovies: MovieOrShow[];
  actionSeries: MovieOrShow[];
  animationSeries: MovieOrShow[];
  boxOffice: MovieOrShow[];
  newAnime: MovieOrShow[];
  martialArts: MovieOrShow[];
  tvForYou: MovieOrShow[];
  saDrama: MovieOrShow[];
  madeInChina: MovieOrShow[];
  barbieMovies: MovieOrShow[];
  realityShows: MovieOrShow[];
  allTimeFavorites?: MovieOrShow[];
}

export default function HomeSecondaryClientRows({
  africanMovies,
  africanSeries,
  topRatedMovies,
  topRatedTV,
  actionMovies,
  comedyMovies,
  actionSeries,
  animationSeries,
  boxOffice,
  newAnime,
  martialArts,
  tvForYou,
  saDrama,
  madeInChina,
  barbieMovies,
  realityShows,
  allTimeFavorites = [],
}: HomeSecondaryClientRowsProps) {
  const { onWatchNow, onOpenDetails } = useHomeActions();

  const secondaryRows = useMemo(() => {
    const rows: Array<{
      title: string;
      items: MovieOrShow[];
      accent: "primary" | "secondary";
      variant?: "poster";
    }> = [];
    const seen = new Set<string>();
    const seenRowSignatures = new Set<string>();

    const push = (
      title: string,
      items: MovieOrShow[] = [],
      accent: "primary" | "secondary",
      variant?: "poster"
    ) => {
      if (!Array.isArray(items) || items.length === 0) return;

      const internalMap = new Map<string, MovieOrShow>();
      for (const it of items) {
        if (it && it.id && it.posterUrl && !internalMap.has(String(it.id))) {
          internalMap.set(String(it.id), it);
        }
      }
      const uniqueItems = Array.from(internalMap.values());
      if (uniqueItems.length < 3) return;

      const isCustomCategory = [
        "Box office",
        "New Anime",
        "Martial art",
        "TV for you",
        "SA Drama",
        "Made in China",
        "Séries d'Animation",
        "Séries Action & Aventure",
        "Comédies à voir",
        "Films d'Action",
        "Barbie World",
        "Reality Show",
        "All time favorite",
      ].includes(title);

      const filtered = isCustomCategory ? uniqueItems : uniqueItems.filter((it) => !seen.has(String(it.id)));
      const fresh = filtered.slice(0, 10);
      if (fresh.length < 3) return;

      const signature = fresh.map((it) => it.id).slice(0, 5).sort().join(":");
      if (seenRowSignatures.has(signature)) return;
      seenRowSignatures.add(signature);

      fresh.forEach((it) => seen.add(String(it.id)));
      rows.push({ title, items: fresh, accent, variant });
    };

    push("TV for you", tvForYou, "primary", "poster");

    const favoritesList = allTimeFavorites && allTimeFavorites.length > 0
      ? allTimeFavorites
      : [...topRatedTV, ...topRatedMovies];
    push("All time favorite", favoritesList, "secondary", "poster");

    push("Box office", boxOffice, "primary", "poster");
    push("New Anime", newAnime, "secondary", "poster");
    push("Martial art", martialArts, "primary", "poster");
    push("Reality Show", realityShows, "primary", "poster");
    push("Barbie World", barbieMovies, "secondary", "poster");

    push("Films d'Action", actionMovies, "primary", "poster");
    push("Comédies à voir", comedyMovies, "secondary", "poster");
    push("Séries Action & Aventure", actionSeries, "secondary", "poster");
    push("Films Africains", africanMovies, "secondary", "poster");
    push("Séries Africaines", africanSeries, "secondary", "poster");
    push("SA Drama", saDrama, "secondary", "poster");
    push("Made in China", madeInChina, "primary", "poster");
    push("Séries d'Animation", animationSeries, "primary", "poster");

    return rows;
  }, [
    africanMovies,
    africanSeries,
    topRatedMovies,
    topRatedTV,
    actionMovies,
    comedyMovies,
    actionSeries,
    animationSeries,
    boxOffice,
    newAnime,
    martialArts,
    tvForYou,
    saDrama,
    madeInChina,
    barbieMovies,
    realityShows,
    allTimeFavorites,
  ]);

  return (
    <div className="space-y-8">
      {secondaryRows.map((row) => (
        <LazyRow key={row.title} title={row.title}>
          <ScrollRow title={row.title} accentColor={row.accent}>
            {row.items.map((item) => (
              <MovieCard
                key={item.id}
                item={item}
                variant={row.variant}
                onPlay={onWatchNow}
                onOpenDetails={onOpenDetails}
              />
            ))}
          </ScrollRow>
        </LazyRow>
      ))}
    </div>
  );
}
