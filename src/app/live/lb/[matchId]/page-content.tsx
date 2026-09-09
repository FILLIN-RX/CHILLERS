"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwise, Television, X, ShareNetwork, Check } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import { getLiveBallStream, getLiveBallMatches, getLiveBallChampionsLeague } from "@/services/liveball";
import type { LiveChannel } from "@/types/live";
import type { LiveBallMatch } from "@/types/liveball";

function leagueLabel(slug?: string): string {
  const map: Record<string, string> = {
    "champions-league": "Champions League",
    "europa-league": "Europa League",
    "conference-league": "Conference League",
  };
  return map[slug || ""] || "Football";
}

function formatMatchTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatMatchDay(ts?: number): string {
  if (!ts) return "";
  const [weekday, ...rest] = new Date(ts * 1000)
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    .split(" ");
  return [weekday.charAt(0).toUpperCase() + weekday.slice(1), ...rest].join(" ");
}

function TeamDisplay({ team, logo }: { team: string; logo?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [logo]);
  const initials = team
    .replace(/\s*\(.*\)$/, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-3 w-[130px] sm:w-[180px] min-w-0">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-lg shadow-black/50 ring-2 ring-white/15">
        {logo && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={team} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" onError={() => setBroken(true)} />
        ) : (
          <span className="text-3xl font-black text-zinc-900">{initials || "?"}</span>
        )}
      </div>
      <p className="text-center text-sm sm:text-base font-extrabold text-white leading-tight truncate w-full">
        {team}
      </p>
    </div>
  );
}

export default function LiveBallMatchContent() {
  const { matchId } = useParams<{ matchId: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const title = match
      ? `${match.home} - ${match.away} · ${leagueLabel(match.league)} · En direct sur CHILLERS`
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
  const isUpcoming = match?.status === "upcoming";

  const { data: stream, isLoading, refetch } = useQuery({
    queryKey: ["live", "liveball", "stream", matchId, reloadKey],
    queryFn: () => getLiveBallStream(matchId),
    staleTime: 0,
    retry: false,
    // Tant que le flux n'existe pas encore (match à venir / indispo),
    // on re-vérifie régulièrement pour démarrer dès que la diffusion arrive.
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });

  // Deux types de flux renvoyés par le backend :
  //  - "hls"    → l'URL m3u8 est jouée dans le lecteur natif (LivePlayer).
  //  - "iframe" → l'URL est un player à embarquer en iframe (format "f" du site,
  //               utilisé par beaucoup de matchs dont ceux de la Champions League).
  // On n'embarque QUE le player, pas la page liveball.sx.
  const embedUrl = stream?.type === "iframe" ? stream.url : null;

  // Dernier recours : si le match est en direct mais que la résolution backend a
  // échoué, on embarque la page du match (le player du site, même IP/cookies,
  // passe toujours). Tant que le flux n'est pas résolu, ~rien ne s'affiche.
  const liveFallbackMode = match?.status === "live" && !stream && !isLoading;

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
          <div className="h-12 w-12 border-4 border-[#D70466] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Résolution du flux...
          </p>
        </div>
      )}

      {/* ── Match à venir : pas encore commencé ─────────────────────── */}
      {!isLoading && !stream && isUpcoming && match && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-black px-6 py-10 overflow-y-auto no-scrollbar">
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                {leagueLabel(match.league)}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-[#D70466] text-white">
                À venir
              </span>
            </div>

            <div className="flex items-center justify-center gap-4 sm:gap-10 w-full">
              <TeamDisplay team={match.home} logo={match.homeLogo} />
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#D70466]/15 border-2 border-[#D70466]/60 flex items-center justify-center text-lg sm:text-xl font-black text-[#D70466] shrink-0">
                VS
              </div>
              <TeamDisplay team={match.away} logo={match.awayLogo} />
            </div>

            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Le match n&apos;a pas encore commencé
              </h1>
              <p className="mt-2.5 text-sm text-zinc-400 leading-relaxed">
                Diffusion programmée pour{" "}
                <span className="text-white font-bold capitalize">{formatMatchDay(match.startTs)}</span> à{" "}
                <span className="text-white font-bold tabular-nums">{formatMatchTime(match.startTs)}</span>.
                <br className="hidden sm:block" /> La lecture démarrera automatiquement au coup d&apos;envoi.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={retry}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <ArrowsClockwise className="h-4 w-4" />
                Actualiser
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                {shareCopied ? (
                  <Check className="h-4 w-4 text-[#D70466]" />
                ) : (
                  <ShareNetwork className="h-4 w-4" />
                )}
                {shareCopied ? "Lien copié" : "Partager"}
              </button>
              <a
                href="/live"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <X className="h-4 w-4" />
                Retour aux directs
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={`https://liveball.sx/match/${matchId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <Television className="h-4 w-4" />
                Voir sur liveball.sx
              </a>
            </div>

            <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D70466] animate-pulse" />
              Vérification automatique du flux toutes les 30 secondes
            </p>
          </div>
        </div>
      )}

      {/* ── Match sans flux disponible / introuvable ─────────────────── */}
      {!isLoading && !stream && !isUpcoming && !liveFallbackMode && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Television className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Aucune diffusion disponible</h3>
          <p className="text-sm text-zinc-400 max-w-md">
            {match ? `${match.home} - ${match.away} : ` : "Match introuvable. "}
            aucun flux n&apos;a pu être trouvé pour ce match. Il est peut-être terminé, ou
            la diffusion n&apos;a pas encore commencé.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={retry}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              <ArrowsClockwise className="h-4 w-4" />
              Réessayer
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              {shareCopied ? (
                <Check className="h-4 w-4 text-[#D70466]" />
              ) : (
                <ShareNetwork className="h-4 w-4" />
              )}
              {shareCopied ? "Lien copié" : "Partager"}
            </button>
            <a
              href="/live"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              <X className="h-4 w-4" />
              Retour aux directs
            </a>
          </div>
          <a
            href={`https://liveball.sx/match/${matchId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
          >
            <Television className="h-4 w-4" />
            Voir la diffusion sur liveball.sx
          </a>
        </div>
      )}

      {/* ── Flux au format "player à embarquer" (iframe) ────────────── */}
      {embedUrl && (
        <div className="absolute inset-0 bg-black">
          <iframe
            src={embedUrl}
            title={match ? `${match.home} - ${match.away} · En direct` : "Match en direct"}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* ── Dernier recours : match live mais résolution backend échouée ── */}
      {/* La page liveball.sx complète n'est PAS en plein écran : contenu dans
          un lecteur 16:9, bord énoncé, avec la barre "En direct" au-dessus. */}
      {liveFallbackMode && (
        <div className="absolute inset-0 bg-black">
          <div className="h-full w-full flex flex-col sm:justify-center gap-4 px-4 py-6 sm:py-10 overflow-y-auto no-scrollbar">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {match && (
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                  {leagueLabel(match.league)}
                </span>
              )}
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-[#D70466] text-white">
                En direct
              </span>
            </div>

            <div className="relative w-full max-w-5xl mx-auto aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl ring-1 ring-white/5">
              <iframe
                src={`https://liveball.sx/match/${matchId}`}
                title={match ? `${match.home} - ${match.away} · En direct` : "Match en direct"}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={`https://liveball.sx/match/${matchId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <ShareNetwork className="h-4 w-4" />
                Voir sur liveball.sx
              </a>
            </div>
          </div>
        </div>
      )}

      {channel && (
        <div className="absolute inset-0">
          <LivePlayer channel={channel} fill onBack={() => (window.location.href = "/live")} />
        </div>
      )}
    </div>
  );
}