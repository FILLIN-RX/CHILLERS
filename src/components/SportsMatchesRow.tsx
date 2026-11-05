"use client";

/**
 * Rangée « Matchs de Football en Direct » : les grandes compétitions du jour
 * servies par notre API de scores (/api/matches — ESPN), en exclusivité.
 * Avant, la rangée dépendait de LiveBall : ids opaques, graphies françaises,
 * jointures d'écussons fragiles. Les ids natifs du service de score rendent la
 * carte directe (lien vers /matches/[id]).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { getMatches } from "@/services/matches";
import { getSportsMatches } from "@/services/sports";
import { isMajorCompetition, formatMatchDay, formatMatchTime, sameTeam } from "@/lib/match-poster";
import CompetitionBadge from "@/components/CompetitionBadge";
import { MatchBackdrop, TeamCrest } from "@/components/MatchCardBackdrop";
import type { SportMatch } from "@/types/matches";

function isAsianCompetition(name?: string): boolean {
  return /afc|asian|japan|kleague|j\.league/i.test(name ?? "");
}

function kickoffTs(match: SportMatch): number | undefined {
  if (typeof match.startTimestamp === "number" && Number.isFinite(match.startTimestamp)) {
    // Le service publie les millisecondes.
    return Math.floor(match.startTimestamp / 1000);
  }
  const parsed = Date.parse(match.startTime);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : undefined;
}

export default function SportsMatchesRow({
  title = "Matchs de Football en Direct",
  className = "space-y-3 my-6",
}: {
  title?: string;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoTween = useRef<gsap.core.Tween | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches", "football", "today"],
    queryFn: () => getMatches({ sport: "football" }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const { data: sportsMatches = [], isFetched: sportsFetched } = useQuery({
    queryKey: ["live", "sports", "row"],
    queryFn: () => getSportsMatches(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  /** Un lot provider ne doit cacher aucun match côté vitrine : on garde tout si l'appel échoue. */
  const providerReady = sportsFetched && sportsMatches.length > 0;

  const hasStream = useMemo(
    () => (match: SportMatch) =>
      sportsMatches.some(
        (sm) =>
          (sameTeam(match.homeTeam.name, sm.home) && sameTeam(match.awayTeam.name, sm.away)) ||
          (sameTeam(match.homeTeam.name, sm.away) && sameTeam(match.awayTeam.name, sm.home)),
      ),
    [sportsMatches],
  );

  // Grandes compétitions uniquement : le flux ESPN global publie aussi les
  // catégories jeunes/réserves/divisions inférieures, qui n'ont pas leur place
  // en vitrine.
  const cards = useMemo(() => {
    const byId = new Map<string, SportMatch>();
    for (const match of matches) {
      if (!match?.id || !match.homeTeam?.name || !match.awayTeam?.name) continue;
      if (match.status === "finished") continue;
      if (!isMajorCompetition(match.league?.name)) continue;
      // Seuls les matchs qu'un provider diffuse sont en vitrine — les
      // affiches sans flux (ligue non couverte) n'ont plus d'utilité.
      // Exception zonale : nos providers écrivent l'Asie en translittération
      // russe (« Layon Siti », « Tempayns ») que la jointure ne reconnaît
      // pas — elle écarterait des matchs bien diffusables.
      if (providerReady && !hasStream(match) && !isAsianCompetition(match.league?.name)) continue;
      if (!byId.has(match.id)) byId.set(match.id, match);
    }
    return [...byId.values()].sort((a, b) => {
      const rank = (s?: string) => (s === "live" ? 0 : 1);
      if (a.status !== b.status) return rank(a.status) - rank(b.status);
      return (
        (a.startTimestamp ?? Number.MAX_SAFE_INTEGER) - (b.startTimestamp ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }, [matches, providerReady, hasStream]);

  const updateScrollState = useCallback(() => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atLeft = el.scrollLeft > 8;
      const atRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 8;
      setCanScrollLeft((prev) => (prev !== atLeft ? atLeft : prev));
      setCanScrollRight((prev) => (prev !== atRight ? atRight : prev));
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, cards.length]);

  // Carrousel : défilement automatique (desktop, motion réduite respectée).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 768) return;
    const el = scrollRef.current;
    if (!el || !document.contains(el)) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;

    const tween = gsap.to(el, {
      scrollLeft: maxScroll,
      duration: maxScroll / 0.5 / 60,
      ease: "none",
      paused: isHovered,
      repeat: -1,
      yoyo: false,
      onRepeat: () => {
        if (document.contains(el)) {
          gsap.set(el, { scrollLeft: 0 });
        }
      },
      repeatDelay: 0.8,
      onUpdate: updateScrollState,
      onInterrupt: () => {
        autoTween.current = null;
      },
    });

    autoTween.current = tween;

    return () => {
      if (tween) tween.kill();
      autoTween.current = null;
    };
  }, [isHovered, updateScrollState, cards.length]);

  useEffect(() => {
    const tween = autoTween.current;
    if (!tween) return;
    if (isHovered) {
      tween.pause();
    } else {
      tween.resume();
    }
  }, [isHovered]);

  const scrollBy = (amount: number) => {
    const el = scrollRef.current;
    if (!el || !document.contains(el)) return;
    if (autoTween.current) autoTween.current.kill();
    gsap.to(el, {
      scrollLeft: el.scrollLeft + amount,
      duration: 0.6,
      ease: "power3.out",
      onUpdate: updateScrollState,
    });
  };

  if (!isLoading && cards.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2 pr-1">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span className="h-3.5 w-1 bg-red-600 rounded-full" />
          {title}
        </h2>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Link
            href="/matches"
            className="text-xs sm:text-sm font-bold text-red-500 hover:text-red-400 flex items-center gap-1.5 group transition-colors shrink-0"
          >
            <span>Scores &amp; Matchs</span>
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

      {isLoading ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-medium">Chargement des rencontres...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-zinc-900/40 text-center">
          <p className="text-xs text-zinc-500 font-medium">Aucune rencontre disponible.</p>
        </div>
      ) : (
        <div
          className="relative group/row"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            ref={scrollRef}
            className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-2 px-1"
          >
            {cards.map((match, idx) => {
              const isLive = match.status === "live";
              const ts = kickoffTs(match);
              const day = formatMatchDay(ts);
              const time = formatMatchTime(ts);
              const scoreline =
                match.homeTeam.score !== undefined && match.awayTeam.score !== undefined
                  ? `${match.homeTeam.score} - ${match.awayTeam.score}`
                  : null;

              return (
                <Link
                  key={`${match.id}-${idx}`}
                  href={`/live/sp/${encodeURIComponent(match.id)}`}
                  className="group/card relative shrink-0 w-[290px] sm:w-[330px] aspect-[5/2] overflow-hidden rounded-[10px] bg-zinc-900 transition-transform duration-300 hover:scale-[1.015] cursor-pointer"
                >
                  <MatchBackdrop home={match.homeTeam.name} away={match.awayTeam.name} />

                  <div className="relative h-full p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-start justify-end">
                      <div className="min-w-0 flex justify-end">
                        <CompetitionBadge competition={match.league?.name} logo={match.league?.logo} />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div className="flex-1 flex justify-center">
                        <TeamCrest src={match.homeTeam.logo} alt={match.homeTeam.name} />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <TeamCrest src={match.awayTeam.logo} alt={match.awayTeam.name || "?"} />
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
                        {match.homeTeam.name} - {match.awayTeam.name}
                      </p>
                      <span
                        className={`shrink-0 text-[13px] font-black tabular-nums ${
                          isLive ? "text-red-500" : "text-zinc-400"
                        }`}
                      >
                        {isLive
                          ? match.minute || scoreline || "DIRECT"
                          : [day, time].filter(Boolean).join(" · ") || "Bientôt"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Chevron flottant — juste le chevron, au survol */}
          {canScrollLeft && isHovered && (
            <button
              onClick={() => scrollBy(-350)}
              className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-transform active:scale-95 cursor-pointer z-30"
              aria-label="Défiler à gauche"
            >
              <CaretLeft weight="bold" className="h-5 w-5" />
            </button>
          )}

          {canScrollRight && isHovered && (
            <button
              onClick={() => scrollBy(350)}
              className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-transform active:scale-95 cursor-pointer z-30"
              aria-label="Défiler à droite"
            >
              <CaretRight weight="bold" className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
