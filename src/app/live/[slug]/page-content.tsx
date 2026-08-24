"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconChevronLeft, IconTrophy } from "@tabler/icons-react";
import LivePlayer from "@/components/LivePlayer";
import { getLiveChannel, getLiveChannels } from "@/services/live";
import { useLanguage } from "@/i18n/LanguageContext";
import { liveCategoryLabel } from "@/types/live";
import { ChannelLogo } from "../page-content";
import type { LiveChannel } from "@/types/live";

function MiniChannel({ channel }: { channel: LiveChannel }) {
  const isSports = channel.categories?.includes("sports");
  return (
    <Link
      href={`/live/${channel.slug}`}
      className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all min-w-0 ${
        isSports
          ? "border-amber-500/20 bg-zinc-900/80 hover:border-[#D70466]/80 hover:bg-zinc-900"
          : "border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900"
      }`}
    >
      <ChannelLogo channel={channel} />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-bold text-white truncate block">{channel.name}</span>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
          {isSports && <span className="text-amber-400 font-semibold text-[11px]">Sport</span>}
          {channel.country && <span className="text-zinc-500 uppercase text-[10px]">· {channel.country}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function LiveChannelContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { lang, translate: _ } = useLanguage();

  const { data: channel, isLoading, isError, refetch } = useQuery({
    queryKey: ["live", "channel", params.slug],
    queryFn: () => getLiveChannel(params.slug),
    staleTime: 60_000,
  });

  const { data: allChannels = [] } = useQuery({
    queryKey: ["live", "channels", "all"],
    queryFn: () => getLiveChannels(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="pt-24 pb-20 min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 border-4 border-[#D70466] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chargement de la chaîne...</p>
      </div>
    );
  }

  if (isError || !channel) {
    return (
      <div className="pt-28 pb-20 px-4 sm:px-8 md:px-12 lg:px-[4%] text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-black text-white">{_("live.channelNotFound")}</h1>
        <p className="mt-2 text-zinc-400">{_("live.channelNotFoundDesc")}</p>
        <div className="flex justify-center gap-3 mt-6">
          <Link
            href="/live"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#D70466] text-white text-sm font-bold hover:bg-[#b5034f] transition-colors"
          >
            <IconChevronLeft className="h-4 w-4" />
            {_("live.backToLive")}
          </Link>
          {isError && (
            <button
              onClick={() => refetch()}
              className="px-5 py-2.5 rounded-full bg-white/10 text-white text-sm font-bold hover:bg-white/20"
            >
              {_("live.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const others = allChannels.filter((c) => c.slug !== channel.slug);
  const isSports = channel.categories?.includes("sports");

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-6xl mx-auto w-full px-4 sm:px-8 md:px-12 lg:px-[4%]">
      {/* Return button */}
      <div className="mb-4">
        <Link
          href="/live"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-zinc-400 hover:text-white transition-colors"
        >
          <IconChevronLeft className="h-4 w-4" />
          <span>Toutes les chaînes en direct</span>
        </Link>
      </div>

      {/* Video Player */}
      <div className="rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10">
        <LivePlayer
          channel={channel}
          allChannels={allChannels}
          onBack={() => router.push("/live")}
          onSelectChannel={(ch) => router.push(`/live/${ch.slug}`)}
        />
      </div>

      {/* Channel info */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
        <div className="flex items-center gap-4 min-w-0">
          <ChannelLogo channel={channel} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white truncate">{channel.name}</h1>
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md shrink-0 border border-red-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                Direct
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400 mt-1">
              {channel.categories?.map((c) => (
                <span key={c} className={c === "sports" ? "text-amber-400 font-bold flex items-center gap-0.5" : "text-zinc-400"}>
                  {c === "sports" && <IconTrophy className="h-3 w-3 inline" />}
                  #{liveCategoryLabel(c, lang)}
                </span>
              ))}
              {channel.country && <span className="text-zinc-500 uppercase font-semibold">· {channel.country}</span>}
              {channel.language && <span className="text-zinc-500 uppercase font-semibold">· {channel.language}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Other Channels */}
      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-brand-primary" />
            {_("live.otherChannels")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.slice(0, 12).map((c) => (
              <MiniChannel key={c.slug} channel={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
