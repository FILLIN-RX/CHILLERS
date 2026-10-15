"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwise, Television, X, ShareNetwork, Check } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import CompetitionBadge from "@/components/CompetitionBadge";
import { MatchBackdrop, TeamCrest } from "@/components/MatchCardBackdrop";
import { getLiveBallStream, getLiveBallMatches, getLiveBallChampionsLeague } from "@/services/liveball";
import { buildAffiche, useMatchPosterIndex } from "@/hooks/useMatchPosterIndex";
import { useNow } from "@/hooks/useNow";
import { formatMatchDay, formatMatchTime } from "@/lib/match-poster";
import type { LiveChannel } from "@/types/live";
import type { LiveBallMatch } from "@/types/liveball";

export default function LiveBallMatchContent() {
  const { matchId } = useParams<{ matchId: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const title = match
      ? `${match.home} - ${match.away} · ${affiche?.competition || "Football"} · En direct sur CHILLERS`
      : "Match en direct sur CHILLERS";
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      throw new Error("no-web-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // clipboard indisponible : on ne bloque pas l'UI
      }
    }
  };

  // Verrouille le scroll de la page tant que la vue plein écran est ouverte.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevPosition;
    };
  }, []);

  const { data: matches = [] } = useQuery({
    queryKey: ["live", "liveball"],
    queryFn: () => getLiveBallMatches(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: clMatches = [] } = useQuery({
    queryKey: ["live", "liveball", "champions-league"],
    queryFn: () => getLiveBallChampionsLeague(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const match: LiveBallMatch | undefined =
    matches.find((m) => m.id === matchId) || clMatches.find((m) => m.id === matchId);

  // Affiche officielle du service de score : nom de la compétition, écusson de
  // ligue et logo de club. Retombe sur la source quand la jointure échoue.
  const { posters } = useMatchPosterIndex();
  const affiche = match ? buildAffiche(match, posters) : null;

  // La source marque le match « live » avant l'heure et n'en publie pas le coup
  // d'envoi : c'est l'heure du service de score qui décide de l'écran d'attente.
  // Tant qu'il n'est pas passé, l'affiche prime sur un flux de remplissage, et le
  // player prend la main au coup d'envoi sans rechargement de la page.
  const now = useNow(30_000);
  const kickoff = affiche?.startTs;
  const preMatch = Boolean(kickoff && kickoff * 1000 > now);
  const isUpcoming = preMatch || match?.status === "upcoming";
  const isLive = match?.status === "live";

  const { data: stream, isLoading, refetch } = useQuery({
    queryKey: ["live", "liveball", "stream", matchId, reloadKey],
    queryFn: () => getLiveBallStream(matchId),
    staleTime: 0,
    retry: false,
    // Tant que le flux n'existe pas encore (match à venir / indispo),
    // on re-vérifie régulièrement pour démarrer dès que la diffusion arrive.
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });

  const isInvalidEmbed = (url: string | null | undefined) => {
    if (!url) return true;
    return /liveball\.(sx|im|to|net|org|com)/i.test(url) || url.includes('/match/') || /1xbet|melbet|betting/i.test(url);
  };

  // Deux types de flux renvoyés par le backend :
  //  - "hls"    → l'URL m3u8 est jouée dans le lecteur natif (LivePlayer).
  //  - "iframe" → l'URL est un player propre à embarquer (pas la page du site).
  //    Passé par /api/live/embed-proxy comme sur les pages live/sp et matches :
  //    le proxy réécrit le HTML (pubs / popups / redirections retirées).
  const rawEmbedUrl = stream?.type === "iframe" && !isInvalidEmbed(stream.url) ? stream.url : null;
  const embedUrl = rawEmbedUrl
    ? /youtube\.com|youtu\.be/i.test(rawEmbedUrl)
      ? rawEmbedUrl
      : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}`
    : null;

  // Construit un pseudo-canal HLS à partir du match pour alimenter LivePlayer
  // (uniquement pour les flux natifs m3u8). streamUrl passe par NOTRE relay HLS
  // (/hls/playlist.m3u8) : le backend rapatrie playlists + segments, donc le CDN
  // liveball ne voit que notre serveur (jeton lié à l'IP) et le navigateur reste
  // en same-origin (pas de CORS).
  const channel: LiveChannel | null = stream?.type === "hls"
    ? {
        _id: `lb-${matchId}`,
        name: match ? `${match.home} - ${match.away}` : `Match #${matchId}`,
        slug: `lb-${matchId}`,
        categories: ["sports"],
        type: "hls",
        streamUrl: `/api/liveball/match/${matchId}/hls/playlist.m3u8`,
        enabled: true,
        order: 0,
        isOnline: true,
      }
    : null;

  const retry = () => {
    setReloadKey((k) => k + 1);
    refetch();
  };

  return (
    <div className="fixed inset-0 z-40 h-dvh w-screen bg-black overflow-hidden">
      {isLoading && !channel && !embedUrl && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black">
          <div className="h-12 w-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Résolution du flux...
          </p>
        </div>
      )}

      {/* ── Match à venir : pas encore commencé ─────────────────────── */}
      {!isLoading && isUpcoming && (preMatch || !stream) && match && (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <MatchBackdrop home={match.home} away={match.away} />

          <div className="relative z-10 h-full flex flex-col">
            {/* Bandeau haut : état (direct / coup d'envoi) + compétition */}
            <div className="flex items-start justify-between gap-3 p-4 sm:p-6 pt-[calc(1rem_+_env(safe-area-inset-top,0px))]">
              <span className="inline-flex items-center gap-1.5 shrink-0 rounded-[5px] bg-black/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white tabular-nums">
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                {isLive
                  ? match.minute
                    ? `Direct · ${match.minute}`
                    : "Direct"
                  : kickoff
                    ? `${formatMatchDay(kickoff)} · ${formatMatchTime(kickoff)}`
                    : "À venir"}
              </span>
              <div className="min-w-0 flex justify-end">
                <CompetitionBadge competition={affiche?.competition ?? null} logo={affiche?.competitionLogo} />
              </div>
            </div>

            {/* Centre : écussons, noms, score */}
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="flex items-center justify-center gap-6 sm:gap-14">
                <TeamCrest src={affiche?.homeLogo ?? match.homeLogo} alt={match.home} size="lg" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/40 border border-white/15 flex items-center justify-center text-lg sm:text-xl font-black text-white shrink-0">
                  VS
                </div>
                <TeamCrest src={affiche?.awayLogo ?? match.awayLogo} alt={match.away || "?"} size="lg" />
              </div>

              <div className="space-y-1">
                <h1 className="text-xl sm:text-3xl font-black text-white leading-tight">
                  {match.home}
                  {match.away ? ` — ${match.away}` : ""}
                </h1>
                {isLive && match.score && (
                  <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{match.score}</p>
                )}
              </div>

              <p className="max-w-md text-sm text-zinc-300 leading-relaxed">
                {kickoff ? (
                  <>
                    Diffusion programmée pour <span className="text-white font-bold">{formatMatchDay(kickoff)}</span> à{" "}
                    <span className="text-white font-bold tabular-nums">{formatMatchTime(kickoff)}</span>. La lecture
                    démarrera au coup d&apos;envoi.
                  </>
                ) : (
                  <>La lecture démarrera automatiquement au coup d&apos;envoi.</>
                )}
              </p>
            </div>

            {/* Bas : actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 px-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))]">
              <button
                onClick={retry}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-primary hover:brightness-110 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <ArrowsClockwise className="h-4 w-4" />
                Actualiser
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                {shareCopied ? <Check className="h-4 w-4 text-brand-primary" /> : <ShareNetwork className="h-4 w-4" />}
                {shareCopied ? "Lien copié" : "Partager"}
              </button>
              <Link
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour aux directs
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Aucun flux détecté (habillage carte Apple TV) ──────────── */}
      {!isLoading && !stream && !isUpcoming && (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <MatchBackdrop home={match?.home} away={match?.away} />

          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="h-20 w-20 rounded-full bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shadow-2xl">
              <Television className="h-10 w-10" />
            </div>

            <div className="max-w-lg space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                Flux vidéo non détecté
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {match ? (
                  <>
                    La diffusion directe pour <strong className="text-white">{match.home} vs {match.away}</strong> n&apos;est pas encore disponible ou le signal source est momentanément interrompu.
                  </>
                ) : (
                  "Aucun flux vidéo direct actif n'a pu être extrait pour cette rencontre."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={retry}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-primary hover:brightness-110 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/20"
              >
                <ArrowsClockwise className="h-4 w-4" />
                Réessayer la connexion
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                {shareCopied ? <Check className="h-4 w-4 text-brand-primary" /> : <ShareNetwork className="h-4 w-4" />}
                {shareCopied ? "Lien copié" : "Partager"}
              </button>
              <Link
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour aux directs
              </Link>
            </div>

            <p className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              Nouvelle tentative automatique de détection du signal toutes les 30s
            </p>
          </div>
        </div>
      )}

      {/* ── Flux au format "player à embarquer" (iframe directe sans pub) ────────────── */}
      {embedUrl && !preMatch && (
        <div className="absolute inset-0 bg-black">
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={match ? `${match.home} - ${match.away} · En direct` : "Match en direct"}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* ── Flux natif HLS via LivePlayer ────────────────────────────── */}
      {channel && !preMatch && (
        <div className="absolute inset-0">
          <LivePlayer channel={channel} fill onBack={() => (window.location.href = "/live")} />
        </div>
      )}
    </div>
  );
}