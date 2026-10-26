"use client";

import React, { useState } from "react";
import { Play, CircleNotch } from "@phosphor-icons/react";
import type { LiveChannel } from "@/types/live";

const UNIQUE_COVER_POOL = [
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1541872703-74c5e44386f9?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=700&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=700&auto=format&fit=crop&q=80",
];

function getChannelInfo(channel: LiveChannel) {
  let hash = 0;
  const str = channel.slug || channel.name || channel._id || "ch";
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % UNIQUE_COVER_POOL.length;
  }
  const banner = channel.banner || UNIQUE_COVER_POOL[Math.abs(hash)];

  const category = channel.categories?.[0]
    ? channel.categories[0].charAt(0).toUpperCase() + channel.categories[0].slice(1)
    : "Général";

  return {
    program: channel.name,
    subtitle: category,
    banner,
  };
}

/** Carte « affiche » 16:9 sans logo — clic → lecteur modal. */
export default function ChannelPosterCard({
  channel,
  onOpen,
  isResolving = false,
}: {
  channel: LiveChannel;
  onOpen: (channel: LiveChannel) => void;
  isResolving?: boolean;
}) {
  const info = getChannelInfo(channel);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(info.banner);
  const [brokenLogoSrc, setBrokenLogoSrc] = useState<string | undefined>();
  const logoBroken = brokenLogoSrc === channel.logo;
  const [bannerBroken, setBannerBroken] = useState(false);

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
      className="group relative flex flex-col rounded-2xl overflow-hidden bg-zinc-900/40 border border-white/10 hover:border-red-500/50 hover:bg-zinc-800/60 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* ── 1. Section image : vignette 16:9 (rien n'est superposé dessus) ── */}
      <div className="relative w-full aspect-video rounded-t-2xl overflow-hidden bg-zinc-950">
        <div
          className={`absolute inset-0 skeleton-loading z-0 transition-opacity duration-500 ${
            imageLoaded ? "opacity-0" : "opacity-100"
          }`}
        />

        <img
          src={imgSrc}
          alt={info.program}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (imgSrc !== UNIQUE_COVER_POOL[0]) {
              setImgSrc(UNIQUE_COVER_POOL[0]);
              setImageLoaded(false);
            } else {
              setBannerBroken(true);
              setImageLoaded(true);
            }
          }}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
        />
        {bannerBroken && <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />}

        {/* Overlay lecture au survol (seul élément autorisé sur l'image) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/50 scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play weight="fill" className="w-5 h-5 ml-0.5" />
          </div>
        </div>

        {/* Spinner de résolution */}
        {isResolving && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <CircleNotch className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* ── 2. Section pied de page : badge DIRECT + nom + programme (non superposé) ── */}
      <div className="flex flex-col gap-0.5 bg-zinc-900 border-t border-white/10 px-2 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Badge Direct (déplacé depuis l'image) */}
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-[9px] font-black uppercase tracking-wider text-white shrink-0 shadow-md">
            <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
            DIRECT
          </span>
          {/* Nom de la chaîne */}
          <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
            {channel.name}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          {/* Logo chaîne (déplacé depuis l'image) */}
          {channel.logo && !logoBroken ? (
            <img
              src={channel.logo}
              alt=""
              onError={() => setBrokenLogoSrc(channel.logo)}
              className="h-3.5 max-w-[24%] object-contain filter brightness-110 shrink-0"
              loading="lazy"
            />
          ) : (
            <span className="text-[9px] font-black text-zinc-400 tracking-wider shrink-0">
              {initials}
            </span>
          )}
          {/* Programme en cours ou catégorie */}
          {channel.epgNow ? (
            <p
              className="text-[10px] text-zinc-300 font-medium truncate flex items-center gap-1 min-w-0"
              title={`En ce moment : ${channel.epgNow.title}${
                channel.epgNext ? ` | Ensuite : ${channel.epgNext.title}` : ""
              }`}
            >
              <span className="text-red-500 font-bold shrink-0 text-[8px]">▶</span>
              <span className="truncate">{channel.epgNow.title}</span>
            </p>
          ) : (
            <p className="text-[10px] text-zinc-400 font-medium truncate">
              {info.subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
