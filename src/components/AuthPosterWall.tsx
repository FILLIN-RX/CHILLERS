"use client";

import React from "react";
import Image from "next/image";

// ── 8 Colonnes d'Affiches TMDB 100% Fonctionnelles et Vérifiées ─────────────
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

export function AuthPosterWall() {
  return (
    <>
      {/* ── Animations CSS pour défilement infini alterné ── */}
      <style jsx global>{`
        @keyframes scrollAuthUp {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        @keyframes scrollAuthDown {
          0% {
            transform: translateY(-50%);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-auth-up-slow {
          animation: scrollAuthUp 55s linear infinite;
        }
        .animate-auth-down-slow {
          animation: scrollAuthDown 60s linear infinite;
        }
        .animate-auth-up-fast {
          animation: scrollAuthUp 46s linear infinite;
        }
        .animate-auth-down-fast {
          animation: scrollAuthDown 50s linear infinite;
        }
      `}</style>

      {/* ── 1. Mur d'affiches 8 colonnes immersif ── */}
      <div className="absolute inset-0 z-0 flex gap-2 sm:gap-3 lg:gap-4 overflow-hidden pointer-events-none opacity-90 scale-[1.02] -rotate-1">
        {POSTER_COLUMNS.map((column, colIdx) => {
          const isDown = colIdx % 2 === 1;
          const speedClass =
            colIdx % 2 === 0
              ? isDown ? "animate-auth-down-slow" : "animate-auth-up-slow"
              : isDown ? "animate-auth-down-fast" : "animate-auth-up-fast";

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
                    className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-zinc-900 shrink-0"
                  >
                    <Image
                      src={item.src}
                      alt={item.title}
                      fill
                      unoptimized
                      sizes="12vw"
                      className="object-cover brightness-95"
                      priority={colIdx < 3 && imgIdx < 2}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 2. Superpositions Dégradés & Vignette Cinématique ── */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#060608]/70 via-[#060608]/50 to-[#060608]/85 pointer-events-none" />
      <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_center,rgba(6,6,8,0.35)_0%,rgba(6,6,8,0.8)_70%,#060608_100%)] backdrop-blur-[2px] pointer-events-none" />
    </>
  );
}
