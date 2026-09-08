"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Television } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import { getLiveChannel, getLiveChannels } from "@/services/live";
import { useLanguage } from "@/i18n/LanguageContext";
import type { LiveChannel } from "@/types/live";

export default function LiveChannelContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { translate: _ } = useLanguage();

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

  // Verrouille le scroll de la page tant que la vue plein écran est ouverte.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevPosition;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 h-dvh w-screen bg-black overflow-hidden">
      {isLoading && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black">
          <div className="h-12 w-12 border-4 border-[#D70466] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Chargement de la chaîne...
          </p>
        </div>
      )}

      {!isLoading && (isError || !channel) && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Television className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white">{_("live.channelNotFound")}</h3>
          <p className="text-sm text-zinc-400 max-w-md">{_("live.channelNotFoundDesc")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              Réessayer
            </button>
            <a
              href="/live"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
            >
              Retour aux directs
            </a>
          </div>
        </div>
      )}

      {!isLoading && channel && (
        <div className="absolute inset-0">
          <LivePlayer
            channel={channel}
            allChannels={allChannels}
            fill
            onBack={() => router.push("/live")}
            onSelectChannel={(ch) => router.push(`/live/${ch.slug}`)}
          />
        </div>
      )}
    </div>
  );
}