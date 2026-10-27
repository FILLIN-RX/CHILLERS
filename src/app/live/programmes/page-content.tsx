"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Television,
  MagnifyingGlass,
  Trophy,
  FilmStrip,
  Baby,
  MusicNotes,
  CalendarBlank,
  ArrowLeft,
  ArrowClockwise,
  Play,
  CircleNotch,
  X,
} from "@phosphor-icons/react";
import { resolveOhaStream } from "@/services/oha";
import { getEpgGuide } from "@/services/epg";
import {
  OHA_CATEGORY_LABELS,
  OHA_CATEGORY_ORDER,
  type OhaCategory,
} from "@/types/oha";
import type { EpgGuideChannel, EpgProgram } from "@/types/epg";
import type { LiveChannel } from "@/types/live";
import { competitionsForChannel } from "@/lib/match-channels";
import LivePlayerModal from "@/components/live/LivePlayerModal";

type CatFilter = "all" | OhaCategory;

const TABS: { id: CatFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "Toutes", icon: Television },
  ...OHA_CATEGORY_ORDER.map((cat) => ({
    id: cat as CatFilter,
    label: OHA_CATEGORY_LABELS[cat].fr,
    icon:
      cat === "sport"
        ? Trophy
        : cat === "cine"
          ? FilmStrip
          : cat === "kids"
            ? Baby
            : cat === "musique"
              ? MusicNotes
              : Television,
  })),
];

const DAY_MS = 24 * 60 * 60_000;

