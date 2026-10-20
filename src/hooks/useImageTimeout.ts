"use client";

import { useEffect } from "react";

interface UseImageTimeoutOptions {
  /** URL source de l'image observée. */
  src?: string | null;
  /** Indique si l'image a fini de charger. */
  isLoaded: boolean;
  /** Déclenché si le délai est dépassé avant le chargement complet. */
  onTimeout: () => void;
  /** Délai en millisecondes avant abandon (défaut : 15000ms). */
  timeoutMs?: number;
}

/**
 * Empêche les skeletons/shimmers infinis lorsqu'une image met trop de temps
 * à charger ou lorsque le CDN distant ne répond plus (timeout réseau).
 */
export function useImageTimeout({
  src,
  isLoaded,
  onTimeout,
  timeoutMs = 15000,
}: UseImageTimeoutOptions) {
  useEffect(() => {
    if (!src || isLoaded) return;

    const timer = setTimeout(() => {
      onTimeout();
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [src, isLoaded, onTimeout, timeoutMs]);
}
