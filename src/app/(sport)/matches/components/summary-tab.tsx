"use client";

import React from "react";
import Link from "next/link";
import { ArrowsLeftRight, Broadcast, CaretRight, SoccerBall } from "@phosphor-icons/react";
import type { MatchKeyEvent, MatchSummary, SportMatch } from "@/types/matches";
import { CARD, DIVIDER, EmptyCard, MUTED, ORANGE } from "./match-tabs";

function EventIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("goal")) return <SoccerBall weight="fill" className="h-4 w-4 text-white" />;
  if (t.includes("red")) return <span className="block h-4 w-3 rounded-[2px] bg-[#FF3B30]" />;
  if (t.includes("yellow")) return <span className="block h-4 w-3 rounded-[2px] bg-[#FFD60A]" />;
  if (t.includes("substitution")) return <ArrowsLeftRight className="h-4 w-4" style={{ color: MUTED }} />;
  return <span className="block h-1.5 w-1.5 rounded-full bg-[#555]" />;
}

/** Minute numérique d'un événement (ex. "45'+2'" → 45.02). */
function clockValue(ev: MatchKeyEvent): number {
  const m = (ev.clock || "").match(/(\d+)(?:\D+(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

interface ProcessedEvent {
  ev: MatchKeyEvent;
  goal: boolean;
  score: string;
  isFirstHalf: boolean;
}

export function SummaryTab({ match, summary }: { match: SportMatch; summary: MatchSummary | null }) {
  const events = summary?.keyEvents ?? [];
  const isLive = match.status === "live";

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

  // Tri chronologique pour calculer l'évolution exacte du score
  const chrono = [...events].sort((a, b) => clockValue(a) - clockValue(b));

  let h = 0;
  let a = 0;
  let htScore = "0 - 0";
  let hasFirstHalf = false;
  let hasSecondHalf = false;

  const processedList: ProcessedEvent[] = chrono.map((ev) => {
    const isGoal = ev.scoringPlay || ev.type.toLowerCase().includes("goal");
    if (isGoal) {
      if (ev.teamName === match.homeTeam.name) h++;
      else a++;
    }
    const cv = clockValue(ev);
    const isFirstHalf = cv <= 45;
    if (isFirstHalf) {
      hasFirstHalf = true;
      htScore = `${h} - ${a}`;
    } else {
      hasSecondHalf = true;
    }
    return {
      ev,
      goal: isGoal,
      score: `${h} - ${a}`,
      isFirstHalf,
    };
  });

  // Détection si la mi-temps a été atteinte
  const reachedHalfTime =
    isHalfTime ||
    hasSecondHalf ||
    match.status === "finished" ||
    (isLive && Number(match.minute?.replace(/[^0-9]/g, "") || 0) >= 45);

  // Groupement pour ordre descendant :
  // [FT si terminé] -> [Événements 2e MT (plus récents en premier)] -> [Ligne HT] -> [Événements 1re MT (plus récents en premier)]
  const secondHalfEventsDesc = processedList.filter((p) => !p.isFirstHalf).reverse();
  const firstHalfEventsDesc = processedList.filter((p) => p.isFirstHalf).reverse();

  const totalEventsCount = events.length;

  return (
    <div className="space-y-4">
      {isLive && (
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("stream-player");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-[#1d1d1d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          style={{ background: CARD }}
        >
          <Broadcast className="h-5 w-5" style={{ color: ORANGE }} />
          <span className="flex-1 text-[14px] font-medium text-white">Regarder en direct</span>
          <CaretRight className="h-4 w-4" style={{ color: MUTED }} />
        </button>
      )}

      {totalEventsCount === 0 && !reachedHalfTime && match.status !== "finished" ? (
        <EmptyCard>No events yet.</EmptyCard>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" style={{ background: CARD, borderColor: DIVIDER }}>
          {/* Ligne Fin du Match (FT) tout en haut */}
          {match.status === "finished" && (
            <li className="grid grid-cols-[44px_1fr] items-center gap-2 px-4 py-3 bg-[#131313]" style={{ borderColor: DIVIDER }}>
              <span className="text-[12px] font-semibold text-white">FT</span>
              <span className="text-[13px] font-bold tabular-nums text-white">
                {match.homeTeam.score ?? 0} - {match.awayTeam.score ?? 0}
              </span>
            </li>
          )}

          {/* Événements 2e Mi-temps (descendant) */}
          {secondHalfEventsDesc.map(({ ev, goal, score }) => (
            <li key={ev.id} className="grid grid-cols-[44px_1fr_20px_1fr] items-center gap-2 px-4 py-3" style={{ borderColor: DIVIDER }}>
              <span className="text-[12px] tabular-nums" style={{ color: MUTED }}>
                {ev.clock || ""}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-white">{goal ? score : ""}</span>
              <span className="flex justify-center">
                <EventIcon type={ev.type} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {ev.participants?.[0]?.name || ev.shortText || ev.text}
                </p>
                <p className="truncate text-[12px]" style={{ color: MUTED }}>
                  {ev.participants?.[1]?.name || ev.teamName || ""}
                </p>
              </div>
            </li>
          ))}

          {/* Ligne Mi-temps (HT) */}
          {reachedHalfTime && (
            <li className="grid grid-cols-[44px_1fr] items-center gap-2 px-4 py-3 bg-[#131313]" style={{ borderColor: DIVIDER }}>
              <span className="text-[12px] font-semibold" style={{ color: isHalfTime ? ORANGE : MUTED }}>
                HT
              </span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: isHalfTime ? ORANGE : MUTED }}>
                {htScore}
              </span>
            </li>
          )}

          {/* Événements 1re Mi-temps (descendant) */}
          {firstHalfEventsDesc.map(({ ev, goal, score }) => (
            <li key={ev.id} className="grid grid-cols-[44px_1fr_20px_1fr] items-center gap-2 px-4 py-3" style={{ borderColor: DIVIDER }}>
              <span className="text-[12px] tabular-nums" style={{ color: MUTED }}>
                {ev.clock || ""}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-white">{goal ? score : ""}</span>
              <span className="flex justify-center">
                <EventIcon type={ev.type} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {ev.participants?.[0]?.name || ev.shortText || ev.text}
                </p>
                <p className="truncate text-[12px]" style={{ color: MUTED }}>
                  {ev.participants?.[1]?.name || ev.teamName || ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
