"use client";

// Client-side BitTorrent engine (WebTorrent) — the browser speaks WebRTC to
// peers and plays via MediaSource, so decoding happens on the user's GPU and
// zero bytes travel through our server (Stremio model, Option A).
//
// We import the standalone browser build (dist/webtorrent.min.js): the npm
// `main` entry pulls Node-only deps (node-datachannel, webrtc-polyfill…)
// which break the Next.js/Turbopack build. The UMD dist is self-contained,
// browser-only and bundles fine.
//
// SSR note: the module touches browser globals at evaluation time, so we load
// it lazily on first browser use (same pattern as streamSaver.ts).

import type WebTorrent from "webtorrent/dist/webtorrent.min.js";

export interface TorrentSource {
  quality: string;
  magnet: string;
  infoHash: string;
  size: number;
}

export interface TorrentMagnet extends TorrentSource {
  title?: string;
  seeders?: number;
  indexer?: string;
}

interface MagnetEnvelope {
  success: boolean;
  data?: TorrentSource[] | null;
  message?: string | null;
}

let webTorrentModule: typeof WebTorrent | null = null;
let client: InstanceType<typeof WebTorrent> | null = null;

async function getWebTorrent(): Promise<typeof WebTorrent> {
  if (webTorrentModule) return webTorrentModule;
  webTorrentModule = (await import("webtorrent/dist/webtorrent.min.js")).default as unknown as typeof WebTorrent;
  return webTorrentModule;
}

/** Singleton client — kept alive across episodes so the user re-seeds. */
export async function getTorrentClient(): Promise<InstanceType<typeof WebTorrent>> {
  if (client) return client;
  const WebTorrentClass = await getWebTorrent();
  client = new WebTorrentClass({});
  return client;
}

/**
 * Fetch the best magnet for a title from the backend (search-only, no
 * TorrServer / FFmpeg involvement server-side).
 */
export async function fetchTorrentMagnet(opts: {
  title: string;
  year?: number;
  type?: string;
  season?: number;
  episode?: number;
  signal?: AbortSignal;
}): Promise<TorrentSource[] | null> {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams({ title: opts.title });
  if (opts.year && opts.year > 0) params.set("year", String(opts.year));
  if (opts.type) params.set("type", opts.type);
  if (opts.season != null) params.set("season", String(opts.season));
  if (opts.episode != null) params.set("episode", String(opts.episode));

  try {
    const res = await fetch(`/api/torrents/magnet?${params.toString()}`, {
      signal: opts.signal,
    });
    if (!res.ok) return null;
    const env = (await res.json()) as MagnetEnvelope;
    return env.success && env.data ? env.data : null;
  } catch {
    return null;
  }
}

const VIDEO_EXT_RE = /\.(mp4|mkv|avi|mov|webm|m4v)$/i;
/** Fichier vidéo à cibler : SxxExx si épisode demandé, sinon le plus gros. */
export function pickTorrentVideoFile(
  files: Array<{ name: string; path: string; length: number }>,
  season?: number,
  episode?: number,
): { name: string; path: string; length: number } | null {
  const videos = files.filter((f) => VIDEO_EXT_RE.test(f.name));
  if (videos.length === 0) return null;

  if (season != null && episode != null) {
    const episodeRe = new RegExp(
      `S(?:0*${String(season).padStart(2, "0")}|${season})E(?:0*${String(episode).padStart(2, "0")}|${episode})`,
      "i",
    );
    const match = videos.find((f) => episodeRe.test(f.name));
    if (match) return match;
  }

  return [...videos].sort((a, b) => b.length - a.length)[0];
}