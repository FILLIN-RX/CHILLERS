"use client";

import React from "react";
import Image from "next/image";
import { IconPlayerPlay, IconInfoCircle, IconFlame } from "@tabler/icons-react";
import type { MovieOrShow } from "@/types/media";

interface PromoBannerProps {
  item: MovieOrShow;
  onWatchNow: (movie: MovieOrShow) => void;
  onOpenDetails: (movie: MovieOrShow) => void;
}

export default function PromoBanner({ item, onWatchNow, onOpenDetails }: PromoBannerProps) {
  const background =
    item.backdropUrl ||
    item.posterUrl;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
      <div className="relative aspect-[16/8] sm:aspect-[21/8] w-full">
        {background ? (
          <Image
            src={background}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 100vw"
            className="object-cover"
            priority={false}
          />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white">
                <IconFlame className="h-3 w-3" />
                Le plus en vue
              </span>
              {typeof item.rating === "number" && item.rating > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-amber-400 backdrop-blur-sm">
                  ★ {item.rating.toFixed(1)}
                </span>
              )}
            </div>

            <h3 className="text-2xl sm:text-4xl font-extrabold text-white drop-shadow-lg leading-tight mb-2">
              {item.title}
            </h3>

            <p className="hidden sm:block text-sm text-zinc-300 line-clamp-2 mb-4 max-w-lg">
              {item.synopsis || item.description}
            </p>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onWatchNow(item)}
                className="flex items-center gap-2 rounded-full bg-white px-4 sm:px-5 py-2 text-sm sm:text-base font-bold text-black hover:bg-zinc-200 active:scale-95 transition-all"
              >
                <IconPlayerPlay className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" />
                Regarder
              </button>
              <button
                onClick={() => onOpenDetails(item)}
                className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 sm:px-5 py-2 text-sm sm:text-base font-bold text-white backdrop-blur-sm hover:bg-white/20 active:scale-95 transition-all"
              >
                <IconInfoCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                Détails
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
