"use client";

import React, { useRef, useCallback, useState } from "react";
import Image from "next/image";
import gsap from "gsap";

interface Category {
  id: string;
  name: string;
  imageUrl: string;
}

interface CategoryCardProps {
  category: Category;
  onClick: (category: Category) => void;
}

export default function CategoryCard({ category, onClick }: CategoryCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const labelRef = useRef<HTMLHeadingElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // GSAP 3D depth & scale hover
  const handleMouseEnter = useCallback(() => {
    if (cardRef.current && document.contains(cardRef.current)) {
      gsap.to(cardRef.current, {
        y: -4,
        scale: 1.03,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (imgRef.current && document.contains(imgRef.current)) {
      gsap.to(imgRef.current, {
        scale: 1.1,
        duration: 0.45,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (labelRef.current && document.contains(labelRef.current)) {
      gsap.to(labelRef.current, {
        scale: 1.05,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current && document.contains(cardRef.current)) {
      gsap.to(cardRef.current, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (imgRef.current && document.contains(imgRef.current)) {
      gsap.to(imgRef.current, {
        scale: 1,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
    if (labelRef.current && document.contains(labelRef.current)) {
      gsap.to(labelRef.current, {
        scale: 1,
        duration: 0.25,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  }, []);

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(category)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-zinc-950 hover:shadow-[0_12px_36px_rgba(215,4,102,0.25)] cursor-pointer transition-colors duration-300"
    >
      {/* Shimmer Placeholder with smooth crossfade */}
      <div
        className={`absolute inset-0 skeleton-loading z-10 pointer-events-none transition-opacity duration-700 ease-out ${
          imgLoaded ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden="true"
      />

      {/* Category Image */}
      <Image
        ref={imgRef}
        src={category.imageUrl}
        alt={category.name}
        fill
        className={`object-cover brightness-75 group-hover:brightness-90 transition-opacity duration-700 ease-out will-change-[opacity] ${
          imgLoaded ? "opacity-100" : "opacity-0"
        }`}
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
      />

      {/* Luxury Glass Cinematic Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent group-hover:from-[#D70466]/20 group-hover:to-[#D70466]/5 transition-all duration-500" />

      {/* Category Label with Glass Pill */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="glass-panel px-4 py-2 rounded-xl backdrop-blur-md shadow-xl">
          <h3
            ref={labelRef}
            className="text-base sm:text-lg font-black tracking-wider text-white uppercase text-center drop-shadow-md"
          >
            {category.name}
          </h3>
        </div>
      </div>
    </div>
  );
}
