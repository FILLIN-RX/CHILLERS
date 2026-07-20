"use client";

import { useEffect } from "react";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  // Optional title/subtitle override so each route group can personalise the
  // fallback. Defaults are French ("Une erreur est survenue").
  title?: string;
  subtitle?: string;
  retryLabel?: string;
}

// Shared error UI for every route group's error.tsx. Centralising the markup
// means a child exception in any segment shows a recovery affordance instead
// of crashing the whole route tree (P2-#16).
export default function RouteError({
  error,
  reset,
  title = "Une erreur est survenue",
  subtitle = "Le service est temporairement indisponible. Réessaie ou reviens plus tard.",
  retryLabel = "Réessayer",
}: RouteErrorProps) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="text-3xl text-zinc-500">!</span>
        </div>
        <h1 className="text-white text-xl font-bold">{title}</h1>
        <p className="text-zinc-400 text-sm">{subtitle}</p>
        <button
          onClick={() => reset()}
          className="mt-2 px-6 py-3 rounded-full bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 transition-all"
        >
          {retryLabel}
        </button>
      </div>
    </div>
  );
}
