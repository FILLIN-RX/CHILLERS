"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwise, Television, X, ShareNetwork, Check } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import CompetitionBadge from "@/components/CompetitionBadge";
import { MatchBackdrop, TeamCrest } from "@/components/MatchCardBackdrop";
import { getSportsMatches, getSportsStream } from "@/services/sports";
import { getLiveBallMatches, getLiveBallChampionsLeague } from "@/services/liveball";
import { buildAffiche, useMatchPosterIndex } from "@/hooks/useMatchPosterIndex";
import { useNow } from "@/hooks/useNow";
import { formatMatchDay, formatMatchTime, teamTier } from "@/lib/match-poster";
import type { LiveChannel } from "@/types/live";
import type { SportsMatch } from "@/types/sports";
import { PopupFirewall } from "@/lib/PopupFirewall";

/** Le flux résolu par la chaîne de providers : on n'en sert qu'un, celui qui diffuse. */
interface ResolvedSportsStream {
  url: string;
  type: "hls" | "iframe";
  relayUrl?: string;
  /** Referer à reconstituer côté proxy d'embarquement (hôtes « domain protected »). */
  referer?: string;
  provider?: string;
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
  // Une catégorie (U19, U21, réserves…) désigne une autre équipe : ne jamais
  // joindre un match des jeunes à celui de l'équipe première (score et coup
  // d'envoi faux → écran d'attente bloquant un match déjà en direct).
  if (teamTier(h1) !== teamTier(h2)) return false;
  if (a1 && a2 && teamTier(a1) !== teamTier(a2)) return false;
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

export default function SportsMatchContent() {
  const { matchId } = useParams<{ matchId: string }>();
  const decodedId = decodeURIComponent(matchId || "");

  const [reloadKey, setReloadKey] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  // Verrouille le scroll tant que le player est ouvert et active le pare-feu anti-pub
  useEffect(() => {
    PopupFirewall.activate();
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevPosition;
      PopupFirewall.deactivate();
    };
  }, []);

  const isLb = decodedId.startsWith("liveball:") || decodedId.startsWith("lb-");
  const liveballId = isLb ? decodedId.replace(/^liveball:|^lb-/, "") : "";

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

  // Identifie le match LiveBall ou Sports
  const matchedLb = isLb
    ? allLbMatches.find((m) => m.id === liveballId)
    : allLbMatches.find((lb) => {
        const sm = sportsMatches.find((s) => s.id === decodedId);
        return sm ? areTeamsMatching(sm.home, sm.away, lb.home, lb.away) : false;
      });

  const matchedSports = !isLb
    ? sportsMatches.find((m) => m.id === decodedId)
    : sportsMatches.find((sm) => {
        return matchedLb ? areTeamsMatching(matchedLb.home, matchedLb.away, sm.home, sm.away) : false;
      });

  const match: SportsMatch | undefined = matchedLb
    ? {
        id: `liveball:${matchedLb.id}`,
        sourceId: matchedLb.id,
        source: "liveball",
        status: matchedLb.status,
        home: matchedLb.home,
        away: matchedLb.away,
        homeLogo: matchedLb.homeLogo || matchedSports?.homeLogo,
        awayLogo: matchedLb.awayLogo || matchedSports?.awayLogo,
        score: matchedLb.score || matchedSports?.score,
        minute: matchedLb.minute || matchedSports?.minute,
        startTs: matchedLb.startTs || matchedSports?.startTs,
        league: matchedLb.league || matchedSports?.league,
      }
    : matchedSports;

  // Le backend chaîne les providers (LiveBall, Kora, Kooorah, YallaPro, Streamiz)
  // et ne renvoie que celui qui diffuse réellement.
  const { data: stream, isLoading, refetch } = useQuery({
    queryKey: ["live", "unified", "stream", decodedId, reloadKey],
    queryFn: async (): Promise<(ResolvedSportsStream & { match?: SportsMatch }) | null> => {
      const targetId = isLb ? `liveball:${liveballId}` : decodedId;
      const resolved = await getSportsStream(targetId);
      if (!resolved?.url) return null;

      const server = resolved.servers?.[0];
      return {
        url: resolved.url,
        type: server?.type ?? resolved.type,
        relayUrl: server?.relayUrl ?? resolved.relayUrl,
        referer: server?.referer ?? resolved.referer,
        provider: resolved.provider,
        match,
      };
    },
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });

  const resolvedMatch = stream?.match ?? match;

  // Affiche officielle du service de score : nom de la compétition, écusson de
  // ligue et logo de club. Retombe sur la source quand la jointure échoue.
  const { posters } = useMatchPosterIndex();
  const affiche = useMemo(
    () => (resolvedMatch ? buildAffiche(resolvedMatch, posters) : null),
    [resolvedMatch, posters]
  );

