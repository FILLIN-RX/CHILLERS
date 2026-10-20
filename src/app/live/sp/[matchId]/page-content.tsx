"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Television, X } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import CompetitionBadge from "@/components/CompetitionBadge";
import MatchShareButton from "@/components/live/MatchShareButton";
import { MatchBackdrop, TeamCrest } from "@/components/MatchCardBackdrop";
import { getSportsChannels, getSportsMatches, getSportsStream } from "@/services/sports";
import { getMatchChannels, resolveOhaStream } from "@/services/oha";
import MatchChannelsRow from "@/components/live/MatchChannelsRow";
import type { OhaChannel } from "@/types/oha";
import { getLiveBallMatches, getLiveBallChampionsLeague } from "@/services/liveball";
import { buildAffiche, useMatchPosterIndex } from "@/hooks/useMatchPosterIndex";
import { useNow } from "@/hooks/useNow";
import { formatMatchDay, formatMatchTime, teamTier } from "@/lib/match-poster";
import type { LiveChannel } from "@/types/live";
import type { SportsMatch, SportsServer } from "@/types/sports";
import { PopupFirewall } from "@/lib/PopupFirewall";

/** Flux joué : le serveur sélectionné, ou le premier que la chaîne a trouvé. */
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


  /** Serveur choisi dans le sélecteur, indexé par match : changer de match remet le flux principal. */
  const [serverChoice, setServerChoice] = useState<{ id: string; idx: number } | null>(null);
  /** Chaîne CHILLERS choisie : prioritaire sur les sources externes. */
  const [ohaChoice, setOhaChoice] = useState<{ matchId: string; ch: OhaChannel; url: string } | null>(null);
  const [ohaResolving, setOhaResolving] = useState<string | null>(null);
  const [ohaError, setOhaError] = useState<string | null>(null);

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
  const cleanId = decodedId.replace(/^liveball:|^lb-/, "");

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

  // Identifie le match de manière unifiée : LiveBall ou Sports
  const directLb = allLbMatches.find((m) => m.id === cleanId || m.id === decodedId);
  const directSports = sportsMatches.find(
    (s) => s.id === decodedId || s.slug === decodedId || s.id === cleanId || s.slug === cleanId
  );

  const matchedLb = directLb || allLbMatches.find((lb) => {
    return directSports ? areTeamsMatching(directSports.home, directSports.away, lb.home, lb.away) : false;
  });

  const matchedSports = directSports || sportsMatches.find((sm) => {
    return matchedLb ? areTeamsMatching(matchedLb.home, matchedLb.away, sm.home, sm.away) : false;
  });

  const targetId = matchedLb ? `liveball:${matchedLb.id}` : (matchedSports?.slug || matchedSports?.id || decodedId);

  // useMemo : l'objet est recréé à chaque render, et `playing` en dépend.
  const match = useMemo<SportsMatch | undefined>(() => (matchedLb
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
    : matchedSports), [matchedLb, matchedSports]);

  // Chaînes CHILLERS qui diffusent ce match — l'EPG est vérifié au coup d'envoi.
  const { data: channelStatuses = [] } = useQuery({
    queryKey: [
      "oha",
      "match-channels",
      "football",
      match?.league,
      match?.home,
      match?.away,
      match?.startTs,
    ],
    queryFn: () =>
      getMatchChannels({
        sport: "football",
        league: match?.league,
        home: match?.home,
        away: match?.away,
        start: match?.startTs,
      }),
    enabled: Boolean(match),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const confirmedChannels = useMemo(
    () => channelStatuses.filter((s) => s.confirmed).map((s) => s.channel),
    [channelStatuses],
  );
  const candidateChannels = useMemo(
    () => channelStatuses.filter((s) => !s.confirmed).map((s) => s.channel),
    [channelStatuses],
  );
  const hasChannels = confirmedChannels.length + candidateChannels.length > 0;

  const activeOha = ohaChoice?.matchId === decodedId ? ohaChoice : null;

  const playOha = useCallback(
    async (ch: OhaChannel, opts?: { silent?: boolean }): Promise<boolean> => {
      if (ohaResolving) return false;
      setOhaError(null);
      setOhaResolving(ch.id);
      try {
        const url = await resolveOhaStream(ch.id, ch.altIds ?? []);
        setOhaChoice({ matchId: decodedId, ch, url });
        setServerChoice(null);
        return true;
      } catch {
        if (!opts?.silent) setOhaError(`Lien ${ch.name} momentanément indisponible.`);
        return false;
      } finally {
        setOhaResolving(null);
      }
    },
    [decodedId, ohaResolving],
  );

  const confirmedIds = useMemo(
    () => confirmedChannels.map((c) => c.id),
    [confirmedChannels],
  );

  // Le backend chaîne les providers (LiveBall, Kora, Kooorah, YallaPro, Streamiz)
  // et ne renvoie que celui qui diffuse réellement.
  const { data: stream, isLoading } = useQuery({
    queryKey: ["live", "unified", "stream", decodedId],
    queryFn: async (): Promise<(ResolvedSportsStream & { match?: SportsMatch }) | null> => {
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

  // Tous les serveurs du match : /stream donne le flux principal tout de suite,
  // /channels complète la liste en arrière-plan (registre 24 h côté backend,
  // agrégation multi-providers) — le sélecteur apparaît dès qu'elle répond.
  const { data: channels } = useQuery({
    queryKey: ["live", "unified", "channels", decodedId],
    queryFn: () => getSportsChannels(targetId),
    enabled: Boolean(decodedId),
    staleTime: 60_000,
    retry: false,
    // /stream a déjà mis le flux principal au registre : le premier /channels
    // répond vite (liste partielle). On re-tant tant que `complete` est faux
    // (la chaîne complète arrive en arrière-plan), et même après un échec —
    // providers en panne au premier coup, vivants 15 s plus tard.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data === null) return 15_000;
      if (data && data.complete === false) return 8_000;
      return false;
    },
  });

  const servers = useMemo<SportsServer[]>(() => {
    const list: SportsServer[] = channels?.servers?.length
      ? channels.servers
      : stream
        ? [
            {
              name: stream.provider ? stream.provider.toUpperCase() : "Direct",
              url: stream.url,
              type: stream.type,
              relayUrl: stream.relayUrl,
              referer: stream.referer,
            },
          ]
        : [];
    // HLS direct d'abord (repli des anciens registres déjà en mémoire),
    // embed provider ensuite.
    return [...list].sort((a, b) => (a.type === "hls" ? 0 : 1) - (b.type === "hls" ? 0 : 1));
  }, [channels, stream]);

  const activeIdx = serverChoice?.id === decodedId ? serverChoice.idx : null;
  const activeServer = activeIdx !== null ? servers[activeIdx] ?? null : null;

  const playing = useMemo<(ResolvedSportsStream & { match?: SportsMatch }) | null>(() => {
    const fromServer = (s: SportsServer, fallback: SportsMatch | undefined) => ({
      // Un miroir HLS se lit toujours par notre relay (jeton + CORS).
      url: s.type === "hls" && s.relayUrl ? s.relayUrl : s.url,
      type: s.type ?? ("iframe" as const),
      relayUrl: s.relayUrl,
      referer: s.referer,
      provider: s.provider,
      match: fallback,
    });
    if (activeServer) return fromServer(activeServer, stream?.match ?? match);
    // Dès que la liste complète arrive, le HLS direct (notre relay) devient la
    // lecture par défaut : l'embed provider n'est qu'un repli manuel.
    if (channels?.servers?.length) {
      const preferred = servers.find((s) => s.type === "hls") ?? servers[0];
      if (preferred) return fromServer(preferred, stream?.match ?? match);
    }
    if (stream) return { ...stream, match: stream.match ?? match };
    return null;
  }, [activeServer, channels, stream, servers, match]);

  const resolvedMatch = playing?.match ?? match;

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

  // Sélection automatique : première chaîne confirmée par l'EPG au coup d'envoi.
  const autoTriedRef = useRef<string | null>(null);
  useEffect(() => {
    const first = confirmedChannels[0];
    if (!first || preMatch || activeOha) return;
    const key = `${decodedId}:${first.id}`;
    if (autoTriedRef.current === key) return;

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
  }, [confirmedChannels, preMatch, activeOha, decodedId, playOha]);
  const selectedType = playing?.type;
  const rawEmbedUrl = selectedType === "iframe" ? playing?.url : null;
  // Les hôtes « domain protected » refusent notre origine : le proxy rejoue le
  // Referer de la page qui embarque normalement le lecteur.
  const embedUrl = rawEmbedUrl
    ? (/youtube\.com|youtu\.be/i.test(rawEmbedUrl)
        ? rawEmbedUrl
        : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}${
            playing?.referer ? `&referer=${encodeURIComponent(playing.referer)}` : ""
          }`)
    : null;

  const channel: LiveChannel | null = selectedType === "hls" && playing
    ? {
        _id: `sp-${decodedId}`,
        name: resolvedMatch ? `${resolvedMatch.home}${resolvedMatch.away ? ` - ${resolvedMatch.away}` : ""}` : "Match",
        slug: `sp-${decodedId}`,
        categories: ["sports"],
        type: "hls",
        streamUrl: playing.relayUrl || playing.url,
        enabled: true,
        order: 0,
        isOnline: true,
      }
    : null;

  const ohaLiveChannel: LiveChannel | null = activeOha
    ? {
        _id: `oha-sp-${activeOha.ch.id}`,
        name: activeOha.ch.name,
        slug: `oha-${activeOha.ch.id}`,
        logo: activeOha.ch.logo ?? undefined,
        categories: ["sports"],
        type: "hls",
        streamUrl: activeOha.url,
        enabled: true,
        order: 0,
        isOnline: true,
        proxy: true,
      }
    : null;

  const teamsLabel = resolvedMatch ? `${resolvedMatch.home}${resolvedMatch.away ? ` vs ${resolvedMatch.away}` : ""}` : "ce match";

  return (
    <div className="fixed inset-0 z-40 h-dvh w-screen bg-black overflow-hidden">
      {isLoading && !channel && !embedUrl && !activeOha && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black">
          <div className="h-12 w-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Résolution du flux...</p>
        </div>
      )}

      {/* ── Match à venir (habillage carte Apple TV) ───────────────── */}
      {!isLoading && isUpcoming && (preMatch || !playing) && !activeOha && match && (
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
              <Link
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour
              </Link>
              <MatchShareButton title={teamsLabel} />
            </div>
          </div>
        </div>
      )}

      {/* ── Aucun flux détecté (habillage carte Apple TV) ──────────── */}
      {!isLoading && !playing && !isUpcoming && !activeOha && (
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
              <Link
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour
              </Link>
              <MatchShareButton title={teamsLabel} />
            </div>

            <p className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              Nouvelle tentative automatique de détection du signal toutes les 30s
            </p>

            {hasChannels && (
              <div className="w-full max-w-xl space-y-2 rounded-2xl bg-white/5 border border-white/10 p-3">
                <MatchChannelsRow
                  channels={[...confirmedChannels, ...candidateChannels]}
                  confirmedIds={confirmedIds}
                  selectedId={null}
                  resolvingId={ohaResolving}
                  onSelect={playOha}
                  hint={confirmedChannels.length > 0 ? "Sélection automatique (EPG)" : "D'après les droits TV"}
                />
                {ohaError && <p className="px-1 text-[11px] text-red-300">{ohaError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chaîne CHILLERS (première option) ──────────────────────── */}
      {ohaLiveChannel && !preMatch && (
        <div className="absolute inset-0">
          <LivePlayer
            key={`oha-${activeOha?.ch.id}`}
            channel={ohaLiveChannel}
            fill
            hideTopBar
            onBack={() => (window.location.href = "/live")}
          />
        </div>
      )}

      {/* ── Player embarqué (iframe) ───────────────────────────────── */}
      {embedUrl && !preMatch && !activeOha && (
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
      {channel && !preMatch && !activeOha && (
        <div className="absolute inset-0">
          {/* key : un changement de serveur remonte le player sur le nouveau flux */}
          <LivePlayer
            key={`${decodedId}-${activeIdx ?? "primary"}`}
            channel={channel}
            fill
            hideTopBar
            onBack={() => (window.location.href = "/live")}
          />
        </div>
      )}

      {/* ── Barre de contrôle : retour, recharge, partage ──────────── */}
      {(playing || activeOha) && !preMatch && (
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

            <MatchShareButton title={teamsLabel} iconOnly />
          </div>
        </div>
      )}

    </div>
  );
}
