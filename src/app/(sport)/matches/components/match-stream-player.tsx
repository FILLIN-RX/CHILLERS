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
import { getSportsChannels, getSportsStream } from "@/services/sports";
import { getMatchChannels, resolveOhaStream } from "@/services/oha";
import type { LiveChannel } from "@/types/live";
import type { OhaChannel } from "@/types/oha";
import { PopupFirewall } from "@/lib/PopupFirewall";
import { enterFullscreen, exitFullscreen, isFullscreenActive } from "@/lib/fullscreen";
import type { SportsServer } from "@/types/sports";

const PRIMARY = "#FF6A00";

/** Le flux retenu par la chaîne de providers backend : un seul candidat, celui qui diffuse. */
interface ResolvedMatchStream {
  url: string;
  type: "hls" | "iframe";
  relayUrl?: string;
  /** Referer à reconstituer côté proxy d'embarquement (hôtes « domain protected »). */
  referer?: string;
  provider?: string;
  name?: string;
  candidates?: ResolvedMatchStream[];
}

export interface MatchStreamPlayerProps {
  matchId: string;
  homeName: string;
  awayName: string;
  isLive?: boolean;
  /** Rencontre terminée : plus de flux ni de chaînes à proposer. */
  finished?: boolean;
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
  finished,
  minute,
  league,
  sport,
  startTime,
}: MatchStreamPlayerProps) {
  const [ohaChoice, setOhaChoice] = useState<{ ch: OhaChannel; url: string } | null>(null);
  const [ohaResolving, setOhaResolving] = useState<string | null>(null);
  const [ohaError, setOhaError] = useState<string | null>(null);
  const [candidateChoice, setCandidateChoice] = useState<{ matchId: string; index: number } | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<{ matchId: string; text: string } | null>(null);
  const failedCandidatesRef = React.useRef(new Set<string>());

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
      const sports = unified?.url ? null : await getSportsStream(matchId).catch(() => null);
      const primary = unified?.url ? unified : sports;
      if (!primary?.url) return null;

      const rawServers: SportsServer[] = Array.isArray(primary.servers) ? primary.servers : [];
      const candidates: ResolvedMatchStream[] = rawServers.length
        ? rawServers.map((server) => ({
            url: server.type === "hls" && server.relayUrl ? server.relayUrl : server.url,
            type: server.type ?? primary.type ?? "iframe",
            relayUrl: server.relayUrl,
            referer: server.referer,
            provider: server.external ? undefined : server.provider ?? primary.source ?? primary.provider,
            name: server.name,
          }))
        : [{
            url: primary.url,
            type: primary.type || "iframe",
            relayUrl: primary.relayUrl,
            referer: primary.referer,
            provider: primary.source ?? primary.provider,
          }];
      return { ...candidates[0], candidates };
    },
    staleTime: 30_000,
    enabled: !finished,
  });

  // Charge les autres serveurs en parallèle : l'affichage du premier flux ne
  // doit pas attendre la collecte complète des providers.
  const { data: backupChannels } = useQuery({
    queryKey: ["live", "match-stream-channels", matchId],
    queryFn: () => getSportsChannels(matchId),
    enabled: Boolean(stream?.url),
    staleTime: 60_000,
    retry: false,
  });

  const candidates = React.useMemo(() => {
    const list = [...(stream?.candidates ?? (stream ? [stream] : []))];
    for (const server of backupChannels?.servers ?? []) {
      const url = server.type === "hls" && server.relayUrl ? server.relayUrl : server.url;
      if (!url || list.some((item) => item.url === url || (item.relayUrl && item.relayUrl === server.relayUrl))) continue;
      list.push({
        url,
        type: server.type ?? "iframe",
        relayUrl: server.relayUrl,
        referer: server.referer,
        provider: server.provider,
        name: server.name,
      });
    }
    return list.sort((a, b) => (a.type === "hls" ? 0 : 1) - (b.type === "hls" ? 0 : 1));
  }, [backupChannels?.servers, stream]);
  const candidateIndex = candidateChoice?.matchId === matchId ? candidateChoice.index : 0;
  const activeStream = candidates[candidateIndex] ?? stream;
  const advanceCandidate = React.useCallback((reason: string) => {
    if (activeStream?.url) failedCandidatesRef.current.add(`${matchId}:${activeStream.url}`);
    if (activeStream?.provider) failedCandidatesRef.current.add(`${matchId}:provider:${activeStream.provider}`);
    const next = candidates.findIndex((candidate, index) =>
      index > candidateIndex && !failedCandidatesRef.current.has(`${matchId}:${candidate.url}`) &&
      (!candidate.provider || !failedCandidatesRef.current.has(`${matchId}:provider:${candidate.provider}`)),
    );
    if (next >= 0) {
      setCandidateChoice({ matchId, index: next });
      setPlaybackNotice({ matchId, text: `Source indisponible, passage à ${candidates[next].name || candidates[next].provider || "la source suivante"}.` });
    } else {
      setPlaybackNotice({ matchId, text: `${reason}. Aucune autre source testée n’est disponible pour ce match.` });
    }
  }, [activeStream, candidateIndex, candidates, matchId]);

  const navigateToNextCandidate = React.useCallback(() => {
    if (candidates.length < 2) return;
    const nextIndex = (candidateIndex + 1) % candidates.length;
    const nextCandidate = candidates[nextIndex];
    // A manual selection is an explicit retry, even if this source failed before.
    failedCandidatesRef.current.delete(`${matchId}:${nextCandidate.url}`);
    if (nextCandidate.provider) {
      failedCandidatesRef.current.delete(`${matchId}:provider:${nextCandidate.provider}`);
    }
    setCandidateChoice({ matchId, index: nextIndex });
    setPlaybackNotice({
      matchId,
      text: `Source ${nextIndex + 1}/${candidates.length} : ${nextCandidate.name || nextCandidate.provider || "flux suivant"}.`,
    });
  }, [candidateIndex, candidates, matchId]);

  const selectedType = activeStream?.type;

  const rawEmbedUrl = selectedType === "iframe" ? activeStream?.url : null;
  // Les hôtes « domain protected » refusent notre origine : le proxy rejoue le
  // Referer de la page qui embarque normalement le lecteur.
  const embedUrl = rawEmbedUrl
    ? /youtube\.com|youtu\.be/i.test(rawEmbedUrl)
      ? rawEmbedUrl
      : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}${
          activeStream?.referer ? `&referer=${encodeURIComponent(activeStream.referer)}` : ""
        }`
    : null;

  const channel: LiveChannel | null =
    selectedType === "hls" && activeStream
      ? {
          _id: `match-${matchId}`,
          name: `${homeName} vs ${awayName}`,
          slug: `match-${matchId}`,
          categories: ["sports"],
          type: "hls",
          streamUrl: activeStream.relayUrl || activeStream.url,
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
    enabled: !finished,
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
    if (finished) return;
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
  }, [confirmedChannels, ohaChoice, isLive, finished, startTime, matchId, playOha]);

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
  }, [activeStream?.url, ohaChoice?.ch.id]);

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
      {!finished && (confirmedChannels.length > 0 || candidateChannels.length > 0) && (
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
          ) : finished ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#1c1c1c]/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 backdrop-blur-md border border-white/10">
              <Broadcast className="h-3.5 w-3.5 text-zinc-500" />
              <span>Terminé</span>
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
        {!finished && !isLoading && ohaChannel && (
          <div className="h-full w-full">
            <LivePlayer key={`oha-${ohaChoice?.ch.id}`} channel={ohaChannel} onBack={() => {}} fill hideTopBar />
          </div>
        )}

        {/* 2b. Flux HLS actif */}
        {!finished && !isLoading && channel && !ohaChannel && (
          <div className="h-full w-full">
            <LivePlayer channel={channel} onBack={() => {}} fill hideTopBar onPlaybackError={advanceCandidate} />
          </div>
        )}

        {/* 3. Flux Iframe (Player embarqué sécurisé) */}
        {!finished && !isLoading && !channel && embedUrl && !ohaChannel && (
          <div className="h-full w-full">
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={`${homeName} vs ${awayName}`}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="no-referrer"
              onError={() => advanceCandidate("Le player intégré n’a pas pu charger la source.")}
              onLoad={(event) => {
                try {
                  const doc = event.currentTarget.contentDocument;
                  const title = doc?.title ?? "";
                  const body = doc?.body?.innerText ?? "";
                  if (/stream is offline|channel is offline|no stream|access denied|error 404/i.test(title) ||
                      (body.length < 1200 && /stream is offline|channel is offline|no stream|access denied|error 404/i.test(body))) {
                    advanceCandidate("La page du player signale un flux indisponible.");
                  }
                } catch {
                  // Le contenu imbriqué peut être cross-origin et invisible au navigateur.
                }
              }}
            />
          </div>
        )}

        {!finished && !isLoading && !ohaChannel && candidates.length > 1 && (
          <div className="absolute bottom-3 inset-x-0 z-30 flex flex-col items-center gap-2 px-3">
            {playbackNotice?.matchId === matchId && <p role="status" className="rounded-full bg-black/75 px-3 py-1.5 text-xs text-amber-200">{playbackNotice.text}</p>}
            <button
              type="button"
              onClick={navigateToNextCandidate}
              className="rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/15"
            >
              Changer de source · {(candidateIndex + 1) % candidates.length + 1}/{candidates.length}
            </button>
          </div>
        )}

        {/* 4. Aucun flux détecté, match non commencé ou terminé */}
        {!isLoading && (finished || (!ohaChannel && !channel && !embedUrl)) && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3.5 bg-[#121212] px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1c1c1c] border border-white/10 text-zinc-400">
              <Television className="h-7 w-7" style={{ color: PRIMARY }} />
            </div>

            <div className="max-w-sm space-y-1">
              <h3 className="text-[15px] font-bold text-white">
                {finished ? "Match terminé" : isLive ? "Signal vidéo en attente..." : "Diffusion programmée"}
              </h3>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                {finished
                  ? "La rencontre est terminée : le score final est affiché sur la fiche du match."
                  : isLive
                    ? "Le flux direct pour ce match n'est pas encore disponible ou est momentanément indisponible."
                    : "Le lecteur vidéo démarrera automatiquement dès le coup d'envoi de la rencontre."}
              </p>
            </div>

            {!finished && (confirmedChannels.length > 0 || candidateChannels.length > 0) && (
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
