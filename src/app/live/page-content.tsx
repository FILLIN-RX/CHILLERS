"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Television, MagnifyingGlass, Star, Play, CaretCircleRight, X, Check, ArrowLeft } from "@phosphor-icons/react";
import { getLiveChannels, FALLBACK_CHANNELS } from "@/services/live";
import type { LiveChannel } from "@/types/live";
import LivePlayer from "@/components/LivePlayer";
import LiveMatchesRow from "@/components/LiveMatchesRow";

export function ChannelLogo({ channel }: { channel: LiveChannel }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [channel.logo]);

  const initials = channel.name
    .replace(/^bein\s+sports/i, "beIN")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (!channel.logo || broken) {
    return (
      <div className="h-5 px-1.5 rounded bg-black/70 backdrop-blur-sm border border-white/15 flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm">
        {initials || "TV"}
      </div>
    );
  }

  return (
    <div className="h-5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/15 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
      <img
        src={channel.logo}
        alt={channel.name}
        className="h-full w-auto object-contain max-h-3.5"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

const CATEGORIES = [
  { id: "favorites", label: "FAVORIS" },
  { id: "all", label: "TOUTES LES CHAÎNES" },
  { id: "sports", label: "SPORT" },
  { id: "cinema", label: "CINÉMA" },
  { id: "kids", label: "JEUNESSE" },
  { id: "news", label: "INFOS" },
  { id: "series", label: "SÉRIES" },
  { id: "documentary", label: "DÉCOUVERTE" },
  { id: "entertainment", label: "DIVERTISSEMENT" },
  { id: "music", label: "MUSIQUE" },
];

const LIVE_CHANNEL_INFO: Record<string, { program: string; subtitle: string; banner: string }> = {
  "equinoxe-tv": {
    program: "Equinoxe TV",
    subtitle: "Divers",
    banner: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=600&auto=format&fit=crop&q=80",
  },
  "crtv-sport": {
    program: "Magazine sportif",
    subtitle: "Mag. Sport · Direct",
    banner: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80",
  },
  "canal-2-international": {
    program: "Canal 2 International",
    subtitle: "Grandes Éditions & Mag",
    banner: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80",
  },
  "bein-sports-xtra": {
    program: "Elversberg / Bayern Munich",
    subtitle: "Bundesliga - 3e journée",
    banner: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop&q=80",
  },
  "bein-sports-xtra-hd": {
    program: "beIN Sports XTRA Action",
    subtitle: "Sports US & Direct",
    banner: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop&q=80",
  },
  "red-bull-tv": {
    program: "Red Bull Action Sports Live",
    subtitle: "Extreme Sports & Drift",
    banner: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80",
  },
  "fight-sports-hd": {
    program: "Fight Night Championship",
    subtitle: "MMA & Boxe Pro",
    banner: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
  },
  "fight-network": {
    program: "Fight Network Championship",
    subtitle: "Combat Sports · Direct",
    banner: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&auto=format&fit=crop&q=80",
  },
  "world-poker-tour": {
    program: "World Poker Tour",
    subtitle: "Table Finale Las Vegas",
    banner: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&auto=format&fit=crop&q=80",
  },
  "fox-sports-us": {
    program: "FOX NFL Sunday",
    subtitle: "Football Américain · Direct",
    banner: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=80",
  },
  "fox-sports-2-us": {
    program: "NASCAR Cup Series",
    subtitle: "Course Automobile · Direct",
    banner: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80",
  },
  "espn8-the-ocho": {
    program: "ESPN8 The Ocho",
    subtitle: "Compétitions Insolites",
    banner: "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=600&auto=format&fit=crop&q=80",
  },
  "fubo-sports-network": {
    program: "fubo Sports Network",
    subtitle: "Talk Show Sportif",
    banner: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&auto=format&fit=crop&q=80",
  },
  "goal-tv": {
    program: "Goal TV",
    subtitle: "Tous les buts en direct",
    banner: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&auto=format&fit=crop&q=80",
  },
  "flohockey-24-7": {
    program: "FloHockey 24/7",
    subtitle: "Hockey sur Glace · Direct",
    banner: "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600&auto=format&fit=crop&q=80",
  },
  "floracing-24-7": {
    program: "FloRacing 24/7",
    subtitle: "Motorsport & Sprint Cars",
    banner: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80",
  },
  "stingray-soccer-anthems": {
    program: "Stingray Soccer Anthems",
    subtitle: "Musique & Ambiance Stade",
    banner: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
  },
  "france-24-francais": {
    program: "Le Journal International",
    subtitle: "Information en Continu",
    banner: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80",
  },
  "tv5monde-europe": {
    program: "Mashatu, terre de léopards",
    subtitle: "Doc. Animalier",
    banner: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
  },
  "euronews-francais": {
    program: "Euronews Direct",
    subtitle: "Actualités Européennes",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
  },
  "lcp-assemblee-nationale": {
    program: "LCP Assemblée Nationale",
    subtitle: "Débats Parlementaires",
    banner: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80",
  },
  "public-senat": {
    program: "Public Sénat",
    subtitle: "Politique & Société",
    banner: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&auto=format&fit=crop&q=80",
  },
  "sky-news": {
    program: "Sky News Live Broadcast",
    subtitle: "Global Breaking News",
    banner: "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80",
  },
  "bloomberg-originals": {
    program: "Bloomberg TV Originals",
    subtitle: "Économie & Marchés",
    banner: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80",
  },
  "dw-english": {
    program: "DW English HD",
    subtitle: "World News & Insight",
    banner: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&auto=format&fit=crop&q=80",
  },
  "arte-francais": {
    program: "Frontières",
    subtitle: "Film Drame",
    banner: "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=600&auto=format&fit=crop&q=80",
  },
  "rakuten-action-fr": {
    program: "Racers",
    subtitle: "Film Action",
    banner: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80",
  },
  "pluto-tv-action": {
    program: "Mission Commando",
    subtitle: "Film Action",
    banner: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80",
  },
  "pluto-tv-cinema": {
    program: "Kasam",
    subtitle: "Série Drame",
    banner: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop&q=80",
  },
  "pluto-tv-series": {
    program: "New York police judiciaire - Saison 15",
    subtitle: "Épisode 18 : La vengeance est un...",
    banner: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80",
  },
  "rakuten-comedie-fr": {
    program: "Jeux de dames - Saison 2",
    subtitle: "Épisode 10 : JEUX DE DAMES S2",
    banner: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
  },
  "gulli-direct": {
    program: "Tu dis, tu stoppes ! - Saison 1",
    subtitle: "Épisode 1 · Dessin animé",
    banner: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
  },
  "m6-replay": {
    program: "Pour tout voir et tout savoir",
    subtitle: "Divers",
    banner: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
  },
  "w9-direct": {
    program: "La Dona - Saison 1",
    subtitle: "Épisode 92 : Braulio se desquicia",
    banner: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop&q=80",
  },
  "nrj12-direct": {
    program: "Sous le masque - Saison 1",
    subtitle: "Épisode 24",
    banner: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80",
  },
  "bfm-tv": {
    program: "1x Infosport+",
    subtitle: "Émission du jour",
    banner: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80",
  },
  "cnews": {
    program: "Punchline",
    subtitle: "Débats & Société",
    banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
  },
  "lci": {
    program: "LCI Soirée Direct",
    subtitle: "Mag. Infos",
    banner: "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80",
  },
};

const UNIQUE_COVER_POOL = [
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=600&auto=format&fit=crop&q=80",
];

function getChannelInfo(channel: LiveChannel) {
  const specific = LIVE_CHANNEL_INFO[channel.slug];
  if (specific) return specific;

  // Compute a deterministic unique cover index so EVERY channel has a distinct photo
  let hash = 0;
  const str = channel.slug || channel.name || channel._id || "ch";
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % UNIQUE_COVER_POOL.length;
  }
  const banner = channel.banner || UNIQUE_COVER_POOL[Math.abs(hash)];

  const category = channel.categories?.[0]
    ? channel.categories[0].charAt(0).toUpperCase() + channel.categories[0].slice(1)
    : "Divers";

  return {
    program: channel.name,
    subtitle: category,
    banner,
  };
}

