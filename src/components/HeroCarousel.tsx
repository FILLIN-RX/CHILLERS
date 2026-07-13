"use client";

import React, { useState, useEffect, useRef } from "react";
import { MovieOrShow } from "@/app/mockData";
import { PlayIcon, PauseIcon, PlusIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { StarIcon } from "@heroicons/react/24/solid";

interface HeroCarouselProps {
  slides: MovieOrShow[];
  onWatchNow: (movie: MovieOrShow) => void;
  onOpenDetails: (movie: MovieOrShow) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  slideTimings?: number[];
}

export default function HeroCarousel({
  slides,
  onWatchNow,
  onOpenDetails,
  favorites,
  toggleFavorite,
  slideTimings,
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto rotate slides with per-slide timing (paused when user pauses video)
  useEffect(() => {
    if (isPaused) return;
    const duration = (slideTimings && slideTimings[currentIndex]) || 20000;
    const timer = setInterval(() => {
      handleNext();
    }, duration);
    return () => clearInterval(timer);
  }, [currentIndex, slideTimings, isPaused]);

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Pause/resume <video> element when isPaused changes
  useEffect(() => {
    if (videoRef.current) {
      isPaused ? videoRef.current.pause() : videoRef.current.play();
    }
    // For YouTube iframes, use postMessage
    const iframe = document.querySelector('iframe[data-hero-video]') as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: isPaused ? 'pauseVideo' : 'playVideo', args: '' }),
        '*'
      );
    }
  }, [isPaused]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    setIsPaused(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    setIsPaused(false);
  };

  if (!slides || slides.length === 0) {
    return (
      <section className="relative w-full h-screen bg-zinc-950 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse" />
        <div className="z-10 flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
          <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm animate-pulse">Loading Cinematic Experience...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {/* Sliding Wrapper */}
      <div 
        className="flex flex-row w-full h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, index) => {
          const isFavorite = favorites.includes(slide.id);
          const isActive = index === currentIndex;

          return (
            <div key={slide.id} className="w-full h-full flex-shrink-0 relative">
              {/* Background Media Container */}
              <div className="absolute inset-0 w-full h-full bg-black">
                {/* Static Backdrop Image */}
                <img
                  src={slide.backdropUrl}
                  alt={slide.title}
                  className="w-full h-full object-cover object-center"
                />

                {/* Autoplay background video (hidden when paused) */}
                {isActive && slide.videoUrl && !isPaused && (
                  slide.videoUrl.includes("youtube") || slide.videoUrl.includes("embed") ? (
                    <iframe
                      data-hero-video
                      src={`${slide.videoUrl}?autoplay=1&controls=0&mute=1&loop=1&playlist=${slide.videoUrl.split('/').pop()}&enablejsapi=1`}
                      className="absolute inset-0 w-full h-full border-none pointer-events-none"
                      allow="autoplay; encrypted-media"
                      title={slide.title}
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      src={slide.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )
                )}

                {/* Cinematic gradient overlays from globals.css */}
                <div className="absolute inset-0 banner-overlay" />
                <div className="absolute inset-x-0 top-0 h-32 banner-overlay-top" />
              </div>

              {/* Floating Interactive Play Button (Center-Right overlay style) */}
              <div className="absolute top-1/2 right-[10%] md:right-[15%] -translate-y-1/2 hidden md:block z-20">
                <button
                  onClick={() => onWatchNow(slide)}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/50 text-white cursor-pointer transition-all duration-500 hover:scale-110 shadow-3xl hover:shadow-brand-primary/40 group backdrop-blur-sm"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary group-hover:bg-brand-primary/90 transition-all duration-300">
                    <PlayIcon className="h-8 w-8 text-white translate-x-0.5" />
                  </div>
                </button>
              </div>

              {/* Hero Content Area */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-8 md:px-12 lg:px-[4%] pb-16 sm:pb-20 lg:pb-24 max-w-[1600px] mx-auto">
                <div className="space-y-4 md:space-y-6 max-w-2xl">
                  {/* Metadata Badges */}
                  <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-zinc-300 font-medium">
                    <span className="rounded bg-brand-primary/10 px-2.5 py-1 text-brand-primary font-bold border border-brand-primary/20 uppercase tracking-wider text-[10px]">
                      Featured
                    </span>
                    <span>{slide.year}</span>
                    <span className="text-zinc-500">•</span>
                    <span>{slide.duration}</span>
                    <span className="text-zinc-500">•</span>
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <StarIcon className="h-4 w-4 fill-amber-400" />
                      <span>{slide.rating}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl font-sans drop-shadow-md">
                    {slide.title}
                  </h1>

                  {/* Description */}
                  <p className="text-sm sm:text-base md:text-lg text-zinc-200 max-w-2xl font-light leading-relaxed line-clamp-3 drop-shadow">
                    {slide.description}
                  </p>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {slide.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-black/40 border border-white/10 px-3 py-1 text-xs text-zinc-300 font-medium backdrop-blur-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-4 pt-3">
                    <button
                      onClick={() => onWatchNow(slide)}
                      className="flex items-center gap-2 rounded-full bg-brand-primary hover:bg-brand-primary/95 text-white px-6 py-3 font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-xl shadow-brand-primary/25 cursor-pointer"
                    >
                      <PlayIcon className="h-5 w-5" />
                      Watch Now
                    </button>

                    <button
                      onClick={() => toggleFavorite(slide.id)}
                      className={`flex items-center gap-2 rounded-full px-5 py-3 font-semibold text-sm transition-all duration-300 border backdrop-blur-sm hover:scale-105 cursor-pointer ${
                        isFavorite
                          ? "bg-zinc-850 text-brand-primary border-brand-primary/45"
                          : "bg-white/10 text-white border-white/10 hover:bg-white/20"
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

                    <button
                      onClick={() => onOpenDetails(slide)}
                      className="rounded-full bg-black/40 border border-white/10 text-zinc-200 hover:text-white px-5 py-3 text-sm font-semibold transition-all duration-300 hover:bg-black/60 backdrop-blur-sm cursor-pointer"
                    >
                      More Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Pause/Play & Slide Navigation Controls */}
      <div className="absolute right-4 bottom-16 z-20 flex items-center gap-2">
        <button
          onClick={togglePause}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white hover:bg-brand-primary/40 hover:border-brand-primary/50 backdrop-blur-md transition-all duration-300 cursor-pointer group"
          title={isPaused ? "Play video" : "Pause video"}
        >
          {isPaused ? (
            <PlayIcon className="h-5 w-5 ml-0.5" />
          ) : (
            <PauseIcon className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={handlePrev}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
          title="Previous slide"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          onClick={handleNext}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
          title="Next slide"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-20 flex gap-2.5">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setIsPaused(false);
            }}
            className={`h-2.5 rounded-full transition-all duration-500 cursor-pointer ${
              index === currentIndex
                ? "w-8 bg-brand-primary shadow-lg shadow-brand-primary/50"
                : "w-2.5 bg-white/30 hover:bg-white/50"
            }`}
            title={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