function useNowMs(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtRange(start?: string, end?: string): string {
  const left = fmtTime(start);
  const right = fmtTime(end);
  return left && right ? `${left} - ${right}` : left || right;
}

function dayLabel(date: Date, index: number): string {
  if (index === 0) return "Aujourd'hui";
  if (index === 1) return "Demain";
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function dayTitle(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function sourceLabel(source: EpgGuideChannel["source"]): string {
  if (source === "epgshare") return "Grille complète";
  if (source === "mixed") return "Grille + OHA";
  if (source === "oha") return "Now/Next OHA";
  return "Pas d'EPG";
}

function toLiveChannel(channel: EpgGuideChannel, streamUrl: string): LiveChannel {
  return {
    _id: `oha-${channel.id}`,
    name: channel.name,
    slug: channel.slug,
    logo: channel.logo ?? undefined,
    categories: [channel.category],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl,
    enabled: true,
    order: 0,
    isOnline: true,
    proxy: true,
    ohaId: channel.id,
    ohaAltIds: channel.altIds,
    epgNow: channel.now
      ? { title: channel.now.title, start: channel.now.start, end: channel.now.end }
      : undefined,
    epgNext: channel.next
      ? { title: channel.next.title, start: channel.next.start, end: channel.next.end }
      : undefined,
  };
}

function Timeline({
  programs,
  fromMs,
  toMs,
  nowMs,
  onSelect,
}: {
  programs: EpgProgram[];
  fromMs: number;
  toMs: number;
  nowMs: number;
  onSelect: (program: EpgProgram) => void;
}) {
  const total = toMs - fromMs;
  const showNow = nowMs >= fromMs && nowMs < toMs;
  const labels = Array.from({ length: 13 }, (_, index) => index * 2);

  return (
    <div className="min-w-0 flex-1">
      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-[760px]">
          <div className="relative h-4 mb-1 text-[9px] font-semibold text-zinc-500">
            {labels.map((hour) => {
              const at = fromMs + hour * 60 * 60_000;
              return (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              );
            })}
          </div>

          <div
            className="relative h-14 rounded-lg border border-white/5 bg-zinc-950/70 overflow-hidden"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(255,255,255,0.055) 0 1px, transparent 1px calc(100% / 24))",
            }}
          >
            {programs.map((program, index) => {
              const rawStart = Date.parse(program.start);
              const rawEnd = Date.parse(program.end);
              if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
              const start = Math.max(rawStart, fromMs);
              const end = Math.min(rawEnd, toMs);
              if (end <= start) return null;
              const left = ((start - fromMs) / total) * 100;
              const width = ((end - start) / total) * 100;
              const isNow = nowMs >= rawStart && nowMs < rawEnd;

              return (
                <button
                  key={`${program.start}-${index}`}
                  type="button"
                  onClick={() => onSelect(program)}
                  title={`${program.title}${program.subTitle ? ` — ${program.subTitle}` : ""}\n${fmtRange(program.start, program.end)}`}
                  className={`absolute top-1 bottom-1 overflow-hidden rounded-md border px-1.5 py-1 text-left transition-colors ${
                    isNow
                      ? "border-red-400/60 bg-red-600/25 hover:bg-red-600/35"
                      : "border-white/5 bg-zinc-800/80 hover:border-red-400/40 hover:bg-zinc-700/80"
                  }`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                >
                  <span className={`block truncate text-[10px] font-bold ${isNow ? "text-white" : "text-zinc-100"}`}>
                    {program.title}
                  </span>
                  <span className={`block truncate text-[9px] ${isNow ? "text-red-100" : "text-zinc-500"}`}>
                    {fmtTime(program.start)}
                  </span>
                </button>
              );
            })}

            {showNow && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
                style={{ left: `${((nowMs - fromMs) / total) * 100}%` }}
              >
                <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500 shadow shadow-red-500/50" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NowNextFallback({ channel }: { channel: EpgGuideChannel }) {
  return (
    <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/5 flex flex-col justify-center">
        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          À l&apos;antenne
          {channel.now && (
            <span className="text-zinc-500 font-normal">
              ({fmtRange(channel.now.start, channel.now.end)})
            </span>
          )}
        </span>
        {channel.now ? (
          <p className="text-xs font-semibold text-zinc-100 truncate">{channel.now.title}</p>
        ) : (
          <p className="text-xs font-medium text-zinc-500 italic">
            Programme non disponible
          </p>
        )}
      </div>

      <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-white/5 flex flex-col justify-center">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
          Ensuite
          {channel.next && (
            <span className="text-zinc-600 font-normal ml-1">
              ({fmtRange(channel.next.start, channel.next.end)})
            </span>
          )}
        </span>
        {channel.next ? (
          <p className="text-xs font-medium text-zinc-300 truncate">{channel.next.title}</p>
        ) : (
          <p className="text-xs font-medium text-zinc-600 italic">—</p>
        )}
      </div>
    </div>
  );
}

export default function ProgramGuideContent() {
  const [activeCat, setActiveCat] = useState<CatFilter>("all");
  const [search, setSearch] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<{ channel: EpgGuideChannel; program: EpgProgram } | null>(null);
  const [playing, setPlaying] = useState<{ ch: EpgGuideChannel; streamUrl: string } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const nowMs = useNowMs();

  const days = useMemo(
    () => Array.from({ length: 4 }, (_, index) => {
      const date = startOfDay(new Date());
      date.setDate(date.getDate() + index);
      return date;
    }),
    [],
  );

  const day = days[dayIndex] ?? days[0];
  const fromMs = day.getTime();
  const toMs = fromMs + DAY_MS;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["epg", new Date(fromMs).toISOString()],
    queryFn: () => getEpgGuide({
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
    }),
    staleTime: 5 * 60_000,
    refetchInterval: dayIndex === 0 ? 60_000 : false,
  });

  const channels = useMemo(() => data?.channels ?? [], [data]);

  const filtered = useMemo(() => {
    let list = channels;
    if (activeCat !== "all") list = list.filter((channel) => channel.category === activeCat);
    const query = search.trim().toLowerCase();
    if (query) list = list.filter((channel) => channel.name.toLowerCase().includes(query));
    return list;
  }, [channels, activeCat, search]);

  const playerChannels = useMemo(
    () => filtered.map((channel) => toLiveChannel(channel, "")),
    [filtered],
  );

  const play = async (channel: EpgGuideChannel) => {
    if (resolvingId) return;
    setPlayError(null);
    setResolvingId(channel.id);
    try {
      const url = await resolveOhaStream(channel.id, channel.altIds);
      setPlaying({ ch: channel, streamUrl: url });
    } catch {
      setPlayError(`Lien indisponible pour ${channel.name}. Réessayez plus tard.`);
    } finally {
      setResolvingId(null);
    }
  };

  const selectInPlayer = async (liveChannel: LiveChannel) => {
    const id = liveChannel.ohaId ?? liveChannel.slug.replace(/^oha-/u, "");
    const channel = channels.find((entry) => entry.id === id);
    if (!channel || channel.id === playing?.ch.id) return;
    await play(channel);
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-[1500px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au Live
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <CalendarBlank className="w-7 h-7 text-red-500" />
              Programmes TV par chaîne
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Grille complète EPGShare01, complétée par le now/next OHA pour les chaînes non couvertes.
            </p>
          </div>

          {data && (
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5">
                <strong className="text-white">{data.coverage.withFullGuide}</strong>/{data.coverage.total} grilles complètes
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5">
                <strong className="text-white">{data.coverage.withNow}</strong> en direct
              </span>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-50"
                aria-label="Actualiser la grille"
              >
                <ArrowClockwise className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCat === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCat(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-[5px] text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                    isActive
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                      : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full xl:w-64 shrink-0">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une chaîne..."
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500 transition-colors shadow-inner"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-5">
          {days.map((date, index) => {
            const isActive = dayIndex === index;
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setDayIndex(index)}
                title={dayTitle(date)}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${
                  isActive
                    ? "bg-white text-black border-white"
                    : "bg-zinc-900/70 text-zinc-400 border-white/5 hover:text-white hover:border-white/20"
                }`}
              >
                <span className="capitalize">{dayLabel(date, index)}</span>
              </button>
            );
          })}
        </div>

        {playError && (
          <div className="mb-6 p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-xs text-red-200 flex items-center justify-between">
            <span>{playError}</span>
            <button
              onClick={() => setPlayError(null)}
              className="text-red-400 hover:text-white font-bold text-sm ml-2"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="h-24 bg-zinc-900/60 rounded-xl border border-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="p-12 text-center bg-zinc-900/40 border border-white/5 rounded-2xl">
            <CalendarBlank className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 font-medium">La grille TV est momentanément indisponible.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
            >
              Réessayer
            </button>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((channel) => {
              const isResolving = resolvingId === channel.id;
              const competitions = competitionsForChannel(channel.name);

              return (
                <div
                  key={channel.channelKey}
                  className="group flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 p-3.5 sm:p-4 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-red-500/30 hover:bg-zinc-800/60 transition-all"
                >
                  <div className="flex items-center gap-3 lg:gap-4 lg:w-60 shrink-0">
                    <div className="w-16 h-12 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.name}
                          className="w-full h-full object-contain filter brightness-110"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs font-black text-zinc-300">
                          {channel.name.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors truncate">
                        {channel.name}
                      </h3>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {OHA_CATEGORY_LABELS[channel.category]?.fr ?? channel.category}
                      </span>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {sourceLabel(channel.source)}
                        {channel.stale ? " · à rafraîchir" : ""}
                        {competitions.length > 0 ? ` · ${competitions.slice(0, 2).join(", ")}` : ""}
                      </p>
                    </div>

                    <button
                      onClick={() => play(channel)}
                      disabled={isResolving || Boolean(resolvingId)}
                      className="ml-auto lg:ml-0 shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isResolving ? (
                        <CircleNotch className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play weight="fill" className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Regarder</span>
                    </button>
                  </div>

                  {channel.hasFullGuide && channel.programs.length > 0 ? (
                    <Timeline
                      programs={channel.programs}
                      fromMs={fromMs}
                      toMs={toMs}
                      nowMs={nowMs}
                      onSelect={(program) => setSelected({ channel, program })}
                    />
                  ) : (
                    <NowNextFallback channel={channel} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-12 text-center bg-zinc-900/40 border border-white/5 rounded-2xl">
            <CalendarBlank className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 font-medium">
              Aucune chaîne ne correspond à votre recherche.
            </p>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                  {selected.channel.name} · {fmtRange(selected.program.start, selected.program.end)}
                </p>
                <h2 className="mt-1 text-lg font-black text-white">{selected.program.title}</h2>
                {selected.program.subTitle && (
                  <p className="text-xs text-zinc-400 mt-0.5">{selected.program.subTitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10"
                aria-label="Fermer le détail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 border border-white/5">
                  {selected.program.category ?? "Programme"}
                </span>
                {selected.program.episode && (
                  <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 border border-white/5">
                    {selected.program.episode}
                  </span>
                )}
                <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-500 border border-white/5">
                  {selected.program.source === "epgshare" ? "EPGShare01" : "OHA"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">
                {selected.program.description || "Aucun résumé disponible pour ce programme."}
              </p>
            </div>
          </div>
        </div>
      )}

      {playing && (
        <LivePlayerModal
          channel={toLiveChannel(playing.ch, playing.streamUrl)}
          allChannels={playerChannels}
          onClose={() => setPlaying(null)}
          onSelectChannel={selectInPlayer}
        />
      )}
    </div>
  );
}
