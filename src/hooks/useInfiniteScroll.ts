"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions {
  /** Callback déclenché quand le bas de page / sentinelle est atteint */
  onLoadMore: () => void;
  /** Indique s'il reste des pages à charger */
  hasMore: boolean;
  /** Indique si un chargement est déjà en cours */
  isLoading: boolean;
  /** Distance avant la fin (rootMargin) pour pré-charger de façon invisible */
  rootMargin?: string;
  /** Seuil de visibilité (0 à 1) */
  threshold?: number;
}

/**
 * Hook d'Infinite Scroll inspiré de l'architecture YouTube.
 * Détecte l'approche de la fin de liste via IntersectionObserver sans saccade.
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  rootMargin = "400px",
  threshold = 0,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin,
      threshold,
    });

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
      observer.disconnect();
    };
  }, [handleObserver, rootMargin, threshold]);

  return { sentinelRef };
}
