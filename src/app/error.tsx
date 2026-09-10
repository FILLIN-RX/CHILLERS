"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowsClockwise,
  House,
  Copy,
  Check,
  TerminalWindow,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";

// ── 8 Columns of 100% Verified Working TMDB Posters ─────────────────────────
const POSTER_COLUMNS = [
  // Column 1
  [
    { title: "Spider-Man : Brand New Day", rating: "7.9", src: "https://image.tmdb.org/t/p/w500/pEEI5mMoyZrbapzWC6vB6UmesDW.jpg" },
    { title: "Coyote vs. Acme", rating: "7.7", src: "https://image.tmdb.org/t/p/w500/dFwseuSlDUNiwMuElDb3OAOQ8En.jpg" },
    { title: "L'Odyssée", rating: "8.0", src: "https://image.tmdb.org/t/p/w500/kP8jJIkmX0vWEYiqQ9c5zU0dvcn.jpg" },
    { title: "Mutiny", rating: "6.4", src: "https://image.tmdb.org/t/p/w500/rfRLWbxLZPq2eboKPsBvh1NgNwM.jpg" },
    { title: "Colony", rating: "8.1", src: "https://image.tmdb.org/t/p/w500/1CuYfdSqpIjsWIaCftQKBCjNlG.jpg" },
  ],
  // Column 2
  [
    { title: "The Runner", rating: "6.7", src: "https://image.tmdb.org/t/p/w500/m2FaGlQUKMMFE6nUMwFTcIWbnEi.jpg" },
    { title: "Vaiana", rating: "6.9", src: "https://image.tmdb.org/t/p/w500/fN4YJFr6d1Zx2fNBlzGLyShO6sc.jpg" },
    { title: "Mayday", rating: "7.9", src: "https://image.tmdb.org/t/p/w500/eHELFF4BBxmEk5JyhV017Xcgvwy.jpg" },
    { title: "Le Choc des Thunderman", rating: "6.9", src: "https://image.tmdb.org/t/p/w500/19SvZsTB6UINUZowkBsPSGZUNxD.jpg" },
    { title: "Hantu Dalam Sel", rating: "7.2", src: "https://image.tmdb.org/t/p/w500/gF6Ijrq5bixh4qemCuroRwXtbBc.jpg" },
  ],
  // Column 3
  [
    { title: "Obsession", rating: "8.2", src: "https://image.tmdb.org/t/p/w500/mDCR1frpUvGfIKksuM440VLb7X9.jpg" },
    { title: "The Last Sunrise", rating: "6.6", src: "https://image.tmdb.org/t/p/w500/myJdCnJEsFsMmjKhKopQ32lkcP3.jpg" },
    { title: "Toy Story 5", rating: "8.4", src: "https://image.tmdb.org/t/p/w500/b2bt3UomRX41rHHZmIsSNmXzidU.jpg" },
    { title: "Batman Knightfall", rating: "9.2", src: "https://image.tmdb.org/t/p/w500/8hsSCYpO5XFSAVnn70YehKslgFt.jpg" },
    { title: "La captura", rating: "8.8", src: "https://image.tmdb.org/t/p/w500/iwCeOpuBtuTP1kLosqgniey5OvX.jpg" },
  ],
  // Column 4
  [
    { title: "The Mongoose", rating: "8.0", src: "https://image.tmdb.org/t/p/w500/eSS5mvSG84UUuvtbHel5Yu3Wik4.jpg" },
    { title: "Above & Below", rating: "6.2", src: "https://image.tmdb.org/t/p/w500/7bOuu1SRALGwsG2fLCTvRkCmQBj.jpg" },
    { title: "Rage of Stars", rating: "5.9", src: "https://image.tmdb.org/t/p/w500/oLld47ZT1I3iecM3OWhIphohQUJ.jpg" },
    { title: "Minions", rating: "7.6", src: "https://image.tmdb.org/t/p/w500/vuxZITXEqsBHBUhc1TKEU8mxvc.jpg" },
    { title: "Avatar Aang", rating: "9.2", src: "https://image.tmdb.org/t/p/w500/sJDjdYGDFdx9uftetPPjH7Jwing.jpg" },
  ],
  // Column 5
  [
    { title: "Aventures croisées", rating: "8.9", src: "https://image.tmdb.org/t/p/w500/gz64ZUKg4C4g1yfGD0o5opcBOKy.jpg" },
    { title: "Socias por accidente", rating: "8.9", src: "https://image.tmdb.org/t/p/w500/j0CIVzeR7hRAPBPGR54qDZoOQpp.jpg" },
    { title: "Demon Slayer", rating: "8.8", src: "https://image.tmdb.org/t/p/w500/wXTU3AFmlUPbqjH68MZ989uHd6k.jpg" },
    { title: "Les Évadés", rating: "8.7", src: "https://image.tmdb.org/t/p/w500/t30GjttOdb5At1sYy8b3TOwFgWV.jpg" },
    { title: "Le Parrain", rating: "8.7", src: "https://image.tmdb.org/t/p/w500/k3uIbYtiuK8pwbCcbma29nTqmgG.jpg" },
  ],
  // Column 6
  [
    { title: "Michael", rating: "8.6", src: "https://image.tmdb.org/t/p/w500/2sDgNilJGVFpl1x4DMzYHjk0L0f.jpg" },
    { title: "Projet Dernière Chance", rating: "8.6", src: "https://image.tmdb.org/t/p/w500/wzyy8ZrsuHfAt4iz4iH3rT0tdoT.jpg" },
    { title: "Le Parrain 2", rating: "8.6", src: "https://image.tmdb.org/t/p/w500/fATmEcLwO3tTiisa8gYxhV3x4sS.jpg" },
    { title: "Douze hommes en colère", rating: "8.6", src: "https://image.tmdb.org/t/p/w500/fFXrCl7nBFFaQU3IgTlinvk6vTi.jpg" },
    { title: "La Liste de Schindler", rating: "8.6", src: "https://image.tmdb.org/t/p/w500/fLRbv1fGQD0OCPWkFy7PI2sESLj.jpg" },
  ],
  // Column 7
  [
    { title: "Young Hearts", rating: "8.6", src: "https://image.tmdb.org/t/p/w500/cysosXjTtATeY9XfqZ8tLz38XG4.jpg" },
    { title: "Chainsaw Man", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/cHcG6wXRPjIbeUqydKdG7r0oMmc.jpg" },
    { title: "The Dark Knight", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/pyNXnq8QBWoK3b37RS6C3axwUOy.jpg" },
    { title: "Le Voyage de Chihiro", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/12TAqK0AUgdcYE9ZYZ9r7ASbH5Q.jpg" },
    { title: "La Ligne verte", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/cRBUYC02CPsVa1GqBq6rfHn5a8g.jpg" },
  ],
  // Column 8
  [
    { title: "Le Seigneur des Anneaux", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/ypUCFOvOf07bcHy81jng9LyMUfi.jpg" },
    { title: "Dilwale Dulhania", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/2CAL2433ZeIihfX1Hb2139CX0pW.jpg" },
    { title: "Parasite", rating: "8.5", src: "https://image.tmdb.org/t/p/w500/7hLSzZX2jROmEXz2aEoh6JKUFy2.jpg" },
    { title: "Oppenheimer", rating: "8.9", src: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
    { title: "Breaking Bad", rating: "9.5", src: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
  ],
];

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error("[CHILLERS Error Boundary]:", error);
  }, [error]);

  const handleCopy = () => {
    const info = `Error: ${error.message || "Unknown error"}\nDigest: ${error.digest || "N/A"}\nURL: ${typeof window !== "undefined" ? window.location.href : ""}`;
    navigator.clipboard.writeText(info);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      reset();
      setIsRetrying(false);
    }, 400);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#060608] text-white flex items-center justify-center overflow-hidden p-4 sm:p-6 select-none font-sans">
      
      {/* ── CSS Animations for Infinite Alternating Scrolling ── */}
      <style jsx global>{`
        @keyframes scrollPinterestUp {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        @keyframes scrollPinterestDown {
          0% {
            transform: translateY(-50%);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-scroll-up-slow {
          animation: scrollPinterestUp 52s linear infinite;
        }
        .animate-scroll-down-slow {
          animation: scrollPinterestDown 56s linear infinite;
        }
        .animate-scroll-up-fast {
          animation: scrollPinterestUp 44s linear infinite;
        }
        .animate-scroll-down-fast {
          animation: scrollPinterestDown 48s linear infinite;
        }
      `}</style>

      {/* ── 1. BACKGROUND: 8 Columns Poster Wall (Ultra Clear, 100% Working) ── */}
      <div className="absolute inset-0 z-0 flex gap-2 sm:gap-3 lg:gap-4 overflow-hidden pointer-events-none opacity-100 scale-[1.02] -rotate-1">
        {POSTER_COLUMNS.map((column, colIdx) => {
          const isDown = colIdx % 2 === 1;
          const speedClass =
            colIdx % 2 === 0
              ? isDown ? "animate-scroll-down-slow" : "animate-scroll-up-slow"
              : isDown ? "animate-scroll-down-fast" : "animate-scroll-up-fast";

          const duplicatedList = [...column, ...column];

          return (
            <div
              key={colIdx}
              className="flex-1 flex flex-col gap-2 sm:gap-3 lg:gap-4"
            >
              <div className={`flex flex-col gap-2 sm:gap-3 lg:gap-4 ${speedClass}`}>
                {duplicatedList.map((item, imgIdx) => (
                  <div
                    key={`${colIdx}-${imgIdx}`}
                    className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-zinc-900 shrink-0 group transition-all duration-300"
                  >
                    <Image
                      src={item.src}
                      alt={item.title}
                      fill
                      unoptimized
                      sizes="12vw"
                      className="object-cover brightness-100 group-hover:scale-105 transition-all duration-500"
                      priority={colIdx < 4 && imgIdx < 3}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 2. ULTRA REDUCED OVERLAY ── */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/20 via-black/10 to-black/50 pointer-events-none" />
      <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.5)_80%,#060608_100%)] pointer-events-none" />

      {/* ── 3. SIMPLE MINIMALIST ERROR CONTENT WITH LOGO (NO SHADOWS) ── */}
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
            CHILL<span className="text-[#D70466]">ERS</span>
          </span>
        </Link>

        {/* Message */}
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] mb-4">
          Oups ! Une erreur est survenue
        </h1>

        <p className="text-zinc-200 text-base sm:text-lg max-w-md mx-auto mb-8 font-medium drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          Le service a rencontré un problème temporaire.
        </p>

        {/* Action CTAs (No Shadows) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
          {/* Primary Retry Button */}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#D70466] to-[#E91E63] hover:from-[#E91E63] hover:to-[#D70466] text-white font-bold text-sm sm:text-base active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75"
          >
            <ArrowsClockwise
              className={`w-5 h-5 ${isRetrying ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}
              weight="bold"
            />
            <span>{isRetrying ? "Relance en cours..." : "Réessayer"}</span>
          </button>

          {/* Home Button */}
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-sm sm:text-base transition-all backdrop-blur-md active:scale-[0.98] cursor-pointer"
          >
            <House className="w-5 h-5 text-zinc-200" weight="bold" />
            <span>Accueil</span>
          </Link>
        </div>

        {/* Technical Details Toggle */}
        <div className="mt-8 w-full">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer drop-shadow"
          >
            <TerminalWindow className="w-4 h-4" />
            <span>{showDetails ? "Masquer les détails" : "Détails pour développeurs"}</span>
            {showDetails ? <CaretUp className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
          </button>

          {showDetails && (
            <div className="mt-3 p-4 bg-black/90 border border-white/20 rounded-xl text-left font-mono text-[11px] text-zinc-300 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
              <button
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
                title="Copier le rapport"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-sans">Copié</span>
                  </>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <p className="text-red-400 font-semibold mb-1 truncate pr-16">
                {error.name || "Error"}: {error.message || "An unexpected error occurred"}
              </p>
              {error.digest && (
                <p className="text-zinc-400 text-[10px]">
                  Digest ID: <span className="text-zinc-200">{error.digest}</span>
                </p>
              )}
              {error.stack && (
                <pre className="mt-2 text-[10px] text-zinc-400 max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight">
                  {error.stack.split("\n").slice(0, 4).join("\n")}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
