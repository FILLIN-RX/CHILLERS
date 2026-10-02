import React from "react";

export default function WatchSkeleton() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white select-none overflow-x-hidden">
      {/* Container with space for the PC episode sidebar on large screens */}
      <div className="pt-[64px] sm:pt-[70px] pb-16 sm:pb-20 lg:pb-24 lg:pr-[26rem] xl:pr-[28rem]">
        
        {/* 1. CINEMA VIDEO PLAYER STAGE SKELETON (Full-width 16:9 up to 75dvh) */}
        <div className="w-full bg-black relative aspect-video max-h-[75dvh] flex items-center justify-center overflow-hidden border-b border-white/5 shadow-2xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none z-10" />
          <div className="absolute inset-0 skeleton-loading opacity-20" aria-hidden="true" />

          {/* Center Play / Buffering Spinner */}
          <div className="relative z-20 flex flex-col items-center gap-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-brand-primary/30 border-t-brand-primary animate-spin" />
            </div>
            <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
          </div>

          {/* Bottom Player Controls Bar Skeleton */}
          <div className="absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="flex-1 mx-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/4 bg-brand-primary/40 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-7 w-7 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-7 w-7 rounded-lg bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>

        {/* 2. MEDIA METADATA & ACTIONS (Under Player - Left on PC) */}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
          
          {/* Breadcrumb / Category link */}
          <div className="flex items-center gap-2 text-xs">
            <div className="h-3 w-12 rounded bg-white/10 animate-pulse" />
            <span className="text-zinc-600">/</span>
            <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
            <span className="text-zinc-600">/</span>
            <div className="h-3 w-32 rounded bg-white/15 animate-pulse" />
          </div>

          {/* Title & Badges */}
          <div className="space-y-3">
            <div className="h-7 sm:h-10 w-3/4 max-w-xl rounded-xl bg-white/20 animate-pulse" />
            
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="h-5 w-14 rounded-md bg-amber-400/20 animate-pulse" />
              <div className="h-5 w-12 rounded-md bg-white/10 animate-pulse" />
              <div className="h-5 w-16 rounded-md bg-white/10 animate-pulse" />
              <div className="h-5 w-10 rounded-md bg-brand-primary/30 animate-pulse" />
              <div className="h-5 w-20 rounded-md bg-white/10 animate-pulse" />
            </div>
          </div>

          {/* Action Buttons Row (Télécharger, Favoris, Partager, Langue) */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2">
            <div className="h-10 w-36 rounded-xl bg-brand-primary/70 animate-pulse" />
            <div className="h-10 w-32 rounded-xl bg-white/10 border border-white/5 animate-pulse" />
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/5 animate-pulse" />
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/5 animate-pulse" />
          </div>

          {/* Synopsis */}
          <div className="space-y-2 pt-2 max-w-3xl">
            <div className="h-3.5 w-full rounded bg-white/10 animate-pulse" />
            <div className="h-3.5 w-11/12 rounded bg-white/10 animate-pulse" />
            <div className="h-3.5 w-3/4 rounded bg-white/10 animate-pulse" />
          </div>

          {/* Cast / Recommendations Skeleton */}
          <div className="space-y-3 pt-6">
            <div className="h-5 w-36 rounded bg-white/15 animate-pulse" />
            <div className="flex gap-3 overflow-hidden pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-36 w-24 shrink-0 rounded-xl bg-zinc-900/60 border border-white/5 animate-pulse" />
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 3. DESKTOP RIGHT SIDEBAR SKELETON (Episodes Drawer for Series / Anime on PC) */}
      <aside className="hidden lg:flex fixed right-0 top-[64px] sm:top-[70px] bottom-0 w-[26rem] xl:w-[28rem] bg-zinc-950/95 border-l border-white/10 flex-col z-30 p-5 space-y-4">
        
        {/* Season Selector & Episode count header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="h-9 w-36 rounded-xl bg-white/10 animate-pulse" />
          <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
        </div>

        {/* Episode Search bar */}
        <div className="h-10 w-full rounded-xl bg-white/5 border border-white/10 animate-pulse" />

        {/* Episode Cards List */}
        <div className="flex-1 space-y-3 overflow-hidden pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-2.5 rounded-xl bg-zinc-900/50 border border-white/5"
            >
              {/* Thumbnail */}
              <div className="relative w-24 aspect-video rounded-lg bg-zinc-800 shrink-0 overflow-hidden">
                <div className="absolute inset-0 skeleton-loading opacity-30" />
              </div>

              {/* Title & Duration */}
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3.5 w-3/4 rounded bg-white/15 animate-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-white/10 animate-pulse" />
              </div>

              {/* Play icon placeholder */}
              <div className="w-8 h-8 rounded-full bg-white/5 shrink-0 animate-pulse" />
            </div>
          ))}
        </div>

      </aside>
    </div>
  );
}
