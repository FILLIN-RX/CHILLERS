"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/services/queryClient";
import type { ReactNode } from "react";

/**
 * Client-only provider that wraps the (main) layout tree with the singleton QueryClient.
 * Use as: <QueryProvider>{children}</QueryProvider>
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}