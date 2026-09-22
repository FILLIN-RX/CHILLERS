import React from "react";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";

export default function MediaListingSkeleton() {
  return (
    <main className="min-h-screen bg-brand-dark pt-24 sm:pt-28 lg:pt-24 pb-28 select-none">
      {/* ── Category Header Skeleton ── */}
      <div className="px-4 sm:px-6 md:px-12 lg:px-[3%] py-2 mb-4">
        <div className="flex items-center gap-6">
          <div className="h-8 w-36 bg-zinc-800 rounded-xl animate-pulse" />
          <div className="h-9 w-44 sm:w-52 rounded-xl bg-zinc-800/70 skeleton-loading" />
        </div>
      </div>

      <div className="space-y-8 sm:space-y-10 pt-4 sm:pt-6">
        {/* ── Top 10 Row Skeleton ── */}
        <div className="px-2 sm:px-6 md:px-12 lg:px-[3%] space-y-6 sm:space-y-8">
          <div className="relative w-full overflow-hidden select-none">
            <div className="flex items-center justify-between pr-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1 bg-brand-primary rounded-full" />
                <div className="h-5 w-44 rounded bg-zinc-800 animate-pulse" />
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 pl-3 sm:pl-5 overflow-hidden py-4">
              {[1, 2, 3, 4, 5].map((num) => (
                <MovieCardSkeleton key={num} variant="top10" rank={num} />
              ))}
            </div>
          </div>

          {/* ── Category Carousel Rows Skeletons ── */}
          {Array.from({ length: 3 }).map((_, rIdx) => (
            <div key={rIdx} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1 bg-brand-primary rounded-full" />
                <div className="h-5 w-48 bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="flex gap-2 sm:gap-3 overflow-hidden pt-2 pb-5 px-1">
                {Array.from({ length: 7 }).map((_, cIdx) => (
                  <MovieCardSkeleton key={cIdx} variant="poster" />
                ))}
              </div>
            </div>
          ))}

          {/* ── Infinite Scroll Grid Skeleton ("Explorer plus") ── */}
          <div className="space-y-4 pt-4">
            <div className="h-7 w-48 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <MovieCardSkeleton key={i} variant="grid-poster" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
