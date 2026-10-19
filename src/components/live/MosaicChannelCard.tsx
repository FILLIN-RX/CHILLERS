"use client";

import React, { useState } from "react";
import { Star, CircleNotch } from "@phosphor-icons/react";
import type { LiveChannel } from "@/types/live";

/**
 * Carte mosaïque (aspect 4:3, logo centré, fond #242424 → #383838 au survol).
 * Clic → ouvre le lecteur en modal (plus de page détail).
 */
export default function MosaicChannelCard({
  channel,
  isFavorite,
  onToggleFavorite,
  onOpen,
  isResolving = false,
}: {
  channel: LiveChannel;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent, slug: string) => void;
  onOpen: (channel: LiveChannel) => void;
  isResolving?: boolean;
}) {
  const [logoError, setLogoError] = useState(false);
  // Reset du fallback lorsque le logo change (pattern « ajuster pendant le rendu »).
  const [prevLogo, setPrevLogo] = useState(channel.logo);
  if (prevLogo !== channel.logo) {
    setPrevLogo(channel.logo);
    setLogoError(false);
  }

  const initials =
    channel.name
      .replace(/^bein\s+sports/iu, "beIN")
      .replace(/^canal\+\s*/iu, "C+")
      .split(/[\s-]+/u)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "TV";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(channel)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(channel);
        }
      }}
      title={channel.name}
      className="group relative flex items-center justify-center w-full aspect-[4/3] rounded-none bg-[#242424] hover:bg-[#383838] p-2.5 sm:p-3.5 select-none transition-colors duration-200 cursor-pointer overflow-hidden box-border"
    >
      {/* Bouton favori (haut droite) */}
      <button
        onClick={(e) => onToggleFavorite(e, channel.slug)}
        className={`absolute top-1 right-1 p-1 rounded-none z-10 transition-all ${
          isFavorite
            ? "bg-amber-500 text-black shadow-md opacity-100"
            : "opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-black text-white"
        }`}
        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <Star weight={isFavorite ? "fill" : "regular"} className="h-2.5 w-2.5" />
      </button>

      {/* Logo centré */}
      <div className="w-full h-full flex items-center justify-center pointer-events-none p-1 sm:p-2 pb-5">
        {channel.logo && !logoError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            onError={() => setLogoError(true)}
            className="w-full h-full max-h-full max-w-full object-contain filter brightness-110 contrast-105 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] box-border"
            loading="lazy"
          />
        ) : (
          <span className="text-[11px] sm:text-xs font-black text-zinc-200 tracking-wider">
            {initials}
          </span>
        )}
      </div>

      {/* Bandeau programme en cours */}
      {channel.epgNow && (
        <div
          className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-3 pb-1 px-1.5 pointer-events-none z-10"
          title={`En ce moment : ${channel.epgNow.title}`}
        >
          <p className="text-[9px] sm:text-[10px] font-semibold text-zinc-200 truncate leading-tight flex items-center gap-1">
            <span className="text-red-500 font-bold shrink-0 text-[8px]">▶</span>
            <span className="truncate">{channel.epgNow.title}</span>
          </p>
        </div>
      )}

      {/* Spinner de résolution */}
      {isResolving && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <CircleNotch className="w-7 h-7 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
