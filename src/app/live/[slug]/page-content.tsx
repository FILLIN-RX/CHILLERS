"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";
import LivePlayer from "@/components/LivePlayer";
import { getLiveChannel, getLiveChannels } from "@/services/live";
import { useLanguage } from "@/i18n/LanguageContext";
import { liveCategoryLabel } from "@/types/live";
import type { LiveChannel } from "@/types/live";

function MiniChannel({ channel }: { channel: LiveChannel }) {
  return (
    <Link
      href={`/live/${channel.slug}`}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-2.5 hover:border-[#D70466]/60 hover:bg-zinc-900 transition-colors min-w-0"
    >
      {channel.logo ? (
        <img
          src={channel.logo}
          alt={channel.name}
          loading="lazy"
          className="w-10 h-10 rounded-xl object-contain bg-zinc-900 p-1 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-zinc-800 shrink-0" />
      )}
      <span className="text-sm text-white truncate">{channel.name}</span>
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
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !channel) {
    return (
      <div className="px-4 sm:px-8 md:px-12 lg:px-[4%] py-20 text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-black">{_("live.channelNotFound")}</h1>
        <p className="mt-2 text-zinc-400">{_("live.channelNotFoundDesc")}</p>
        <Link
          href="/live"
          className="inline-flex items-center gap-1 mt-6 px-5 py-2 rounded bg-[#D70466] text-white text-sm font-medium hover:bg-[#b5034f] transition-colors"
        >
          {_("live.backToLive")}
          <IconChevronRight className="h-4 w-4" />
        </Link>
        {isError && (
          <button onClick={() => refetch()} className="ml-3 px-4 py-2 rounded bg-white/10 text-white text-sm">
            {_("live.retry")}
          </button>
        )}
      </div>
    );
  }

  const others = allChannels.filter((c) => c.slug !== channel.slug);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 md:px-12 lg:px-[4%] py-6">
      <LivePlayer
        channel={channel}
        onBack={() => router.push("/live")}
      />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {channel.logo && (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-12 h-12 rounded-2xl object-contain bg-zinc-900 p-1.5"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black truncate">{channel.name}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400 mt-0.5">
                {channel.categories?.map((c) => (
                  <span key={c}>#{liveCategoryLabel(c, lang)}</span>
                ))}
                {channel.country && <span className="text-zinc-600 uppercase">· {channel.country}</span>}
                {channel.language && <span className="text-zinc-600 uppercase">· {channel.language}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold mb-3">{_("live.otherChannels")}</h2>
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
