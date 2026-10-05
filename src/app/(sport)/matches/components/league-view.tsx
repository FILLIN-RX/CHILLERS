"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMatches } from "@/services/matches";
import type { SportMatch } from "@/types/matches";
import { cacheMatch, formatTime, localDateStr, matchHref } from "../match-utils";

const PRIMARY = "#FF6A00";
const DIVIDER = "#262626";
const MUTED = "#8A8A8A";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export interface LeagueInfo {
  id: string;
  name: string;
  country: string;
  logo: string | null;
}

type LeagueTab = "overview" | "fixtures" | "results";

const TABS: Array<{ id: LeagueTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "fixtures", label: "Fixtures" },
  { id: "results", label: "Results" },
];

const DAYS_AHEAD = 7;
const DAYS_BACK = 7;

function Logo({ src, name, className }: { src?: string | null; name: string; className: string }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  if (!src || err) {
    return (
      <span className={`flex shrink-0 items-center justify-center text-[13px] font-bold uppercase ${className}`} style={{ color: MUTED }}>
        {name[0] ?? "?"}
      </span>
    );
  }
  return <img src={src} alt={name} onError={() => setErr(true)} className={`shrink-0 object-contain ${className}`} />;
}

function dayLabel(dateStr: string, today: string) {
  if (dateStr === today) return "Aujourd'hui";
  const [y, m, d] = dateStr.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

import { MatchCard } from "./match-card";


/** Page d'une compétition : en-tête, onglets, matchs groupés par jour. */
export function LeagueView({ league, onBack }: { league: LeagueInfo; onBack: () => void }) {
  const today = useMemo(() => localDateStr(), []);
  const [tab, setTab] = useState<LeagueTab>("overview");
  const [fixtures, setFixtures] = useState<Record<string, SportMatch[]>>({});
  const [results, setResults] = useState<Record<string, SportMatch[]>>({});
  const [loading, setLoading] = useState(true);

  const loadRange = async (from: number, to: number) => {
    const days = Array.from({ length: to - from + 1 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + from + i);
      return localDateStr(d);
    });
    const lists = await Promise.all(days.map((date) => getMatches({ date, league: league.id, sport: "football" })));
    const out: Record<string, SportMatch[]> = {};
    days.forEach((date, i) => {
      if (lists[i].length) {
        lists[i].forEach((m) => cacheMatch(m));
        out[date] = lists[i];
      }
    });
    return out;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFixtures({});
    setResults({});
    loadRange(0, DAYS_AHEAD - 1)
      .then((r) => !cancelled && setFixtures(r))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id]);

  // Les résultats ne sont chargés qu'à la première ouverture de l'onglet.
  useEffect(() => {
    if (tab !== "results" || Object.keys(results).length > 0) return;
    let cancelled = false;
    setLoading(true);
    loadRange(-DAYS_BACK, -1)
      .then((r) => !cancelled && setResults(r))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, league.id]);

  const source = tab === "results" ? results : fixtures;
  const dates = Object.keys(source).sort((a, b) => (tab === "results" ? b.localeCompare(a) : a.localeCompare(b)));
  const shown = tab === "overview" ? dates.slice(0, 2) : dates;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 py-3 text-[12px]" style={{ color: MUTED }}>
        <button onClick={onBack} className={`hover:text-white ${FOCUS}`}>Football</button>
        <span>›</span>
        <span>{league.country}</span>
        <span>›</span>
        <span className="text-white">{league.name}</span>
      </nav>

      <header className="flex items-center gap-4 py-4">
        <Logo src={league.logo} name={league.name} className="h-12 w-12" />
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold leading-tight">{league.name}</h1>
          <p className="text-[13px]" style={{ color: MUTED }}>{league.country}</p>
        </div>
      </header>

      <div role="tablist" aria-label="Sections de la compétition" className="flex border-b" style={{ borderColor: DIVIDER }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative px-5 py-3 text-[14px] transition-colors ${FOCUS} ${
                active ? "font-semibold text-white" : "text-[#8A8A8A] hover:text-white"
              }`}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 -bottom-px h-[2px]" style={{ background: PRIMARY }} />}
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        {loading ? (
          <div className="animate-pulse space-y-6 pt-4 motion-reduce:animate-none" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full bg-[#1c1c1c]" />
                <div className="h-4 flex-1 rounded bg-[#1c1c1c]" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="px-6 py-16 text-center text-[14px]" style={{ color: MUTED }}>
            {tab === "results" ? "Aucun résultat récent." : "Aucun match programmé prochainement."}
          </p>
        ) : (
          shown.map((date) => (
            <section key={date}>
              <h2 className="pb-1 pt-5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                {dayLabel(date, today)}
              </h2>
              <div className="space-y-2 pt-2">
                {source[date].map((m) => (
                  <MatchCard key={m.id} match={m} date={date} />
                ))}
              </div>
            </section>
          ))
        )}

        {tab === "overview" && !loading && dates.length > shown.length && (
          <button
            onClick={() => setTab("fixtures")}
            className={`mt-4 w-full py-3 text-center text-[13px] font-semibold ${FOCUS}`}
            style={{ color: PRIMARY }}
          >
            Voir tous les matchs à venir
          </button>
        )}
      </div>
    </div>
  );
}
