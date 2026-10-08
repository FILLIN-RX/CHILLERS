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
import { getSportsMatches, getSportsStream } from "@/services/sports";
import { getLiveBallMatches, getLiveBallStream, getLiveBallChampionsLeague } from "@/services/liveball";
import type { LiveChannel } from "@/types/live";
import { PopupFirewall } from "@/lib/PopupFirewall";

const PRIMARY = "#FF6A00";

/** Le flux réellement servi pour ce match : un seul candidat, celui qui répond. */
interface ResolvedMatchStream {
  url: string;
  type: "hls" | "iframe";
  relayUrl?: string;
}

function normalizeTeamName(name?: string): string {
  if (!name) return "";
  let s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/\bparis\s+saint[- ]germain\b/g, "psg");
  s = s.replace(/\bmanchester\s+city\b/g, "mancity");
  s = s.replace(/\bmanchester\s+united\b/g, "manunited");
  s = s.replace(/\batletico\s+madrid\b/g, "atleticomadrid");
  s = s.replace(/\breal\s+madrid\b/g, "realmadrid");
  s = s.replace(/\bbayern\s+munich\b/g, "bayernmunich");
  s = s.replace(/\bbayern\s+münchen\b/g, "bayernmunich");
  s = s.replace(/\bborussia\s+dortmund\b/g, "dortmund");
  s = s.replace(/\b(fc|cf|sc|ac|as|rc|us|afc|ssc|cd|club|de|united|city|hotspur|sporting)\b/g, "");
  s = s.replace(/[^a-z0-9]/g, "");
  return s.trim();
}

function areTeamsMatching(h1?: string, a1?: string, h2?: string, a2?: string): boolean {
  const normH1 = normalizeTeamName(h1);
  const normA1 = normalizeTeamName(a1);
  const normH2 = normalizeTeamName(h2);
  const normA2 = normalizeTeamName(a2);
  if (!normH1 || !normH2) return false;
  return (
    (normH1.includes(normH2) || normH2.includes(normH1)) &&
    (!normA1 || !normA2 || normA1.includes(normA2) || normA2.includes(normA1))
  );
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

  // 1. Récupération des listes de flux disponibles (Sports & LiveBall)
  const { data: sportsMatches = [] } = useQuery({
    queryKey: ["live", "sports"],
    queryFn: () => getSportsMatches(),
    staleTime: 60_000,
  });

  const { data: liveballMatches = [] } = useQuery({
    queryKey: ["live", "liveball"],
    queryFn: () => getLiveBallMatches(),
    staleTime: 60_000,
  });

  const { data: clMatches = [] } = useQuery({
    queryKey: ["live", "liveball", "champions-league"],
    queryFn: () => getLiveBallChampionsLeague(),
    staleTime: 60_000,
  });

  const allLbMatches = [...liveballMatches, ...clMatches];

  // Association avec l'un des matchs streamés par nom d'équipe
  const matchedLb = allLbMatches.find((lb) => areTeamsMatching(homeName, awayName, lb.home, lb.away));
  const matchedSports = sportsMatches.find((sm) => areTeamsMatching(homeName, awayName, sm.home, sm.away));

  // 2. Récupération du flux vidéo concret (priorité à la route unifiée /api/matches/:id/stream)
  const {
    data: stream,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["live", "match-stream", matchId, matchedLb?.id, matchedSports?.id, reloadKey],
    queryFn: async (): Promise<ResolvedMatchStream | null> => {
      // 1. Appel de l'endpoint unifié Backend Option A : il a déjà résolu le flux
      const unified = await getMatchStream(matchId).catch(() => null);
      if (unified?.url) {
        return {
          url: unified.url,
          type: unified.type || "iframe",
          relayUrl: unified.relayUrl,
        };
      }

      // 2. Recherche directe de secours côté client
      const [lbRes, spRes] = await Promise.allSettled([
        matchedLb?.id ? getLiveBallStream(matchedLb.id) : Promise.resolve(null),
        matchedSports?.id ? getSportsStream(matchedSports.id) : Promise.resolve(null),
      ]);

      const lbStream = lbRes.status === "fulfilled" ? lbRes.value : null;
      const spStream = spRes.status === "fulfilled" ? spRes.value : null;

      const candidates: ResolvedMatchStream[] = [];

      if (lbStream?.url && matchedLb?.id) {
        candidates.push({
          url: lbStream.url,
          type: lbStream.type,
          relayUrl:
            lbStream.type === "hls"
              ? `/api/liveball/match/${matchedLb.id}/hls/playlist.m3u8`
              : undefined,
        });
      }

      if (spStream?.url) {
        const mirror = spStream.servers?.[0];
        candidates.push({
          url: mirror?.url ?? spStream.url,
          type: (mirror?.type ?? spStream.type) || "iframe",
          relayUrl: mirror?.relayUrl ?? spStream.relayUrl,
        });
      }

      return candidates[0] ?? null;
    },
    staleTime: 30_000,
  });

  const selectedType = stream?.type;

  const rawEmbedUrl = selectedType === "iframe" ? stream?.url : null;
  const embedUrl = rawEmbedUrl
    ? /youtube\.com|youtu\.be/i.test(rawEmbedUrl)
      ? rawEmbedUrl
      : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}`
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
