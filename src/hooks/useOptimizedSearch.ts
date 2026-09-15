import { useState, useCallback, useRef, useEffect } from 'react';

interface SearchResult {
  id: string;
  title: string;
  posterUrl: string;
  type: 'movie' | 'series' | 'anime';
  rating?: number;
}

interface UseOptimizedSearchProps {
  onSearch: (query: string) => Promise<SearchResult[]>;
  debounceMs?: number;
  cacheSize?: number;
}

/**
 * Optimized search hook with:
 * - Request debouncing (300ms default)
 * - LRU result caching (50 queries)
 * - Request cancellation on unmount
 * - Loading state & error handling
 */
export function useOptimizedSearch({
  onSearch,
  debounceMs = 300,
  cacheSize = 50,
}: UseOptimizedSearchProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController>(new AbortController());
  const cache = useRef<Map<string, SearchResult[]>>(new Map());
  const requestInFlight = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      abortController.current.abort();
    };
  }, []);

  const search = useCallback(
    (query: string) => {
      // Clear previous timer
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      // Abort previous request if different query
      if (requestInFlight.current && requestInFlight.current !== query) {
        abortController.current.abort();
        abortController.current = new AbortController();
      }

      // Empty query = empty results
      if (!query.trim()) {
        setResults([]);
        setError(null);
        requestInFlight.current = null;
        return;
      }

      // Check cache first
      const cacheKey = query.toLowerCase();
      if (cache.current.has(cacheKey)) {
        setResults(cache.current.get(cacheKey)!);
        setError(null);
        requestInFlight.current = null;
        return;
      }

      // Debounce the API call
      setIsLoading(true);
      requestInFlight.current = query;

      debounceTimer.current = setTimeout(async () => {
        try {
          const data = await onSearch(query);

          // Only update if this is still the latest request
          if (requestInFlight.current === query) {
            setResults(data);
            setError(null);

            // Add to cache (LRU eviction if cache is full)
            if (cache.current.size >= cacheSize) {
              const firstKey = cache.current.keys().next().value;
              if (firstKey) cache.current.delete(firstKey);
            }
            cache.current.set(cacheKey, data);
          }
        } catch (err) {
          // Ignore abort errors
          if (err instanceof DOMException && err.name === 'AbortError') return;
          
          if (requestInFlight.current === query) {
            setError(err instanceof Error ? err.message : 'Search failed');
            setResults([]);
          }
        } finally {
          if (requestInFlight.current === query) {
            setIsLoading(false);
            requestInFlight.current = null;
          }
        }
      }, debounceMs);
    },
    [debounceMs, cacheSize, onSearch]
  );

  return { results, isLoading, error, search };
}
