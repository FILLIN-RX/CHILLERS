"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MovieOrShow } from "@/app/mockData";
import { PlayIcon, PlusIcon, CheckIcon, StarIcon, InformationCircleIcon } from "@heroicons/react/24/solid";

interface MovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

export default function MovieCard({
  item,
  onPlay,
  onOpenDetails,
  favorites,
  toggleFavorite,
}: MovieCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isFavorite = favorites.includes(item.id);
  const router = useRouter();

  const goToDetail = () => {
    const typeParam = item.type === "series" || item.type === "anime" ? "tv" : item.type;
    router.push(`/media/${item.id}?type=${typeParam}`);
  };

  return (
    <div
      onClick={() => goToDetail()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex-none w-[160px] sm:w-[200px] md:w-[240px] aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/40 cursor-pointer transition-all duration-300"
      style={{
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isHovered ? '0 0 30px rgba(215, 4, 102, 0.35)' : 'none',
      }}
    >
      {/* Poster Image */}
      <img
        src={item.posterUrl}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
        style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
        loading="lazy"
      />

      {/* Media Type Tag (Top Right) */}
      <div className="absolute top-3 right-3 z-20">
        <span className="rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold border border-white/10 uppercase tracking-widest text-zinc-300 backdrop-blur-sm">
          {item.type}
        </span>
      </div>

      {/* TMDB Rating Badge */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold border border-white/10 backdrop-blur-sm">
        <StarIcon className="h-3 w-3 text-amber-400" />
        <span className="text-amber-400">{item.rating}</span>
      </div>

      {/* Hover Overlay Panels */}
      <div
        className={`absolute inset-0 z-10 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="space-y-2 translate-y-0 transition-transform duration-300">
          {/* Action Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(item);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors shadow-lg cursor-pointer"
              title="Play"
            >
              <PlayIcon className="h-5 w-5 translate-x-0.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item.id);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors cursor-pointer ${
                isFavorite
                  ? "bg-zinc-800/50 text-brand-primary border-brand-primary/40"
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              }`}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              {isFavorite ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <PlusIcon className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                goToDetail();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors cursor-pointer"
              title="Voir les détails"
            >
              <InformationCircleIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Title */}
          <h3
            className="text-sm font-bold text-white leading-tight truncate cursor-pointer"
            onClick={() => goToDetail()}
          >
            {item.title}
          </h3>

          {/* Metadata Row */}
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400 font-medium">
            <span>{item.year}</span>
            <span>•</span>
            <div className="flex items-center gap-0.5 text-amber-400">
              <StarIcon className="h-3.5 w-3.5" />
              <span>{item.rating}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
