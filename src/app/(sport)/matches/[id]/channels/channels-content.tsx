"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CaretLeft, LinkSimple, Play, Television } from "@phosphor-icons/react";
import LivePlayer from "@/components/LivePlayer";
import HalftimeAdPod from "@/components/matches/HalftimeAdPod";
import MatchChannelsRow from "@/components/live/MatchChannelsRow";
import { getMatchById, getMatchSummary } from "@/services/matches";
import { getSportsChannels, getSportsStream } from "@/services/sports";
import { getMatchChannels, resolveOhaStream } from "@/services/oha";
import type { LiveChannel } from "@/types/live";
import type { OhaChannel } from "@/types/oha";
import type { SportMatch } from "@/types/matches";
import type { SportsServer } from "@/types/sports";
import {
  FONT_STACK,
  buildMatchFromSummary,
  cacheMatch,
  readCachedMatch,
} from "../../match-utils";
import { getFastSportsImage } from "@/lib/sports-image";

interface ResolvedStream {
  url: string;
  type: "hls" | "iframe";
  relayUrl?: string;
  referer?: string;
  provider?: string;
  name?: string;
  score?: number;
}

export default function ChannelsPageContent() {
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? decodeURIComponent(rawId).trim() : Array.isArray(rawId) ? rawId[0] : "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [match, setMatch] = useState<SportMatch | null>(null);
  const [ohaChoice, setOhaChoice] = useState<{ ch: OhaChannel; url: string } | null>(null);
  const [ohaResolving, setOhaResolving] = useState<string | null>(null);
  const [ohaError, setOhaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      const cached = readCachedMatch(id);
      if (cached) setMatch(cached);
    }
  }, [id]);

  const loadMatch = useCallback(async () => {
    if (!id) return;
    try {
      const [sumRes, matchRes] = await Promise.allSettled([getMatchSummary(id), getMatchById(id)]);
      let resolved = readCachedMatch(id);
      if (sumRes.status === "fulfilled" && sumRes.value) resolved = buildMatchFromSummary(sumRes.value) || resolved;
      if (matchRes.status === "fulfilled" && matchRes.value) resolved = matchRes.value;
      if (resolved) {
        setMatch(resolved);
        cacheMatch(resolved);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const { data: stream } = useQuery({
    queryKey: ["live", "match-stream", "v2", id],
    queryFn: async (): Promise<ResolvedStream | null> => {
      const primary = await getSportsStream(id).catch(() => null);
      if (!primary?.url) return null;
      const servers: SportsServer[] = Array.isArray(primary.servers) ? primary.servers : [];
      if (servers.length) {
        const s = servers[0];
        return { url: s.type === "hls" && s.relayUrl ? s.relayUrl : s.url, type: s.type ?? primary.type ?? "iframe", relayUrl: s.relayUrl, referer: s.referer, provider: s.provider ?? primary.provider, name: s.name, score: s.score };
      }
      return { url: primary.url, type: primary.type || "iframe", relayUrl: primary.relayUrl, referer: primary.referer, provider: primary.provider };
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const { data: backupChannels } = useQuery({
    queryKey: ["live", "match-stream-channels", "v2", id],
    queryFn: () => getSportsChannels(id),
    enabled: Boolean(stream?.url || id),
    staleTime: 60_000,
  });

  const sportsServers = useMemo(() => {
    const base: SportsServer[] = [...(backupChannels?.servers ?? [])];
    if (!base.length && stream) base.push({ name: stream.name || "Source", url: stream.url, type: stream.type, relayUrl: stream.relayUrl, referer: stream.referer, provider: stream.provider as any });
    const seen = new Set<string>();
    return base.filter((s) => {
      const k = s.relayUrl || s.url;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [backupChannels?.servers, stream]);

  const { data: matchChannelStatuses = [] } = useQuery({
    queryKey: ["oha", "match-channels", match?.sport, match?.league?.name, match?.homeTeam?.name, match?.awayTeam?.name, match?.startTime],
    queryFn: () => getMatchChannels({ sport: match?.sport ?? "football", league: match?.league?.name, home: match?.homeTeam?.name || "", away: match?.awayTeam?.name || "", start: match?.startTime }),
    enabled: Boolean(match),
    staleTime: 60_000,
  });

  const confirmedChannels = useMemo(() => matchChannelStatuses.filter((s) => s.confirmed).map((s) => s.channel), [matchChannelStatuses]);
  const candidateChannels = useMemo(() => matchChannelStatuses.filter((s) => !s.confirmed).map((s) => s.channel), [matchChannelStatuses]);
  const allOha = useMemo(() => [...confirmedChannels, ...candidateChannels], [confirmedChannels, candidateChannels]);

  const setQuery = (key: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value); else sp.delete(key);
    if (key !== "c") sp.delete("c");
    if (key !== "s") sp.delete("s");
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const playOha = useCallback(async (ch: OhaChannel, opts?: { silent?: boolean }): Promise<boolean> => {
    if (ohaResolving) return false;
    setOhaError(null);
    setOhaResolving(ch.id);
    try {
      const url = await resolveOhaStream(ch.id, ch.altIds ?? []);
      setOhaChoice({ ch, url });
      setQuery("c", ch.id);
      return true;
    } catch {
      if (!opts?.silent) setOhaError(`Lien ${ch.name} indisponible.`);
      return false;
    } finally {
      setOhaResolving(null);
    }
  }, [ohaResolving, pathname, router, searchParams]);

  const serverIdxParam = searchParams.get("s");
  const ohaParam = searchParams.get("c");
  const selectedServerIdx = serverIdxParam !== null ? Number(serverIdxParam) : -1;

  useEffect(() => {
    if (ohaParam && allOha.length && !ohaChoice) {
      const ch = allOha.find((c) => c.id === ohaParam);
      if (ch) void playOha(ch, { silent: true });
    }
  }, [ohaParam, allOha, ohaChoice, playOha]);

  const activeServer = !ohaChoice && selectedServerIdx >= 0 ? sportsServers[selectedServerIdx] : null;

  const ohaLiveChannel: LiveChannel | null = ohaChoice
    ? { _id: `oha-${ohaChoice.ch.id}`, name: ohaChoice.ch.name, slug: `oha-${ohaChoice.ch.id}`, logo: ohaChoice.ch.logo ?? undefined, categories: ["sports"], type: "hls", streamUrl: ohaChoice.url, enabled: true, order: 0, isOnline: true, proxy: true }
    : null;

  const sportsLiveChannel: LiveChannel | null =
    !ohaChoice && activeServer && activeServer.type === "hls"
      ? { _id: `sp-${selectedServerIdx}`, name: activeServer.name || "Serveur", slug: `sp-${selectedServerIdx}`, categories: ["sports"], type: "hls", streamUrl: activeServer.relayUrl || activeServer.url, enabled: true, order: 0, isOnline: true }
      : null;

  const embedUrl = !ohaChoice && activeServer && activeServer.type === "iframe"
    ? (/youtube\.com|youtu\.be/i.test(activeServer.url)
        ? activeServer.url
        : `/api/live/embed-proxy?url=${encodeURIComponent(activeServer.url)}${activeServer.referer ? `&referer=${encodeURIComponent(activeServer.referer)}` : ""}`)
    : null;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${match?.homeTeam.name || ""} vs ${match?.awayTeam.name || ""} — Chaînes`, url });
      else {
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  };

  const teams = match ? `${match.homeTeam.name} vs ${match.awayTeam.name}` : "Chaînes & flux";

  return (
    <div className="min-h-screen bg-[#111111] pb-24 text-white antialiased" style={{ fontFamily: FONT_STACK }}>
      <header className="sticky top-12 z-20 flex h-12 items-center justify-between border-b border-[#262626] bg-[#111111]/90 backdrop-blur-md px-3 sm:px-6">
        <button onClick={() => router.back()} className="flex items-center gap-0.5 rounded-full py-1.5 pl-1 pr-3 text-[14px] text-white">
          <CaretLeft className="h-4 w-4" weight="bold" />
          <span>Retour</span>
        </button>
        <div className="flex min-w-0 items-center gap-2 px-2">
          {match?.league?.logo && <img src={getFastSportsImage(match.league.logo) ?? match.league.logo} alt="" width={20} height={20} className="h-5 w-5 object-contain" />}
          <span className="truncate text-[14px] font-semibold">{teams}</span>
        </div>
        <button onClick={share} className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12px] font-semibold">
          <LinkSimple className="h-4 w-4" /> {copied ? "Copié" : "Partager"}
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-3 sm:px-6 pt-4 space-y-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#0e0e0e] border border-[#222]">
          {ohaLiveChannel ? (
            <LivePlayer key={`oha-${ohaChoice?.ch.id}`} channel={ohaLiveChannel} onBack={() => {}} fill hideTopBar />
          ) : sportsLiveChannel ? (
            <LivePlayer key={`sp-${selectedServerIdx}`} channel={sportsLiveChannel} onBack={() => {}} fill hideTopBar />
          ) : embedUrl ? (
            <iframe key={embedUrl} src={embedUrl} title={teams} className="h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
              <Television className="h-10 w-10 text-[#FF6A00]" />
              <p className="text-sm font-semibold">Choisis une chaîne ou un serveur</p>
              <p className="text-xs text-zinc-500">Le lien de cette page reste partageable</p>
            </div>
          )}
        </div>

        {(confirmedChannels.length > 0 || candidateChannels.length > 0) && (
          <section className="rounded-xl bg-[#161616] border border-white/10 p-3 space-y-2">
            <MatchChannelsRow
              channels={allOha}
              confirmedIds={confirmedChannels.map((c) => c.id)}
              selectedId={ohaChoice?.ch.id ?? null}
              resolvingId={ohaResolving}
              onSelect={playOha}
              onExternal={() => { setOhaChoice(null); setQuery("c", null); }}
              externalActive={!ohaChoice}
              variant="light"
            />
            {ohaError && <p className="px-1 text-[11px] text-red-300">{ohaError}</p>}
          </section>
        )}

        <section className="rounded-xl bg-[#161616] border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-zinc-300">Serveurs & flux</h2>
            <span className="text-[11px] text-zinc-500">{sportsServers.length} disponible(s)</span>
          </div>
          {sportsServers.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {sportsServers.map((s, idx) => {
                const active = !ohaChoice && selectedServerIdx === idx;
                return (
                  <button
                    key={`${s.provider}-${s.sourceId}-${idx}`}
                    onClick={() => { setOhaChoice(null); setQuery("s", String(idx)); }}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${active ? "border-[#FF6A00] bg-[#FF6A00]/10" : "border-white/10 bg-black/30 hover:bg-white/5"}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{s.name || `Serveur ${idx + 1}`}</p>
                      <p className="text-[11px] text-zinc-500">{(s.provider || "source").toUpperCase()} · {(s.type || "iframe").toUpperCase()}</p>
                    </div>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-[#FF6A00] text-white" : "bg-white/10 text-zinc-300"}`}>
                      <Play className="h-4 w-4" weight="fill" />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Aucun serveur trouvé pour l’instant.</p>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Link href={`/matches/${encodeURIComponent(id)}`} className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold">Fiche du match</Link>
        </div>
      </div>
    </div>
  );
}
