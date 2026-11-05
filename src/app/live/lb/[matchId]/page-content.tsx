"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Television, X } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import HalftimeAdPod from "@/components/matches/HalftimeAdPod";
import CompetitionBadge from "@/components/CompetitionBadge";
import MatchShareButton from "@/components/live/MatchShareButton";
import FollowMatchButton from "@/components/live/FollowMatchButton";
import { MatchBackdrop, TeamCrest } from "@/components/MatchCardBackdrop";
import { getLiveBallStream, getLiveBallMatches, getLiveBallChampionsLeague } from "@/services/liveball";
import { getSportsStream } from "@/services/sports";
import { getMatchById, getMatchStream } from "@/services/matches";
import { buildAffiche, useMatchPosterIndex } from "@/hooks/useMatchPosterIndex";
import { useLiveScores } from "@/hooks/useLiveScores";
import { useNow } from "@/hooks/useNow";
import { formatMatchDay, formatMatchTime } from "@/lib/match-poster";
import type { LiveChannel } from "@/types/live";
import type { SportsMatch } from "@/types/sports";

export default function LiveBallMatchContent() {
  const { matchId } = useParams<{ matchId: string }>();

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
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const { data: clMatches = [] } = useQuery({
    queryKey: ["live", "liveball", "champions-league"],
    queryFn: () => getLiveBallChampionsLeague(),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  // LiveBall retire la rencontre de ses listings une fois le match fini — un
  // lien partagé serait alors orphelin. On reconstitue depuis l'API de scores
  // quand la source d'origine n'a plus rien.
  const { data: espnMatch } = useQuery({
    queryKey: ["live", "espn", "match", matchId],
    queryFn: () => getMatchById(matchId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const displayMatch = useMemo<SportsMatch | undefined>(() => {
    if (!espnMatch) return undefined;
    const home = espnMatch.homeTeam?.name;
    const away = espnMatch.awayTeam?.name;
    if (!home || !away) return undefined;
    const ts = Date.parse(espnMatch.startTime);
    const homeScore = espnMatch.homeTeam?.score;
    const awayScore = espnMatch.awayTeam?.score;
    return {
      id: `espn:${espnMatch.id}`,
      sourceId: espnMatch.id,
      source: "espn",
      status:
        espnMatch.status === "live" ? "live" : espnMatch.status === "finished" ? "finished" : "upcoming",
      home,
      away,
      homeLogo: espnMatch.homeTeam?.logo,
      awayLogo: espnMatch.awayTeam?.logo,
      score:
        homeScore !== undefined && homeScore !== null && awayScore !== undefined && awayScore !== null
          ? `${homeScore} - ${awayScore}`
          : undefined,
      minute: espnMatch.minute,
      statusText: espnMatch.statusText,
      startTs: Number.isFinite(ts) ? Math.floor(ts / 1000) : undefined,
      league: espnMatch.league?.name,
    };
  }, [espnMatch]);

  const lbMatch =
    matches.find((m) => m.id === matchId) || clMatches.find((m) => m.id === matchId);

  const match: SportsMatch | undefined = useMemo(() => {
    if (lbMatch) {
      return {
        id: `liveball:${lbMatch.id}`,
        sourceId: lbMatch.id,
        source: "liveball",
        status: lbMatch.status,
        home: lbMatch.home,
        away: lbMatch.away,
        homeLogo: lbMatch.homeLogo,
        awayLogo: lbMatch.awayLogo,
        score: lbMatch.score,
        minute: lbMatch.minute,
        startTs: lbMatch.startTs,
        league: lbMatch.league,
      };
    }
    return displayMatch;
  }, [lbMatch, displayMatch]);

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
  const isFinished = match?.status === "finished";

  // Relevé 5 s : le cache de la source (60 s) laisse sinon le score en retard.
  const liveScores = useLiveScores(isLive);
  const liveScore = match ? liveScores.get(`liveball:${match.id}`) : undefined;
  const liveMinute = liveScore?.minute ?? match?.minute;
  const liveScoreline = (liveScore?.score ?? match?.score)?.replace(/\s*:\s*/, " - ");
  // Mi-temps : la source publie « HT » dans la minute. Le pod pub joue une fois par match.
  const minuteSource = `${liveScore?.minute ?? ""} ${match?.minute ?? ""} ${match?.statusText ?? ""}`.toLowerCase();
  const isHalfTime = /\bht\b|half|mi[- ]?temps/.test(minuteSource);
  const pageRef = useRef<HTMLDivElement>(null);

  const { data: stream, isLoading, isFetched: liveballFetched } = useQuery({
    queryKey: ["live", "liveball", "stream", matchId],
    queryFn: () => getLiveBallStream(matchId),
    staleTime: 0,
    retry: false,
    // Tant que le flux n'existe pas encore (match à venir / indispo),
    // on re-vérifie régulièrement pour démarrer dès que la diffusion arrive.
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });

  // Repli : LiveBall liste aussi des affiches qu'il ne diffuse pas. La chaîne
  // unifiée cherche alors chez kora, kooorah… — sans elle, la page affichait
  // « flux non détecté » alors qu'une source du même match jouait.
  const { data: fallback, isPending: fallbackPending } = useQuery({
    queryKey: ["live", "unified", "stream", `lb-${matchId}`],
    queryFn: async () => {
      const viaSports = await getSportsStream(matchId);
      if (viaSports?.url) return viaSports;
      // Dernier recours unifié (id ESPN, rencontre retirée des listings providers)
      const viaUnified = await getMatchStream(matchId);
      if (viaUnified?.url) return viaUnified;
      return null;
    },
    enabled: liveballFetched && !stream,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });
  const resolved = stream ?? fallback ?? null;
  const loadingStream = isLoading || (!stream && fallbackPending);

  const isInvalidEmbed = (url: string | null | undefined) => {
    if (!url) return true;
    return /liveball\.(sx|im|to|net|org|com)/i.test(url) || url.includes('/match/') || /1xbet|melbet|betting/i.test(url);
  };

  // Deux types de flux renvoyés par le backend :
  //  - "hls"    → l'URL m3u8 est jouée dans le lecteur natif (LivePlayer).
  //  - "iframe" → l'URL est un player propre à embarquer (pas la page du site).
  //    Passé par /api/live/embed-proxy comme sur les pages live/sp et matches :
  //    le proxy réécrit le HTML (pubs / popups / redirections retirées).
  const rawEmbedUrl = resolved?.type === "iframe" && !isInvalidEmbed(resolved.url) ? resolved.url : null;
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
  const channel: LiveChannel | null = resolved?.type === "hls"
    ? {
        _id: `lb-${matchId}`,
        name: match ? `${match.home} - ${match.away}` : `Match #${matchId}`,
        slug: `lb-${matchId}`,
        categories: ["sports"],
        type: "hls",
        // Le backend renvoie déjà le relay de sa source (liveball, kora…) :
        // l'ancien chemin fixe ne savait lire qu'un flux LiveBall.
        streamUrl: resolved.relayUrl ?? `/api/liveball/match/${matchId}/hls/playlist.m3u8`,
        enabled: true,
        order: 0,
        isOnline: true,
      }
    : null;

  return (
    <div ref={pageRef} className="fixed inset-0 z-40 h-dvh w-screen bg-black overflow-hidden">
      <HalftimeAdPod key={`halftime-lb-${matchId}`} active={Boolean(isLive && isHalfTime && (channel || embedUrl))} containerRef={pageRef} />
      {!isFinished && loadingStream && !channel && !embedUrl && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black">
          <div className="h-12 w-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Résolution du flux...
          </p>
        </div>
      )}

      {/* ── Match à venir : pas encore commencé ─────────────────────── */}
      {!loadingStream && isUpcoming && (preMatch || !resolved) && match && (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <MatchBackdrop home={match.home} away={match.away} />

          <div className="relative z-10 h-full flex flex-col">
            {/* Bandeau haut : état (direct / coup d'envoi) + compétition */}
            <div className="flex items-start justify-between gap-3 p-4 sm:p-6 pt-[calc(1rem_+_env(safe-area-inset-top,0px))]">
              <span className="inline-flex items-center gap-1.5 shrink-0 rounded-[5px] bg-black/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white tabular-nums">
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                {isLive
                  ? liveMinute
                    ? `Direct · ${liveMinute}`
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
                {isLive && liveScoreline && (
                  <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{liveScoreline}</p>
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
              <Link
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour
              </Link>
              <FollowMatchButton home={match?.home} away={match?.away} />
              <MatchShareButton title={match ? `${match.home} vs ${match.away}` : "Match en direct"} />
            </div>
          </div>
        </div>
      )}

      {/* ── Match terminé ─────────────────────────────────────────── */}
      {!loadingStream && isFinished && (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <MatchBackdrop home={match?.home} away={match?.away} />
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="flex items-center justify-center gap-6 sm:gap-14">
              <TeamCrest src={match?.homeLogo} alt={match?.home ?? "?"} size="lg" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Full Time</span>
                <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
                  {match?.score ? match.score.replace(/\s*:\s*/, " - ") : "–"}
                </div>
              </div>
              <TeamCrest src={match?.awayLogo} alt={match?.away ?? "?"} size="lg" />
            </div>

            <div className="max-w-md space-y-1">
              <h1 className="text-lg sm:text-2xl font-black text-white leading-tight">
                {match ? `${match.home} — ${match.away}` : "Match terminé"}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                La rencontre est terminée. Le score final ci-dessus reste disponible sur la fiche du match.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/matches/${encodeURIComponent(match?.sourceId ?? matchId)}`}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                Voir la fiche du match
              </Link>
              <Link
                href="/matches"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 text-xs font-black uppercase tracking-wider transition-all border border-white/10"
              >
                Scores &amp; Matchs
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Aucun flux détecté (habillage carte Apple TV) ──────────── */}
      {!loadingStream && !resolved && !isUpcoming && !isFinished && (
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
              <Link
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour
              </Link>
              <FollowMatchButton home={match?.home} away={match?.away} />
              <MatchShareButton title={match ? `${match.home} vs ${match.away}` : "Match en direct"} />
            </div>

            <p className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              Nouvelle tentative automatique de détection du signal toutes les 30s
            </p>
          </div>
        </div>
      )}

      {/* ── Flux au format "player à embarquer" (iframe directe sans pub) ────────────── */}
      {!isFinished && embedUrl && !preMatch && (
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
      {!isFinished && channel && !preMatch && (
        <div className="absolute inset-0">
          {/* hideTopBar : la barre du joueur superposerait son logo CHILLERS
              sur la cloche de notification à droite. */}
          <LivePlayer channel={channel} fill hideTopBar onBack={() => (window.location.href = "/live")} />
        </div>
      )}
      {!isFinished && !preMatch && (channel || embedUrl) && (
        <Link
          href="/live"
          aria-label="Retour"
          className="absolute left-3 top-[calc(0.75rem_+_env(safe-area-inset-top,0px))] z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Link>
      )}
      {!isFinished && !preMatch && (channel || embedUrl) && isLive && liveScoreline && (
        <div className="pointer-events-none absolute left-14 top-[calc(0.75rem_+_env(safe-area-inset-top,0px))] z-50 flex items-center gap-1.5 rounded-[5px] bg-black/70 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-bold text-white tabular-nums">
            {liveScoreline}
            {liveMinute ? ` · ${liveMinute}` : ""}
          </span>
        </div>
      )}
      {!isFinished && !preMatch && (channel || embedUrl) && (
        <div className="absolute right-3 top-[calc(0.75rem_+_env(safe-area-inset-top,0px))] z-50 flex items-center gap-2">
          <FollowMatchButton home={match?.home} away={match?.away} iconOnly />
          <MatchShareButton title={match ? `${match.home} vs ${match.away}` : "Match en direct"} iconOnly />
        </div>
      )}
    </div>
  );
}
