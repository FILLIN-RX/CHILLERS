"use client";

import React from "react";
import { Play, CircleNotch } from "@phosphor-icons/react";
import type { OhaChannel } from "@/types/oha";

const HOUR_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function fmtHour(iso?: string): string {
  if (!iso) return "";
  try {
    return HOUR_FMT.format(new Date(iso));
  } catch {
    return "";
  }
}

export function channelInitials(name: string): string {
  return (
    name
      .replace(/^bein\s+sports/iu, "beIN")
      .replace(/^canal\+\s*/iu, "C+")
      .split(/[\s-]+/u)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "TV"
  );
}

export function EpgLine({ ch }: { ch: OhaChannel }) {
  if (!ch.epgNow) {
    return (
      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
        Direct · pas de programme
      </p>
    );
  }
  const range =
    ch.epgNow.start && ch.epgNow.end
      ? ` (${fmtHour(ch.epgNow.start)}–${fmtHour(ch.epgNow.end)})`
      : "";
  return (
    <p
      className="text-[10px] text-zinc-300 truncate mt-0.5"
      title={ch.epgNext ? `Ensuite : ${ch.epgNext.title}` : undefined}
    >
      <span className="text-red-400 font-bold">▶</span> {ch.epgNow.title}
      <span className="text-zinc-500">{range}</span>
    </p>
  );
}

/** Carte chaîne TV (initiales + nom + programme) — sans logo. */
export default function TvChannelCard({
  ch,
  isPlaying,
  isResolving,
  onPlay,
}: {
  ch: OhaChannel;
  isPlaying: boolean;
  isResolving: boolean;
  onPlay: (ch: OhaChannel) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(ch)}
      title={ch.name}
      className={`group relative flex flex-col w-full aspect-[4/3] rounded-none bg-[#242424] hover:bg-[#383838] select-none transition-colors duration-200 cursor-pointer overflow-hidden box-border border ${
        isPlaying ? "border-red-500/70" : "border-transparent"
      }`}
    >
      {/* Badge DIRECT */}
      <span className="absolute top-1.5 left-1.5 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-red-600/90 text-[8px] font-black uppercase tracking-wider text-white">
        <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
        Direct
      </span>

      {/* Initiales (pas de logo) */}
      <div className="flex-1 flex items-center justify-center p-3 min-h-0">
        <span className="text-sm font-black text-zinc-200 tracking-wider">
          {channelInitials(ch.name)}
        </span>
      </div>

      {/* Infos bas de carte */}
      <div className="px-2.5 pb-2 pt-1 bg-gradient-to-t from-black/50 to-transparent text-left">
        <h3 className="text-[11px] font-bold text-white truncate">{ch.name}</h3>
        <EpgLine ch={ch} />
      </div>

      {/* Overlay lecture / spinner */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-black/30">
        {isResolving ? (
          <CircleNotch className="w-8 h-8 text-white animate-spin" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/50">
            <Play weight="fill" className="w-4 h-4 ml-0.5" />
          </span>
        )}
      </div>
    </button>
  );
}
