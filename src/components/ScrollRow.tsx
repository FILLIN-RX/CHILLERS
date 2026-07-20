"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

interface ScrollRowProps {
  title: string;
  accentColor?: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
}

export default function ScrollRow({
  title,
  accentColor = "primary",
  children,
  className = "",
}: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
    // scroll ~3 cards worth
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "right" ? amount : -amount, behavior: "smooth" });
  };

  const accentClass =
    accentColor === "secondary" ? "bg-brand-secondary" : "bg-brand-primary";

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Row header */}
      <div className="flex items-center justify-between pr-1">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span className={`h-3 w-1 ${accentClass} rounded-full`} />
          {title}
        </h2>

        {/* Desktop navigation arrows */}
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
            <ChevronLeftIcon className="h-4 w-4" />
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
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable row with side fade masks */}
      <div className="relative group/row">
        {/* Left fade mask (desktop only) */}
        {/* P3-A: fade masks are desktop-only (md+ = ≥768px). The mobile tap-target
            arrows below use `sm:hidden` (<640px), so there's a 640-768px band
            where neither renders — preferable to having both at the 640px
            boundary where the fade and the tap target would visually fight. */}
        <div
          className={`pointer-events-none absolute left-0 top-0 h-full w-12 z-10 transition-opacity duration-300 hidden md:block
            bg-gradient-to-r from-brand-dark to-transparent ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
        />

        {/* Right fade mask (desktop only) */}
        <div
          className={`pointer-events-none absolute right-0 top-0 h-full w-12 z-10 transition-opacity duration-300 hidden md:block
            bg-gradient-to-l from-brand-dark to-transparent ${canScrollRight ? "opacity-100" : "opacity-0"}`}
        />

        {/* Left arrow overlay (mobile tap target) */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="sm:hidden absolute left-0 top-0 h-full w-10 z-20 flex items-center justify-start pl-1 bg-gradient-to-r from-black/60 to-transparent cursor-pointer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border border-white/20 backdrop-blur-sm">
              <ChevronLeftIcon className="h-5 w-5 text-white" />
            </span>
          </button>
        )}

        {/* Right arrow overlay (mobile tap target) */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="sm:hidden absolute right-0 top-0 h-full w-10 z-20 flex items-center justify-end pr-1 bg-gradient-to-l from-black/60 to-transparent cursor-pointer"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 border border-white/20 backdrop-blur-sm">
              <ChevronRightIcon className="h-5 w-5 text-white" />
            </span>
          </button>
        )}

        {/* The actual scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 no-scrollbar scroll-smooth"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
