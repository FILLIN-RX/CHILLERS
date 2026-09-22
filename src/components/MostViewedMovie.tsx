"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Info, CalendarBlank, HourglassSimple, CaretLeft, CaretRight, FilmSlate } from "@phosphor-icons/react";
import type { MovieOrShow } from "@/types/media";

interface MostViewedMovieProps {
  items?: MovieOrShow[];
  item?: MovieOrShow;
  onWatchNow?: (movie: MovieOrShow) => void;
  onOpenDetails: (movie: MovieOrShow) => void;
}

export default function MostViewedMovie({
  items,
  item,
  onWatchNow: _onWatchNow,
  onOpenDetails,
}: MostViewedMovieProps) {
  // Filtrer STRICTEMENT les films à venir (non encore sortis) avec une affiche poster
  const slides = useMemo(() => {
    const raw = items && items.length > 0 ? items : item ? [item] : [];
    const today = new Date().toISOString().split("T")[0];
    const unreleased = raw.filter((m) => {
      if (!m.posterUrl) return false;
      return Boolean(m.releaseDate && m.releaseDate >= today);
    });
    // S'il y a des films non sortis, les afficher ; sinon fallback sur ceux avec poster
    return unreleased.length > 0 ? unreleased.slice(0, 10) : raw.filter((m) => Boolean(m.posterUrl)).slice(0, 8);
  }, [items, item]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const handleNext = useCallback(() => {
    if (slides.length <= 1) return;
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
      setIsFading(false);
    }, 220);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    if (slides.length <= 1) return;
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
      setIsFading(false);
    }, 220);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length, isPaused, handleNext]);

  if (slides.length === 0) return null;

  const current = slides[currentIndex] || slides[0];
  const posterSrc = current.posterUrl || current.backdropUrl;

  const releaseDateLabel = current.releaseDate ? (() => {
    try {
      return new Date(current.releaseDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return current.releaseDate;
    }
  })() : null;

  return (
    <div className="w-full">
      {/* 
        Alignement parfait sur la même ligne que les rangées de films :
        - Le poster commence à 0px sur la gauche de la carte
        - Thème couleur Bleu Saphir / Cyan Néon vibrant
        - Aucune bordure colorée parasite (border-0)
        - Aucun shadow lourd (shadow-none)
      */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border-0 shadow-none bg-gradient-to-r from-[#0a192f] via-[#0d223f] to-[#071324] flex flex-col sm:flex-row items-center sm:items-stretch"
      >
        {/* POSTER VERTICAL DU FILM (Aligné sur la ligne gauche exacte) */}
        <div
          onClick={() => onOpenDetails(current)}
          className={`relative flex-none w-36 xs:w-44 sm:w-52 md:w-60 aspect-[2/3] overflow-hidden bg-zinc-900 cursor-pointer group transition-opacity duration-300 shrink-0 ${
            isFading ? "opacity-40" : "opacity-100"
          }`}
        >
          {posterSrc && (
            <Image
              key={current.id}
              src={posterSrc}
              alt={current.title}
              fill
              sizes="(max-width: 640px) 180px, (max-width: 1024px) 240px, 260px"
              className="object-cover object-top hover:scale-105 transition-transform duration-500"
              priority={false}
              loading="lazy"
            />
          )}
        </div>

        {/* DÉTAILS ET INFORMATIONS DU FILM (Thème Bleu Saphir & Cyan) */}
        <div className="flex-1 flex flex-col justify-between min-w-0 p-4 sm:p-6 md:p-8 text-center sm:text-left space-y-3 sm:space-y-4">
          <div>
            {/* Badges : Bientôt au cinéma & Date de sortie en Cyan / Bleu (sans bordure surbrillante ni pulse) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2.5 sm:mb-3.5">
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border-0 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-none">
                <HourglassSimple className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bientôt au cinéma</span>
              </span>

              {releaseDateLabel && (
                <span className="flex items-center gap-1.5 rounded-full bg-blue-500/20 text-blue-200 border-0 px-3 py-1 text-[10px] sm:text-xs font-bold shadow-none">
                  <CalendarBlank className="w-3.5 h-3.5 text-blue-300" />
                  <span>Sortie le {releaseDateLabel}</span>
                </span>
              )}

              {current.genres && current.genres.length > 0 && (
                <span className="hidden md:inline-flex items-center rounded-full bg-cyan-950/40 text-cyan-400/90 border-0 px-2.5 py-1 text-[10px] sm:text-xs font-medium shadow-none">
                  {current.genres.slice(0, 2).join(" • ")}
                </span>
              )}
            </div>

            {/* Titre du film */}
            <h3 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-2 tracking-tight line-clamp-2">
              {current.title}
            </h3>

            {/* Synopsis */}
            <p className="text-slate-300 text-xs sm:text-sm md:text-base line-clamp-2 sm:line-clamp-3 md:line-clamp-4 leading-relaxed max-w-2xl">
              {current.synopsis || current.description || "Retrouvez très prochainement ce film à l'affiche et en streaming sur CHILLERS."}
            </p>
          </div>

          {/* Actions et Contrôles en Bleu / Cyan */}
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 pt-2">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                onClick={() => onOpenDetails(current)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer shadow-none border-0"
              >
                <Info className="w-4 h-4 text-white" />
                <span>Voir la fiche</span>
              </button>

              {current.trailerUrl && (
                <button
                  onClick={() => onOpenDetails(current)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-950/70 hover:bg-blue-900/90 text-cyan-300 border-0 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer backdrop-blur-md shadow-none"
                >
                  <FilmSlate className="w-4 h-4 text-cyan-400" />
                  <span>Bande-annonce</span>
                </button>
              )}
            </div>

            {/* Toggle manuel : Boutons fléchés & Indicateurs Cyan */}
            {slides.length > 1 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(idx);
                      }}
                      aria-label={`Film ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer border-0 shadow-none ${
                        idx === currentIndex ? "w-6 bg-cyan-400" : "w-1.5 bg-white/30 hover:bg-white/60"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrev();
                    }}
                    aria-label="Film précédent"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-950/70 hover:bg-blue-900/90 text-cyan-300 border-0 transition-all active:scale-95 cursor-pointer shadow-none"
                  >
                    <CaretLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                    aria-label="Film suivant"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-950/70 hover:bg-blue-900/90 text-cyan-300 border-0 transition-all active:scale-95 cursor-pointer shadow-none"
                  >
                    <CaretRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
