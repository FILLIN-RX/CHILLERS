"use client";

import React from "react";
import { ArrowDown, ArrowUp, SoccerBall, Sneaker } from "@phosphor-icons/react";
import type { MatchPlayer, MatchSummary, TeamRoster } from "@/types/matches";
import { EmptyCard, MUTED } from "./match-tabs";

/** Champs optionnels à mapper depuis ton API (ou à ajouter dans MatchPlayer) */
type Extras = {
  goals?: number;        // buts marqués
  ownGoals?: number;     // csc
  assists?: number;      // passes décisives
  yellowCards?: number;
  redCards?: number;
  subbedOut?: boolean;   // remplacé (titulaire sorti)
  subbedIn?: boolean;    // entré en jeu (déjà dans ton type)
};
type P = MatchPlayer & Extras;

const GREEN = "#34C759";
const RED = "#FF453A";
const LINE = "rgba(255,255,255,0.35)";

/** Découpe les titulaires en lignes selon la formation (ex. 4-3-3). */
function buildRows(roster: TeamRoster): P[][] {
  const sorted = [...roster.starters].sort(
    (a, b) => Number(a.formationPlace || 99) - Number(b.formationPlace || 99)
  ) as P[];
  const nums = (roster.formation || "").split("-").map(Number).filter((n) => n > 0);
  const gk = sorted.find((p) => (p.position || "").toUpperCase().startsWith("G")) ?? sorted[0];
  const field = sorted.filter((p) => p !== gk);
  const total = nums.reduce((s, n) => s + n, 0);
  const layout = total === field.length ? nums : [4, 3, 3];
  const rows: P[][] = [gk ? [gk] : []];
  let i = 0;
  for (const n of layout) {
    rows.push(field.slice(i, i + n));
    i += n;
  }
  if (i < field.length) rows.push(field.slice(i));
  return rows.filter((r) => r.length > 0);
}

/** Terrain vertical aux proportions réelles (68 x 105) */
function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 68 105"
      className="pointer-events-none absolute inset-0 h-full w-full"
      fill="none"
      stroke={LINE}
      strokeWidth={0.35}
    >
      <rect x="2" y="2" width="64" height="101" />
      <line x1="2" y1="52.5" x2="66" y2="52.5" />
      <circle cx="34" cy="52.5" r="9.15" />
      <circle cx="34" cy="52.5" r="0.5" fill={LINE} />
      {/* surfaces du haut */}
      <rect x="13.85" y="2" width="40.3" height="16.5" />
      <rect x="24.85" y="2" width="18.3" height="5.5" />
      <path d="M26.7 18.5 A9.15 9.15 0 0 0 41.3 18.5" />
      {/* surfaces du bas */}
      <rect x="13.85" y="86.5" width="40.3" height="16.5" />
      <rect x="24.85" y="97.5" width="18.3" height="5.5" />
      <path d="M26.7 86.5 A9.15 9.15 0 0 1 41.3 86.5" />
    </svg>
  );
}

function IconBadge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`absolute flex items-center justify-center rounded-full bg-white text-black shadow ${className}`}
    >
      {children}
    </span>
  );
}

