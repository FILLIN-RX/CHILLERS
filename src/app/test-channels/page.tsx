"use client";

/**
 * Page de test — lab « chaînes de match ».
 *
 * Affiche le snapshot de `sports-channels-lab` (fixtures fusionnés + tous les
 * liens de chaînes déjà scannés) et lit n'importe lequel d'entre eux : HLS via
 * le relay `/api/sports/lab/play`, iframe embarquée pour les players distants.
 * Rien de ceci n'est branché sur l'app existante.
 *
 * Activation : `NEXT_PUBLIC_SPORTS_CHANNELS=1` côté front ET
 * `SPORTS_CHANNELS_LAB=1` côté backend.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowsClockwise,
  Broadcast,
  CheckCircle,
  MagnifyingGlass,
  Play,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { httpJson } from "@/services/http";

const ENABLED = process.env.NEXT_PUBLIC_SPORTS_CHANNELS === "1";

interface LabFixture {
  id: string;
  home: string;
  away: string;
  startTs?: string;
  status: string;
  league?: string;
  providers: string[];
  playableCount: number;
  channelCount: number;
  confirmedCount: number;
  hlsCount: number;
  names: string[];
}

interface LabChannel {
  id: string;
  channelName: string;
  provider: string;
  type: "hls" | "iframe";
  url: string;
  relayUrl?: string;
  referer?: string;
  logo?: string;
  language?: string;
  playable: boolean;
  confirmed: boolean;
  httpStatus?: number;
}

interface LabReport {
  generatedAt: string;
  totals: {
    records: number;
    playable: number;
    deepConfirmed: number;
    pageOnly: number;
    dead: number;
    byProvider?: Record<string, { links: number; playable: number; confirmed: number }>;
  };
  fixtures: LabFixture[];
}

interface LabChannelsPayload {
  fixture: LabFixture;
  channels: LabChannel[];
}

const PROVIDER_COLORS: Record<string, string> = {
  kora: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  liveball: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  streamiz: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  kooorah: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  yallapro: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  "iptv-org": "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
};

const providerClass = (p: string) =>
  PROVIDER_COLORS[p] || "bg-white/5 text-zinc-300 border-white/15";

function kickoff(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LogoBadge({ channel }: { channel: LabChannel }) {
  const [broken, setBroken] = useState(false);
  if (channel.logo && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={channel.logo}
        alt=""
        className="h-8 w-12 max-w-[72px] rounded object-contain bg-white/5 border border-white/10"
        onError={() => setBroken(true)}
      />
    );
  }
  const initials =
    channel.channelName
      .replace(/^bein\s+sports?/i, "beIN")
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "TV";
  return (
    <span className="flex h-8 w-12 items-center justify-center rounded bg-white/5 border border-white/10 text-[10px] font-black text-zinc-300">
      {initials}
    </span>
  );
}

function HlsPlayer({ url, onResult }: { url: string; onResult: (ok: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    reported.current = false;
    const video = videoRef.current;
    if (!video) return;

    const ok = () => {
      if (!reported.current) {
        reported.current = true;
        onResult(true);
      }
    };
    const fail = (detail: string) => {
      setError(detail);
      if (!reported.current) {
        reported.current = true;
        onResult(false);
      }
    };

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: false, maxBufferLength: 12 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) fail(data.details || "erreur hls");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => undefined);
      video.addEventListener("loadedmetadata", ok, { once: true });
      video.addEventListener("error", () => fail("erreur native"), { once: true });
    } else {
      fail("HLS non supporté par ce navigateur");
    }

    return () => {
      hls?.destroy();
    };
  }, [url, onResult]);

  return (
    <div className="relative">
      <video ref={videoRef} controls playsInline className="w-full rounded-lg bg-black aspect-video" />
      {error && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-red-500/90 px-3 py-2 text-xs font-bold text-white">
          <WarningCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
}

function IframePlayer({ channel }: { channel: LabChannel }) {
  return (
    <iframe
      src={channel.url}
      title={channel.channelName}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
      referrerPolicy="no-referrer"
      className="w-full rounded-lg border border-white/10 bg-black aspect-video"
    />
  );
}

export default function TestChannelsPage() {
  const {
    data: report,
    isPending: loading,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ["sports-lab", "report"],
    enabled: ENABLED,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await httpJson<{ success: boolean; data?: LabReport }>("/sports/lab/report", {
        timeoutMs: 15_000,
      });
      if (!res?.data) throw new Error("Réponse vide");
      return res.data;
    },
  });

  const [query, setQuery] = useState("");
  const [onlyLive, setOnlyLive] = useState(true);
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlyPlayable, setOnlyPlayable] = useState(false);
  /** Jour sélectionné (`YYYY-MM-DD`), "" = sans date, null = tous les jours. */
  const [day, setDay] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<LabChannel | null>(null);
  const [score, setScore] = useState({ ok: 0, ko: 0, iframe: 0 });

  const {
    data: payload,
    isPending: channelsLoading,
    error: channelError,
  } = useQuery({
    queryKey: ["sports-lab", "channels", selectedId],
    enabled: Boolean(selectedId),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await httpJson<{ success: boolean; data?: LabChannelsPayload }>(
        `/sports/lab/fixtures/${encodeURIComponent(String(selectedId))}/channels`,
        { timeoutMs: 15_000 }
      );
      if (!res?.data) throw new Error("Fixture absente du snapshot");
      return res.data;
    },
  });

  /** Jours présents dans le snapshot, du plus récent au plus ancien. */
  const days = useMemo(() => {
    const set = new Set<string>();
    for (const f of report?.fixtures ?? []) {
      if (f.startTs) set.add(f.startTs.slice(0, 10));
    }
    return Array.from(set).sort().reverse();
  }, [report]);

  const fixtures = useMemo(() => {
    const list = report?.fixtures ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((f) => {
      const fday = f.startTs ? f.startTs.slice(0, 10) : "";
      if (day !== null && fday !== day) return false;
      if (onlyLive && f.status !== "live") return false;
      if (onlyMulti && f.providers.length < 2) return false;
      if (onlyPlayable && f.playableCount < 1) return false;
      if (!q) return true;
      return `${f.home} ${f.away} ${f.league ?? ""}`.toLowerCase().includes(q);
    });
  }, [report, query, day, onlyLive, onlyMulti, onlyPlayable]);

  const selectFixture = useCallback((id: string) => {
    setSelectedId(id);
    setActive(null);
  }, []);

  const onHlsResult = useCallback((ok: boolean) => {
    setScore((s) => ({ ...s, ok: ok ? s.ok + 1 : s.ok, ko: ok ? s.ko : s.ko + 1 }));
  }, []);

  const openChannel = (ch: LabChannel) => {
    setActive(ch);
    if (ch.type === "iframe") setScore((s) => ({ ...s, iframe: s.iframe + 1 }));
  };

  if (!ENABLED) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <h1 className="text-xl font-black">Lab chaînes de match désactivé</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Ajoute <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_SPORTS_CHANNELS=1</code> au
          <code className="mx-1 rounded bg-white/10 px-1">.env.local</code> (front) et
          <code className="mx-1 rounded bg-white/10 px-1">SPORTS_CHANNELS_LAB=1</code> au
          <code className="mx-1 rounded bg-white/10 px-1">backend/.env</code>, puis relance les deux serveurs.
        </p>
      </main>
    );
  }

  const totals = report?.totals;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 px-6 py-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Broadcast size={20} className="text-emerald-400" />
          <h1 className="text-base font-black tracking-tight">
            Lab chaînes de match <span className="text-zinc-500 font-bold">· snapshot</span>
          </h1>
        </div>
        {report && (
          <span className="text-[11px] font-semibold text-zinc-500">
            généré le {new Date(report.generatedAt).toLocaleString("fr-FR")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-[11px] font-bold">
          {totals && (
            <>
              <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1">
                {totals.records} liens
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-400/25 px-2.5 py-1 text-emerald-300">
                {totals.playable} jouables
              </span>
              <span className="rounded-full bg-sky-500/10 border border-sky-400/25 px-2.5 py-1 text-sky-300">
                {totals.deepConfirmed} confirmés
              </span>
              <span className="rounded-full bg-red-500/10 border border-red-400/25 px-2.5 py-1 text-red-300">
                {totals.dead} morts
              </span>
            </>
          )}
          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1">
            HLS joués {score.ok} · échecs {score.ko} · iframes {score.iframe}
          </span>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 hover:bg-white/20"
          >
            <ArrowsClockwise size={13} /> Recharger
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] min-h-[calc(100vh-57px)]">
        <section className="border-r border-white/10 p-4 space-y-3">
          <div className="relative">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Équipe, ligue…"
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            <button
              onClick={() => setDay(null)}
              className={`rounded-full border px-2.5 py-1 ${
                day === null
                  ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                  : "bg-white/5 border-white/10 text-zinc-400"
              }`}
            >
              Tous les jours
            </button>
            {days.map((d) => {
              const label = new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              });
              const count = (report?.fixtures ?? []).filter(
                (f) => (f.startTs ? f.startTs.slice(0, 10) : "") === d
              ).length;
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={`rounded-full border px-2.5 py-1 ${
                    day === d
                      ? "bg-sky-500/15 border-sky-400/40 text-sky-300"
                      : "bg-white/5 border-white/10 text-zinc-400"
                  }`}
                >
                  {label} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
            {report?.fixtures.some((f) => !f.startTs) && (
              <button
                onClick={() => setDay("")}
                className={`rounded-full border px-2.5 py-1 ${
                  day === ""
                    ? "bg-zinc-500/20 border-zinc-400/40 text-zinc-200"
                    : "bg-white/5 border-white/10 text-zinc-400"
                }`}
              >
                Sans heure
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            {[
              { label: "Live", value: onlyLive, set: setOnlyLive },
              { label: "Multi-providers", value: onlyMulti, set: setOnlyMulti },
              { label: "≥1 jouable", value: onlyPlayable, set: setOnlyPlayable },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => f.set(!f.value)}
                className={`rounded-full border px-2.5 py-1 ${
                  f.value
                    ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
                    : "bg-white/5 border-white/10 text-zinc-400"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-zinc-500">{fixtures.length} fixtures</span>
          </div>

          {loadError && (
            <div className="rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-xs text-red-300">
              {loadError instanceof Error
                ? loadError.message
                : "Backend injoignable (flag SPORTS_CHANNELS_LAB ?)"}
            </div>
          )}
          {loading && <div className="text-sm text-zinc-500">Chargement du snapshot…</div>}

          <ul className="space-y-1.5">
            {fixtures.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => selectFixture(f.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    selectedId === f.id
                      ? "bg-emerald-500/10 border-emerald-400/40"
                      : "bg-white/[0.03] border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {f.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                    <span className="text-sm font-bold truncate">
                      {f.home} <span className="text-zinc-500">vs</span> {f.away}
                    </span>
                    <span className="ml-auto text-[10px] font-bold text-zinc-500 shrink-0">
                      {f.playableCount}/{f.channelCount} jouables
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                    <span>{kickoff(f.startTs)}</span>
                    {f.league && <span className="truncate max-w-[140px]">{f.league}</span>}
                    {f.providers.map((p) => (
                      <span key={p} className={`rounded border px-1.5 py-0.5 font-bold ${providerClass(p)}`}>
                        {p}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-4 space-y-4">
          {!selectedId && (
            <p className="text-sm text-zinc-500">
              Choisis une rencontre à gauche pour voir toutes les chaînes et serveurs du snapshot.
            </p>
          )}
          {channelsLoading && selectedId && (
            <div className="text-sm text-zinc-500">Chargement des chaînes…</div>
          )}
          {channelError && (
            <div className="rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-xs text-red-300">
              {channelError instanceof Error ? channelError.message : "Chargement impossible"}
            </div>
          )}

          {payload && (
            <>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black">
                  {payload.fixture.home} <span className="text-zinc-500">vs</span> {payload.fixture.away}
                </h2>
                <span className="text-xs text-zinc-500">
                  {payload.fixture.league} · {kickoff(payload.fixture.startTs)} ·{" "}
                  {payload.channels.length} liens ({payload.fixture.confirmedCount} confirmés,{" "}
                  {payload.fixture.hlsCount} HLS)
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {payload.channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => openChannel(ch)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active?.id === ch.id
                        ? "bg-emerald-500/10 border-emerald-400/40"
                        : "bg-white/[0.03] border-white/10 hover:border-white/25"
                    }`}
                  >
                    <LogoBadge channel={ch} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{ch.channelName}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${providerClass(ch.provider)}`}>
                          {ch.provider}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span
                          className={`rounded-full border px-1.5 py-0.5 ${
                            ch.confirmed
                              ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                              : ch.playable
                                ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
                                : "bg-red-500/15 border-red-400/30 text-red-300"
                          }`}
                        >
                          {ch.confirmed ? "confirmé" : ch.playable ? "jouable (page)" : "mort"}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-zinc-300">
                          {ch.type.toUpperCase()}
                        </span>
                        {ch.language && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-400">
                            {ch.language}
                          </span>
                        )}
                        {ch.httpStatus && (
                          <span className="text-zinc-500">HTTP {ch.httpStatus}</span>
                        )}
                      </div>
                    </div>
                    <Play size={16} className="text-zinc-500 shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}

          {active && (
            <div className="sticky top-4 rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur p-4 space-y-3">
              <div className="flex items-center gap-3">
                <LogoBadge channel={active} />
                <div className="min-w-0">
                  <div className="text-sm font-black truncate">{active.channelName}</div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {active.provider} · {active.type.toUpperCase()} ·{" "}
                    {active.relayUrl ? "via relay backend" : "URL directe"}
                  </div>
                </div>
                <button
                  onClick={() => setActive(null)}
                  className="ml-auto rounded-full bg-white/10 border border-white/15 p-1.5 hover:bg-white/20"
                  aria-label="Fermer le lecteur"
                >
                  <X size={14} />
                </button>
              </div>

              {active.type === "hls" ? (
                active.relayUrl ? (
                  <HlsPlayer key={active.relayUrl} url={active.relayUrl} onResult={onHlsResult} />
                ) : (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-300">
                    Pas de relay pour ce lien (URL non HLS ou snapshot sans relay).
                  </div>
                )
              ) : (
                <IframePlayer channel={active} />
              )}

              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <CheckCircle size={12} className="text-emerald-400" />
                <span className="truncate">{active.url}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
