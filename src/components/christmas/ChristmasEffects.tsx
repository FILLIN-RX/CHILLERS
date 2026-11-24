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

export function ChristmasGarland() {
  return (
    <svg className="christmas-garland" viewBox="0 0 1920 190" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 12 C130 22 180 58 245 95 C340 150 415 170 510 150 C630 125 685 45 800 26 C940 2 1010 36 1090 72 C1190 118 1275 150 1380 112 C1510 65 1575 28 1700 34 C1790 38 1860 64 1920 86" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M0 12 C130 22 180 58 245 95 C340 150 415 170 510 150 C630 125 685 45 800 26 C940 2 1010 36 1090 72 C1190 118 1275 150 1380 112 C1510 65 1575 28 1700 34 C1790 38 1860 64 1920 86" fill="none" stroke="#39764c" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 10" />
      {[130, 300, 470, 650, 820, 990, 1160, 1330, 1510, 1690, 1860].map((x, i) => {
        const y = [28, 120, 164, 102, 25, 29, 100, 127, 79, 34, 64][i];
        const colors = ["red", "green", "gold", "blue", "red", "green", "gold", "blue", "red", "green", "gold"];
        return <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M0 -15v10" stroke="#334155" strokeWidth="3" />
          <ellipse cy="4" rx="6" ry="10" className={`christmas-bulb-${colors[i]}`} />
        </g>;
      })}
    </svg>
  );
}

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
    <>
    <div className="christmas-effects" aria-hidden="true" data-snow-mode={effectiveSnowMode}>
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
    </>
  );
}

