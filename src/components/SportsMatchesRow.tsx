"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import gsap from "gsap";
import { getSportsMatches } from "@/services/sports";
import { getLiveBallMatches } from "@/services/liveball";
import { buildAffiche, useMatchPosterIndex, type MatchAffiche } from "@/hooks/useMatchPosterIndex";
import { useLiveScores } from "@/hooks/useLiveScores";
import { applyLiveScores } from "@/lib/live-scores";
import { formatMatchDay, formatMatchTime, sameTeam } from "@/lib/match-poster";
import CompetitionBadge from "@/components/CompetitionBadge";
import { MatchBackdrop, TeamCrest } from "@/components/MatchCardBackdrop";
import type { SportsMatch } from "@/types/sports";
import type { LiveBallMatch } from "@/types/liveball";

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
 * donne le score, l'autre l'affiche du service de score. La carte retenue garde
 * le meilleur des deux au lieu de laisser passer la plus pauvre.
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

/**
 * Deux sources décrivent la même rencontre avec des graphies de clubs qui ne se
 * recouvrent pas (« Milan / Bologna » d'un côté, « AC Milan / Bolonya » de
 * l'autre) : la comparaison se fait sur les jointures d'affiche, pas sur une clé
 * locale. Le coup d'envoi n'est compatible que si les deux sources le publient —
 * LiveBall n'en publie aucun, et exiger la fenêtre laissait les deux cartes
 * séparées, l'une avec le score, l'autre sur « VS ».
 */
function isSameMatch(a: SportsMatch, b: SportsMatch): boolean {
  const direct = sameTeam(a.home, b.home) && sameTeam(a.away, b.away);
  const swapped = sameTeam(a.home, b.away) && sameTeam(a.away, b.home);
  if (!direct && !swapped) return false;
  if (!a.startTs || !b.startTs) return true;
  return Math.abs(a.startTs - b.startTs) <= 6 * 3600;
}

/** Garde les champs que la source de base ne publie pas. */
function mergeMatchFields(kept: SportsMatch, extra: SportsMatch): SportsMatch {
  return {
    ...kept,
    score: kept.score || extra.score,
    minute: kept.minute ?? extra.minute,
    startTs: kept.startTs ?? extra.startTs,
    homeLogo: kept.homeLogo || extra.homeLogo,
    awayLogo: kept.awayLogo || extra.awayLogo,
    league: kept.league || extra.league,
    slug: kept.slug || extra.slug,
  };
}

function formatKickoff(ts?: number): string {
  const day = formatMatchDay(ts);
  const time = formatMatchTime(ts);
  if (day && time) return `${day} · ${time}`;
  return day || time || "Bientôt";
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

  const { data: sportsMatches = [], isLoading: isLoadingSports } = useQuery({
    queryKey: ["live", "sports"],
    queryFn: () => getSportsMatches(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: liveballMatches = [], isLoading: isLoadingLiveBall } = useQuery({
    queryKey: ["live", "liveball"],
    queryFn: () => getLiveBallMatches(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const isLoading = isLoadingSports && isLoadingLiveBall;

  const hasLiveBall = liveballMatches.some((match) => match.status === "live");
  const liveScores = useLiveScores(hasLiveBall);

  const { posters, ready: postersReady } = useMatchPosterIndex();

  // Déduplique intelligemment par équipes : LiveBall en priorité, fusion des logos et scores
  const deduped = useMemo<SportsMatch[]>(() => {
    // 1. Convertit les matchs LiveBall au format SportsMatch
    const lbConverted: SportsMatch[] = (liveballMatches || []).map((lb: LiveBallMatch) => ({
      id: lb.id,
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
    const clusters: SportsMatch[] = [];
    const seenIds = new Set<string>();

    for (const m of all) {
      if (!m?.id || !m.home || !m.away) continue;
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);

      const idx = clusters.findIndex((c) => isSameMatch(c, m));
      // LiveBall arrive en tête : la carte retenue garde donc son score et son
      // identifiant de flux, et l'autre source ne comble que les champs vides.
      if (idx < 0) clusters.push({ ...m });
      else clusters[idx] = mergeMatchFields(clusters[idx], m);
    }

    // Le score de la carte LiveBall vient du relevé 5 s, plus frais que les
    // listes en cache (60 s côté source, 30 s côté agrégateur).
    return applyLiveScores(clusters, liveScores).sort((a, b) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      return (a.startTs ?? Number.MAX_SAFE_INTEGER) - (b.startTs ?? Number.MAX_SAFE_INTEGER);
    });
  }, [sportsMatches, liveballMatches, liveScores]);

  // Vitrine : les grandes compétitions seulement. Le tri se fait sur le libellé
  // de la source, renforcé par la jointure au service de score — jamais sur la
  // jointure seule, sinon une panne du service de score viderait la rangée.
  const showcase = useMemo(() => {
    const withAffiche = deduped.map((m) => ({ match: m, affiche: buildAffiche(m, posters) }));
    const majors = postersReady ? withAffiche.filter((entry) => entry.affiche.major) : withAffiche;

    // Deux fiches du service de score peuvent décrire la même rencontre (journée
    // rejouée, doublon d'identifiant) : l'identifiant joint les cartes que les
    // noms laissent séparées.
    const byKey = new Map<string, ShowcaseEntry>();
    for (const entry of majors) {
      const key = entry.affiche.fixtureId || entry.match.id;
      const kept = byKey.get(key);
      if (!kept) byKey.set(key, entry);
      else byKey.set(key, rankSource(entry) > rankSource(kept) ? mergeSources(entry, kept) : mergeSources(kept, entry));
    }
    const seenMatchIds = new Set<string>();
    const result: ShowcaseEntry[] = [];
    for (const entry of byKey.values()) {
      if (seenMatchIds.has(entry.match.id)) continue;
      seenMatchIds.add(entry.match.id);
      result.push(entry);
    }
    return result;
  }, [deduped, posters, postersReady]);

  const cards = showcase;

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

  if (!isLoading && deduped.length === 0) return null;

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
            {cards.map(({ match: m, affiche }, idx) => {
              const isLive = m.status === "live";

              return (
                <Link
                  key={`${m.id}-${idx}`}
                  href={`/live/sp/${m.slug ?? m.id}`}
                  className="group/card relative shrink-0 w-[290px] sm:w-[330px] aspect-[5/2] overflow-hidden rounded-[10px] bg-zinc-900 transition-transform duration-300 hover:scale-[1.015] cursor-pointer"
                >
                  <MatchBackdrop home={m.home} away={m.away} />

                  <div className="relative h-full p-2.5 sm:p-3 flex flex-col justify-between">
                    <div className="flex items-start justify-end">
                      <div className="min-w-0 flex justify-end">
                        <CompetitionBadge competition={affiche.competition} logo={affiche.competitionLogo} />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div className="flex-1 flex justify-center">
                        <TeamCrest src={affiche.homeLogo} alt={m.home} />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <TeamCrest src={affiche.awayLogo} alt={m.away || "?"} />
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
                        {m.home} - {m.away}
                      </p>
                      <span
                        className={`shrink-0 text-[13px] font-black tabular-nums ${
                          isLive ? "text-red-500" : "text-zinc-400"
                        }`}
                      >
                        {isLive ? m.score || "VS" : formatKickoff(affiche.startTs)}
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
