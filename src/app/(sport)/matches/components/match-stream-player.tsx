"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowsClockwise,
  ArrowsOutSimple,
  Broadcast,
  Television,
} from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import { getMatchStream } from "@/services/matches";
import { getSportsStream } from "@/services/sports";
import type { LiveChannel } from "@/types/live";
import { PopupFirewall } from "@/lib/PopupFirewall";

const PRIMARY = "#FF6A00";

/** Le flux retenu par la chaîne de providers backend : un seul candidat, celui qui diffuse. */
interface ResolvedMatchStream {
  url: string;
  type: "hls" | "iframe";
  relayUrl?: string;
  /** Referer à reconstituer côté proxy d'embarquement (hôtes « domain protected »). */
  referer?: string;
  provider?: string;
}

export interface MatchStreamPlayerProps {
  matchId: string;
  homeName: string;
  awayName: string;
  isLive?: boolean;
  minute?: string;
}

export function MatchStreamPlayer({
  matchId,
  homeName,
  awayName,
  isLive,
  minute,
}: MatchStreamPlayerProps) {
  const [reloadKey, setReloadKey] = useState(0);

  // Active le pare-feu anti-pub pour sécuriser les iframes de flux
  useEffect(() => {
    PopupFirewall.activate();
    return () => {
      PopupFirewall.deactivate();
    };
  }, []);

  // Flux du match : le backend chaîne les sources (LiveBall, Kora, Kooorah,
  // YallaPro, Streamiz) et ne renvoie que celle qui diffuse réellement.
  const {
    data: stream,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["live", "match-stream", matchId, reloadKey],
    queryFn: async (): Promise<ResolvedMatchStream | null> => {
      const unified = await getMatchStream(matchId).catch(() => null);
      if (unified?.url) {
        return {
          url: unified.url,
          type: unified.type || "iframe",
          relayUrl: unified.relayUrl,
          referer: unified.referer ?? unified.servers?.[0]?.referer,
          provider: unified.source,
        };
      }

      const sports = await getSportsStream(matchId).catch(() => null);
      if (!sports?.url) return null;

      const server = sports.servers?.[0];
      return {
        url: sports.url,
        type: server?.type ?? sports.type ?? "iframe",
        relayUrl: server?.relayUrl ?? sports.relayUrl,
        referer: server?.referer ?? sports.referer,
        provider: sports.provider,
      };
    },
    staleTime: 30_000,
  });

  const selectedType = stream?.type;

  const rawEmbedUrl = selectedType === "iframe" ? stream?.url : null;
  // Les hôtes « domain protected » refusent notre origine : le proxy rejoue le
  // Referer de la page qui embarque normalement le lecteur.
  const embedUrl = rawEmbedUrl
    ? /youtube\.com|youtu\.be/i.test(rawEmbedUrl)
      ? rawEmbedUrl
      : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}${
          stream?.referer ? `&referer=${encodeURIComponent(stream.referer)}` : ""
        }`
    : null;

  const channel: LiveChannel | null =
    selectedType === "hls" && stream
      ? {
          _id: `match-${matchId}`,
          name: `${homeName} vs ${awayName}`,
          slug: `match-${matchId}`,
          categories: ["sports"],
          type: "hls",
          streamUrl: stream.relayUrl || stream.url,
          enabled: true,
          order: 0,
          isOnline: true,
        }
      : null;

  const handleRetry = useCallback(() => {
    setReloadKey((k) => k + 1);
    refetch();
  }, [refetch]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div id="stream-player" className="w-full">
      {/* Conteneur principal du Lecteur vidéo 16:9 */}
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#0e0e0e] border border-[#222222] shadow-2xl"
      >
        {/* Badge Live / Statut en superposition */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
          {isLive ? (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-lg uppercase tracking-wider"
              style={{ background: PRIMARY }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span>{minute || "En direct"}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-[#1c1c1c]/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 backdrop-blur-md border border-white/10">
              <Broadcast className="h-3.5 w-3.5 text-[#FF6A00]" />
              <span>Flux match</span>
            </span>
          )}
        </div>

        {/* Boutons de contrôle (Actualiser + Plein écran) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)]">
          <button
            onClick={handleRetry}
            title="Actualiser le flux"
            aria-label="Actualiser le flux"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-zinc-300 backdrop-blur-md border border-white/10 transition-colors hover:bg-black/90 hover:text-white"
          >
            <ArrowsClockwise className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={toggleFullscreen}
            title="Plein écran"
            aria-label="Plein écran"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-zinc-300 backdrop-blur-md border border-white/10 transition-colors hover:bg-black/90 hover:text-white"
          >
            <ArrowsOutSimple className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Écran de chargement */}
        {isLoading && !channel && !embedUrl && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0d0d0d] text-center px-4">
            <div
              className="h-10 w-10 animate-spin rounded-full border-3 border-t-transparent"
              style={{ borderColor: `${PRIMARY} transparent transparent transparent` }}
            />
            <p className="text-[13px] font-semibold text-zinc-300">Recherche du flux vidéo en direct...</p>
            <p className="text-[11px] text-zinc-500">Connexion à la source de diffusion</p>
          </div>
        )}

        {/* 2. Flux HLS actif */}
        {!isLoading && channel && (
          <div className="h-full w-full">
            <LivePlayer channel={channel} onBack={() => {}} fill hideTopBar />
          </div>
        )}

        {/* 3. Flux Iframe (Player embarqué sécurisé) */}
        {!isLoading && !channel && embedUrl && (
          <div className="h-full w-full">
            <iframe
              key={`${embedUrl}-${reloadKey}`}
              src={embedUrl}
              title={`${homeName} vs ${awayName}`}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* 4. Aucun flux détecté ou match non commencé */}
        {!isLoading && !channel && !embedUrl && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3.5 bg-[#121212] px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1c1c1c] border border-white/10 text-zinc-400">
              <Television className="h-7 w-7" style={{ color: PRIMARY }} />
            </div>

            <div className="max-w-sm space-y-1">
              <h3 className="text-[15px] font-bold text-white">
                {isLive ? "Signal vidéo en attente..." : "Diffusion programmée"}
              </h3>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                {isLive
                  ? "Le flux direct pour ce match n'est pas encore disponible ou est momentanément indisponible."
                  : "Le lecteur vidéo démarrera automatiquement dès le coup d'envoi de la rencontre."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-white transition-all shadow-md"
                style={{ background: PRIMARY }}
              >
                <ArrowsClockwise className="h-3.5 w-3.5" />
                <span>Vérifier le signal</span>
              </button>

              <Link
                href="/live"
                className="flex items-center gap-1.5 rounded-full bg-[#222222] hover:bg-[#2b2b2b] px-4 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white transition-all border border-white/5"
              >
                <Television className="h-3.5 w-3.5 text-[#FF6A00]" />
                <span>Chaînes TV</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
