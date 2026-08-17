"use client";

// Thin wrapper around StreamSaver.js that initialises the MITM polyfill lazily
// (browser-only) and exposes a single `streamDownloadToDisk` function.
//
// Why: keep StreamSaver concerns out of components and centralise the SW path.
// On the server or in tests, the functions are no-ops so callers don't crash.
//
// SSR note: `streamsaver` references `document` at module-evaluation time, so we
// must NOT import it eagerly — Next.js still evaluates client modules during SSR
// to extract metadata. We load it lazily on first browser use.

let streamSaverModule: typeof import("streamsaver") | null = null;
let _mitmReady = false;

export async function getStreamSaver() {
  if (streamSaverModule) return streamSaverModule;
  // The dynamic import is what makes this safe under SSR — webpack will still
  // bundle streamsaver into the client chunk, but the import only runs in the
  // browser because all callers guard on `typeof window !== "undefined"`.
  streamSaverModule = (await import("streamsaver")).default as unknown as typeof import("streamsaver");
  return streamSaverModule;
}

/** Ensure the mitm.html proxy is wired up. Idempotent. */
export async function ensureStreamSaverReady() {
  if (typeof window === "undefined" || _mitmReady) return;
  const ss = await getStreamSaver();
  // The mitm.html that ships with StreamSaver must live at the same origin
  // (copied to /public/mitm.html during Phase 0).
  (ss as any).mitm = "/mitm.html";
  _mitmReady = true;
}

export interface StreamDownloadOptions {
  /** Suggested filename (will be sanitised). */
  filename: string;
  /** Caller's AbortSignal — aborting cancels the in-flight stream. */
  signal: AbortSignal;
  /** Fires whenever new bytes arrive. Called at most every `throttleMs` ms. */
  onProgress?: (bytesDownloaded: number, totalBytes: number | null) => void;
  /** Minimum ms between progress emissions (default 200). */
  throttleMs?: number;
}

/**
 * Streams a remote URL to disk via StreamSaver.
 *
 * Returns a promise that resolves when the file is fully written or rejects
 * on abort / network failure. The caller is expected to wrap this in a try
 * and update the downloads store on settle.
 */
export async function streamDownloadToDisk(
  url: string,
  opts: StreamDownloadOptions,
): Promise<{ totalBytes: number | null }> {
  if (typeof window === "undefined") {
    throw new Error("streamDownloadToDisk is browser-only");
  }
  await ensureStreamSaverReady();
  const ss = await getStreamSaver();

  const { filename, signal, onProgress, throttleMs = 200 } = opts;
  const fileStream = (ss as any).createWriteStream(filename);
  const writer = fileStream.getWriter();

  // Combine the caller's signal with an internal timeout so a stuck server
  // doesn't hang the download forever.
  const timeoutCtrl = new AbortController();
  const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 30 * 60_000); // 30 min

  const onExternalAbort = () => timeoutCtrl.abort(signal.reason);
  signal.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const res = await fetch(url, { signal: timeoutCtrl.signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} while downloading`);
    }

    const totalBytes = parseContentLength(res.headers.get("content-length"));

    // Throttled progress reporting. We still consume every chunk regardless.
    let lastEmit = 0;
    let bytes = 0;

    const pipe = new WritableStream<Uint8Array>({
      async write(chunk) {
        bytes += chunk.byteLength;
        const now = Date.now();
        if (onProgress && now - lastEmit >= throttleMs) {
          lastEmit = now;
          onProgress(bytes, totalBytes);
        }
        await writer.write(chunk);
      },
      abort(reason) {
        // When the pipe aborts, the writer must be aborted too so the
        // browser doesn't leave a half-written file on disk.
        try {
          writer.abort(reason);
        } catch {
          /* writer already closed */
        }
      },
    });

    await res.body.pipeTo(pipe, { signal: timeoutCtrl.signal });

    if (onProgress) onProgress(bytes, totalBytes);
    return { totalBytes };
  } finally {
    clearTimeout(timeoutTimer);
    signal.removeEventListener("abort", onExternalAbort);
    try {
      await writer.close();
    } catch {
      /* writer may already be closed if the user aborted */
    }
  }
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
