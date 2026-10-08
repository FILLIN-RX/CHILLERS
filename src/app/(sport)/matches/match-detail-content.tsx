"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getMatches, getMatchById, getMatchSummary } from "@/services/matches";
import type { SportMatch, MatchSummary } from "@/types/matches";
import { CaretLeft, ShareNetwork } from "@phosphor-icons/react";
import {
  FONT_STACK,
  buildMatchFromSummary,
  cacheMatch,
  formatTime,
  localDateStr,
  readCachedMatch,
} from "./match-utils";
import { MatchTabs, ORANGE, type TabId } from "./components/match-tabs";
import { SummaryTab } from "./components/summary-tab";
import { StatsTab } from "./components/stats-tab";
import { LineupsTab } from "./components/lineups-tab";
import { MatchStreamPlayer } from "./components/match-stream-player";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export default function MatchDetailContent() {
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? decodeURIComponent(rawId).trim() : Array.isArray(rawId) ? rawId[0] : "";

  const searchParams = useSearchParams();
  const router = useRouter();

  const league = searchParams.get("league") || "all";
  const date = searchParams.get("date") || localDateStr();

  const [match, setMatch] = useState<SportMatch | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("summary");

  // Affichage instantané depuis le cache de session
  useEffect(() => {
    if (id && id !== "undefined" && id !== "null") {
      const cached = readCachedMatch(id);
      if (cached) setMatch(cached);
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id || id === "undefined" || id === "null") {
      setIsLoading(false);
      return;
    }

    try {
      const [sumRes, matchRes, listRes] = await Promise.allSettled([
        getMatchSummary(id, league),
        getMatchById(id),
        getMatches({ date, league: league !== "all" ? league : undefined, sport: undefined }),
      ]);

      let resolvedMatch = readCachedMatch(id);

      if (sumRes.status === "fulfilled" && sumRes.value) {
        setSummary(sumRes.value);
        if (!resolvedMatch) {
          resolvedMatch = buildMatchFromSummary(sumRes.value);
        }
      }

      if (!resolvedMatch && matchRes.status === "fulfilled" && matchRes.value) {
        resolvedMatch = matchRes.value;
      }

      if (!resolvedMatch && listRes.status === "fulfilled" && Array.isArray(listRes.value)) {
        const found = listRes.value.find((m) => String(m.id) === String(id));
        if (found) resolvedMatch = found;
      }

      if (!resolvedMatch && league !== "all") {
        try {
          const fallbackSum = await getMatchSummary(id, "all");
          if (fallbackSum) {
            setSummary(fallbackSum);
            resolvedMatch = buildMatchFromSummary(fallbackSum);
          }
        } catch {}
      }

      if (resolvedMatch) {
        setMatch(resolvedMatch);
        cacheMatch(resolvedMatch);
      }
    } catch (err) {
      console.warn("[MatchDetailContent] Erreur chargement match:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, date, league]);

  useEffect(() => {
    load();
  }, [load]);

  const isLive = match?.status === "live";
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [isLive, load]);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/matches");
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: match?.title, url });
      else await navigator.clipboard?.writeText(url);
    } catch {}
  };

  // ── États sans match ──
  if (!match) {
    return (
      <div className="min-h-screen bg-[#111111] pb-24 text-white antialiased" style={{ fontFamily: FONT_STACK }}>
        <TopBar onBack={goBack} />
        {isLoading ? (
          <div className="animate-pulse px-4 pt-10 motion-reduce:animate-none" aria-busy="true">
            <div className="mx-auto h-14 w-14 rounded-full bg-[#1c1c1c]" />
            <div className="mx-auto mt-6 h-12 w-40 rounded-xl bg-[#1c1c1c]" />
            <div className="mt-10 h-40 rounded-xl bg-[#1c1c1c]" />
          </div>
        ) : (
          <div className="px-6 py-24 text-center">
            <p className="text-[17px] font-semibold">Match introuvable</p>
            <p className="mx-auto mt-1 max-w-xs text-[15px] text-[#8E8E93]">
              Ce match n’est plus disponible ou le lien est incorrect.
            </p>
            <Link
              href="/matches"
              className={`mt-5 inline-block rounded-full bg-white px-5 py-2 text-[15px] font-medium text-black ${FOCUS}`}
            >
              Retour aux matchs
            </Link>
          </div>
        )}
      </div>
    );
  }

  const isFinished = match.status === "finished";
  const kickoff = new Date(match.startTime);
  const kickoffDay = kickoff.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const isHalfTime =
    (match.status === "live" &&
      Boolean(
        match.minute?.toLowerCase().includes("ht") ||
          match.minute?.toLowerCase().includes("half") ||
          match.statusText?.toLowerCase().includes("half") ||
          match.statusText?.toLowerCase().includes("mi-temps") ||
          match.statusText?.toLowerCase() === "ht"
      )) ||
    Boolean(match.period?.toLowerCase().includes("half"));

  return (
    <div
      className="min-h-screen bg-[#111111] pb-24 text-white antialiased"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* Barre de navigation TopBar */}
      <TopBar
        onBack={goBack}
        title={match.league.name}
        logo={match.league.logo}
        right={
          <button
            onClick={share}
            aria-label="Partager"
            className={`flex h-10 w-10 items-center justify-center rounded-full text-[#B0B0B0] transition-colors hover:text-white ${FOCUS}`}
          >
            <ShareNetwork className="h-5 w-5" />
          </button>
        }
      />

      {/* Conteneur Pleine Largeur (w-full avec padding sur PC) */}
      <div className="w-full px-3 sm:px-6 lg:px-8 xl:px-12 pt-3">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8 w-full">
          {/*
            SUR MOBILE : le player se place au début (order-1)
            SUR PC : le player est sur le côté droit (lg:order-2), w-full lg:w-[48%] xl:w-[50%], sticky
          */}
          <aside className="order-1 lg:order-2 w-full lg:w-[48%] xl:w-[50%] lg:sticky lg:top-16">
            <MatchStreamPlayer
              matchId={match.id}
              homeName={match.homeTeam.name}
              awayName={match.awayTeam.name}
              isLive={isLive}
              minute={match.minute}
            />
          </aside>

          {/*
            SUR MOBILE : après le player (order-2)
            SUR PC : sur le côté gauche (lg:order-1), w-full lg:w-[52%] xl:w-[50%]
          */}
          <main className="order-2 lg:order-1 w-full lg:w-[52%] xl:w-[50%] min-w-0 space-y-4">
            {/* Scoreboard */}
            <section className="relative overflow-hidden rounded-xl bg-[#161616] px-4 pb-5 pt-6">
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: ORANGE }} />
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                <TeamBlock name={match.homeTeam.name} logo={match.homeTeam.logo} />
                <div className="flex min-w-[96px] flex-col items-center pt-2 text-center">
                  {isLive || isFinished ? (
                    <>
                      <div className="flex items-center gap-2 text-[26px] font-semibold leading-none tabular-nums">
                        <span>{match.homeTeam.score ?? 0}</span>
                        <span>–</span>
                        <span>{match.awayTeam.score ?? 0}</span>
                      </div>
                      <div className="mt-3 text-[13px] font-semibold tabular-nums" style={{ color: ORANGE }}>
                        {isLive
                          ? isHalfTime
                            ? "Half Time"
                            : match.minute || "Live"
                          : "Full Time"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[24px] font-semibold leading-none tabular-nums">
                        {formatTime(match.startTime)}
                      </div>
                      <div className="mt-3 text-[12px] capitalize text-[#8A8A8A]">{kickoffDay}</div>
                    </>
                  )}
                </div>
                <TeamBlock name={match.awayTeam.name} logo={match.awayTeam.logo} />
              </div>
            </section>

            {/* Onglets (Summary, Stats, Line-ups) */}
            <div className="mt-4">
              <MatchTabs tab={tab} onChange={setTab} />
            </div>

            <div className="py-2" role="tabpanel">
              {isLoading && !summary ? (
                <div className="animate-pulse space-y-3 motion-reduce:animate-none" aria-busy="true">
                  <div className="h-12 rounded-xl bg-[#1c1c1c]" />
                  <div className="h-12 rounded-xl bg-[#1c1c1c]" />
                  <div className="h-12 rounded-xl bg-[#1c1c1c]" />
                </div>
              ) : (
                <>
                  {tab === "summary" && <SummaryTab match={match} summary={summary} />}
                  {tab === "stats" && <StatsTab match={match} summary={summary} />}
                  {tab === "lineups" && <LineupsTab summary={summary} />}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Briques ───

function TopBar({
  onBack,
  title,
  logo,
  right,
}: {
  onBack: () => void;
  title?: string;
  logo?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-12 z-20 grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-[#262626] bg-[#111111]/90 backdrop-blur-md px-3 sm:px-6">
      <button
        onClick={onBack}
        className={`flex w-fit items-center gap-0.5 rounded-full py-1.5 pl-1 pr-3 text-[14px] text-white ${FOCUS}`}
      >
        <CaretLeft className="h-4 w-4" weight="bold" />
        <span>Matchs</span>
      </button>
      <div className="flex min-w-0 items-center justify-center gap-2 px-2">
        {logo && <img src={logo} alt="" className="h-5 w-5 shrink-0 object-contain" />}
        {title && <span className="truncate text-[14px] font-semibold">{title}</span>}
      </div>
      <div className="flex items-center justify-end">{right}</div>
    </header>
  );
}

function TeamBlock({ name, logo }: { name: string; logo?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {logo ? (
        <img src={logo} alt="" className="h-14 w-14 object-contain" />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#262626] text-[20px] text-[#B0B0B0]">
          {name[0]}
        </span>
      )}
      <h1 className="line-clamp-2 text-[13px] font-semibold leading-tight">{name}</h1>
    </div>
  );
}
