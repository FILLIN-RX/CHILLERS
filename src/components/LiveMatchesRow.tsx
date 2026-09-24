"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "@phosphor-icons/react";
import {
  getLiveBallMatches,
  getLiveBallLeagueMatches,
  getLiveBallLiveAvailable,
} from "@/services/liveball";
import type { LiveBallMatch } from "@/types/liveball";

function SoccerBallIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 7 15 9.5 14 13.5 10 13.5 9 9.5 12 7" fill="currentColor" fillOpacity="0.25" />
      <path d="M12 2v5" />
      <path d="M21.5 8.5l-4.5 1" />
      <path d="M18.5 19.5l-3.5-3" />
      <path d="M5.5 19.5l3.5-3" />
      <path d="M2.5 8.5l4.5 1" />
    </svg>
  );
}

function LivePulseIcon() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
    </span>
  );
}

function TrophyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 2v7a6 6 0 0 0 12 0V2H6z" fill="#00E5FF" fillOpacity="0.2" />
    </svg>
  );
}

function EnglandFlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm`} viewBox="0 0 512 512">
      <circle cx="256" cy="256" r="256" fill="#f5f5f5" />
      <path d="M216 0h80v512h-80z" fill="#ce1124" />
      <path d="M0 216h512v80H0z" fill="#ce1124" />
    </svg>
  );
}

function SpainFlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm`} viewBox="0 0 512 512">
      <circle cx="256" cy="256" r="256" fill="#c60b1e" />
      <path d="M0 128h512v256H0z" fill="#ffc400" />
    </svg>
  );
}

function ItalyFlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm`} viewBox="0 0 512 512">
      <circle cx="256" cy="256" r="256" fill="#009246" />
      <path d="M170.6 0h170.8v512H170.6z" fill="#f5f5f5" />
      <path d="M341.4 0H512v512H341.4z" fill="#ce2b37" />
    </svg>
  );
}

function GermanyFlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm`} viewBox="0 0 512 512">
      <circle cx="256" cy="256" r="256" fill="#ffcc00" />
      <path d="M0 0h512v341.4H0z" fill="#ff0000" />
      <path d="M0 0h512v170.6H0z" fill="#1a1a1a" />
    </svg>
  );
}

function FranceFlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} rounded-full overflow-hidden shrink-0 shadow-sm`} viewBox="0 0 512 512">
      <circle cx="256" cy="256" r="256" fill="#002395" />
      <path d="M170.6 0h170.8v512H170.6z" fill="#f5f5f5" />
      <path d="M341.4 0H512v512H341.4z" fill="#ed2939" />
    </svg>
  );
}

const LEAGUE_TABS = [
  { id: "all", label: "Tous les Matchs", icon: SoccerBallIcon },
  { id: "live", label: "En Direct", icon: LivePulseIcon },
  { id: "cl", label: "Champions League", icon: TrophyIcon, slug: "champions-league" },
  { id: "pl", label: "Premier League", icon: EnglandFlagIcon, slug: "premier-league" },
  { id: "liga", label: "La Liga", icon: SpainFlagIcon, slug: "la-liga" },
  { id: "seriea", label: "Serie A", icon: ItalyFlagIcon, slug: "serie-a" },
  { id: "bundesliga", label: "Bundesliga", icon: GermanyFlagIcon, slug: "bundesliga" },
  { id: "ligue1", label: "Ligue 1", icon: FranceFlagIcon, slug: "ligue-1" },
];

function formatMatchTime(ts?: number): string {
  if (!ts) return "Bientôt";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatMatchDateTime(ts?: number): string {
  if (!ts) return "Bientôt";
  const d = new Date(ts * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  if (isToday) {
    return `Aujourd'hui à ${timeStr}`;
  }
  if (isTomorrow) {
    return `Demain à ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${dateStr} • ${timeStr}`;
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
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xs font-black text-zinc-400 shrink-0">
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
      className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0 drop-shadow-md"
    />
  );
}

