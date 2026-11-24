"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

import Link from "next/link";

interface ScrollRowProps {
  title: string;
  seeAllHref?: string;
  seeAllText?: string;
  onSeeAll?: () => void;
  accentColor?: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
}

export default function ScrollRow({
  title,
  seeAllHref,
  seeAllText = "Voir plus",
  onSeeAll,
  accentColor = "primary",
  children,
  className = "",
}: ScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atLeft = el.scrollLeft > 8;
      const atRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 8;
      setCanScrollLeft((prev) => (prev !== atLeft ? atLeft : prev));
      setCanScrollRight((prev) => (prev !== atRight ? atRight : prev));
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el || !document.contains(el)) return;

    const amount = el.clientWidth * 0.75;
    const target = direction === "right" ? el.scrollLeft + amount : el.scrollLeft - amount;
    el.scrollTo({ left: target, behavior: "smooth" });
  };

  const accentClass =
    accentColor === "secondary" ? "bg-brand-secondary" : "bg-brand-primary";

  return (
    <div className={`space-y-3 ${className}`}>
      {title ? (
        <div className="flex items-center justify-between pr-1">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className={`h-3 w-1 ${accentClass} rounded-full`} />
            {title}
          </h2>

          <div className="flex items-center gap-3">
            {seeAllHref ? (
              <Link
                href={seeAllHref}
                className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white flex items-center gap-0.5 py-1 px-1.5 rounded-[5px] group transition-colors focus:outline-none"
              >
                <span>{seeAllText}</span>
                <CaretRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : onSeeAll ? (
              <button
                onClick={onSeeAll}
                className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white flex items-center gap-0.5 py-1 px-1.5 rounded-[5px] group transition-colors focus:outline-none cursor-pointer"
              >
                <span>{seeAllText}</span>
                <CaretRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : null}

            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Défiler vers la gauche"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
                  canScrollLeft
                    ? "bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer shadow-md"
                    : "bg-zinc-950 text-zinc-700 cursor-not-allowed opacity-50"
                }`}
              >
                <CaretLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="Défiler vers la droite"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
                  canScrollRight
                    ? "bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer shadow-md"
                    : "bg-zinc-950 text-zinc-700 cursor-not-allowed opacity-50"
                }`}
              >
                <CaretRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="relative group/row"
      >
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label="Défiler vers la gauche"
            className="sm:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-11 w-11 rounded-full bg-black/70 backdrop-blur-sm shadow-md cursor-pointer"
          >
            <CaretLeft className="h-5 w-5 text-white" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label="Défiler vers la droite"
            className="sm:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-11 w-11 rounded-full bg-black/70 backdrop-blur-sm shadow-md cursor-pointer"
          >
            <CaretRight className="h-5 w-5 text-white" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-3 overflow-x-auto pt-2 pb-5 px-1 no-scrollbar"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
