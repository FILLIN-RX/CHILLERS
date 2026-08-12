"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  fetchTorrentMagnet,
  getTorrentClient,
  pickTorrentVideoFile,
  type TorrentMagnet,
} from "@/services/webTorrent";
import type { Torrent } from "webtorrent";

export type TorrentPlaybackStatus =
  | "idle" // disabled
  | "fetching" // fetching magnet from backend
  | "adding" // client.add()
  | "scanning" // waiting for metadata
  | "connecting" // metadata ok, no bytes yet
  | "ready" // bytes flowing → renderTo owns the <video>
  | "stalled" // no bytes after stallTimeoutMs
  | "error"; // unrecoverable

export interface UseTorrentPlaybackArgs {
  enabled: boolean;
  title: string;
  year?: number;
  type?: string;
  season?: number;
  episode?: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** ms without any downloaded byte before declaring "stalled" (default 20s). */
  stallTimeoutMs?: number;
}

export interface UseTorrentPlaybackReturn {
  status: TorrentPlaybackStatus;
  /** 0..1 fraction of the torrent downloaded. */
  progress: number;
  /** Bytes/sec currently received from peers. */
  downloadSpeed: number;
  peers: number;
  error: string | null;
  magnet: TorrentMagnet | null;
  fileName: string | null;
  /** Retry the whole session (new magnet fetch). */
  retry: () => void;
  /**
   * Streams the torrent file straight to disk (client-side, 0 bytes via the
   * server) using StreamSaver. Resolves when the file is fully written.
   */
  downloadToDisk: (filename?: string) => Promise<void>;
}

interface TorrentState {
  status: TorrentPlaybackStatus;
  progress: number;
  downloadSpeed: number;
  peers: number;
  error: string | null;
  magnet: TorrentMagnet | null;
  fileName: string | null;
}

type TorrentAction =
  | { type: "reset" }
  | { type: "phase"; status: TorrentPlaybackStatus }
  | { type: "magnet"; magnet: TorrentMagnet }
  | { type: "file"; name: string }
  | { type: "stats"; progress: number; downloadSpeed: number; peers: number }
  | { type: "stall" }
  | { type: "fail"; message: string };

const initialState: TorrentState = {
  status: "idle",
  progress: 0,
  downloadSpeed: 0,
  peers: 0,
  error: null,
  magnet: null,
  fileName: null,
};

function torrentReducer(state: TorrentState, action: TorrentAction): TorrentState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "phase":
      return { ...state, status: action.status, error: null };
    case "magnet":
      return { ...state, magnet: action.magnet };
    case "file":
      return { ...state, fileName: action.name };
    case "stats":
      return {
        ...state,
        progress: action.progress,
        downloadSpeed: action.downloadSpeed,
        peers: action.peers,
      };
    case "stall":
      return { ...state, status: "stalled", error: "Aucun pair P2P joignable" };
    case "fail":
      return { ...state, status: "error", error: action.message };
  }
}

const DEFAULT_STALL_TIMEOUT_MS = 20_000;