export default function LiveMatchesRow({
  title = "Matchs de Football en Direct",
  className = "space-y-3 my-6",
  noScrollMargin = false,
}: {
  title?: string;
  className?: string;
  noScrollMargin?: boolean;
}) {
  const [activeLeague, setActiveLeague] = useState<string>("all");

  const currentTab = LEAGUE_TABS.find((t) => t.id === activeLeague);
  const leagueSlug = currentTab && "slug" in currentTab ? (currentTab as { slug?: string }).slug : undefined;

  const { data: lbMatches = [] } = useQuery({
    queryKey: ["live", "liveball", "all"],
    queryFn: () => getLiveBallMatches(),
    staleTime: 60_000,
  });

  const { data: leagueMatches = [], isLoading: isLoadingLeague } = useQuery({
    queryKey: ["live", "liveball", "league", leagueSlug],
    queryFn: () => (leagueSlug ? getLiveBallLeagueMatches(leagueSlug) : Promise.resolve([])),
    enabled: !!leagueSlug,
    staleTime: 60_000,
  });

  // Filter matches based on selected tab
  const filteredMatches = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);

    if (activeLeague === "live") {
      const map = new Map<string, LiveBallMatch>();
      for (const m of lbMatches) {
        if (m && m.id && m.status === "live" && !map.has(m.id)) {
          map.set(m.id, m);
        }
      }
      return Array.from(map.values());
    }

    if (activeLeague === "all") {
      const map = new Map<string, LiveBallMatch>();
      for (const m of lbMatches) {
        if (m && m.id && !map.has(m.id)) {
          map.set(m.id, m);
        }
      }
      return Array.from(map.values()).filter(
        (m) => !m.startTs || m.startTs > nowSec - 4 * 3600
      );
    }

    // Specific league tab (Premier League, La Liga, Serie A, etc.)
    const map = new Map<string, LiveBallMatch>();
    for (const m of leagueMatches) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values()).filter(
      (m) => !m.startTs || m.startTs > nowSec - 4 * 3600
    );
  }, [activeLeague, lbMatches, leagueMatches]);

  const liveCount = useMemo(() => {
    const map = new Set<string>();
    for (const m of lbMatches) if (m?.id && m.status === "live") map.add(m.id);
    return map.size;
  }, [lbMatches]);

  if (lbMatches.length === 0 && leagueMatches.length === 0 && !isLoadingLeague) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Header Row - Aligned cleanly with flexible wrapping on mobile */}
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

        <Link
          href="/live"
          className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 group transition-colors focus:outline-none shrink-0 self-end sm:self-auto"
        >
          <span>Voir tout le Live</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* League Filter Chips - Borderless sleek buttons */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-0.5 px-1">
        {LEAGUE_TABS.map((tab) => {
          const isSelected = activeLeague === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveLeague(tab.id)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 focus:outline-none cursor-pointer ${
                isSelected
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30 scale-[1.02]"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Match Cards Row - No background on cards, pure red live indicator */}
      {isLoadingLeague && leagueSlug ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-medium">Chargement des matchs de la compétition...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center">
          <p className="text-xs text-zinc-500 font-medium">
            Aucun match programmé pour ce championnat en ce moment.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 px-1">
          {filteredMatches.map((m) => {
            const isLive = m.status === "live";
            const isUefa =
              m.league &&
              (m.league.toLowerCase().includes("champion") || m.league.toLowerCase().includes("uefa"));

            return (
              <Link
                key={m.id}
                href={`/live/lb/${m.id}`}
                className="group shrink-0 flex flex-col justify-between rounded-2xl p-3.5 w-[260px] sm:w-[280px] bg-transparent hover:bg-white/[0.04] transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              >
                {/* Card Top: League & Status Badge (Pure red text, no background) */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <span
                    className={`text-[10px] font-bold truncate max-w-[130px] ${
                      isUefa ? "text-amber-400" : "text-zinc-400"
                    }`}
                  >
                    {m.league || "Football"}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      isLive
                        ? "text-red-500 flex items-center gap-1"
                        : "text-zinc-500"
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

                {/* Card Middle: Teams + Score */}
                <div className="flex items-center justify-between gap-2 my-1">
                  {/* Home Team */}
                  <div className="flex-1 flex flex-col items-center text-center min-w-0">
                    <TeamCrest src={m.homeLogo} alt={m.home} />
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-red-400 transition-colors">
                      {m.home}
                    </p>
                  </div>

                  {/* Score / VS Badge */}
                  <div className="shrink-0 px-2 text-center min-w-[32px]">
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
                    <p className="mt-1.5 text-[11px] font-bold text-white truncate w-full group-hover:text-red-400 transition-colors">
                      {m.away}
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Watch CTA for Live, or Date & Time for non-live */}
                <div className="mt-2.5 pt-2 flex items-center justify-center text-center">
                  {isLive ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 group-hover:text-red-400 transition-colors">
                      <span>Regarder le direct</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                      {formatMatchDateTime(m.startTs)}
                    </span>
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
