"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import type { MovieOrShow } from "@/types/media";
import { IconPlayerPlay, IconInfoCircle, IconStar, IconChevronLeft, IconChevronRight, IconSparkles, IconPlaylist } from "@tabler/icons-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/stores/useAuthStore";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";

interface CatalogSpotlightHeroProps {
  items: MovieOrShow[];
  type: "movies" | "series" | "anime" | string;
  onPlay: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function CatalogSpotlightHero({
  items,
  type,
  onPlay,
  onOpenDetails,
}: CatalogSpotlightHeroProps) {
  const { translate: _ } = useLanguage();
  const { user } = useAuthStore();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const slides = items.slice(0, 5);
  const current = slides[currentIndex];

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 8000);
    return () => clearInterval(timer);
  }, [currentIndex, slides.length]);

  const handleNext = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
      setIsFading(false);
    }, 300);
  };

  const handlePrev = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
      setIsFading(false);
    }, 300);
  };

  if (!current) return null;

  const categoryBadge =
    type === "movies"
      ? { label: "À la une · Films", color: "from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300", icon: "🎬" }
      : type === "series"
      ? { label: "À la une · Séries", color: "from-brand-primary/20 to-purple-500/20 border-brand-primary/30 text-purple-300", icon: "📺" }
      : { label: "À la une · Anime", color: "from-brand-secondary/20 to-amber-500/20 border-brand-secondary/30 text-amber-300", icon: "✨" };

  return (
    <div className="relative w-full px-2 sm:px-6 md:px-12 lg:px-[3%] pt-2 pb-4">
      <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl min-h-[320px] sm:min-h-[380px] md:min-h-[440px] flex flex-col justify-end">
        
        {/* Background Backdrop with Gradient Overlays - Bright & Crisp */}
        <div className="absolute inset-0 z-0">
          {current.backdropUrl ? (
            <Image
              src={current.backdropUrl}
              alt={current.title}
              fill
              priority
              className={`object-cover object-right md:object-center transition-all duration-700 ease-out ${
                isFading ? "opacity-40 scale-105" : "opacity-90 scale-100"
              }`}
            />
          ) : current.posterUrl ? (
            <Image
              src={current.posterUrl}
              alt={current.title}
              fill
              priority
              className={`object-cover object-right md:object-center transition-all duration-700 ease-out ${
                isFading ? "opacity-40 scale-105" : "opacity-85 scale-100"
              }`}
            />
          ) : null}

          {/* Clean contrast shield for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent md:hidden" />
          <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent w-3/4" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent h-24 bottom-0" />
        </div>

        {/* Content Body */}
        <div className="relative z-10 p-5 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          
          <div className="max-w-2xl space-y-3 sm:space-y-4">
            
            {/* Category Tag & Rating */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border backdrop-blur-md bg-gradient-to-r ${categoryBadge.color}`}>
                <span>{categoryBadge.icon}</span>
                <span>{categoryBadge.label}</span>
              </span>

              {Boolean(current.rating) && (
                <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold border border-white/10 text-amber-400">
                  <IconStar className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{current.rating}</span>
                </div>
              )}

              {current.year && (
                <span className="text-xs font-bold text-zinc-300 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  {current.year}
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-md line-clamp-2">
              {current.title}
            </h2>

            {/* Synopsis */}
            {current.description && (
              <p className="text-xs sm:text-sm text-zinc-200 font-normal line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl">
                {current.description}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => onPlay(current)}
                className="flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white text-black font-black text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              >
                <IconPlayerPlay className="h-4 w-4 fill-black" />
                <span>Regarder</span>
              </button>

              <button
                onClick={() => onOpenDetails(current)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-md border border-white/15 transition-all cursor-pointer"
              >
                <IconInfoCircle className="h-4 w-4" />
                <span>Détails</span>
              </button>

              {user && (
                <button
                  onClick={() => setShowPlaylistModal(true)}
                  title="Enregistrer dans une playlist ou À regarder plus tard"
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-black/40 hover:bg-black/60 text-cyan-400 hover:text-white font-bold text-xs sm:text-sm backdrop-blur-md border border-white/15 transition-all cursor-pointer"
                >
                  <IconPlaylist className="h-4 w-4" />
                  <span>Enregistrer</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Controls & Slide Thumbnails */}
          {slides.length > 1 && (
            <div className="flex items-center gap-2 self-end md:self-auto bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={handlePrev}
                aria-label="Précédent"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>

              {/* Slide Dots */}
              <div className="flex items-center gap-1.5 px-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIsFading(true);
                      setTimeout(() => {
                        setCurrentIndex(idx);
                        setIsFading(false);
                      }, 200);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? "w-6 bg-brand-primary" : "w-2 bg-zinc-600 hover:bg-zinc-400"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                aria-label="Suivant"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

        </div>
      </div>

      {showPlaylistModal && current && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          media={{
            tmdbId: String(current.id),
            mediaType: current.type === "series" ? "series" : current.type === "anime" ? "anime" : "movie",
            title: current.title,
            posterPath: current.posterUrl,
            backdropPath: current.backdropUrl,
          }}
        />
      )}
    </div>
  );
}
