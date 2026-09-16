"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getLiveBallMatches, getLiveBallChampionsLeague, getLiveBallLiveAvailable } from "@/services/liveball";
import type { LiveBallMatch } from "@/types/liveball";

function formatMatchTime(ts?: number): string {
  if (!ts) return "Bientôt";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function TeamCrest({ src, alt }: { src?: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const initials = (alt || "?")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!src || broken) {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-300 shrink-0 shadow-inner">
        {initials || "?"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-8 h-8 object-contain shrink-0 rounded-full bg-white/5 p-0.5"
    />
  );
}

const LEAGUE_TABS = [
  { id: "all", label: "Tous les Matchs", icon: "⚽" },
  { id: "live", label: "En Direct", icon: "🔴" },
  { id: "cl", label: "Champions League", icon: "🏆" },
  { id: "pl", label: "Premier League", icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "liga", label: "La Liga", icon: "🇪🇸" },
  { id: "seriea", label: "Serie A", icon: "🇮🇹" },
  { id: "bundesliga", label: "Bundesliga", icon: "🇩🇪" },
  { id: "ligue1", label: "Ligue 1", icon: "🇫🇷" },
];

export default function LiveMatchesRow({
  title = "Matchs de Football en Direct",
  className = "px-4 sm:px-8 md:px-12 lg:px-16 my-8",
  noScrollMargin = false,
}: {
  title?: string;
  className?: string;
  noScrollMargin?: boolean;
}) {
  const [activeLeague, setActiveLeague] = useState<string>("all");

  const { data: lbMatches = [] } = useQuery({
    queryKey: ["live", "liveball", "all"],
    queryFn: () => getLiveBallMatches(),
    staleTime: 60_000,
  });

  const { data: clMatches = [] } = useQuery({
    queryKey: ["live", "liveball", "champions-league"],
    queryFn: () => getLiveBallChampionsLeague(),
    staleTime: 60_000,
  });

  const { data: liveAvailable = [] } = useQuery({
    queryKey: ["live", "liveball", "available"],
    queryFn: () => getLiveBallLiveAvailable(),
    staleTime: 5 * 60_000,
  });

  // Merge and deduplicate matches
  const allMatches = useMemo(() => {
    const map = new Map<string, LiveBallMatch>();
    for (const m of [...liveAvailable, ...lbMatches, ...clMatches]) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [lbMatches, clMatches, liveAvailable]);

  // Filter matches based on selected tab
  const filteredMatches = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const valid = allMatches.filter((m) => !m.startTs || m.startTs > nowSec - 4 * 3600);

    if (activeLeague === "live") {
      return valid.filter((m) => m.status === "live");
    }
    if (activeLeague === "cl") {
      return valid.filter(
        (m) =>
          m.league &&
          (m.league.toLowerCase().includes("champion") || m.league.toLowerCase().includes("uefa"))
      );
    }
    if (activeLeague === "pl") {
      return valid.filter(
        (m) =>
          m.league &&
          (m.league.toLowerCase().includes("premier") ||
            m.league.toLowerCase().includes("epl") ||
            m.league.toLowerCase().includes("england"))
      );
    }
    if (activeLeague === "liga") {
      return valid.filter(
        (m) =>
          m.league &&
          (m.league.toLowerCase().includes("liga") ||
            m.league.toLowerCase().includes("spain") ||
            m.league.toLowerCase().includes("primera"))
      );
    }
    if (activeLeague === "seriea") {
      return valid.filter(
        (m) =>
          m.league &&
          (m.league.toLowerCase().includes("serie a") ||
            m.league.toLowerCase().includes("italy") ||
            m.league.toLowerCase().includes("italia"))
      );
    }
    if (activeLeague === "bundesliga") {
      return valid.filter(
        (m) =>
          m.league &&
          (m.league.toLowerCase().includes("bundesliga") || m.league.toLowerCase().includes("germany"))
      );
    }
    if (activeLeague === "ligue1") {
      return valid.filter(
        (m) =>
          m.league &&
          (m.league.toLowerCase().includes("ligue 1") || m.league.toLowerCase().includes("france"))
      );
    }
    return valid;
  }, [allMatches, activeLeague]);

  if (allMatches.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
              {title}
            </h2>
          </div>
          {allMatches.filter((m) => m.status === "live").length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wider bg-red-600/90 text-white px-2 py-0.5 rounded-full animate-pulse shadow-sm">
              {allMatches.filter((m) => m.status === "live").length} En Direct
            </span>
          )}
        </div>

        <Link
          href="/live"
          className="text-xs font-bold text-[#D70466] hover:text-[#ff2b89] transition-colors flex items-center gap-1 shrink-0"
        >
          Voir toutes les diffusions Live →
        </Link>
      </div>

      {/* League Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-1 px-1">
        {LEAGUE_TABS.map((tab) => {
          const isSelected = activeLeague === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveLeague(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 focus:outline-none ${
                isSelected
                  ? "bg-[#D70466] text-white shadow-lg shadow-[#D70466]/25 scale-[1.02]"
                  : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Match Cards Row */}
      {filteredMatches.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 border border-white/5 text-center">
          <p className="text-xs text-zinc-500 font-medium">
            Aucun match programmé pour ce championnat en ce moment.
          </p>
        </div>
      ) : (
        <div
          className={`flex gap-3.5 overflow-x-auto no-scrollbar py-2 ${
            noScrollMargin
              ? "-mx-1 px-1"
              : "-mx-4 px-4 sm:-mx-8 sm:px-8 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16"
          }`}
        >
          {filteredMatches.map((m) => {
            const isLive = m.status === "live";
            const isUefa =
              m.league &&
              (m.league.toLowerCase().includes("champion") || m.league.toLowerCase().includes("uefa"));

            return (
              <Link
                key={m.id}
                href={`/live/lb/${m.id}`}
                className={`group shrink-0 flex flex-col justify-between rounded-2xl p-3.5 w-[220px] sm:w-[240px] transition-all duration-300 hover:scale-[1.03] ${
                  isLive
                    ? "bg-zinc-900/95 border border-red-600/40 hover:border-red-500 hover:shadow-xl hover:shadow-red-600/15"
                    : "bg-zinc-900/80 border border-white/10 hover:border-white/20 hover:shadow-lg"
                }`}
              >
                {/* Card Top: League & Status Badge */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <span
                    className={`text-[10px] font-bold truncate max-w-[130px] ${
                      isUefa ? "text-amber-400" : "text-zinc-400"
                    }`}
                  >
                    {m.league || "Football"}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isLive
                        ? "bg-red-600 text-white animate-pulse"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {isLive ? "● DIRECT" : formatMatchTime(m.startTs)}
                  </span>
                </div>

                {/* Card Middle: Teams + Score */}
                <div className="flex items-center justify-between gap-2 my-1">
                  {/* Home Team */}
                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={m.homeLogo} alt={m.home} />
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-[#D70466] transition-colors">
                      {m.home}
                    </p>
                  </div>

                  {/* Score / VS Badge */}
                  <div className="shrink-0 px-2 py-1 rounded-lg bg-black/60 border border-white/10 text-center min-w-[36px]">
                    <span
                      className={`text-xs font-black tabular-nums ${
                        isLive ? "text-amber-400" : "text-zinc-400"
                      }`}
                    >
                      {m.score || "VS"}
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={m.awayLogo} alt={m.away} />
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-[#D70466] transition-colors">
                      {m.away}
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Watch CTA */}
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">
                  <span>Regarder le direct</span>
                  <span>→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
