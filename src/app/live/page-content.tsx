"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconDeviceTv, IconFlame, IconTrophy, IconSearch } from "@tabler/icons-react";
import { getLiveChannels, getLiveCategories } from "@/services/live";
import { useLanguage } from "@/i18n/LanguageContext";
import { liveCategoryLabel } from "@/types/live";
import type { LiveChannel } from "@/types/live";

export function ChannelLogo({ channel }: { channel: LiveChannel }) {
  const [broken, setBroken] = useState(false);

  const initials = channel.name
    .replace(/^bein\s+sports/i, "beIN")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const isSports = channel.categories?.includes("sports") || /bein|sport|foot|eurosport|rmc|canal/i.test(channel.name);

  if (!channel.logo || broken) {
    return (
      <div
        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 select-none shadow-md ${
          isSports
            ? "bg-gradient-to-br from-[#7C3AED] via-[#D70466] to-[#E11D48] text-white font-black text-xs"
            : "bg-zinc-800 border border-white/10 text-zinc-300 font-bold text-xs"
        }`}
      >
        <span>{initials || "TV"}</span>
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-2xl bg-zinc-900/90 border border-white/10 flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-inner">
      <img
        src={channel.logo}
        alt={channel.name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

function ChannelCard({ channel, lang }: { channel: LiveChannel; lang: "fr" | "en" }) {
  const isSports = channel.categories?.includes("sports");

  return (
    <Link
      href={`/live/${channel.slug}`}
      className={`group relative flex items-center gap-3.5 rounded-2xl border p-3.5 transition-all duration-200 ${
        isSports
          ? "border-white/10 bg-zinc-900/80 hover:border-[#D70466]/80 hover:bg-zinc-900 hover:shadow-lg hover:shadow-[#D70466]/10"
          : "border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900"
      }`}
    >
      <ChannelLogo channel={channel} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-bold text-sm text-white truncate group-hover:text-white transition-colors">
            {channel.name}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md shrink-0 border border-red-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            Direct
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
          {channel.categories?.map((c) => (
            <span
              key={c}
              className={c === "sports" ? "text-amber-400 font-semibold flex items-center gap-0.5" : "text-zinc-400"}
            >
              {c === "sports" && <IconTrophy className="h-3 w-3 inline" />}
              #{liveCategoryLabel(c, lang)}
            </span>
          ))}
          {channel.country && <span className="text-zinc-500 uppercase">· {channel.country}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function LivePageContent() {
  const { lang, translate: _ } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: channels = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["live", "channels", activeCategory],
    queryFn: () =>
      getLiveChannels(activeCategory === "all" ? undefined : { category: activeCategory }),
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["live", "categories"],
    queryFn: getLiveCategories,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.categories?.some((cat) => cat.toLowerCase().includes(q)),
    );
  }, [channels, search]);

  const chips = ["all", ...categories];

  return (
    <div className="pt-24 pb-20 px-4 sm:px-8 md:px-12 lg:px-[4%] max-w-7xl mx-auto w-full">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-600/20 text-red-500 border border-red-500/30 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            CHILLERS LIVE TV
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <IconTrophy className="h-3 w-3" />
            Sports & Chaînes Direct
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
          {_("live.title")}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-zinc-400 max-w-2xl">
          Regardez vos chaînes de sport et d&apos;actualités préférées en direct et en streaming haute définition.
        </p>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 flex-wrap items-center">
          {chips.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === cat
                  ? "bg-[#D70466] text-white shadow-lg shadow-[#D70466]/25 scale-105"
                  : cat === "sports"
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                    : "bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {cat === "sports" && <IconTrophy className="h-3.5 w-3.5" />}
              {cat === "all" ? _("live.all") : liveCategoryLabel(cat, lang)}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une chaîne (ex: beIN, News)..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#D70466] transition-colors"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-10 w-10 border-4 border-[#D70466] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chargement des chaînes...</p>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="py-16 text-center bg-zinc-900/40 rounded-2xl border border-white/10 p-6">
          <p className="text-zinc-400 mb-4">{_("live.loadError")}</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2 rounded-full bg-[#D70466] text-white text-sm font-bold hover:bg-[#b5034f] transition-colors"
          >
            {_("live.retry")}
          </button>
        </div>
      )}

      {/* Empty search */}
      {!isLoading && filtered.length === 0 && (
        <div className="py-20 text-center text-zinc-500">
          <IconDeviceTv className="h-12 w-12 mx-auto mb-2 text-zinc-600" />
          <p className="font-semibold">{_("live.noChannels")}</p>
        </div>
      )}

      {/* Channel Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.map((channel) => (
          <ChannelCard key={channel.slug} channel={channel} lang={lang} />
        ))}
      </div>
    </div>
  );
}
