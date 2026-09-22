import React from "react";

export default function WatchSkeleton() {
  return (
    <div className="min-h-screen bg-brand-dark text-foreground pt-4 pb-16 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* 1. Breadcrumb Skeleton */}
      <div className="flex items-center gap-2 text-xs">
        <div className="h-3.5 w-14 rounded bg-white/10" />
        <div className="h-3.5 w-3 rounded bg-white/5" />
        <div className="h-3.5 w-20 rounded bg-white/10" />
        <div className="h-3.5 w-3 rounded bg-white/5" />
        <div className="h-3.5 w-32 rounded bg-white/15" />
      </div>

      {/* 2. Main Video Player Area Skeleton (Aspect 16:9) */}
      <div className="relative w-full aspect-video rounded-2xl bg-zinc-900/90 border border-white/5 overflow-hidden shadow-2xl flex items-center justify-center">
        {/* Shimmer overlay */}
        <div className="absolute inset-0 skeleton-loading opacity-40 pointer-events-none" />

        {/* Center buffer / play spinner */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-brand-primary/40 border-t-brand-primary animate-spin" />
          </div>
          <div className="h-3 w-28 rounded-full bg-white/10" />
        </div>

        {/* Bottom fake video player control bar */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-white/10" />
            <div className="h-7 w-7 rounded-full bg-white/10" />
            <div className="h-2.5 w-16 rounded bg-white/10" />
          </div>
          <div className="flex-1 mx-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-brand-primary/50" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-white/10" />
            <div className="h-7 w-7 rounded-full bg-white/10" />
            <div className="h-7 w-7 rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      {/* 3. Server Selector & Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/50 border border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-24 rounded-lg bg-brand-primary/20 border border-brand-primary/30" />
          <div className="h-8 w-20 rounded-lg bg-white/5 border border-white/5" />
          <div className="h-8 w-20 rounded-lg bg-white/5 border border-white/5" />
          <div className="h-8 w-24 rounded-lg bg-white/5 border border-white/5" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-white/10" />
          <div className="h-9 w-9 rounded-xl bg-white/10" />
          <div className="h-9 w-9 rounded-xl bg-white/10" />
          <div className="h-9 w-9 rounded-xl bg-white/10" />
        </div>
      </div>

      {/* 4. Title, Details & Synopsis */}
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <div className="h-7 sm:h-9 w-2/3 max-w-md rounded-lg bg-white/20" />
          <div className="flex items-center gap-3">
            <div className="h-4 w-12 rounded bg-amber-400/20" />
            <div className="h-4 w-14 rounded bg-white/10" />
            <div className="h-4 w-16 rounded bg-white/10" />
            <div className="h-4 w-20 rounded bg-white/10" />
          </div>
        </div>

        <div className="space-y-2 max-w-3xl">
          <div className="h-3.5 w-full rounded bg-white/10" />
          <div className="h-3.5 w-5/6 rounded bg-white/10" />
          <div className="h-3.5 w-3/4 rounded bg-white/10" />
        </div>
      </div>

      {/* 5. Episodes or Recommendations Grid */}
      <div className="space-y-3 pt-6">
        <div className="h-5 w-40 rounded bg-white/15" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-zinc-900/60 border border-white/5 p-2 flex flex-col justify-end gap-2">
              <div className="h-3 w-4/5 rounded bg-white/10" />
              <div className="h-2.5 w-1/2 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
