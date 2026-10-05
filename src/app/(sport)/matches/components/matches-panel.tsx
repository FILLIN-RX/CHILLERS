"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMatches } from "@/services/matches";
import type { MatchLeague, SportMatch } from "@/types/matches";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cacheMatch, localDateStr } from "../match-utils";
import { MatchCard } from "./match-card";
import { TeamLogo } from "../matches-content";
import { DIVIDER, MUTED, ORANGE } from "./match-tabs";

/** Colonne gauche (desktop) de la page détail : liste des matchs du jour. */
export function MatchesPanel({ activeId, date, league }: { activeId: string; date: string; league: string }) {
  const todayStr = useMemo(() => localDateStr(), []);
  const [selectedDate, setSelectedDate] = useState(date);
  const [matches, setMatches] = useState<SportMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(
    async (background = false) => {
      if (!background) setIsLoading(true);
      try {
        const data = await getMatches({
          date: selectedDate,
          league: league !== "all" ? league : undefined,
          sport: "football",
        });
        if (Array.isArray(data)) {
          setMatches(data);
          data.forEach((m) => cacheMatch(m));
        }
      } catch {
        /* silencieux : la colonne reste vide */
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDate, league]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const shift = (delta: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    setSelectedDate(localDateStr(new Date(y, m - 1, d + delta)));
  };

  const groups = useMemo(() => {
    const map: Record<string, { league: MatchLeague; matches: SportMatch[] }> = {};
    for (const m of matches) {
      const key = m.league.id || m.league.name;
      (map[key] ||= { league: m.league, matches: [] }).matches.push(m);
    }
    return Object.values(map);
  }, [matches]);

  const label = useMemo(() => {
    if (selectedDate === todayStr) return "Aujourd'hui";
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  }, [selectedDate, todayStr]);

  return (
    <div>
      <div className="flex items-center justify-between py-3">
        <Link
          href="/matches"
          className="text-[12px] font-semibold uppercase tracking-wide hover:text-white"
          style={{ color: ORANGE }}
        >
          Tous les matchs
        </Link>
        <div className="flex items-center gap-3">
          <button aria-label="Jour précédent" onClick={() => shift(-1)} className="p-1.5">
            <CaretLeft className="h-4 w-4" weight="bold" />
          </button>
          <span className="min-w-[90px] text-center text-[13px] font-semibold capitalize">{label}</span>
          <button aria-label="Jour suivant" onClick={() => shift(1)} className="p-1.5">
            <CaretRight className="h-4 w-4" weight="bold" />
          </button>
        </div>
        <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/5">
          <CalendarBlank className="h-5 w-5" style={{ color: ORANGE }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-5 pt-3 motion-reduce:animate-none" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#1c1c1c]" />
              <div className="h-4 flex-1 rounded bg-[#1c1c1c]" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: MUTED }}>
          Aucun match ce jour.
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.league.id || g.league.name} className="mb-2">
            <div className="flex items-center gap-3 py-3">
              <TeamLogo src={g.league.logo ?? undefined} name={g.league.name} className="h-6 w-6" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold">{g.league.name}</p>
                <p className="truncate text-[11px]" style={{ color: MUTED }}>
                  {g.league.country || "Compétition"}
                </p>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              {g.matches.map((m) => (
                <MatchCard key={m.id} match={m} date={selectedDate} active={String(m.id) === String(activeId)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
