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
      className={`relative w-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between pr-1 mb-2">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span className="h-3 w-1 bg-brand-primary rounded-full" />
          {title}
        </h2>
      </div>

      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 pl-3 sm:pl-5 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-4"
        >
          {top10Items.map((item, idx) => {
            const isMovie = item.type === "movie";
            const isSeries = item.type === "series" || (item.type as string) === "tv" || item.type === "anime";
            const href = isMovie ? `/watch/${item.id}?type=movie` : `/tv/${item.id}`;

            return (
              <Link
                href={href}
                key={item.id}
                className="relative flex-none w-[180px] sm:w-[220px] md:w-[260px] flex items-end shrink-0 snap-start group/card hover:scale-[1.02] transition-transform duration-300"
              >
                {/* Number */}
                <div className="absolute left-[-20px] sm:left-[-30px] bottom-[-20px] sm:bottom-[-25px] z-10 select-none">
                  <span className="text-[120px] sm:text-[160px] font-black leading-none -tracking-[0.08em] text-transparent [-webkit-text-stroke:3px_rgba(255,255,255,0.7)] group-hover/card:[-webkit-text-stroke:4px_#fff] drop-shadow-2xl transition-all duration-300">
                    {idx + 1}
                  </span>
                </div>
                
                {/* Poster */}
                <div className="relative z-20 w-[120px] sm:w-[150px] md:w-[170px] aspect-[2/3] ml-[60px] sm:ml-[80px] rounded-xl overflow-hidden shadow-2xl bg-zinc-900 border-0">
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 120px, (max-width: 768px) 150px, 170px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 text-center">
                      <span className="text-zinc-500 font-bold text-xs">{item.title}</span>
                    </div>
                  )}
                  {/* Badge Premium */}
                  {(item as any).isPremium && (
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-brand-primary to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
                      VIP
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-white font-bold text-sm line-clamp-2">{item.title}</p>
                    <p className="text-zinc-300 text-xs mt-1">{item.year}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Scroll Buttons */}
        <div
          className={`absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-brand-dark to-transparent flex items-center justify-start px-2 transition-opacity duration-300 ${
            canScrollLeft && isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          } z-30`}
        >
          <button
            onClick={() => scrollBy(-400)}
            className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-transform active:scale-95"
            aria-label="Défiler à gauche"
          >
            <CaretLeft weight="bold" className="h-6 w-6" />
          </button>
        </div>

        <div
          className={`absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-brand-dark to-transparent flex items-center justify-end px-2 transition-opacity duration-300 ${
            canScrollRight && isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          } z-30`}
        >
          <button
            onClick={() => scrollBy(400)}
            className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur shadow-lg border border-white/10 transition-transform active:scale-95"
            aria-label="Défiler à droite"
          >
            <CaretRight weight="bold" className="h-6 w-6" />
          </button>
        </div>
      </div>
    </section>
  );
}
