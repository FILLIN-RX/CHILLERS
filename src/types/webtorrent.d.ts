declare module "webtorrent/dist/webtorrent.min.js" {
  export * from "webtorrent";
  export { default } from "webtorrent";
}

declare module "webtorrent" {
  export interface WebTorrentFile {
    name: string;
    path: string;
    length: number;
    progress: number;
    done: boolean;
    download(cb?: (err?: Error) => void): void;
    createReadStream(opts?: { start?: number; end?: number }): AsyncIterable<Uint8Array>;
    renderTo(
      elem: HTMLMediaElement | string,
      opts?: { autoplay?: boolean; controls?: boolean; muted?: boolean },
      cb?: (err?: Error) => void,
    ): void;
    getBlobURL(cb: (err?: Error, url?: string) => void): void;
  }

  export interface Torrent {
    infoHash: string;
    name: string;
    magnetURI: string;
    progress: number;
    downloadSpeed: number;
    uploadSpeed: number;
    numPeers: number;
    done: boolean;
    files: WebTorrentFile[];
    destroy(cb?: (err?: Error) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    once(event: string, listener: (...args: unknown[]) => void): void;
    removeListener(event: string, listener: (...args: unknown[]) => void): void;
  }

  export interface WebTorrentInstance {
    add(
      torrentId: string | Uint8Array,
      opts?: Record<string, unknown>,
      cb?: (err?: Error, torrent?: Torrent) => void,
    ): Promise<Torrent> | Torrent;
    get(torrentId: string): Torrent | undefined;
    remove(torrentId: string | Torrent, cb?: (err?: Error) => void): void;
    destroy(cb?: (err?: Error) => void): void;
  }

  class WebTorrent {
    constructor(opts?: Record<string, unknown>);
    add(
      torrentId: string | Uint8Array,
      opts?: Record<string, unknown>,
      cb?: (err: Error | null, torrent?: Torrent) => void,
    ): Promise<Torrent>;
    get(torrentId: string): Torrent | undefined;
    remove(torrentId: string | Torrent, cb?: (err: Error | null) => void): void;
    destroy(cb?: (err: Error | null) => void): void;
    [key: string]: unknown;
  }

  export default WebTorrent;
}