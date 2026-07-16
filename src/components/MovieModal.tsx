"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MovieOrShow, Season, Episode } from "@/app/mockData";
import { getSeasonDetails } from "@/app/api";
import { XMarkIcon, PlayIcon, StarIcon } from "@heroicons/react/24/solid";

interface MovieModalProps {
  item: MovieOrShow | null;
  isOpen: boolean;
  onClose: () => void;
  onWatch: (item: MovieOrShow, episode?: Episode) => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function MovieModal({
  item,
  isOpen,
  onClose,
  onWatch,
  onOpenDetails,
}: MovieModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (item?.seasons && item.seasons.length > 0) {
        handleSeasonChange(item.seasons[0]);
      }
    } else {
      document.body.style.overflow = "unset";
      setActiveSeason(null);
      setEpisodes([]);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, item]);

  const handleSeasonChange = async (season: Season) => {
    setActiveSeason(season);
    // Fetch episodes for the selected season
    if (item) {
        const data = await getSeasonDetails(item.id, String(season.seasonNumber));
        if (data && data.episodes) {
            setEpisodes(data.episodes.map((ep: any) => ({
                id: String(ep.id),
                title: ep.name,
                duration: `${ep.runtime || 24}m`,
                number: ep.episode_number,
                thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : "",
                synopsis: ep.overview,
            })));
        }
    }
  };

  if (!isOpen || !item) return null;

  // Close modal when clicking outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fade-in"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl bg-brand-card rounded-3xl border border-brand-border overflow-hidden shadow-2xl my-8 glass-modal"
      >
        
        {/* Backdrop Banner Image */}
        <div className="relative aspect-[16/9] w-full bg-zinc-900">
          <Image
            src={item.backdropUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 900px"
            priority
          />
          <div className="absolute inset-0 banner-overlay" />

          {/* Close Button overlay */}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 text-zinc-400 hover:text-white border border-white/10 hover:bg-black/85 transition-colors focus:outline-none"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>

          {/* Title & Metadata Overlaid on Backdrop */}
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 space-y-3">
            <span className="rounded bg-brand-primary text-white text-[10px] font-bold px-2.5 py-1 uppercase tracking-wider border border-brand-primary/20">
              {item.type}
            </span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
              {item.title}
            </h2>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-white/80 font-semibold">
              <span>{item.year}</span>
              <span>•</span>
              <span>{item.duration}</span>
              <span>•</span>
              <div className="flex items-center gap-0.5 text-amber-400">
                <StarIcon className="h-4 w-4 fill-amber-400" />
                <span>{item.rating}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details & Info Section */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left / Middle: Synopsis & Buttons */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => onWatch(item)}
                className="flex items-center gap-2 rounded-full bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-2.5 font-bold text-sm transition-all duration-200 shadow-xl shadow-brand-primary/20 cursor-pointer"
              >
                <PlayIcon className="h-5 w-5" />
                Watch Now
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-text-muted">
                Synopsis
              </h3>
              <p className="text-foreground/80 text-sm sm:text-base font-light leading-relaxed">
                {item.synopsis}
              </p>
            </div>
            
            {/* Season & Episode Section */}
            {item.seasons && item.seasons.length > 0 && (
                <div className="space-y-4 pt-6">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-text-muted">
                        Episodes
                    </h3>
                    
                    {/* Season Selector */}
                    <div className="flex items-center gap-2 bg-brand-card p-1 rounded-lg border border-brand-border">
                        {item.seasons.map((season) => (
                            <button
                                key={season.id}
                                onClick={() => handleSeasonChange(season)}
                                className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                                    activeSeason?.id === season.id
                                        ? "bg-brand-primary text-white"
                                        : "text-foreground hover:bg-white/5"
                                }`}
                            >
                                {season.name}
                            </button>
                        ))}
                    </div>

                    {/* Episode List */}
                    <div className="space-y-2">
                        {episodes.map((ep) => (
                            <div key={ep.id} onClick={() => onWatch(item, ep)} className="flex items-center gap-4 p-3 bg-brand-card rounded-lg border border-brand-border cursor-pointer hover:bg-white/5 transition-colors">
                                <span className="text-brand-text-muted font-bold text-lg">{ep.number}</span>
                                <div className="flex-grow">
                                    <h4 className="text-sm font-bold text-foreground">{ep.title}</h4>
                                    <p className="text-xs text-brand-text-muted">{ep.duration}</p>
                                </div>
                                <PlayIcon className="h-6 w-6 text-brand-primary" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* Right Panel: Cast, Genres, Info details */}
          <div className="space-y-5 bg-brand-card p-5 rounded-2xl border border-brand-border">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text-muted">
                Cast
              </span>
              <p className="text-xs text-foreground font-medium">
                {item.cast.join(", ")}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text-muted">
                Genres
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {item.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded bg-brand-card border border-brand-border text-brand-text-muted px-2 py-0.5 text-[10px] font-semibold"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-text-muted">
                Duration
              </span>
              <p className="text-xs text-foreground font-semibold">{item.duration}</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
