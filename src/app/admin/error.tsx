"use client";

import RouteError from "@/components/RouteError";

export default function AdminError({
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
      title="Erreur d'administration"
      subtitle="Une action admin a échoué. Réessaie ou reviens au tableau de bord."
      retryLabel="Réessayer"
    />
  );
}