export function useTorrentPlayback(args: UseTorrentPlaybackArgs): UseTorrentPlaybackReturn {
  const { enabled, title, year, type, season, episode, videoRef } = args;
  const stallTimeoutMs = args.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;

  const [state, dispatch] = useReducer(torrentReducer, initialState);

  const torrentRef = useRef<Torrent | null>(null);
  const disposersRef = useRef<Array<() => void>>([]);

  const addDisposer = useCallback((fn: () => void) => {
    disposersRef.current.push(fn);
  }, []);

  const runDisposers = useCallback(() => {
    disposersRef.current.forEach((fn) => fn());
    disposersRef.current = [];
  }, []);

  /** Détache proprement le torrent du client global (arrête le seed/local). */
  const dropTorrent = useCallback(() => {
    const torrent = torrentRef.current;
    torrentRef.current = null;
    if (torrent) {
      void getTorrentClient().then((client) => {
        if (client.get(torrent.infoHash)) client.remove(torrent);
      });
    }
  }, []);

  const startSession = useCallback(async () => {
    runDisposers();
    dropTorrent();
    dispatch({ type: "reset" });
    dispatch({ type: "phase", status: "fetching" });

    const abort = new AbortController();
    addDisposer(() => abort.abort());

    try {
      const res = await fetchTorrentMagnet({ title, year, type, season, episode, signal: abort.signal });
      if (!res || abort.signal.aborted) return;

      if (!res.magnet && !res.torrentBase64) {
        dispatch({ type: "fail", message: "Aucun torrent trouvé" });
        return;
      }
      dispatch({ type: "magnet", magnet: res });
      dispatch({ type: "phase", status: "adding" });

      const client = await getTorrentClient();
      if (abort.signal.aborted) return;

      const torrent = await new Promise<Torrent>((resolve, reject) => {
        const torrentId = res.magnet
          ? res.magnet
          : Uint8Array.from(atob(res.torrentBase64!), (c) => c.charCodeAt(0));
        client.add(torrentId, { path: title }, (err, t) => {
          if (err) reject(new Error(`add: ${err.message}`));
          else if (!t) reject(new Error("add: torrent introuvable"));
          else resolve(t);
        });
      });

      // Session périmée (retry/stop entre-temps) → on se retire soi-même.
      if (torrentRef.current !== torrent && torrentRef.current !== null) {
        client.remove(torrent);
        return;
      }
      torrentRef.current = torrent;

      if (torrent.files.length === 0) {
        dispatch({ type: "phase", status: "scanning" });
        await new Promise<void>((resolve) => {
          torrent.once("metadata", () => resolve());
          abort.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        if (abort.signal.aborted) return;
      }

      const target = pickTorrentVideoFile(torrent.files, season, episode);
      if (!target) {
        dispatch({ type: "fail", message: "Aucun fichier vidéo dans ce torrent" });
        return;
      }
      dispatch({ type: "file", name: target.name });
      dispatch({ type: "phase", status: "connecting" });

      // Surveille l'arrivée des octets ; dès qu'un octet est reçu, renderTo
      // (MediaSource → décodage GPU local). Sans octet avant le timeout →
      // "stalled" (le lecteur bascule alors vers le flux serveur).
      const firstByteAt = Date.now();
      const dataWatch = setInterval(() => {
        if (torrent.progress > 0) {
          clearInterval(dataWatch);
          const el = videoRef.current;
          if (!el) return;
          dispatch({ type: "phase", status: "ready" });
          const file = torrent.files.find((f) => f.path === target.path);
          if (!file) return;
          file.renderTo(el, { autoplay: true, controls: false }, (err) => {
            if (err) {
              console.warn("[P2P] renderTo failed:", err.message);
              dispatch({ type: "stall" });
            }
          });
        } else if (Date.now() - firstByteAt > stallTimeoutMs) {
          clearInterval(dataWatch);
          dispatch({ type: "stall" });
        }
      }, 500);
      addDisposer(() => clearInterval(dataWatch));

      const stats = setInterval(() => {
        dispatch({
          type: "stats",
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          peers: torrent.numPeers,
        });
      }, 1000);
      addDisposer(() => clearInterval(stats));
    } catch (err) {
      if (abort.signal.aborted) return;
      dispatch({ type: "fail", message: err instanceof Error ? err.message : String(err) });
    }
  }, [title, year, type, season, episode, stallTimeoutMs, videoRef, runDisposers, dropTorrent, addDisposer]);

  // Session lifecycle : démarre quand `enabled`, tout est nettoyé au stop.
  useEffect(() => {
    if (!enabled) {
      runDisposers();
      dropTorrent();
      dispatch({ type: "reset" });
      return;
    }
    void startSession();
    return () => {
      runDisposers();
      dropTorrent();
    };
  }, [enabled, startSession, runDisposers, dropTorrent]);

  const retry = useCallback(() => {
    void startSession();
  }, [startSession]);

  const downloadToDisk = useCallback(
    async (filename?: string) => {
      const torrent = torrentRef.current;
      if (!torrent) throw new Error("P2P : aucun torrent actif");

      const target = pickTorrentVideoFile(torrent.files, season, episode);
      if (!target) throw new Error("P2P : fichier vidéo introuvable");

      const file = torrent.files.find((f) => f.path === target.path);
      if (!file) throw new Error("P2P : fichier vidéo introuvable");

      // Pièces demandées explicitement, puis flux torrent → disque via
      // StreamSaver : 100 % client-side, aucune bande passante serveur,
      // compatible fichiers multi-GB (pas de Blob complet en mémoire).
      file.download();

      const { getStreamSaver } = await import("@/services/streamSaver");
      const ss = (await getStreamSaver()) as unknown as {
        createWriteStream(filename: string): {
          write(chunk: Uint8Array): boolean;
          close(): Promise<void>;
          abort(reason?: string): void;
        };
      };
      const writer = ss.createWriteStream(filename ?? target.name);
      const readStream = file.createReadStream({ start: 0, end: file.length - 1 });

      try {
        for await (const chunk of readStream) {
          writer.write(chunk);
        }
        await writer.close();
      } catch (err) {
        try {
          writer.abort(String(err instanceof Error ? err.message : err));
        } catch {
          /* writer déjà fermé */
        }
        throw err;
      }
    },
    [season, episode],
  );

  return {
    status: state.status,
    progress: state.progress,
    downloadSpeed: state.downloadSpeed,
    peers: state.peers,
    error: state.error,
    magnet: state.magnet,
    fileName: state.fileName,
    retry,
    downloadToDisk,
  };
}