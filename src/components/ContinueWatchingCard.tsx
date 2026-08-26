"use client";

import React, { useRef, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { MovieOrShow } from "@/types/media";
import { IconPlayerPlay } from '@tabler/icons-react';

interface ContinueWatchingCardProps {
  item: MovieOrShow;
  progress: number; // percentage completed
  episodeName?: string; // e.g. "Episode 2"
  remainingTime: string; // e.g. "14m remaining"
  onResume: (item: MovieOrShow) => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

const PLACEHOLDER_POSTER = "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=400";

export default function ContinueWatchingCard({
  item,
  progress,
  episodeName,
  remainingTime,
  onResume,
  onOpenDetails,
}: ContinueWatchingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLDivElement>(null);

  const imgSrc = item.backdropUrl || item.posterUrl || PLACEHOLDER_POSTER;

  const handleMouseEnter = useCallback(() => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: -4,
        scale: 1.03,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (imgRef.current) {
      gsap.to(imgRef.current, {
        scale: 1.08,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (playBtnRef.current) {
      gsap.to(playBtnRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "back.out(1.6)",
        overwrite: "auto",
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (imgRef.current) {
      gsap.to(imgRef.current, {
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (playBtnRef.current) {
      gsap.to(playBtnRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: 0.25,
        ease: "power2.in",
        overwrite: "auto",
      });
    }
  }, []);

  return (
    <div
      ref={cardRef}
      data-testid="continue-watching-card"
      onClick={() => onOpenDetails(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex-none w-[250px] sm:w-[300px] md:w-[360px] lg:w-[420px] cursor-pointer"
    >
      {/* 16:9 landscape box with glass border & rounded corners */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 border border-white/10 group-hover:border-white/25 shadow-lg transition-colors duration-300">
        <div ref={imgRef} className="relative w-full h-full">
          <Image
            src={imgSrc}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 250px, (max-width: 768px) 300px, (max-width: 1024px) 360px, 420px"
          />
        </div>

        {/* Subtle glass dark overlay */}
        <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors duration-300" />

        {/* Bottom title glass gradient */}
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

        {/* Hover play button (centered, GSAP animated) */}
        <div
          ref={playBtnRef}
          style={{ opacity: 0, transform: "scale(0.8)" }}
          onClick={(e) => {
            e.stopPropagation();
            onResume(item);
          }}
          className="absolute inset-0 flex items-center justify-center cursor-pointer pointer-events-none group-hover:pointer-events-auto"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl hover:scale-110 active:scale-95 transition-transform duration-200">
            <IconPlayerPlay className="h-6 w-6 translate-x-0.5" />
          </div>
        </div>

        {/* Title + meta overlay with glassmorphism tag */}
        <div className="absolute inset-x-0 bottom-3 px-3.5 space-y-1">
          <h4 className="text-sm font-bold text-white leading-tight line-clamp-1 drop-shadow-sm">
            {item.title}
          </h4>
          <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-medium">
            {episodeName && <span className="glass-badge px-1.5 py-0.5 rounded text-white font-semibold truncate">{episodeName}</span>}
            <span className="text-zinc-400">{remainingTime}</span>
          </div>
        </div>

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800/80">
          <div
            className="h-full bg-brand-primary shadow-[0_0_8px_rgba(215,4,102,0.8)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
