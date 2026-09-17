"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import RequestModal from "./RequestModal";

interface RequestButtonProps {
  title?: string;
  type?: "movie" | "series";
  tmdbId?: number;
  posterUrl?: string;
  year?: number;
  season?: number;
  episode?: number;
  className?: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "compact";
}

export default function RequestButton({
  title = "",
  type = "movie",
  tmdbId,
  posterUrl,
  year,
  season,
  episode,
  className = "",
  label = "Demander ce contenu",
  variant = "primary",
}: RequestButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return "bg-white/10 hover:bg-white/15 text-white border border-white/10";
      case "outline":
        return "bg-transparent hover:bg-white/5 text-primary border border-primary/50";
      case "compact":
        return "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs py-1.5 px-3";
      case "primary":
      default:
        return "bg-primary hover:bg-primary/90 text-white shadow-lg";
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 font-medium transition-all duration-200 active:scale-95 rounded-[2px] ${
          variant === "compact" ? "text-xs py-1 px-2.5" : "text-sm py-2.5 px-4"
        } ${getVariantStyles()} ${className}`}
        style={{ borderRadius: "2px" }}
        title="Rechercher et ajouter ce contenu sur CHILLERS"
      >
        <Sparkle size={variant === "compact" ? 14 : 16} weight="fill" className="text-amber-400" />
        <span>{label}</span>
      </button>

      <RequestModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialTitle={title}
        initialType={type}
        tmdbId={tmdbId}
        posterUrl={posterUrl}
        year={year}
        initialSeason={season}
        initialEpisode={episode}
      />
    </>
  );
}
