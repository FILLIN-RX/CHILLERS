import React from "react";

interface MovieCardSkeletonProps {
  variant?: "scroll" | "grid" | "poster" | "grid-poster" | "continue-watching" | "top10";
  className?: string;
  rank?: number;
}

export default function MovieCardSkeleton({
  variant = "poster",
  className = "",
  rank = 1,
}: MovieCardSkeletonProps) {
  const isPoster = variant === "poster" || variant === "grid-poster";
  const isGridPoster = variant === "grid-poster";
  const isContinueWatching = variant === "continue-watching";
  const isTop10 = variant === "top10";

  // 1. TOP 10 SKELETON
  if (isTop10) {
    return (
      <div
        className={`relative flex-none w-[180px] sm:w-[220px] md:w-[260px] flex items-end shrink-0 snap-start select-none ${className}`}
      >
        {/* Number outline */}
        <div className="absolute left-[-20px] sm:left-[-30px] bottom-[-20px] sm:bottom-[-25px] z-10 select-none pointer-events-none">
          <span className="text-[120px] sm:text-[160px] font-black leading-none -tracking-[0.08em] text-transparent [-webkit-text-stroke:3px_rgba(255,255,255,0.25)] drop-shadow-2xl">
            {rank}
          </span>
        </div>

        {/* Poster Skeleton */}
        <div className="relative z-20 w-[120px] sm:w-[150px] md:w-[170px] aspect-[2/3] ml-[60px] sm:ml-[80px] rounded-xl overflow-hidden shadow-2xl bg-zinc-950">
          <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />
          <div className="absolute top-2 right-2 z-10 h-3.5 w-10 rounded bg-white/10 backdrop-blur-md" />
        </div>
      </div>
    );
  }

  // 2. VERTICAL POSTER SKELETON (Primary format for home rows)
  if (isPoster) {
    const posterCardClass = isGridPoster
      ? `relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_8px_24px_rgba(0,0,0,0.6)] card-ambient-shimmer ${className}`
      : `relative flex-none h-[250px] sm:h-[295px] md:h-[340px] lg:h-[385px] w-[165px] sm:w-[195px] md:w-[225px] lg:w-[255px] rounded-2xl overflow-hidden bg-zinc-950 shadow-[0_8px_24px_rgba(0,0,0,0.6)] card-ambient-shimmer ${className}`;

    return (
      <div className={posterCardClass}>
        {/* Full Image Shimmer */}
        <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />

        {/* Top-left Rating Badge Placeholder */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-md glass-badge px-2 py-0.5 border-0 bg-black/40 backdrop-blur-md">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
          <div className="h-2 w-4 rounded bg-zinc-600/60" />
        </div>

        {/* Top-right Type/Format Badge Placeholder */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
          <div className="h-4 w-12 rounded-md bg-white/10 backdrop-blur-md" />
        </div>
      </div>
    );
  }

  // 3. CONTINUE WATCHING SKELETON (16:9 with progress bar)
  if (isContinueWatching) {
    return (
      <div className={`relative flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] ${className}`}>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 border border-white/5 shadow-md">
          <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />

          {/* Bottom Title & Details */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-3 px-3.5 space-y-1.5 z-20">
            <div className="h-3 w-2/3 bg-zinc-600/50 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-2 w-12 bg-zinc-600/40 rounded animate-pulse" />
              <div className="h-2 w-16 bg-zinc-600/30 rounded animate-pulse" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800/80">
            <div className="h-full w-1/3 bg-brand-primary/40 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // 4. STANDARD LANDSCAPE / GRID SKELETON (16:9)
  const landscapeSizeClass =
    variant === "grid"
      ? "w-full"
      : "flex-none w-[240px] sm:w-[280px] md:w-[320px] lg:w-[360px]";

  return (
    <div className={`relative ${landscapeSizeClass} ${className}`}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 shadow-md">
        <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />

        {/* Top-left Rating */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 bg-black/40 backdrop-blur-md">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
          <div className="h-2 w-4 rounded bg-zinc-600/60" />
        </div>

        {/* Top-right Type */}
        <div className="absolute top-2 right-2 z-10">
          <div className="h-3.5 w-11 rounded-md bg-white/10 backdrop-blur-md" />
        </div>

        {/* Bottom Title Gradient */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-6">
            <div className="h-2.5 w-3/4 bg-zinc-600/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
