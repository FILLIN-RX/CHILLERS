"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

const SHADOW = "drop-shadow(0 4px 12px rgba(0,0,0,0.8))";
const treatmentCache = new Map<string, string>();

function analyze(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas.width || !canvas.height) return null;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lums: number[] = [];
    for (let i = 0; i < data.length; i += 40) {
      if (data[i + 3] > 128) lums.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
    if (lums.length < 10) return null;
    lums.sort((a, b) => a - b);
    const p90 = lums[Math.floor(lums.length * 0.9)];
    const p99 = lums[Math.floor(lums.length * 0.99)];
    if (p99 < 70) return `brightness(0) invert(1) ${SHADOW}`;
    if (p90 >= 170) return SHADOW;
    const lift = Math.min(2.6, Math.max(1, 200 / Math.max(30, p90)));
    return `brightness(${lift.toFixed(2)}) saturate(${(1 + (lift - 1) * 0.35).toFixed(2)}) ${SHADOW}`;
  } catch {
    return null;
  }
}

interface MediaLogoProps {
  src: string;
  alt: string;
}

/**
 * Logo hero : certains logos TMDB sont quasi noirs et disparaissent sur le
 * dégradé du hero. Le logo s'affiche tout de suite, puis sa luminance mesurée
 * une fois décodée remonte celle qui manque.
 */
export default function MediaLogo({ src, alt }: MediaLogoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<string>(treatmentCache.get(src) ?? SHADOW);

  useEffect(() => {
    let tries = 0;
    const tick = () => {
      const img = wrapRef.current?.querySelector("img");
      if (!img || !img.complete || img.naturalWidth === 0) return false;
      // Le canvas reste vide tant que l'image n'est pas décodée : on ressaye.
      const next = treatmentCache.get(src) ?? analyze(img);
      if (!next) return false;
      treatmentCache.set(src, next);
      setFilter(next);
      return true;
    };
    if (treatmentCache.has(src)) return;
    const id = setInterval(() => {
      if (tick() || ++tries > 50) clearInterval(id);
    }, 120);
    return () => clearInterval(id);
  }, [src]);

  return (
    <div ref={wrapRef} className="inline-block">
      <NextImage
        src={src}
        alt={alt}
        width={500}
        height={150}
        className="w-auto h-auto max-w-[280px] sm:max-w-[350px] md:max-w-[450px] max-h-[100px] sm:max-h-[120px] md:max-h-[150px] object-contain"
        style={{ filter, transition: "filter 300ms ease" }}
        priority
      />
    </div>
  );
}
