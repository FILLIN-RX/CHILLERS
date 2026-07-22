"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MovieOrShow } from "@/app/mockData";
import { PlayIcon, StarIcon, InformationCircleIcon } from "@heroicons/react/24/solid";
import { useLanguage } from "@/i18n/LanguageContext";

interface MovieCardProps {
  item: MovieOrShow;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
  variant?: "scroll" | "grid";
}

const isUnavailable = (item: MovieOrShow) =>
  !item.videoUrl || item.videoUrl.includes("youtube");

function MovieCard({
  item,
  onPlay,
  onOpenDetails,
  variant = "scroll",
}: MovieCardProps) {
  const router = useRouter();
  const { translate: _ } = useLanguage();
  const unavailable = isUnavailable(item);

  const goToDetail = () => {
    const typeParam = item.type === "series" || item.type === "anime" ? "tv" : item.type;
    router.push(`/media/${item.id}?type=${typeParam}`);
  };

  return (
    <div
      onClick={() => goToDetail()}
      className={`group relative aspect-[2/3] overflow-hidden bg-zinc-900 border border-zinc-800/40 cursor-pointer transition-all duration-300 ${
        variant === "grid"
          ? "w-full rounded-lg sm:rounded-xl"
          : "flex-none w-[140px] sm:w-[180px] md:w-[220px] rounded-xl sm:rounded-2xl"
      } ${unavailable ? "opacity-75 grayscale-[0.3]" : ""} hover:scale-105 hover:shadow-[0_0_30px_rgba(215,4,102,0.35)]`}
    >
      <Image
        src={item.posterUrl}
        alt={item.title}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes={
          variant === "grid"
            ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            : "(max-width: 640px) 140px, (max-width: 768px) 180px, 220px"
        }
      />

      <div className="absolute top-3 right-3 z-20">
        <span className="rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold border border-white/10 uppercase tracking-widest text-zinc-300 backdrop-blur-sm">
          {item.type}
        </span>
      </div>

      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold border border-white/10 backdrop-blur-sm">
        <StarIcon className="h-3 w-3 text-amber-400" />
        <span className="text-amber-400">{item.rating}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3">
        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
          unavailable
            ? "bg-amber-500/85 text-black"
            : "bg-emerald-500/85 text-white"
        }`}>
          {unavailable ? _("comingSoon") : _("nowAvailable")}
        </span>
      </div>

      <div
        className="absolute inset-0 z-10 flex flex-col justify-end p-4 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 opacity-0 group-hover:opacity-100"
      >
        <div className="space-y-2 translate-y-0 transition-transform duration-300">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (unavailable) return;
                onPlay(item);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors shadow-lg ${
                unavailable
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-brand-primary text-white hover:bg-brand-primary/90 cursor-pointer"
              }`}
              aria-label={_("media.watch")}
            >
              <PlayIcon className="h-5 w-5 translate-x-0.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(item);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label={_("media.details")}
            >
              <InformationCircleIcon className="h-5 w-5" />
            </button>
          </div>

          <h3
            className="text-sm font-bold text-white leading-tight truncate cursor-pointer"
            onClick={() => goToDetail()}
          >
            {item.title}
          </h3>

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

export default React.memo(MovieCard);
