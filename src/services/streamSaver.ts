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
  /** Whether to accumulate and return the full Blob in memory (defaults to false to save RAM). */
  saveBlob?: boolean;
}

export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export interface StreamDownloadResult {
  totalBytes: number | null;
  blob?: Blob;
}

/**
 * Streams a remote URL to disk via StreamSaver on desktop / Chrome / Android,
 * and routes through native iOS Safari download manager on iPhone/iPad.
 */
export async function streamDownloadToDisk(
  url: string,
  opts: StreamDownloadOptions,
): Promise<StreamDownloadResult> {
  if (typeof window === "undefined") {
    throw new Error("streamDownloadToDisk is browser-only");
  }

  const { filename, signal, onProgress, throttleMs = 200, saveBlob = false } = opts;

  if (isIOS()) {
    // iOS Safari doesn't support WritableStream / StreamSaver MITM iframe.
    // Trigger native iOS download dialog directly through backend proxy.
    const href = url.startsWith('/api/') ? url : `/api/download/file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { totalBytes: null };
  }

  await ensureStreamSaverReady();
  const ss = await getStreamSaver();

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

    // Throttled progress reporting & chunk accumulation if saveBlob requested
    let lastEmit = 0;
    let bytes = 0;
    const chunks: Uint8Array[] = [];

    const pipe = new WritableStream<Uint8Array>({
      async write(chunk) {
        bytes += chunk.byteLength;
        if (saveBlob) {
          chunks.push(chunk);
        }
        const now = Date.now();
        if (onProgress && now - lastEmit >= throttleMs) {
          lastEmit = now;
          onProgress(bytes, totalBytes);
        }
        await writer.write(chunk);
      },
      abort(reason) {
        try {
          writer.abort(reason);
        } catch {}
      },
    });

    await res.body.pipeTo(pipe, { signal: timeoutCtrl.signal });

    try {
      await writer.close();
    } catch {}

    const fullBlob = saveBlob ? new Blob(chunks as BlobPart[], { type: "video/mp4" }) : undefined;
    return { totalBytes, blob: fullBlob };
  } finally {
    clearTimeout(timeoutTimer);
    signal.removeEventListener("abort", onExternalAbort);
  }
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
