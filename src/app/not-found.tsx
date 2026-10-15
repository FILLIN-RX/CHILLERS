"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { House } from "@phosphor-icons/react";
import PosterWallBackground from "@/components/PosterWallBackground";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full bg-[#060608] text-white flex items-center justify-center overflow-hidden p-4 sm:p-6 select-none font-sans">

      {/* ── 1. BACKGROUND: Mur de posters en diagonale (défilement infini) ── */}
      <PosterWallBackground animated />

      {/* ── 3. SIMPLE MINIMALIST 404 CONTENT WITH LOGO (NO SHADOWS) ── */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center px-4">
        
        {/* LOGO */}
        <Link href="/" className="mb-6 flex items-center gap-2.5 group transition-transform hover:scale-105">
          <Image
            src="/android-chrome-512x512.png"
            alt="CHILLERS"
            width={48}
            height={48}
            unoptimized
            className="h-10 sm:h-12 w-auto object-contain"
            priority
          />
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            CHILL<span className="text-brand-primary">ERS</span>
          </span>
        </Link>

        {/* Big 404 Header */}
        <h1 className="text-8xl sm:text-9xl font-black tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] mb-2">
          404
        </h1>

        {/* Subtitle */}
        <p className="text-zinc-200 text-lg sm:text-xl font-semibold mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          Page Introuvable
        </p>

        {/* Action Button (No Shadow) */}
        <div className="w-full max-w-xs">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-[5px] bg-gradient-to-r from-brand-primary to-[#E91E63] hover:from-[#E91E63] hover:to-brand-primary text-white font-bold text-base active:scale-[0.98] transition-all cursor-pointer"
          >
            <House className="w-5 h-5" weight="bold" />
            <span>Retour à l&apos;accueil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
