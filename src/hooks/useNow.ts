"use client";

import { useEffect, useState } from "react";

/**
 * L'heure courante, remise à jour à intervalle régulier. Lire `Date.now()` dans le
 * rendu est impur : l'écran d'attente d'un match se figerait à l'heure du montage
 * et ne basculerait pas au coup d'envoi.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
