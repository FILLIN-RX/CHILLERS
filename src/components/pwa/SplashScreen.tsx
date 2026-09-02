"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Splash screen cinématique professionnel pour CHILLERS PWA & Mobile
 * S'affiche brièvement au lancement de l'application installée avec un fondu fluide
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Vérifier si l'application est en mode standalone (PWA installée) ou sur mobile
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    // Ne s'affiche qu'une seule fois par session
    const hasShown = sessionStorage.getItem("chillers-splash-shown");

    if (isStandalone && !hasShown) {
      setVisible(true);
      sessionStorage.setItem("chillers-splash-shown", "true");

      const timerFade = setTimeout(() => setFading(true), 1200);
      const timerHide = setTimeout(() => setVisible(false), 1700);

      return () => {
        clearTimeout(timerFade);
        clearTimeout(timerHide);
      };
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] transition-opacity duration-500 pointer-events-none ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex flex-col items-center animate-fade-in">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4">
          <Image
            src="/android-chrome-192x192.png"
            alt="CHILLERS"
            fill
            sizes="112px"
            priority
            className="object-contain drop-shadow-[0_0_25px_rgba(229,9,20,0.4)]"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-white uppercase">
          CHILL<span className="text-[#e50914]">ERS</span>
        </h1>
        <div className="mt-6 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#e50914] animate-ping" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
}
