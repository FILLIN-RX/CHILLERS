"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { MovieOrShow } from "@/types/media";
import { Play, Pause, CaretLeft, CaretRight, Star } from "@phosphor-icons/react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useHydrated } from "@/hooks/useHydrated";
import Button from "@/components/Button";
import { getMediaTrailerUrl } from "@/app/api";

interface HeroCarouselProps {
  slides: MovieOrShow[];
  onWatchNow: (movie: MovieOrShow) => void;
  onOpenDetails: (movie: MovieOrShow) => void;
  slideTimings?: number[];
}

function getYouTubeKey(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:embed\/|v=|vi\/|youtu\.be\/|\/v\/|watch\?v=)([\w-]{11})/);
  if (match) return match[1];
  if (url.length === 11 && !url.includes("/")) return url;
  return null;
}

export default function HeroCarousel({
  slides,
  onWatchNow,
  onOpenDetails,
  slideTimings,
}: HeroCarouselProps) {
  const hydrated = useHydrated();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [trailerMap, setTrailerMap] = useState<Record<string, string>>({});
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoExpired, setVideoExpired] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { translate: _ } = useLanguage();

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Lazy loading fluide du trailer UNIQUEMENT pour la slide active avec debounce
  useEffect(() => {
    setIsVideoReady(false);
    setVideoExpired(false);

    if (!slides || slides.length === 0 || isPaused || isMobile) return;
    const currentSlide = slides[currentIndex];
    if (!currentSlide) return;

    // Si on a déjà l'URL du trailer dans la slide ou en cache interne
    const existingUrl = currentSlide.videoUrl || trailerMap[currentSlide.id];
    if (existingUrl) {
      const timer = setTimeout(() => setIsVideoReady(true), 300);
      return () => clearTimeout(timer);
    }

    // Charger le trailer à la demande après 800ms de présence sur la slide (évite de spammer si défilement rapide)
    const loadTimer = setTimeout(async () => {
      try {
        const isTV = currentSlide.type === "series" || currentSlide.type === "anime";
        const url = await getMediaTrailerUrl(currentSlide.id, isTV);
        if (url) {
          setTrailerMap((prev) => ({ ...prev, [currentSlide.id]: url }));
          setIsVideoReady(true);
        }
      } catch {}
    }, 800);

    return () => clearTimeout(loadTimer);
  }, [currentIndex, slides, isPaused, trailerMap]);

  // Durée d'affichage de la vidéo (pause automatique après 25s pour économiser CPU)
  useEffect(() => {
    if (!isVideoReady || isPaused) return;
    const timer = setTimeout(() => setVideoExpired(true), 25_000);
    return () => clearTimeout(timer);
  }, [currentIndex, isVideoReady, isPaused]);

  // Timeout d'erreur si aucune slide après 8 secondes
  useEffect(() => {
    if (slides && slides.length > 0) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [slides]);

  const handleNext = useCallback(() => {
    if (!slides || slides.length === 0) return;
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }, [slides]);

  const handlePrev = useCallback(() => {
    if (!slides || slides.length === 0) return;
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }, [slides]);

  // Défilement automatique du carrousel
  useEffect(() => {
    if (isPaused || !slides || slides.length === 0) return;
    const duration = (slideTimings && slideTimings[currentIndex]) || 12000;
    const timer = setInterval(() => {
      handleNext();
    }, duration);
    return () => clearInterval(timer);
  }, [currentIndex, slideTimings, isPaused, slides, handleNext]);

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Contrôle Pause/Play de la vidéo native
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (isPaused) node.pause();
    else node.play().catch(() => {});
  }, [isPaused, currentIndex]);

  // Contrôle Pause/Play de l'iframe YouTube
  useEffect(() => {
    const iframe = document.querySelector(
      "iframe[data-hero-video]",
    ) as HTMLIFrameElement | null;
    if (iframe?.contentWindow && document.contains(iframe)) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: isPaused ? "pauseVideo" : "playVideo",
            args: "",
          }),
          "*",
        );
      } catch {}
    }
  }, [isPaused, currentIndex]);

  if (!slides || slides.length === 0) {
    if (!timedOut) {
      return (
        <section className="relative w-full h-[70vh] sm:h-[80vh] lg:h-[88vh] bg-zinc-950 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse" />
          <div className="z-10 flex flex-col items-center gap-4">
            <div className="h-12 w-12 border-4 border-zinc-700 border-t-brand-primary rounded-full animate-spin" />
            <p className="text-zinc-500 font-bold tracking-widest uppercase text-sm animate-pulse">
              {_("hero.loading")}
            </p>
          </div>
        </section>
      );
    }
    return (
      <section className="relative w-full h-[70vh] sm:h-[80vh] lg:h-[88vh] bg-zinc-950 flex items-center justify-center px-6">
        <div className="z-10 flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-3xl text-zinc-500">!</span>
          </div>
          <h1 className="text-white text-xl font-bold">{_("hero.connectionError")}</h1>
          <p className="text-zinc-400 text-sm">{_("hero.connectionErrorDesc")}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
            size="md"
            className="mt-2"
            ariaLabel={_("hero.retry")}
          >
            {_("hero.retry")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full h-[70vh] sm:h-[80vh] lg:h-[88vh] overflow-hidden bg-black select-none">
      <div
        className="flex flex-row w-full h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const activeTrailer = slide.videoUrl || trailerMap[slide.id];
          const ytKey = getYouTubeKey(activeTrailer);

          return (
            <div key={slide.id} className="w-full h-full flex-shrink-0 relative">
              <div className="absolute inset-0 w-full h-full bg-black">
                {/* Backdrop Image */}
                <Image
                  src={slide.backdropOriginalUrl || slide.backdropUrl}
                  alt={slide.title}
                  fill
                  className="object-cover object-center transition-opacity duration-700"
                  style={{ filter: "brightness(0.8) saturate(1.1)" }}
                  sizes="100vw"
                  priority={index === 0}
                  loading={index === 0 ? "eager" : "lazy"}
                  {...(index === 0 ? { fetchPriority: "high" } : {})}
                />

                {/* Video / Trailer Overlay (Smooth Fade-in) */}
                {isActive && activeTrailer && isVideoReady && !isPaused && !videoExpired && !isMobile && (
                  <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-[1] transition-opacity duration-1000 opacity-100 animate-in fade-in duration-700">
                    {ytKey ? (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] min-w-[177.78vh] h-[56.25vw] min-h-full scale-125 sm:scale-115">
                        <iframe
                          data-hero-video
                          src={`https://www.youtube.com/embed/${ytKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytKey}&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&enablejsapi=1`}
                          className="w-full h-full border-none pointer-events-none"
                          allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={slide.title}
                        />
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        src={activeTrailer}
                        autoPlay
                        muted
                        playsInline
                        preload="auto"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>
                )}

                {/* Gradient Overlays for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent pointer-events-none z-[2]" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-[2]" />
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/80 via-black/20 to-transparent pointer-events-none z-[2]" />
              </div>

              {/* Play Hero Button (Center Right) */}
              <div className="absolute top-1/2 right-[5%] sm:right-[10%] md:right-[15%] -translate-y-1/2 z-20">
                <button
                  onClick={() => onWatchNow(slide)}
                  aria-label={`${_("hero.watchNow")} ${slide.title}`}
                  className="flex h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-brand-primary/20 hover:bg-brand-primary/30 border border-brand-primary/50 text-white cursor-pointer transition-all duration-500 hover:scale-110 shadow-3xl hover:shadow-brand-primary/40 group backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-brand-primary group-hover:bg-brand-primary/90 transition-all duration-300">
                    <Play className="h-5 w-5 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white translate-x-0.5" />
                  </div>
                </button>
              </div>

              {/* Slide Content (Bottom Left) */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-8 md:px-12 lg:px-[4%] pb-16 sm:pb-20 lg:pb-24">
                <div className="space-y-3 md:space-y-5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs md:text-sm text-zinc-300 font-medium">
                    <span className="rounded bg-brand-primary/20 text-brand-primary font-extrabold border-0 uppercase tracking-wider text-[10px] px-2.5 py-0.5">
                      {_("hero.featured")}
                    </span>
                    {slide.year > 0 && <span>{slide.year}</span>}
                    {slide.duration && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span>{slide.duration}</span>
                      </>
                    )}
                    {slide.rating > 0 && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <div className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <span>{slide.rating}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl font-sans drop-shadow-lg leading-tight line-clamp-2">
                    {slide.title}
                  </h1>

                  <p className="hidden sm:block text-xs sm:text-sm md:text-base text-zinc-300 max-w-2xl font-normal leading-relaxed line-clamp-2 sm:line-clamp-3">
                    {slide.description}
                  </p>

                  {slide.genres && slide.genres.length > 0 && (
                    <div className="hidden sm:flex flex-wrap gap-1.5 pt-0.5">
                      {slide.genres.slice(0, 4).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full bg-black/40 border-0 px-2.5 py-0.5 text-[11px] text-zinc-300 font-medium backdrop-blur-sm"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 pt-1 sm:pt-2">
                    <Button
                      onClick={() => onWatchNow(slide)}
                      variant="primary"
                      size="lg"
                      leftIcon={<Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />}
                      ariaLabel={`${_("hero.watchNow")} ${slide.title}`}
                    >
                      {_("hero.watchNow")}
                    </Button>

                    <Button
                      onClick={() => onOpenDetails(slide)}
                      variant="dark"
                      size="lg"
                      ariaLabel={`${_("hero.moreDetails")} ${slide.title}`}
                      className="bg-black/50 border-white/15 text-zinc-100 hover:text-white hover:bg-black/70 backdrop-blur-md"
                    >
                      <span className="hidden sm:inline">{_("hero.moreDetails")}</span>
                      <span className="sm:hidden">{_("hero.details")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Buttons (Right Bottom) */}
      <div className="absolute right-4 bottom-12 sm:bottom-16 z-20 flex items-center gap-2">
        <button
          onClick={togglePause}
          aria-label={isPaused ? _("player.play") : _("player.pause")}
          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white hover:bg-brand-primary/40 hover:border-brand-primary/50 backdrop-blur-md transition-all duration-300 cursor-pointer"
        >
          {isPaused ? <Play className="h-4 w-4 sm:h-5 sm:w-5 ml-0.5" /> : <Pause className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>
        <button
          onClick={handlePrev}
          aria-label={_("common.previous")}
          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
        >
          <CaretLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          onClick={handleNext}
          aria-label={_("common.next")}
          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
        >
          <CaretRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Pagination Dots (Bottom Center) */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-5 sm:bottom-8 z-20 flex gap-2">
        {slides.map((_s, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setIsPaused(false);
            }}
            className={`h-2 rounded-full transition-all duration-500 cursor-pointer ${
              index === currentIndex
                ? "w-7 bg-brand-primary shadow-lg shadow-brand-primary/50"
                : "w-2 bg-white/30 hover:bg-white/50"
            }`}
            title={`${_("common.page")} ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
