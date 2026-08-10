"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconDeviceTv } from "@tabler/icons-react";
import { getLiveChannels, getLiveCategories } from "@/services/live";
import { useLanguage } from "@/i18n/LanguageContext";
import { liveCategoryLabel } from "@/types/live";
import type { LiveChannel } from "@/types/live";

function ChannelLogo({ channel }: { channel: LiveChannel }) {
  const [broken, setBroken] = useState(false);
  if (!channel.logo || broken) {
    return (
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center shrink-0">
        <IconDeviceTv className="h-6 w-6 text-zinc-500" />
      </div>
    );
  }
  return (
    <img
      src={channel.logo}
      alt={channel.name}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-14 h-14 rounded-2xl object-contain bg-zinc-900 p-1.5 shrink-0"
    />
  );
}

function ChannelCard({ channel, lang }: { channel: LiveChannel; lang: "fr" | "en" }) {
  return (
    <Link
      href={`/live/${channel.slug}`}
      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3 hover:border-[#D70466]/60 hover:bg-zinc-900 transition-colors"
    >
      <ChannelLogo channel={channel} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-white truncate">{channel.name}</span>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            Live
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
          {channel.categories?.slice(0, 3).map((c) => (
            <span key={c}>#{liveCategoryLabel(c, lang)}</span>
          ))}
          {channel.country && <span className="text-zinc-600 uppercase">· {channel.country}</span>}
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
    <div className="px-4 sm:px-8 md:px-12 lg:px-[4%] py-6 sm:py-8 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black">{_("live.title")}</h1>
        <p className="mt-1 text-sm text-zinc-400">{_("live.subtitle")}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {chips.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-[#D70466] text-white"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {cat === "all" ? _("live.all") : liveCategoryLabel(cat, lang)}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={_("live.searchPlaceholder")}
          className="w-full sm:w-64 px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#D70466]"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="py-16 text-center">
          <p className="text-zinc-400 mb-4">{_("live.loadError")}</p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2 rounded bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            {_("live.retry")}
          </button>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="py-16 text-center text-zinc-500">{_("live.noChannels")}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((channel) => (
          <ChannelCard key={channel.slug} channel={channel} lang={lang} />
        ))}
      </div>
    </div>
  );
}
