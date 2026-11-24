"use client";

import React, { useState } from "react";
import { CircleNotch, Play } from "@phosphor-icons/react";
import type { LiveChannel } from "@/types/live";

const FALLBACK_LOGOS: Record<string, string> = {
  CANALACTION: "https://upload.wikimedia.org/wikipedia/commons/5/58/Canal%2B_Action_2024.svg",
  TV8MONTBLANC: "https://www.extraverti.com/images/chaines-tv/8-mont-blanc.webp",
  BLOOMBERGTELEVISION: "https://upload.wikimedia.org/wikipedia/commons/6/66/Bloomberg_Television_logo.svg",
  BLOOMBERGTV: "https://upload.wikimedia.org/wikipedia/commons/6/66/Bloomberg_Television_logo.svg",
  STINGRAYSOCCERANTHEMS: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Stingray_Group_logo.svg/512px-Stingray_Group_logo.svg.png",
  STINGRAYSOCCER: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Stingray_Group_logo.svg/512px-Stingray_Group_logo.svg.png",
};

function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getInitials(name: string) {
  return name
    .replace(/^bein\s+sports/iu, "beIN")
    .replace(/^canal\+\s*/iu, "C+")
    .split(/[\s-]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "TV";
}

export default function LiveChannelCard({
  channel,
  onOpen,
  isResolving = false,
  layout = "regular",
}: {
  channel: LiveChannel;
  onOpen: (channel: LiveChannel) => void;
  isResolving?: boolean;
  layout?: "regular" | "wide" | "tall" | "logo";
}) {
  const [brokenLogo, setBrokenLogo] = useState<string | undefined>();
  const logoSrc = channel.logo?.trim() || FALLBACK_LOGOS[normalizeName(channel.name)];
  const logoAvailable = Boolean(logoSrc) && brokenLogo !== logoSrc;

  return (
    <button
      type="button"
      onClick={() => onOpen(channel)}
      title={`Regarder ${channel.name} en direct`}
      aria-label={`Regarder ${channel.name} en direct`}
      className={`group relative flex h-full min-h-0 w-full min-w-0 flex-col justify-end overflow-hidden rounded-xl bg-[#202023] text-left transition-colors duration-200 hover:bg-[#28282b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-[0.99] ${
        layout === "wide" ? "col-span-2 row-span-2" : layout === "tall" ? "row-span-3" : "row-span-2"
      } ${isResolving ? "ring-2 ring-red-500/80" : ""}`}
    >
      <span className={`absolute inset-0 flex items-center justify-center ${layout === "logo" ? "p-2" : "px-4 pb-2 pt-5"}`}>
        {logoAvailable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc!}
            alt={`${channel.name} logo`}
            onError={() => setBrokenLogo(logoSrc)}
            loading="lazy"
            decoding="async"
            className={`${layout === "logo" ? "max-h-[92%] max-w-[92%]" : layout === "wide" ? "max-h-[68%] max-w-[58%]" : "max-h-[62%] max-w-[62%]"} object-contain ${
              normalizeName(channel.name).startsWith("BLOOMBERG") && !channel.logo ? "brightness-0 invert" : ""
            }`}
          />
        ) : (
          <span
            className={`flex items-center justify-center rounded-md bg-black/15 font-semibold tracking-wide text-white/75 ${layout === "logo" ? "h-20 w-20 text-2xl" : "h-11 w-11 border-0 text-sm"}`}
          >
            {normalizeName(channel.name) === "GOALTV" ? "GOAL" : getInitials(channel.name)}
          </span>
        )}
      </span>

      {layout !== "logo" && (
        <span className="relative flex min-w-0 items-center justify-between gap-2 bg-[#171719] px-2.5 py-2 text-white">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold leading-tight sm:text-xs">{channel.name}</span>
            <span className="mt-0.5 block truncate text-[9px] font-medium leading-tight text-white/70">
              {channel.epgNow?.title || channel.categories?.[0] || "Télévision en direct"}
            </span>
          </span>
          {isResolving ? (
            <CircleNotch aria-label="Connexion en cours" className="h-4 w-4 shrink-0 animate-spin text-white" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-red-600">
              <Play weight="fill" className="h-3 w-3" />
            </span>
          )}
        </span>
      )}
    </button>
  );
}
