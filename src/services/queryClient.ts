// Singleton QueryClient configuration. Use in:
//   <QueryClientProvider client={getQueryClient()}>
//
// We lazily instantiate so SSR never reuses an instance across requests.

import { QueryClient } from "@tanstack/react-query";

let _client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (_client) return _client;
  _client = new QueryClient({
    defaultOptions: {
      queries: {
        // Server-rendered pages don't need to refetch on mount for SEO-friendly data.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        // We use our own AbortController pattern in service functions; let TanStack Query
        // abort in-flight requests on unmount by default.
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
      mutations: {
        retry: 0,
      },
    },
  });
  return _client;
}