"use client";

import { useEffect, useState } from "react";

export interface BackdropAmbiance {
  /** Moyenne des pixels marquants (ni noir, ni gris) — `r g b` pour les vars CSS. */
  dominant: string;
  /** Teinte la plus saturée, pour les rehauts discrets. */
  vivid: string;
}

const cache = new Map<string, BackdropAmbiance | null>();

/**
 * Ambiance colorimétrique d'un backdrop : la vignette passe par notre
 * optimiseur d'images (same-origin → canvas lisible ; image.tmdb.org ne
 * servant pas de header CORS), est réduite à quelques pixels puis analysée.
 * Résultat mis en cache par URL — une navigation ne recompte rien.
 */
export function useBackdropAmbiance(url?: string): BackdropAmbiance | null {
  const [state, setState] = useState<{ url: string; value: BackdropAmbiance | null } | null>(() =>
    url && cache.has(url) ? { url, value: cache.get(url) ?? null } : null
  );

  useEffect(() => {
    if (!url || state?.url === url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const result = analyze(img);
      cache.set(url, result);
      setState({ url, value: result });
    };
    img.onerror = () => {
      if (cancelled) return;
      cache.set(url, null);
      setState({ url, value: null });
    };
    img.src = `/_next/image?url=${encodeURIComponent(url)}&w=64&q=75`;
    return () => {
      cancelled = true;
    };
  }, [url, state]);

  if (state && state.url === url) return state.value;
  // Cache rempli entre-temps par un autre composant : lu pendant le rendu.
  return url ? (cache.get(url) ?? null) : null;
}

function analyze(img: HTMLImageElement): BackdropAmbiance | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas.width || !canvas.height) return null;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let wSum = 0;
    let bestSat = -1;
    let satR = 0;
    let satG = 0;
    let satB = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 510; // 0..1
      const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1) || 1);

      // Dominante : ni noir profond, ni blanc cassé — les teintes colorées
      // pèsent davantage pour éviter un gris moyen terne.
      if (l > 0.08 && l < 0.92) {
        const w = 0.35 + sat;
        rSum += r * w;
        gSum += g * w;
        bSum += b * w;
        wSum += w;
      }

      // Teinte vive : la plus saturée, hors extrêmes de luminosité.
      if (sat > bestSat && l > 0.12 && l < 0.88) {
        bestSat = sat;
        satR = r;
        satG = g;
        satB = b;
      }
    }

    if (wSum === 0 || bestSat < 0) return null;
    const dominant = `${Math.round(rSum / wSum)} ${Math.round(gSum / wSum)} ${Math.round(bSum / wSum)}`;
    return { dominant, vivid: `${satR} ${satG} ${satB}` };
  } catch {
    return null;
  }
}
