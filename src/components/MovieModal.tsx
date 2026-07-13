"use client";

import React, { useEffect, useRef } from "react";
import { MovieOrShow, MOCK_MEDIA } from "@/app/mockData";
import { XMarkIcon, PlayIcon, PlusIcon, CheckIcon, StarIcon } from "@heroicons/react/24/solid";

interface MovieModalProps {
  item: MovieOrShow | null;
  isOpen: boolean;
  onClose: () => void;
  onWatch: (item: MovieOrShow) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  onOpenDetails: (item: MovieOrShow) => void; // to allow navigating similar content
}

export default function MovieModal({
  item,
  isOpen,
  onClose,
  onWatch,
  favorites,
  toggleFavorite,
  onOpenDetails,
}: MovieModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const isFavorite = favorites.includes(item.id);

  // Filter similar items based on type and shared genres
  const similarContent = MOCK_MEDIA.filter(
    (media) =>
      media.id !== item.id &&
      media.type === item.type &&
      media.genres.some((g) => item.genres.includes(g))
  ).slice(0, 4);

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
          <img
            src={item.backdropUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 banner-overlay" />

          {/* Close Button overlay */}
          <button
            onClick={onClose}
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

              <button
                onClick={() => toggleFavorite(item.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-sm transition-all border backdrop-blur-sm cursor-pointer ${
                  isFavorite
                    ? "bg-zinc-800/40 text-brand-primary border-brand-primary/30"
                    : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                }`}
              >
                {isFavorite ? (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    In Favorites
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-5 w-5" />
                    Add to Favorites
                  </>
                )}
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

        {/* Similar Content / Recommendations Section */}
        {similarContent.length > 0 && (
          <div className="p-6 md:p-8 border-t border-brand-border space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-text-muted">
              Similar Content
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {similarContent.map((media) => (
                <div
                  key={media.id}
                  onClick={() => onOpenDetails(media)}
                  className="group cursor-pointer space-y-2 bg-brand-card p-2.5 rounded-xl border border-brand-border hover:border-brand-primary/20 transition-all duration-300"
                >
                  <div className="aspect-[16/10] w-full rounded-lg overflow-hidden bg-zinc-950 relative">
                    <img
                      src={media.backdropUrl}
                      alt={media.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-550"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground group-hover:text-brand-primary transition-colors truncate">
                      {media.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[9px] text-brand-text-muted font-bold">
                      <span>{media.year}</span>
                      <div className="flex items-center gap-0.5 text-amber-400 font-semibold">
                        <StarIcon className="h-2.5 w-2.5 fill-amber-400" />
                        <span>{media.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
