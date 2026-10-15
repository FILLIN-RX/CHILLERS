"use client";

import React from "react";
import Image from "next/image";

// ── Mur de posters de la page 404, réutilisable ──────────────────────────────
const POSTER_COLUMNS = [
  [
    { title: "Spider-Man : Brand New Day", src: "https://image.tmdb.org/t/p/w500/pEEI5mMoyZrbapzWC6vB6UmesDW.jpg" },
    { title: "Coyote vs. Acme", src: "https://image.tmdb.org/t/p/w500/dFwseuSlDUNiwMuElDb3OAOQ8En.jpg" },
    { title: "L'Odyssée", src: "https://image.tmdb.org/t/p/w500/kP8jJIkmX0vWEYiqQ9c5zU0dvcn.jpg" },
    { title: "Mutiny", src: "https://image.tmdb.org/t/p/w500/rfRLWbxLZPq2eboKPsBvh1NgNwM.jpg" },
    { title: "Colony", src: "https://image.tmdb.org/t/p/w500/1CuYfdSqpIjsWIaCftQKBCjNlG.jpg" },
  ],
  [
    { title: "The Runner", src: "https://image.tmdb.org/t/p/w500/m2FaGlQUKMMFE6nUMwFTcIWbnEi.jpg" },
    { title: "Vaiana", src: "https://image.tmdb.org/t/p/w500/fN4YJFr6d1Zx2fNBlzGLyShO6sc.jpg" },
    { title: "Mayday", src: "https://image.tmdb.org/t/p/w500/eHELFF4BBxmEk5JyhV017Xcgvwy.jpg" },
    { title: "Le Choc des Thunderman", src: "https://image.tmdb.org/t/p/w500/19SvZsTB6UINUZowkBsPSGZUNxD.jpg" },
    { title: "Hantu Dalam Sel", src: "https://image.tmdb.org/t/p/w500/gF6Ijrq5bixh4qemCuroRwXtbBc.jpg" },
  ],
  [
    { title: "Obsession", src: "https://image.tmdb.org/t/p/w500/mDCR1frpUvGfIKksuM440VLb7X9.jpg" },
    { title: "The Last Sunrise", src: "https://image.tmdb.org/t/p/w500/myJdCnJEsFsMmjKhKopQ32lkcP3.jpg" },
    { title: "Toy Story 5", src: "https://image.tmdb.org/t/p/w500/b2bt3UomRX41rHHZmIsSNmXzidU.jpg" },
    { title: "Batman Knightfall", src: "https://image.tmdb.org/t/p/w500/8hsSCYpO5XFSAVnn70YehKslgFt.jpg" },
    { title: "La captura", src: "https://image.tmdb.org/t/p/w500/iwCeOpuBtuTP1kLosqgniey5OvX.jpg" },
  ],
  [
    { title: "The Mongoose", src: "https://image.tmdb.org/t/p/w500/eSS5mvSG84UUuvtbHel5Yu3Wik4.jpg" },
    { title: "Above & Below", src: "https://image.tmdb.org/t/p/w500/7bOuu1SRALGwsG2fLCTvRkCmQBj.jpg" },
    { title: "Rage of Stars", src: "https://image.tmdb.org/t/p/w500/oLld47ZT1I3iecM3OWhIphohQUJ.jpg" },
    { title: "Minions", src: "https://image.tmdb.org/t/p/w500/vuxZITXEqsBHBUhc1TKEU8mxvc.jpg" },
    { title: "Avatar Aang", src: "https://image.tmdb.org/t/p/w500/sJDjdYGDFdx9uftetPPjH7Jwing.jpg" },
  ],
  [
    { title: "Aventures croisées", src: "https://image.tmdb.org/t/p/w500/gz64ZUKg4C4g1yfGD0o5opcBOKy.jpg" },
    { title: "Socias por accidente", src: "https://image.tmdb.org/t/p/w500/j0CIVzeR7hRAPBPGR54qDZoOQpp.jpg" },
    { title: "Demon Slayer", src: "https://image.tmdb.org/t/p/w500/wXTU3AFmlUPbqjH68MZ989uHd6k.jpg" },
    { title: "Les Évadés", src: "https://image.tmdb.org/t/p/w500/t30GjttOdb5At1sYy8b3TOwFgWV.jpg" },
    { title: "Le Parrain", src: "https://image.tmdb.org/t/p/w500/k3uIbYtiuK8pwbCcbma29nTqmgG.jpg" },
  ],
  [
    { title: "Michael", src: "https://image.tmdb.org/t/p/w500/2sDgNilJGVFpl1x4DMzYHjk0L0f.jpg" },
    { title: "Projet Dernière Chance", src: "https://image.tmdb.org/t/p/w500/wzyy8ZrsuHfAt4iz4iH3rT0tdoT.jpg" },
    { title: "Le Parrain 2", src: "https://image.tmdb.org/t/p/w500/fATmEcLwO3tTiisa8gYxhV3x4sS.jpg" },
    { title: "Douze hommes en colère", src: "https://image.tmdb.org/t/p/w500/fFXrCl7nBFFaQU3IgTlinvk6vTi.jpg" },
    { title: "La Liste de Schindler", src: "https://image.tmdb.org/t/p/w500/fLRbv1fGQD0OCPWkFy7PI2sESLj.jpg" },
  ],
  [
    { title: "Young Hearts", src: "https://image.tmdb.org/t/p/w500/cysosXjTtATeY9XfqZ8tLz38XG4.jpg" },
    { title: "Chainsaw Man", src: "https://image.tmdb.org/t/p/w500/cHcG6wXRPjIbeUqydKdG7r0oMmc.jpg" },
    { title: "The Dark Knight", src: "https://image.tmdb.org/t/p/w500/pyNXnq8QBWoK3b37RS6C3axwUOy.jpg" },
    { title: "Le Voyage de Chihiro", src: "https://image.tmdb.org/t/p/w500/12TAqK0AUgdcYE9ZYZ9r7ASbH5Q.jpg" },
    { title: "La Ligne verte", src: "https://image.tmdb.org/t/p/w500/cRBUYC02CPsVa1GqBq6rfHn5a8g.jpg" },
  ],
  [
    { title: "Le Seigneur des Anneaux", src: "https://image.tmdb.org/t/p/w500/ypUCFOvOf07bcHy81jng9LyMUfi.jpg" },
    { title: "Dilwale Dulhania", src: "https://image.tmdb.org/t/p/w500/2CAL2433ZeIihfX1Hb2139CX0pW.jpg" },
    { title: "Parasite", src: "https://image.tmdb.org/t/p/w500/7hLSzZX2jROmEXz2aEoh6JKUFy2.jpg" },
    { title: "Oppenheimer", src: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
    { title: "Breaking Bad", src: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg" },
  ],
];

interface PosterWallBackgroundProps {
  /** Défilement infini des colonnes (page 404). Statique par défaut. */
  animated?: boolean;
  /** `fixed` : verrouillé au viewport (pages longues qui défilent). */
  position?: "absolute" | "fixed";
  /** Voile sombre additionnel pour la lisibilité du contenu par-dessus. */
  dim?: boolean;
}

/**
 * Mur de posters en diagonale (même rendu que la page 404).
 * Par défaut : statique — idéal pour les pages de contenu/paiement.
 * Contenu de la page : envelopper dans un conteneur `relative z-10`.
 */
export default function PosterWallBackground({
  animated = false,
  position = "absolute",
  dim = false,
}: PosterWallBackgroundProps) {
  return (
    <>
      {animated && (
        <style>{`
          @keyframes scroll404Up {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          @keyframes scroll404Down {
            0% { transform: translateY(-50%); }
            100% { transform: translateY(0); }
          }
          .animate-scroll404-up-slow { animation: scroll404Up 52s linear infinite; }
          .animate-scroll404-down-slow { animation: scroll404Down 56s linear infinite; }
          .animate-scroll404-up-fast { animation: scroll404Up 44s linear infinite; }
          .animate-scroll404-down-fast { animation: scroll404Down 48s linear infinite; }
        `}</style>
      )}

      {/* ── Mur de posters, incliné comme la 404 ── */}
      <div
        aria-hidden="true"
        className={`${position} inset-0 z-0 flex gap-2 sm:gap-3 lg:gap-4 overflow-hidden pointer-events-none opacity-100 scale-[1.02] -rotate-1`}
      >
        {POSTER_COLUMNS.map((column, colIdx) => {
          const speedClass = !animated
            ? ""
            : colIdx % 2 === 0
            ? "animate-scroll404-up-slow"
            : "animate-scroll404-down-fast";
          const duplicatedList = [...column, ...column];

          return (
            <div key={colIdx} className="flex-1 flex flex-col gap-2 sm:gap-3 lg:gap-4">
              <div className={`flex flex-col gap-2 sm:gap-3 lg:gap-4 ${speedClass}`}>
                {duplicatedList.map((item, imgIdx) => (
                  <div
                    key={`${colIdx}-${imgIdx}`}
                    className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-zinc-900 shrink-0 group transition-all duration-300"
                  >
                    <Image
                      src={item.src}
                      alt=""
                      fill
                      unoptimized
                      sizes="12vw"
                      className="object-cover brightness-100 group-hover:scale-105 transition-all duration-500"
                      priority={animated && colIdx < 4 && imgIdx < 3}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-30" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Voile de lisibilité (pages de contenu / paiement) ── */}
      {dim && <div className={`${position} inset-0 z-[1] bg-black/35 pointer-events-none`} />}

      {/* ── Overlays identiques à la page 404 ── */}
      <div className={`${position} inset-0 z-[1] bg-gradient-to-b from-black/20 via-black/10 to-black/50 pointer-events-none`} />
      <div className={`${position} inset-0 z-[2] bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.5)_80%,#060608_100%)] pointer-events-none`} />
    </>
  );
}
