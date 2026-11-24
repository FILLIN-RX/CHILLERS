"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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

  const applyTreatment = useCallback((img: HTMLImageElement) => {
    const cached = treatmentCache.get(src);
    if (cached) {
      setFilter(cached);
      return;
    }
    // getImageData() sur une image plein écran force un readback GPU coûteux.
    // Sur mobile on garde l'ombre par défaut, sans mesure de luminance.
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setFilter(SHADOW);
      treatmentCache.set(src, SHADOW);
      return;
    }

    const next = analyze(img);
    if (!next) return;
    treatmentCache.set(src, next);
    setFilter(next);
  }, [src]);

  useEffect(() => {
    const img = wrapRef.current?.querySelector("img");
    if (img?.complete && img.naturalWidth > 0) applyTreatment(img);
  }, [applyTreatment]);

  return (
    <div ref={wrapRef} className="inline-block">
      <NextImage
        src={src}
        alt={alt}
        width={500}
        height={150}
        sizes="(max-width: 640px) 280px, 450px"
        loading="lazy"
        className="w-auto h-auto max-w-[280px] sm:max-w-[350px] md:max-w-[450px] max-h-[100px] sm:max-h-[120px] md:max-h-[150px] object-contain"
        style={{ width: "auto", height: "auto", filter, transition: "filter 300ms ease" }}
        onLoad={(event) => applyTreatment(event.currentTarget)}
      />
    </div>
  );
}
