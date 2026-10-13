"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "@phosphor-icons/react";
import { getSportsMatches } from "@/services/sports";
import { getLiveBallMatches } from "@/services/liveball";
import { buildAffiche, useMatchPosterIndex, type MatchAffiche } from "@/hooks/useMatchPosterIndex";
import { formatMatchDay, formatMatchTime } from "@/lib/match-poster";
import CompetitionBadge from "@/components/CompetitionBadge";
import type { SportsMatch } from "@/types/sports";
import type { LiveBallMatch } from "@/types/liveball";

const STATUS_TABS: { id: "all" | "live"; label: string }[] = [
  { id: "all", label: "Tous les Matchs" },
  { id: "live", label: "En Direct" },
];

type ShowcaseEntry = { match: SportsMatch; affiche: MatchAffiche };

/** La source la plus bavarde sert de base à la carte fusionnée. */
function rankSource(entry: ShowcaseEntry): number {
  return (
    (entry.match.score ? 4 : 0) +
    (entry.match.source === "liveball" ? 2 : 0) +
    (entry.affiche.fixtureId ? 1 : 0)
  );
}

/**
 * Deux sources décrivent la même rencontre sans publier les mêmes champs : l'une
 * donne le score, l'autre les écussons. La carte retenue garde le meilleur des
 * deux au lieu de laisser passer la plus pauvre.
 */
function mergeSources(kept: ShowcaseEntry, extra: ShowcaseEntry): ShowcaseEntry {
  return {
    match: {
      ...kept.match,
      score: kept.match.score || extra.match.score,
      minute: kept.match.minute ?? extra.match.minute,
      startTs: kept.match.startTs ?? extra.match.startTs,
      homeLogo: kept.match.homeLogo || extra.match.homeLogo,
      awayLogo: kept.match.awayLogo || extra.match.awayLogo,
      league: kept.match.league || extra.match.league,
    },
    affiche: {
      ...kept.affiche,
      homeLogo: kept.affiche.homeLogo || extra.affiche.homeLogo,
      awayLogo: kept.affiche.awayLogo || extra.affiche.awayLogo,
      competitionLogo: kept.affiche.competitionLogo || extra.affiche.competitionLogo,
      startTs: kept.affiche.startTs ?? extra.affiche.startTs,
    },
  };
}