  // Les sources marquent le match « live » avant l'heure et n'en publient pas
  // toujours le coup d'envoi : l'heure du service de score décide de l'écran
  // d'attente. Tant qu'il n'est pas passé, on montre l'affiche plutôt qu'un flux
  // de remplissage ; le player prend la main au coup d'envoi, sans rechargement.
  const now = useNow(30_000);
  const kickoff = affiche?.startTs;
  const preMatch = Boolean(kickoff && kickoff * 1000 > now);
  const isUpcoming = preMatch || match?.status === "upcoming";
  const isLive = resolvedMatch?.status === "live";
  const selectedType = stream?.type;
  const rawEmbedUrl = selectedType === "iframe" ? stream?.url : null;
  // Les hôtes « domain protected » refusent notre origine : le proxy rejoue le
  // Referer de la page qui embarque normalement le lecteur.
  const embedUrl = rawEmbedUrl
    ? (/youtube\.com|youtu\.be/i.test(rawEmbedUrl)
        ? rawEmbedUrl
        : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}${
            stream?.referer ? `&referer=${encodeURIComponent(stream.referer)}` : ""
          }`)
    : null;

  const channel: LiveChannel | null = selectedType === "hls" && stream
    ? {
        _id: `sp-${decodedId}`,
        name: resolvedMatch ? `${resolvedMatch.home}${resolvedMatch.away ? ` - ${resolvedMatch.away}` : ""}` : "Match",
        slug: `sp-${decodedId}`,
        categories: ["sports"],
        type: "hls",
        streamUrl: stream.relayUrl || stream.url,
        enabled: true,
        order: 0,
        isOnline: true,
      }
    : null;

  const retry = () => {
    setReloadKey((k) => k + 1);
    refetch();
  };

  const handleShare = async () => {
    const title = resolvedMatch
      ? `${resolvedMatch.home}${resolvedMatch.away ? ` - ${resolvedMatch.away}` : ""} · ${
          affiche?.competition || "Football"
        } · En direct sur CHILLERS`
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
        // clipboard indisponible
      }
    }
  };

  const teamsLabel = resolvedMatch ? `${resolvedMatch.home}${resolvedMatch.away ? ` vs ${resolvedMatch.away}` : ""}` : "ce match";

  return (
    <div className="fixed inset-0 z-40 h-dvh w-screen bg-black overflow-hidden">
      {isLoading && !channel && !embedUrl && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black">
          <div className="h-12 w-12 border-4 border-[brand-primary] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Résolution du flux...</p>
        </div>
      )}

      {/* ── Match à venir (habillage carte Apple TV) ───────────────── */}
      {!isLoading && isUpcoming && (preMatch || !stream) && match && (
        <div className="relative w-full h-full overflow-hidden bg-black">
          <MatchBackdrop home={match.home} away={match.away} />

          <div className="relative z-10 h-full flex flex-col">
            {/* Bandeau haut : état (direct / coup d'envoi) + compétition */}
            <div className="flex items-start justify-between gap-3 p-4 sm:p-6 pt-[calc(1rem_+_env(safe-area-inset-top,0px))]">
              <span className="inline-flex items-center gap-1.5 shrink-0 rounded-[5px] bg-black/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white tabular-nums">
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                {isLive
                  ? resolvedMatch?.minute
                    ? `Direct · ${resolvedMatch.minute}`
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
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[brand-primary] hover:brightness-110 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <ArrowsClockwise className="h-4 w-4" />
                Actualiser
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                {shareCopied ? <Check className="h-4 w-4 text-[brand-primary]" /> : <ShareNetwork className="h-4 w-4" />}
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
          <MatchBackdrop home={resolvedMatch?.home} away={resolvedMatch?.away} />

          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="h-20 w-20 rounded-full bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shadow-2xl">
              <Television className="h-10 w-10" />
            </div>

            <div className="max-w-lg space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Flux vidéo non détecté</h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                {resolvedMatch ? (
                  <>
                    La diffusion pour <strong className="text-white">{teamsLabel}</strong> n&apos;est pas encore
                    disponible ou le signal source est momentanément interrompu.
                  </>
                ) : (
                  "Aucun flux n'a pu être extrait pour cette rencontre. Elle peut provenir d'une source indisponible."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={retry}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[brand-primary] hover:brightness-110 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/20"
              >
                <ArrowsClockwise className="h-4 w-4" />
                Réessayer la connexion
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                {shareCopied ? <Check className="h-4 w-4 text-[brand-primary]" /> : <ShareNetwork className="h-4 w-4" />}
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

      {/* ── Player embarqué (iframe) ───────────────────────────────── */}
      {embedUrl && !preMatch && (
        <div className="absolute inset-0 bg-black">
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={resolvedMatch ? `${teamsLabel} · En direct` : "Match en direct"}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* ── Flux HLS natif via notre relay ─────────────────────────── */}
      {channel && !preMatch && (
        <div className="absolute inset-0">
          <LivePlayer channel={channel} fill hideTopBar onBack={() => (window.location.href = "/live")} />
        </div>
      )}

      {/* ── Barre de contrôle : retour, recharge, partage ──────────── */}
      {stream && !preMatch && (
        <div className="absolute top-0 inset-x-0 z-30 pt-[calc(0.75rem_+_env(safe-area-inset-top,0px))] pb-3 pl-[calc(0.75rem_+_env(safe-area-inset-left,0px))] pr-[calc(0.75rem_+_env(safe-area-inset-right,0px))] bg-gradient-to-b from-black/90 via-black/50 to-transparent">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/live"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
              aria-label="Retour"
            >
              <X className="h-5 w-5" />
            </Link>

            <div className="flex-1 min-w-0 flex flex-col items-center gap-0.5">
              <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate max-w-full">
                {resolvedMatch ? teamsLabel : "Match en direct"}
              </p>
              {affiche?.competition && (
                <span className="flex items-center gap-1.5 min-w-0 max-w-full">
                  {affiche.competitionLogo && (
                    <span className="flex w-3.5 h-3.5 shrink-0 rounded-sm bg-white items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={affiche.competitionLogo}
                        alt=""
                        className="w-3 h-3 object-contain"
                      />
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400 truncate">{affiche.competition}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={retry}
                className="p-2 rounded-full bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                aria-label="Recharger le flux"
              >
                <ArrowsClockwise className="h-4 w-4" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-full bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                aria-label="Partager"
              >
                {shareCopied ? <Check className="h-4 w-4 text-[brand-primary]" /> : <ShareNetwork className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
