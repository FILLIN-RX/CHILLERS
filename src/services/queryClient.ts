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
        // High resilience on slow or intermittent mobile networks
        networkMode: "offlineFirst",
        staleTime: 5 * 60_000, // 5 min cache
        gcTime: 30 * 60_000,   // 30 min garbage collection
        retry: 3,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
      },
      mutations: {
        networkMode: "offlineFirst",
        retry: 1,
      },
    },
  });
  return _client;
}