"use client";

import { useState } from "react";
import { type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { getQueryClient } from "@/services/queryClient";
import type { ReactNode } from "react";

const PERSIST_KEY = "chillers-query-cache";
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

// Ne persister QUE les fiches stables (détail média + personne) :
// les listes de catalogue (home, search) sont volumineuses et déjà
// régénérées par le RSC — les persister ferait grossir le localStorage
// pour rien et ralentirait les écritures.
function shouldDehydrateQuery(query: Query): boolean {
  const key = query.queryKey[0];
  return key === "media-details" || key === "person-details";
}

/**
 * Provider that wraps the app tree with the singleton QueryClient.
 * Persiste les fiches déjà consultées (media/person) en localStorage : après un
 * reload, une fiche vue s'affiche instantanément puis se révalidate en arrière-plan.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  // Lazy init : côté serveur, `storage` est undefined → persister no-op
  // (l'arbre rendu est identique pendant l'hydration, pas d'effet ni de setState).
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: PERSIST_KEY,
      throttleTime: 1000,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        dehydrateOptions: { shouldDehydrateQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
