import React from "react";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";

export default function HomeSecondarySkeleton() {
  return (
    <div className="space-y-8 w-full">
      {["TV for you", "All time favorite", "Box office", "New Anime"].map((title, idx) => (
        <div key={idx} className="relative w-full overflow-hidden select-none">
          <div className="flex items-center justify-between pr-1 mb-2">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-1 ${idx % 2 === 1 ? "bg-brand-secondary" : "bg-brand-primary"} rounded-full`} />
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
  );
}
