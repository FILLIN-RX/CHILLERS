"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowsOutSimple,
  ArrowsInSimple,
  Broadcast,
  Television,
} from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import MatchChannelsRow from "@/components/live/MatchChannelsRow";
import { getMatchStream } from "@/services/matches";
import { getSportsStream } from "@/services/sports";
import { getMatchChannels, resolveOhaStream } from "@/services/oha";
import type { LiveChannel } from "@/types/live";
import type { OhaChannel } from "@/types/oha";
import { PopupFirewall } from "@/lib/PopupFirewall";
import { enterFullscreen, exitFullscreen, isFullscreenActive } from "@/lib/fullscreen";

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
  /** Compétition, sport et coup d'envoi : vérifie l'EPG des chaînes. */
  league?: string;
  sport?: string;
  startTime?: string;
}

export function MatchStreamPlayer({
  matchId,
  homeName,
  awayName,
  isLive,
  minute,
  league,
  sport,
  startTime,
}: MatchStreamPlayerProps) {
  const [ohaChoice, setOhaChoice] = useState<{ ch: OhaChannel; url: string } | null>(null);
  const [ohaResolving, setOhaResolving] = useState<string | null>(null);
  const [ohaError, setOhaError] = useState<string | null>(null);

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
  } = useQuery({
    queryKey: ["live", "match-stream", matchId],
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

  // Chaînes CHILLERS qui diffusent ce match : proposées avant les sources
  // externes (droits TV France 2026-2027).
  const { data: matchChannelStatuses = [] } = useQuery({
    queryKey: ["oha", "match-channels", sport, league, homeName, awayName, startTime],
    queryFn: () =>
      getMatchChannels({
        sport: sport ?? "football",
        league,
        home: homeName,
        away: awayName,
        start: startTime,
      }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const confirmedChannels = React.useMemo(
    () => matchChannelStatuses.filter((s) => s.confirmed).map((s) => s.channel),
    [matchChannelStatuses],
  );
  const candidateChannels = React.useMemo(
    () => matchChannelStatuses.filter((s) => !s.confirmed).map((s) => s.channel),
    [matchChannelStatuses],
  );

  const playOha = React.useCallback(
    async (ch: OhaChannel, opts?: { silent?: boolean }): Promise<boolean> => {
      if (ohaResolving) return false;
      setOhaError(null);
      setOhaResolving(ch.id);
      try {
        const url = await resolveOhaStream(ch.id, ch.altIds ?? []);
        setOhaChoice({ ch, url });
        return true;
      } catch {
        if (!opts?.silent) setOhaError(`Lien ${ch.name} momentanément indisponible.`);
        return false;
      } finally {
        setOhaResolving(null);
      }
    },
    [ohaResolving],
  );

  const confirmedIds = React.useMemo(
    () => confirmedChannels.map((c) => c.id),
    [confirmedChannels],
  );

  // Sélection automatique : la première chaîne confirmée par l'EPG prend la main
  // dès le coup d'envoi (repli sur les autres chaînes confirmées, puis sources).
  const autoTriedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const first = confirmedChannels[0];
    if (!first || ohaChoice) return;
    const key = `${matchId}:${first.id}`;
    if (autoTriedRef.current === key) return;

    const startMs = startTime ? Date.parse(startTime) : Number.NaN;
    const reached =
      isLive || (Number.isFinite(startMs) && Date.now() >= startMs - 5 * 60_000);
    if (!reached) return;

    autoTriedRef.current = key;
    let cancelled = false;
    void (async () => {
      for (const ch of confirmedChannels) {
        if (cancelled) return;
        if (await playOha(ch, { silent: true })) return;
      }
      if (!cancelled) {
        setOhaError("Chaîne confirmée indisponible — autres sources conservées.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmedChannels, ohaChoice, isLive, startTime, matchId, playOha]);

  const ohaChannel: LiveChannel | null = ohaChoice
    ? {
        _id: `oha-match-${ohaChoice.ch.id}`,
        name: ohaChoice.ch.name,
        slug: `oha-${ohaChoice.ch.id}`,
        logo: ohaChoice.ch.logo ?? undefined,
        categories: ["sports"],
        type: "hls",
        streamUrl: ohaChoice.url,
        enabled: true,
        order: 0,
        isOnline: true,
        proxy: true,
      }
    : null;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(isFullscreenActive());
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    const video = containerRef.current?.querySelector("video");
    video?.addEventListener("webkitbeginfullscreen", syncFullscreen);
    video?.addEventListener("webkitendfullscreen", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
      video?.removeEventListener("webkitbeginfullscreen", syncFullscreen);
      video?.removeEventListener("webkitendfullscreen", syncFullscreen);
    };
  }, [stream?.url, ohaChoice?.ch.id]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (isFullscreen || isFullscreenActive()) {
      await exitFullscreen(containerRef.current.querySelector("video")).catch(() => {});
    } else {
      const video = containerRef.current.querySelector("video");
      const entered = await enterFullscreen(containerRef.current, video);
      setIsFullscreen(entered);
    }
  };

  return (
    <div id="stream-player" className="w-full space-y-3">
      {/* Sélecteur unique : chaînes (confirmées d'abord) puis sources externes */}
      {(confirmedChannels.length > 0 || candidateChannels.length > 0) && (
        <div className="space-y-2 rounded-xl bg-[#161616] border border-white/10 p-3">
          <MatchChannelsRow
            channels={[...confirmedChannels, ...candidateChannels]}
            confirmedIds={confirmedIds}
            selectedId={ohaChoice?.ch.id ?? null}
            resolvingId={ohaResolving}
            onSelect={playOha}
            onExternal={() => {
              setOhaChoice(null);
              setOhaError(null);
            }}
            externalActive={!ohaChoice}
            hint={confirmedChannels.length > 0 ? "Sélection automatique (EPG)" : "D'après les droits TV"}
            variant="light"
          />
          {ohaError && <p className="px-1 text-[11px] text-red-300">{ohaError}</p>}
        </div>
      )}

      {/* Conteneur principal du Lecteur vidéo 16:9 */}
      <div
        ref={containerRef}
        className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-[#0e0e0e] border border-[#222222] ${isFullscreen ? "fixed inset-0 z-[9999] h-dvh w-screen aspect-auto rounded-none border-0" : ""}`}
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

        {/* Bouton plein écran */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)]">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-zinc-300 backdrop-blur-md border border-white/10 transition-colors hover:bg-black/90 hover:text-white"
          >
            {isFullscreen ? <ArrowsInSimple className="h-5 w-5" /> : <ArrowsOutSimple className="h-5 w-5" />}
          </button>
        </div>

        {/* 1. Écran de chargement */}
        {isLoading && !channel && !embedUrl && !ohaChannel && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0d0d0d] text-center px-4">
            <div
              className="h-10 w-10 animate-spin rounded-full border-3 border-t-transparent"
              style={{ borderColor: `${PRIMARY} transparent transparent transparent` }}
            />
            <p className="text-[13px] font-semibold text-zinc-300">Recherche du flux vidéo en direct...</p>
            <p className="text-[11px] text-zinc-500">Connexion à la source de diffusion</p>
          </div>
        )}

        {/* 2. Chaîne CHILLERS sélectionnée */}
        {!isLoading && ohaChannel && (
          <div className="h-full w-full">
            <LivePlayer key={`oha-${ohaChoice?.ch.id}`} channel={ohaChannel} onBack={() => {}} fill hideTopBar />
          </div>
        )}

        {/* 2b. Flux HLS actif */}
        {!isLoading && channel && !ohaChannel && (
          <div className="h-full w-full">
            <LivePlayer channel={channel} onBack={() => {}} fill hideTopBar />
          </div>
        )}

        {/* 3. Flux Iframe (Player embarqué sécurisé) */}
        {!isLoading && !channel && embedUrl && !ohaChannel && (
          <div className="h-full w-full">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={`${homeName} vs ${awayName}`}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* 4. Aucun flux détecté ou match non commencé */}
        {!isLoading && !channel && !embedUrl && !ohaChannel && (
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

            {(confirmedChannels.length > 0 || candidateChannels.length > 0) && (
              <div className="w-full max-w-sm space-y-2 rounded-xl bg-white/5 border border-white/10 p-2.5">
                {confirmedChannels.length > 0 && (
                  <MatchChannelsRow
                    channels={confirmedChannels}
                    selectedId={null}
                    resolvingId={ohaResolving}
                    onSelect={playOha}
                    label="En direct sur nos chaînes"
                  />
                )}
                {candidateChannels.length > 0 && (
                  <MatchChannelsRow
                    channels={candidateChannels}
                    selectedId={null}
                    resolvingId={ohaResolving}
                    onSelect={playOha}
                    label={confirmedChannels.length > 0 ? "Autres chaînes possibles" : "Regarder sur nos chaînes"}
                  />
                )}
                {ohaError && <p className="px-1 text-[11px] text-red-300">{ohaError}</p>}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
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
