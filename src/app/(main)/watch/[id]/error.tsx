"use client";

import RouteError from "@/components/RouteError";

export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Le lecteur a rencontré un problème"
      subtitle="La vidéo n'a pas pu démarrer. Vérifie ta connexion ou réessaie."
      retryLabel="Recharger le lecteur"
    />
  );
}
