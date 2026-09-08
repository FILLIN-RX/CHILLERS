"use client";

import Link from "next/link";
import { WifiSlash, DownloadSimple, ArrowsClockwise } from "@phosphor-icons/react";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 animate-pulse">
        <WifiSlash className="w-10 h-10" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
        Vous êtes hors-ligne
      </h1>

      <p className="text-sm text-zinc-400 max-w-md mb-8 leading-relaxed">
        Vérifiez votre connexion internet. Vous pouvez continuer à visionner tous les films et séries que vous avez téléchargés sur votre appareil.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <Link
          href="/downloads"
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-sm transition-all shadow-lg active:scale-95"
        >
          <DownloadSimple className="w-4 h-4 stroke-[2.5]" />
          <span>Accéder à mes téléchargements</span>
        </Link>

        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm transition-all"
        >
          <ArrowsClockwise className="w-4 h-4" />
          <span>Réessayer</span>
        </button>
      </div>
    </main>
  );
}
