"use client";

import React, { useState } from "react";

/**
 * Habillage « Apple TV » d'une rencontre, partagé par la carte des rangées et la
 * page détail : chaque club reçoit son propre panneau coloré en diagonale.
 *
 * Aucune source ne publie la couleur d'un club : la teinte est déterministe,
 * tirée du nom, pour qu'une rencontre garde le même habillage d'un rafraîchissement
 * à l'autre.
 */
export function panelTint(name?: string): { from: string; to: string } {
  let hue = 0;
  for (const char of name || "?") hue = (hue * 31 + (char.codePointAt(0) ?? 0)) % 360;
  return { from: `hsl(${hue} 40% 32%)`, to: `hsl(${hue} 34% 14%)` };
}

/** Cout oblique entre les deux panneaux, plus large en haut côté domicile. */
export const HOME_PANEL = "polygon(0 0, 58% 0, 42% 100%, 0 100%)";
export const AWAY_PANEL = "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)";

/**
 * Les deux panneaux colorés + le voile de lisibilité. Occupe le conteneur
 * positionné parent (absolute inset-0) ou fléchi, selon `fill`.
 */
export function MatchBackdrop({
  home,
  away,
  className = "absolute inset-0",
}: {
  home?: string;
  away?: string;
  className?: string;
}) {
  const homeTint = panelTint(home);
  const awayTint = panelTint(away);
  return (
    <span aria-hidden className={`pointer-events-none ${className}`}>
      <span
        className="absolute inset-0"
        style={{ background: `linear-gradient(150deg, ${homeTint.from}, ${homeTint.to})`, clipPath: HOME_PANEL }}
      />
      <span
        className="absolute inset-0"
        style={{ background: `linear-gradient(150deg, ${awayTint.from}, ${awayTint.to})`, clipPath: AWAY_PANEL }}
      />
      {/* Voile : sans lui, les inscriptions se liraient mal sur les panneaux. */}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/55" />
    </span>
  );
}

/** Écusson d'une équipe, avec repli sur les initiales si l'image casse. */
export function TeamCrest({ src, alt, size = "sm" }: { src?: string; alt: string; size?: "sm" | "lg" }) {
  const [brokenSrc, setBrokenSrc] = useState<string | undefined>();
  const broken = brokenSrc === src;

  const box = size === "lg" ? "w-24 h-24 sm:w-32 sm:h-32" : "w-12 h-12 sm:w-14 sm:h-14";
  const img = size === "lg" ? "w-16 h-16 sm:w-24 sm:h-24" : "w-12 h-12 sm:w-14 sm:h-14";
  const textSize = size === "lg" ? "text-3xl sm:text-4xl" : "text-xs";

  const initials = (alt || "?")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!src || broken) {
    return (
      <div className={`${box} rounded-full flex items-center justify-center ${textSize} font-black text-zinc-500 bg-white/[0.06] ring-2 ring-white/10 shrink-0`}>
        {initials || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBrokenSrc(src)}
      className={`${img} object-contain shrink-0 drop-shadow-lg`}
    />
  );
}
