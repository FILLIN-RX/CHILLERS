"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { IconHome, IconMovie, IconDeviceTv, IconSearch, IconSparkles, IconChevronRight } from "@tabler/icons-react";

// Rich cinematic poster mosaic backdrop (Paramount+ style)
const POSTER_WALL = [
  // Column 1
  [
    "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", // Oppenheimer
    "https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg", // Dune 2
    "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg", // Breaking Bad
    "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg", // Stranger Things
  ],
  // Column 2
  [
    "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // The Dark Knight
    "https://image.tmdb.org/t/p/w500/fiVW06jE7z9YnO4trhaMEdclSiC.jpg", // Spider-Man Across the Spider-Verse
    "https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg", // Game of Thrones
    "https://image.tmdb.org/t/p/w500/hE24GYddaxO9MVPeVG1v97G7NLg.jpg", // Demon Slayer
  ],
  // Column 3
  [
    "https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg", // Avatar 2
    "https://image.tmdb.org/t/p/w500/vZloFAK7NKnMGKEHvYcnEtENIO.jpg", // John Wick 4
    "https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg", // Avengers Infinity War
    "https://image.tmdb.org/t/p/w500/8Hb9iqvgq2yocbScy9BP2BqomNc.jpg", // Attack on Titan
  ],
  // Column 4
  [
    "https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg", // Fast X
    "https://image.tmdb.org/t/p/w500/r2J02Z2OpNTctfOSN2Ydgii51I3.jpg", // Guardians 3
    "https://image.tmdb.org/t/p/w500/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg", // Kung Fu Panda 4
    "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", // Fight Club
  ],
  // Column 5
  [
    "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // Godfather
    "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", // Parasite
    "https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cDK6.jpg", // LOTR
    "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", // Shawshank Redemption
  ],
];

