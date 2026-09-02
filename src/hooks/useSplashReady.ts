"use client";

import { useEffect } from "react";
import { useSplashStore } from "@/stores/useSplashStore";

/**
 * Hook à appeler dans n'importe quelle page ou composant pour signaler
 * que l'app est prête et que le splash peut disparaître.
 *
 * Utilisation :
 *   useSplashReady(); // dans le composant racine de la page
 *
 * Sur la homepage, c'est useHomeData qui le fait automatiquement.
 * Sur les autres pages, appelez ce hook dès que le composant est monté.
 */
export function useSplashReady(delayMs = 200) {
  const setReady = useSplashStore((s) => s.setReady);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [setReady, delayMs]);
}
