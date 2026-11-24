"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
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
    <div className="christmas-effects" aria-hidden="true" data-snow-mode={effectiveSnowMode} data-page={pathname?.startsWith("/watch") || pathname?.startsWith("/live/sp/") || pathname?.startsWith("/live/lb/") ? "player" : "content"}>
      {garland && (
        <svg
          className="christmas-garland"
          viewBox="0 0 400 80"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d="M0 10 Q100 45 200 15 T400 15" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="47" y="21" width="6" height="6" rx="1" fill="#334155" />
          <ellipse cx="50" cy="34" rx="5" ry="8" className="christmas-bulb-red" />
          <rect x="117" y="25" width="6" height="6" rx="1" fill="#334155" />
          <ellipse cx="120" cy="38" rx="5" ry="8" className="christmas-bulb-green" />
          <rect x="197" y="14" width="6" height="6" rx="1" fill="#334155" />
          <ellipse cx="200" cy="27" rx="5" ry="8" className="christmas-bulb-gold" />
          <rect x="277" y="23" width="6" height="6" rx="1" fill="#334155" />
          <ellipse cx="280" cy="36" rx="5" ry="8" className="christmas-bulb-blue" />
          <rect x="347" y="19" width="6" height="6" rx="1" fill="#334155" />
          <ellipse cx="350" cy="32" rx="5" ry="8" className="christmas-bulb-red" />
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
      <div className="christmas-corner-art">
        <img src="/noel/reindeer.svg" alt="" />
        <img src="/noel/tree.svg" alt="" />
      </div>
    </div>
  );
}

