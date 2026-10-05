"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "@phosphor-icons/react";
import type { SportMatch } from "@/types/matches";
import { cacheMatch, formatTime, matchHref } from "../match-utils";

const PRIMARY = "#FF6A00";

/** Logo d'équipe/ligue sécurisé anti-404 */
export function TeamLogo({
  src,
  name,
  className = "h-5 w-5 sm:h-6 sm:w-6",
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold uppercase text-[#EBEBF5]/60 ${className}`}
      >
        {name ? name[0] : "?"}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export interface MatchCardProps {
  match: SportMatch;
  /** Date de la liste (YYYY-MM-DD), transmise à la page détail. */
  date: string;
  /** Match actuellement ouvert (surligné). */
  active?: boolean;
  className?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

/**
 * Composant Carte de Match Apple-like.
 */
export function MatchCard({ 
  match, 
  date, 
  active = false, 
  className = "",
  isFavorite = false,
  onToggleFavorite
}: MatchCardProps) {
  const isFinished = match.status === "finished";

  // Détection de la mi-temps (HT)
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

  const isLive = match.status === "live";
  const showScore = isLive || isFinished;

  // Formatage de la date (ex: 13 OCT)
  const dayLabel = new Date(match.startTime)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();

  // Détermination du libellé d'état / heure
  let statusLabel = "";
  if (isHalfTime) {
    statusLabel = "HT";
  } else if (isLive) {
    statusLabel = match.minute || "LIVE";
  } else if (isFinished) {
    statusLabel = "FT";
  } else {
    statusLabel = formatTime(match.startTime);
  }

  return (
    <Link
      href={matchHref(match, date)}
      onClick={() => cacheMatch(match)}
      aria-label={`${match.homeTeam.name} contre ${match.awayTeam.name}`}
      className={`group relative flex items-center rounded-[20px] p-4 outline-none transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-[#FF6A00]/50 active:scale-[0.98] active:duration-150 ${
        active 
          ? "bg-[#2C2C2E] border border-white/[0.08]" 
          : "bg-[#1C1C1E] border border-white/[0.04] hover:bg-[#2C2C2E]"
      } ${className}`}
    >
      {/* Indicateur Live (subtil trait gauche) */}
      {isLive && (
        <span
          className="absolute inset-y-4 left-0 w-1 rounded-r-full shadow-[0_0_8px_rgba(255,106,0,0.6)]"
          style={{ background: PRIMARY }}
        />
      )}

      {/* 1. Colonne Gauche : Date + Statut/Heure */}
      <div className="flex w-[52px] shrink-0 flex-col items-center justify-center tabular-nums">
        <span className="text-[10px] font-medium tracking-wider text-[#8E8E93]">
          {dayLabel}
        </span>
        <span
          className={`mt-0.5 text-[15px] font-semibold tracking-tight ${
            isLive || isHalfTime
              ? "text-[#FF6A00] animate-pulse"
              : isFinished
              ? "text-[#8E8E93]"
              : "text-white"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* 2. Séparateur vertical fin */}
      <span aria-hidden="true" className="mx-4 h-9 w-[1px] shrink-0 bg-white/[0.06]" />

      {/* 3. Centre : Équipes & Logos (Alignement strict) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
        {/* Ligne Domicile */}
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo src={match.homeTeam.logo} name={match.homeTeam.name} className="h-5 w-5" />
            <span
              className={`truncate text-[15px] tracking-tight ${
                match.homeTeam.isWinner ? "font-semibold text-white" : "font-medium text-[#EBEBF5]"
              }`}
            >
              {match.homeTeam.name}
            </span>
          </div>
          {/* Score Domicile */}
          {showScore && (
            <span
              className={`ml-2 shrink-0 text-[15px] font-semibold tabular-nums ${
                isLive || isHalfTime || match.homeTeam.isWinner ? "text-white" : "text-[#8E8E93]"
              }`}
            >
              {match.homeTeam.score ?? 0}
            </span>
          )}
        </div>

        {/* Ligne Extérieur */}
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TeamLogo src={match.awayTeam.logo} name={match.awayTeam.name} className="h-5 w-5" />
            <span
              className={`truncate text-[15px] tracking-tight ${
                match.awayTeam.isWinner ? "font-semibold text-white" : "font-medium text-[#EBEBF5]"
              }`}
            >
              {match.awayTeam.name}
            </span>
          </div>
          {/* Score Extérieur */}
          {showScore && (
            <span
              className={`ml-2 shrink-0 text-[15px] font-semibold tabular-nums ${
                isLive || isHalfTime || match.awayTeam.isWinner ? "text-white" : "text-[#8E8E93]"
              }`}
            >
              {match.awayTeam.score ?? 0}
            </span>
          )}
        </div>
      </div>

      {/* 4. Droite : Action (Favoris) */}
      <div className="ml-3 flex shrink-0 items-center justify-center pl-1">
        <button
          onClick={(e) => {
            e.preventDefault(); // Empêche la navigation du Link
            if (onToggleFavorite) onToggleFavorite(e);
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 active:scale-75 ${
            isFavorite ? "text-[#FF6A00]" : "text-[#8E8E93] hover:bg-white/[0.04] hover:text-white"
          }`}
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Star weight={isFavorite ? "fill" : "regular"} className="h-[22px] w-[22px]" />
        </button>
      </div>
    </Link>
  );
}