function LiveChannelCard({
  channel,
  isFavorite,
  onToggleFavorite,
}: {
  channel: LiveChannel;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent, slug: string) => void;
}) {
  const info = getChannelInfo(channel);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(info.banner);

  return (
    <Link
      href={`/live/${channel.slug}`}
      className="group flex flex-col justify-start rounded-lg overflow-hidden bg-transparent transition-all duration-200 cursor-pointer w-full md:w-[260.688px] shrink-0"
    >
      {/* 1. Top 16:9 Thumbnail Image */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-white/25 transition-all shadow-md">
        {/* Shimmer Placeholder */}
        <div
          className={`absolute inset-0 skeleton-loading z-0 pointer-events-none transition-opacity duration-500 ease-out ${
            imageLoaded ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />

        <img
          src={imgSrc}
          alt={info.program}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImgSrc(UNIQUE_COVER_POOL[0]);
          }}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
        />

        {/* Subtle bottom shadow to make channel logo pop */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Channel Logo at Bottom-Left of thumbnail */}
        <div className="absolute bottom-1.5 left-1.5 z-10">
          <ChannelLogo channel={channel} />
        </div>

        {/* Favorite Button on Top-Right */}
        <button
          onClick={(e) => onToggleFavorite(e, channel.slug)}
          className={`absolute top-1.5 right-1.5 p-1 rounded-full backdrop-blur-md transition-all cursor-pointer z-10 ${
            isFavorite
              ? "bg-amber-500/30 text-amber-400 border border-amber-500/50"
              : "bg-black/60 text-zinc-400 hover:text-white hover:bg-black/90 opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Favori"
        >
          <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-amber-400" : ""}`} />
        </button>

        {/* Red Live Progress Bar on Bottom Edge */}
        <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-zinc-800 z-10">
          <div className="h-full bg-red-600 w-2/3 rounded-r-full shadow-[0_0_6px_rgba(220,38,38,0.8)]" />
        </div>
      </div>

      {/* 2. Bottom Row (Below Thumbnail): Title + Subtitle on Left, Play/Skip icon on Right */}
      <div className="pt-2 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:text-red-500 transition-colors">
            {info.program}
          </h3>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-normal leading-tight">
            {info.subtitle}
          </p>
        </div>

        {/* Right Play / Skip Action Button matching Canal+ */}
        <div className="w-6 h-6 rounded bg-zinc-800/80 group-hover:bg-zinc-700 text-zinc-400 group-hover:text-white flex items-center justify-center shrink-0 transition-all mt-0.5 border border-white/5">
          <svg className="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function formatMatchTime(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function TeamCrest({ src, alt, size = "md" }: { src?: string; alt: string; size?: "sm" | "md" }) {
  const [broken, setBroken] = useState(false);
  const dims = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  if (!src || broken) {
    return (
      <div className={`${dims} rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[9px] font-black text-zinc-400 shrink-0`}>
        {(alt || "?").slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`${dims} object-contain shrink-0 rounded-full bg-white/5`}
    />
  );
}

export default function LivePageContent() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isMultiLiveOpen, setIsMultiLiveOpen] = useState(false);
  const [selectedMultiSlugs, setSelectedMultiSlugs] = useState<string[]>([]);

  const { data: channels = FALLBACK_CHANNELS, isLoading } = useQuery({
    queryKey: ["live", "channels"],
    queryFn: () => getLiveChannels(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (channels.length > 0 && selectedMultiSlugs.length === 0) {
      setSelectedMultiSlugs([
        channels[0]?.slug || "",
        channels[1]?.slug || "",
        channels[2]?.slug || "",
        channels[3]?.slug || "",
      ]);
    }
  }, [channels, selectedMultiSlugs.length]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("chillers_live_favorites");
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleFavorite = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem("chillers_live_favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filteredChannels = useMemo(() => {
    let list = channels;

    if (activeCategory === "favorites") {
      list = list.filter((c) => favorites.includes(c.slug));
    } else if (activeCategory !== "all") {
      list = list.filter((c) =>
        c.categories?.some((cat) => {
          if (activeCategory === "sports") return cat === "sports";
          if (activeCategory === "news") return cat === "news" || cat === "politics" || cat === "business";
          if (activeCategory === "cinema") return cat === "movies" || cat === "cinema";
          if (activeCategory === "series") return cat === "series";
          if (activeCategory === "entertainment") return cat === "entertainment" || cat === "general";
          if (activeCategory === "kids") return cat === "kids" || cat === "animation";
          if (activeCategory === "music") return cat === "music";
          if (activeCategory === "documentary") return cat === "documentary";
          return cat === activeCategory;
        })
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.categories?.some((cat) => cat.toLowerCase().includes(q))
      );
    }

    return list;
  }, [channels, activeCategory, search, favorites]);

  return (
    <div className="min-h-screen bg-[#0E0E11] text-white pt-20 sm:pt-24 pb-24 px-3 sm:px-6 md:px-10 lg:px-[4%] select-none">
      {/* ── Title Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-wider text-white uppercase flex items-center gap-2">
            EN DIRECT
          </h1>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 md:w-72">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une chaîne..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-600 transition-colors"
          />
        </div>
      </div>

      {/* ── Top Category Tabs Navigation Bar ─────────────────────── */}
      <div className="relative border-b border-white/10 pb-1 mb-6">
        {/* Fade edges hint the horizontal scroll on mobile */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-12 bg-gradient-to-r from-[#0E0E11] to-transparent z-10 hidden sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-12 bg-gradient-to-l from-[#0E0E11] to-transparent z-10" />
        <div className="flex items-center gap-3 sm:gap-8 overflow-x-auto no-scrollbar scroll-smooth -mx-1 px-1 py-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`relative shrink-0 px-2.5 sm:px-1 py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? "text-white font-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {cat.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-[#D70466] rounded-full transition-all" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Matchs Foot par Championnat ───────────────────────── */}
      <LiveMatchesRow className="mb-8" noScrollMargin />

      {/* ── Live Channel Cards Grid (260.688px on PC, fluid responsive on mobile) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,260.688px)] gap-2.5 sm:gap-4 md:gap-5 justify-start">
        {/* 1. Special Multi-Live Card (always visible on 'all') */}
        {activeCategory === "all" && !search && (
          <div
            onClick={() => setIsMultiLiveOpen(true)}
            className="group flex flex-col justify-start rounded-lg overflow-hidden bg-transparent transition-all duration-200 cursor-pointer w-full md:w-[260.688px] shrink-0"
          >
            {/* Top 16:9 Thumbnail Mock */}
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-950 border border-white/10 group-hover:border-red-600/50 transition-all shadow-md flex items-center justify-center p-4">
              <div className="grid grid-cols-2 gap-1.5 w-20 h-12">
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
                <div className="bg-zinc-700/80 rounded group-hover:bg-red-600/70 transition-colors" />
              </div>

              {/* Multi-Live Badge Bottom-Left */}
              <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-black text-white uppercase tracking-wider">
                Multi-View
              </div>

              {/* Red Progress Bar on Bottom Edge */}
              <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-zinc-800 z-10">
                <div className="h-full bg-red-600 w-full rounded-r-full shadow-[0_0_6px_rgba(220,38,38,0.8)]" />
              </div>
            </div>

            {/* Bottom Row */}
            <div className="pt-2 px-0.5 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:text-red-500 transition-colors">
                  Multi-Live (4 Écrans)
                </h3>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-normal leading-tight">
                  Regarder 4 chaînes en direct
                </p>
              </div>

              <div className="w-6 h-6 rounded bg-zinc-800/80 group-hover:bg-red-600 text-zinc-400 group-hover:text-white flex items-center justify-center shrink-0 transition-all mt-0.5 border border-white/5">
                <svg className="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* 2. Channel Cards */}
        {filteredChannels.map((channel) => (
          <LiveChannelCard
            key={channel.slug}
            channel={channel}
            isFavorite={favorites.includes(channel.slug)}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>

      {/* ── Empty State ─────────────────────────────────────────── */}
      {!isLoading && filteredChannels.length === 0 && (
        <div className="py-20 text-center space-y-3">
          <Television className="h-12 w-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-zinc-300">
            {activeCategory === "favorites"
              ? "Aucune chaîne dans vos favoris"
              : "Aucune chaîne trouvée"}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {activeCategory === "favorites"
              ? "Cliquez sur l'étoile d'une chaîne pour l'ajouter à vos favoris."
              : "Essayez de rechercher un autre mot-clé ou sélectionnez une autre catégorie."}
          </p>
        </div>
      )}

      {/* ── Multi-Live Modal Split View ──────────────────────────── */}
      {isMultiLiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-3 sm:p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                Multi-Live (4 Écrans)
              </h2>
            </div>
            <button
              onClick={() => setIsMultiLiveOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-0 py-1">
            {[0, 1, 2, 3].map((idx) => {
              const currentSlug = selectedMultiSlugs[idx] || channels[idx % channels.length]?.slug;
              const ch = channels.find((c) => c.slug === currentSlug) || channels[idx % channels.length];

              return (
                <div
                  key={idx}
                  className="relative bg-black rounded-xl overflow-hidden border border-white/10 flex flex-col min-h-[220px] sm:min-h-0"
                >
                  {/* Selector Dropdown Header */}
                  <div className="absolute top-2 left-2 z-20 flex items-center gap-2 max-w-[calc(100%-1rem)]">
                    <span className="px-2 py-1 rounded bg-red-600 text-[10px] sm:text-xs font-black text-white shrink-0">
                      Écran {idx + 1}
                    </span>
                    <select
                      value={ch?.slug || ""}
                      onChange={(e) => {
                        const newSlug = e.target.value;
                        setSelectedMultiSlugs((prev) => {
                          const copy = [...prev];
                          copy[idx] = newSlug;
                          return copy;
                        });
                      }}
                      className="bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-red-600 max-w-[160px] sm:max-w-[200px] truncate cursor-pointer"
                    >
                      {channels.map((c) => (
                        <option key={c.slug} value={c.slug} className="bg-zinc-900 text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 relative w-full h-full">
                    {ch && (
                      <LivePlayer
                        channel={ch}
                        allChannels={channels}
                        onBack={() => setIsMultiLiveOpen(false)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
