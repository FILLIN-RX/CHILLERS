"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import Image from "next/image";
import type { MovieOrShow } from "@/types/media";

interface Top10RowProps {
  title: string;
  items: MovieOrShow[];
  className?: string;
}

export default function Top10Row({ title, items, className = "" }: Top10RowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const top10Items = items.slice(0, 10);

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

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (top10Items.length === 0) return null;

  return (
    <section
      className={`relative w-full ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between pr-1 mb-1">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span className="h-3 w-1 bg-brand-primary rounded-full" />
          {title}
        </h2>

        {/* Desktop nav arrows */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scrollBy(-400)}
            disabled={!canScrollLeft}
            aria-label="Défiler vers la gauche"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
              canScrollLeft
                ? "bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer shadow-md"
                : "bg-zinc-950 text-zinc-700 cursor-not-allowed opacity-50"
            }`}
          >
            <CaretLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy(400)}
            disabled={!canScrollRight}
            aria-label="Défiler vers la droite"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
              canScrollRight
                ? "bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer shadow-md"
                : "bg-zinc-950 text-zinc-700 cursor-not-allowed opacity-50"
            }`}
          >
            <CaretRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative group">
        {/* Scroll Container with stable height and aligned padding */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 px-1 overflow-x-auto no-scrollbar snap-x snap-mandatory pt-3 pb-6"
        >
          {top10Items.map((item, idx) => {
            const isMovie = item.type === "movie";
            const href = isMovie ? `/watch/${item.id}?type=movie` : `/tv/${item.id}`;

            return (
              <Link
                href={href}
                key={item.id}
                className="relative flex-none flex items-end shrink-0 snap-start group/card hover:scale-[1.03] transition-transform duration-300 origin-bottom cursor-pointer"
              >
                {/* Number aligned to baseline with crisp outline and semi-transparent fill */}
                <div className="relative z-10 select-none flex items-end leading-none">
                  <span className="text-[100px] sm:text-[130px] md:text-[150px] font-black leading-[0.75] -tracking-[0.08em] text-white/35 [-webkit-text-stroke:3px_rgba(255,255,255,0.95)] group-hover/card:text-white/60 group-hover/card:[-webkit-text-stroke:4px_#fff] drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)] transition-all duration-300 pointer-events-none">
                    {idx + 1}
                  </span>
                </div>

                {/* Poster overlapping slightly the number */}
                <div className="relative z-20 w-[115px] sm:w-[135px] md:w-[155px] aspect-[2/3] -ml-5 sm:-ml-7 md:-ml-8 rounded-xl overflow-hidden shadow-2xl bg-zinc-900 border border-white/5">
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 115px, (max-width: 768px) 135px, 155px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 text-center">
                      <span className="text-zinc-500 font-bold text-xs">{item.title}</span>
                    </div>
                  )}

                  {/* Badge Premium */}
                  {(item as any).isPremium && (
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-brand-primary to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
                      VIP
                    </div>
                  )}

                  {/* Hover info overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    <p className="text-white font-bold text-xs sm:text-sm line-clamp-2 leading-tight">{item.title}</p>
                    {item.year ? <p className="text-zinc-400 text-[10px] sm:text-xs mt-0.5">{item.year}</p> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Mobile / Hover Floating Scroll Buttons */}
        <div
          className={`absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-brand-dark to-transparent flex items-center justify-start transition-opacity duration-300 ${
            canScrollLeft && isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          } z-30`}
        >
          <button
            onClick={() => scrollBy(-350)}
            className="w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-transform active:scale-95 cursor-pointer ml-1"
            aria-label="Défiler à gauche"
          >
            <CaretLeft weight="bold" className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-brand-dark to-transparent flex items-center justify-end transition-opacity duration-300 ${
            canScrollRight && isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          } z-30`}
        >
          <button
            onClick={() => scrollBy(350)}
            className="w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-transform active:scale-95 cursor-pointer mr-1"
            aria-label="Défiler à droite"
          >
            <CaretRight weight="bold" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
