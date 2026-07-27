"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import gsap from "gsap";

interface ScrollRowProps {
  title: string;
  accentColor?: "primary" | "secondary";
  autoScroll?: boolean;
  autoScrollSpeed?: number;
  children: React.ReactNode;
  className?: string;
}

export default function ScrollRow({
  title,
  accentColor = "primary",
  autoScroll = false,
  autoScrollSpeed = 0.5,
  children,
  className = "",
}: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const autoTween = useRef<gsap.core.Tween | null>(null);
  const scrollTween = useRef<gsap.core.Tween | null>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollTween.current) scrollTween.current.kill();

    const amount = el.clientWidth * 0.75;
    const target = direction === "right" ? el.scrollLeft + amount : el.scrollLeft - amount;

    scrollTween.current = gsap.to(el, {
      scrollLeft: target,
      duration: 0.6,
      ease: "power3.out",
      onUpdate: updateScrollState,
    });
  };

  useEffect(() => {
    if (!autoScroll) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;

    const dur = maxScroll / autoScrollSpeed / 60;

    const tween = gsap.to(el, {
      scrollLeft: maxScroll,
      duration: dur,
      ease: "none",
      paused: isHovered,
      repeat: -1,
      yoyo: false,
      onRepeat: () => {
        gsap.set(el, { scrollLeft: 0 });
      },
      repeatDelay: 0.8,
      onUpdate: updateScrollState,
    });

    autoTween.current = tween;

    return () => {
      tween.kill();
    };
  }, [autoScroll, autoScrollSpeed, isHovered, updateScrollState]);

  useEffect(() => {
    const tween = autoTween.current;
    if (!tween) return;
    if (isHovered) {
      tween.pause();
    } else {
      tween.resume();
    }
  }, [isHovered]);

  const accentClass =
    accentColor === "secondary" ? "bg-brand-secondary" : "bg-brand-primary";

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between pr-1">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span className={`h-3 w-1 ${accentClass} rounded-full`} />
          {title}
        </h2>

        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 focus:outline-none ${
              canScrollLeft
                ? "border-zinc-600 bg-zinc-900 text-white hover:border-zinc-400 hover:bg-zinc-800 cursor-pointer"
                : "border-zinc-800 bg-zinc-950 text-zinc-700 cursor-not-allowed opacity-50"
            }`}
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 focus:outline-none ${
              canScrollRight
                ? "border-zinc-600 bg-zinc-900 text-white hover:border-zinc-400 hover:bg-zinc-800 cursor-pointer"
                : "border-zinc-800 bg-zinc-950 text-zinc-700 cursor-not-allowed opacity-50"
            }`}
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="relative group/row"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`pointer-events-none absolute left-0 top-0 h-full w-16 z-10 transition-opacity duration-300 hidden md:block
            bg-gradient-to-r from-brand-dark to-transparent ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
        />

        <div
          className={`pointer-events-none absolute right-0 top-0 h-full w-16 z-10 transition-opacity duration-300 hidden md:block
            bg-gradient-to-l from-brand-dark to-transparent ${canScrollRight ? "opacity-100" : "opacity-0"}`}
        />

        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="sm:hidden absolute left-0 top-0 h-full w-10 z-20 flex items-center justify-start pl-1 bg-gradient-to-r from-black/60 to-transparent cursor-pointer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border border-white/20 backdrop-blur-sm">
              <IconChevronLeft className="h-5 w-5 text-white" />
            </span>
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="sm:hidden absolute right-0 top-0 h-full w-10 z-20 flex items-center justify-end pr-1 bg-gradient-to-l from-black/60 to-transparent cursor-pointer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border border-white/20 backdrop-blur-sm">
              <IconChevronRight className="h-5 w-5 text-white" />
            </span>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-3 overflow-x-auto pb-3 no-scrollbar"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
