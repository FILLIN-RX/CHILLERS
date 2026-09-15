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
  const isLoadingRef = useRef(false);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      // Only trigger if: visible, has more content, not currently loading
      if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
        isLoadingRef.current = true;
        onLoadMore();
      }
    },
    [hasMore, onLoadMore]
  );

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

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
