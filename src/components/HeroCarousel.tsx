"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { MovieOrShow } from "@/app/mockData";
import { PlayIcon, PauseIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { StarIcon } from "@heroicons/react/24/solid";
import { useLanguage } from "@/i18n/LanguageContext";

interface HeroCarouselProps {
  slides: MovieOrShow[];
  onWatchNow: (movie: MovieOrShow) => void;
  onOpenDetails: (movie: MovieOrShow) => void;
  slideTimings?: number[];
}

export default function HeroCarousel({
  slides,
  onWatchNow,
  onOpenDetails,
  slideTimings,
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { translate: _ } = useLanguage();

  useEffect(() => {
    if (slides.length > 0) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [slides.length]);

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

  // P1-#2: split into two effects so the <video> mute/pause action doesn't
  // re-fire every time the user changes slide, and the iframe postMessage
  // doesn't accidentally hit an iframe from a different slide.
  // 1. Local <video> element: pause/play when [isPaused] changes.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (isPaused) node.pause();
    else node.play().catch(() => {});
  }, [isPaused, currentIndex]);

  // 2. YouTube iframe: postMessage only when [isPaused] changes, and only to
  // the iframe currently marked data-hero-video. (We re-query on each effect
  // run because the iframe DOM node swaps with `currentIndex`.)
  useEffect(() => {
    const iframe = document.querySelector(
      'iframe[data-hero-video]',
    ) as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: isPaused ? 'pauseVideo' : 'playVideo',
          args: '',
        }),
        '*',
      );
    }
  }, [isPaused, currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    setIsPaused(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    setIsPaused(false);
  };

  if (!slides || slides.length === 0) {
    if (!timedOut) {
      return (
        <section className="relative w-full h-screen bg-zinc-950 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse" />
          <div className="z-10 flex flex-col items-center gap-4">
            <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
            <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm animate-pulse">{_("hero.loading")}</p>
          </div>
        </section>
      );
    }
    return (
      <section className="relative w-full h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="z-10 flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-3xl text-zinc-500">!</span>
          </div>
          <h1 className="text-white text-xl font-bold">{_("hero.connectionError")}</h1>
          <p className="text-zinc-400 text-sm">
            {_("hero.connectionErrorDesc")}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-3 rounded-full bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 transition-all"
          >
            {_("hero.retry")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      <div 
        className="flex flex-row w-full h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;

          return (
            <div key={slide.id} className="w-full h-full flex-shrink-0 relative">
              <div className="absolute inset-0 w-full h-full bg-black">
                <Image
                  src={slide.backdropUrl}
                  alt={slide.title}
                  fill
                  className="object-cover object-center"
                  style={{ filter: "brightness(0.85) saturate(1.1)" }}
                  sizes="100vw"
                  priority={index === 0}
                />

                {isActive && slide.videoUrl && !isPaused && (
                  slide.videoUrl.startsWith("https://www.youtube.com/embed/") ? (
                    <iframe
                      data-hero-video
                      src={`${slide.videoUrl}?autoplay=1&controls=0&mute=1&loop=1&playlist=${slide.videoUrl.split('/').pop()}&enablejsapi=1`}
                      className="absolute inset-0 w-full h-full border-none pointer-events-none"
                      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
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

                <div className="absolute inset-0 banner-overlay" />
                <div className="absolute inset-x-0 top-0 h-32 banner-overlay-top" />
              </div>

              {/* P3-B: was `hidden md:block` which made the play button invisible
                  on mobile. Show on all viewports; right offset scales down. */}
              <div className="absolute top-1/2 right-[5%] sm:right-[10%] md:right-[15%] -translate-y-1/2 z-20">
                <button
                  onClick={() => onWatchNow(slide)}
                  aria-label={`${_("hero.watchNow")} ${slide.title}`}
                  className="flex h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/50 text-white cursor-pointer transition-all duration-500 hover:scale-110 shadow-3xl hover:shadow-brand-primary/40 group backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-brand-primary group-hover:bg-brand-primary/90 transition-all duration-300">
                    <PlayIcon className="h-5 w-5 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white translate-x-0.5" />
                  </div>
                </button>
              </div>

              <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-8 md:px-12 lg:px-[4%] pb-20 sm:pb-20 lg:pb-24 max-w-[1600px] mx-auto">
                <div className="space-y-3 md:space-y-6 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs md:text-sm text-zinc-300 font-medium">
                    <span className="rounded bg-brand-primary/10 px-2.5 py-1 text-brand-primary font-bold border border-brand-primary/20 uppercase tracking-wider text-[10px]">
                      {_("hero.featured")}
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

                  <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl md:text-6xl lg:text-7xl font-sans drop-shadow-md leading-tight">
                    {slide.title}
                  </h1>

                  <p className="hidden sm:block text-sm sm:text-base md:text-lg text-zinc-200 max-w-2xl font-light leading-relaxed line-clamp-3 drop-shadow">
                    {slide.description}
                  </p>

                  <div className="hidden sm:flex flex-wrap gap-2 pt-1">
                    {slide.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-black/40 border border-white/10 px-3 py-1 text-xs text-zinc-300 font-medium backdrop-blur-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-2 sm:pt-3">
                    <button
                      onClick={() => onWatchNow(slide)}
                      className="flex items-center gap-2 rounded-full bg-brand-primary hover:bg-brand-primary/95 text-white px-5 sm:px-6 py-2.5 sm:py-3 font-semibold text-sm transition-all duration-300 hover:scale-105 shadow-xl shadow-brand-primary/25 cursor-pointer"
                    >
                      <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      {_("hero.watchNow")}
                    </button>

                    <button
                      onClick={() => onOpenDetails(slide)}
                      className="rounded-full bg-black/40 border border-white/10 text-zinc-200 hover:text-white px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold transition-all duration-300 hover:bg-black/60 backdrop-blur-sm cursor-pointer"
                    >
                      <span className="hidden sm:inline">{_("hero.moreDetails")}</span>
                      <span className="sm:hidden">{_("hero.details")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute right-4 bottom-16 z-20 flex items-center gap-2">
        <button
          onClick={togglePause}
          aria-label={isPaused ? _("player.play") : _("player.pause")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white hover:bg-brand-primary/40 hover:border-brand-primary/50 backdrop-blur-md transition-all duration-300 cursor-pointer group"
        >
          {isPaused ? (
            <PlayIcon className="h-5 w-5 ml-0.5" />
          ) : (
            <PauseIcon className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={handlePrev}
          aria-label={_("common.previous")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          onClick={handleNext}
          aria-label={_("common.next")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-20 flex gap-2.5">
        {slides.map((_s, index) => (
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
            title={`${_("common.page")} ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
