"use client";

import { useEffect, useState, type CSSProperties } from "react";

type SnowMode = "live" | "static" | "none";

interface ChristmasEffectsProps {
  /** `static` keeps the snow visible without motion; `none` omits the flakes. */
  snowMode?: SnowMode;
  /** Show the lightweight SVG garland above the top bar. */
  garland?: boolean;
}

const flakes = [
  [4, 8, 3.2, 0.7, -4], [11, 55, 4.4, 0.55, 5], [17, 21, 3.8, 0.8, 3],
  [23, 72, 5.1, 0.5, -6], [29, 39, 3.4, 0.65, 4], [35, 88, 4.6, 0.6, -3],
  [41, 12, 5.4, 0.45, 6], [47, 63, 3.5, 0.75, -5], [53, 30, 4.2, 0.55, 3],
  [59, 81, 3.3, 0.7, -4], [65, 47, 5.2, 0.5, 5], [71, 5, 3.7, 0.65, -6],
  [77, 68, 4.5, 0.55, 4], [83, 26, 3.2, 0.8, -3], [89, 92, 4.8, 0.5, 6],
  [95, 44, 3.6, 0.7, -5],
] as const;

/** Decorative-only seasonal layer: no timers, images, or hit targets. */
export default function ChristmasEffects({ snowMode = "live", garland = true }: ChristmasEffectsProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const effectiveSnowMode = reducedMotion && snowMode === "live" ? "static" : snowMode;

  return (
    <div className="christmas-effects" aria-hidden="true" data-snow-mode={effectiveSnowMode}>
      {garland && (
        <svg
          className="christmas-garland"
          viewBox="0 0 1440 58"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 5 C240 48 480 42 720 24 S1200 0 1440 8" fill="none" stroke="#244631" strokeWidth="3" />
          <path d="M8 9 C130 22 205 35 320 38 M400 40 C505 43 600 34 720 24 M800 19 C920 11 1030 2 1150 4 M1220 4 C1300 4 1370 8 1434 10" fill="none" stroke="#39764c" strokeWidth="7" strokeLinecap="round" strokeDasharray="2 5" />
          <path d="M68 19l-12-8m18 10 14-9m103 28-13-11m19 12 12-11m102 18-12-12m19 13 14-10m145 13-12-12m18 12 13-10m141-6-13-12m19 11 14-9m144-8-12-11m19 10 14-10m143-13-13-10m19 10 14-9m111-4-12-9m18 10 13-7m105 5-11-8m18 8 12-6" fill="none" stroke="#4f8a59" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M156 28v9m190 9v8m211-2v9m211-32v9m211-17v8m198-9v9m193 0v8" stroke="#b5a36b" strokeWidth="1.5" />
          <circle cx="156" cy="39" r="4" fill="#f42a7c" />
          <circle cx="346" cy="53" r="4" fill="#f3c969" />
          <circle cx="557" cy="55" r="4" fill="#e9f1e6" />
          <circle cx="768" cy="14" r="4" fill="#f42a7c" />
          <circle cx="979" cy="-1" r="4" fill="#f3c969" />
          <circle cx="1177" cy="8" r="4" fill="#e9f1e6" />
          <circle cx="1370" cy="13" r="4" fill="#f42a7c" />
        </svg>
      )}
      {snowMode !== "none" && flakes.map(([left, top, size, duration, drift], index) => (
        <span
          key={left}
          className="christmas-flake"
          style={{
            "--flake-left": `${left}%`,
            "--flake-top": `${top}%`,
            "--flake-size": `${size}px`,
            "--flake-duration": `${duration * 10}s`,
            "--flake-delay": `${-index * 1.9}s`,
            "--flake-drift": `${drift}vw`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