function normalizeTeam(name?: string): string {
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

function getMatchFingerprint(m: SportsMatch): string {
  const h = normalizeTeam(m.home);
  const a = normalizeTeam(m.away);
  if (!h) return m.id;
  const teams = [h, a].filter(Boolean).sort().join("_");
  const timeWindow = m.startTs ? Math.floor(m.startTs / 7200) : "today";
  return `${teams}_${timeWindow}`;
}

function formatKickoff(ts?: number): string {
  const day = formatMatchDay(ts);
  const time = formatMatchTime(ts);
  if (day && time) return `${day} · ${time}`;
  return day || time || "Bientôt";
}

function TeamCrest({ src, alt }: { src?: string; alt: string }) {
  // On mémorise l'URL qui a échoué : une affiche 404 retombe sur les initiales,
  // et une URL remplacée par la query suivante se reteste normalement.
  const [brokenSrc, setBrokenSrc] = useState<string | undefined>();
  const broken = brokenSrc === src;

  const initials = (alt || "?")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!src || broken) {
    return (
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xs font-black text-zinc-500 bg-white/[0.04] shrink-0">
        {initials || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBrokenSrc(src)}
      className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0 drop-shadow-md"
    />
  );
}

export default function SportsMatchesRow({
  title = "Matchs de Football en Direct",
  className = "space-y-3 my-6",
}: {
  title?: string;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<"all" | "live">("all");

  const { data: sportsMatches = [], isLoading: isLoadingSports } = useQuery({
    queryKey: ["live", "sports"],
    queryFn: () => getSportsMatches(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: liveballMatches = [], isLoading: isLoadingLiveBall } = useQuery({
    queryKey: ["live", "liveball"],
    queryFn: () => getLiveBallMatches(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const isLoading = isLoadingSports && isLoadingLiveBall;

  const { posters, ready: postersReady } = useMatchPosterIndex();

  // Déduplique intelligemment par équipes : LiveBall en priorité, fusion des logos et scores
  const deduped = useMemo<SportsMatch[]>(() => {
    // 1. Convertit les matchs LiveBall au format SportsMatch
    const lbConverted: SportsMatch[] = (liveballMatches || []).map((lb: LiveBallMatch) => ({
      id: `liveball:${lb.id}`,
      sourceId: lb.id,
      source: "liveball" as const,
      status: lb.status,
      home: lb.home,
      away: lb.away,
      homeLogo: lb.homeLogo,
      awayLogo: lb.awayLogo,
      score: lb.score,
      minute: lb.minute,
      startTs: lb.startTs,
      league: lb.league,
    }));

    const all = [...lbConverted, ...(sportsMatches || [])];
    const grouped = new Map<string, SportsMatch>();

    for (const m of all) {
      if (!m?.id || !m.home || !m.away) continue;
      const key = getMatchFingerprint(m);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...m });
      } else {
        // Si la nouvelle source est LiveBall, elle prend le dessus sur l'ID et l'URL
        if (m.source === "liveball" && existing.source !== "liveball") {
          grouped.set(key, {
            ...m,
            homeLogo: existing.homeLogo || m.homeLogo,
            awayLogo: existing.awayLogo || m.awayLogo,
            score: existing.score || m.score,
            league: existing.league || m.league,
          });
        } else {
          // Complète les logos/score manquants
          if (!existing.homeLogo && m.homeLogo) existing.homeLogo = m.homeLogo;
          if (!existing.awayLogo && m.awayLogo) existing.awayLogo = m.awayLogo;
          if (!existing.score && m.score) existing.score = m.score;
          if (!existing.league && m.league) existing.league = m.league;
        }
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      return (a.startTs ?? Number.MAX_SAFE_INTEGER) - (b.startTs ?? Number.MAX_SAFE_INTEGER);
    });
  }, [sportsMatches, liveballMatches]);

  // Vitrine : les grandes compétitions seulement. Le tri se fait sur le libellé
  // de la source, renforcé par la jointure au service de score — jamais sur la
  // jointure seule, sinon une panne du service de score viderait la rangée.
  const showcase = useMemo(() => {
    const withAffiche = deduped.map((m) => ({ match: m, affiche: buildAffiche(m, posters) }));
    const majors = postersReady ? withAffiche.filter((entry) => entry.affiche.major) : withAffiche;

    // Des sources différentes décrivent la même rencontre avec des noms de clubs
    // et une heure de coup d'envoi qui ne se recouvrent pas : le fingerprint local
    // ne les confond pas, l'identifiant du service de score oui.
    const byKey = new Map<string, ShowcaseEntry>();
    for (const entry of majors) {
      const key = entry.affiche.fixtureId || getMatchFingerprint(entry.match);
      const kept = byKey.get(key);
      if (!kept) byKey.set(key, entry);
      else byKey.set(key, rankSource(entry) > rankSource(kept) ? mergeSources(entry, kept) : mergeSources(kept, entry));
    }
    return Array.from(byKey.values());
  }, [deduped, posters, postersReady]);

  const cards = useMemo(
    () => (activeTab === "live" ? showcase.filter((entry) => entry.match.status === "live") : showcase),
    [showcase, activeTab]
  );

  const liveCount = useMemo(
    () => showcase.filter((entry) => entry.match.status === "live").length,
    [showcase]
  );

  if (!isLoading && deduped.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2 pr-1">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="h-3.5 w-1 bg-red-600 rounded-full" />
            {title}
          </h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-red-500">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {liveCount} En Direct
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Link
            href="/matches"
            className="text-xs sm:text-sm font-bold text-red-500 hover:text-red-400 flex items-center gap-1.5 group transition-colors shrink-0"
          >
            <span>Scores & Matchs</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/live"
            className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 group transition-colors shrink-0"
          >
            <span>Direct TV</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Filtres simplifiés : Tous / En Direct uniquement */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-0.5 px-1">
        {STATUS_TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 focus:outline-none cursor-pointer ${
                isSelected
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30 scale-[1.02]"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-medium">Chargement des rencontres...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center">
          <p className="text-xs text-zinc-500 font-medium">
            {activeTab === "live" ? "Aucune rencontre en direct pour le moment." : "Aucune rencontre disponible."}
          </p>
        </div>
      ) : (
        <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 px-1">
          {cards.map(({ match: m, affiche }) => {
            const isLive = m.status === "live";

            return (
              <Link
                key={m.id}
                href={`/live/sp/${encodeURIComponent(m.id)}`}
                className="group shrink-0 flex flex-col justify-between rounded-2xl p-3.5 w-[260px] sm:w-[280px] bg-transparent hover:bg-white/[0.04] transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <CompetitionBadge competition={affiche.competition} logo={affiche.competitionLogo} />
                  {isLive ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-500 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      DIRECT
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-500 tabular-nums shrink-0">
                      {formatKickoff(affiche.startTs)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 my-1">
                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={affiche.homeLogo} alt={m.home} />
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-red-400 transition-colors">
                      {m.home}
                    </p>
                  </div>

                  <div className="shrink-0 px-2 text-center min-w-[32px]">
                    <span className={`text-xs font-black tabular-nums ${isLive ? "text-amber-400" : "text-zinc-400"}`}>
                      {m.score || "VS"}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={affiche.awayLogo} alt={m.away || "?"} />
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-red-400 transition-colors">
                      {m.away || ""}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 flex items-center justify-center gap-2 text-center">
                  <span
                    className={`text-[11px] font-bold ${
                      isLive ? "text-red-500 group-hover:text-red-400" : "text-zinc-400"
                    } transition-colors`}
                  >
                    {isLive ? "Regarder le direct" : "Voir le match"}
                  </span>
                  {isLive && (
                    <ArrowRight className="w-3.5 h-3.5 text-red-500 transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
