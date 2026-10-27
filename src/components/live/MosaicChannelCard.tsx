"use client";

import React, { useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import type { LiveChannel } from "@/types/live";

/**
 * Carte mosaïque (aspect 4:3, logo centré, fond #242424 → #383838 au survol).
 * Carte divisée en deux sections : le logo centré en haut, et un petit pied de
 * page en bas avec le nom + le programme en cours (plus rien n'est superposé
 * sur l'image). Clic → ouvre le lecteur en modal (plus de page détail).
 */
export default function MosaicChannelCard({
  channel,
  onOpen,
  isResolving = false,
}: {
  channel: LiveChannel;
  onOpen: (channel: LiveChannel) => void;
  isResolving?: boolean;
}) {
  const [brokenLogoSrc, setBrokenLogoSrc] = useState<string | undefined>();
  const logoBroken = brokenLogoSrc === channel.logo;

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
      className="group relative flex flex-col w-full aspect-[4/3] rounded-none bg-[#242424] hover:bg-[#383838] select-none transition-colors duration-200 cursor-pointer overflow-hidden box-border"
    >
      {/* ── Section image : logo centré ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2.5 sm:p-3.5 pointer-events-none">
        {channel.logo && !logoBroken ? (
          <img
            src={channel.logo}
            alt={channel.name}
            onError={() => setBrokenLogoSrc(channel.logo)}
            className="max-w-[82%] max-h-[82%] w-auto h-auto object-contain filter brightness-110 contrast-105 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] box-border"
            loading="lazy"
          />
        ) : (
          <span className="text-[11px] sm:text-xs font-black text-zinc-200 tracking-wider">
            {initials}
          </span>
        )}
      </div>

      {/* ── Section pied de page : nom + programme (non superposé sur l'image) ── */}
      <div className="flex flex-col gap-0.5 bg-black/60 border-t border-white/10 px-2 py-1.5 pointer-events-none">
        {channel.epgNow && (
          <p
            className="text-[9px] sm:text-[10px] font-semibold text-zinc-300 truncate leading-tight flex items-center gap-1"
            title={`En ce moment : ${channel.epgNow.title}`}
          >
            <span className="text-red-500 font-bold shrink-0 text-[8px]">▶</span>
            <span className="truncate">{channel.epgNow.title}</span>
          </p>
        )}
        <p className="text-xs font-bold text-white truncate leading-tight text-left">
          {channel.name}
        </p>
      </div>

      {/* Spinner de résolution */}
      {isResolving && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <CircleNotch className="w-7 h-7 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