function Player({ p, x, y, light }: { p: P; x: number; y: number; light?: boolean }) {
  const goals = p.goals ?? 0;
  const ownGoals = p.ownGoals ?? 0;
  const assists = p.assists ?? 0;
  return (
    <div
      className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="relative">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums sm:h-9 sm:w-9"
          style={{
            background: light ? "#ffffff" : "#111111",
            color: light ? "#111111" : "#ffffff",
            boxShadow: "0 0 0 1.5px rgba(255,255,255,0.55)",
          }}
        >
          {p.jersey || "–"}
        </span>

        {/* Buteur : ballon (rouge si csc) */}
        {goals > 0 && (
          <IconBadge className="-right-2.5 -top-1.5 h-4 min-w-4 gap-px px-px">
            <SoccerBall weight="fill" className="h-3.5 w-3.5" />
            {goals > 1 && <span className="pr-0.5 text-[9px] font-bold leading-none">{goals}</span>}
          </IconBadge>
        )}
        {ownGoals > 0 && (
          <IconBadge className="-right-2.5 -top-1.5 h-4 w-4" >
            <SoccerBall weight="fill" className="h-3.5 w-3.5" style={{ color: RED }} />
          </IconBadge>
        )}

        {/* Passeur décisif : chaussure */}
        {assists > 0 && (
          <IconBadge className="-left-2.5 -top-1.5 h-4 min-w-4 gap-px px-px">
            <Sneaker weight="fill" className="h-3 w-3" />
            {assists > 1 && <span className="pr-0.5 text-[9px] font-bold leading-none">{assists}</span>}
          </IconBadge>
        )}

        {/* Cartons */}
        {(p.redCards ?? 0) > 0 ? (
          <span className="absolute -bottom-1 -left-1.5 h-3 w-2 rounded-[1px]" style={{ background: RED }} />
        ) : (
          (p.yellowCards ?? 0) > 0 && (
            <span className="absolute -bottom-1 -left-1.5 h-3 w-2 rounded-[1px]" style={{ background: "#FFD60A" }} />
          )
        )}

        {/* Remplacé */}
        {p.subbedOut && (
          <span
            className="absolute -bottom-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full"
            style={{ background: RED }}
          >
            <ArrowDown weight="bold" className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </div>
      <span className="w-full truncate text-[10px] font-medium text-white drop-shadow">
        {p.shortName || p.name}
      </span>
    </div>
  );
}

/** Place chaque rangée sur le terrain. mirror = équipe du bas (inversée). */
function TeamPlayers({ roster, mirror }: { roster: TeamRoster; mirror?: boolean }) {
  const rows = buildRows(roster);
  const last = Math.max(rows.length - 1, 1);
  return (
    <>
      {rows.map((row, ri) => {
        const base = 8 + (ri * (44 - 8)) / last; // 8% (gardien) → 44% (attaque)
        const y = mirror ? 100 - base : base;
        return row.map((p, i) => {
          const rx = ((i + 0.5) / row.length) * 100;
          const x = mirror ? 100 - rx : rx;
          return <Player key={p.id} p={p} x={x} y={y} light={!mirror} />;
        });
      })}
    </>
  );
}

function Pitch({ home, away }: { home: TeamRoster; away: TeamRoster }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        aspectRatio: "68 / 105",
        background:
          "repeating-linear-gradient(to bottom, #1f4d2b 0, #1f4d2b 9.5%, #235633 9.5%, #235633 19%)",
      }}
    >
      <PitchMarkings />
      <div className="absolute left-5 top-3 z-10 flex items-baseline gap-2 text-[11px] font-semibold text-white">
        <span>{home.team.name}</span>
        <span className="tabular-nums opacity-70">{home.formation}</span>
      </div>
      <TeamPlayers roster={home} />
      <TeamPlayers roster={away} mirror />
      <div className="absolute bottom-3 left-5 z-10 flex items-baseline gap-2 text-[11px] font-semibold text-white">
        <span>{away.team.name}</span>
        <span className="tabular-nums opacity-70">{away.formation}</span>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
      {children}
    </h3>
  );
}

function MiniIcons({ p }: { p: P }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {(p.goals ?? 0) > 0 && (
        <span className="flex items-center gap-0.5 text-white">
          <SoccerBall weight="fill" className="h-3.5 w-3.5" />
          {(p.goals ?? 0) > 1 && <span className="text-[10px] font-bold">{p.goals}</span>}
        </span>
      )}
      {(p.assists ?? 0) > 0 && <Sneaker weight="fill" className="h-3.5 w-3.5 text-white" />}
      {(p.redCards ?? 0) > 0 ? (
        <span className="h-3 w-2 rounded-[1px]" style={{ background: RED }} />
      ) : (
        (p.yellowCards ?? 0) > 0 && <span className="h-3 w-2 rounded-[1px]" style={{ background: "#FFD60A" }} />
      )}
      {p.subbedIn && <ArrowUp weight="bold" className="h-3.5 w-3.5" style={{ color: GREEN }} />}
    </span>
  );
}

function BenchColumn({ roster }: { roster: TeamRoster }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 truncate text-[12px] font-semibold text-white">{roster.team.name}</p>
      <ul className="space-y-3">
        {(roster.bench as P[]).map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-center text-[12px] font-semibold tabular-nums text-white">
              {p.jersey || "–"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-white">{p.name}</p>
              <p className="truncate text-[11px]" style={{ color: MUTED }}>
                {p.position}
              </p>
            </div>
            <MiniIcons p={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineupsTab({ summary }: { summary: MatchSummary | null }) {
  const rosters = summary?.rosters ?? [];
  if (rosters.length < 2) {
    return <EmptyCard>Line-ups are usually published about an hour before kick-off.</EmptyCard>;
  }
  const [home, away] = rosters;

  return (
    <div className="space-y-8">
      <Pitch home={home} away={away} />

      <section>
        <Label>Substitutes</Label>
        <div className="grid grid-cols-2 gap-6">
          <BenchColumn roster={home} />
          <BenchColumn roster={away} />
        </div>
      </section>

      {summary?.referee && (
        <section>
          <Label>Referee</Label>
          <p className="text-[13px] text-white">{summary.referee}</p>
        </section>
      )}
    </div>
  );
}