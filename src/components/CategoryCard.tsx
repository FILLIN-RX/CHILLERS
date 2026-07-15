"use client";

import React from "react";
import Image from "next/image";
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
  return (
    <div
      onClick={() => onClick(category)}
      className="group relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/60 hover-glow cursor-pointer transition-all duration-300"
    >
      {/* Category Image */}
      <Image
        src={category.imageUrl}
        alt={category.name}
        fill
        className="object-cover brightness-75 group-hover:scale-105 group-hover:brightness-90 transition-all duration-500"
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
      />

      {/* Luxury Cinematic Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent group-hover:from-brand-secondary/40 group-hover:to-brand-primary/10 transition-all duration-500" />

      {/* Category Label */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <h3 className="text-lg sm:text-xl font-extrabold tracking-wider text-white uppercase text-center drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
          {category.name}
        </h3>
      </div>
    </div>
  );
}