export default function NotFound() {
  const contentRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current.children,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
        }
      );
    }

    if (wallRef.current) {
      gsap.fromTo(
        wallRef.current,
        { scale: 1.08, opacity: 0 },
        { scale: 1, opacity: 0.45, duration: 1.4, ease: "power2.out" }
      );
    }
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#070709] text-white flex flex-col justify-between overflow-hidden selection:bg-brand-primary selection:text-white">
      
      {/* ── Background: Paramount+ Style Mosaic Wall with Smooth Scroll & Vignette ── */}
      <div
        ref={wallRef}
        style={{ opacity: 0 }}
        className="absolute inset-0 z-0 flex gap-3 sm:gap-4 overflow-hidden pointer-events-none scale-105"
      >
        {POSTER_WALL.map((column, colIdx) => (
          <div
            key={colIdx}
            className={`flex-1 flex flex-col gap-3 sm:gap-4 ${
              colIdx % 2 === 1 ? "-translate-y-12 sm:-translate-y-20" : "translate-y-4"
            }`}
          >
            {column.map((src, imgIdx) => (
              <div
                key={imgIdx}
                className="relative aspect-[2/3] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900/80 shadow-2xl shrink-0 brightness-75 hover:brightness-100 transition-all duration-500"
              >
                <Image
                  src={src}
                  alt="Affiche"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 25vw, 20vw"
                  priority={colIdx < 3 && imgIdx < 2}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Deep Luxury Vignette Gradients & Ambient Glows ── */}
      <div className="absolute inset-0 z-1 bg-gradient-to-r from-[#070709] via-[#070709]/85 to-transparent pointer-events-none w-full sm:w-4/5" />
      <div className="absolute inset-0 z-1 bg-gradient-to-t from-[#070709] via-transparent to-[#070709]/60 pointer-events-none" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[140px] pointer-events-none z-1" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-brand-secondary/10 rounded-full blur-[160px] pointer-events-none z-1" />

      {/* ── Header Brand Logo ── */}
      <header className="relative z-10 px-6 sm:px-12 lg:px-20 pt-8 sm:pt-12 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-brand-primary via-purple-600 to-amber-500 p-0.5 shadow-[0_0_25px_rgba(215,4,102,0.4)] group-hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full bg-[#09090b] rounded-[14px] flex items-center justify-center">
              <span className="font-black text-lg sm:text-xl text-white">C</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-black tracking-wider text-white flex items-center gap-1">
              CHILLERS
              <span className="text-brand-primary font-extrabold text-2xl drop-shadow-[0_0_12px_rgba(215,4,102,0.6)]">+</span>
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full glass-button text-xs font-bold text-white hover:text-white transition-all shadow-lg"
        >
          <IconHome className="h-4 w-4" />
          <span>Accueil</span>
        </Link>
      </header>

      {/* ── Main Hero Section (Paramount+ Styled Typography) ── */}
      <main className="relative z-10 px-6 sm:px-12 lg:px-20 py-12 sm:py-20 flex-1 flex flex-col justify-center max-w-4xl">
        <div ref={contentRef} className="space-y-6 sm:space-y-8">
          
          {/* 404 Glitch Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 backdrop-blur-md">
            <IconSparkles className="h-3.5 w-3.5 text-brand-primary animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-brand-primary">
              Erreur 404 · Page introuvable
            </span>
          </div>

          {/* Huge Iconic Title (Paramount+ font weight & line-height) */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white uppercase leading-[1.05] drop-shadow-2xl">
              DES HISTOIRES UNIQUES. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                DES ÉTOILES ICONIQUES.
              </span> <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-rose-400 to-amber-400 drop-shadow-[0_0_35px_rgba(215,4,102,0.4)]">
                UNE MONTAGNE DE DIVERTISSEMENT.
              </span>
            </h1>
          </div>

          {/* Subtitle Description */}
          <p className="text-sm sm:text-lg text-zinc-300/90 max-w-2xl leading-relaxed font-medium">
            La page que vous recherchez semble s&apos;être égarée dans notre catalogue. 
            Mais l&apos;aventure ne s&apos;arrête pas là : des milliers de films blockbusters, séries exclusives et animes en streaming gratuit vous attendent.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
            <Link
              href="/"
              className="px-7 py-4 rounded-2xl bg-white text-black font-black text-sm hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 shadow-[0_8px_30px_rgba(255,255,255,0.25)]"
            >
              <IconHome className="h-4 w-4" />
              <span>Retour à l&apos;accueil</span>
            </Link>

            <Link
              href="/media/movies"
              className="px-6 py-4 rounded-2xl glass-button text-white font-extrabold text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <IconMovie className="h-4 w-4 text-brand-primary" />
              <span>Explorer les Films</span>
            </Link>

            <Link
              href="/media/series"
              className="px-6 py-4 rounded-2xl glass-button text-white font-extrabold text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <IconDeviceTv className="h-4 w-4 text-brand-secondary" />
              <span>Explorer les Séries</span>
            </Link>
          </div>

          {/* Quick Categories Bar */}
          <div className="pt-4 flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-zinc-400">
            <span className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">Accès rapide :</span>
            <Link href="/media/movies?genre=28" className="hover:text-white transition-colors underline-offset-4 hover:underline">Action</Link>
            <span>•</span>
            <Link href="/media/movies?genre=35" className="hover:text-white transition-colors underline-offset-4 hover:underline">Comédie</Link>
            <span>•</span>
            <Link href="/media/movies?genre=878" className="hover:text-white transition-colors underline-offset-4 hover:underline">Science-Fiction</Link>
            <span>•</span>
            <Link href="/media/anime" className="hover:text-white transition-colors underline-offset-4 hover:underline">Anime</Link>
            <span>•</span>
            <Link href="/live" className="hover:text-white transition-colors underline-offset-4 hover:underline">TV Direct</Link>
          </div>

        </div>
      </main>

      {/* ── Paramount+ Style Footer ── */}
      <footer className="relative z-10 px-6 sm:px-12 lg:px-20 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Conditions d&apos;utilisation</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Politique de confidentialité</Link>
          <span>·</span>
          <Link href="/support" className="hover:text-zinc-300 transition-colors">Centre d&apos;aide</Link>
        </div>
        <p>© 2026 CHILLERS. Tous droits réservés.</p>
      </footer>

    </div>
  );
}
