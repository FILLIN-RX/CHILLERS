import React from "react";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";

export default function HomeSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-brand-dark overflow-hidden select-none">
      {/* ========================================================
          1. HERO CAROUSEL SKELETON
          Mirrors HeroCarousel.tsx (h-[70vh] sm:h-[80vh] lg:h-[88vh])
          ======================================================== */}
      <section className="relative w-full h-[70vh] sm:h-[80vh] lg:h-[88vh] overflow-hidden bg-black">
        {/* Shimmer backdrop */}
        <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />

        {/* Cinematic gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent pointer-events-none z-[2]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-[2]" />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/80 via-black/20 to-transparent pointer-events-none z-[2]" />

        {/* Center-Right Play Button Skeleton */}
        <div className="absolute top-1/2 right-[5%] sm:right-[10%] md:right-[15%] -translate-y-1/2 z-20">
          <div className="flex h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-brand-primary/20 border border-brand-primary/40 backdrop-blur-sm animate-pulse">
            <div className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-full bg-brand-primary/60" />
          </div>
        </div>

        {/* Bottom-Left Slide Content Skeleton */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-8 md:px-12 lg:px-[4%] pb-16 sm:pb-20 lg:pb-24">
          <div className="space-y-3 md:space-y-5 max-w-3xl">
            {/* Top metadata badges */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="h-5 w-20 rounded bg-brand-primary/30 animate-pulse" />
              <div className="h-4 w-12 rounded bg-zinc-700/60 animate-pulse" />
              <span className="text-zinc-600">•</span>
              <div className="h-4 w-14 rounded bg-zinc-700/60 animate-pulse" />
              <span className="text-zinc-600">•</span>
              <div className="h-4 w-12 rounded bg-amber-400/30 animate-pulse" />
            </div>

            {/* Hero Title */}
            <div className="space-y-2">
              <div className="h-8 sm:h-12 md:h-14 w-3/4 max-w-xl rounded-xl bg-zinc-700/60 animate-pulse" />
              <div className="h-8 sm:h-12 md:h-14 w-1/2 max-w-md rounded-xl bg-zinc-700/40 animate-pulse sm:hidden" />
            </div>

            {/* Hero Description */}
            <div className="hidden sm:block space-y-2 max-w-2xl">
              <div className="h-4 w-full rounded bg-zinc-800/80 animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-zinc-800/60 animate-pulse" />
            </div>

            {/* Genre tags */}
            <div className="hidden sm:flex gap-1.5 pt-0.5">
              <div className="h-6 w-16 rounded-full bg-black/40 border border-white/10" />
              <div className="h-6 w-20 rounded-full bg-black/40 border border-white/10" />
              <div className="h-6 w-14 rounded-full bg-black/40 border border-white/10" />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 pt-1 sm:pt-2">
              <div className="h-11 sm:h-12 w-36 sm:w-40 rounded-xl bg-brand-primary/70 animate-pulse" />
              <div className="h-11 sm:h-12 w-28 sm:w-36 rounded-xl bg-black/50 border border-white/15 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-5 sm:bottom-8 z-20 flex gap-2">
          <div className="h-2 w-7 rounded-full bg-brand-primary/60" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
        </div>
      </section>

      {/* ========================================================
          MAIN CONTENT ROWS (Exact layout from HomeClientWrapper)
          ======================================================== */}
      <div className="max-w-full mx-auto px-2 lg:px-3 space-y-8 pt-10 pb-24 w-full">

        {/* --------------------------------------------------------
            2. LIVE MATCHES ROW SKELETON
            Mirrors LiveMatchesRow.tsx
            -------------------------------------------------------- */}
        <div className="relative w-full overflow-hidden select-none">
          <div className="flex items-center justify-between pr-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
              <div className="h-5 w-44 rounded-md bg-zinc-800 animate-pulse" />
            </div>
          </div>

          <div className="flex gap-4 sm:gap-5 overflow-hidden py-2 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 flex flex-col justify-between rounded-2xl p-3.5 w-[260px] sm:w-[280px] bg-zinc-900/60 border border-white/5"
              >
                {/* League & status */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <div className="h-3 w-16 rounded bg-zinc-700/60 animate-pulse" />
                  <div className="h-3 w-14 rounded bg-red-500/30 animate-pulse" />
                </div>

                {/* Teams & Score */}
                <div className="flex items-center justify-between gap-2 my-1">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 skeleton-loading" />
                    <div className="mt-1.5 h-3 w-16 bg-zinc-700/50 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-7 rounded bg-zinc-700/60 animate-pulse" />
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 skeleton-loading" />
                    <div className="mt-1.5 h-3 w-16 bg-zinc-700/50 rounded animate-pulse" />
                  </div>
                </div>

                {/* Bottom link */}
                <div className="mt-2.5 pt-2 flex items-center justify-center">
                  <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --------------------------------------------------------
            3. FIRST 2 ROWS (Tendances actuelles, Nouveautés)
            Mirrors homeRows.slice(0, 2) in HomeClientWrapper
            -------------------------------------------------------- */}
        {["Tendances actuelles", "Nouveautés"].map((title, idx) => (
          <div key={idx} className="relative w-full overflow-hidden select-none">
            {/* Header */}
            <div className="flex items-center justify-between pr-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1 bg-brand-primary rounded-full" />
                <div className="h-5 w-36 rounded bg-zinc-800 animate-pulse" />
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/5" />
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/5" />
              </div>
            </div>

            {/* Poster Cards Row */}
            <div className="flex gap-2 sm:gap-3 overflow-hidden pt-2 pb-5 px-1">
              {Array.from({ length: 7 }).map((_, cardIdx) => (
                <MovieCardSkeleton key={cardIdx} variant="poster" />
              ))}
            </div>
          </div>
        ))}

        {/* --------------------------------------------------------
            4. MOST VIEWED / UPCOMING SPOTLIGHT BANNER SKELETON
            Mirrors MostViewedMovie.tsx
            -------------------------------------------------------- */}
        <div className="w-full">
          <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#0a192f] via-[#0d223f] to-[#071324] flex flex-col sm:flex-row items-center sm:items-stretch">
            {/* Left Poster */}
            <div className="relative flex-none w-36 xs:w-44 sm:w-52 md:w-60 aspect-[2/3] overflow-hidden bg-zinc-900 shrink-0">
              <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />
            </div>

            {/* Right Information */}
            <div className="flex-1 p-5 sm:p-7 md:p-9 flex flex-col justify-center space-y-3.5 sm:space-y-4 w-full">
              {/* Badge */}
              <div className="h-6 w-28 rounded-full bg-blue-500/20 animate-pulse" />

              {/* Title */}
              <div className="h-7 sm:h-9 w-3/4 max-w-md rounded-lg bg-zinc-700/60 animate-pulse" />

              {/* Date & Genre */}
              <div className="h-4 w-44 rounded bg-zinc-700/40 animate-pulse" />

              {/* Synopsis */}
              <div className="space-y-2 max-w-xl">
                <div className="h-3.5 w-full rounded bg-zinc-700/30 animate-pulse" />
                <div className="h-3.5 w-4/5 rounded bg-zinc-700/30 animate-pulse" />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-10 w-32 rounded-xl bg-brand-primary/40 animate-pulse" />
                <div className="h-10 w-28 rounded-xl bg-white/10 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------
            5. TOP 10 ROW SKELETON
            Mirrors Top10Row.tsx ("Top 10 : Ce que tout le monde regarde")
            -------------------------------------------------------- */}
        <div className="relative w-full overflow-hidden select-none">
          <div className="flex items-center justify-between pr-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-1 bg-brand-primary rounded-full" />
              <div className="h-5 w-64 rounded bg-zinc-800 animate-pulse" />
            </div>
          </div>

          <div className="flex gap-4 sm:gap-6 pl-3 sm:pl-5 overflow-hidden py-4">
            {[1, 2, 3, 4, 5].map((num) => (
              <MovieCardSkeleton key={num} variant="top10" rank={num} />
            ))}
          </div>
        </div>

        {/* --------------------------------------------------------
            6. ROWS 3, 4, 5 (TV for you, All time favorite, Box office)
            Mirrors homeRows.slice(2, 5) in HomeClientWrapper
            -------------------------------------------------------- */}
        {["TV for you", "All time favorite", "Box office"].map((title, idx) => (
          <div key={idx} className="relative w-full overflow-hidden select-none">
            <div className="flex items-center justify-between pr-1 mb-2">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-1 ${idx === 1 ? "bg-brand-secondary" : "bg-brand-primary"} rounded-full`} />
                <div className="h-5 w-36 rounded bg-zinc-800 animate-pulse" />
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/5" />
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/5" />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 overflow-hidden pt-2 pb-5 px-1">
              {Array.from({ length: 7 }).map((_, cardIdx) => (
                <MovieCardSkeleton key={cardIdx} variant="poster" />
              ))}
            </div>
          </div>
        ))}

        {/* --------------------------------------------------------
            7. SPOTLIGHT GRID SKELETON
            Mirrors SpotlightGrid.tsx (2x2 grid of wide cards)
            -------------------------------------------------------- */}
        <div className="w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="relative overflow-hidden sm:rounded-2xl border-0 w-full min-h-[160px] sm:min-h-[340px] bg-zinc-900"
              >
                <div className="absolute inset-0 skeleton-loading" aria-hidden="true" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />

                <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-5 z-10 space-y-2">
                  <div className="h-5 sm:h-7 w-1/2 rounded bg-zinc-700/60 animate-pulse" />
                  <div className="hidden sm:block space-y-1.5 max-w-sm">
                    <div className="h-3.5 w-full rounded bg-zinc-700/40 animate-pulse" />
                    <div className="h-3.5 w-2/3 rounded bg-zinc-700/40 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-7 w-20 rounded bg-brand-primary/50 animate-pulse" />
                    <div className="h-7 w-20 rounded bg-white/10 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --------------------------------------------------------
            8. REMAINING ROWS (New Anime, Martial art, Reality Show...)
            Mirrors homeRows.slice(5) in HomeClientWrapper
            -------------------------------------------------------- */}
        {["New Anime", "Martial art", "Reality Show"].map((title, idx) => (
          <div key={idx} className="relative w-full overflow-hidden select-none">
            <div className="flex items-center justify-between pr-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1 bg-brand-primary rounded-full" />
                <div className="h-5 w-36 rounded bg-zinc-800 animate-pulse" />
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/5" />
                <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/5" />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 overflow-hidden pt-2 pb-5 px-1">
              {Array.from({ length: 7 }).map((_, cardIdx) => (
                <MovieCardSkeleton key={cardIdx} variant="poster" />
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
