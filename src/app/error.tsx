"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <span className="text-3xl text-zinc-500">!</span>
        </div>
        <h1 className="text-white text-xl font-bold">Une erreur est survenue</h1>
        <p className="text-zinc-400 text-sm">
          Le service est temporairement indisponible. Réessaie ou reviens plus tard.
        </p>
        <button
          onClick={() => reset()}
          className="mt-2 px-6 py-3 rounded-full bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 transition-all"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
