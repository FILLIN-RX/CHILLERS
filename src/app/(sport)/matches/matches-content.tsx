"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { LeagueView } from "./components/league-view";
import { MatchCard } from "./components/match-card";
import { useSearchParams } from "next/navigation";
import { getMatches } from "@/services/matches";
import type { SportMatch, MatchLeague } from "@/types/matches";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react";
import { FONT_STACK, cacheMatch, formatTime, localDateStr, matchHref } from "./match-utils";

/** Couleur principale de l'application. */
const PRIMARY = "#FF6A00";
const BG = "#111111";
const DIVIDER = "#262626";
const MUTED = "#8A8A8A";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// ─── Logo sécurisé anti-404 (sans carte autour) ───
export function TeamLogo({ src, name, className = "h-8 w-8" }: { src?: string; name: string; className?: string }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <span className={`flex shrink-0 items-center justify-center text-[13px] font-bold uppercase text-[#8A8A8A] ${className}`}>
        {name ? name[0] : "?"}
      </span>
    );
  }

  return <img src={src} alt={name} onError={() => setHasError(true)} className={`shrink-0 object-contain ${className}`} />;
}

// ─── Championnats majeurs (football uniquement) ───
const MAJOR_LEAGUES: Array<{ id: string; name: string; country: string; logo: string | null }> = [
  { id: "all", name: "Tous les championnats", country: "Monde entier", logo: null },
  { id: "uefa.champions", name: "Ligue des Champions", country: "Europe", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png" },
  { id: "eng.1", name: "Premier League", country: "Angleterre", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png" },
  { id: "esp.1", name: "LaLiga", country: "Espagne", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png" },
  { id: "fra.1", name: "Ligue 1", country: "France", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png" },
  { id: "ita.1", name: "Serie A", country: "Italie", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png" },
  { id: "ger.1", name: "Bundesliga", country: "Allemagne", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png" },
  { id: "uefa.europa", name: "Ligue Europa", country: "Europe", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png" },
  { id: "uefa.nations", name: "UEFA Nations League", country: "Europe", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2034.png" },
  { id: "sau.1", name: "Saudi Pro League", country: "Arabie saoudite", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2177.png" },
  { id: "usa.1", name: "MLS", country: "États-Unis", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png" },
  { id: "conmebol.libertadores", name: "Copa Libertadores", country: "Amérique du Sud", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2676.png" },
];

export default function MatchesContent() {
  const searchParams = useSearchParams();
  const todayStr = useMemo(() => localDateStr(), []);

  const [selectedDate, setSelectedDate] = useState<string>(searchParams?.get("date") || todayStr);
  const [selectedLeague, setSelectedLeague] = useState<string>(searchParams?.get("league") || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [matches, setMatches] = useState<SportMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const replaceParam = (key: string, value: string | null) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url.toString());
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    replaceParam("date", date);
  };

  const shiftDate = (delta: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const next = new Date(y, m - 1, d + delta);
    handleDateChange(localDateStr(next));
  };

  const handleLeagueChange = (leagueId: string) => {
    setSelectedLeague(leagueId);
    setSearchQuery("");
    replaceParam("league", leagueId !== "all" ? leagueId : null);
  };

  const fetchMatchesList = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      try {
        const data = await getMatches({
          date: selectedDate,
          league: selectedLeague !== "all" ? selectedLeague : undefined,
          sport: "football",
        });
        if (Array.isArray(data)) {
          setMatches(data);
          data.forEach((m) => cacheMatch(m));
        }
      } catch (err) {
        console.warn("[MatchesContent] Erreur récupération des matchs:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDate, selectedLeague]
  );

  useEffect(() => {
    fetchMatchesList();
  }, [fetchMatchesList]);

  // Polling automatique 30s
  useEffect(() => {
    const interval = setInterval(() => fetchMatchesList(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchMatchesList]);

  const leagueInfo = useMemo(
    () => (selectedLeague === "all" ? null : MAJOR_LEAGUES.find((l) => l.id === selectedLeague) ?? null),
    [selectedLeague]
  );

  const filteredMatches = useMemo(() => {
    let result = matches;
    if (liveOnly) result = result.filter((m) => m.status === "live");
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.league.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [matches, searchQuery, liveOnly]);

  const groupedByLeague = useMemo(() => {
    const groups: Record<string, { league: MatchLeague; matches: SportMatch[] }> = {};
    for (const match of filteredMatches) {
      const key = match.league.id || match.league.name;
      if (!groups[key]) groups[key] = { league: match.league, matches: [] };
      groups[key].matches.push(match);
    }
    return Object.values(groups);
  }, [filteredMatches]);

  const dateLabel = useMemo(() => {
    if (selectedDate === todayStr) return "Aujourd'hui";
    const [y, m, d] = selectedDate.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [selectedDate, todayStr]);

  return (
    <div
      className="min-h-screen pb-24 text-white antialiased"
      style={{ fontFamily: FONT_STACK, background: BG }}
    >
      <div className="mx-auto max-w-[1100px] px-3 sm:px-6">
        <div className="flex flex-col items-start gap-8 lg:flex-row">
          {/* ─── Championnats (desktop) ─── */}
          <aside className="sticky top-[72px] hidden max-h-[calc(100vh-90px)] w-64 shrink-0 overflow-y-auto lg:block">
            <h2 className="px-3 pb-3 text-[12px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Compétitions
            </h2>
            <ul>
              {MAJOR_LEAGUES.map((league) => {
                const selected = selectedLeague === league.id;
                return (
                  <li key={league.id}>
                    <button
                      onClick={() => handleLeagueChange(league.id)}
                      className={`flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${FOCUS}`}
                      style={{ borderColor: selected ? PRIMARY : "transparent" }}
                    >
                      {league.logo ? (
                        <TeamLogo src={league.logo} name={league.name} className="h-6 w-6" />
                      ) : (
                        <span className="h-6 w-6 shrink-0" />
                      )}
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] ${selected ? "font-semibold text-white" : "text-[#B0B0B0]"}`}>
                          {league.name}
                        </span>
                        <span className="block truncate text-[11px]" style={{ color: MUTED }}>
                          {league.country}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* ─── Contenu principal ─── */}
          <main className="w-full min-w-0 flex-1">
            {/* Barre date + live */}
            {!leagueInfo && (
            <div className="flex items-center justify-between py-3">
              <button
                onClick={() => setLiveOnly((v) => !v)}
                aria-pressed={liveOnly}
                className={`flex h-10 min-w-[48px] items-center justify-center rounded-full px-3 text-[11px] font-bold uppercase tracking-wide transition-colors ${FOCUS}`}
                style={liveOnly ? { background: PRIMARY, color: "#fff" } : { background: "#fff", color: "#111" }}
              >
                Live
              </button>

              <div className="flex items-center gap-5">
                <button aria-label="Jour précédent" onClick={() => shiftDate(-1)} className={`p-2 ${FOCUS}`}>
                  <CaretLeft className="h-4 w-4" weight="bold" />
                </button>
                <span className="min-w-[110px] text-center text-[14px] font-semibold">{dateLabel}</span>
                <button aria-label="Jour suivant" onClick={() => shiftDate(1)} className={`p-2 ${FOCUS}`}>
                  <CaretRight className="h-4 w-4" weight="bold" />
                </button>
              </div>

              <label
                title="Choisir une date"
                className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/5"
              >
                <CalendarBlank className="h-5 w-5" style={{ color: PRIMARY }} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && handleDateChange(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
            )}

            {/* Compétitions (mobile) : onglets texte soulignés */}
            <div className="no-scrollbar -mx-3 flex overflow-x-auto border-b px-3 lg:hidden" style={{ borderColor: DIVIDER }}>
              {MAJOR_LEAGUES.map((league) => {
                const selected = selectedLeague === league.id;
                return (
                  <button
                    key={league.id}
                    onClick={() => handleLeagueChange(league.id)}
                    className={`relative shrink-0 px-3 py-3 text-[13px] transition-colors ${FOCUS} ${
                      selected ? "font-semibold text-white" : "text-[#8A8A8A]"
                    }`}
                  >
                    {league.id === "all" ? "Tous" : league.name}
                    {selected && <span className="absolute inset-x-3 -bottom-px h-[2px]" style={{ background: PRIMARY }} />}
                  </button>
                );
              })}
            </div>

            {leagueInfo ? (
              <LeagueView league={leagueInfo} onBack={() => handleLeagueChange("all")} />
            ) : (
            <>
            {/* Recherche */}
            <div className="relative my-3">
              <MagnifyingGlass className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: MUTED }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une équipe ou une ligue"
                className="w-full border-b bg-transparent py-2.5 pl-7 pr-8 text-[14px] text-white placeholder-[#6a6a6a] transition-colors focus:outline-none"
                style={{ borderColor: DIVIDER }}
                onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                onBlur={(e) => (e.currentTarget.style.borderColor = DIVIDER)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Effacer"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: MUTED }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Liste */}
            <section>
              {isLoading ? (
                <div className="animate-pulse space-y-6 pt-4 motion-reduce:animate-none" aria-busy="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-[#1c1c1c]" />
                      <div className="h-4 flex-1 rounded bg-[#1c1c1c]" />
                    </div>
                  ))}
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <p className="text-[16px] font-semibold">Aucun match trouvé</p>
                  <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                    {liveOnly ? "Aucun match en direct pour le moment." : "Pas de rencontre programmée pour cette date."}
                  </p>
                  <button
                    onClick={() => {
                      setLiveOnly(false);
                      setSearchQuery("");
                      handleLeagueChange("all");
                      handleDateChange(todayStr);
                    }}
                    className={`mt-5 rounded-full px-5 py-2 text-[13px] font-semibold text-white ${FOCUS}`}
                    style={{ background: PRIMARY }}
                  >
                    Réinitialiser
                  </button>
                </div>
              ) : (
                groupedByLeague.map((group) => {
                  const leagueKey = group.league.id || group.league.name;
                  const isCollapsed = collapsed[leagueKey];
                  return (
                    <div key={leagueKey} className="mb-2">
                      <button
                        onClick={() => setCollapsed((prev) => ({ ...prev, [leagueKey]: !prev[leagueKey] }))}
                        className={`flex w-full items-center justify-between py-3 text-left ${FOCUS}`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <TeamLogo src={group.league.logo ?? undefined} name={group.league.name} className="h-6 w-6" />
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-bold">{group.league.name}</span>
                            <span className="block truncate text-[12px]" style={{ color: MUTED }}>
                              {group.league.country || "Compétition"}
                            </span>
                          </span>
                        </span>
                        {isCollapsed ? <CaretDown className="h-4 w-4" /> : <CaretUp className="h-4 w-4" />}
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-2 pt-2">
                          {group.matches.map((match) => (
                            <MatchCard key={match.id} match={match} date={selectedDate} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
            </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Composant Ligne / Carte de match pour compatibilité ───
export function MatchRow({ match, date, active }: { match: SportMatch; date: string; active?: boolean }) {
  return <MatchCard match={match} date={date} active={active} />;
}

