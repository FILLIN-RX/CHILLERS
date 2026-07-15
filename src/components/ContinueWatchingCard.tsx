"use client";

import React from "react";
import { MovieOrShow } from "@/app/mockData";
import { PlayIcon } from "@heroicons/react/24/solid";

interface ContinueWatchingCardProps {
  item: MovieOrShow;
  progress: number; // percentage completed
  episodeName?: string; // e.g. "Episode 2"
  remainingTime: string; // e.g. "14m remaining"
  onResume: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function ContinueWatchingCard({
  item,
  progress,
  episodeName,
  remainingTime,
  onResume,
  onOpenDetails,
}: ContinueWatchingCardProps) {
  return (
    <div className="group relative flex-none w-[160px] sm:w-[220px] md:w-[280px] bg-[#121214] rounded-xl sm:rounded-2xl overflow-hidden border border-[#1F1F23]/60 hover:border-brand-primary/40 hover-glow cursor-pointer transition-all duration-300">
      
      {/* Thumbnail backdrop image with play overlay */}
      <div className="relative aspect-[2/3] w-full bg-zinc-950 overflow-hidden">
        <img
          src={item.posterUrl || item.backdropUrl}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 scale-100 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300" />

        {/* Hover play button */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onResume(item);
          }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-white shadow-2xl hover:scale-110 transition-transform duration-200">
            <PlayIcon className="h-6 w-6 translate-x-0.5" />
          </div>
        </div>

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-zinc-800">
          <div
            className="h-full bg-brand-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Info Details Row */}
      <div className="p-4 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-brand-secondary">
          <span>{item.type}</span>
          <span className="text-zinc-500 font-medium normal-case">{remainingTime}</span>
        </div>

        <h4 
          onClick={() => onOpenDetails(item)}
          className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors truncate"
        >
          {item.title}
        </h4>

        {episodeName && (
          <p className="text-xs text-zinc-400 font-light truncate">
            {episodeName}
          </p>
        )}
      </div>

    </div>
  );
}
