"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Television, ArrowLeft, Broadcast } from "@phosphor-icons/react";
import { getOhaChannels } from "@/services/oha";
import TvChannelsSection from "@/components/live/TvChannelsSection";

export default function LiveTvPageContent() {
  const { data: channels = [] } = useQuery({
    queryKey: ["oha", "channels"],
    queryFn: getOhaChannels,
    staleTime: 10 * 60_000,
  });

  return (
    <div className="min-h-screen bg-[#1F1F1F] text-white pt-20 sm:pt-24 pb-28 px-3 sm:px-6 md:px-10 lg:px-[5%] select-none">
      {/* ── En-tête ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <Link
            href="/live"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Live
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            TV Française <span className="text-red-500">en direct</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Généralistes · Foot &amp; Sport · Cinéma · Dessins animés · Musique
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 text-[11px] font-bold text-zinc-400 w-fit">
          <Broadcast className="w-3.5 h-3.5 text-red-500" />
          {channels.length > 0 ? `${channels.length} chaînes` : "…"}
        </span>
      </div>

      {/* ── Grille TV (composant partagé avec l'onglet de /live) ─ */}
      <TvChannelsSection />

      {/* Lien discret vers la page complète */}
      <p className="mt-10 text-center">
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
        >
          <Television className="w-3.5 h-3.5" />
          Retour aux matchs en direct
        </Link>
      </p>
    </div>
  );
}
