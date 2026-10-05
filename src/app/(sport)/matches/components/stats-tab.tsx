"use client";

import React, { useMemo } from "react";
import type { MatchSummary, SportMatch } from "@/types/matches";
import { CARD, DIVIDER, EmptyCard, MUTED } from "./match-tabs";

const STAT_LABELS: Array<{ name: string; label: string }> = [
  { name: "possessionPct", label: "Possession" },
  { name: "totalShots", label: "Shots" },
  { name: "shotsOnTarget", label: "Shots on target" },
  { name: "totalPasses", label: "Passes" },
  { name: "wonCorners", label: "Corners" },
  { name: "foulsCommitted", label: "Fouls" },
  { name: "yellowCards", label: "Yellow cards" },
  { name: "offsides", label: "Offsides" },
  { name: "saves", label: "Saves" },
];

const toNum = (v: string) => {
  const n = parseFloat(v.replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

function StatRow({ label, home, away }: { label: string; home: string; away: string }) {
  const h = toNum(home);
  const a = toNum(away);
  const total = h + a || 1;
  const homeLeads = h > a;
  const awayLeads = a > h;
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between text-[14px] tabular-nums">
        <span className={homeLeads ? "font-semibold text-white" : "text-[#B0B0B0]"}>{home}</span>
        <span className="text-[12px]" style={{ color: MUTED }}>{label}</span>
        <span className={awayLeads ? "font-semibold text-white" : "text-[#B0B0B0]"}>{away}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        <div className="flex h-1 flex-1 justify-end overflow-hidden rounded-full bg-[#2a2a2a]">
          <div className={homeLeads ? "bg-white" : "bg-[#666]"} style={{ width: `${(h / total) * 100}%` }} />
        </div>
        <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-[#2a2a2a]">
          <div className={awayLeads ? "bg-white" : "bg-[#666]"} style={{ width: `${(a / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function TeamChip({ name, logo, reverse }: { name: string; logo?: string | null; reverse?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${reverse ? "flex-row-reverse" : ""}`}>
      {logo && <img src={logo} alt="" className="h-5 w-5 shrink-0 object-contain" />}
      <span className="truncate text-[13px] text-[#B0B0B0]">{name}</span>
    </div>
  );
}

export function StatsTab({ match, summary }: { match: SportMatch; summary: MatchSummary | null }) {
  const stats = useMemo(() => {
    if (!summary?.boxscore || summary.boxscore.length < 2) return [];
    const home = summary.boxscore[0]?.statistics || [];
    const away = summary.boxscore[1]?.statistics || [];
    const rows: Array<{ label: string; home: string; away: string }> = [];
    for (const s of STAT_LABELS) {
      const h = home.find((x) => x.name === s.name);
      const a = away.find((x) => x.name === s.name);
      if (h || a) rows.push({ label: s.label, home: h?.displayValue || "0", away: a?.displayValue || "0" });
    }
    return rows;
  }, [summary]);

  if (stats.length === 0) return <EmptyCard>Statistics are not available for this match.</EmptyCard>;

  return (
    <div className="rounded-xl border px-4 py-2" style={{ background: CARD, borderColor: DIVIDER }}>
      <div className="flex items-center justify-between py-3">
        <TeamChip name={match.homeTeam.name} logo={match.homeTeam.logo} />
        <TeamChip name={match.awayTeam.name} logo={match.awayTeam.logo} reverse />
      </div>
      <div className="divide-y border-t" style={{ borderColor: DIVIDER }}>
        {stats.map((s) => (
          <StatRow key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}
