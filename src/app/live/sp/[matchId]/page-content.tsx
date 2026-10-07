"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwise, Television, X, ShareNetwork, Check } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import { getSportsMatches, getSportsStream } from "@/services/sports";
import { getLiveBallMatches, getLiveBallStream, getLiveBallChampionsLeague } from "@/services/liveball";
import type { LiveChannel } from "@/types/live";
import type { SportsMatch, SportsServer, SportsStream } from "@/types/sports";
import { PopupFirewall } from "@/lib/PopupFirewall";

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
  // On mémorise l'URL qui a échoué plutôt que le logo courant : inutile
  // d'effacer l'état quand la.src change, le rendu se recalcule tout seul.
  const [brokenLogo, setBrokenLogo] = useState<string | undefined>();
  const broken = Boolean(logo) && brokenLogo === logo;
  const initials = (team || "?")
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
          <img src={logo} alt={team} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" onError={() => setBrokenLogo(logo)} />
        ) : (
          <span className="text-3xl font-black text-zinc-900">{initials || "?"}</span>
        )}
      </div>
      <p className="text-center text-sm sm:text-base font-extrabold text-white leading-tight truncate w-full">{team}</p>
    </div>
  );
}

export default function SportsMatchContent() {
  const { matchId } = useParams<{ matchId: string }>();
  const decodedId = decodeURIComponent(matchId || "");

  const [reloadKey, setReloadKey] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  // Serveur sélectionné, réinitialisé implicitement quand le match change.
  const [serverChoice, setServerChoice] = useState({ matchId: "", index: 0 });

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

  const isUpcoming = match?.status === "upcoming";

  // Résolution multi-fournisseurs (LiveBall, Kora, Kooorah, YallaPro, Streamiz)
  const { data: stream, isLoading, refetch } = useQuery({
    queryKey: ["live", "unified", "stream", decodedId, reloadKey, matchedLb?.id, matchedSports?.id],
    queryFn: async (): Promise<SportsStream | null> => {
      const servers: SportsServer[] = [];
      let primaryUrl = "";
      let primaryType: "hls" | "iframe" = "hls";
      let primaryRelayUrl = "";

      const targetLbId = matchedLb?.id || (isLb ? liveballId : null);
      const targetSportsId = matchedSports?.id || (!isLb ? decodedId : null);

      // 1. Récupération parallèle des flux disponibles
      const [lbRes, spRes] = await Promise.allSettled([
        targetLbId ? getLiveBallStream(targetLbId) : Promise.resolve(null),
        targetSportsId ? getSportsStream(targetSportsId) : Promise.resolve(null),
      ]);

      const lbStream = lbRes.status === "fulfilled" ? lbRes.value : null;
      const spStream = spRes.status === "fulfilled" ? spRes.value : null;

      // 2. Intégration du flux LiveBall si disponible
      if (lbStream?.url && targetLbId) {
        const isHls = lbStream.type === "hls";
        const relay = isHls ? `/api/liveball/match/${targetLbId}/hls/playlist.m3u8` : undefined;
        servers.push({
          name: "LiveBall · HLS Direct",
          url: lbStream.url,
          type: lbStream.type,
          relayUrl: relay,
        });
      }

      // 3. Intégration des flux Sports (Kora, Kooorah, YallaPro, Streamiz)
      if (spStream?.url) {
        const sourceName = (matchedSports?.source || decodedId.split(":")[0] || "Miroir").toUpperCase();
        if (spStream.servers && spStream.servers.length > 0) {
          spStream.servers.forEach((s, idx) => {
            const label = s.name ? `${sourceName} · ${s.name}` : `${sourceName} · Serveur ${idx + 1}`;
            servers.push({
              name: label,
              url: s.url,
              type: s.type || "iframe",
              relayUrl: s.relayUrl,
            });
          });
        } else {
          servers.push({
            name: `${sourceName} · Serveur 1`,
            url: spStream.url,
            type: spStream.type || "iframe",
            relayUrl: spStream.relayUrl,
          });
        }
      }

      if (servers.length === 0) return null;

      // Priorité par défaut : le fournisseur cliqué, sinon le premier serveur fonctionnel
      const defaultServer = isLb
        ? servers.find((s) => s.name.startsWith("LiveBall")) || servers[0]
        : servers.find((s) => !s.name.startsWith("LiveBall")) || servers[0];

      return {
        url: defaultServer.url,
        type: defaultServer.type || "iframe",
        relayUrl: defaultServer.relayUrl || "",
        servers,
        match,
      };
    },
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.data ? false : 30_000),
  });

  const resolvedMatch = stream?.match ?? match;
  const servers = stream?.servers ?? [];
  const activeServer = serverChoice.matchId === decodedId ? serverChoice.index : 0;
  const selectedServer = servers[activeServer];
  const selectedType = selectedServer?.type ?? stream?.type;
  const rawEmbedUrl = selectedType === "iframe" ? (selectedServer?.url ?? stream?.url) : null;
  const embedUrl = rawEmbedUrl
    ? (/youtube\.com|youtu\.be/i.test(rawEmbedUrl)
        ? rawEmbedUrl
        : `/api/live/embed-proxy?url=${encodeURIComponent(rawEmbedUrl)}`)
    : null;

  const channel: LiveChannel | null = selectedType === "hls" && stream
    ? {
        _id: `sp-${decodedId}`,
        name: resolvedMatch ? `${resolvedMatch.home}${resolvedMatch.away ? ` - ${resolvedMatch.away}` : ""}` : "Match",
        slug: `sp-${decodedId}`,
        categories: ["sports"],
        type: "hls",
        streamUrl: selectedServer?.relayUrl || stream.relayUrl || selectedServer?.url || stream.url,
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
      ? `${resolvedMatch.home}${resolvedMatch.away ? ` - ${resolvedMatch.away}` : ""} · En direct sur CHILLERS`
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

      {/* ── Match à venir ─────────────────────────────────────────── */}
      {!isLoading && !stream && isUpcoming && match && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-black px-6 py-10 overflow-y-auto no-scrollbar">
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                {match.league || "Football"}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-[brand-primary] text-white">
                À venir
              </span>
            </div>

            {match.away && (
              <div className="flex items-center justify-center gap-4 sm:gap-10 w-full">
                <TeamDisplay team={match.home} logo={match.homeLogo} />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[brand-primary]/15 border-2 border-[brand-primary]/60 flex items-center justify-center text-lg sm:text-xl font-black text-[brand-primary] shrink-0">
                  VS
                </div>
                <TeamDisplay team={match.away} logo={match.awayLogo} />
              </div>
            )}

            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-black text-white">Le match n&apos;a pas encore commencé</h1>
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
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all"
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

            <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Vérification automatique du flux toutes les 30 secondes
            </p>
          </div>
        </div>
      )}

      {/* ── Aucun flux détecté ─────────────────────────────────────── */}
      {!isLoading && !stream && !isUpcoming && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-black/95 px-6 text-center">
          <div className="h-20 w-20 rounded-full bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 shadow-2xl">
            <Television className="h-10 w-10" />
          </div>

          <div className="max-w-lg space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Flux vidéo non détecté</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/20"
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

          <p className="text-[11px] text-zinc-500 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            Nouvelle tentative automatique de détection du signal toutes les 30s
          </p>
        </div>
      )}

      {/* ── Player embarqué (iframe) ───────────────────────────────── */}
      {embedUrl && (
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
      {channel && (
        <div className="absolute inset-0">
          <LivePlayer channel={channel} fill onBack={() => (window.location.href = "/live")} />
        </div>
      )}

      {/* ── Barre de contrôle : retour, sources, partage ───────────── */}
      {stream && (
        <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/live"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
              aria-label="Retour"
            >
              <X className="h-5 w-5" />
            </Link>

            <div className="flex-1 min-w-0 text-center">
              <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                {resolvedMatch ? teamsLabel : "Match en direct"}
              </p>
              {resolvedMatch?.league && (
                <p className="text-[10px] text-zinc-400 truncate">{resolvedMatch.league}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {servers.length > 1 && (
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/15 p-1 rounded-xl">
                  {servers.map((s, i) => {
                    const isSelected = i === activeServer;
                    return (
                      <button
                        key={`${s.url}-${i}`}
                        onClick={() => setServerChoice({ matchId: decodedId, index: i })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                            : "text-zinc-400 hover:text-white hover:bg-white/10"
                        }`}
                        title={s.name}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
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
