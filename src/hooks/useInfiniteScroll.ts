import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading?: boolean;
  rootMargin?: string;
}

/**
 * Hook for infinite scroll that uses Intersection Observer
 * Efficient: only observes one sentinel element, no scroll listener
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading = false,
  rootMargin = '500px',
}: UseInfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(isLoading);

  // Resynchronise le ref avec l'état de chargement APRÈS chaque rendu :
  // - pendant un vrai fetch, isLoading passe à true puis false → le ref suit ;
  // - pour une révélation depuis le buffer (isLoading inchangé), le parent se
  //   re-rend quand même (nouveaux items affichés) → le ref repasse à false et
  //   le scroll continue. (Un simple assignment pendant le render est refusé
  //   par react-hooks/refs.)
  useEffect(() => {
    isLoadingRef.current = isLoading;
  });

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      // Se déclenche si : visible, contenu restant, et non en cours de chargement
      if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
        // Garde synchrone : empêche un second onLoadMore dans le même batch
        // d'entries avant le prochain rendu / effet.
        isLoadingRef.current = true;
        onLoadMore();
      }
    },
    [hasMore, onLoadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
    });

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
      observer.disconnect();
    };
  }, [handleIntersection, rootMargin]);

  return { sentinelRef };
}
