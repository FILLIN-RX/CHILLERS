"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "@phosphor-icons/react";
import { getSportsMatches } from "@/services/sports";
import { getLiveBallMatches } from "@/services/liveball";
import type { SportsMatch } from "@/types/sports";
import type { LiveBallMatch } from "@/types/liveball";

const STATUS_TABS: { id: "all" | "live"; label: string }[] = [
  { id: "all", label: "Tous les Matchs" },
  { id: "live", label: "En Direct" },
];

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

function formatMatchTime(ts?: number): string {
  if (!ts) return "Bientôt";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function TeamCrest({ src, alt }: { src?: string; alt: string }) {
  const initials = (alt || "?")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!src) {
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
      if (!m?.id || !m.home) continue;
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

  const filtered = useMemo(() => {
    if (activeTab === "live") return deduped.filter((m) => m.status === "live");
    return deduped;
  }, [deduped, activeTab]);

  const liveCount = useMemo(
    () => deduped.filter((m) => m.status === "live").length,
    [deduped]
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
      ) : filtered.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center">
          <p className="text-xs text-zinc-500 font-medium">
            {activeTab === "live" ? "Aucune rencontre en direct pour le moment." : "Aucune rencontre disponible."}
          </p>
        </div>
      ) : (
        <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 px-1">
          {filtered.map((m) => {
            const isLive = m.status === "live";

            return (
              <Link
                key={m.id}
                href={`/live/sp/${encodeURIComponent(m.id)}`}
                className="group shrink-0 flex flex-col justify-between rounded-2xl p-3.5 w-[260px] sm:w-[280px] bg-transparent hover:bg-white/[0.04] transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <span className="text-[10px] font-bold truncate max-w-[140px] text-zinc-400">
                    {m.league || "Football"}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      isLive ? "text-red-500 flex items-center gap-1" : "text-zinc-500"
                    }`}
                  >
                    {isLive ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        DIRECT
                      </>
                    ) : (
                      formatMatchTime(m.startTs)
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 my-1">
                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={m.homeLogo} alt={m.home} />
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-red-400 transition-colors">
                      {m.home}
                    </p>
                  </div>

                  <div className="shrink-0 px-2 text-center min-w-[32px]">
                    <span className={`text-xs font-black tabular-nums ${isLive ? "text-amber-400" : "text-zinc-400"}`}>
                      {m.score || (m.away ? "VS" : "•")}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={m.awayLogo} alt={m.away || "?"} />
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
