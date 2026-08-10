"use client";

import React from "react";
import Image from "next/image";
import type { MovieOrShow } from "@/types/media";
import { IconPlayerPlay } from '@tabler/icons-react';

interface ContinueWatchingCardProps {
  item: MovieOrShow;
  progress: number; // percentage completed
  episodeName?: string; // e.g. "Episode 2"
  remainingTime: string; // e.g. "14m remaining"
  onResume: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

// Local fallback used when the continue-watching record from localStorage has no
// posterUrl/backdropUrl (page.tsx falls back to "" on missing data). Without this
// Next/Image would receive src="" and either throw or render a broken image.
const PLACEHOLDER_POSTER = "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=400";

export default function ContinueWatchingCard({
  item,
  progress,
  episodeName,
  remainingTime,
  onResume,
  onOpenDetails,
}: ContinueWatchingCardProps) {
  // Prefer the landscape backdrop, fall back to poster, then the Unsplash placeholder.
  const imgSrc = item.backdropUrl || item.posterUrl || PLACEHOLDER_POSTER;

  return (
    <div
      data-testid="continue-watching-card"
      onClick={() => onOpenDetails(item)}
      className="group relative flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] cursor-pointer transition-all duration-300 ease-out
        hover:scale-[1.05] hover:-translate-y-1 hover:z-20 hover:shadow-[0_6px_22px_rgba(0,0,0,0.55)]
        [&:hover_.continue-watch-img]:scale-[1.07]"
    >
      {/* 16:9 landscape thumbnail, no border, rounded-md to match MovieCard. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-900">
        <Image
          src={imgSrc}
          alt={item.title}
          fill
          className="continue-watch-img object-cover transition-transform duration-500 ease-out"
          sizes="(max-width: 640px) 250px, (max-width: 768px) 300px, (max-width: 1024px) 360px, 420px"
        />

        {/* Subtle dark overlay to ground the play button and title */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-300" />

        {/* Bottom title gradient */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />

        {/* Hover play button (centered) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onResume(item);
          }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl hover:scale-110 transition-transform duration-200">
            <IconPlayerPlay className="h-6 w-6 translate-x-0.5" />
          </div>
        </div>

        {/* Title + meta overlay (bottom of the card, above the progress bar) */}
        <div className="absolute inset-x-0 bottom-2 px-3 space-y-0.5">
          <h4 className="text-sm font-bold text-white leading-tight line-clamp-1">
            {item.title}
          </h4>
          <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-medium">
            {episodeName && <span className="truncate">{episodeName}</span>}
            {episodeName && <span>•</span>}
            <span>{remainingTime}</span>
          </div>
        </div>

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800">
          <div
            className="h-full bg-brand-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
