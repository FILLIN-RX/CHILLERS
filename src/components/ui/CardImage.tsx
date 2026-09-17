"use client";

import React, { useState } from "react";
import Image, { ImageProps } from "next/image";
import { FilmSlate } from "@phosphor-icons/react";

export interface CardImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  fallbackText?: string;
  fallbackGradient?: string;
  containerClassName?: string;
  showShimmer?: boolean;
}

/**
 * CardImage - High performance, progressive image loading with smooth shimmer placeholder
 * Prevents abrupt content pop-in and broken image layout shifts.
 */
export default function CardImage({
  src,
  alt,
  className = "",
  containerClassName = "",
  fallbackText,
  fallbackGradient,
  showShimmer = true,
  ...props
}: CardImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isInvalidSrc = !src || hasError;

  return (
    <div className={`relative w-full h-full overflow-hidden bg-zinc-900 ${containerClassName}`}>
      {/* Shimmer skeleton overlay with seamless crossfade */}
      {showShimmer && !hasError && (
        <div
          className={`absolute inset-0 skeleton-loading z-10 pointer-events-none transition-opacity duration-700 ease-out ${
            isLoaded ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />
      )}

      {!isInvalidSrc ? (
        <Image
          src={src}
          alt={alt || "Illustration"}
          className={`transition-opacity duration-700 ease-out will-change-[opacity] ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          {...props}
        />
      ) : (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center ${
            fallbackGradient || "bg-gradient-to-br from-zinc-800 to-zinc-950"
          }`}
        >
          <FilmSlate className="h-7 w-7 text-white/30" />
          {fallbackText && (
            <span className="line-clamp-2 text-xs font-medium text-white/60">
              {fallbackText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
